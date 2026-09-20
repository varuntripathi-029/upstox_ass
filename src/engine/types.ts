// The ONE input shape the engine accepts. Sample data (src/sample) and live
// Upstox data (stage 3, mapped in /api) must both produce a PortfolioInput.
//
// Conventions
// - Money is integer paise. Per-unit prices may be fractional paise (MF NAVs
//   have 4 decimals); every money *amount* the engine produces is an integer.
// - Timestamps are ISO-8601 strings with an offset ("2026-04-06T10:15:00+05:30").
//   Plain days are "YYYY-MM-DD" in Asia/Kolkata.

export type Paise = number
export type Day = string // YYYY-MM-DD, Asia/Kolkata

export type AssetClass =
  | 'STOCK' // listed equity share
  | 'EQUITY_ETF' // e.g. NIFTYBEES
  | 'EQUITY_MF' // equity-oriented mutual fund (scheme_type EQUITY / ELSS)
  | 'DEBT_MF' // >65% debt (scheme_type DEBT)
  | 'NON_EQUITY_ETF' // listed gold / international / other non-equity ETF
  | 'NON_EQUITY_FUND' // unlisted gold / international / other non-equity fund
  | 'FNO' // futures & options contract

export type Segment = 'EQ' | 'MF' | 'FO'

export interface Instrument {
  symbol: string // key used by trades, holdings and corporate actions
  name: string
  isin?: string
  assetClass: AssetClass
  /** F&O only */
  derivative?: 'FUT' | 'OPT'
  /** R25: ELSS fund (equity-oriented, each purchase locked for 3 years) */
  elss?: boolean
  /** Short display name, e.g. "Parag Parikh" (mutual funds) */
  shortName?: string
  /**
   * R22: highest price quoted on 31 Jan 2018 (or NAV for MF), per unit, as
   * quoted that day. Only needed if a lot was bought before 1 Feb 2018.
   */
  fmv31Jan2018?: {
    pricePaise: number
    /** true if the price is already adjusted for later splits (Upstox: unconfirmed, see PRODUCT.md §12) */
    adjustedForLaterActions: boolean
  }
}

export interface Charges {
  brokerage: Paise
  stt: Paise
  exchange: Paise // exchange transaction charges
  sebi: Paise
  stamp: Paise
  gst: Paise
  dp: Paise
}

export interface Trade {
  id: string
  /** Fills of one order share an orderId. Defaults to id. */
  orderId?: string
  symbol: string
  segment: Segment
  time: string // ISO with offset
  side: 'BUY' | 'SELL'
  qty: number // units (MF units may have 3 decimals)
  pricePaise: number // per unit
  charges: Charges
  /** R12: a sale into a company buyback. Defaults to a normal trade. */
  kind?: 'TRADE' | 'BUYBACK'
  /**
   * Money actually paid (buy) or received (sell), when the broker reports it (mutual funds).
   * For an MF purchase it includes stamp duty, so the lot's cost is the full amount paid (R23, R24).
   * Live data: Upstox Trade History reports MF quantity as an integer; units = amount ÷ price.
   */
  amountPaise?: number
}

export interface CorporateAction {
  symbol: string
  exDay: Day
  type: 'SPLIT' | 'BONUS'
  /**
   * SPLIT: `from` old shares become `to` new shares (1:5 → from 1, to 5).
   * BONUS: `to` bonus shares for every `from` held (1:1 → from 1, to 1).
   */
  from: number
  to: number
}

/** Broker's current holdings snapshot (Upstox Get Holdings / MF Holdings). */
export interface HoldingSnapshot {
  symbol: string
  qty: number
  avgPricePaise: number // broker's average price, used only for qty not explained by trades
  ltpPaise: number // current price
}

export interface PortfolioInput {
  source: 'sample' | 'live'
  asOf: string // ISO timestamp of the snapshot
  /** First day covered by `trades` (Upstox: 3 financial years). */
  tradeHistoryFrom: Day
  instruments: Instrument[]
  trades: Trade[]
  corporateActions: CorporateAction[]
  holdings: HoldingSnapshot[]
}

/** The settings bar (PRODUCT.md §6). */
export interface Settings {
  /** Only the new regime is encoded (R18). */
  regime: 'new'
  /** Other taxable income (salary etc.), gross, paise */
  otherIncomePaise: Paise
  /** Apply the ₹75,000 standard deduction (R18) to other income */
  otherIncomeIsSalary: boolean
  /** Long-term equity gains booked with other brokers this FY (shares the ₹1.25L limit) */
  otherBrokerLtcgPaise: Paise
}
