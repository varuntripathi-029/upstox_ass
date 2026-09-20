// GET /api/upstox/ltp?instrument_key=NSE_EQ|INE009A01021,NSE_EQ|INE040A01034
// LTP Quotes V3 (GET /v3/market-quote/ltp). Market Quote needs no static IP with an Analytics Token.
// Without a token this returns 501 and the UI keeps its cached prices.
import type { UpstoxLtpResponse } from '../../src/upstox/types.js'
import { tokenFor, badRequest, CACHE_QUOTES, json, listParam, notConfigured, upstoxGet, upstream } from '../_lib/upstox.js'

export async function GET(request: Request): Promise<Response> {
  const keys = listParam(new URL(request.url), 'instrument_key', 50)
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
