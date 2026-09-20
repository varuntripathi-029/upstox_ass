// Live Upstox data applied over a seed input. Everything here degrades to the seed values:
// a failed call, a missing Analytics Token (501) or a timeout leaves the demo working on cached numbers.
import type { PortfolioInput } from '@/engine/types'
import { fetchInstruments, fetchLtp, fetchMfNavs, type LiveState } from '@/upstox/client'
import { isMfClass } from '@/engine/mf'

export type DataSource = 'sample' | 'live' | 'account' | 'connected'

export interface LiveData {
  /** NAV per fund ISIN (public MF instrument file, no token) */
  navs: Record<string, number>
  navState: LiveState
  navReason?: string
  navFetchedAt?: string
  /** Last traded price per stock ISIN (Analytics Token; 501 → cached) */
  prices: Record<string, number>
  priceState: LiveState
  priceReason?: string
  priceFetchedAt?: string
}

export const NO_LIVE: LiveData = { navs: {}, navState: 'cached', prices: {}, priceState: 'cached' }

const isinsOf = (input: PortfolioInput, mf: boolean) =>
  input.instruments.filter((i) => isMfClass(i.assetClass) === mf && i.assetClass !== 'FNO' && i.isin).map((i) => i.isin!)

/** Fetches what the portfolio needs: NAVs for its funds, and prices for its stocks. */
export async function loadLive(input: PortfolioInput): Promise<LiveData> {
  const mfIsins = isinsOf(input, true)
  const stockIsins = isinsOf(input, false)
  const [navRes, instRes] = await Promise.all([fetchMfNavs(mfIsins), fetchInstruments(stockIsins)])

  const navs: Record<string, number> = {}
  for (const n of navRes.data ?? []) navs[n.isin] = n.navPaise

  const keyByIsin = new Map((instRes.data ?? []).map((i) => [i.instrumentKey, i.isin]))
  const ltpRes = await fetchLtp([...keyByIsin.keys()])
  const prices: Record<string, number> = {}
  for (const [key, v] of Object.entries(ltpRes.data ?? {})) {
    const isin = keyByIsin.get(key) ?? key.split('|').pop()
    if (isin) prices[isin] = v.lastPricePaise
  }

  return {
    navs,
    navState: navRes.data?.length ? 'live' : 'cached',
    navReason: navRes.reason,
    navFetchedAt: navRes.fetchedAt,
    prices,
    priceState: Object.keys(prices).length ? 'live' : 'cached',
    priceReason: ltpRes.reason ?? instRes.reason,
    priceFetchedAt: ltpRes.fetchedAt,
  }
}

/** Replaces holding prices with live ones where we have them; everything else stays as seeded. */
export function applyLive(input: PortfolioInput, live: LiveData): PortfolioInput {
  const isinOf = new Map(input.instruments.map((i) => [i.symbol, i.isin]))
  const holdings = input.holdings.map((h) => {
    const isin = isinOf.get(h.symbol)
    const price = isin ? (live.navs[isin] ?? live.prices[isin]) : undefined
    return price && price > 0 ? { ...h, ltpPaise: price } : h
  })
  return { ...input, holdings }
}

/** True when this holding's price came from Upstox just now. */
export const isLivePrice = (live: LiveData, isin?: string): boolean => !!isin && (isin in live.navs || isin in live.prices)
