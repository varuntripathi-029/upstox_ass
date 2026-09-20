import type { Paise } from './types'

export const rupees = (r: number): Paise => Math.round(r * 100)

/** amount × bps / 10000, rounded to the nearest paisa */
export const applyBps = (amount: Paise, bps: number): Paise => Math.round((amount * bps) / 10_000)

/** Round paise to the nearest whole rupee (tax is shown in whole rupees) */
export const roundToRupee = (amount: Paise): Paise => Math.round(amount / 100) * 100

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

/** ₹1,02,500 */
export const formatINR = (p: Paise): string => inr0.format(Math.round(p / 100))
/** ₹1,02,500.00 */
export const formatINRPaise = (p: Paise): string => inr2.format(p / 100)

/** Ratio as a percentage number, e.g. 0.0802 → 8.02 */
export const pct = (num: number, den: number): number => (den === 0 ? 0 : (num / den) * 100)
