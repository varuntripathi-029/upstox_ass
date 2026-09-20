// User-facing strings built from engine output (PRODUCT.md §5, §8), so every screen words dates the same way.
// A lot's date is always its FIRST long-term day ("long-term from" / "sell on or after").
import type { Chip, MfChip, MfFund, MfRedemption, MfReport, Report, Strategies } from './analyze'
import { formatDay } from './dates'
import { formatINR } from './money'

/** Lots turning long-term within this many days get the "wait and save" wording (matches the timeline colour split). */
const SOON_DAYS = 30

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export function chipText(c: Chip): string {
  if (c.kind === 'WAIT') {
    const verb = c.days <= SOON_DAYS ? 'wait and save' : 'save'
    return `⏳ ${days(c.days)} to long-term · long-term from ${formatDay(c.date, 'd MMM')} · ${verb} ${formatINR(c.saving)}`
  }
  if (c.kind === 'TAX_FREE') return `Long-term · ${formatINR(c.amount)} can be booked tax-free`
  if (c.kind === 'NO_TAX') return `Long-term from ${formatDay(c.date, 'd MMM')} · no tax either way`
  return `Loss · can cut this year's tax by ${formatINR(c.taxCut)}`
}

type Wait = Strategies['waitForLongTerm'][number]

export function waitPanel(w: Wait): { headline: string; today: string; later: string; remind: string } {
  const date = formatDay(w.date)
  return {
    headline: `Wait ${days(w.days)}, save ${formatINR(w.saving)}`,
    today: `Sell today: ${formatINR(w.taxToday)} short-term tax`,
    later: `Sell on or after ${date}: ${w.taxOnDate === 0 ? '₹0 tax' : `${formatINR(w.taxOnDate)} long-term tax`}`,
    remind: `Remind me on ${date}`,
  }
}

/** One-line takeaway for "Where your profit went": what you keep per ₹100, and whether charges or tax took more. */
export function profitTakeaway(r: Pick<Report, 'summary'>): string {
  const { keepPct, tax, charges, grossGains } = r.summary
  if (grossGains <= 0) return 'No gains booked yet this year.'
  const keep = `You keep ₹${Math.round(keepPct)} of every ₹100 you made.`
  if (charges > tax) return `${keep} Charges took more than tax (${formatINR(charges)} vs ${formatINR(tax)}).`
  if (tax > charges) return `${keep} Tax took more than charges (${formatINR(tax)} vs ${formatINR(charges)}).`
  return keep
}

// ---- Building on Upstox's tax-loss harvesting (TLH): it covers losses in March; this covers the rest of the year.

export const UPSTOX_TLH_URL = 'https://account.upstox.com/reports/tax-loss-harvesting'

export const POSITIONING =
  "Upstox's tax-loss harvesting handles the 31 March moment. Tax & Cost Insights handles the other 11 months: before every sell."

/** Gain harvesting is what Upstox's TLH doesn't do. */
export const GAIN_HARVEST_NOTE = 'Tax-loss harvesting covers losses. This uses your ₹1.25L tax-free limit on gains.'

/** A4 wording: why "you actually keep" differs from Upstox's Realised P&L. */
export const KEEP_TITLE = 'You actually keep, after tax and charges'
export const KEEP_CONTRAST = "Upstox's Realised P&L shows after-charges only."
export const KEEP_NOTE = `${KEEP_TITLE}. ${KEEP_CONTRAST}`

/** C6 / loss chip panel: show the ₹ figure, then hand off to Upstox's own tax-loss harvesting. */
export function lossPanel(l: { losses: number; taxCut: number; symbols: string[] }): {
  title: string
  description: string
  button: { label: string; href: string }
} {
  return {
    title: `${formatINR(l.losses)} of losses could cut this year’s tax by ${formatINR(l.taxCut)}`,
    description: `Unrealized losses in ${l.symbols.join(', ')} would cancel gains you’ve already booked. Upstox’s tax-loss harvesting lists your loss-making stocks and reminds you to buy back after T+1.`,
    button: { label: 'Open Upstox tax-loss harvesting', href: UPSTOX_TLH_URL },
  }
}

// ---- Mutual funds (PRODUCT.md §7 M1–M6)

const units = (u: number) => u.toLocaleString('en-IN', { maximumFractionDigits: 3 })
const day = (d: string) => formatDay(d, 'd MMM')
const joinNames = (names: string[]) => names.join(' + ')

/** M5 */
export const MF_DEBT_NOTE = "Slab-rate whenever you redeem; holding longer doesn't change that"

/** Upstox MF charges */
export const MF_CHARGES_NOTE = 'No brokerage on Upstox mutual funds: stamp duty only (0.005% of each purchase).'

export function mfChipText(c: MfChip): string {
  switch (c.kind) {
    case 'WITHDRAW_FREE':
      return `${formatINR(c.value)} redeemable today at ₹0 tax`
    case 'NEXT_LONG_TERM':
      return `Next ${formatINR(c.value)} long-term from ${day(c.date)} (${days(c.days)})`
    case 'LOCKED':
      return `Locked · first ${formatINR(c.value)} unlocks ${day(c.date)}`
    case 'UNLOCKED':
      return c.next ? `${formatINR(c.value)} unlocked · next ${formatINR(c.next.value)} unlocks ${day(c.next.date)}` : `${formatINR(c.value)} unlocked`
    case 'SLAB':
      return MF_DEBT_NOTE
  }
}

/** M2 headline */
export function mfHeadline(m: MfReport): string {
  const parts: string[] = []
  if (m.withdrawFree > 0) parts.push(`${formatINR(m.withdrawFree)} can be withdrawn today at ₹0 tax (${joinNames(m.withdrawFreeFunds)}).`)
  else parts.push('Nothing can be withdrawn today at ₹0 tax.')
  if (m.locked > 0) {
    parts.push(
      m.firstUnlock
        ? `${formatINR(m.locked)} is locked in ELSS; the first ${formatINR(m.firstUnlock.value)} unlocks ${day(m.firstUnlock.date)}.`
        : `${formatINR(m.locked)} is locked in ELSS.`,
    )
  }
  return parts.join(' ')
}

/** M6 */
export function redemptionText(r: MfRedemption): string {
  const mix =
    r.shortTermLots === 0 ? 'all long-term' : r.longTermLots === 0 ? 'all short-term' : `${r.longTermLots} long-term, ${r.shortTermLots} short-term`
  const n = r.lots === 1 ? 'oldest instalment' : `${r.lots} oldest instalments`
  return `Your ${formatDay(r.day)} redemption used your ${n} (${mix}): gain ${formatINR(r.gain)}, tax ${formatINR(r.tax)}`
}

/** Fund panel headline ("Redeem up to ₹X / N units today with ₹0 tax") */
export function mfRedeemHeadline(f: MfFund): string {
  return f.withdrawFree.value > 0
    ? `Redeem up to ${formatINR(f.withdrawFree.value)} / ${units(f.withdrawFree.units)} units today with ₹0 tax`
    : `Redeeming ${f.shortName} today would cost tax`
}

/** ELSS panel headline (M4) */
export function elssHeadline(f: MfFund): string {
  const e = f.elss
  if (!e) return f.shortName
  if (e.nextUnlock && e.unlocked.lots === 0) return `${formatINR(e.locked.value)} locked; the first ${formatINR(e.nextUnlock.value)} unlocks ${day(e.nextUnlock.date)}`
  if (e.nextUnlock) return `${formatINR(e.unlocked.value)} unlocked; the next ${formatINR(e.nextUnlock.value)} unlocks ${day(e.nextUnlock.date)}`
  return `All ${formatINR(e.unlocked.value)} unlocked`
}
