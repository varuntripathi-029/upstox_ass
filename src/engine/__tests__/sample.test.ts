// The §10 persona: every figure is computed by the engine from the raw sample trades.
import { describe, expect, it } from 'vitest'
import { analyze } from '../analyze'
import { formatINR } from '../money'
import { samplePortfolio, sampleSettings } from '../../sample/portfolio'

const r = analyze(samplePortfolio, sampleSettings)
const holding = (s: string) => r.holdings.find((h) => h.symbol === s)!
const bucket = (id: string) => r.buckets.find((b) => b.id === id)!

describe('§10 summary strip', () => {
  it('A1 gross gains ₹42,620', () => expect(formatINR(r.summary.grossGains)).toBe('₹42,620'))
  it('A2 estimated tax ₹3,078', () => expect(formatINR(r.summary.tax)).toBe('₹3,078'))
  it('A3 charges ₹3,420 (8.0% of gross)', () => {
    expect(r.summary.charges).toBe(3_420_00)
    expect(r.summary.chargesPctOfGross.toFixed(1)).toBe('8.0')
  })
  it('A4 you keep ₹36,122 (84.8%)', () => {
    expect(r.summary.keep).toBe(36_122_00)
    expect(r.summary.keepPct.toFixed(1)).toBe('84.8')
  })
  it('A1 = ₹39,200 taxable + ₹3,420 charges, and A4 = A1 − A2 − A3', () => {
    expect(r.summary.grossGains - r.summary.charges).toBe(39_200_00)
    expect(r.summary.keep).toBe(r.summary.grossGains - r.summary.tax - r.summary.charges)
  })
})

describe('§10 realized buckets', () => {
  it('stocks short-term: ₹14,800 after losses, tax ₹3,078', () => {
    expect(bucket('EQ_ST')).toMatchObject({ gains: 21_000_00, lossesSetOff: 6_200_00, taxable: 14_800_00, tax: 3_078_00 })
  })
  it('stocks long-term: ₹22,500, tax ₹0', () => expect(bucket('EQ_LT')).toMatchObject({ taxable: 22_500_00, tax: 0 }))
  it('intraday: ₹1,900, tax ₹0 (covered by the Section 156 rebate)', () => {
    expect(bucket('INTRADAY')).toMatchObject({ taxable: 1_900_00, tax: 0 })
    expect(r.trading.intraday.net).toBe(1_900_00)
  })
  it('F&O: nothing', () => expect(bucket('FNO').active).toBe(false))
  it('total income ≈ ₹8.64L, within the ₹12L rebate', () => {
    expect(r.section156.totalIncome).toBe(8_64_200_00)
    expect(r.section156.rebateEligible).toBe(true)
  })
  it('B1: ₹1,02,500 of the tax-free limit left', () => {
    expect(formatINR(r.limit.left)).toBe('₹1,02,500')
    expect(r.limit.resetsOn).toBe('2027-04-01')
  })
  it('B2: ₹6,200 of short-term losses cut tax by ₹1,290', () => {
    expect(r.lossSetOff).toEqual({ losses: 6_200_00, taxSaved: 1_290_00 })
  })
  it('B3: Section 156 warning is shown, for ₹3,078 of stock tax (no R10 note)', () => {
    expect(r.section156.show).toBe(true)
    expect(r.section156.stockTax).toBe(3_078_00)
    expect(r.section156.unusedBasicExemption.show).toBe(false)
    expect(r.strategies.section156.show).toBe(true)
  })
  it('B4: nothing to carry forward', () => expect(r.carryForward).toEqual([]))
})

describe('§10 holdings', () => {
  it('INFY: 60 shares, +₹9,000, tax today ₹1,872, 23 days to long-term (from 11 Oct), wait and save ₹1,872', () => {
    const h = holding('INFY')
    expect(h).toMatchObject({ qty: 60, unrealized: 9_000_00, taxIfSoldToday: 1_872_00 })
    expect(h.lots[0]).toMatchObject({ daysLeft: 23, longTermFrom: '2026-10-11', daysHeld: 343 })
    expect(h.chip).toEqual({ kind: 'WAIT', days: 23, date: '2026-10-11', saving: 1_872_00 })
  })
  it('ITC: 250 shares, −₹1,100, 64 days left, loss chip cuts tax by ₹229', () => {
    const h = holding('ITC')
    expect(h).toMatchObject({ qty: 250, unrealized: -1_100_00, taxIfSoldToday: -229_00 })
    expect(h.lots[0].daysLeft).toBe(64)
    expect(h.chip).toEqual({ kind: 'LOSS', loss: 1_100_00, taxCut: 229_00 })
  })
  it('TATAMOTORS: 45 shares, +₹4,200, 110 days left, save ₹874', () => {
    const h = holding('TATAMOTORS')
    expect(h).toMatchObject({ qty: 45, unrealized: 4_200_00, taxIfSoldToday: 874_00 })
    expect(h.chip).toMatchObject({ kind: 'WAIT', days: 110, date: '2027-01-06', saving: 874_00 })
  })
  it('NIFTYBEES: 90 units, +₹2,600, 177 days left, save ₹541', () => {
    const h = holding('NIFTYBEES')
    expect(h).toMatchObject({ qty: 90, unrealized: 2_600_00, taxIfSoldToday: 541_00 })
    expect(h.chip).toMatchObject({ kind: 'WAIT', days: 177, saving: 541_00 })
  })
  it('HDFCBANK: 40 shares, 410 days held, long-term, +₹31,400 with ₹0 tax, bookable tax-free', () => {
    const h = holding('HDFCBANK')
    expect(h).toMatchObject({ qty: 40, unrealized: 31_400_00, unrealizedLongTerm: 31_400_00, taxIfSoldToday: 0 })
    expect(h.lots[0]).toMatchObject({ daysHeld: 410, longTerm: true, daysLeft: 0 })
    expect(h.chip).toEqual({ kind: 'TAX_FREE', amount: 31_400_00 })
  })
  it('C3 timeline: soonest first, long-term last', () => {
    expect(r.timeline.map((l) => l.symbol)).toEqual(['INFY', 'ITC', 'TATAMOTORS', 'NIFTYBEES', 'HDFCBANK'])
  })
  it('C5: ₹31,400 can be booked tax-free', () => expect(r.bookTaxFree.total).toBe(31_400_00))
  it('C6: ITC loss can cut this year’s tax by ₹229', () => {
    expect(r.lossesToUse).toEqual({ show: true, losses: 1_100_00, taxCut: 229_00, symbols: ['ITC'] })
  })
  it('the holdings match the broker snapshot (no approximations)', () => expect(r.warnings).toEqual([]))
})

describe('§10 strategies', () => {
  it('HDFCBANK gain harvest saves ₹4,082 of future tax (₹31,400 × 12.5% × 1.04)', () => {
    expect(r.strategies.gainHarvest).toMatchObject({ show: true, bookable: 31_400_00, taxSaved: 4_082_00 })
    expect(r.strategies.gainHarvest.byHolding[0]).toMatchObject({ symbol: 'HDFCBANK', qty: 40 })
    expect(r.strategies.gainHarvest.netSaving).toBe(4_082_00 - r.strategies.gainHarvest.estimatedCost)
  })
  it('wait-for-long-term panels for INFY, TATAMOTORS, NIFTYBEES', () => {
    expect(r.strategies.waitForLongTerm.map((w) => [w.symbol, w.days, w.saving, w.taxOnDate])).toEqual([
      ['INFY', 23, 1_872_00, 0],
      ['TATAMOTORS', 110, 874_00, 0],
      ['NIFTYBEES', 177, 541_00, 0],
    ])
  })
  it('loss harvest: use ₹1,100 of losses to cut tax by ₹229', () => {
    expect(r.strategies.lossHarvest).toEqual({ show: true, losses: 1_100_00, taxCut: 229_00, symbols: ['ITC'] })
  })
  it('charges saving is capped at brokerage + DP actually paid', () => {
    const c = r.strategies.charges
    expect(c.perYear).toBeGreaterThan(0)
    expect(Math.min(c.smallOrderExcess, c.cap)).toBeLessThanOrEqual(c.cap)
  })
})

describe('§10 charges', () => {
  it('monthly: Apr ₹420 · May ₹760 · Jun ₹540 · Jul ₹910 · Aug ₹480 · Sep ₹310', () => {
    expect(r.charges.byMonth.map((m) => [m.month, m.total / 100])).toEqual([
      ['2026-04', 420],
      ['2026-05', 760],
      ['2026-06', 540],
      ['2026-07', 910],
      ['2026-08', 480],
      ['2026-09', 310],
    ])
  })
  it('62 of 88 orders under ₹2,000', () => {
    expect(r.charges.smallOrders).toMatchObject({ count: 62, totalOrders: 88 })
  })
  it('cost by order size: 1.9% · 0.65% · 0.3%', () => {
    const [small, mid, large] = r.charges.orderSize
    expect(small.pctOfValue.toFixed(1)).toBe('1.9')
    expect(mid.pctOfValue.toFixed(2)).toBe('0.65')
    expect(large.pctOfValue.toFixed(1)).toBe('0.3')
  })
  it('D1 and D6 add up to A3', () => {
    expect(Object.values(r.charges.byType).reduce((a, b) => a + b, 0)).toBe(3_420_00)
    expect(r.charges.split.delivery + r.charges.split.intraday + r.charges.split.fno).toBe(3_420_00)
  })
})

describe('§10 filing', () => {
  it('ITR-3 (intraday present), due 31 Aug 2027', () => {
    expect(r.filing).toMatchObject({ itr: 'ITR-3', deadline: '2027-08-31' })
  })
  it('no advance tax (≤ ₹10,000)', () => {
    expect(r.filing.advanceTax.applies).toBe(false)
    expect(r.strategies.advanceTax.show).toBe(false)
  })
})

describe('settings recalculate everything', () => {
  it('₹1,10,000 booked elsewhere uses up the limit: HDFCBANK is no longer tax-free', () => {
    const r2 = analyze(samplePortfolio, { ...sampleSettings, otherBrokerLtcgPaise: 1_10_000_00 })
    expect(r2.limit.left).toBe(0)
    expect(r2.summary.tax).toBe(3_078_00 + 975_00) // ₹7,500 over the limit × 13%
    expect(r2.bookTaxFree.total).toBe(0)
  })
})
