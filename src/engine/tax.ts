// Bucket set-off (R7, R14, R15) and the tax computation (R1–R4, R10, R11, R18).
import type { BusinessTrade, CgBucket, OtherIncome, RealizedSlice } from './ledger'
import { applyBps, sum } from './money'
import {
  R1_STCG_EQUITY_BPS,
  R2_LTCG_EQUITY_BPS,
  R2_LTCG_EXEMPTION,
  R3_CESS_BPS,
  R4_SURCHARGE_CAP_ON_GAINS_BPS,
  R4_SURCHARGE_SLABS,
  R6_LTCG_NON_EQUITY_BPS,
  R10_BASIC_EXEMPTION,
  R11_REBATE_INCOME_LIMIT,
  R11_REBATE_MAX,
  R18_SLABS,
  R18_STANDARD_DEDUCTION,
} from './rules'
import type { Paise, Settings } from './types'

export type BucketId = CgBucket | 'INTRADAY' | 'FNO'

export const BUCKET_ORDER: BucketId[] = ['EQ_ST', 'EQ_LT', 'DEBT_MF', 'NONEQ_ST', 'NONEQ_LT', 'INTRADAY', 'FNO']
export const SLAB_BUCKETS: BucketId[] = ['DEBT_MF', 'NONEQ_ST', 'INTRADAY', 'FNO']

export interface BucketFigures {
  id: BucketId
  /** Sum of profitable sales (per sale, per bucket) */
  gains: Paise
  /** Sum of loss-making sales in this bucket (positive number) */
  ownLosses: Paise
  /** Losses applied against this bucket's gains (own + from other buckets) */
  lossesSetOff: Paise
  /** Gains left after set-off */
  taxable: Paise
  /** This bucket's losses left after set-off (carried forward) */
  lossLeft: Paise
}

export type Buckets = Record<BucketId, BucketFigures>

const emptyBucket = (id: BucketId): BucketFigures => ({ id, gains: 0, ownLosses: 0, lossesSetOff: 0, taxable: 0, lossLeft: 0 })

/** Net gain per (sale, bucket): the unit the set-off rules work on. */
function netPerSale(slices: RealizedSlice[]): Map<CgBucket, Paise[]> {
  const bySale = new Map<string, { bucket: CgBucket; gain: Paise }>()
  for (const s of slices) {
    const key = `${s.sellTradeId}|${s.bucket}`
    const cur = bySale.get(key) ?? { bucket: s.bucket, gain: 0 }
    cur.gain += s.gain
    bySale.set(key, cur)
  }
  const out = new Map<CgBucket, Paise[]>()
  for (const { bucket, gain } of bySale.values()) out.set(bucket, [...(out.get(bucket) ?? []), gain])
  return out
}

/**
 * Applies the set-off rules and returns per-bucket figures.
 * - R7: short-term capital losses cancel any capital gain; long-term losses only long-term gains.
 * - R14: intraday losses cancel only intraday profits.
 * - R15: F&O losses cancel any other income except salary.
 * Cross-bucket order (assumption): highest-taxed first, long-term equity last (it has the ₹1.25L exemption).
 */
export function setOff(realized: RealizedSlice[], business: BusinessTrade[]): Buckets {
  const b = Object.fromEntries(BUCKET_ORDER.map((id) => [id, emptyBucket(id)])) as Buckets
  for (const [bucket, gains] of netPerSale(realized)) {
    b[bucket].gains = sum(gains.filter((g) => g > 0))
    b[bucket].ownLosses = -sum(gains.filter((g) => g < 0))
  }
  for (const t of business) {
    const id = t.kind
    if (t.netPnl > 0) b[id].gains += t.netPnl
    else b[id].ownLosses += -t.netPnl
  }

  // Within each bucket first.
  for (const id of BUCKET_ORDER) {
    const f = b[id]
    const used = Math.min(f.gains, f.ownLosses)
    f.lossesSetOff = used
    f.taxable = f.gains - used
    f.lossLeft = f.ownLosses - used
  }

  const applyAcross = (from: BucketId, targets: BucketId[]) => {
    for (const t of targets) {
      if (b[from].lossLeft === 0) return
      const used = Math.min(b[from].lossLeft, b[t].taxable)
      b[t].taxable -= used
      b[t].lossesSetOff += used
      b[from].lossLeft -= used
    }
  }
  // R7: short-term capital losses.
  for (const from of ['EQ_ST', 'NONEQ_ST', 'DEBT_MF'] as const) {
    applyAcross(from, ['EQ_ST', 'DEBT_MF', 'NONEQ_ST', 'NONEQ_LT', 'EQ_LT'])
  }
  // R7: long-term capital losses, only against long-term gains.
  for (const from of ['NONEQ_LT', 'EQ_LT'] as const) applyAcross(from, ['NONEQ_LT', 'EQ_LT'])
  // R15: F&O losses against intraday profits and capital gains (never salary).
  applyAcross('FNO', ['INTRADAY', 'DEBT_MF', 'NONEQ_ST', 'EQ_ST', 'NONEQ_LT', 'EQ_LT'])
  // R14: intraday losses stay within intraday (already done above).
  return b
}

// ---------------------------------------------------------------------------

export interface IncomeParts {
  /** Income taxed at slab rates (after standard deduction) */
  normal: Paise
  /** Sec 196 (111A) short-term equity gains */
  stcg: Paise
  /** Sec 198 (112A) long-term equity gains, before the ₹1.25L exemption, all brokers */
  ltcgEquity: Paise
  /** Sec 197 (112) long-term non-equity gains (R6), no exemption */
  ltcgOther: Paise
}

export interface Component {
  base: Paise // tax before surcharge and cess
  surcharge: Paise
  cess: Paise
  total: Paise
}

export interface TaxResult {
  totalIncome: Paise
  slabTax: Paise
  rebateEligible: boolean
  rebate: Paise
  exemptionUsed: Paise
  basicExemptionAbsorbed: Paise
  normal: Component // slab tax after rebate
  stcg: Component
  ltcgEquity: Component
  ltcgOther: Component
  total: Paise
}

/** R18 new-regime slab tax */
export function slabTax(income: Paise): Paise {
  let tax = 0
  let lower = 0
  for (const s of R18_SLABS) {
    if (income > lower) tax += applyBps(Math.min(income, s.upTo) - lower, s.bps)
    lower = s.upTo
  }
  return tax
}

/** Other income after the standard deduction (R18) */
export function otherTaxableIncome(s: Settings): Paise {
  const deduction = s.otherIncomeIsSalary ? Math.min(R18_STANDARD_DEDUCTION, s.otherIncomePaise) : 0
  return Math.max(0, s.otherIncomePaise - deduction)
}

function surchargeBps(totalIncome: Paise): number {
  return R4_SURCHARGE_SLABS.find((s) => totalIncome > s.above)?.bps ?? 0
}

function component(base: Paise, surchargeRate: number): Component {
  const surcharge = applyBps(base, surchargeRate)
  const cess = applyBps(base + surcharge, R3_CESS_BPS) // R3
  return { base, surcharge, cess, total: base + surcharge + cess }
}

export interface TaxOptions {
  /** R10; switched off only to measure what it saved */
  basicExemption?: boolean
}

export function computeTax(p: IncomeParts, opts: TaxOptions = {}): TaxResult {
  const normal = Math.max(0, p.normal)
  // R2: ₹1.25L exemption on long-term equity gains.
  const exemptionUsed = Math.min(p.ltcgEquity, R2_LTCG_EXEMPTION)
  let stcg = p.stcg
  let ltcgEq = p.ltcgEquity - exemptionUsed
  let ltcgOther = p.ltcgOther

  // R10: unused basic exemption absorbs special-rate gains (highest rate first).
  let shortfall = opts.basicExemption === false ? 0 : Math.max(0, R10_BASIC_EXEMPTION - normal)
  const absorb = (x: Paise) => {
    const used = Math.min(shortfall, x)
    shortfall -= used
    return used
  }
  const a1 = absorb(stcg)
  stcg -= a1
  const a2 = absorb(ltcgEq)
  ltcgEq -= a2
  const a3 = absorb(ltcgOther)
  ltcgOther -= a3

  const totalIncome = normal + p.stcg + p.ltcgEquity + p.ltcgOther
  const slab = slabTax(normal)
  // R11: rebate for total income up to ₹12L, only against slab tax (not special-rate gains).
  const rebateEligible = totalIncome <= R11_REBATE_INCOME_LIMIT
  const rebate = rebateEligible ? Math.min(R11_REBATE_MAX, slab) : 0

  const sc = surchargeBps(totalIncome)
  const scGains = Math.min(sc, R4_SURCHARGE_CAP_ON_GAINS_BPS) // R4
  const result = {
    totalIncome,
    slabTax: slab,
    rebateEligible,
    rebate,
    exemptionUsed,
    basicExemptionAbsorbed: a1 + a2 + a3,
    normal: component(slab - rebate, sc),
    stcg: component(applyBps(stcg, R1_STCG_EQUITY_BPS), scGains),
    ltcgEquity: component(applyBps(ltcgEq, R2_LTCG_EQUITY_BPS), scGains),
    ltcgOther: component(applyBps(ltcgOther, R6_LTCG_NON_EQUITY_BPS), scGains),
  }
  return {
    ...result,
    total: result.normal.total + result.stcg.total + result.ltcgEquity.total + result.ltcgOther.total,
  }
}

// ---------------------------------------------------------------------------

export interface PortfolioTax {
  buckets: Buckets
  otherIncome: Paise // R12 buyback dividends
  withPortfolio: TaxResult
  withoutPortfolio: TaxResult
  /** Tax caused by the portfolio (with − without), unrounded paise */
  incremental: Paise
  /** Per-bucket share of `incremental`, unrounded paise. `REBATE_LOST` covers tax on other income caused by losing the rebate. */
  bucketTax: Record<BucketId | 'OTHER_SLAB' | 'REBATE_LOST', Paise>
}

export function incomeParts(buckets: Buckets, settings: Settings, otherIncome: Paise): IncomeParts {
  return {
    normal: otherTaxableIncome(settings) + otherIncome + sum(SLAB_BUCKETS.map((id) => buckets[id].taxable)),
    stcg: buckets.EQ_ST.taxable,
    ltcgEquity: buckets.EQ_LT.taxable + settings.otherBrokerLtcgPaise,
    ltcgOther: buckets.NONEQ_LT.taxable,
  }
}

export function portfolioTax(
  realized: RealizedSlice[],
  business: BusinessTrade[],
  other: OtherIncome[],
  settings: Settings,
  opts: TaxOptions = {},
): PortfolioTax {
  const buckets = setOff(realized, business)
  const otherIncome = sum(other.map((o) => o.amount))
  const withPortfolio = computeTax(incomeParts(buckets, settings, otherIncome), opts)
  const withoutPortfolio = computeTax({
    normal: otherTaxableIncome(settings),
    stcg: 0,
    ltcgEquity: settings.otherBrokerLtcgPaise,
    ltcgOther: 0,
  }, opts)
  const incremental = withPortfolio.total - withoutPortfolio.total

  const special = {
    EQ_ST: withPortfolio.stcg.total,
    EQ_LT: withPortfolio.ltcgEquity.total - withoutPortfolio.ltcgEquity.total,
    NONEQ_LT: withPortfolio.ltcgOther.total,
  }
  const slabPart = incremental - special.EQ_ST - special.EQ_LT - special.NONEQ_LT
  const slabIds: (BucketId | 'OTHER_SLAB')[] = [...SLAB_BUCKETS, 'OTHER_SLAB']
  const weights = slabIds.map((id) => (id === 'OTHER_SLAB' ? otherIncome : buckets[id as BucketId].taxable))
  const totalWeight = sum(weights)
  const bucketTax: PortfolioTax['bucketTax'] = {
    EQ_ST: special.EQ_ST,
    EQ_LT: special.EQ_LT,
    NONEQ_LT: special.NONEQ_LT,
    DEBT_MF: 0,
    NONEQ_ST: 0,
    INTRADAY: 0,
    FNO: 0,
    OTHER_SLAB: 0,
    REBATE_LOST: 0,
  }
  if (totalWeight > 0) {
    slabIds.forEach((id, i) => (bucketTax[id] = Math.round((slabPart * weights[i]) / totalWeight)))
  } else {
    bucketTax.REBATE_LOST = slabPart
  }
  return { buckets, otherIncome, withPortfolio, withoutPortfolio, incremental, bucketTax }
}
