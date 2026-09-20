// Every seed trade, and every persona's reference date, falls on an NSE trading day.
// Mutual fund trades fall on a real NAV date of their fund (mfapi.in cache).
import { describe, expect, it } from 'vitest'
import { istDay } from '@/engine/dates'
import { isTradingDay, NSE_HOLIDAY_YEARS } from './nse-holidays'
import navCache from './mf-navs.json'
import { PERSONAS } from './personas'

const navDays = (symbol: string): Set<string> => new Set(Object.keys((navCache.funds as Record<string, { navs: Record<string, string> }>)[symbol]?.navs ?? {}))

describe('seed data dates', () => {
  for (const p of PERSONAS) {
    it(`${p.name}: every trade and the reference date are NSE trading days (MF: NAV dates)`, () => {
      const asOf = istDay(p.portfolio.asOf)
      expect(isTradingDay(asOf)).toBe(true)
      const bad: string[] = []
      for (const t of p.portfolio.trades) {
        const d = istDay(t.time)
        if (t.segment === 'MF') {
          if (!navDays(t.symbol).has(d)) bad.push(`${t.id} ${t.symbol} ${d} (no NAV)`)
        } else {
          expect(NSE_HOLIDAY_YEARS, `${d} is outside the holiday list`).toContain(Number(d.slice(0, 4)))
          if (!isTradingDay(d)) bad.push(`${t.id} ${d}`)
        }
      }
      expect(bad).toEqual([])
    })
  }
  it('the reference date is Friday 18 Sep 2026', () => {
    expect(new Set(PERSONAS.map((p) => istDay(p.portfolio.asOf)))).toEqual(new Set(['2026-09-18']))
  })
  it('knows weekends and holidays', () => {
    expect(isTradingDay('2026-09-19')).toBe(false) // Saturday
    expect(isTradingDay('2025-10-02')).toBe(false) // Gandhi Jayanti
    expect(isTradingDay('2026-09-18')).toBe(true)
  })
})
