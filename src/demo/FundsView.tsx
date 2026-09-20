// Funds page: the existing Upstox report chips (inert) plus the new "Tax & cost insights" chip.
import { BookOpen, FileText, Landmark, PieChart, Receipt, ScrollText, Scissors, Sparkles, Wallet } from 'lucide-react'
import { useDemo } from './DemoContext'

// Existing Upstox tools (inert in the demo), labelled exactly as on Upstox web (public/upstox-reports.png).
// Tax-loss harvesting is added next to the Tax report: Upstox's TLH page lives under /reports/ (PRODUCT.md §5).
const EXISTING = [
  { label: 'Ledger report', icon: BookOpen },
  { label: 'Profit & Loss report', icon: PieChart },
  { label: 'Dividend reports', icon: Landmark },
  { label: 'Tax report', icon: Receipt },
  { label: 'Tax-loss harvesting', icon: Scissors },
  { label: 'Holdings report', icon: Wallet },
  { label: 'Trade report', icon: ScrollText },
]

export function ReportsRow() {
  const { setView } = useDemo()
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Reports">
      {EXISTING.map(({ label, icon: Icon }) => (
        <span
          key={label}
          role="listitem"
          aria-disabled="true"
          title="Existing Upstox tool (not part of this concept)"
          className="inline-flex items-center gap-1.5 rounded-md border border-uw-band bg-white px-3 py-1.5 text-sm text-uw-text-2"
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
      ))}
      <span role="listitem">
        <button
          type="button"
          onClick={() => setView('insights')}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-uw-purple bg-uw-banner px-3 py-1.5 text-sm font-medium text-uw-purple hover:bg-white"
        >
          <Sparkles className="size-4" aria-hidden />
          Tax &amp; cost insights
          <span className="rounded-full bg-uw-purple px-1.5 py-px text-[0.5625rem] font-bold text-white">NEW</span>
        </button>
      </span>
    </div>
  )
}

export function FundsView() {
  const { setView } = useDemo()
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-lg font-semibold text-uw-text">Funds</h2>
        <p className="text-xs text-uw-text-2">Equity · available margin</p>
        {/* User-facing product copy inside the Upstox frame (the pitch line stays on the case-study page). */}
        <div className="mt-3 flex flex-col items-start gap-2 rounded-xl border border-uw-banner-border bg-uw-banner px-3 py-2 text-sm text-uw-text sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-uw-purple" aria-hidden />
            <span>
              <b className="text-uw-purple">New</b> · See your tax and charges before you sell, all year.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setView('insights')}
            className="cursor-pointer rounded-md bg-uw-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-uw-logo"
          >
            Open Tax &amp; cost insights
          </button>
        </div>
      </div>
      <div className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-uw-text">Reports</h3>
        <ReportsRow />
      </div>
    </div>
  )
}
