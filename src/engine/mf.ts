// Mutual fund helpers: R24 stamp duty and unit allotment, R25 ELSS lock-in, allotment dates.
import { addDays, addMonths } from './dates'
import { R24_MF_STAMP_DUTY_PER_MILLION, R25_ELSS_LOCK_MONTHS } from './rules'
import type { AssetClass, Day, Paise } from './types'

export const isMfClass = (a: AssetClass): boolean => a === 'EQUITY_MF' || a === 'DEBT_MF' || a === 'NON_EQUITY_FUND'

/** R24: stamp duty on an MF purchase, in paise (0.005% of the amount). */
export const mfStampDuty = (amount: Paise): Paise => Math.round((amount * R24_MF_STAMP_DUTY_PER_MILLION) / 1_000_000)

/**
 * R24: units allotted = amount × (1 − 0.00005) ÷ NAV, floored to 3 decimals.
 * `nav` is the NAV in rupees as published (e.g. "89.85690"); exact decimal arithmetic, no float rounding.
 */
export function mfUnits(amount: Paise, nav: string): number {
  const [i, f = ''] = nav.split('.')
  const navE5 = Number(i) * 100_000 + Number((f + '00000').slice(0, 5)) // NAV × 1e5
  const net = amount * (1_000_000 - R24_MF_STAMP_DUTY_PER_MILLION) // paise × 1e6
  // units = (net / 1e6 / 100 rupees) / (navE5 / 1e5) = net / (1000 × navE5), so units × 1000 = net / navE5
  return Math.floor(net / navE5) / 1000
}

/** Allotment date: the first NAV date on or after the SIP date. `navDays` must be sorted. */
export function allotmentDay(sipDay: Day, navDays: readonly Day[]): Day {
  const d = navDays.find((x) => x >= sipDay)
  if (!d) throw new Error(`No NAV on or after ${sipDay}`)
  return d
}

/** R25: an ELSS lot is unlocked from the day after its 3rd anniversary. */
export const elssUnlockFrom = (allotted: Day): Day => addDays(addMonths(allotted, R25_ELSS_LOCK_MONTHS), 1)
