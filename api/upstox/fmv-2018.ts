// GET /api/upstox/fmv-2018?instrument_key=NSE_EQ|INE009A01021
// R22 grandfathering: the FMV is the HIGH of the 31-Jan-2018 daily candle.
// Historical Candle V3: GET /v3/historical-candle/{instrument_key}/days/1/{to_date}/{from_date},
// candles ordered [timestamp, open, high, low, close, volume, open interest]. Historical Data needs no static IP.
import type { UpstoxCandleResponse } from '../../src/upstox/types.js'
import { tokenFor, badRequest, CACHE_STATIC, json, notConfigured, upstoxGet, upstream } from '../_lib/upstox.js'

const FMV_DAY = '2018-01-31'

export async function GET(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get('instrument_key')
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
