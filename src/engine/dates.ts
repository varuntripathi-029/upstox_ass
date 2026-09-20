// All date logic runs in Asia/Kolkata (TECH.md §1).
import { TZDate } from '@date-fns/tz'
import { addDays as dfAddDays, addMonths as dfAddMonths, differenceInCalendarDays, format } from 'date-fns'
import type { Day } from './types'

export const IST = 'Asia/Kolkata'

function toDate(day: Day): TZDate {
  const [y, m, d] = day.split('-').map(Number)
  return new TZDate(y, m - 1, d, IST)
}

const toDay = (d: Date): Day => format(new TZDate(d, IST), 'yyyy-MM-dd')

/** The IST calendar day of an ISO timestamp (or a Day, unchanged). */
export function istDay(iso: string): Day {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return toDay(new Date(iso))
}

/** Whole calendar days from `from` to `to`. */
export const daysBetween = (from: Day, to: Day): number => differenceInCalendarDays(toDate(to), toDate(from))

export const addDays = (day: Day, n: number): Day => toDay(dfAddDays(toDate(day), n))
export const addMonths = (day: Day, n: number): Day => toDay(dfAddMonths(toDate(day), n))

/**
 * "Held more than N months" (R1/R2/R6): the first day a lot bought on `bought` is long-term
 * is the day after its N-month anniversary.
 */
export const longTermFrom = (bought: Day, months: number): Day => addDays(addMonths(bought, months), 1)

export const isLongTerm = (bought: Day, sold: Day, months: number): boolean => sold >= longTermFrom(bought, months)

export interface FinancialYear {
  label: string // "2026-27"
  start: Day
  end: Day
  startYear: number
}

export function financialYearOf(day: Day): FinancialYear {
  const [y, m] = day.split('-').map(Number)
  const startYear = m >= 4 ? y : y - 1
  return {
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    startYear,
  }
}

export const monthKey = (day: Day): string => day.slice(0, 7) // YYYY-MM

export const formatDay = (day: Day, pattern = 'd MMM yyyy'): string => format(toDate(day), pattern)

export const makeDay = (year: number, month: number, day: number): Day =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
