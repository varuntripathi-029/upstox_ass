// One or more worked examples per tax rule R1–R23 (PRODUCT.md §9, TECH.md §6).
import { describe, expect, it } from 'vitest'
import { analyze, simulateSell } from '../analyze'
import { isLongTerm, longTermFrom } from '../dates'
import { buildLedger } from '../ledger'
import { applyBps } from '../money'
import { elssUnlockFrom, mfStampDuty, mfUnits } from '../mf'
import * as R from '../rules'
import { computeTax, otherTaxableIncome, slabTax } from '../tax'
import { portfolio, rs, salaried, trade, NO_CHARGES } from './helpers'

const SALARY_9L = salaried(9_00_000)
const SALARY_15_75L = salaried(15_75_000) // ₹15,00,000 after the standard deduction

/** A2 (tax caused by the portfolio) for a set of trades */
const taxFor = (trades: Parameters<typeof portfolio>[0], settings = SALARY_9L) => analyze(portfolio(trades), settings).summary.tax

describe('R1: short-term equity 20%', () => {
  it('₹9,000 short-term gain → ₹1,872 (20% + 4% cess)', () => {
    const tax = taxFor({ trades: [trade('X', '2026-05-04', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 190)] })
    expect(tax).toBe(rs(1_872))
  })
  it('held exactly 12 months is still short-term; the next day is long-term', () => {
    expect(isLongTerm('2025-06-02', '2026-06-02', 12)).toBe(false)
    expect(isLongTerm('2025-06-02', '2026-06-03', 12)).toBe(true)
    const l = buildLedger(portfolio({ trades: [trade('X', '2025-06-02', 'BUY', 1, 100), trade('X', '2026-06-02', 'SELL', 1, 150)] }))
    expect(l.realized[0].bucket).toBe('EQ_ST')
  })
  it('leap day: bought 29 Feb 2024 turns long-term on 1 Mar 2025', () => {
    expect(longTermFrom('2024-02-29', 12)).toBe('2025-03-01')
  })
})

describe('R2: long-term equity 12.5% above ₹1.25L', () => {
  const lt = (sell: number) => [trade('X', '2025-01-06', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, sell)]
  it('₹22,500 long-term gain → ₹0 tax, ₹1,02,500 of the limit left', () => {
    const r = analyze(portfolio({ trades: lt(325) }), SALARY_9L)
    expect(r.summary.tax).toBe(0)
    expect(r.limit.left).toBe(rs(1_02_500))
  })
  it('₹1,50,000 long-term gain → 12.5% × 1.04 on ₹25,000 = ₹3,250', () => {
    const tax = taxFor({ trades: [trade('X', '2025-01-06', 'BUY', 1000, 100), trade('X', '2026-06-01', 'SELL', 1000, 250)] })
    expect(tax).toBe(rs(3_250))
  })
  it('the limit is shared across brokers: ₹1,10,000 elsewhere + ₹22,500 here → ₹975', () => {
    const r = analyze(portfolio({ trades: lt(325) }), salaried(9_00_000, { otherBrokerLtcgPaise: rs(1_10_000) }))
    expect(r.summary.tax).toBe(rs(975))
    expect(r.limit.left).toBe(0)
  })
})

describe('R3: 4% cess', () => {
  it('20% becomes 20.8% and 12.5% becomes 13%', () => {
    const t = computeTax({ normal: rs(15_00_000), stcg: rs(1_00_000), ltcgEquity: rs(2_25_000), ltcgOther: 0 })
    expect(t.stcg.total).toBe(rs(20_800))
    expect(t.ltcgEquity.total).toBe(rs(13_000))
  })
})

describe('R4: surcharge on gains capped at 15%', () => {
  it('income above ₹2 Cr: 25% on slab income, but only 15% on short-term gains', () => {
    const t = computeTax({ normal: rs(3_00_00_000), stcg: rs(10_00_000), ltcgEquity: 0, ltcgOther: 0 })
    expect(t.stcg.base).toBe(rs(2_00_000))
    expect(t.stcg.surcharge).toBe(rs(30_000))
    expect(t.stcg.cess).toBe(rs(9_200))
    expect(t.normal.surcharge).toBe(applyBps(t.normal.base, 2500))
  })
  it('no surcharge up to ₹50L', () => {
    const t = computeTax({ normal: rs(40_00_000), stcg: rs(5_00_000), ltcgEquity: 0, ltcgOther: 0 })
    expect(t.stcg.surcharge + t.normal.surcharge).toBe(0)
  })
})

describe('R5: debt MF bought on/after 1 Apr 2023 → slab, whatever the holding period', () => {
  it('held 2+ years, ₹50,000 gain at the 15% slab → ₹7,800', () => {
    const p = { trades: [trade('DEBT', '2024-01-10', 'BUY', 1000, 50, { segment: 'MF' }), trade('DEBT', '2026-06-01', 'SELL', 1000, 100, { segment: 'MF' })], instruments: { DEBT: 'DEBT_MF' as const } }
    const r = analyze(portfolio(p), SALARY_15_75L)
    expect(r.buckets.find((b) => b.id === 'DEBT_MF')!.taxable).toBe(rs(50_000))
    expect(r.summary.tax).toBe(rs(7_800))
  })
  it('a debt MF bought before 1 Apr 2023 is not slab-only (long-term after 24 months)', () => {
    const l = buildLedger(portfolio({ trades: [trade('D', '2023-03-01', 'BUY', 10, 50, { segment: 'MF' }), trade('D', '2026-06-01', 'SELL', 10, 60, { segment: 'MF' })], instruments: { D: 'DEBT_MF' } }))
    expect(l.realized[0].bucket).toBe('NONEQ_LT')
  })
})

describe('R6: gold / international ETFs', () => {
  it('long-term after 12 months at 12.5% + cess with no ₹1.25L exemption: ₹50,000 → ₹6,500', () => {
    const p = { trades: [trade('GOLDBEES', '2025-04-07', 'BUY', 1000, 60), trade('GOLDBEES', '2026-06-01', 'SELL', 1000, 110)], instruments: { GOLDBEES: 'NON_EQUITY_ETF' as const } }
    const r = analyze(portfolio(p), SALARY_15_75L)
    expect(r.buckets.find((b) => b.id === 'NONEQ_LT')!.taxable).toBe(rs(50_000))
    expect(r.summary.tax).toBe(rs(6_500))
  })
  it('short-term at slab: ₹50,000 at the 15% slab → ₹7,800', () => {
    const p = { trades: [trade('GOLDBEES', '2026-01-05', 'BUY', 1000, 60), trade('GOLDBEES', '2026-06-01', 'SELL', 1000, 110)], instruments: { GOLDBEES: 'NON_EQUITY_ETF' as const } }
    expect(analyze(portfolio(p), SALARY_15_75L).summary.tax).toBe(rs(7_800))
  })
})

describe('R7: capital loss set-off and carry forward', () => {
  it('a short-term loss cancels a long-term gain: ₹1.5L LT − ₹10k ST loss → tax on ₹15,000 = ₹1,950', () => {
    const r = analyze(
      portfolio({
        trades: [
          trade('A', '2026-05-04', 'BUY', 100, 200),
          trade('A', '2026-06-01', 'SELL', 100, 100),
          trade('B', '2025-01-06', 'BUY', 1000, 100),
          trade('B', '2026-06-01', 'SELL', 1000, 250),
        ],
      }),
      SALARY_9L,
    )
    expect(r.buckets.find((b) => b.id === 'EQ_LT')!.lossesSetOff).toBe(rs(10_000))
    expect(r.summary.tax).toBe(rs(1_950))
  })
  it('a long-term loss does not cancel a short-term gain; it is carried forward 8 years', () => {
    const r = analyze(
      portfolio({
        trades: [
          trade('A', '2025-01-06', 'BUY', 100, 200),
          trade('A', '2026-06-01', 'SELL', 100, 100),
          trade('B', '2026-05-04', 'BUY', 200, 100),
          trade('B', '2026-06-01', 'SELL', 200, 200),
        ],
      }),
      SALARY_9L,
    )
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBe(rs(20_000))
    expect(r.summary.tax).toBe(rs(4_160))
    expect(r.carryForward).toEqual([{ label: 'Long-term capital loss', amount: rs(10_000), years: 8 }])
  })
  it('B2: ₹6,200 of short-term losses against short-term gains cut tax by ₹1,290', () => {
    const r = analyze(
      portfolio({
        trades: [
          trade('A', '2026-05-04', 'BUY', 100, 100),
          trade('A', '2026-06-01', 'SELL', 100, 310),
          trade('B', '2026-05-04', 'BUY', 100, 100),
          trade('B', '2026-06-01', 'SELL', 100, 38),
        ],
      }),
      SALARY_9L,
    )
    expect(r.lossSetOff).toEqual({ losses: rs(6_200), taxSaved: rs(1_290) })
  })
})

describe('R8: FIFO lots', () => {
  it('sells the oldest lot first: 10 long-term + 5 short-term units', () => {
    const l = buildLedger(
      portfolio({
        trades: [trade('X', '2025-01-06', 'BUY', 10, 100), trade('X', '2026-01-05', 'BUY', 10, 200), trade('X', '2026-06-01', 'SELL', 15, 250)],
        holdings: [{ symbol: 'X', qty: 5, avgPricePaise: rs(200), ltpPaise: rs(250) }],
      }),
    )
    expect(l.realized.map((s) => [s.qtyM / 1000, s.bucket, s.gain])).toEqual([
      [10, 'EQ_LT', rs(1_500)],
      [5, 'EQ_ST', rs(250)],
    ])
    expect(l.openLots).toMatchObject([{ acquired: '2026-01-05', qtyM: 5000, cost: rs(1_000) }])
  })
})

describe('R9 + R22: grandfathering for equity bought before 1 Feb 2018', () => {
  const sell = (fmv: number, adjusted = true, extra: Partial<Parameters<typeof portfolio>[0]> = {}) =>
    buildLedger(
      portfolio({
        trades: [trade('OLD', '2017-05-02', 'BUY', 100, 100), trade('OLD', '2026-06-01', 'SELL', 100, 200)],
        instruments: { OLD: { assetClass: 'STOCK', fmv31Jan2018: { pricePaise: rs(fmv), adjustedForLaterActions: adjusted } } },
        ...extra,
      }),
    ).realized[0]
  it('R9: gains up to 31 Jan 2018 are exempt: FMV ₹150 → only ₹50/share taxed', () => {
    expect(sell(150)).toMatchObject({ costForTax: rs(15_000), gain: rs(5_000), grandfathered: true, bucket: 'EQ_LT' })
  })
  it('R22: FMV is capped at the sale price (FMV ₹250, sold at ₹200 → cost ₹200, no loss)', () => {
    expect(sell(250)).toMatchObject({ costForTax: rs(20_000), gain: 0 })
  })
  it('R22: actual cost wins when it is higher than FMV', () => {
    expect(sell(80)).toMatchObject({ costForTax: rs(10_000), gain: rs(10_000), grandfathered: false })
  })
  it('R22: an unadjusted 2018 quote is divided by later splits', () => {
    const r = buildLedger(
      portfolio({
        trades: [trade('OLD', '2017-05-02', 'BUY', 20, 500), trade('OLD', '2026-06-01', 'SELL', 100, 200)],
        instruments: { OLD: { assetClass: 'STOCK', fmv31Jan2018: { pricePaise: rs(750), adjustedForLaterActions: false } } },
        corporateActions: [{ symbol: 'OLD', exDay: '2019-09-20', type: 'SPLIT', from: 1, to: 5 }],
      }),
    ).realized[0]
    expect(r).toMatchObject({ qtyM: 100_000, actualCost: rs(10_000), costForTax: rs(15_000), gain: rs(5_000) })
  })
})

describe('R10: unused basic exemption', () => {
  it('other income ₹2L absorbs ₹2L of a ₹3L short-term gain → tax on ₹1L = ₹20,800', () => {
    const r = analyze(
      portfolio({ trades: [trade('X', '2026-05-04', 'BUY', 1000, 100), trade('X', '2026-06-01', 'SELL', 1000, 400)] }),
      { regime: 'new', otherIncomePaise: rs(2_00_000), otherIncomeIsSalary: false, otherBrokerLtcgPaise: 0 },
    )
    expect(r.summary.tax).toBe(rs(20_800))
    expect(r.section156.unusedBasicExemption).toMatchObject({ show: true, absorbed: rs(2_00_000) })
  })
})

describe('R11: Section 156 rebate', () => {
  it('salary ₹9L + ₹1,900 intraday: slab tax fully covered, short-term equity tax still due', () => {
    const t = computeTax({ normal: rs(8_26_900), stcg: rs(14_800), ltcgEquity: rs(22_500), ltcgOther: 0 })
    expect(t.totalIncome).toBe(rs(8_64_200))
    expect(t.slabTax).toBe(rs(22_690))
    expect(t.rebate).toBe(rs(22_690))
    expect(t.normal.total).toBe(0)
    expect(t.stcg.total).toBe(rs(3_078.4))
  })
  it('no rebate above ₹12L total income, including when stock gains push it over', () => {
    expect(computeTax({ normal: rs(12_50_000), stcg: 0, ltcgEquity: 0, ltcgOther: 0 }).normal.total).toBe(rs(70_200))
    const t = computeTax({ normal: rs(11_00_000), stcg: rs(2_00_000), ltcgEquity: 0, ltcgOther: 0 })
    expect(t.rebateEligible).toBe(false)
    expect(t.normal.base).toBe(rs(50_000))
  })
})

describe('R12: buybacks', () => {
  const bb = (day: string) =>
    buildLedger(portfolio({ trades: [trade('X', '2024-01-08', 'BUY', 100, 100), trade('X', day, 'SELL', 100, 150, { kind: 'BUYBACK' })] }))
  it('from 1 Apr 2026: capital gains again', () => {
    const l = bb('2026-06-10')
    expect(l.realized[0]).toMatchObject({ gain: rs(5_000), bucket: 'EQ_LT' })
    expect(l.otherIncome).toEqual([])
  })
  it('1 Oct 2024 – 31 Mar 2026: proceeds are dividend, the cost is a capital loss', () => {
    const l = bb('2025-06-10')
    expect(l.otherIncome).toMatchObject([{ kind: 'BUYBACK_DIVIDEND', amount: rs(15_000) }])
    expect(l.realized[0]).toMatchObject({ gain: -rs(10_000), bucket: 'EQ_LT', buybackLoss: true })
  })
})

describe('R13: same-day sell + buy is intraday', () => {
  it('a same-day round trip is intraday, not a capital gain', () => {
    const l = buildLedger(portfolio({ trades: [trade('X', '2026-06-01', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 105)] }))
    expect(l.realized).toEqual([])
    expect(l.business).toMatchObject([{ kind: 'INTRADAY', grossPnl: rs(500) }])
  })
  it('only the matched quantity is intraday; the rest is delivery (FIFO)', () => {
    const l = buildLedger(
      portfolio({
        trades: [trade('X', '2026-01-05', 'BUY', 10, 100), trade('X', '2026-06-01', 'BUY', 5, 110), trade('X', '2026-06-01', 'SELL', 8, 120)],
        holdings: [{ symbol: 'X', qty: 7, avgPricePaise: rs(100), ltpPaise: rs(120) }],
      }),
    )
    expect(l.business).toMatchObject([{ kind: 'INTRADAY', qtyM: 5000, grossPnl: rs(50) }])
    expect(l.realized).toMatchObject([{ qtyM: 3000, gain: rs(60), bucket: 'EQ_ST' }])
    expect(l.openLots).toMatchObject([{ acquired: '2026-01-05', qtyM: 7000 }])
  })
  it('harvesting tells the user to buy back the next day, never the same day', () => {
    expect(R.R13_BUY_BACK_AFTER_DAYS).toBe(1)
  })
})

describe('R14: intraday losses', () => {
  it('an intraday loss does not reduce short-term gains; it carries forward 4 years', () => {
    const r = analyze(
      portfolio({
        trades: [
          trade('I', '2026-06-01', 'BUY', 100, 100),
          trade('I', '2026-06-01', 'SELL', 100, 50),
          trade('X', '2026-05-04', 'BUY', 100, 100),
          trade('X', '2026-06-01', 'SELL', 100, 300),
        ],
      }),
      SALARY_9L,
    )
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBe(rs(20_000))
    expect(r.carryForward).toEqual([{ label: 'Intraday (speculative) loss', amount: rs(5_000), years: 4 }])
  })
})

describe('R15: F&O losses', () => {
  const fut = (day: string, side: 'BUY' | 'SELL', price: number, at?: string) =>
    trade('NIFTYFUT', day, side, 75, price, { segment: 'FO', at })
  const fno = { NIFTYFUT: { assetClass: 'FNO' as const, derivative: 'FUT' as const } }
  it('an F&O loss cancels short-term gains (not salary)', () => {
    const r = analyze(
      portfolio({
        trades: [fut('2026-06-01', 'BUY', 100), fut('2026-06-05', 'SELL', 60), trade('X', '2026-05-04', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 300)],
        instruments: fno,
      }),
      SALARY_9L,
    )
    expect(r.buckets.find((b) => b.id === 'EQ_ST')!.taxable).toBe(rs(17_000))
    expect(r.carryForward).toEqual([])
  })
  it('an unused F&O loss carries forward 8 years; short positions are matched too', () => {
    const r = analyze(portfolio({ trades: [fut('2026-06-01', 'SELL', 100), fut('2026-06-05', 'BUY', 140)], instruments: fno }), SALARY_9L)
    expect(r.trading.fno.net).toBe(-rs(3_000))
    expect(r.carryForward).toEqual([{ label: 'F&O (non-speculative) loss', amount: rs(3_000), years: 8 }])
  })
})

describe('R16: STT on F&O from 1 Apr 2026', () => {
  it('futures 0.05%, options 0.15% (₹1L option premium sold → ₹150 STT)', () => {
    expect(applyBps(rs(1_00_000), R.R16_STT_FUTURES_BPS)).toBe(rs(50))
    expect(applyBps(rs(1_00_000), R.R16_STT_OPTIONS_BPS)).toBe(rs(150))
    expect(R.R16_STT_HIKE_FROM).toBe('2026-04-01')
  })
})

describe('R17: ICAI turnover = Σ |profit or loss| per trade', () => {
  it('+₹3,000 and −₹1,000 → turnover ₹4,000', () => {
    const f = (d: string, s: 'BUY' | 'SELL', p: number) => trade('OPT', d, s, 100, p, { segment: 'FO' })
    const r = analyze(
      portfolio({
        trades: [f('2026-06-01', 'BUY', 100), f('2026-06-02', 'SELL', 130), f('2026-06-03', 'BUY', 100), f('2026-06-04', 'SELL', 90)],
        instruments: { OPT: { assetClass: 'FNO', derivative: 'OPT' } },
      }),
      SALARY_9L,
    )
    expect(r.trading.fno.turnover).toBe(rs(4_000))
    expect(r.trading.fno.net).toBe(rs(2_000))
  })
})

describe('R18: new-regime slabs and standard deduction', () => {
  it('computes slab tax', () => {
    expect(slabTax(rs(4_00_000))).toBe(0)
    expect(slabTax(rs(8_26_900))).toBe(rs(22_690))
    expect(slabTax(rs(24_00_000))).toBe(rs(3_00_000))
    expect(slabTax(rs(30_00_000))).toBe(rs(4_80_000))
  })
  it('₹75,000 standard deduction for salaried', () => {
    expect(otherTaxableIncome(SALARY_9L)).toBe(rs(8_25_000))
    expect(otherTaxableIncome({ ...SALARY_9L, otherIncomeIsSalary: false })).toBe(rs(9_00_000))
  })
})

describe('R19 + R20: ITR form and deadline', () => {
  const itr = (trades: Parameters<typeof portfolio>[0]['trades'], settings = SALARY_9L) => analyze(portfolio({ trades }), settings).filing
  it('ITR-1 when the only gain is long-term equity within ₹1.25L; due 31 Jul', () => {
    expect(itr([trade('X', '2025-01-06', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 325)])).toMatchObject({ itr: 'ITR-1', deadline: '2027-07-31' })
  })
  it('ITR-2 for other capital gains, or long-term above ₹1.25L', () => {
    expect(itr([trade('X', '2026-05-04', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 110)]).itr).toBe('ITR-2')
    expect(itr([trade('X', '2025-01-06', 'BUY', 1000, 100), trade('X', '2026-06-01', 'SELL', 1000, 250)]).itr).toBe('ITR-2')
  })
  it('ITR-3 with any intraday or F&O; due 31 Aug', () => {
    expect(itr([trade('X', '2026-06-01', 'BUY', 1, 100), trade('X', '2026-06-01', 'SELL', 1, 101)])).toMatchObject({ itr: 'ITR-3', deadline: '2027-08-31' })
  })
})

describe('R21: advance tax', () => {
  it('tax > ₹10,000: next instalment after 18 Sep is 15 Dec (75%)', () => {
    const f = analyze(portfolio({ trades: [trade('X', '2026-05-04', 'BUY', 1000, 100), trade('X', '2026-06-01', 'SELL', 1000, 200)] }), SALARY_9L).filing
    expect(f.advanceTax).toMatchObject({ applies: true, total: rs(20_800), next: { date: '2026-12-15', cumulativePct: 75, amount: rs(15_600) } })
  })
  it('not applicable at ₹10,000 or less', () => {
    const f = analyze(portfolio({ trades: [trade('X', '2026-05-04', 'BUY', 100, 100), trade('X', '2026-06-01', 'SELL', 100, 190)] }), SALARY_9L).filing
    expect(f.advanceTax.applies).toBe(false)
    expect(f.advanceTax.next).toBeNull()
  })
})

describe('R23: cost basis', () => {
  it('buy-side stamp duty is added to cost; STT is not deductible', () => {
    const l = buildLedger(
      portfolio({
        trades: [
          trade('X', '2026-05-04', 'BUY', 100, 100, { charges: { ...NO_CHARGES, stamp: rs(1.5), stt: rs(10) } }),
          trade('X', '2026-06-01', 'SELL', 100, 110, { charges: { ...NO_CHARGES, stt: rs(11) } }),
        ],
      }),
    )
    expect(l.realized[0]).toMatchObject({ actualCost: rs(10_001.5), sellExpenses: 0, gain: rs(998.5) })
  })
})

describe('R24: stamp duty on MF purchases', () => {
  it('₹5,000 SIP at NAV 89.8569: stamp ₹0.25, units = 4,999.75 ÷ 89.8569 floored to 3 decimals = 55.641; cost = ₹5,000', () => {
    expect(mfStampDuty(rs(5_000))).toBe(25)
    expect(mfUnits(rs(5_000), '89.85690')).toBe(55.641)
    const l = buildLedger(
      portfolio({
        trades: [trade('F', '2026-09-18', 'BUY', 55.641, 89.8569, { segment: 'MF', amountPaise: rs(5_000), charges: { ...NO_CHARGES, stamp: 25 } })],
        instruments: { F: 'EQUITY_MF' },
        holdings: [{ symbol: 'F', qty: 55.641, avgPricePaise: 0, ltpPaise: 8985.69 }],
      }),
    )
    expect(l.openLots[0].cost).toBe(rs(5_000))
  })
  it('₹1,00,000 lump sum: ₹5 stamp duty', () => expect(mfStampDuty(rs(1_00_000))).toBe(rs(5)))
})

describe('R25: ELSS lock-in', () => {
  it('each lot unlocks the day after its 3rd anniversary (conservative)', () => {
    expect(elssUnlockFrom('2023-10-10')).toBe('2026-10-11')
    expect(elssUnlockFrom('2024-02-29')).toBe('2027-03-01')
  })
  it('a locked ELSS lot can’t be redeemed; after the unlock date it can', () => {
    const p = (asOf: string) =>
      portfolio({
        trades: [trade('E', '2023-10-10', 'BUY', 100, 30, { segment: 'MF' })],
        instruments: { E: { assetClass: 'EQUITY_MF', elss: true } },
        holdings: [{ symbol: 'E', qty: 100, avgPricePaise: rs(30), ltpPaise: rs(50) }],
        asOf: `${asOf}T18:00:00+05:30`,
      })
    expect(() => simulateSell(p('2026-10-10'), SALARY_9L, { symbol: 'E', qty: 100, day: '2026-10-10' })).toThrow(/locked/)
    expect(simulateSell(p('2026-10-11'), SALARY_9L, { symbol: 'E', qty: 100, day: '2026-10-11' }).gain).toBe(rs(2_000))
  })
})

describe('MF lots and debt funds', () => {
  it('each SIP instalment is its own lot with its own 12-month clock; redemptions are FIFO', () => {
    const buy = (d: string) => trade('F', d, 'BUY', 10, 100, { segment: 'MF' })
    const l = buildLedger(
      portfolio({
        trades: [buy('2025-05-05'), buy('2025-07-07'), buy('2025-08-05'), trade('F', '2026-06-15', 'SELL', 15, 120, { segment: 'MF' })],
        instruments: { F: 'EQUITY_MF' },
        holdings: [{ symbol: 'F', qty: 15, avgPricePaise: rs(100), ltpPaise: rs(120) }],
      }),
    )
    expect(l.realized.map((x) => [x.acquired, x.qtyM / 1000, x.bucket])).toEqual([
      ['2025-05-05', 10, 'EQ_LT'],
      ['2025-07-07', 5, 'EQ_ST'],
    ])
  })
  it('equity MF long-term gains share the ₹1.25L limit with stocks', () => {
    const r = analyze(
      portfolio({
        trades: [
          trade('S', '2025-01-06', 'BUY', 100, 100),
          trade('S', '2026-06-01', 'SELL', 100, 1_100),
          trade('F', '2025-01-06', 'BUY', 100, 100, { segment: 'MF' }),
          trade('F', '2026-06-01', 'SELL', 100, 350, { segment: 'MF' }),
        ],
        instruments: { F: 'EQUITY_MF' },
      }),
      SALARY_9L,
    )
    // ₹1,00,000 (stock) + ₹25,000 (fund) = ₹1,25,000: exactly the limit, ₹0 tax.
    expect(r.limit.left).toBe(0)
    expect(r.summary.tax).toBe(0)
  })
  it('a debt fund bought after 1 Apr 2023 is slab-rate, and the Section 156 rebate covers it (≤ ₹12L)', () => {
    const r = analyze(
      portfolio({
        trades: [trade('D', '2024-06-14', 'BUY', 1000, 100, { segment: 'MF' }), trade('D', '2026-06-01', 'SELL', 1000, 120, { segment: 'MF' })],
        instruments: { D: 'DEBT_MF' },
      }),
      salaried(11_00_000),
    )
    expect(r.buckets.find((b) => b.id === 'DEBT_MF')!.taxable).toBe(rs(20_000))
    expect(r.summary.tax).toBe(0)
  })
})
