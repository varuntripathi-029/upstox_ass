// Maps Upstox responses into the engine's ONE input shape (PortfolioInput).
// The same code runs for recorded responses and for live ones: only the fetching differs.
import { mfStampDuty } from '@/engine/mf'
import type { AssetClass, Charges, HoldingSnapshot, Instrument, PortfolioInput, Trade } from '@/engine/types'
import type { MfNav } from './filter'
import type {
  UpstoxHistoricalTrade,
  UpstoxHistoricalTradesResponse,
  UpstoxHoldingsResponse,
  UpstoxMfHoldingsResponse,
  UpstoxPnlResponse,
  UpstoxTradeChargesResponse,
} from './types'

const NO_CHARGES: Charges = { brokerage: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, gst: 0, dp: 0 }
const paise = (rupees: number) => Math.round(rupees * 100)

/**
 * MF units: Trade History reports `quantity` as an integer (docs example: quantity 13, amount 999.9852,
 * price 71.9 = 13.908 units), so the real unit count is amount ÷ price, to 3 decimals.
 */
export const mfUnitsFromTrade = (t: Pick<UpstoxHistoricalTrade, 'amount' | 'price'>): number => Math.round((t.amount / t.price) * 1000) / 1000

/** Splits `total` across `weights` as integers that still add up to `total` (largest remainder). */
export function spread(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || total === 0) return weights.map(() => 0)
  const raw = weights.map((w) => (total * w) / sum)
  const out = raw.map((x) => Math.floor(x))
  let rest = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k].i]++
  return out
}

/**
 * Upstox reports charges per segment and financial year (`/v2/trade/profit-loss/charges`), not per trade,
 * so the aggregate is allocated over the segment's trades by its natural driver:
 * brokerage per order, STT and exchange/SEBI fees by trade value, stamp duty over buys, DP over sells,
 * and GST over the components it applies to. Marked approximate in the UI.
 */
export function allocateCharges(breakdown: UpstoxTradeChargesResponse['data']['charges_breakdown'], trades: UpstoxHistoricalTrade[]): Charges[] {
  const values = trades.map((t) => paise(t.amount))
  const ones = trades.map(() => 1)
  const buys = trades.map((t) => (t.transaction_type === 'BUY' ? paise(t.amount) : 0))
  const sells = trades.map((t) => (t.transaction_type === 'SELL' ? 1 : 0))
  const other = breakdown.charges
  const exchangeTotal = paise((other.transaction ?? 0) + (other.clearing ?? 0) + (other.ipft ?? 0) + (other.others ?? 0))

  const brokerage = spread(paise(breakdown.brokerage), ones)
  const stt = spread(paise(breakdown.taxes.stt), values)
  const stamp = spread(paise(breakdown.taxes.stamp_duty), buys)
  const exchange = spread(exchangeTotal, values)
  const sebi = spread(paise(other.sebi_turnover ?? 0), values)
  const dp = spread(paise(other.demat_transaction ?? 0), sells)
  // GST applies to brokerage + transaction + SEBI + DP: allocate it over those, per trade.
  const gstBase = trades.map((_, i) => brokerage[i] + exchange[i] + sebi[i] + dp[i])
  const gst = spread(paise(breakdown.taxes.gst), gstBase)
  return trades.map((_, i) => ({ brokerage: brokerage[i], stt: stt[i], exchange: exchange[i], sebi: sebi[i], stamp: stamp[i], gst: gst[i], dp: dp[i] }))
}

const assetClassFor = (isin: string, schemeType?: string): AssetClass => {
  if (schemeType) return schemeType === 'DEBT' ? 'DEBT_MF' : 'EQUITY_MF'
  // ETF ISINs start with INF (TECH.md §3); plain equity ISINs start with INE.
  return isin.startsWith('INF') ? 'EQUITY_ETF' : 'STOCK'
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()

export interface AccountResponses {
  asOf: string
  holdings: UpstoxHoldingsResponse
  mfHoldings: UpstoxMfHoldingsResponse
  trades: UpstoxHistoricalTradesResponse
  mfTrades: UpstoxHistoricalTradesResponse
  /** One charges response per financial year ("2627"), as the API returns them */
  charges: Record<string, UpstoxTradeChargesResponse>
  /** Live NAVs from the MF instrument file, when available */
  mfNavs?: MfNav[]
}

/** Financial year label Upstox uses for a trade date: 2026-05-20 → "2627". */
export function financialYearOfTrade(day: string): string {
  const y = Number(day.slice(0, 4))
  const start = Number(day.slice(5, 7)) >= 4 ? y : y - 1
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`
}

/** Recorded (or live) Upstox responses → the engine's input shape. */
export function mapAccount(r: AccountResponses): PortfolioInput {
  const eqTrades = r.trades.data
  // Charges come per segment and financial year, so allocate each year's aggregate over that year's trades.
  const eqCharges = new Map<UpstoxHistoricalTrade, Charges>()
  for (const [fy, res] of Object.entries(r.charges)) {
    const inFy = eqTrades.filter((t) => financialYearOfTrade(t.trade_date) === fy)
    allocateCharges(res.data.charges_breakdown, inFy).forEach((c, i) => eqCharges.set(inFy[i], c))
  }
  const navBy = new Map((r.mfNavs ?? []).map((n) => [n.isin, n]))

  const instruments = new Map<string, Instrument>()
  const addInstrument = (symbol: string, i: Instrument) => {
    if (!instruments.has(symbol)) instruments.set(symbol, i)
  }

  const trades: Trade[] = []
  eqTrades.forEach((t, i) => {
    const symbol = t.symbol || t.scrip_name
    addInstrument(symbol, { symbol, name: titleCase(t.scrip_name), isin: t.isin, assetClass: assetClassFor(t.isin) })
    trades.push({
      id: t.trade_id || `${t.instrument_token}-${t.trade_date}-${i}`,
      symbol,
      segment: 'EQ',
      time: `${t.trade_date}T10:00:00+05:30`,
      side: t.transaction_type,
      qty: t.quantity,
      pricePaise: paise(t.price),
      charges: eqCharges.get(t) ?? NO_CHARGES,
    })
  })

  r.mfTrades.data.forEach((t, i) => {
    const nav = navBy.get(t.isin)
    addInstrument(t.isin, {
      symbol: t.isin,
      name: titleCase(nav?.name ?? t.scrip_name),
      shortName: titleCase((nav?.name ?? t.scrip_name).split(/ - | direct| fund/i)[0]),
      isin: t.isin,
      assetClass: assetClassFor(t.isin, nav?.schemeType ?? 'EQUITY'),
      ...(nav?.schemeType === 'ELSS' ? { elss: true } : {}),
    })
    const amount = paise(t.amount)
    trades.push({
      id: t.trade_id || `mf-${t.isin}-${t.trade_date}-${i}`,
      symbol: t.isin,
      segment: 'MF',
      time: `${t.trade_date}T15:00:00+05:30`,
      side: t.transaction_type,
      qty: mfUnitsFromTrade(t),
      pricePaise: t.price * 100,
      amountPaise: amount,
      // Upstox doesn't report per-trade MF charges; stamp duty follows R24 (0.005% of a purchase).
      charges: t.transaction_type === 'BUY' ? { ...NO_CHARGES, stamp: mfStampDuty(amount) } : NO_CHARGES,
    })
  })

  const holdings: HoldingSnapshot[] = [
    ...r.holdings.data.map((h) => {
      const symbol = h.trading_symbol || h.tradingsymbol || h.isin
      addInstrument(symbol, { symbol, name: titleCase(h.company_name), isin: h.isin, assetClass: assetClassFor(h.isin) })
      return { symbol, qty: h.quantity, avgPricePaise: paise(h.average_price), ltpPaise: paise(h.last_price) }
    }),
    ...r.mfHoldings.data.map((h) => {
      const nav = navBy.get(h.instrument_key)
      addInstrument(h.instrument_key, {
        symbol: h.instrument_key,
        name: titleCase(nav?.name ?? h.fund),
        shortName: titleCase((nav?.name ?? h.fund).split(/ - | direct| fund/i)[0]),
        isin: h.instrument_key,
        assetClass: assetClassFor(h.instrument_key, nav?.schemeType ?? 'EQUITY'),
        ...(nav?.schemeType === 'ELSS' ? { elss: true } : {}),
      })
      return { symbol: h.instrument_key, qty: h.quantity, avgPricePaise: paise(h.average_price), ltpPaise: nav?.navPaise ?? paise(h.last_price) }
    }),
  ]

  const days = trades.map((t) => t.time.slice(0, 10)).sort()
  return {
    source: 'live',
    asOf: r.asOf,
    tradeHistoryFrom: days[0] ?? r.asOf.slice(0, 10),
    instruments: [...instruments.values()],
    corporateActions: [],
    holdings,
    trades: trades.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)),
  }
}

/** The P&L report's realized totals, for cross-checking the engine (dd-mm-yyyy dates). */
export function pnlRealized(p: UpstoxPnlResponse): { buy: number; sell: number; gain: number } {
  const buy = p.data.reduce((a, r) => a + paise(r.buy_amount), 0)
  const sell = p.data.reduce((a, r) => a + paise(r.sell_amount), 0)
  return { buy, sell, gain: sell - buy }
}
