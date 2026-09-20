// analyze(input, settings) → every metric in PRODUCT.md §7 and every strategy in §8.
import { addDays, daysBetween, financialYearOf, formatDay, istDay, longTermFrom, makeDay, monthKey, type FinancialYear } from './dates'
import {
  buildLedger,
  classify,
  fromMilli,
  grandfatheredCost,
  isEquityClass,
  longTermMonths,
  type BusinessTrade,
  type CgBucket,
  type Lot,
  type RealizedSlice,
  type TradeInfo,
} from './ledger'
import { elssUnlockFrom, isMfClass } from './mf'
import { applyBps, roundToRupee, sum } from './money'
import {
  R2_LTCG_EQUITY_BPS,
  R2_LTCG_EXEMPTION,
  R3_CESS_BPS,
  R7_CAPITAL_LOSS_CARRY_YEARS,
  R10_BASIC_EXEMPTION,
  R11_REBATE_INCOME_LIMIT,
  R13_BUY_BACK_AFTER_DAYS,
  R14_INTRADAY_LOSS_CARRY_YEARS,
  R15_FNO_LOSS_CARRY_YEARS,
  R16_STT_FUTURES_BPS,
  R16_STT_OPTIONS_BPS,
  R19_ITR1_MAX_LTCG,
  R20_DEADLINE_ITR12,
  R20_DEADLINE_ITR3,
  R21_ADVANCE_TAX_THRESHOLD,
  R21_INSTALMENTS,
  SECTIONS,
} from './rules'
import { BUCKET_ORDER, otherTaxableIncome, portfolioTax, type BucketId, type PortfolioTax } from './tax'
import type { Charges, Day, Instrument, Paise, PortfolioInput, Settings } from './types'

// ----------------------------------------------------------------- output types

export interface BucketRow {
  id: BucketId
  label: string
  rate: string
  active: boolean
  gains: Paise
  lossesSetOff: Paise
  taxable: Paise
  tax: Paise // rounded to the rupee
}

export interface LotView {
  symbol: string
  acquired: Day | null
  qty: number
  cost: Paise // cost used for tax (after R22)
  value: Paise // at LTP
  gain: Paise
  daysHeld: number | null
  longTermFrom: Day | null // null: already long-term, or never (slab)
  daysLeft: number // 0 when already long-term
  longTerm: boolean
  bucketToday: CgBucket
  grandfathered: boolean
  approximate: boolean
  /** C4: tax if sold today − tax once long-term (gain lots turning long-term only) */
  taxToday: Paise
  taxOnceLongTerm: Paise | null
  savingByWaiting: Paise
  /** R25: an ELSS lot still inside its 3-year lock-in (can't be redeemed; excluded from tax-if-sold-today) */
  locked: boolean
  unlockFrom: Day | null
}

export type Chip =
  | { kind: 'WAIT'; days: number; date: Day; saving: Paise }
  | { kind: 'TAX_FREE'; amount: Paise }
  /** Short-term gain lot whose tax today is already ₹0 (e.g. inside the unused basic exemption): waiting saves nothing */
  | { kind: 'NO_TAX'; date: Day }
  | { kind: 'LOSS'; loss: Paise; taxCut: Paise }

export interface HoldingView {
  symbol: string
  name: string
  assetClass: Instrument['assetClass']
  qty: number
  avgCost: Paise // per unit, from lots
  ltp: Paise
  value: Paise
  cost: Paise
  unrealized: Paise
  unrealizedShortTerm: Paise
  unrealizedLongTerm: Paise
  /** C2: marginal tax if the whole holding were sold today (negative = tax saved) */
  taxIfSoldToday: Paise
  lots: LotView[]
  chip: Chip | null
}

export interface OrderSizeRow {
  id: 'SMALL' | 'MID' | 'LARGE'
  label: string
  orders: number
  value: Paise
  charges: Paise
  pctOfValue: number
}

export interface Report {
  source: PortfolioInput['source']
  asOf: Day
  fy: FinancialYear
  settings: Settings
  summary: {
    grossGains: Paise // A1
    tax: Paise // A2
    charges: Paise // A3
    keep: Paise // A4
    keepPct: number
    chargesPctOfGross: number // D3
  }
  buckets: BucketRow[] // B
  limit: { limit: Paise; usedUpstox: Paise; usedOtherBrokers: Paise; used: Paise; left: Paise; resetsOn: Day } // B1
  lossSetOff: { losses: Paise; taxSaved: Paise } | null // B2
  section156: {
    show: boolean
    totalIncome: Paise
    stockTax: Paise
    rebateEligible: boolean
    /** R10: `taxSaved` = tax without the unused basic exemption − actual tax */
    unusedBasicExemption: { show: boolean; normalIncome: Paise; absorbed: Paise; taxSaved: Paise; left: Paise }
  } // B3
  carryForward: { label: string; amount: Paise; years: number }[] // B4
  holdings: HoldingView[] // C1, C2
  timeline: LotView[] // C3
  totalTaxIfSoldToday: Paise // C2 total
  bookTaxFree: { total: Paise; byHolding: { symbol: string; amount: Paise }[] } // C5
  lossesToUse: { show: boolean; losses: Paise; taxCut: Paise; symbols: string[] } // C6
  charges: {
    byType: Record<keyof Charges, Paise> // D1
    byMonth: ({ month: string; total: Paise } & Record<keyof Charges, Paise>)[] // D2
    pctOfGross: number // D3
    orderSize: OrderSizeRow[] // D4
    smallOrders: { count: number; totalOrders: number; cost: Paise; value: Paise } // D5
    split: { delivery: Paise; intraday: Paise; fno: Paise } // D6
  }
  trading: {
    show: boolean
    intraday: { present: boolean; net: Paise; turnover: Paise; tax: Paise }
    fno: { present: boolean; net: Paise; turnover: Paise; charges: Paise; chargesPctOfTurnover: number; tax: Paise }
    sttNote: string
  } // E
  filing: {
    itr: 'ITR-1' | 'ITR-2' | 'ITR-3'
    reason: string
    deadline: Day
    advanceTax: {
      applies: boolean
      /** 'portfolio': salary tax assumed covered by TDS; 'total': no TDS assumed (other income isn't salary) */
      basis: 'portfolio' | 'total'
      total: Paise
      /** Instalments whose date has passed */
      past: { date: Day; cumulativePct: number; amount: Paise }[]
      next: { date: Day; cumulativePct: number; amount: Paise } | null
      schedule: { date: Day; cumulativePct: number; amount: Paise }[]
    }
  } // F
  strategies: Strategies
  mf: MfReport // M
  warnings: string[]
}

export interface MfLotGroup {
  units: number
  value: Paise
  gain: Paise
  lots: number
}

export type MfChip =
  | { kind: 'WITHDRAW_FREE'; value: Paise; units: number } // M2
  | { kind: 'NEXT_LONG_TERM'; date: Day; days: number; value: Paise } // M3
  | { kind: 'LOCKED'; date: Day; days: number; value: Paise } // M4: everything locked
  | { kind: 'UNLOCKED'; value: Paise; next: { date: Day; value: Paise } | null } // M4: part unlocked
  | { kind: 'SLAB' } // M5

export interface MfFund {
  symbol: string
  name: string
  shortName: string
  scheme: 'EQUITY' | 'ELSS' | 'DEBT'
  units: number
  nav: Paise
  value: Paise
  cost: Paise
  gain: Paise
  longTerm: MfLotGroup // M1
  shortTerm: MfLotGroup // M1
  nextLongTerm: { date: Day; days: number; value: Paise; units: number } | null // M3
  elss: {
    locked: MfLotGroup
    unlocked: MfLotGroup
    nextUnlock: { date: Day; days: number; value: Paise; units: number } | null
    schedule: { date: Day; days: number; value: Paise; units: number; lots: number }[]
  } | null // M4
  /** M2: the largest FIFO redemption (from the oldest unlocked lot) with ₹0 extra tax today */
  withdrawFree: { units: number; value: Paise; lots: number }
  /** Extra tax if every unlocked unit were redeemed today */
  taxIfRedeemAll: Paise
  slab: boolean // M5
  chips: MfChip[]
}

export interface MfRedemption {
  symbol: string
  shortName: string
  day: Day
  units: number
  lots: number
  longTermLots: number
  shortTermLots: number
  gain: Paise
  tax: Paise
}

export interface MfReport {
  show: boolean
  funds: MfFund[]
  /** M2 headline */
  withdrawFree: Paise
  withdrawFreeFunds: string[]
  locked: Paise
  firstUnlock: { date: Day; days: number; value: Paise } | null
  redemptions: MfRedemption[] // M6
  charges: { orders: number; amount: Paise; stamp: Paise; brokerage: Paise }
}

export interface Strategies {
  waitForLongTerm: { symbol: string; days: number; date: Day; gain: Paise; taxToday: Paise; taxOnDate: Paise; saving: Paise }[]
  gainHarvest: {
    show: boolean
    bookable: Paise
    taxSaved: Paise // bookable × 12.5% × 1.04
    estimatedCost: Paise // sell + buy back charges (stage 3: Brokerage API)
    netSaving: Paise
    buyBackOn: string
    byHolding: { symbol: string; bookable: Paise; qty: number; taxSaved: Paise; estimatedCost: Paise }[]
  }
  lossHarvest: { show: boolean; losses: Paise; taxCut: Paise; symbols: string[] }
  charges: { perYear: Paise; smallOrderExcess: Paise; cap: Paise; annualizationDays: number }
  section156: { show: boolean; stockTax: Paise; unusedBasicExemption: boolean }
  advanceTax: { show: boolean; amount: Paise; date: Day | null }
}

// ----------------------------------------------------------------- labels

const BUCKET_LABELS: Record<BucketId, { label: string; rate: string }> = {
  EQ_ST: { label: 'Stocks, equity ETFs & equity MFs · short-term', rate: `20% + cess · ${SECTIONS.stcgEquity}` },
  EQ_LT: { label: 'Stocks, equity ETFs & equity MFs · long-term', rate: `12.5% + cess above ₹1.25L · ${SECTIONS.ltcgEquity}` },
  DEBT_MF: { label: 'Debt mutual funds', rate: 'Slab rate' },
  NONEQ_ST: { label: 'Gold / international / other · short-term', rate: 'Slab rate' },
  NONEQ_LT: { label: 'Gold / international / other · long-term', rate: `12.5% + cess, no exemption · ${SECTIONS.ltcgOther}` },
  INTRADAY: { label: 'Intraday (speculative business)', rate: 'Slab rate' },
  FNO: { label: 'F&O (non-speculative business)', rate: 'Slab rate' },
}

const SMALL_ORDER = 2_000_00
const LARGE_ORDER = 10_000_00

const CHARGE_KEYS: (keyof Charges)[] = ['brokerage', 'stt', 'exchange', 'sebi', 'stamp', 'gst', 'dp']
const zeroCharges = (): Record<keyof Charges, Paise> => ({ brokerage: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, gst: 0, dp: 0 })

const inFy = (fy: FinancialYear, day: Day) => day >= fy.start && day <= fy.end

// ----------------------------------------------------------------- analyze

export function analyze(input: PortfolioInput, settings: Settings): Report {
  const asOf = istDay(input.asOf)
  const fy = financialYearOf(asOf)
  const ledger = buildLedger(input)
  const instruments = new Map(input.instruments.map((i) => [i.symbol, i]))

  const realizedFy = ledger.realized.filter((r) => inFy(fy, r.sellDay) && r.sellDay <= asOf)
  const businessFy = ledger.business.filter((b) => inFy(fy, b.day) && b.day <= asOf)
  const otherFy = ledger.otherIncome.filter((o) => inFy(fy, o.day) && o.day <= asOf)
  const tradesFy = ledger.trades.filter((t) => inFy(fy, t.day) && t.day <= asOf)

  const taxOf = (realized: RealizedSlice[], business: BusinessTrade[] = businessFy): PortfolioTax =>
    portfolioTax(realized, business, otherFy, settings)
  const base = taxOf(realizedFy)
  /** Unrounded extra tax if these slices were also realized this year */
  const delta = (extra: RealizedSlice[]) => taxOf([...realizedFy, ...extra]).incremental - base.incremental

  // --- A2 / B: tax per bucket, rounded to rupees so the rows add up to A2.
  const tax = roundToRupee(base.incremental)
  const rows: BucketRow[] = BUCKET_ORDER.map((id) => {
    const f = base.buckets[id]
    return {
      id,
      ...BUCKET_LABELS[id],
      active: f.gains + f.ownLosses > 0,
      gains: f.gains,
      lossesSetOff: f.lossesSetOff,
      taxable: f.taxable,
      tax: roundToRupee(base.bucketTax[id]),
    }
  })
  const drift = tax - sum(rows.map((r) => r.tax))
  if (drift !== 0) {
    const biggest = rows.reduce((a, b) => (Math.abs(b.tax) > Math.abs(a.tax) ? b : a))
    biggest.tax += drift
  }

  // --- A1, A3, A4
  const byType = zeroCharges()
  for (const t of tradesFy) for (const k of CHARGE_KEYS) byType[k] += t.trade.charges[k]
  const charges = sum(CHARGE_KEYS.map((k) => byType[k]))
  const netGains = sum(BUCKET_ORDER.map((id) => base.buckets[id].taxable))
  const grossGains = netGains + charges
  const keep = grossGains - tax - charges

  // --- B1: the ₹1.25L limit, shared across brokers.
  const usedUpstox = base.buckets.EQ_LT.taxable
  const used = usedUpstox + settings.otherBrokerLtcgPaise
  const limitLeft = Math.max(0, R2_LTCG_EXEMPTION - used)

  // --- B2: what the losses set off this year saved.
  // B2 is about capital losses (R7): losses that cancelled capital gains this year.
  // (Losing intraday / F&O trades are part of business income, not a set-off.)
  const CG_BUCKETS: BucketId[] = ['EQ_ST', 'EQ_LT', 'DEBT_MF', 'NONEQ_ST', 'NONEQ_LT']
  const lossesUsed = sum(CG_BUCKETS.map((id) => base.buckets[id].ownLosses - base.buckets[id].lossLeft))
  let lossSetOff: Report['lossSetOff'] = null
  if (lossesUsed > 0) {
    const noLosses = taxOf(realizedFy.filter((r) => r.gain > 0 || !isLossSale(realizedFy, r)))
    lossSetOff = { losses: lossesUsed, taxSaved: roundToRupee(noLosses.incremental - base.incremental) }
  }

  // --- B3: Section 156 warning (+ R10).
  const stockTax = roundToRupee(base.bucketTax.EQ_ST + base.bucketTax.EQ_LT)
  const w = base.withPortfolio
  const normalIncome = otherTaxableIncome(settings) + base.otherIncome + base.buckets.DEBT_MF.taxable + base.buckets.NONEQ_ST.taxable + base.buckets.INTRADAY.taxable + base.buckets.FNO.taxable
  const section156: Report['section156'] = {
    show: w.totalIncome <= R11_REBATE_INCOME_LIMIT && stockTax > 0,
    totalIncome: w.totalIncome,
    stockTax,
    rebateEligible: w.rebateEligible,
    unusedBasicExemption: {
      show: normalIncome < R10_BASIC_EXEMPTION,
      normalIncome,
      absorbed: w.basicExemptionAbsorbed,
      left: Math.max(0, R10_BASIC_EXEMPTION - normalIncome - w.basicExemptionAbsorbed),
      taxSaved: w.basicExemptionAbsorbed > 0
        ? roundToRupee(portfolioTax(realizedFy, businessFy, otherFy, settings, { basicExemption: false }).incremental - base.incremental)
        : 0,
    },
  }

  // --- B4
  const b = base.buckets
  const carryForward = [
    { label: 'Short-term capital loss', amount: b.EQ_ST.lossLeft + b.NONEQ_ST.lossLeft + b.DEBT_MF.lossLeft, years: R7_CAPITAL_LOSS_CARRY_YEARS },
    { label: 'Long-term capital loss', amount: b.EQ_LT.lossLeft + b.NONEQ_LT.lossLeft, years: R7_CAPITAL_LOSS_CARRY_YEARS },
    { label: 'Intraday (speculative) loss', amount: b.INTRADAY.lossLeft, years: R14_INTRADAY_LOSS_CARRY_YEARS },
    { label: 'F&O (non-speculative) loss', amount: b.FNO.lossLeft, years: R15_FNO_LOSS_CARRY_YEARS },
  ].filter((c) => c.amount > 0)

  // --- C: holdings, decide before you sell.
  const nextFyTax = (slice: RealizedSlice): Paise => {
    // A lot turning long-term after 31 March is sold in a fresh year: nothing booked yet, limit reset.
    const fresh = { ...settings, otherBrokerLtcgPaise: 0 }
    return portfolioTax([slice], [], [], fresh).incremental
  }
  const holdings: HoldingView[] = []
  const allLots: LotView[] = []
  for (const h of input.holdings) {
    const inst = instruments.get(h.symbol)
    if (!inst) continue
    const lots = ledger.openLots.filter((l) => l.symbol === h.symbol)
    const slices = lots.map((l) => hypotheticalSale(l, inst, input, h.ltpPaise, asOf))
    const views: LotView[] = lots.map((l, i) => {
      const s = slices[i]
      const months = longTermMonths(inst.assetClass, l.acquired)
      const ltFrom = l.acquired !== null && months !== null ? longTermFrom(l.acquired, months) : null
      const daysLeft = ltFrom && !s.longTerm ? daysBetween(asOf, ltFrom) : 0
      const unlockFrom = inst.elss && l.acquired ? elssUnlockFrom(l.acquired) : null
      const locked = unlockFrom !== null && asOf < unlockFrom
      const taxToday = locked ? 0 : roundToRupee(delta([s]))
      let taxOnceLongTerm: Paise | null = null
      if (!locked && ltFrom && !s.longTerm && s.gain > 0) {
        const later = { ...s, sellDay: ltFrom, ...classify(inst.assetClass, l.acquired, ltFrom) }
        taxOnceLongTerm = roundToRupee(ltFrom <= fy.end ? delta([later]) : nextFyTax(later))
      }
      return {
        symbol: h.symbol,
        acquired: l.acquired,
        qty: fromMilli(l.qtyM),
        cost: s.costForTax,
        value: s.saleValue,
        gain: s.gain,
        daysHeld: l.acquired ? daysBetween(l.acquired, asOf) : null,
        longTermFrom: s.longTerm ? null : ltFrom,
        daysLeft,
        longTerm: s.longTerm,
        bucketToday: s.bucket,
        grandfathered: s.grandfathered,
        approximate: s.approximate,
        taxToday,
        taxOnceLongTerm,
        savingByWaiting: taxOnceLongTerm === null ? 0 : taxToday - taxOnceLongTerm,
        locked,
        unlockFrom,
      }
    })
    allLots.push(...views)
    const qty = sum(views.map((v) => v.qty))
    const cost = sum(views.map((v) => v.cost))
    const value = sum(views.map((v) => v.value))
    holdings.push({
      symbol: h.symbol,
      name: inst.name,
      assetClass: inst.assetClass,
      qty,
      avgCost: qty ? Math.round(cost / qty) : 0,
      ltp: h.ltpPaise,
      value,
      cost,
      unrealized: value - cost,
      unrealizedShortTerm: sum(views.filter((v) => !v.longTerm).map((v) => v.gain)),
      unrealizedLongTerm: sum(views.filter((v) => v.longTerm).map((v) => v.gain)),
      taxIfSoldToday: roundToRupee(delta(slices.filter((_, i) => !views[i].locked))),
      lots: views,
      chip: null,
    })
  }

  // C3: every lot not yet long-term, soonest first; then the long-term ones.
  const timeline = [...allLots].sort((a, b) => (a.longTerm === b.longTerm ? a.daysLeft - b.daysLeft : a.longTerm ? 1 : -1))

  // C5: long-term equity gains that fit in the limit left, in whole shares. Fill from the holding with the
  // largest long-term gain (lots FIFO) and stop at the first share that no longer fits.
  let remaining = limitLeft
  let full = false
  const bookByHolding: { h: HoldingView; amount: Paise; qty: number; value: Paise }[] = []
  const byGain = holdings
    .filter((h) => isEquityClass(h.assetClass))
    .map((h) => ({ h, lots: h.lots.filter((l) => l.longTerm && l.gain > 0 && !l.locked) }))
    .filter((x) => x.lots.length > 0)
    .sort((a, b) => sum(b.lots.map((l) => l.gain)) - sum(a.lots.map((l) => l.gain)))
  for (const { h, lots } of byGain) {
    if (full) break
    const take = { h, amount: 0, qty: 0, value: 0 }
    for (const l of lots) {
      const units = Math.floor(l.qty)
      const n = Math.min(units, Math.floor((remaining * l.qty) / l.gain))
      if (n > 0) {
        const amount = Math.round((l.gain * n) / l.qty)
        take.amount += amount
        take.qty += n
        take.value += Math.round((l.value * n) / l.qty)
        remaining -= amount
      }
      if (n < units) {
        full = true
        break
      }
    }
    if (take.qty > 0) bookByHolding.push(take)
  }
  const bookTaxFree = { total: sum(bookByHolding.map((x) => x.amount)), byHolding: bookByHolding.map((x) => ({ symbol: x.h.symbol, amount: x.amount })) }

  // C6: unrealized losses that would cancel gains already booked this year.
  const lossSlices = holdings.flatMap((h) => {
    const inst = instruments.get(h.symbol)!
    return ledger.openLots
      .filter((l) => l.symbol === h.symbol && !isLocked(inst, l, asOf))
      .map((l) => hypotheticalSale(l, inst, input, h.ltp, asOf))
      .filter((s) => s.gain < 0)
  })
  const bookedGains = netGains > 0
  const lossTaxCut = lossSlices.length ? -roundToRupee(delta(lossSlices)) : 0
  const lossesToUse = {
    show: bookedGains && lossSlices.length > 0 && lossTaxCut > 0,
    losses: -sum(lossSlices.map((s) => s.gain)),
    taxCut: lossTaxCut,
    symbols: [...new Set(lossSlices.map((s) => s.symbol))],
  }

  // Chips (§5): wait > tax-free > no tax either way > loss. A "wait" chip only when waiting saves money (§10.1).
  for (const h of holdings) {
    const wait = h.lots.filter((l) => l.savingByWaiting > 0).sort((a, b) => a.daysLeft - b.daysLeft)[0]
    const bookable = bookTaxFree.byHolding.find((x) => x.symbol === h.symbol)
    const noTax = h.lots.filter((l) => !l.longTerm && l.gain > 0 && l.longTermFrom && l.taxToday <= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0]
    if (wait && wait.longTermFrom) h.chip = { kind: 'WAIT', days: wait.daysLeft, date: wait.longTermFrom, saving: wait.savingByWaiting }
    else if (bookable) h.chip = { kind: 'TAX_FREE', amount: bookable.amount }
    else if (noTax) h.chip = { kind: 'NO_TAX', date: noTax.longTermFrom! }
    else if (h.unrealized < 0) h.chip = { kind: 'LOSS', loss: -h.unrealized, taxCut: Math.max(0, -h.taxIfSoldToday) }
  }

  // --- D: charges.
  const months: string[] = []
  for (let d = fy.start; d <= asOf && d <= fy.end; d = addDays(d, 32).slice(0, 8) + '01') months.push(monthKey(d))
  const byMonth = months.map((month) => {
    const row = { month, total: 0, ...zeroCharges() }
    for (const t of tradesFy.filter((x) => monthKey(x.day) === month)) {
      for (const k of CHARGE_KEYS) row[k] += t.trade.charges[k]
      row.total += t.charges
    }
    return row
  })
  // D4/D5: cash-segment orders only (F&O contract values would swamp the ratios).
  const orders = groupOrders(tradesFy.filter((t) => !t.fno && t.trade.segment !== 'MF'))
  const sizeRow = (id: OrderSizeRow['id'], label: string, test: (v: Paise) => boolean): OrderSizeRow => {
    const os = orders.filter((o) => test(o.value))
    const value = sum(os.map((o) => o.value))
    const c = sum(os.map((o) => o.charges))
    return { id, label, orders: os.length, value, charges: c, pctOfValue: value ? (c / value) * 100 : 0 }
  }
  const orderSize = [
    sizeRow('SMALL', '< ₹2k', (v) => v < SMALL_ORDER),
    sizeRow('MID', '₹2k–10k', (v) => v >= SMALL_ORDER && v <= LARGE_ORDER),
    sizeRow('LARGE', '> ₹10k', (v) => v > LARGE_ORDER),
  ]
  const fnoCharges = sum(tradesFy.filter((t) => t.fno).map((t) => t.charges))
  const intradayCharges = sum(tradesFy.filter((t) => !t.fno).map((t) => Math.round(t.charges * t.intradayFraction)))
  const split = { delivery: charges - fnoCharges - intradayCharges, intraday: intradayCharges, fno: fnoCharges }
  const small = orderSize[0]
  const chargesPctOfGross = grossGains ? (charges / grossGains) * 100 : 0

  // --- E: intraday & F&O.
  const intradayTrades = businessFy.filter((t) => t.kind === 'INTRADAY')
  const fnoTrades = businessFy.filter((t) => t.kind === 'FNO')
  const fnoTurnover = sum(fnoTrades.map((t) => Math.abs(t.grossPnl))) // R17
  const trading: Report['trading'] = {
    show: intradayTrades.length + fnoTrades.length > 0,
    intraday: {
      present: intradayTrades.length > 0,
      net: sum(intradayTrades.map((t) => t.netPnl)),
      turnover: sum(intradayTrades.map((t) => Math.abs(t.grossPnl))),
      tax: rows.find((r) => r.id === 'INTRADAY')!.tax,
    },
    fno: {
      present: fnoTrades.length > 0,
      net: sum(fnoTrades.map((t) => t.netPnl)),
      turnover: fnoTurnover,
      charges: fnoCharges,
      chargesPctOfTurnover: fnoTurnover ? (fnoCharges / fnoTurnover) * 100 : 0,
      tax: rows.find((r) => r.id === 'FNO')!.tax,
    },
    sttNote: `STT on F&O went up on 1 Apr 2026: futures ${R16_STT_FUTURES_BPS / 100}%, options ${R16_STT_OPTIONS_BPS / 100}%.`,
  }

  // --- F: filing pointer.
  const filing = filingPointer(fy, asOf, trading.show, realizedFy, base, settings, tax)

  // --- §8 strategies.
  const strategies = buildStrategies({
    holdings,
    bookByHolding,
    orderSize,
    small,
    tradesFy,
    fy,
    asOf,
    lossesToUse,
    section156,
    filing,
  })

  return {
    source: input.source,
    asOf,
    fy,
    settings,
    summary: { grossGains, tax, charges, keep, keepPct: grossGains ? (keep / grossGains) * 100 : 0, chargesPctOfGross },
    buckets: rows,
    limit: {
      limit: R2_LTCG_EXEMPTION,
      usedUpstox,
      usedOtherBrokers: settings.otherBrokerLtcgPaise,
      used,
      left: limitLeft,
      resetsOn: makeDay(fy.startYear + 1, 4, 1),
    },
    lossSetOff,
    section156,
    carryForward,
    holdings,
    timeline,
    totalTaxIfSoldToday: roundToRupee(delta(holdings.flatMap((h) => {
      const inst = instruments.get(h.symbol)!
      return ledger.openLots.filter((l) => l.symbol === h.symbol && !isLocked(inst, l, asOf)).map((l) => hypotheticalSale(l, inst, input, h.ltp, asOf))
    }))),
    bookTaxFree,
    lossesToUse,
    charges: {
      byType,
      byMonth,
      pctOfGross: chargesPctOfGross,
      orderSize,
      smallOrders: { count: small.orders, totalOrders: orders.length, cost: small.charges, value: small.value },
      split,
    },
    trading,
    filing,
    strategies,
    mf: buildMfReport({ holdings, ledger, instruments, input, asOf, fy, realizedFy, tradesFy, delta, taxOf, baseIncremental: base.incremental }),
    warnings: ledger.warnings,
  }
}

// ----------------------------------------------------------------- helpers

/** Is this slice part of a sale whose net (per bucket) is a loss? */
function isLossSale(all: RealizedSlice[], r: RealizedSlice): boolean {
  return sum(all.filter((x) => x.sellTradeId === r.sellTradeId && x.bucket === r.bucket).map((x) => x.gain)) < 0
}

/** A lot valued at today's price, as if sold today (no sell-side charges assumed). */
function hypotheticalSale(lot: Lot, inst: Instrument, input: PortfolioInput, ltp: Paise, asOf: Day): RealizedSlice {
  const saleValue = Math.round((ltp * lot.qtyM) / 1000)
  const gf = grandfatheredCost(inst, input.corporateActions, lot.acquired, lot.qtyM, lot.cost, saleValue, asOf)
  return {
    symbol: lot.symbol,
    assetClass: inst.assetClass,
    sellTradeId: `today:${lot.symbol}:${lot.tradeId ?? lot.source}:${lot.acquired}`,
    sellDay: asOf,
    acquired: lot.acquired,
    qtyM: lot.qtyM,
    saleValue,
    sellExpenses: 0,
    actualCost: lot.cost,
    costForTax: gf.cost,
    gain: saleValue - gf.cost,
    ...classify(inst.assetClass, lot.acquired, asOf),
    grandfathered: gf.grandfathered,
    approximate: lot.approximate,
  }
}

function groupOrders(trades: TradeInfo[]): { orderId: string; value: Paise; charges: Paise }[] {
  const m = new Map<string, { orderId: string; value: Paise; charges: Paise }>()
  for (const t of trades) {
    const o = m.get(t.orderId) ?? { orderId: t.orderId, value: 0, charges: 0 }
    o.value += t.value
    o.charges += t.charges
    m.set(t.orderId, o)
  }
  return [...m.values()]
}

function filingPointer(
  fy: FinancialYear,
  asOf: Day,
  hasTrading: boolean,
  realizedFy: RealizedSlice[],
  base: PortfolioTax,
  settings: Settings,
  tax: Paise,
): Report['filing'] {
  // R21: salaried → salary tax is covered by TDS, so only the portfolio's tax counts. Otherwise no TDS is assumed.
  const basis: Report['filing']['advanceTax']['basis'] = settings.otherIncomeIsSalary ? 'portfolio' : 'total'
  const advanceBase = basis === 'portfolio' ? tax : roundToRupee(base.withPortfolio.total)
  const b = base.buckets
  const onlyLtEquity = BUCKET_ORDER.filter((id) => id !== 'EQ_LT').every((id) => b[id].gains + b[id].ownLosses === 0) && b.EQ_LT.ownLosses === 0
  const ltTotal = b.EQ_LT.taxable + settings.otherBrokerLtcgPaise
  let itr: Report['filing']['itr']
  let reason: string
  if (hasTrading) {
    itr = 'ITR-3'
    reason = 'You have intraday or F&O trades (business income).'
  } else if (realizedFy.length === 0 && settings.otherBrokerLtcgPaise === 0) {
    itr = 'ITR-1'
    reason = 'No capital gains booked this year.'
  } else if (onlyLtEquity && ltTotal <= R19_ITR1_MAX_LTCG) {
    itr = 'ITR-1'
    reason = 'Your only gains are long-term equity gains within ₹1.25L.'
  } else {
    itr = 'ITR-2'
    reason = 'You have capital gains other than long-term equity within ₹1.25L.'
  }
  const d = itr === 'ITR-3' ? R20_DEADLINE_ITR3 : R20_DEADLINE_ITR12
  const deadline = makeDay(fy.startYear + 1, d.month, d.day)

  const schedule = R21_INSTALMENTS.map((i) => ({
    date: makeDay(i.month >= 4 ? fy.startYear : fy.startYear + 1, i.month, i.day),
    cumulativePct: i.cumulativePct,
    amount: roundToRupee((advanceBase * i.cumulativePct) / 100),
  }))
  const applies = advanceBase > R21_ADVANCE_TAX_THRESHOLD
  return {
    itr,
    reason,
    deadline,
    advanceTax: {
      applies,
      basis,
      total: advanceBase,
      next: applies ? (schedule.find((s) => s.date >= asOf) ?? null) : null,
      past: applies ? schedule.filter((s) => s.date < asOf) : [],
      schedule,
    },
  }
}

function buildStrategies(x: {
  holdings: HoldingView[]
  bookByHolding: { h: HoldingView; amount: Paise; qty: number; value: Paise }[]
  orderSize: OrderSizeRow[]
  small: OrderSizeRow
  tradesFy: TradeInfo[]
  fy: FinancialYear
  asOf: Day
  lossesToUse: Report['lossesToUse']
  section156: Report['section156']
  filing: Report['filing']
}): Strategies {
  // Wait for long-term.
  const waitForLongTerm = x.holdings.flatMap((h) =>
    h.chip?.kind === 'WAIT'
      ? h.lots
          .filter((l) => l.savingByWaiting > 0 && l.daysLeft === (h.chip as { days: number }).days)
          .map((l) => ({
            symbol: h.symbol,
            days: l.daysLeft,
            date: l.longTermFrom!,
            gain: l.gain,
            taxToday: l.taxToday,
            taxOnDate: l.taxOnceLongTerm ?? 0,
            saving: l.savingByWaiting,
          }))
      : [],
  )

  // Gain harvest: future tax saved = gain × 12.5% × 1.04 (R2, R3), minus the cost of selling and buying back.
  // Stage 1 estimates that cost from this user's own average cost for the same order size; stage 3 uses the Brokerage API.
  const rateFor = (value: Paise) => {
    const row = value < SMALL_ORDER ? x.orderSize[0] : value <= LARGE_ORDER ? x.orderSize[1] : x.orderSize[2]
    const fallback = x.orderSize.find((r) => r.orders > 0)
    return (row.orders ? row : fallback)?.pctOfValue ?? 0
  }
  const byHolding = x.bookByHolding.map(({ h, amount, qty, value }) => {
    const oneWay = Math.round((value * rateFor(value)) / 100)
    return {
      symbol: h.symbol,
      bookable: amount,
      qty,
      taxSaved: roundToRupee(applyBps(applyBps(amount, R2_LTCG_EQUITY_BPS), 10_000 + R3_CESS_BPS)),
      estimatedCost: roundToRupee(2 * oneWay),
    }
  })
  const taxSaved = sum(byHolding.map((b) => b.taxSaved))
  const estimatedCost = sum(byHolding.map((b) => b.estimatedCost))

  // Charges: what small orders cost above the rate of large orders, capped at brokerage + DP actually paid, per year.
  const large = x.orderSize[2].orders ? x.orderSize[2] : x.orderSize[1]
  const smallTrades = groupOrderIds(x.tradesFy.filter((t) => !t.fno && t.trade.segment !== 'MF'), x.small)
  const excess = Math.max(0, x.small.charges - Math.round((x.small.value * (large.orders ? large.pctOfValue : x.small.pctOfValue)) / 100))
  const cap = sum(smallTrades.map((t) => t.trade.charges.brokerage + t.trade.charges.dp))
  const elapsed = daysBetween(x.fy.start, x.asOf) + 1
  // Scaled to a year, then capped at the brokerage + DP actually paid (§8).
  const perYear = roundToRupee(Math.min((excess * 365) / elapsed, cap))

  return {
    waitForLongTerm,
    gainHarvest: {
      show: byHolding.length > 0,
      bookable: sum(byHolding.map((b) => b.bookable)),
      taxSaved,
      estimatedCost,
      netSaving: taxSaved - estimatedCost,
      buyBackOn: `the next trading day (never the same day: R13, ${R13_BUY_BACK_AFTER_DAYS} day later at the earliest)`,
      byHolding,
    },
    lossHarvest: { show: x.lossesToUse.show, losses: x.lossesToUse.losses, taxCut: x.lossesToUse.taxCut, symbols: x.lossesToUse.symbols },
    charges: { perYear, smallOrderExcess: excess, cap, annualizationDays: elapsed },
    section156: { show: x.section156.show, stockTax: x.section156.stockTax, unusedBasicExemption: x.section156.unusedBasicExemption.show },
    advanceTax: { show: x.filing.advanceTax.applies, amount: x.filing.advanceTax.next?.amount ?? 0, date: x.filing.advanceTax.next?.date ?? null },
  }
}

function groupOrderIds(trades: TradeInfo[], row: OrderSizeRow): TradeInfo[] {
  const orders = groupOrders(trades)
  const ids = new Set(orders.filter((o) => (row.id === 'SMALL' ? o.value < SMALL_ORDER : false)).map((o) => o.orderId))
  return trades.filter((t) => ids.has(t.orderId))
}


// ----------------------------------------------------------------- mutual funds (M1–M6)

/** R25: is this lot still inside its ELSS lock-in on `day`? */
function isLocked(inst: Instrument, lot: Lot, day: Day): boolean {
  return !!inst.elss && lot.acquired !== null && day < elssUnlockFrom(lot.acquired)
}

const group = (ls: LotView[]): MfLotGroup => ({
  units: fromMilli(sum(ls.map((l) => Math.round(l.qty * 1000)))),
  value: sum(ls.map((l) => l.value)),
  gain: sum(ls.map((l) => l.gain)),
  lots: ls.length,
})

function buildMfReport(x: {
  holdings: HoldingView[]
  ledger: ReturnType<typeof buildLedger>
  instruments: Map<string, Instrument>
  input: PortfolioInput
  asOf: Day
  fy: FinancialYear
  realizedFy: RealizedSlice[]
  tradesFy: TradeInfo[]
  delta: (extra: RealizedSlice[]) => Paise
  taxOf: (realized: RealizedSlice[]) => PortfolioTax
  baseIncremental: Paise
}): MfReport {
  const funds: MfFund[] = []
  for (const h of x.holdings.filter((f) => isMfClass(f.assetClass))) {
    const inst = x.instruments.get(h.symbol)!
    const scheme: MfFund['scheme'] = inst.elss ? 'ELSS' : h.assetClass === 'EQUITY_MF' ? 'EQUITY' : 'DEBT'
    const lots = x.ledger.openLots.filter((l) => l.symbol === h.symbol)
    const views = h.lots

    // M2: largest FIFO redemption with ₹0 extra tax (whole lots first, then part of the next lot).
    const open = lots.filter((l) => !isLocked(inst, l, x.asOf))
    const sale = (l: Lot, qM = l.qtyM) =>
      hypotheticalSale({ ...l, qtyM: qM, cost: qM === l.qtyM ? l.cost : Math.round((l.cost * qM) / l.qtyM) }, inst, x.input, h.ltp, x.asOf)
    const taxFor = (k: number, partM = 0) => {
      const sl = open.slice(0, k).map((l) => sale(l))
      if (partM > 0) sl.push(sale(open[k], partM))
      return sl.length ? roundToRupee(x.delta(sl)) : 0
    }
    let k = 0
    for (let i = 1; i <= open.length; i++) if (taxFor(i) <= 0) k = i
    let partM = 0
    if (k < open.length) {
      let lo = 0
      let hi = open[k].qtyM
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (taxFor(k, mid) <= 0) lo = mid
        else hi = mid - 1
      }
      partM = lo
    }
    const freeSlices = [...open.slice(0, k).map((l) => sale(l)), ...(partM ? [sale(open[k], partM)] : [])]
    const withdrawFree = {
      units: fromMilli(sum(freeSlices.map((s) => s.qtyM))),
      value: sum(freeSlices.map((s) => s.saleValue)),
      lots: freeSlices.length,
    }

    // M3: next lots turning long-term (unlocked, not slab-only).
    const pending = views.filter((l) => !l.longTerm && !l.locked && l.longTermFrom)
    const nextDate = pending.map((l) => l.longTermFrom!).sort()[0]
    const nextLots = pending.filter((l) => l.longTermFrom === nextDate)
    const nextLongTerm = nextDate
      ? { date: nextDate, days: daysBetween(x.asOf, nextDate), value: sum(nextLots.map((l) => l.value)), units: group(nextLots).units }
      : null

    // M4: ELSS lock-in.
    let elss: MfFund['elss'] = null
    if (scheme === 'ELSS') {
      const locked = views.filter((l) => l.locked)
      const byDate = new Map<Day, LotView[]>()
      for (const l of locked) byDate.set(l.unlockFrom!, [...(byDate.get(l.unlockFrom!) ?? []), l])
      const schedule = [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, ls]) => ({ date, days: daysBetween(x.asOf, date), value: sum(ls.map((l) => l.value)), units: group(ls).units, lots: ls.length }))
      elss = { locked: group(locked), unlocked: group(views.filter((l) => !l.locked)), nextUnlock: schedule[0] ?? null, schedule }
    }

    const chips: MfChip[] = []
    if (elss && elss.unlocked.lots === 0 && elss.nextUnlock) {
      chips.push({ kind: 'LOCKED', date: elss.nextUnlock.date, days: elss.nextUnlock.days, value: elss.nextUnlock.value })
    } else {
      if (elss) chips.push({ kind: 'UNLOCKED', value: elss.unlocked.value, next: elss.nextUnlock ? { date: elss.nextUnlock.date, value: elss.nextUnlock.value } : null })
      if (withdrawFree.value > 0) chips.push({ kind: 'WITHDRAW_FREE', value: withdrawFree.value, units: withdrawFree.units })
      if (nextLongTerm) chips.push({ kind: 'NEXT_LONG_TERM', date: nextLongTerm.date, days: nextLongTerm.days, value: nextLongTerm.value })
    }
    if (scheme === 'DEBT') chips.push({ kind: 'SLAB' })

    funds.push({
      symbol: h.symbol,
      name: h.name,
      shortName: inst.shortName ?? h.name,
      scheme,
      units: h.qty,
      nav: h.ltp,
      value: h.value,
      cost: h.cost,
      gain: h.unrealized,
      longTerm: group(views.filter((l) => l.longTerm)),
      shortTerm: group(views.filter((l) => !l.longTerm)),
      nextLongTerm,
      elss,
      withdrawFree,
      taxIfRedeemAll: h.taxIfSoldToday,
      slab: scheme === 'DEBT' && views.every((l) => l.bucketToday === 'DEBT_MF'),
      chips,
    })
  }

  // M6: this year's redemptions, and which instalments they used (FIFO).
  const mfSells = x.tradesFy.filter((t) => t.trade.segment === 'MF' && t.trade.side === 'SELL')
  const redemptions: MfRedemption[] = mfSells.map((t) => {
    const slices = x.realizedFy.filter((r) => r.sellTradeId === t.trade.id)
    const without = x.realizedFy.filter((r) => r.sellTradeId !== t.trade.id)
    const inst = x.instruments.get(t.trade.symbol)!
    return {
      symbol: t.trade.symbol,
      shortName: inst.shortName ?? inst.name,
      day: t.day,
      units: t.trade.qty,
      lots: slices.length,
      longTermLots: slices.filter((s) => s.longTerm).length,
      shortTermLots: slices.filter((s) => !s.longTerm).length,
      gain: sum(slices.map((s) => s.gain)),
      tax: roundToRupee(x.baseIncremental - x.taxOf(without).incremental),
    }
  })

  const mfBuys = x.tradesFy.filter((t) => t.trade.segment === 'MF' && t.trade.side === 'BUY')
  const firstUnlock = funds
    .map((f) => f.elss?.nextUnlock)
    .filter((u): u is NonNullable<typeof u> => !!u)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const free = funds.filter((f) => f.withdrawFree.value > 0)
  return {
    show: funds.length > 0,
    funds,
    withdrawFree: sum(free.map((f) => f.withdrawFree.value)),
    withdrawFreeFunds: free.map((f) => f.shortName),
    locked: sum(funds.map((f) => f.elss?.locked.value ?? 0)),
    firstUnlock: firstUnlock ? { date: firstUnlock.date, days: firstUnlock.days, value: firstUnlock.value } : null,
    redemptions,
    charges: {
      orders: mfBuys.length + mfSells.length,
      amount: sum(mfBuys.map((t) => t.trade.amountPaise ?? t.value)),
      stamp: sum([...mfBuys, ...mfSells].map((t) => t.trade.charges.stamp)),
      brokerage: sum([...mfBuys, ...mfSells].map((t) => t.trade.charges.brokerage)),
    },
  }
}

// ----------------------------------------------------------------- sell simulator

export interface SellSimulation {
  symbol: string
  qty: number
  day: Day
  price: Paise
  proceeds: Paise
  gain: Paise
  lots: { acquired: Day | null; qty: number; gain: Paise; longTerm: boolean; longTermFrom: Day | null }[]
  /** Extra tax if sold on `day` (negative = tax saved by a loss) */
  taxOnDay: Paise
  /** First day every gain lot in this sale is long-term, if it is later than `day` */
  waitUntil: Day | null
  taxOnWaitDay: Paise | null
  saving: Paise
}

/**
 * "Simulate a sell": `qty` units of `symbol` sold on `day` (FIFO, at today's price, no sell charges),
 * compared with selling the same units on the first day they are all long-term.
 * A sale in a later financial year starts from a fresh year (nothing booked, limit reset).
 */
export function simulateSell(input: PortfolioInput, settings: Settings, req: { symbol: string; qty: number; day: Day }): SellSimulation {
  const asOf = istDay(input.asOf)
  const ledger = buildLedger(input)
  const inst = input.instruments.find((i) => i.symbol === req.symbol)
  const holding = input.holdings.find((h) => h.symbol === req.symbol)
  if (!inst || !holding) throw new Error(`No holding for ${req.symbol}`)
  const fyNow = financialYearOf(asOf)
  const baseFor = (day: Day) =>
    financialYearOf(day).label === fyNow.label
      ? {
          realized: ledger.realized.filter((r) => inFy(fyNow, r.sellDay) && r.sellDay <= asOf),
          business: ledger.business.filter((b) => inFy(fyNow, b.day) && b.day <= asOf),
          other: ledger.otherIncome.filter((o) => inFy(fyNow, o.day) && o.day <= asOf),
          settings,
        }
      : { realized: [], business: [], other: [], settings: { ...settings, otherBrokerLtcgPaise: 0 } }
  const extraTax = (slices: RealizedSlice[], day: Day) => {
    const b = baseFor(day)
    return (
      portfolioTax([...b.realized, ...slices], b.business, b.other, b.settings).incremental -
      portfolioTax(b.realized, b.business, b.other, b.settings).incremental
    )
  }

  // FIFO portions of the open lots.
  let need = Math.round(req.qty * 1000)
  const portions: Lot[] = []
  for (const lot of ledger.openLots.filter((l) => l.symbol === req.symbol)) {
    if (need <= 0) break
    const q = Math.min(need, lot.qtyM)
    portions.push({ ...lot, qtyM: q, cost: q === lot.qtyM ? lot.cost : Math.round((lot.cost * q) / lot.qtyM) })
    need -= q
  }
  if (need > 0) throw new Error(`Only ${fromMilli(sum(portions.map((p) => p.qtyM)))} units of ${req.symbol} held`)

  const lockedM = sum(portions.filter((p) => isLocked(inst, p, req.day)).map((p) => p.qtyM))
  if (lockedM > 0) {
    const dates = portions.filter((p) => isLocked(inst, p, req.day)).map((p) => elssUnlockFrom(p.acquired!)).sort()
    const [first, last] = [formatDay(dates[0]), formatDay(dates[dates.length - 1])]
    throw new Error(
      first === last
        ? `${fromMilli(lockedM)} of these units are locked in ELSS until ${first} (3-year lock-in).`
        : `${fromMilli(lockedM)} of these units are locked in ELSS (3-year lock-in): the first unlocks on ${first}, the last on ${last}.`,
    )
  }
  const at = (day: Day) => portions.map((p) => hypotheticalSale(p, inst, input, holding.ltpPaise, day))
  const onDay = at(req.day)
  const ltFrom = (p: Lot) => {
    const m = longTermMonths(inst.assetClass, p.acquired)
    return p.acquired !== null && m !== null ? longTermFrom(p.acquired, m) : null
  }
  const pending = portions
    .map((p, i) => ({ from: ltFrom(p), s: onDay[i] }))
    .filter((x) => x.s.gain > 0 && !x.s.longTerm && x.from !== null)
    .map((x) => x.from!)
    .sort()
  const waitUntil = pending.length ? pending[pending.length - 1] : null
  const taxOnDay = roundToRupee(extraTax(onDay, req.day))
  const taxOnWaitDay = waitUntil ? roundToRupee(extraTax(at(waitUntil), waitUntil)) : null
  return {
    symbol: req.symbol,
    qty: req.qty,
    day: req.day,
    price: holding.ltpPaise,
    proceeds: sum(onDay.map((s) => s.saleValue)),
    gain: sum(onDay.map((s) => s.gain)),
    lots: portions.map((p, i) => ({
      acquired: p.acquired,
      qty: fromMilli(p.qtyM),
      gain: onDay[i].gain,
      longTerm: onDay[i].longTerm,
      longTermFrom: onDay[i].longTerm ? null : ltFrom(p),
    })),
    taxOnDay,
    waitUntil,
    taxOnWaitDay,
    saving: taxOnWaitDay === null ? 0 : taxOnDay - taxOnWaitDay,
  }
}
