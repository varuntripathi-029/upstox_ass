// GET /api/upstox/charges?instrument_token=NSE_EQ|INE040A01034&quantity=40&product=D&transaction_type=SELL&price=2745.96
// Brokerage API (GET /v2/charges/brokerage): the real cost of selling and buying back, for the harvest panel.
// Charges needs no static IP with an Analytics Token. Without a token: 501, and the UI estimates from the user's own orders.
import type { UpstoxBrokerageResponse } from '../../src/upstox/types.js'
import { tokenFor, badRequest, CACHE_QUOTES, json, notConfigured, upstoxGet, upstream } from '../_lib/upstox.js'

export default async function (request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams
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
