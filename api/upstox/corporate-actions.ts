// GET /api/upstox/corporate-actions?isin=INE002A01018
// Corporate Actions (GET /v2/fundamentals/{isin}/corporate-actions): splits, bonuses and dividends.
// Fundamentals needs no static IP with an Analytics Token.
import type { UpstoxCorporateActionsResponse } from '../../src/upstox/types'
import { analyticsToken, badRequest, CACHE_STATIC, json, notConfigured, upstoxGet, upstream } from '../_lib/upstox'

type Action = UpstoxCorporateActionsResponse['data'][number]
const detail = (a: Action, name: string) => a.event_details?.find((d) => d.name.toLowerCase().includes(name))?.value ?? null

export async function GET(request: Request): Promise<Response> {
  const isin = new URL(request.url).searchParams.get('isin')
  if (!isin || !/^IN[EF][0-9A-Z]{9}$/.test(isin)) return badRequest('Pass ?isin=INE002A01018.')
  const token = analyticsToken()
  if (!token) return notConfigured('Corporate actions')
  const res = await upstoxGet<UpstoxCorporateActionsResponse>(`/v2/fundamentals/${isin}/corporate-actions`, token)
  if (!res.ok) return upstream(`Corporate Actions failed (HTTP ${res.status}).`)
  const data = (res.data.data ?? []).map((a) => ({ type: a.name, exDate: detail(a, 'ex') ?? a.expiry_date, recordDate: detail(a, 'record'), ratio: a.ratio, amount: a.amount }))
  return json({ status: 'success', source: 'upstox-corporate-actions', fetchedAt: new Date().toISOString(), data }, { cache: CACHE_STATIC })
}
