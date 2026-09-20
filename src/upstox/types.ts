// Upstox response shapes, exactly as documented (verified against the docs, Sep 2026).
// Docs index: https://upstox.com/developer/api-documentation/llms.txt

/** Row of https://assets.upstox.com/market-quote/instruments/exchange/mf-instruments.json.gz (no token) */
export interface UpstoxMfInstrument {
  instrument_key: string // the scheme ISIN, e.g. "INF879O01027"
  name: string
  scheme_type: 'EQUITY' | 'ELSS' | 'DEBT' | 'FOF' | string
  plan?: string
  last_price: number // current NAV
  settlement_type?: string
  purchase_allowed?: boolean
  redemption_allowed?: boolean
}

/** Row of https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz (no token) */
export interface UpstoxNseInstrument {
  segment: string // "NSE_EQ"
  name: string
  exchange: string
  isin: string
  instrument_type: string
  instrument_key: string // "NSE_EQ|INE009A01021"
  trading_symbol: string
  short_name?: string
  tick_size: number
  lot_size: number
}

/** GET /v3/market-quote/ltp */
export interface UpstoxLtpResponse {
  status: string
  data: Record<string, { last_price: number; instrument_token: string; ltq?: number; volume?: number; cp?: number }>
}

/** GET /v2/charges/brokerage */
export interface UpstoxBrokerageResponse {
  status: string
  data: {
    charges: {
      total: number
      brokerage: number
      taxes: { gst: number; stt: number; stamp_duty: number }
      other_charges: { transaction: number; clearing: number; ipft: number; sebi_turnover: number }
      dp_plan?: { name: string; min_expense: number }
    }
  }
}

/** GET /v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date} */
export interface UpstoxCandleResponse {
  status: string
  /** [timestamp, open, high, low, close, volume, open interest] */
  data: { candles: [string, number, number, number, number, number, number][] }
}

/** GET /v2/fundamentals/{isin}/corporate-actions */
export interface UpstoxCorporateActionsResponse {
  status: string
  data: { name: string; expiry_date: string; amount: number | null; ratio: string | null; event_details: { name: string; value: string }[] }[]
}

/** GET /v2/portfolio/long-term-holdings */
export interface UpstoxHoldingsResponse {
  status: string
  data: {
    isin: string
    company_name: string
    quantity: number
    trading_symbol: string
    tradingsymbol?: string
    last_price: number
    close_price?: number
    pnl?: number
    average_price: number
    instrument_token: string
    exchange: string
    product?: string
    t1_quantity?: number
  }[]
}

/** GET /v2/mf/holdings */
export interface UpstoxMfHoldingsResponse {
  status: string
  data: {
    instrument_key: string // ISIN
    folio: string
    fund: string
    pnl: number
    quantity: number
    average_price: number
    last_price: number
    last_price_date: string
    pledged_quantity?: number
  }[]
}

/** GET /v2/charges/historical-trades (segment EQ | FO | COM | CD | MF) */
export interface UpstoxHistoricalTrade {
  exchange: string
  segment: 'EQ' | 'FO' | 'COM' | 'CD' | 'MF'
  option_type?: string
  /** MF: an INTEGER; the real unit count is amount ÷ price */
  quantity: number
  amount: number
  trade_id: string
  trade_date: string // YYYY-MM-DD
  transaction_type: 'BUY' | 'SELL'
  scrip_name: string
  strike_price?: string
  expiry?: string
  price: number
  isin: string
  symbol?: string
  instrument_token: string
}
export interface UpstoxHistoricalTradesResponse {
  status: string
  data: UpstoxHistoricalTrade[]
  errors?: unknown
  meta_data?: { page: { page_number: number; page_size: number; total_records: number; total_pages: number } }
}

/** GET /v2/trade/profit-loss/charges (aggregate for a segment + financial year, NOT per trade) */
export interface UpstoxTradeChargesResponse {
  status: string
  data: {
    charges_breakdown: {
      total: number
      brokerage: number
      taxes: { gst: number; stt: number; stamp_duty: number }
      charges: { transaction: number; clearing: number; ipft: number | null; others: number; sebi_turnover: number; demat_transaction: number }
    }
  }
}

/** GET /v2/trade/profit-loss/data */
export interface UpstoxPnlResponse {
  status: string
  data: {
    quantity: number
    isin: string
    scrip_name: string
    trade_type: string
    buy_date: string // dd-mm-yyyy
    buy_average: number
    sell_date: string // dd-mm-yyyy
    sell_average: number
    buy_amount: number
    sell_amount: number
  }[]
  metadata?: { page: { page_number: number; page_size: number } }
}

/** GET /v2/mf/sips */
export interface UpstoxMfSipsResponse {
  status: string
  data: {
    instrument_key: string
    fund: string
    status: string
    created: string
    frequency: string
    sip_id: string
    transaction_type: string
    next_instalment: string
    instalment_amount: number
    last_instalment: string
    instalment_day: number
    completed_instalments: number
    pending_instalments: number
  }[]
  meta_data?: unknown
}

/** GET /v2/mf/orders */
export interface UpstoxMfOrdersResponse {
  status: string
  data: {
    instrument_key: string
    fund?: string
    order_id: string
    status: string
    transaction_type: 'BUY' | 'SELL'
    amount: number
    quantity?: number
    order_timestamp: string
    nav?: number
  }[]
}
