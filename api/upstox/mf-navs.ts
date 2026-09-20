// GET /api/upstox/mf-navs?isins=INF879O01027,INF769K01DM9
// Public file, no token: downloads the Upstox MF instrument file, gunzips it server-side and returns
// only the requested schemes (current NAV, scheme_type, name). Verified: the file lists the ISIN as
// `instrument_key` and gives `last_price` (NAV) and `scheme_type` (EQUITY / ELSS / DEBT).
import { pickMfNavs } from '../../src/upstox/filter.js'
import type { UpstoxMfInstrument } from '../../src/upstox/types.js'
import { ASSETS, badRequest, CACHE_NAVS, fetchJsonGz, json, listParam, upstream } from '../_lib/upstox.js'

export async function GET(request: Request): Promise<Response> {
  const isins = listParam(new URL(request.url), 'isins', 25)
  if (!isins.length) return badRequest('Pass ?isins=ISIN1,ISIN2 (up to 25).')
  try {
    const rows = await fetchJsonGz<UpstoxMfInstrument[]>(`${ASSETS}/mf-instruments.json.gz`)
    return json({ status: 'success', source: 'upstox-mf-instruments', fetchedAt: new Date().toISOString(), data: pickMfNavs(rows, isins) }, { cache: CACHE_NAVS })
  } catch (e) {
    return upstream(`Upstox MF instrument file unavailable: ${(e as Error).message}`)
  }
}
