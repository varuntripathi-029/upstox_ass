// Personas, the scenario layer (edits + today's date) and the sell simulator.
import { describe, expect, it } from 'vitest'
import { analyze, simulateSell } from '@/engine/analyze'
import { chipText } from '@/engine/copy'
import { formatINR } from '@/engine/money'
import { PERSONAS, personaById } from '@/sample/personas'
import { buildInput, editorTrade, heldOn, initialState, todayRange, type DemoState } from './scenario'

const run = (s: DemoState) => analyze(buildInput(s), s.settings)
const persona = (id: Parameters<typeof initialState>[0]) => run(initialState(id))

describe('personas', () => {
  it('every persona rebuilds exactly its own holdings snapshot, with no engine warnings', () => {
    for (const p of PERSONAS) {
      const s = initialState(p.id)
      expect(buildInput(s).holdings).toEqual(p.portfolio.holdings)
      expect(run(s).warnings).toEqual([])
    }
  })

  it('Priya (default) keeps every §10 figure', () => {
    const r = persona('priya')
    expect([r.summary.grossGains, r.summary.tax, r.summary.charges, r.summary.keep]).toEqual([42_620_00, 3_078_00, 3_420_00, 36_122_00])
    expect(r.limit.left).toBe(1_02_500_00)
    expect(r.charges.smallOrders).toMatchObject({ count: 62, totalOrders: 88 })
    expect(chipText(r.holdings.find((h) => h.symbol === 'INFY')!.chip!)).toContain('23 days to long-term')
  })

  it('Arjun (§10.1): ₹60,000 short-term absorbed by the unused basic exemption → ₹0 tax, ₹3,40,000 of exemption left', () => {
    const r = persona('arjun')
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBe(60_000_00)
    expect(r.buckets.filter((b) => b.active).map((b) => b.id)).toEqual(['EQ_ST'])
    expect(r.summary).toMatchObject({ grossGains: 61_200_00, tax: 0, charges: 1_200_00, keep: 60_000_00 })
    expect([r.summary.chargesPctOfGross.toFixed(1), r.summary.keepPct.toFixed(1)]).toEqual(['2.0', '98.0'])
    expect(r.section156.show).toBe(false)
    expect(r.section156.unusedBasicExemption).toMatchObject({ show: true, absorbed: 60_000_00, left: 3_40_000_00, taxSaved: 12_480_00 })
    const tp = r.holdings.find((h) => h.symbol === 'TATAPOWER')!
    expect(tp).toMatchObject({ unrealized: 8_000_00, taxIfSoldToday: 0 })
    expect(tp.lots[0]).toMatchObject({ daysHeld: 350, daysLeft: 16, longTermFrom: '2026-10-04' })
    expect(tp.chip).toEqual({ kind: 'NO_TAX', date: '2026-10-04' })
    expect(chipText(tp.chip!)).toBe('Long-term from 4 Oct · no tax either way')
    expect(r.strategies.waitForLongTerm).toEqual([])
    expect(r.filing).toMatchObject({ itr: 'ITR-2', advanceTax: { applies: false } })
  })

  it('Meera (§10.1): ₹1,10,000 long-term booked, ₹15,000 left, harvest 6 ASIANPAINT = ₹14,400 → ₹1,872; everything today ₹40,300', () => {
    const r = persona('meera')
    expect(r.buckets.filter((b) => b.active).map((b) => [b.id, b.taxable])).toEqual([['EQ_LT', 1_10_000_00]])
    expect(r.limit.left).toBe(15_000_00)
    expect(r.summary).toMatchObject({ grossGains: 1_10_900_00, tax: 0, charges: 900_00, keep: 1_10_000_00 })
    expect([r.summary.chargesPctOfGross.toFixed(1), r.summary.keepPct.toFixed(1)]).toEqual(['0.8', '99.2'])
    expect(r.holdings.map((h) => [h.symbol, h.unrealized, h.unrealizedLongTerm])).toEqual([
      ['ASIANPAINT', 2_40_000_00, 2_40_000_00],
      ['NIFTYBEES', 85_000_00, 85_000_00],
    ])
    expect(r.strategies.gainHarvest).toMatchObject({ show: true, bookable: 14_400_00, taxSaved: 1_872_00 })
    expect(r.strategies.gainHarvest.byHolding).toMatchObject([{ symbol: 'ASIANPAINT', qty: 6, bookable: 14_400_00 }])
    expect(r.bookTaxFree.total).toBe(14_400_00)
    expect(r.totalTaxIfSoldToday).toBe(40_300_00)
    expect(r.charges.smallOrders.totalOrders).toBe(12)
    expect(r.filing).toMatchObject({ itr: 'ITR-1', advanceTax: { applies: false } })
  })

  it('Rohit (§10.1): 200 orders, 190 under ₹2k; ₹9,500 short-term → ₹1,976; charges ₹5,200 = 35.4%, 2.6× his tax', () => {
    const r = persona('rohit')
    expect(r.charges.smallOrders).toMatchObject({ count: 190, totalOrders: 200 })
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBe(9_500_00)
    expect(r.summary).toMatchObject({ grossGains: 14_700_00, tax: 1_976_00, charges: 5_200_00, keep: 7_524_00 })
    expect([r.summary.chargesPctOfGross.toFixed(1), r.summary.keepPct.toFixed(1)]).toEqual(['35.4', '51.2'])
    expect((r.summary.charges / r.summary.tax).toFixed(1)).toBe('2.6')
    expect(r.section156).toMatchObject({ show: true, totalIncome: 5_34_500_00 })
    expect(r.filing).toMatchObject({ itr: 'ITR-2', advanceTax: { applies: false } })
    expect(personaById('rohit').openPanel).toBe('charges')
  })

  it('Kabir (§10.1): intraday ₹80,000 + F&O ₹1,50,000 on ₹14L consulting → ₹37,440 marginal tax; ITR-3; advance tax on ₹1,31,040', () => {
    const r = persona('kabir')
    expect(r.trading.intraday.net).toBe(80_000_00)
    expect(r.trading.fno.net).toBe(1_50_000_00)
    expect(r.trading.fno.turnover).toBeGreaterThan(0)
    expect(r.summary.tax).toBe(37_440_00)
    expect(r.section156.totalIncome).toBe(16_30_000_00)
    expect([formatINR(r.summary.charges), formatINR(r.summary.grossGains), formatINR(r.summary.keep)]).toEqual(['₹48,000', '₹2,78,000', '₹1,92,560'])
    expect([r.summary.chargesPctOfGross.toFixed(1), r.summary.keepPct.toFixed(1)]).toEqual(['17.3', '69.3'])
    expect(r.filing).toMatchObject({ itr: 'ITR-3', deadline: '2027-08-31' })
    expect(r.filing.advanceTax).toMatchObject({
      applies: true,
      basis: 'total',
      total: 1_31_040_00,
      past: [
        { date: '2026-06-15', cumulativePct: 15, amount: 19_656_00 },
        { date: '2026-09-15', cumulativePct: 45, amount: 58_968_00 },
      ],
      next: { date: '2026-12-15', cumulativePct: 75, amount: 98_280_00 },
    })
    expect(r.holdings).toEqual([])
    // Losing trades are business income, not a capital-loss set-off (B2); F&O orders stay out of D4/D5.
    expect(r.lossSetOff).toBeNull()
    expect(r.charges.smallOrders.totalOrders).toBe(40)
  })
})

describe("today's date control", () => {
  const at = (today: string) => run({ ...initialState('priya'), today })
  it('chips count down as the date moves', () => {
    expect(at('2026-10-01').holdings.find((h) => h.symbol === 'INFY')!.chip).toMatchObject({ kind: 'WAIT', days: 10 })
  })
  it('INFY is still short-term on its anniversary (10 Oct) and flips to long-term on 11 Oct', () => {
    expect(at('2026-10-10').holdings.find((h) => h.symbol === 'INFY')!.chip).toMatchObject({ kind: 'WAIT', days: 1 })
    const infy = at('2026-10-11').holdings.find((h) => h.symbol === 'INFY')!
    expect(infy.lots[0].longTerm).toBe(true)
    expect(infy.chip).toMatchObject({ kind: 'TAX_FREE', amount: 9_000_00 })
    expect(infy.taxIfSoldToday).toBe(0)
  })
  it('allows dates from the snapshot to the end of the financial year', () => {
    expect(todayRange(personaById('priya'))).toEqual({ min: '2026-09-18', max: '2027-03-31' })
  })
})

describe('trade editor', () => {
  it('an added buy becomes a new lot and a holding', () => {
    const s = initialState('priya')
    const added = editorTrade({ symbol: 'ITC', day: '2026-09-18', side: 'BUY', qty: 50, pricePaise: 40_000 })
    const input = buildInput({ ...s, edits: { added: [added], removedIds: [] } })
    expect(input.holdings.find((h) => h.symbol === 'ITC')!.qty).toBe(300)
    const r = analyze(input, s.settings)
    expect(r.holdings.find((h) => h.symbol === 'ITC')!.lots).toHaveLength(2)
  })
  it('an added sell of INFY today books short-term tax (₹1,872 on 60 shares)', () => {
    const s = initialState('priya')
    const sell = editorTrade({ symbol: 'INFY', day: '2026-09-18', side: 'SELL', qty: 60, pricePaise: 1_649_68 })
    const r = run({ ...s, edits: { added: [sell], removedIds: [] } })
    expect(r.holdings.find((h) => h.symbol === 'INFY')).toBeUndefined()
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBeGreaterThan(14_800_00)
  })
  it('removing a persona trade takes it out of the engine input', () => {
    const s = initialState('priya')
    const first = personaById('priya').portfolio.trades[0]
    expect(buildInput({ ...s, edits: { added: [], removedIds: [first.id] } }).trades.find((t) => t.id === first.id)).toBeUndefined()
  })
  it('knows how many units are held on a day (to validate sells)', () => {
    const input = buildInput(initialState('priya'))
    expect(heldOn(input, 'INFY', '2026-09-18')).toBe(60)
    expect(heldOn(input, 'INFY', '2025-10-01')).toBe(0)
  })
})

describe('simulate a sell', () => {
  const s = initialState('priya')
  const input = buildInput(s)
  it('INFY: all 60 today → ₹1,872; on or after 11 Oct → ₹0; saves ₹1,872', () => {
    expect(simulateSell(input, s.settings, { symbol: 'INFY', qty: 60, day: '2026-09-18' })).toMatchObject({
      gain: 9_000_00,
      taxOnDay: 1_872_00,
      waitUntil: '2026-10-11',
      taxOnWaitDay: 0,
      saving: 1_872_00,
    })
  })
  it('INFY: 30 shares on 10 Oct (the anniversary) are still short-term → ₹936', () => {
    expect(simulateSell(input, s.settings, { symbol: 'INFY', qty: 30, day: '2026-10-10' })).toMatchObject({ gain: 4_500_00, taxOnDay: 936_00, waitUntil: '2026-10-11' })
  })
  it('HDFCBANK is already long-term: nothing to wait for', () => {
    expect(simulateSell(input, s.settings, { symbol: 'HDFCBANK', qty: 40, day: '2026-09-18' })).toMatchObject({ taxOnDay: 0, waitUntil: null, saving: 0 })
  })
  it('ITC at a loss: selling cuts this year’s tax by ₹229', () => {
    expect(simulateSell(input, s.settings, { symbol: 'ITC', qty: 250, day: '2026-09-18' }).taxOnDay).toBe(-229_00)
  })
  it('a sale in the next financial year starts from a fresh year', () => {
    // NIFTYBEES turns long-term on 14 Mar 2027 (same year); sold on 1 Apr 2027 it is long-term in a fresh year.
    expect(simulateSell(input, s.settings, { symbol: 'NIFTYBEES', qty: 90, day: '2027-04-01' })).toMatchObject({ taxOnDay: 0, waitUntil: null })
  })
  it('refuses to sell more than is held', () => {
    expect(() => simulateSell(input, s.settings, { symbol: 'INFY', qty: 61, day: '2026-09-18' })).toThrow()
  })
})
