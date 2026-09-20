// Builds persona 6, Neha (PRODUCT.md §10.1), from the cached mfapi.in NAVs (src/sample/mf-navs.json).
// Run: node scripts/build-neha.mjs   (no network; refresh NAVs with scripts/fetch-mf-navs.mjs)
// RAW inputs only: every SIP instalment and the redemption as MF trades (amount, NAV, units, stamp duty),
// plus the holdings snapshot at the 18 Sep 2026 NAV. The engine derives every figure.
import { readFileSync, writeFileSync } from 'node:fs'

const cache = JSON.parse(readFileSync(new URL('../src/sample/mf-navs.json', import.meta.url), 'utf8'))
const AS_OF = '2026-09-18'
const NO = { brokerage: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, gst: 0, dp: 0 }

const FUNDS = [
  { symbol: 'PPFAS-FLEXI', name: 'Parag Parikh Flexi Cap Fund Direct Growth', shortName: 'Parag Parikh', isin: 'INF879O01027', assetClass: 'EQUITY_MF', amount: 5_000_00, day: 5, from: '2024-04', to: '2026-09' },
  { symbol: 'MIRAE-ELSS', name: 'Mirae Asset ELSS Tax Saver Fund Direct Growth', shortName: 'Mirae Asset ELSS', isin: 'INF769K01DM9', assetClass: 'EQUITY_MF', elss: true, amount: 3_000_00, day: 10, from: '2023-10', to: '2026-09' },
  { symbol: 'HDFC-SHORT', name: 'HDFC Short Term Fund Direct Growth', shortName: 'HDFC Short Term', isin: 'INF179K01YM7', assetClass: 'DEBT_MF', amount: 1_00_000_00, lumpSum: '2024-06-14' },
]
const REDEMPTION = { symbol: 'PPFAS-FLEXI', day: '2026-06-15', units: 666.348 }

// R24 (same formula as src/engine/mf.ts; a test checks every lot against it)
const stamp = (amount) => Math.round((amount * 50) / 1_000_000)
const navE5 = (nav) => {
  const [i, f = ''] = nav.split('.')
  return Number(i) * 100_000 + Number((f + '00000').slice(0, 5))
}
const units = (amount, nav) => Math.floor((amount * (1_000_000 - 50)) / navE5(nav)) / 1000

const navsOf = (s) => cache.funds[s].navs
const allot = (s, day) => Object.keys(navsOf(s)).find((d) => d >= day) // first NAV date on or after the SIP date

const trades = []
const held = {}
let n = 0
for (const f of FUNDS) {
  const days = []
  if (f.lumpSum) days.push(f.lumpSum)
  else {
    for (let [y, m] = f.from.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= f.to; m === 12 ? ((m = 1), y++) : m++) {
      days.push(`${y}-${String(m).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`)
    }
  }
  for (const sip of days) {
    const d = allot(f.symbol, sip)
    const nav = navsOf(f.symbol)[d]
    const u = units(f.amount, nav)
    trades.push({
      id: `neha-${String(++n).padStart(3, '0')}`,
      symbol: f.symbol,
      segment: 'MF',
      time: `${d}T15:00:00+05:30`,
      side: 'BUY',
      qty: u,
      pricePaise: navE5(nav) / 1000,
      amountPaise: f.amount,
      charges: { ...NO, stamp: stamp(f.amount) },
    })
    held[f.symbol] = Math.round(((held[f.symbol] ?? 0) + u) * 1000) / 1000
  }
}
{
  const nav = navsOf(REDEMPTION.symbol)[REDEMPTION.day]
  trades.push({
    id: `neha-${String(++n).padStart(3, '0')}`,
    symbol: REDEMPTION.symbol,
    segment: 'MF',
    time: `${REDEMPTION.day}T15:00:00+05:30`,
    side: 'SELL',
    qty: REDEMPTION.units,
    pricePaise: navE5(nav) / 1000,
    amountPaise: Math.round((REDEMPTION.units * navE5(nav)) / 1000),
    charges: NO,
  })
  held[REDEMPTION.symbol] = Math.round((held[REDEMPTION.symbol] - REDEMPTION.units) * 1000) / 1000
}
trades.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))

const persona = {
  id: 'neha',
  name: 'Neha',
  tagline: 'SIP investor · ₹11L salary',
  story: "Your SIP isn't one investment; it's 66 investments with their own tax clocks. The rebate covers your debt-fund gains but not equity gains.",
  settings: { regime: 'new', otherIncomePaise: 11_00_000_00, otherIncomeIsSalary: true, otherBrokerLtcgPaise: 0 },
  portfolio: {
    source: 'sample',
    asOf: `${AS_OF}T18:00:00+05:30`,
    tradeHistoryFrom: '2023-04-01',
    instruments: FUNDS.map((f) => ({ symbol: f.symbol, name: f.name, shortName: f.shortName, isin: f.isin, assetClass: f.assetClass, ...(f.elss ? { elss: true } : {}) })),
    corporateActions: [],
    holdings: FUNDS.map((f) => ({
      symbol: f.symbol,
      qty: held[f.symbol],
      avgPricePaise: 0,
      ltpPaise: navE5(navsOf(f.symbol)[AS_OF]) / 1000,
    })),
    trades,
  },
}
writeFileSync(new URL('../src/sample/personas/neha.json', import.meta.url), JSON.stringify(persona, null, 1) + '\n')
console.log('neha:', trades.length, 'trades;', Object.entries(held).map(([s, u]) => `${s} ${u}`).join(', '))
