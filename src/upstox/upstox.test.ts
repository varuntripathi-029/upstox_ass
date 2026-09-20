// Stage 3: the Upstox layer. No network: the gz test builds its own fixture and the account tests
// use the recorded responses. The live client is exercised with a stubbed fetch.
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyze } from '@/engine/analyze'
import { formatINR } from '@/engine/money'
import { buildInput, initialState } from '@/demo/scenario'
import { applyLive, loadLive, NO_LIVE } from '@/demo/live'
import { fetchMfNavs, fetchLtp } from './client'
import { pickInstruments, pickMfNavs } from './filter'
import { allocateCharges, financialYearOfTrade, mfUnitsFromTrade, spread } from './map'
import { recordedInput, recordedPnlRealized, recordedResponses, RECORDED_SETTINGS } from './account'
import type { UpstoxMfInstrument, UpstoxNseInstrument } from './types'

// A tiny stand-in for the real .json.gz files (the shapes are the documented ones).
const MF_ROWS: UpstoxMfInstrument[] = [
  { instrument_key: 'INF879O01027', name: 'PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN GROWTH', scheme_type: 'EQUITY', plan: 'DIRECT', last_price: 89.7169 },
  { instrument_key: 'INF879O01027', name: 'PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN GROWTH', scheme_type: 'EQUITY', plan: 'DIRECT', last_price: 89.7169 },
  { instrument_key: 'INF769K01DM9', name: 'MIRAE ASSET ELSS TAX SAVER FUND - DIRECT GROWTH', scheme_type: 'ELSS', last_price: 56.753 },
  { instrument_key: 'INF179K01YM7', name: 'HDFC SHORT TERM FUND - DIRECT PLAN - GROWTH OPTION', scheme_type: 'DEBT', last_price: 35.4139 },
  { instrument_key: 'INF000000000', name: 'SOMETHING ELSE', scheme_type: 'DEBT', last_price: 12.3 },
]
const NSE_ROWS: UpstoxNseInstrument[] = [
  { segment: 'NSE_EQ', name: 'INFOSYS LIMITED', exchange: 'NSE', isin: 'INE009A01021', instrument_type: 'EQ', instrument_key: 'NSE_EQ|INE009A01021', trading_symbol: 'INFY', tick_size: 10, lot_size: 1 },
  { segment: 'NSE_FO', name: 'INFOSYS FUT', exchange: 'NSE', isin: 'INE009A01021', instrument_type: 'FUT', instrument_key: 'NSE_FO|12345', trading_symbol: 'INFY26SEPFUT', tick_size: 5, lot_size: 400 },
  { segment: 'NSE_EQ', name: 'NIP IND ETF NIFTY BEES', exchange: 'NSE', isin: 'INF204KB14I2', instrument_type: 'EQ', instrument_key: 'NSE_EQ|INF204KB14I2', trading_symbol: 'NIFTYBEES', tick_size: 1, lot_size: 1 },
]

/** What the endpoint does: download → gunzip → keep only the demo's rows. */
const gunzipAndPick = <T,>(rows: T[], pick: (r: T[]) => unknown) => {
  const gz = gzipSync(Buffer.from(JSON.stringify(rows)))
  return pick(JSON.parse(gunzipSync(gz).toString()) as T[])
}

afterEach(() => vi.unstubAllGlobals())

describe('public instrument files (no token)', () => {
  it('gunzips and keeps only the wanted funds, once each, with NAV sub-paise precision', () => {
    const navs = gunzipAndPick(MF_ROWS, (rows) => pickMfNavs(rows as UpstoxMfInstrument[], ['INF879O01027', 'INF769K01DM9', 'INF179K01YM7']))
    expect(navs).toEqual([
      { isin: 'INF879O01027', name: 'PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN GROWTH', schemeType: 'EQUITY', navPaise: 8971.69 },
      { isin: 'INF769K01DM9', name: 'MIRAE ASSET ELSS TAX SAVER FUND - DIRECT GROWTH', schemeType: 'ELSS', navPaise: 5675.3 },
      { isin: 'INF179K01YM7', name: 'HDFC SHORT TERM FUND - DIRECT PLAN - GROWTH OPTION', schemeType: 'DEBT', navPaise: 3541.39 },
    ])
  })
  it('keeps only NSE_EQ rows for the wanted stocks', () => {
    expect(gunzipAndPick(NSE_ROWS, (rows) => pickInstruments(rows as UpstoxNseInstrument[], ['INE009A01021', 'INF204KB14I2']))).toEqual([
      { isin: 'INE009A01021', instrumentKey: 'NSE_EQ|INE009A01021', tradingSymbol: 'INFY', name: 'INFOSYS LIMITED', tickSizePaise: 10 },
      { isin: 'INF204KB14I2', instrumentKey: 'NSE_EQ|INF204KB14I2', tradingSymbol: 'NIFTYBEES', name: 'NIP IND ETF NIFTY BEES', tickSizePaise: 1 },
    ])
  })
  it('ignores funds we did not ask for', () => {
    expect(pickMfNavs(MF_ROWS, ['INF879O01027'])).toHaveLength(1)
  })
})

describe('mapping recorded responses into the engine input', () => {
  const input = recordedInput()
  const report = analyze(input, RECORDED_SETTINGS)

  it('MF units come from amount ÷ price, not the integer quantity field', () => {
    expect(mfUnitsFromTrade({ amount: 999.9852, price: 71.9 })).toBe(13.908) // the docs example
    const mf = recordedResponses().mfTrades.data[0]
    expect(mf.quantity).toBe(Math.floor(mf.amount / mf.price))
    const lot = input.trades.find((t) => t.segment === 'MF')!
    expect(lot.qty).toBe(mfUnitsFromTrade(mf))
    expect(lot.qty).not.toBe(mf.quantity)
    expect(lot.amountPaise).toBe(Math.round(mf.amount * 100))
  })
  it('trades, holdings and instruments map across', () => {
    expect(input.trades.filter((t) => t.segment === 'EQ')).toHaveLength(6)
    expect(input.trades.filter((t) => t.segment === 'MF')).toHaveLength(6)
    expect(input.holdings.map((h) => h.symbol)).toEqual(['HDFCBANK', 'NIFTYBEES', 'INF879O01027'])
    expect(input.instruments.find((i) => i.symbol === 'NIFTYBEES')!.assetClass).toBe('EQUITY_ETF') // INF… ISIN
    expect(input.instruments.find((i) => i.symbol === 'INF879O01027')!.assetClass).toBe('EQUITY_MF')
    expect(report.warnings).toEqual([])
  })
  it('the per-year charges aggregate is spread over that year’s trades and adds up exactly', () => {
    const { charges } = recordedResponses()
    for (const [fy, res] of Object.entries(charges)) {
      const trades = recordedResponses().trades.data.filter((t) => financialYearOfTrade(t.trade_date) === fy)
      const allocated = allocateCharges(res.data.charges_breakdown, trades)
      const total = allocated.reduce((a, c) => a + c.brokerage + c.stt + c.exchange + c.sebi + c.stamp + c.gst + c.dp, 0)
      expect(total).toBe(Math.round(res.data.charges_breakdown.total * 100))
    }
    expect(spread(100, [1, 1, 1])).toEqual([34, 33, 33])
  })
  it('the engine’s realized gain matches the P&L report the account also returns', () => {
    const pnl = recordedPnlRealized()
    const realized = report.buckets.filter((b) => b.id === 'EQ_LT' || b.id === 'EQ_ST').reduce((a, b) => a + b.gains, 0)
    // The engine deducts charges from the gain; the P&L report is gross, so allow the year's charges.
    expect(Math.abs(realized - pnl.gain)).toBeLessThan(400_00)
    expect(pnl.gain).toBe(19_500_00)
  })
  it('produces a sensible report for the demo account (ITR-2, Section 156 warning, SIP lots)', () => {
    expect(report.filing.itr).toBe('ITR-2')
    expect(report.section156.show).toBe(true)
    expect(report.mf.funds[0].shortTerm.lots).toBe(6)
    expect(formatINR(report.summary.grossGains)).toMatch(/^₹\d/)
  })
})

describe('live data and fallback', () => {
  const seed = buildInput(initialState('neha'))
  const stub = (handler: (url: string) => { status: number; body: unknown }) =>
    vi.stubGlobal('fetch', async (url: string) => {
      const { status, body } = handler(String(url))
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    })

  it('applies live NAVs over the seed prices', async () => {
    stub((url) =>
      url.includes('mf-navs')
        ? { status: 200, body: { status: 'success', fetchedAt: '2026-09-18T12:00:00Z', data: [{ isin: 'INF879O01027', name: 'PPFAS', schemeType: 'EQUITY', navPaise: 8971.69 }] } }
        : url.includes('instruments')
          ? { status: 200, body: { status: 'success', data: [] } }
          : { status: 501, body: { status: 'not_configured', message: 'needs a token' } },
    )
    const live = await loadLive(seed)
    expect(live.navState).toBe('live')
    expect(live.navs['INF879O01027']).toBe(8971.69)
    const applied = applyLive(seed, live)
    expect(applied.holdings.find((h) => h.symbol === 'PPFAS-FLEXI')!.ltpPaise).toBe(8971.69)
    // Funds we got no NAV for keep their seeded price.
    expect(applied.holdings.find((h) => h.symbol === 'MIRAE-ELSS')!.ltpPaise).toBe(seed.holdings.find((h) => h.symbol === 'MIRAE-ELSS')!.ltpPaise)
  })

  it('falls back to cached values when the token is missing (501) or a call fails', async () => {
    stub(() => ({ status: 501, body: { status: 'not_configured', message: 'Live prices (LTP Quotes V3) needs an Upstox Analytics Token.' } }))
    const ltp = await fetchLtp(['NSE_EQ|INE009A01021'])
    expect(ltp).toMatchObject({ data: null, state: 'cached' })
    expect(ltp.reason).toMatch(/Analytics Token/)

    const live = await loadLive(seed)
    expect(live).toMatchObject({ navState: 'cached', priceState: 'cached' })
    expect(applyLive(seed, live).holdings).toEqual(seed.holdings)

    vi.stubGlobal('fetch', async () => {
      throw new Error('network down')
    })
    expect(await fetchMfNavs(['INF879O01027'])).toMatchObject({ data: null, state: 'cached', reason: 'network down' })
    expect(applyLive(seed, NO_LIVE).holdings).toEqual(seed.holdings)
  })
})

describe('Sample mode is untouched by stage 3', () => {
  it('Priya still matches §10 exactly', () => {
    const s = initialState('priya')
    const r = analyze(buildInput(s), s.settings)
    expect([r.summary.grossGains, r.summary.tax, r.summary.charges, r.summary.keep]).toEqual([42_620_00, 3_078_00, 3_420_00, 36_122_00])
  })
  it('Neha still matches §10.1 exactly (seed NAVs, no live call)', () => {
    const s = initialState('neha')
    const r = analyze(buildInput(s), s.settings)
    expect(r.mf.funds.find((f) => f.symbol === 'PPFAS-FLEXI')!.nav).toBe(8985.69)
    expect(formatINR(r.mf.withdrawFree)).toBe('₹2,10,879')
  })
})
