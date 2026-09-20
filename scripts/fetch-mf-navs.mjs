// Fetches historical NAVs from mfapi.in (free, no key) for the demo's mutual funds and caches them
// in src/sample/mf-navs.json. Run: node scripts/fetch-mf-navs.mjs
// The app and the tests only ever read the cache; they never call the network.
import { writeFileSync } from 'node:fs'

const FUNDS = [
  { code: 122639, symbol: 'PPFAS-FLEXI' },
  { code: 135781, symbol: 'MIRAE-ELSS' },
  { code: 119016, symbol: 'HDFC-SHORT' },
]
const FROM = '2023-10-01'
const TO = '2026-09-18'

const toIso = (d) => d.split('-').reverse().join('-') // mfapi uses DD-MM-YYYY
const out = { source: 'https://api.mfapi.in/mf/{code}', fetchedOn: new Date().toISOString().slice(0, 10), from: FROM, to: TO, funds: {} }
for (const f of FUNDS) {
  const res = await fetch(`https://api.mfapi.in/mf/${f.code}`)
  if (!res.ok) throw new Error(`mfapi ${f.code}: HTTP ${res.status}`)
  const json = await res.json()
  const navs = Object.fromEntries(
    json.data
      .map((r) => [toIso(r.date), r.nav])
      .filter(([d]) => d >= FROM && d <= TO)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  out.funds[f.symbol] = { mfapiCode: f.code, schemeName: json.meta.scheme_name, isin: json.meta.isin_growth, navs }
  console.log(f.symbol, json.meta.scheme_name, json.meta.isin_growth, Object.keys(navs).length, 'NAVs')
}
writeFileSync(new URL('../src/sample/mf-navs.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
