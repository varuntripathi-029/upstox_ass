// Browser side of the live calls. Every call degrades gracefully: if the endpoint fails, is missing a
// token (501) or is slow, the caller keeps its cached seed values and the UI says "Using cached values".
import type { MfNav } from './filter'

export type LiveState = 'live' | 'cached'

export interface LiveResult<T> {
  data: T | null
  state: LiveState
  /** Why it fell back, for the tooltip */
  reason?: string
  fetchedAt?: string
}

const TIMEOUT_MS = 6000

async function getJson<T>(url: string): Promise<LiveResult<T>> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    const body = (await res.json()) as { status?: string; message?: string; data?: T; fetchedAt?: string }
    if (!res.ok) return { data: null, state: 'cached', reason: body?.message ?? `HTTP ${res.status}` }
    return { data: (body.data ?? null) as T | null, state: 'live', fetchedAt: body.fetchedAt }
  } catch (e) {
    return { data: null, state: 'cached', reason: (e as Error).message }
  }
}

/** Current NAVs from the Upstox MF instrument file (public, no token). */
export const fetchMfNavs = (isins: string[]): Promise<LiveResult<MfNav[]>> =>
  isins.length ? getJson<MfNav[]>(`/api/upstox/mf-navs?isins=${encodeURIComponent(isins.join(','))}`) : Promise.resolve({ data: [], state: 'cached' })

export interface InstrumentRefDto {
  isin: string
  instrumentKey: string
  tradingSymbol: string
  name: string
  tickSizePaise: number
}

/** instrument_key lookup from the public NSE file (needed before any quote call). */
export const fetchInstruments = (isins: string[]): Promise<LiveResult<InstrumentRefDto[]>> =>
  isins.length ? getJson<InstrumentRefDto[]>(`/api/upstox/instruments?isins=${encodeURIComponent(isins.join(','))}`) : Promise.resolve({ data: [], state: 'cached' })

export type LtpMap = Record<string, { lastPricePaise: number; instrumentToken: string }>

/** Live prices (needs an Analytics Token; 501 → cached). */
export const fetchLtp = (instrumentKeys: string[]): Promise<LiveResult<LtpMap>> =>
  instrumentKeys.length
    ? getJson<LtpMap>(`/api/upstox/ltp?instrument_key=${encodeURIComponent(instrumentKeys.join(','))}`)
    : Promise.resolve({ data: {}, state: 'cached' })

export interface BrokerageDto {
  totalPaise: number
  brokeragePaise: number
  sttPaise: number
  gstPaise: number
  stampPaise: number
  dpPaise: number
}

/** Real charges for one order (needs an Analytics Token; 501 → the UI estimates instead). */
export const fetchCharges = (q: { instrumentKey: string; quantity: number; price: number; side: 'BUY' | 'SELL'; product?: 'D' | 'I' }): Promise<LiveResult<BrokerageDto>> =>
  getJson<BrokerageDto>(
    `/api/upstox/charges?instrument_token=${encodeURIComponent(q.instrumentKey)}&quantity=${q.quantity}&product=${q.product ?? 'D'}&transaction_type=${q.side}&price=${q.price}`,
  )

/** R22 grandfathering price (needs an Analytics Token). */
export const fetchFmv2018 = (instrumentKey: string): Promise<LiveResult<{ day: string; highPaise: number }>> =>
  getJson<{ day: string; highPaise: number }>(`/api/upstox/fmv-2018?instrument_key=${encodeURIComponent(instrumentKey)}`)

export interface CorporateActionDto {
  type: string
  exDate: string | null
  recordDate: string | null
  ratio: string | null
  amount: number | null
}

/** Splits, bonuses and dividends (needs an Analytics Token). */
export const fetchCorporateActions = (isin: string): Promise<LiveResult<CorporateActionDto[]>> =>
  getJson<CorporateActionDto[]>(`/api/upstox/corporate-actions?isin=${encodeURIComponent(isin)}`)
