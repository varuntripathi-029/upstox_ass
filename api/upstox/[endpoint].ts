// The four Analytics-Token / session endpoints behind one function: /api/upstox/ltp, /charges,
// /fmv-2018 and /corporate-actions. The URLs, params and responses are exactly as before; they share a
// function because Vercel's Hobby plan allows 12 Serverless Functions per deployment (TECH.md §4).
// Each needs a token: the logged-in session first, then UPSTOX_ANALYTICS_TOKEN. With neither, the
// route answers 501 and the UI quietly keeps its cached values.
import type { UpstoxBrokerageResponse, UpstoxCandleResponse, UpstoxCorporateActionsResponse, UpstoxLtpResponse } from '../../src/upstox/types.js'
import { tokenFor, badRequest, CACHE_QUOTES, CACHE_STATIC, json, listParam, notConfigured, upstoxGet, upstream } from '../_lib/upstox.js'

/** R22 grandfathering: the FMV is the HIGH of the 31-Jan-2018 daily candle. */
const FMV_DAY = '2018-01-31'

type Handler = (url: URL, request: Request) => Promise<Response>

/** LTP Quotes V3 (GET /v3/market-quote/ltp): current prices for "tax if sold today". */
const ltp: Handler = async (url, request) => {
  const keys = listParam(url, 'instrument_key', 50)
  if (!keys.length) return badRequest('Pass ?instrument_key=NSE_EQ|ISIN,... (up to 50).')
  const auth = await tokenFor(request)
  if (!auth) return notConfigured('Live prices (LTP Quotes V3)')
  const res = await upstoxGet<UpstoxLtpResponse>(`/v3/market-quote/ltp?instrument_key=${encodeURIComponent(keys.join(','))}`, auth.token)
  if (!res.ok) return upstream(`LTP Quotes V3 failed (HTTP ${res.status}).`)
  const data = Object.fromEntries(
    Object.entries(res.data.data ?? {}).map(([k, v]) => [k, { lastPricePaise: Math.round(v.last_price * 100), instrumentToken: v.instrument_token }]),
  )
  return json({ status: 'success', source: 'upstox-ltp-v3', fetchedAt: new Date().toISOString(), data }, { cache: CACHE_QUOTES })
}

/** Brokerage API (GET /v2/charges/brokerage): the real cost of selling and buying back. */
const charges: Handler = async (url, request) => {
  const q = url.searchParams
  const instrument = q.get('instrument_token')
  const quantity = Number(q.get('quantity'))
  const price = Number(q.get('price'))
  const product = q.get('product') ?? 'D'
  const side = q.get('transaction_type') ?? 'SELL'
  if (!instrument || !Number.isInteger(quantity) || quantity <= 0 || !(price > 0)) {
    return badRequest('Pass instrument_token, quantity (>0), price (>0), product (D|I), transaction_type (BUY|SELL).')
  }
  if (!['D', 'I'].includes(product) || !['BUY', 'SELL'].includes(side)) return badRequest('product must be D or I; transaction_type must be BUY or SELL.')
  const auth = await tokenFor(request)
  if (!auth) return notConfigured('Real charges (Brokerage API)')
  const path = `/v2/charges/brokerage?instrument_token=${encodeURIComponent(instrument)}&quantity=${quantity}&product=${product}&transaction_type=${side}&price=${price}`
  const res = await upstoxGet<UpstoxBrokerageResponse>(path, auth.token)
  if (!res.ok) return upstream(`Brokerage API failed (HTTP ${res.status}).`)
  const c = res.data.data.charges
  return json(
    {
      status: 'success',
      source: 'upstox-brokerage',
      fetchedAt: new Date().toISOString(),
      data: {
        totalPaise: Math.round(c.total * 100),
        brokeragePaise: Math.round(c.brokerage * 100),
        sttPaise: Math.round(c.taxes.stt * 100),
        gstPaise: Math.round(c.taxes.gst * 100),
        stampPaise: Math.round(c.taxes.stamp_duty * 100),
        dpPaise: Math.round((c.dp_plan?.min_expense ?? 0) * 100),
      },
    },
    { cache: CACHE_QUOTES },
  )
}

/**
 * Historical Candle V3: GET /v3/historical-candle/{instrument_key}/days/1/{to_date}/{from_date},
 * candles ordered [timestamp, open, high, low, close, volume, open interest].
 */
const fmv2018: Handler = async (url, request) => {
  const key = url.searchParams.get('instrument_key')
  if (!key) return badRequest('Pass ?instrument_key=NSE_EQ|ISIN.')
  const auth = await tokenFor(request)
  if (!auth) return notConfigured('The 31-Jan-2018 price (Historical Candle V3)')
  // A short window covers 31 Jan not being a trading day: R22 then uses the last trading day before it.
  const res = await upstoxGet<UpstoxCandleResponse>(`/v3/historical-candle/${encodeURIComponent(key)}/days/1/${FMV_DAY}/2018-01-25`, auth.token)
  if (!res.ok) return upstream(`Historical Candle V3 failed (HTTP ${res.status}).`)
  const candles = [...(res.data.data?.candles ?? [])].sort((a, b) => a[0].localeCompare(b[0]))
  const last = candles[candles.length - 1]
  if (!last) return upstream('No candle returned for 31 Jan 2018.')
  return json(
    { status: 'success', source: 'upstox-historical-candle-v3', fetchedAt: new Date().toISOString(), data: { day: last[0].slice(0, 10), highPaise: Math.round(last[2] * 100) } },
    { cache: CACHE_STATIC },
  )
}

/** Corporate Actions (GET /v2/fundamentals/{isin}/corporate-actions): splits, bonuses and dividends. */
const corporateActions: Handler = async (url, request) => {
  const isin = url.searchParams.get('isin')
  if (!isin || !/^IN[EF][0-9A-Z]{9}$/.test(isin)) return badRequest('Pass ?isin=INE002A01018.')
  const auth = await tokenFor(request)
  if (!auth) return notConfigured('Corporate actions')
  const res = await upstoxGet<UpstoxCorporateActionsResponse>(`/v2/fundamentals/${isin}/corporate-actions`, auth.token)
  if (!res.ok) return upstream(`Corporate Actions failed (HTTP ${res.status}).`)
  const detail = (a: UpstoxCorporateActionsResponse['data'][number], name: string) =>
    a.event_details?.find((d) => d.name.toLowerCase().includes(name))?.value ?? null
  const data = (res.data.data ?? []).map((a) => ({
    type: a.name,
    exDate: detail(a, 'ex') ?? a.expiry_date,
    recordDate: detail(a, 'record'),
    ratio: a.ratio,
    amount: a.amount,
  }))
  return json({ status: 'success', source: 'upstox-corporate-actions', fetchedAt: new Date().toISOString(), data }, { cache: CACHE_STATIC })
}

const ROUTES: Record<string, Handler> = {
  ltp,
  charges,
  'fmv-2018': fmv2018,
  'corporate-actions': corporateActions,
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const endpoint = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const handler = ROUTES[endpoint]
  if (!handler) return json({ status: 'error', message: `Unknown endpoint. Try: ${Object.keys(ROUTES).join(', ')}.` }, { status: 404 })
  return handler(url, request)
}
