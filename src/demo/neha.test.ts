// Persona 6, Neha (PRODUCT.md §10.1): SIP lots, ELSS lock-in, debt fund under the rebate. Real NAVs from the mfapi.in cache.
import { describe, expect, it } from 'vitest'
import { analyze, simulateSell } from '@/engine/analyze'
import { elssHeadline, mfChipText, mfHeadline, mfRedeemHeadline, MF_CHARGES_NOTE, MF_DEBT_NOTE, redemptionText } from '@/engine/copy'
import { mfStampDuty, mfUnits } from '@/engine/mf'
import { formatINR } from '@/engine/money'
import navCache from '@/sample/mf-navs.json'
import { personaById } from '@/sample/personas'
import { buildInput, initialState } from './scenario'

const s = initialState('neha')
const input = buildInput(s)
const r = analyze(input, s.settings)
const fund = (sym: string) => r.mf.funds.find((f) => f.symbol === sym)!
/** within ±₹1 */
const near = (paise: number, rupees: number) => expect(Math.abs(paise - rupees * 100)).toBeLessThanOrEqual(100)
const navs = navCache.funds as Record<string, { navs: Record<string, string> }>

describe('Neha: raw inputs', () => {
  it('uses the cached mfapi.in NAVs (no network in tests)', () => {
    expect(navs['PPFAS-FLEXI'].navs['2026-06-15']).toBe('90.04300')
    expect(navs['PPFAS-FLEXI'].navs['2026-09-18']).toBe('89.85690')
    expect(navs['MIRAE-ELSS'].navs['2026-09-18']).toBe('56.75300')
    expect(navs['HDFC-SHORT'].navs['2026-09-18']).toBe('35.41390')
  })
  it('30 + 36 SIP instalments (the story’s 66), 1 lump sum and 1 redemption; every lot follows R24', () => {
    const buys = personaById('neha').portfolio.trades.filter((t) => t.side === 'BUY')
    expect(buys.filter((t) => t.symbol === 'PPFAS-FLEXI')).toHaveLength(30)
    expect(buys.filter((t) => t.symbol === 'MIRAE-ELSS')).toHaveLength(36)
    expect(buys.filter((t) => t.symbol === 'HDFC-SHORT')).toHaveLength(1)
    for (const t of buys) {
      const day = t.time.slice(0, 10)
      expect(t.qty, t.id).toBe(mfUnits(t.amountPaise!, navs[t.symbol].navs[day]))
      expect(t.charges.stamp, t.id).toBe(mfStampDuty(t.amountPaise!))
    }
  })
  it('SIP instalments are allotted on the first NAV date on or after the SIP date', () => {
    const ppDays = personaById('neha').portfolio.trades.filter((t) => t.symbol === 'PPFAS-FLEXI' && t.side === 'BUY').map((t) => t.time.slice(0, 10))
    expect(ppDays[0]).toBe('2024-04-05')
    expect(ppDays).toContain('2025-10-06') // 5 Oct 2025 is a Sunday
  })
})

describe('Neha: expected figures (PRODUCT.md §10.1)', () => {
  it('redemption on 15 Jun 2026: 12 oldest lots, all long-term, gain ₹4,385, tax ₹0; limit ₹4,385 used, ₹1,20,615 left', () => {
    expect(r.mf.redemptions).toHaveLength(1)
    const red = r.mf.redemptions[0]
    expect(red).toMatchObject({ day: '2026-06-15', units: 666.348, lots: 12, longTermLots: 12, shortTermLots: 0, tax: 0 })
    near(red.gain, 4_385)
    near(r.limit.used, 4_385)
    near(r.limit.left, 1_20_615)
    expect(redemptionText(red)).toBe('Your 15 Jun 2026 redemption used your 12 oldest instalments (all long-term): gain ₹4,385, tax ₹0')
  })
  it('Parag Parikh: 1,040.062 units = ₹93,456.75 (cost ₹94,385.43); LT 388.126 = ₹34,875.80 (+₹490); ST 651.936 = ₹58,580.95 (−₹1,419, 12 lots)', () => {
    const f = fund('PPFAS-FLEXI')
    expect(f.units).toBeCloseTo(1040.062, 3)
    near(f.value, 93_456.75)
    near(f.cost, 94_385.43)
    expect(f.longTerm.units).toBeCloseTo(388.126, 3)
    near(f.longTerm.value, 34_875.8)
    near(f.longTerm.gain, 490)
    expect(f.shortTerm.units).toBeCloseTo(651.936, 3)
    near(f.shortTerm.value, 58_580.95)
    near(f.shortTerm.gain, -1_419)
    expect(f.shortTerm.lots).toBe(12)
  })
  it('Parag Parikh: next ₹4,830 turns long-term on 7 Oct 2026 (19 days)', () => {
    const n = fund('PPFAS-FLEXI').nextLongTerm!
    expect([n.date, n.days]).toEqual(['2026-10-07', 19])
    near(n.value, 4_830)
    expect(mfChipText({ kind: 'NEXT_LONG_TERM', date: n.date, days: n.days, value: n.value })).toBe('Next ₹4,830 long-term from 7 Oct (19 days)')
  })
  it('Mirae ELSS: 2,099.284 units = ₹1,19,140.66 (cost ₹1,08,000, gain ₹11,141); long-term ₹82,925 but all locked; first unlock 11 Oct (23 days) ₹4,267', () => {
    const f = fund('MIRAE-ELSS')
    expect(f.units).toBeCloseTo(2099.284, 3)
    near(f.value, 1_19_140.66)
    expect(f.cost).toBe(1_08_000_00)
    near(f.gain, 11_141)
    near(f.longTerm.value, 82_925)
    expect(f.elss!.unlocked.lots).toBe(0)
    near(f.elss!.locked.value, 1_19_140.66)
    expect([f.elss!.nextUnlock!.date, f.elss!.nextUnlock!.days]).toEqual(['2026-10-11', 23])
    near(f.elss!.nextUnlock!.value, 4_267)
    expect(f.withdrawFree.value).toBe(0)
    expect(elssHeadline(f)).toBe('₹1,19,141 locked; the first ₹4,267 unlocks 11 Oct')
    expect(mfChipText(f.chips[0])).toBe('Locked · first ₹4,267 unlocks 11 Oct')
    expect(f.elss!.schedule).toHaveLength(36)
  })
  it('HDFC Short Term: 3,315.714 units = ₹1,17,422.36, gain ₹17,422, slab-rate, ₹0 tax today (rebate: total income ₹10,46,807 ≤ ₹12L)', () => {
    const f = fund('HDFC-SHORT')
    expect(f.units).toBeCloseTo(3315.714, 3)
    near(f.value, 1_17_422.36)
    near(f.gain, 17_422)
    expect(f.slab).toBe(true)
    expect(f.taxIfRedeemAll).toBe(0)
    expect(f.chips.map(mfChipText)).toContain(MF_DEBT_NOTE)
    expect(MF_DEBT_NOTE).toBe("Slab-rate whenever you redeem; holding longer doesn't change that")
    // Selling it today: total income = ₹10,25,000 + ₹4,385 + ₹17,422 ≈ ₹10,46,807, inside the rebate.
    const sim = simulateSell(input, s.settings, { symbol: 'HDFC-SHORT', qty: 3315.714, day: '2026-09-18' })
    expect(sim.taxOnDay).toBe(0)
  })
  it('M2 headline: ₹2,10,879 can be withdrawn today at ₹0 tax; ₹1,19,141 locked in ELSS', () => {
    near(r.mf.withdrawFree, 2_10_879)
    expect(mfHeadline(r.mf)).toBe(
      '₹2,10,879 can be withdrawn today at ₹0 tax (Parag Parikh + HDFC Short Term). ₹1,19,141 is locked in ELSS; the first ₹4,267 unlocks 11 Oct.',
    )
    expect(mfRedeemHeadline(fund('PPFAS-FLEXI'))).toBe('Redeem up to ₹93,457 / 1,040.062 units today with ₹0 tax')
  })
  it('charges: stamp duty only (≈₹2 this FY), no brokerage', () => {
    expect(r.mf.charges).toMatchObject({ stamp: 240, brokerage: 0 })
    expect(formatINR(r.summary.charges)).toBe('₹2')
    expect(MF_CHARGES_NOTE).toBe('No brokerage on Upstox mutual funds: stamp duty only (0.005% of each purchase).')
    expect(r.charges.smallOrders.totalOrders).toBe(0) // MF orders stay out of cost-by-order-size
  })
  it('filing: ITR-1 eligible; no Section 156 warning (no tax on stock gains); no warnings', () => {
    expect(r.filing.itr).toBe('ITR-1')
    expect(r.summary.tax).toBe(0)
    expect(r.section156.show).toBe(false)
    expect(r.warnings).toEqual([])
    expect(input.holdings).toEqual(personaById('neha').portfolio.holdings)
  })
})

describe('Neha: ELSS lock-in in the engine (R25)', () => {
  it('locked lots are excluded from tax-if-sold-today and harvesting, and can’t be redeemed', () => {
    const h = r.holdings.find((x) => x.symbol === 'MIRAE-ELSS')!
    expect(h.lots.every((l) => l.locked)).toBe(true)
    expect(h.taxIfSoldToday).toBe(0)
    expect(r.strategies.gainHarvest.byHolding.map((b) => b.symbol)).not.toContain('MIRAE-ELSS')
    expect(() => simulateSell(input, s.settings, { symbol: 'MIRAE-ELSS', qty: 10, day: '2026-09-18' })).toThrow('10 of these units are locked in ELSS until 11 Oct 2026 (3-year lock-in).')
  })
  it('on 11 Oct 2026 the first instalment unlocks', () => {
    const later = analyze(buildInput({ ...s, today: '2026-10-11' }), s.settings)
    const f = later.mf.funds.find((x) => x.symbol === 'MIRAE-ELSS')!
    expect(f.elss!.unlocked.lots).toBe(1)
    expect(f.chips[0].kind).toBe('UNLOCKED')
  })
})
