// User-facing strings built from engine output (PRODUCT.md §5, §8), so every screen words dates the same way.
// A lot's date is always its FIRST long-term day ("long-term from" / "sell on or after").
import type { Chip, MfChip, MfFund, MfRedemption, MfReport, Report, Strategies } from './analyze'
import { formatDay } from './dates'
import { formatINR } from './money'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/**
 * Every figure here is a tax consequence at today's price, never a reason to trade: the product shows
 * what a sale would cost or save, it does not tell anyone to sell, hold or buy (PRODUCT.md §5.1).
 */
export const PRICE_ASSUMPTION = 'Assumes the price stays where it is today. Not investment advice.'

/** The ₹1.25L limit is annual, shared across eligible long-term gains, and measured on gain, not value. */
export const LTCG_BASIS_NOTE = 'Based on profit, not portfolio value.'
export const LTCG_BASIS_EXAMPLE =
  '₹5L invested that is now worth ₹7L is a ₹2L gain, so ₹2L counts towards the limit, not ₹7L. The limit is for the whole financial year and covers all eligible long-term gains together, not one per stock, and it is not a cap on what you can hold.'

export function chipText(c: Chip): string {
  if (c.kind === 'WAIT') {
    return `⏳ Becomes long-term in ${days(c.days)} (${formatDay(c.date, 'd MMM')}) · selling after that could mean ${formatINR(c.saving)} less tax at today’s price`
  }
  if (c.kind === 'TAX_FREE') return `Long-term · ${formatINR(c.amount)} of gain sits inside this year’s tax-free limit`
  if (c.kind === 'NO_TAX') return `Long-term from ${formatDay(c.date, 'd MMM')} · no tax either way`
  return `Loss · realizing it could offset eligible gains (about ${formatINR(c.taxCut)} less tax)`
}

type Wait = Strategies['waitForLongTerm'][number]

export function waitPanel(w: Wait): { headline: string; today: string; later: string; remind: string; assumption: string } {
  const date = formatDay(w.date)
  return {
    // Timing, not a recommendation: the holding becomes long-term on a date, and that changes the tax.
    headline: `Becomes long-term in ${days(w.days)}, on ${date}`,
    today: `Sell today: ${formatINR(w.taxToday)} short-term tax`,
    later: `Sell on or after ${date}: ${w.taxOnDate === 0 ? '₹0 tax' : `${formatINR(w.taxOnDate)} long-term tax`}`,
    remind: `Remind me on ${date}`,
    assumption: `Estimated tax could be ${formatINR(w.saving)} lower after that date. ${PRICE_ASSUMPTION}`,
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

/** Gain harvesting is what Upstox's TLH doesn't do. Shown as context; acted on only if a sale is being considered. */
export const GAIN_HARVEST_NOTE = 'Tax-loss harvesting covers losses. This is the same idea for gains: long-term gains within your ₹1.25L limit are taxed at ₹0.'

// ---- Intent gate (PRODUCT.md §5.1): opportunities are surfaced, never manufactured.

export const INTENT_QUESTION = 'Are you thinking about selling or redeeming?'
export const INTENT_EXPLORING = 'Just looking'
export const INTENT_CONSIDERING = 'Considering a sale'
/** Shown in "just looking" mode, where the screens stay informational. */
export const INTENT_EXPLORING_NOTE =
  'Showing what your holdings mean for tax and charges. Switch to “Considering a sale” to see timing and limit-planning options.'
export const INTENT_CONSIDERING_NOTE = 'Showing timing, the tax-free limit and what a sale would cost. Nothing here is a recommendation to trade.'

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
    title: `Realizing ${formatINR(l.losses)} of losses may offset eligible gains (about ${formatINR(l.taxCut)} less tax)`,
    description: `Unrealized losses in ${l.symbols.join(', ')} would set off against gains you have already booked. ${LOSS_TRADEOFF} Upstox’s tax-loss harvesting lists your loss-making stocks.`,
    button: { label: 'Open Upstox tax-loss harvesting', href: UPSTOX_TLH_URL },
  }
}

/** The part a tax number hides: selling a loss closes a position that may recover. */
export const LOSS_TRADEOFF =
  'The trade-off is real: selling exits a position that could recover later, and the tax set-off is worth less than the holding if it does.'

// ---- Section 156 / the ₹12L rebate, in plain words (PRODUCT.md §7 B3)

/** Consequence first: the user's takeaway, without the phrase "special-rate capital gains". */
export const S156_PLAIN = 'Stock gains are taxed separately. Your salary may qualify for the ₹12L rebate, but equity gains can still create tax.'
export const S156_TOOLTIP = 'Some stock gains use special tax rates instead of your normal income-tax slab.'

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
