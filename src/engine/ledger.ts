// Rebuilds purchase lots from raw trades (R8 FIFO), applies splits/bonuses, separates
// same-day round trips as intraday (R13), matches F&O positions, and produces realized
// capital-gain slices, business (intraday / F&O) trades and open lots.
import { istDay, isLongTerm } from './dates'
import {
  EQUITY_LONG_TERM_AFTER_MONTHS,
  R5_DEBT_MF_SLAB_FROM,
  R6_LISTED_LONG_TERM_AFTER_MONTHS,
  R9_FMV_DAY,
  R9_GRANDFATHER_BOUGHT_BEFORE,
  R12_BUYBACK_AS_CAPITAL_GAIN_FROM,
  R12_BUYBACK_AS_DIVIDEND_FROM,
  UNLISTED_LONG_TERM_AFTER_MONTHS,
} from './rules'
import type { AssetClass, Charges, CorporateAction, Day, Instrument, Paise, PortfolioInput, Trade } from './types'

/** Quantities are handled as integer milli-units so MF units (3 decimals) stay exact. */
export const toMilli = (qty: number): number => Math.round(qty * 1000)
export const fromMilli = (qtyM: number): number => qtyM / 1000

export type CgBucket = 'EQ_ST' | 'EQ_LT' | 'DEBT_MF' | 'NONEQ_ST' | 'NONEQ_LT'

export interface Lot {
  symbol: string
  /** null = acquisition not explained by trade history (older than history, or moved in) */
  acquired: Day | null
  qtyM: number
  /** Actual cost incl. deductible buy charges (R23) */
  cost: Paise
  source: 'TRADE' | 'BONUS' | 'UNEXPLAINED'
  tradeId?: string
  approximate: boolean
}

export interface RealizedSlice {
  symbol: string
  assetClass: AssetClass
  sellTradeId: string
  sellDay: Day
  acquired: Day | null
  qtyM: number
  saleValue: Paise
  sellExpenses: Paise // deductible sell charges (R23)
  actualCost: Paise
  costForTax: Paise // after R22 grandfathering
  gain: Paise
  longTerm: boolean
  bucket: CgBucket
  grandfathered: boolean
  approximate: boolean
  /** R12: buyback in the dividend window, where the whole cost becomes a capital loss */
  buybackLoss?: boolean
}

export interface BusinessTrade {
  kind: 'INTRADAY' | 'FNO'
  symbol: string
  day: Day // day the position was closed
  qtyM: number
  grossPnl: Paise // before charges (used for ICAI turnover, R17)
  charges: Paise // all charges, deductible for business income
  netPnl: Paise
}

export interface OtherIncome {
  kind: 'BUYBACK_DIVIDEND' // R12
  symbol: string
  day: Day
  amount: Paise
}

export interface TradeInfo {
  trade: Trade
  day: Day
  orderId: string
  value: Paise
  charges: Paise
  /** share of this trade's quantity that was intraday (R13) */
  intradayFraction: number
  fno: boolean
}

export interface LedgerResult {
  openLots: Lot[]
  /** Units left open per symbol by the trades alone, before reconciling with holdings */
  openQtyBySymbol: Record<string, number>
  realized: RealizedSlice[]
  business: BusinessTrade[]
  otherIncome: OtherIncome[]
  trades: TradeInfo[]
  warnings: string[]
}

export const chargesTotal = (c: Charges): Paise => c.brokerage + c.stt + c.exchange + c.sebi + c.stamp + c.gst + c.dp
/** R23: everything except STT is deductible against capital gains */
export const chargesDeductibleForCg = (c: Charges): Paise => chargesTotal(c) - c.stt

export const isEquityClass = (a: AssetClass): boolean => a === 'STOCK' || a === 'EQUITY_ETF' || a === 'EQUITY_MF'

/** Months after which a lot of this class is long-term, or null if it is always slab (R5). */
export function longTermMonths(assetClass: AssetClass, acquired: Day | null): number | null {
  switch (assetClass) {
    case 'STOCK':
    case 'EQUITY_ETF':
    case 'EQUITY_MF':
      return EQUITY_LONG_TERM_AFTER_MONTHS // R1/R2
    case 'NON_EQUITY_ETF':
      return R6_LISTED_LONG_TERM_AFTER_MONTHS // R6
    case 'DEBT_MF':
      if (acquired === null || acquired >= R5_DEBT_MF_SLAB_FROM) return null // R5
      return UNLISTED_LONG_TERM_AFTER_MONTHS
    case 'NON_EQUITY_FUND':
      return UNLISTED_LONG_TERM_AFTER_MONTHS
    case 'FNO':
      return null
  }
}

/** Which capital-gains bucket a lot sold on `sold` falls in. Unknown acquisition dates are treated as long-term. */
export function classify(assetClass: AssetClass, acquired: Day | null, sold: Day): { bucket: CgBucket; longTerm: boolean } {
  const months = longTermMonths(assetClass, acquired)
  if (months === null) return { bucket: 'DEBT_MF', longTerm: false }
  const longTerm = acquired === null ? true : isLongTerm(acquired, sold, months)
  if (isEquityClass(assetClass)) return { bucket: longTerm ? 'EQ_LT' : 'EQ_ST', longTerm }
  return { bucket: longTerm ? 'NONEQ_LT' : 'NONEQ_ST', longTerm }
}

/** Hands out parts of a trade (value and charges) so the parts always add up to the whole. */
class TradeSlicer {
  remQ: number
  private remValue: Paise
  private remDeductible: Paise
  private remAll: Paise
  readonly trade: Trade
  readonly day: Day
  readonly info: TradeInfo
  constructor(info: TradeInfo) {
    this.info = info
    this.trade = info.trade
    this.day = info.day
    this.remQ = toMilli(info.trade.qty)
    this.remValue = info.value
    this.remDeductible = chargesDeductibleForCg(info.trade.charges)
    this.remAll = info.charges
  }
  take(qM: number): { value: Paise; deductible: Paise; allCharges: Paise } {
    const part = (rem: number) => (qM >= this.remQ ? rem : Math.round((rem * qM) / this.remQ))
    const out = { value: part(this.remValue), deductible: part(this.remDeductible), allCharges: part(this.remAll) }
    this.remQ -= qM
    this.remValue -= out.value
    this.remDeductible -= out.deductible
    this.remAll -= out.allCharges
    return out
  }
}

function takeFromLot(lot: Lot, qM: number): Paise {
  const cost = qM >= lot.qtyM ? lot.cost : Math.round((lot.cost * qM) / lot.qtyM)
  lot.qtyM -= qM
  lot.cost -= cost
  return cost
}

/** R22: FMV per current unit, adjusting a 31-Jan-2018 quote for later splits when needed. */
export function fmvPerUnit(inst: Instrument, actions: CorporateAction[], onDay: Day): number | null {
  if (!inst.fmv31Jan2018) return null
  if (inst.fmv31Jan2018.adjustedForLaterActions) return inst.fmv31Jan2018.pricePaise
  const factor = actions
    .filter((a) => a.symbol === inst.symbol && a.type === 'SPLIT' && a.exDay > R9_FMV_DAY && a.exDay <= onDay)
    .reduce((f, a) => (f * a.to) / a.from, 1)
  return inst.fmv31Jan2018.pricePaise / factor
}

/** R22: cost used for tax = max(actual cost, min(FMV, sale value)) for equity bought before 1 Feb 2018. */
export function grandfatheredCost(
  inst: Instrument,
  actions: CorporateAction[],
  acquired: Day | null,
  qtyM: number,
  actualCost: Paise,
  saleValue: Paise,
  saleDay: Day,
): { cost: Paise; grandfathered: boolean } {
  if (!isEquityClass(inst.assetClass) || acquired === null || acquired >= R9_GRANDFATHER_BOUGHT_BEFORE) {
    return { cost: actualCost, grandfathered: false }
  }
  const fmv = fmvPerUnit(inst, actions, saleDay)
  if (fmv === null) return { cost: actualCost, grandfathered: false }
  const fmvTotal = Math.round((fmv * qtyM) / 1000)
  const cost = Math.max(actualCost, Math.min(fmvTotal, saleValue))
  return { cost, grandfathered: cost !== actualCost }
}

export function buildLedger(input: PortfolioInput): LedgerResult {
  const instruments = new Map(input.instruments.map((i) => [i.symbol, i]))
  const inst = (symbol: string): Instrument => {
    const i = instruments.get(symbol)
    if (!i) throw new Error(`Unknown instrument ${symbol}`)
    return i
  }
  const warnings: string[] = []
  const lots = new Map<string, Lot[]>()
  const lotsOf = (s: string) => lots.get(s) ?? (lots.set(s, []), lots.get(s)!)
  const realized: RealizedSlice[] = []
  const business: BusinessTrade[] = []
  const otherIncome: OtherIncome[] = []
  const fnoOpen = new Map<string, { sign: 1 | -1; s: TradeSlicer }[]>()
  const intradayQ = new Map<string, number>() // tradeId → intraday milli-qty

  const infos: TradeInfo[] = [...input.trades]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id))
    .map((t) => ({
      trade: t,
      day: istDay(t.time),
      orderId: t.orderId ?? t.id,
      // With a reported amount (MF), a buy's value is the amount less stamp duty, so value + stamp = amount paid.
      value: t.amountPaise !== undefined ? t.amountPaise - (t.side === 'BUY' ? t.charges.stamp : 0) : Math.round(t.qty * t.pricePaise),
      charges: chargesTotal(t.charges),
      intradayFraction: 0,
      fno: t.segment === 'FO',
    }))

  const days = [...new Set([...infos.map((t) => t.day), ...input.corporateActions.map((a) => a.exDay)])].sort()

  const addLot = (s: TradeSlicer, qM: number) => {
    const part = s.take(qM)
    lotsOf(s.trade.symbol).push({
      symbol: s.trade.symbol,
      acquired: s.day,
      qtyM: qM,
      cost: part.value + part.deductible,
      source: 'TRADE',
      tradeId: s.trade.id,
      approximate: false,
    })
  }

  const sellDelivery = (s: TradeSlicer, qM: number) => {
    const i = inst(s.trade.symbol)
    const queue = lotsOf(s.trade.symbol)
    const buyback = s.trade.kind === 'BUYBACK'
    let need = qM
    while (need > 0) {
      const lot = queue[0]
      if (!lot) {
        const part = s.take(need)
        warnings.push(`${s.trade.symbol}: sold ${fromMilli(need)} units on ${s.day} with no matching buy; gain set to 0 (cost unknown).`)
        realized.push({
          symbol: s.trade.symbol,
          assetClass: i.assetClass,
          sellTradeId: s.trade.id,
          sellDay: s.day,
          acquired: null,
          qtyM: need,
          saleValue: part.value,
          sellExpenses: part.deductible,
          actualCost: part.value - part.deductible,
          costForTax: part.value - part.deductible,
          gain: 0,
          ...classify(i.assetClass, null, s.day),
          grandfathered: false,
          approximate: true,
        })
        break
      }
      const q = Math.min(need, lot.qtyM)
      const part = s.take(q)
      const actualCost = takeFromLot(lot, q)
      const cls = classify(i.assetClass, lot.acquired, s.day)
      if (buyback && s.day >= R12_BUYBACK_AS_DIVIDEND_FROM && s.day < R12_BUYBACK_AS_CAPITAL_GAIN_FROM) {
        // R12 (1 Oct 2024 – 31 Mar 2026): proceeds are dividend, the cost becomes a capital loss.
        otherIncome.push({ kind: 'BUYBACK_DIVIDEND', symbol: s.trade.symbol, day: s.day, amount: part.value })
        realized.push({
          symbol: s.trade.symbol,
          assetClass: i.assetClass,
          sellTradeId: s.trade.id,
          sellDay: s.day,
          acquired: lot.acquired,
          qtyM: q,
          saleValue: 0,
          sellExpenses: 0,
          actualCost,
          costForTax: actualCost,
          gain: -actualCost,
          ...cls,
          grandfathered: false,
          approximate: lot.approximate,
          buybackLoss: true,
        })
      } else if (buyback && s.day < R12_BUYBACK_AS_DIVIDEND_FROM) {
        warnings.push(`${s.trade.symbol}: buyback on ${s.day} was taxed in the company's hands (before 1 Oct 2024); ignored.`)
      } else {
        const gf = grandfatheredCost(i, input.corporateActions, lot.acquired, q, actualCost, part.value, s.day)
        realized.push({
          symbol: s.trade.symbol,
          assetClass: i.assetClass,
          sellTradeId: s.trade.id,
          sellDay: s.day,
          acquired: lot.acquired,
          qtyM: q,
          saleValue: part.value,
          sellExpenses: part.deductible,
          actualCost,
          costForTax: gf.cost,
          gain: part.value - part.deductible - gf.cost,
          ...cls,
          grandfathered: gf.grandfathered,
          approximate: lot.approximate,
        })
      }
      if (lot.qtyM === 0) queue.shift()
      need -= q
    }
  }

  const applyAction = (a: CorporateAction) => {
    const queue = lotsOf(a.symbol)
    if (a.type === 'SPLIT') {
      // Same lots, same dates and total cost; more units.
      for (const lot of queue) lot.qtyM = Math.round((lot.qtyM * a.to) / a.from)
    } else {
      // Bonus shares are a new lot: cost nil, acquired on the allotment (ex) date.
      const held = queue.reduce((n, l) => n + l.qtyM, 0)
      const bonusUnits = Math.floor((fromMilli(held) * a.to) / a.from)
      if (bonusUnits > 0) {
        queue.push({ symbol: a.symbol, acquired: a.exDay, qtyM: bonusUnits * 1000, cost: 0, source: 'BONUS', approximate: false })
      }
    }
  }

  for (const day of days) {
    for (const a of input.corporateActions.filter((x) => x.exDay === day)) applyAction(a)
    const todays = infos.filter((t) => t.day === day)

    // F&O: FIFO position matching per contract; a closing trade realizes business P&L.
    for (const info of todays.filter((t) => t.fno)) {
      const s = new TradeSlicer(info)
      const sign: 1 | -1 = info.trade.side === 'BUY' ? 1 : -1
      const q = fnoOpen.get(info.trade.symbol) ?? []
      fnoOpen.set(info.trade.symbol, q)
      while (s.remQ > 0 && q.length > 0 && q[0].sign !== sign) {
        const open = q[0]
        const m = Math.min(open.s.remQ, s.remQ)
        const a = open.s.take(m)
        const b = s.take(m)
        const [buy, sell] = sign === 1 ? [b, a] : [a, b]
        const gross = sell.value - buy.value
        const charges = a.allCharges + b.allCharges
        business.push({ kind: 'FNO', symbol: info.trade.symbol, day, qtyM: m, grossPnl: gross, charges, netPnl: gross - charges })
        if (open.s.remQ === 0) q.shift()
      }
      if (s.remQ > 0) q.push({ sign, s })
    }

    // Delivery segments (EQ, MF), grouped by symbol.
    const symbols = [...new Set(todays.filter((t) => !t.fno).map((t) => t.trade.symbol))]
    for (const symbol of symbols) {
      const ts = todays.filter((t) => !t.fno && t.trade.symbol === symbol)
      const buys = ts.filter((t) => t.trade.side === 'BUY').map((t) => new TradeSlicer(t))
      const sells = ts.filter((t) => t.trade.side === 'SELL').map((t) => new TradeSlicer(t))

      // R13: same-day buy + sell of the same stock is intraday (not for MF units or buybacks).
      if (ts[0].trade.segment === 'EQ') {
        const bq = buys.filter((b) => b.trade.kind !== 'BUYBACK')
        const sq = sells.filter((x) => x.trade.kind !== 'BUYBACK')
        let bi = 0
        let si = 0
        while (bi < bq.length && si < sq.length) {
          const b = bq[bi]
          const x = sq[si]
          const m = Math.min(b.remQ, x.remQ)
          const bp = b.take(m)
          const sp = x.take(m)
          intradayQ.set(b.trade.id, (intradayQ.get(b.trade.id) ?? 0) + m)
          intradayQ.set(x.trade.id, (intradayQ.get(x.trade.id) ?? 0) + m)
          const gross = sp.value - bp.value
          const charges = bp.allCharges + sp.allCharges
          business.push({ kind: 'INTRADAY', symbol, day, qtyM: m, grossPnl: gross, charges, netPnl: gross - charges })
          if (b.remQ === 0) bi++
          if (x.remQ === 0) si++
        }
      }
      // Remaining buys become lots before remaining sells consume the queue (FIFO, R8).
      for (const b of buys) if (b.remQ > 0) addLot(b, b.remQ)
      for (const x of sells) if (x.remQ > 0) sellDelivery(x, x.remQ)
    }
  }

  for (const info of infos) {
    const q = intradayQ.get(info.trade.id)
    if (q) info.intradayFraction = q / toMilli(info.trade.qty)
  }

  // Reconcile with the broker's holdings snapshot.
  const openQtyBySymbol: Record<string, number> = {}
  for (const [symbol, queue] of lots) {
    const q = queue.reduce((n, l) => n + l.qtyM, 0)
    if (q > 0) openQtyBySymbol[symbol] = fromMilli(q)
  }
  const openLots: Lot[] = []
  const seen = new Set<string>()
  for (const h of input.holdings) {
    seen.add(h.symbol)
    const queue = lotsOf(h.symbol).filter((l) => l.qtyM > 0)
    const derived = queue.reduce((n, l) => n + l.qtyM, 0)
    const actual = toMilli(h.qty)
    if (actual > derived) {
      const q = actual - derived
      warnings.push(`${h.symbol}: ${fromMilli(q)} units not explained by trade history; cost taken from the broker's average price (approximate), treated as long-term.`)
      queue.unshift({ symbol: h.symbol, acquired: null, qtyM: q, cost: Math.round((h.avgPricePaise * q) / 1000), source: 'UNEXPLAINED', approximate: true })
    } else if (actual < derived) {
      let extra = derived - actual
      warnings.push(`${h.symbol}: trades show ${fromMilli(derived)} units but holdings show ${fromMilli(actual)}; oldest lots trimmed.`)
      while (extra > 0 && queue.length) {
        const q = Math.min(extra, queue[0].qtyM)
        takeFromLot(queue[0], q)
        if (queue[0].qtyM === 0) queue.shift()
        extra -= q
      }
    }
    openLots.push(...queue)
  }
  for (const [symbol, queue] of lots) {
    if (!seen.has(symbol) && queue.some((l) => l.qtyM > 0)) {
      warnings.push(`${symbol}: trades leave ${fromMilli(queue.reduce((n, l) => n + l.qtyM, 0))} units open but it is not in holdings; ignored.`)
    }
  }

  return { openLots, openQtyBySymbol, realized, business, otherIncome, trades: infos, warnings }
}
