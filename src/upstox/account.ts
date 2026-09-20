// "Demo account": recorded Upstox responses → the engine's input, through the same mapping a live call uses.
// There is no login in this project (PRODUCT.md §11): personal Upstox apps only allow the owner's account,
// and the owner has no active demat account, so these account APIs would return nothing.
import type { Settings } from '@/engine/types'
import type { MfNav } from './filter'
import { mapAccount, pnlRealized, type AccountResponses } from './map'
import type {
  UpstoxHistoricalTradesResponse,
  UpstoxHoldingsResponse,
  UpstoxMfHoldingsResponse,
  UpstoxMfSipsResponse,
  UpstoxPnlResponse,
  UpstoxTradeChargesResponse,
} from './types'
import holdings from './recorded/holdings.json'
import mfHoldings from './recorded/mf-holdings.json'
import tradesEq from './recorded/historical-trades-eq.json'
import tradesMf from './recorded/historical-trades-mf.json'
import charges2425 from './recorded/trade-charges-2425.json'
import charges2526 from './recorded/trade-charges-2526.json'
import charges2627 from './recorded/trade-charges-2627.json'
import pnl2627 from './recorded/pnl-2627.json'
import sips from './recorded/mf-sips.json'

export const RECORDED_AS_OF = '2026-09-18T18:00:00+05:30'

/** The recorded responses, keyed the way the endpoints return them. */
export function recordedResponses(mfNavs?: MfNav[]): AccountResponses {
  return {
    asOf: RECORDED_AS_OF,
    holdings: holdings as UpstoxHoldingsResponse,
    mfHoldings: mfHoldings as UpstoxMfHoldingsResponse,
    trades: tradesEq as UpstoxHistoricalTradesResponse,
    mfTrades: tradesMf as UpstoxHistoricalTradesResponse,
    charges: {
      '2425': charges2425 as UpstoxTradeChargesResponse,
      '2526': charges2526 as UpstoxTradeChargesResponse,
      '2627': charges2627 as UpstoxTradeChargesResponse,
    },
    mfNavs,
  }
}

export const recordedPnl = pnl2627 as UpstoxPnlResponse
export const recordedSips = sips as UpstoxMfSipsResponse
/** The P&L report's own realized total, used to cross-check the engine. */
export const recordedPnlRealized = () => pnlRealized(recordedPnl)

export const recordedInput = (mfNavs?: MfNav[]) => mapAccount(recordedResponses(mfNavs))

/** Salary for the demo account (the API never reports income: it's a settings-bar input, §6). */
export const RECORDED_SETTINGS: Settings = {
  regime: 'new',
  otherIncomePaise: 11_00_000_00,
  otherIncomeIsSalary: true,
  otherBrokerLtcgPaise: 0,
}

export const RECORDED_ENDPOINTS = [
  'GET /v2/portfolio/long-term-holdings',
  'GET /v2/mf/holdings',
  'GET /v2/charges/historical-trades (EQ and MF)',
  'GET /v2/trade/profit-loss/charges (per financial year)',
  'GET /v2/trade/profit-loss/data',
  'GET /v2/mf/sips',
] as const
