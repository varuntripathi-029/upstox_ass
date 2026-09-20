// GET /api/upstox/instruments?isins=INE009A01021,INE040A01034
// Public file, no token: NSE.json.gz filtered to the demo's instruments (instrument_key, ISIN,
// trading symbol, name, tick size). Never sends the whole file (Vercel's response limit is 4.5 MB).
import { pickInstruments } from '../../src/upstox/filter.js'
import type { UpstoxNseInstrument } from '../../src/upstox/types.js'
import { ASSETS, badRequest, CACHE_INSTRUMENTS, fetchJsonGz, json, listParam, upstream } from '../_lib/upstox.js'

export async function GET(request: Request): Promise<Response> {
  const isins = listParam(new URL(request.url), 'isins', 50)
  if (!isins.length) return badRequest('Pass ?isins=ISIN1,ISIN2 (up to 50).')
  try {
    const rows = await fetchJsonGz<UpstoxNseInstrument[]>(`${ASSETS}/NSE.json.gz`)
    return json({ status: 'success', source: 'upstox-nse-instruments', fetchedAt: new Date().toISOString(), data: pickInstruments(rows, isins) }, { cache: CACHE_INSTRUMENTS })
  } catch (e) {
    return upstream(`Upstox NSE instrument file unavailable: ${(e as Error).message}`)
  }
}
