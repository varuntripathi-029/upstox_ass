// The demo's working state: a persona, the user's trade edits, and "today's date".
// Pure functions: they build the ONE engine input shape from that state. Nothing here stores data.
import { buildLedger } from '@/engine/ledger'
import { addDays, istDay } from '@/engine/dates'
import type { Day, HoldingSnapshot, PortfolioInput, Settings, Trade } from '@/engine/types'
import { personaById, type Persona } from '@/sample/personas'

export interface DemoEdits {
  /** Trades added in the trade editor */
  added: Trade[]
  /** Persona trades removed in the trade editor */
  removedIds: string[]
}

/**
 * Whether the viewer is actually thinking about selling. "exploring" is the default and keeps every
 * screen informational; "considering" unlocks timing and limit planning (PRODUCT.md §5.1).
 */
export type Intent = 'exploring' | 'considering'

export interface DemoState {
  personaId: Persona['id']
  edits: DemoEdits
  /** Engine reference date; defaults to the persona's snapshot date */
  today: Day
  settings: Settings
}

export const NO_EDITS: DemoEdits = { added: [], removedIds: [] }

export function initialState(personaId: Persona['id']): DemoState {
  const p = personaById(personaId)
  return { personaId: p.id, edits: NO_EDITS, today: istDay(p.portfolio.asOf), settings: p.settings }
}

/** The date range the "Today's date" control allows: the snapshot date to the end of that financial year. */
export function todayRange(p: Persona): { min: Day; max: Day } {
  const min = istDay(p.portfolio.asOf)
  const y = Number(min.slice(0, 4)) + (Number(min.slice(5, 7)) >= 4 ? 1 : 0)
  return { min, max: `${y}-03-31` }
}

/**
 * Persona + edits + today → PortfolioInput.
 * - Trades after `today` are left out.
 * - Holdings are rebuilt from the trades, so edits show up in the Holdings view.
 *   Prices stay at the persona's snapshot (the last trade price for symbols it does not hold).
 */
export function buildInput(state: DemoState): PortfolioInput {
  const p = personaById(state.personaId)
  const removed = new Set(state.edits.removedIds)
  const trades = [...p.portfolio.trades.filter((t) => !removed.has(t.id)), ...state.edits.added].filter((t) => istDay(t.time) <= state.today)
  const draft: PortfolioInput = { ...p.portfolio, asOf: `${state.today}T18:00:00+05:30`, trades, holdings: [] }
  const open = buildLedger(draft).openQtyBySymbol
  const price = (symbol: string): number => {
    const h = p.portfolio.holdings.find((x) => x.symbol === symbol)
    if (h) return h.ltpPaise
    const last = [...trades].reverse().find((t) => t.symbol === symbol)
    return last?.pricePaise ?? 0
  }
  const holdings: HoldingSnapshot[] = Object.entries(open)
    .filter(([symbol]) => p.portfolio.instruments.find((i) => i.symbol === symbol)?.assetClass !== 'FNO')
    .map(([symbol, qty]) => {
      const original = p.portfolio.holdings.find((h) => h.symbol === symbol)
      return { symbol, qty, avgPricePaise: original?.avgPricePaise ?? price(symbol), ltpPaise: price(symbol) }
    })
    .sort((a, b) => order(p, a.symbol) - order(p, b.symbol))
  return { ...draft, holdings }
}

const order = (p: Persona, symbol: string) => {
  const i = p.portfolio.holdings.findIndex((h) => h.symbol === symbol)
  return i === -1 ? 1000 : i
}

let seq = 0
/** A trade added in the editor, with charges on the same ₹20/order tariff as the personas. */
export function editorTrade(t: { symbol: string; day: Day; side: 'BUY' | 'SELL'; qty: number; pricePaise: number }): Trade {
  const v = Math.round(t.qty * t.pricePaise)
  const r = Math.round
  const brokerage = 2000
  const exchange = r(v * 0.0000297)
  const sebi = r(v * 0.000001)
  const dp = t.side === 'SELL' ? 1850 : 0
  return {
    id: `edit-${Date.now().toString(36)}-${++seq}`,
    symbol: t.symbol,
    segment: 'EQ',
    time: `${t.day}T${t.side === 'BUY' ? '10:00:00' : '14:00:00'}+05:30`,
    side: t.side,
    qty: t.qty,
    pricePaise: t.pricePaise,
    charges: {
      brokerage,
      stt: r(v * 0.001),
      exchange,
      sebi,
      stamp: t.side === 'BUY' ? r(v * 0.00015) : 0,
      gst: r(0.18 * (brokerage + exchange + sebi + dp)),
      dp,
    },
  }
}

/** Units of `symbol` held on `day` according to the current input (for validating editor sells). */
export function heldOn(input: PortfolioInput, symbol: string, day: Day): number {
  const trades = input.trades.filter((t) => istDay(t.time) <= day)
  return buildLedger({ ...input, trades, holdings: [] }).openQtyBySymbol[symbol] ?? 0
}

export const nextDay = (d: Day) => addDays(d, 1)
