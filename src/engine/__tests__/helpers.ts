import type { AssetClass, Charges, CorporateAction, HoldingSnapshot, Instrument, PortfolioInput, Settings, Trade } from '../types'

export const NO_CHARGES: Charges = { brokerage: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, gst: 0, dp: 0 }

/** ₹ → paise */
export const rs = (x: number) => Math.round(x * 100)

let n = 0
export function trade(
  symbol: string,
  day: string,
  side: 'BUY' | 'SELL',
  qty: number,
  priceRupees: number,
  opts: Partial<Omit<Trade, 'symbol' | 'side' | 'qty'>> & { at?: string } = {},
): Trade {
  const { at, ...rest } = opts
  return {
    id: `t${++n}`,
    symbol,
    segment: 'EQ',
    time: `${day}T${at ?? (side === 'BUY' ? '10:00:00' : '14:00:00')}+05:30`,
    side,
    qty,
    pricePaise: rs(priceRupees),
    charges: NO_CHARGES,
    ...rest,
  }
}

export function portfolio(p: {
  trades: Trade[]
  holdings?: HoldingSnapshot[]
  instruments?: Partial<Record<string, AssetClass | Partial<Instrument>>>
  corporateActions?: CorporateAction[]
  asOf?: string
}): PortfolioInput {
  const symbols = [...new Set([...p.trades.map((t) => t.symbol), ...(p.holdings ?? []).map((h) => h.symbol)])]
  return {
    source: 'sample',
    asOf: p.asOf ?? '2026-09-18T18:00:00+05:30',
    tradeHistoryFrom: '2015-04-01',
    instruments: symbols.map((symbol) => {
      const spec = p.instruments?.[symbol]
      const extra = typeof spec === 'string' ? { assetClass: spec } : (spec ?? {})
      return { symbol, name: symbol, assetClass: 'STOCK' as AssetClass, ...extra }
    }),
    trades: p.trades,
    corporateActions: p.corporateActions ?? [],
    holdings: p.holdings ?? [],
  }
}

export const salaried = (grossRupees: number, extra: Partial<Settings> = {}): Settings => ({
  regime: 'new',
  otherIncomePaise: rs(grossRupees),
  otherIncomeIsSalary: true,
  otherBrokerLtcgPaise: 0,
  ...extra,
})
