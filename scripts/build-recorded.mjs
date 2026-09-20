// Writes the "Demo account" recorded Upstox responses (src/upstox/recorded/*.json).
// Run: node scripts/build-recorded.mjs
//
// These are RECORDED RESPONSES in the documented shapes (verified against the API docs, Sep 2026):
//   /v2/portfolio/long-term-holdings, /v2/mf/holdings, /v2/charges/historical-trades (EQ and MF),
//   /v2/trade/profit-loss/charges (per segment + financial year), /v2/trade/profit-loss/data, /v2/mf/sips.
// We cannot call the account APIs (no login: personal apps are owner-only and the owner has no demat account),
// so the values are ours, but the shapes and the mapping path are the real ones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const navs = JSON.parse(readFileSync(new URL('../src/sample/mf-navs.json', import.meta.url), 'utf8')).funds['PPFAS-FLEXI'].navs
const dir = new URL('../src/upstox/recorded/', import.meta.url)
mkdirSync(dir, { recursive: true })
const write = (name, data) => writeFileSync(new URL(name, dir), JSON.stringify(data, null, 1) + '\n')
const r2 = (x) => Math.round(x * 100) / 100

// ---------------------------------------------------------------- equity trades (3 financial years)
const EQ = [
  { d: '2024-05-15', sym: 'TCS', isin: 'INE467B01029', name: 'TATA CONSULTANCY SERV LT', side: 'BUY', qty: 20, price: 3600 },
  { d: '2025-08-04', sym: 'HDFCBANK', isin: 'INE040A01034', name: 'HDFC BANK LTD', side: 'BUY', qty: 40, price: 1960 },
  { d: '2026-03-13', sym: 'NIFTYBEES', isin: 'INF204KB14I2', name: 'NIP IND ETF NIFTY BEES', side: 'BUY', qty: 90, price: 270.42 },
  { d: '2026-04-10', sym: 'INFY', isin: 'INE009A01021', name: 'INFOSYS LIMITED', side: 'BUY', qty: 50, price: 1450 },
  { d: '2026-05-20', sym: 'TCS', isin: 'INE467B01029', name: 'TATA CONSULTANCY SERV LT', side: 'SELL', qty: 20, price: 4200 },
  { d: '2026-07-15', sym: 'INFY', isin: 'INE009A01021', name: 'INFOSYS LIMITED', side: 'SELL', qty: 50, price: 1600 },
]
const eqTrades = EQ.map((t, i) => ({
  exchange: 'NSE',
  segment: 'EQ',
  option_type: '',
  quantity: t.qty,
  amount: r2(t.qty * t.price),
  trade_id: `T${String(i + 1).padStart(6, '0')}`,
  trade_date: t.d,
  transaction_type: t.side,
  scrip_name: t.name,
  strike_price: '0.0',
  expiry: '',
  price: t.price,
  isin: t.isin,
  symbol: t.sym,
  instrument_token: `NSE_EQ|${t.isin}`,
}))
write('historical-trades-eq.json', {
  status: 'success',
  data: eqTrades,
  errors: null,
  meta_data: { page: { page_number: 1, page_size: 100, total_records: eqTrades.length, total_pages: 1 } },
})

// ---------------------------------------------------------------- charges, per segment + financial year
const fy = (d) => `${d.slice(2, 4)}${String(Number(d.slice(0, 4)) + 1).slice(2)}`
const fyOf = (d) => (Number(d.slice(5, 7)) >= 4 ? fy(d) : fy(`${Number(d.slice(0, 4)) - 1}-04-01`))
const charges = {}
for (const t of eqTrades) {
  const y = fyOf(t.trade_date)
  const c = (charges[y] ??= { brokerage: 0, stt: 0, stamp: 0, transaction: 0, sebi: 0, dp: 0 })
  c.brokerage += 20
  c.stt += t.amount * 0.001
  if (t.transaction_type === 'BUY') c.stamp += t.amount * 0.00015
  else c.dp += 18.5
  c.transaction += t.amount * 0.0000297
  c.sebi += t.amount * 0.000001
}
for (const [y, c] of Object.entries(charges)) {
  const gst = 0.18 * (c.brokerage + c.transaction + c.sebi + c.dp)
  const breakdown = {
    total: r2(c.brokerage + c.stt + c.stamp + c.transaction + c.sebi + c.dp + gst),
    brokerage: r2(c.brokerage),
    taxes: { gst: r2(gst), stt: r2(c.stt), stamp_duty: r2(c.stamp) },
    charges: { transaction: r2(c.transaction), clearing: 0, ipft: null, others: 0, sebi_turnover: r2(c.sebi), demat_transaction: r2(c.dp) },
  }
  write(`trade-charges-${y}.json`, { status: 'success', data: { charges_breakdown: breakdown } })
}

// ---------------------------------------------------------------- profit & loss report (FY 2026-27, EQ)
const dmy = (d) => d.split('-').reverse().join('-')
write('pnl-2627.json', {
  status: 'success',
  data: [
    { quantity: 20, isin: 'INE467B01029', scrip_name: 'TATA CONSULTANCY SERV LT', trade_type: 'EQ', buy_date: dmy('2024-05-15'), buy_average: 3600, sell_date: dmy('2026-05-20'), sell_average: 4200, buy_amount: 72000, sell_amount: 84000 },
    { quantity: 50, isin: 'INE009A01021', scrip_name: 'INFOSYS LIMITED', trade_type: 'EQ', buy_date: dmy('2026-04-10'), buy_average: 1450, sell_date: dmy('2026-07-15'), sell_average: 1600, buy_amount: 72500, sell_amount: 80000 },
  ],
  metadata: { page: { page_number: 1, page_size: 2 } },
})

// ---------------------------------------------------------------- mutual fund SIP (Parag Parikh, 6 instalments)
const SIP_DAYS = ['2026-04-06', '2026-05-05', '2026-06-05', '2026-07-06', '2026-08-05', '2026-09-07']
const ISIN = 'INF879O01027'
const FUND = 'PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN GROWTH'
let units = 0
const mfTrades = SIP_DAYS.map((d, i) => {
  const nav = Number(navs[d])
  const amount = 5000
  units = Math.round((units + Math.round((amount / nav) * 1000) / 1000) * 1000) / 1000
  return {
    exchange: 'BMF',
    segment: 'MF',
    option_type: '',
    quantity: Math.floor(amount / nav), // the API reports an integer here; real units = amount ÷ price
    amount,
    trade_id: `M${String(i + 1).padStart(6, '0')}`,
    trade_date: d,
    transaction_type: 'BUY',
    scrip_name: FUND,
    strike_price: '0.0',
    expiry: '',
    price: nav,
    isin: ISIN,
    symbol: '',
    instrument_token: `BMF_MF|${ISIN}`,
  }
})
write('historical-trades-mf.json', {
  status: 'success',
  data: mfTrades,
  errors: null,
  meta_data: { page: { page_number: 1, page_size: 100, total_records: mfTrades.length, total_pages: 1 } },
})

const navToday = Number(navs['2026-09-18'])
write('mf-holdings.json', {
  status: 'success',
  data: [
    {
      instrument_key: ISIN,
      folio: '3108290884',
      fund: FUND,
      pnl: r2(units * navToday - 30000),
      quantity: units,
      average_price: r2(30000 / units),
      last_price: navToday,
      last_price_date: '2026-09-18',
      pledged_quantity: 0,
    },
  ],
})

write('mf-sips.json', {
  status: 'success',
  data: [
    {
      instrument_key: ISIN,
      fund: 'Parag Parikh Flexi Cap Fund Direct Growth',
      dividend_type: 'Growth',
      status: 'ACTIVE',
      created: '2026-04-01 00:00:00.0',
      frequency: 'MONTHLY',
      instalments: 999,
      sip_id: '133321093',
      transaction_type: 'BUY',
      next_instalment: '2026-10-05 00:00:00.0',
      instalment_amount: 5000.0,
      last_instalment: '2026-09-07 00:00:00.0',
      pending_instalments: 0,
      instalment_day: 5,
      trigger_price: 0.0,
      sip_type: 'Auto',
      completed_instalments: 6,
    },
  ],
  meta_data: { page: { page_number: 1, total_pages: 1, records: 10, total_records: 1 } },
})

// ---------------------------------------------------------------- holdings (stocks still held)
write('holdings.json', {
  status: 'success',
  data: [
    { isin: 'INE040A01034', cnc_used_quantity: 0, collateral_type: '', company_name: 'HDFC BANK LTD', haircut: 0, product: 'D', quantity: 40, trading_symbol: 'HDFCBANK', tradingsymbol: 'HDFCBANK', last_price: 2745.96, close_price: 2740.1, pnl: 31438.4, day_change: 5.86, day_change_percentage: 0.21, instrument_token: 'NSE_EQ|INE040A01034', average_price: 1960, collateral_quantity: 0, collateral_update_quantity: 0, t1_quantity: 0, exchange: 'NSE' },
    { isin: 'INF204KB14I2', cnc_used_quantity: 0, collateral_type: '', company_name: 'NIP IND ETF NIFTY BEES', haircut: 0, product: 'D', quantity: 90, trading_symbol: 'NIFTYBEES', tradingsymbol: 'NIFTYBEES', last_price: 299.31, close_price: 298.4, pnl: 2600.1, day_change: 0.91, day_change_percentage: 0.3, instrument_token: 'NSE_EQ|INF204KB14I2', average_price: 270.42, collateral_quantity: 0, collateral_update_quantity: 0, t1_quantity: 0, exchange: 'NSE' },
  ],
})

console.log('recorded: 6 EQ trades,', mfTrades.length, 'MF trades, MF units', units, 'charges years', Object.keys(charges).join(', '))
