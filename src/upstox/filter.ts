// Server-side filtering of the two public Upstox instrument files.
// The files are ~1.3-2 MB gzipped and tens of MB unzipped, so the function keeps only the rows
// the demo needs and returns a small payload (Vercel's response limit is 4.5 MB, TECH.md §4).
import type { UpstoxMfInstrument, UpstoxNseInstrument } from './types'

export interface MfNav {
  isin: string
  name: string
  schemeType: string
  /** Current NAV in paise. NAVs carry 4 decimals (89.7169 → 8971.69), so this keeps sub-paise precision. */
  navPaise: number
}

export interface InstrumentRef {
  isin: string
  instrumentKey: string
  tradingSymbol: string
  name: string
  tickSizePaise: number
}

/** NAVs (up to 4 decimals) → paise, keeping the fraction. */
const navToPaise = (nav: number) => Math.round(nav * 100_000) / 1000

/**
 * Keeps one row per wanted ISIN. The MF file lists a scheme several times (different plans and
 * settlement types) with the same NAV, so the first row with a usable NAV wins.
 */
export function pickMfNavs(rows: UpstoxMfInstrument[], isins: readonly string[]): MfNav[] {
  const want = new Set(isins)
  const out = new Map<string, MfNav>()
  for (const r of rows) {
    if (!want.has(r.instrument_key) || out.has(r.instrument_key) || !(r.last_price > 0)) continue
    out.set(r.instrument_key, { isin: r.instrument_key, name: r.name, schemeType: r.scheme_type, navPaise: navToPaise(r.last_price) })
  }
  return isins.map((i) => out.get(i)).filter((x): x is MfNav => !!x)
}

/** Keeps the NSE_EQ row for each wanted ISIN (the demo's stocks and ETFs). */
export function pickInstruments(rows: UpstoxNseInstrument[], isins: readonly string[]): InstrumentRef[] {
  const want = new Set(isins)
  const out = new Map<string, InstrumentRef>()
  for (const r of rows) {
    if (r.segment !== 'NSE_EQ' || !want.has(r.isin) || out.has(r.isin)) continue
    out.set(r.isin, {
      isin: r.isin,
      instrumentKey: r.instrument_key,
      tradingSymbol: r.trading_symbol,
      name: r.name,
      tickSizePaise: r.tick_size,
    })
  }
  return isins.map((i) => out.get(i)).filter((x): x is InstrumentRef => !!x)
}
