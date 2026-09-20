// Strategy panel (PRODUCT.md §8): headline with ₹ saved, before/after, steps, warning, primary button.
// Tax and cost timing only: it compares options and leaves the decision to the user.
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { elssHeadline, formatDay, GAIN_HARVEST_NOTE, lossPanel, LOSS_TRADEOFF, LTCG_BASIS_NOTE, mfRedeemHeadline, MF_DEBT_NOTE, PRICE_ASSUMPTION, S156_TOOLTIP, waitPanel, type Report } from '@/engine'
import { R11_REBATE_MAX, SECTIONS } from '@/engine/rules'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDemo, type Panel } from './DemoContext'
import { ESTIMATE_NOTE, inr, pct, SampleBadge, signed as signedInr } from './ui'

interface PanelContent {
  eyebrow: string
  title: string
  description?: string
  compare?: { label: string; value: string; note?: string; better?: boolean }[]
  steps?: ReactNode[]
  warning?: ReactNode
  primary?: { label: string; toast?: string; href?: string }
  /** ELSS unlock timeline (M4) */
  timeline?: { date: string; days: number; value: number; units: number; lots: number }[]
}

const notApplicable = (eyebrow: string, why: string): PanelContent => ({ eyebrow, title: 'Nothing to do here right now', description: why })

function build(panel: Panel, r: Report): PanelContent {
  const s = r.strategies
  switch (panel.kind) {
    case 'wait': {
      const h = r.holdings.find((x) => x.symbol === panel.symbol)
      const l = h?.lots[panel.lotIndex]
      if (!h || !l || !l.longTermFrom || l.savingByWaiting <= 0) return notApplicable('Turning long-term', 'This lot no longer has a saving from waiting on the current date.')
      const copy = waitPanel({ symbol: h.symbol, days: l.daysLeft, date: l.longTermFrom, gain: l.gain, taxToday: l.taxToday, taxOnDate: l.taxOnceLongTerm ?? 0, saving: l.savingByWaiting })
      return {
        eyebrow: `${h.symbol} · ${l.qty} shares`,
        title: copy.headline,
        description: `${copy.assumption} Gain ${inr(l.gain)} at today’s price. Bought ${l.acquired ? formatDay(l.acquired) : '—'}.`,
        compare: [
          { label: 'Sell today', value: inr(l.taxToday), note: 'short-term: 20% + cess' },
          { label: `Sell on or after ${formatDay(l.longTermFrom)}`, value: inr(l.taxOnceLongTerm ?? 0), note: 'long-term: 12.5% + cess above the limit', better: true },
        ],
        steps: [
          <>Long-term starts on <b>{formatDay(l.longTermFrom)}</b>, the day after the 12-month anniversary of the buy date.</>,
          <>A sale before that is short-term: 20% + 4% cess on the gain.</>,
          <>From that day, the gain is long-term and tax-free within the {inr(r.limit.limit)} limit ({inr(r.limit.left)} left this year).</>,
        ],
        warning: `This is a tax-timing calculation, not advice to hold: the price can move either way, and the tax difference only matters if you were going to sell. ${PRICE_ASSUMPTION}`,
        primary: { label: copy.remind, toast: `Reminder set for ${formatDay(l.longTermFrom)} (demo: nothing is scheduled).` },
      }
    }
    case 'harvest': {
      const g = s.gainHarvest
      if (!g.show) return notApplicable('Using the tax-free limit', r.limit.left === 0 ? 'The ₹1.25L limit is used up for this year.' : 'There are no long-term gains in your holdings.')
      return {
        eyebrow: 'Using the tax-free limit',
        title: `${inr(g.bookable)} of long-term gain would be taxed at ₹0 this year`,
        description: `${GAIN_HARVEST_NOTE} ${LTCG_BASIS_NOTE} You have ${inr(r.limit.left)} of the ${inr(r.limit.limit)} long-term limit left this year. It resets on ${formatDay(r.limit.resetsOn)} and doesn’t carry forward.`,
        compare: [
          { label: 'Do nothing', value: inr(g.taxSaved), note: 'future tax on these gains (12.5% × 1.04)' },
          { label: 'Realize the gain and re-enter', value: inr(g.netSaving), note: `difference after ≈${inr(g.estimatedCost)} of charges`, better: true },
        ],
        steps: [
          ...g.byHolding.map((b) => (
            <span key={b.symbol}>
              Selling <b>{b.qty} {b.symbol}</b> today would realize {inr(b.bookable)} of long-term gain at ₹0 tax.
            </span>
          )),
          <>If you want to keep the position, re-entering happens on the <b>next trading day</b>: a same-day sell and buy counts as intraday, which is taxed differently.</>,
          <>Your cost basis rises, so tax on a future sale would be about {inr(g.taxSaved)} lower.</>,
        ],
        warning: `Acting costs money and carries price risk: you pay charges twice and the price can move overnight while you are out of the position. Charges are estimated from your own average order cost, and the ₹1.25L limit is shared across brokers. ${PRICE_ASSUMPTION}`,
        primary: { label: 'Remind me on the next trading day', toast: 'Reminder set for the next trading day (demo: nothing is scheduled).' },
      }
    }
    case 'loss': {
      // Upstox already has tax-loss harvesting: show the ₹ figure and hand off to it (§8).
      const lh = s.lossHarvest
      if (!lh.show) return notApplicable('Losses you can use', 'You need both gains booked this year and holdings at a loss.')
      const copy = lossPanel(lh)
      return {
        eyebrow: `Losses that could offset gains · ${lh.symbols.join(', ')}`,
        title: copy.title,
        description: copy.description,
        compare: [
          { label: 'Tax this year now', value: inr(r.summary.tax) },
          { label: 'If these losses are booked', value: inr(Math.max(0, r.summary.tax - lh.taxCut)), better: true },
        ],
        warning: LOSS_TRADEOFF,
        primary: { label: copy.button.label, href: copy.button.href },
      }
    }
    case 'charges': {
      const c = s.charges
      const [small, , large] = r.charges.orderSize
      return {
        eyebrow: 'Charges',
        title: c.perYear > 0 ? `Save ≈${inr(c.perYear)} a year on charges` : `Charges took ${pct(r.charges.pctOfGross)} of your gains`,
        description: `Charges took ${pct(r.charges.pctOfGross)} of your gross gains. ${r.charges.smallOrders.count} of ${r.charges.smallOrders.totalOrders} orders were under ₹2k and cost ${inr(r.charges.smallOrders.cost)}.`,
        compare: [
          { label: 'Orders under ₹2k', value: pct(small.pctOfValue, small.pctOfValue >= 1 ? 1 : 2), note: 'of order value in charges' },
          { label: 'Orders over ₹10k', value: large.orders ? pct(large.pctOfValue, large.pctOfValue >= 1 ? 1 : 2) : '—', note: 'of order value in charges', better: true },
        ],
        steps: [
          <>Combine small buys into fewer, larger orders: brokerage is a flat ₹20 per order.</>,
          <>For regular investing, a SIP avoids per-order brokerage.</>,
          <>Sell in fewer lots: DP charges apply per stock per day you sell.</>,
        ],
        warning: `Scaled to a year from ${c.annualizationDays} days of trading, then capped at the brokerage and DP charges you actually paid on small orders (${inr(c.cap)}).`,
        primary: { label: 'Remind me before my next small order', toast: 'Nudge saved (demo: nothing is scheduled).' },
      }
    }
    case 's156':
    case 'r10': {
      const b3 = r.section156
      const r10 = b3.unusedBasicExemption
      const lines: ReactNode[] = []
      if (b3.show) {
        lines.push(
          <>The {SECTIONS.rebate} rebate (up to {inr(R11_REBATE_MAX)}) removes slab-rate tax when total income is up to ₹12L.</>,
          <>Stock gains are taxed separately from salary: short-term at 20% and long-term at 12.5%, and the rebate cannot be used against them, so {inr(b3.stockTax)} is still due. ({S156_TOOLTIP})</>,
        )
      }
      if (r10.show && r10.absorbed > 0) {
        lines.push(
          <>Your other income is below ₹4L. The unused part of the basic exemption absorbs {inr(r10.absorbed)} of short- and long-term gains, saving {inr(r10.taxSaved)}.</>,
        )
      }
      if (!lines.length) return notApplicable('Rebate', 'The Section 156 warning doesn’t apply on the current settings.')
      return {
        eyebrow: b3.show ? SECTIONS.rebate : 'Unused basic exemption',
        title: b3.show ? `Why ${inr(b3.stockTax)} is still due` : `${inr(r10.taxSaved)} saved by your unused exemption`,
        description: `Total income ${inr(b3.totalIncome)} (other income + gains).`,
        steps: lines,
        primary: { label: 'Got it' },
      }
    }
    case 'mf': {
      const f = r.mf.funds.find((x) => x.symbol === panel.symbol)
      if (!f) return notApplicable('Mutual funds', 'This fund is no longer held on the current date.')
      const steps: ReactNode[] = [
        <>Redemptions use your oldest units first (FIFO). Each SIP instalment is its own lot with its own 12-month clock.</>,
      ]
      if (f.withdrawFree.value > 0) {
        steps.push(
          <>
            Redeeming {inr(f.withdrawFree.value)} uses your {f.withdrawFree.lots} oldest {f.withdrawFree.lots === 1 ? 'lot' : 'lots'} and adds ₹0 tax this year.
          </>,
        )
      }
      if (!f.slab) {
        steps.push(
          <>
            Long-term: {inr(f.longTerm.value)} in {f.longTerm.lots} lots ({signedInr(f.longTerm.gain)}). Short-term: {inr(f.shortTerm.value)} in {f.shortTerm.lots} lots (
            {signedInr(f.shortTerm.gain)}).
          </>,
        )
      }
      if (f.nextLongTerm) {
        steps.push(
          <>
            The next {inr(f.nextLongTerm.value)} turns long-term on <b>{formatDay(f.nextLongTerm.date)}</b> ({f.nextLongTerm.days} days).
          </>,
        )
      }
      if (f.slab) {
        steps.push(
          <>{MF_DEBT_NOTE}. Its gains are added to your income: while total income stays within ₹12L, the Section 156 rebate covers them (it doesn’t cover equity gains).</>,
        )
      }
      return {
        eyebrow: `${f.shortName} · ${f.scheme === 'DEBT' ? 'debt fund' : 'equity fund'}`,
        title: mfRedeemHeadline(f),
        description: `${f.units.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units at NAV ${inr(f.nav)} = ${inr(f.value)} (${signedInr(f.gain)}).`,
        compare: [
          { label: 'Redeem everything today', value: inr(Math.max(0, f.taxIfRedeemAll)), note: 'extra tax this year' },
          { label: `Redeem up to ${inr(f.withdrawFree.value)}`, value: '₹0', note: 'extra tax', better: true },
        ],
        steps,
        primary: f.nextLongTerm
          ? { label: `Remind me on ${formatDay(f.nextLongTerm.date)}`, toast: `Reminder set for ${formatDay(f.nextLongTerm.date)} (demo: nothing is scheduled).` }
          : { label: 'Got it' },
      }
    }
    case 'elss': {
      const f = r.mf.funds.find((x) => x.symbol === panel.symbol)
      if (!f?.elss) return notApplicable('ELSS', 'This ELSS fund is no longer held on the current date.')
      const e = f.elss
      return {
        eyebrow: `${f.shortName} · ELSS`,
        title: elssHeadline(f),
        description: `Every SIP instalment is locked for 3 years from its allotment date, and unlocks the day after its 3rd anniversary. ${inr(e.locked.value)} locked in ${e.locked.lots} lots; ${inr(e.unlocked.value)} unlocked.`,
        timeline: e.schedule,
        warning: `Long-term after 12 months doesn’t mean redeemable: ${inr(f.longTerm.value)} of this fund is long-term but still locked.`,
        primary: e.nextUnlock
          ? { label: `Remind me on ${formatDay(e.nextUnlock.date)}`, toast: `Reminder set for ${formatDay(e.nextUnlock.date)} (demo: nothing is scheduled).` }
          : { label: 'Got it' },
      }
    }
    case 'advance': {
      const a = r.filing.advanceTax
      if (!a.applies || !a.next) return notApplicable('Advance tax', 'Your tax is within ₹10,000, so no advance tax is due.')
      return {
        eyebrow: 'Advance tax',
        title: `Pay ${inr(a.next.amount)} by ${formatDay(a.next.date)}`,
        description:
          a.basis === 'total'
            ? `Your total tax is ${inr(a.total)} (other income + trades, no TDS assumed), above ₹10,000. ${a.next.cumulativePct}% is due by ${formatDay(a.next.date)}.`
            : `Tax on this year’s trades is ${inr(a.total)}, above ₹10,000 (salary tax is covered by TDS). ${a.next.cumulativePct}% is due by ${formatDay(a.next.date)}.`,
        steps: [
          ...a.schedule.map((x) => (
            <span key={x.date} className="tabular">
              {formatDay(x.date)}: {x.cumulativePct}% · {inr(x.amount)}
              {x.date < r.asOf ? ' (due date passed)' : ''}
            </span>
          )),
          <>Tax on capital gains can be paid in the remaining instalments without interest.</>,
        ],
        primary: { label: `Remind me on ${formatDay(a.next.date)}`, toast: `Reminder set for ${formatDay(a.next.date)} (demo: nothing is scheduled).` },
      }
    }
  }
}

export function StrategyPanel() {
  const { panel, closePanel, report } = useDemo()
  const c = panel ? build(panel, report) : null
  return (
    <Sheet open={!!panel} onOpenChange={(o) => !o && closePanel()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {c && (
          <>
            <SheetHeader className="border-b border-uw-band pr-12">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-uw-purple">{c.eyebrow}</span>
                <SampleBadge />
              </div>
              <SheetTitle className="text-xl font-semibold text-uw-text">{c.title}</SheetTitle>
              {c.description && <SheetDescription className="text-uw-text-2">{c.description}</SheetDescription>}
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              {c.compare && (
                <div className="grid grid-cols-2 gap-2">
                  {c.compare.map((x) => (
                    <div key={x.label} className={x.better ? 'rounded-xl bg-uw-banner p-3 ring-2 ring-gain' : 'rounded-xl bg-uw-band/50 p-3'}>
                      <div className="text-xs text-uw-text-2">{x.label}</div>
                      <div className={x.better ? 'tabular text-xl font-bold text-gain-ink' : 'tabular text-xl font-bold text-uw-text'}>{x.value}</div>
                      {x.note && <div className="text-[0.6875rem] text-uw-text-2">{x.note}</div>}
                    </div>
                  ))}
                </div>
              )}
              {c.steps && (
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-uw-text marker:text-uw-purple">
                  {c.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
              {c.timeline && c.timeline.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-uw-text">Unlock timeline</h3>
                  <ol className="flex flex-col gap-1" aria-label="ELSS unlock timeline">
                    {c.timeline.map((t, i) => {
                      const max = Math.max(...c.timeline!.map((x) => x.value))
                      const cumulative = c.timeline!.slice(0, i + 1).reduce((a, x) => a + x.value, 0)
                      return (
                        <li key={t.date} className="tabular grid grid-cols-[6.5rem_1fr_5rem] items-center gap-2 text-xs">
                          <span className={i === 0 ? 'font-semibold text-uw-purple' : 'text-uw-text'}>{formatDay(t.date)}</span>
                          <span className="h-2 rounded-full bg-uw-band" aria-hidden>
                            <span className={i === 0 ? 'block h-2 rounded-full bg-upstox-purple' : 'block h-2 rounded-full bg-timeline-later'} style={{ width: `${(t.value / max) * 100}%` }} />
                          </span>
                          <span className="text-right text-uw-text" title={`${inr(cumulative)} unlocked by then`}>
                            {inr(t.value)}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
              {c.warning && (
                <div className="flex gap-2 rounded-xl border border-warn-border bg-warn-bg p-3 text-xs text-warn-ink">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  <span>{c.warning}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {c.primary?.href && (
                  <Button asChild className="bg-uw-purple hover:bg-uw-logo">
                    <a href={c.primary.href} target="_blank" rel="noreferrer">
                      {c.primary.label} <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
                {c.primary && !c.primary.href && (
                  <Button
                    className="bg-uw-purple hover:bg-uw-logo"
                    onClick={() => {
                      if (c.primary?.toast) toast.success(c.primary.toast)
                      else closePanel()
                    }}
                  >
                    {c.primary.label}
                  </Button>
                )}
                <p className="text-[0.6875rem] text-uw-text-2">
                  Tax and cost timing only. This compares options; it isn’t a recommendation to buy or sell. {ESTIMATE_NOTE}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
