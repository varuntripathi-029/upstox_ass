// Holdings → Mutual funds tab (PRODUCT.md §7 M1–M6). Each SIP instalment is its own lot with its own tax clock.
import { Landmark } from 'lucide-react'
import { formatINRPaise, mfChipText, mfHeadline, MF_CHARGES_NOTE, redemptionText, type MfChip, type MfFund } from '@/engine'
import { cn } from '@/lib/utils'
import { useDemo, type Panel } from './DemoContext'
import { SourceTag } from './DataSource'
import { DemoCard, EstimateNote, inr, signed } from './ui'

const chipStyle: Record<MfChip['kind'], string> = {
  WITHDRAW_FREE: 'border-uw-up/40 bg-uw-up/10 text-uw-up',
  NEXT_LONG_TERM: 'border-uw-banner-border bg-uw-banner text-uw-purple',
  LOCKED: 'border-charge/60 bg-charge/10 text-charge-ink',
  UNLOCKED: 'border-charge/60 bg-charge/10 text-charge-ink',
  SLAB: 'border-uw-band bg-uw-band/60 text-uw-text-2',
}

/** Which panel a fund chip opens: ELSS chips open the unlock timeline, everything else the redeem panel. */
export const mfChipPanel = (f: MfFund, c: MfChip): Panel =>
  c.kind === 'LOCKED' || c.kind === 'UNLOCKED' ? { kind: 'elss', symbol: f.symbol } : { kind: 'mf', symbol: f.symbol }

const units = (u: number) => u.toLocaleString('en-IN', { maximumFractionDigits: 3 })

function FundRow({ f }: { f: MfFund }) {
  const { openPanel } = useDemo()
  const tag = f.scheme === 'ELSS' ? 'ELSS · 3-year lock-in' : f.scheme === 'DEBT' ? 'Debt' : 'Equity'
  return (
    <li className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-uw-text">{f.name}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-uw-text-2">
            <span>
              {tag} · {units(f.units)} units · NAV {formatINRPaise(f.nav)}
            </span>
            <SourceTag kind="nav" />
          </div>
        </div>
        <div className="tabular text-right text-sm">
          <div className="font-medium text-uw-text">{formatINRPaise(f.value)}</div>
          <div className={f.gain < 0 ? 'text-uw-down' : 'text-uw-up'}>{signed(f.gain)}</div>
        </div>
      </div>
      {!f.slab && (
        <dl className="tabular mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-uw-band/40 px-3 py-2">
            <dt className="text-uw-text-2">Long-term · {f.longTerm.lots} lots</dt>
            <dd className="text-uw-text">
              {inr(f.longTerm.value)} <span className={f.longTerm.gain < 0 ? 'text-uw-down' : 'text-uw-up'}>({signed(f.longTerm.gain)})</span>
            </dd>
          </div>
          <div className="rounded-lg bg-uw-band/40 px-3 py-2">
            <dt className="text-uw-text-2">Short-term · {f.shortTerm.lots} lots</dt>
            <dd className="text-uw-text">
              {inr(f.shortTerm.value)} <span className={f.shortTerm.gain < 0 ? 'text-uw-down' : 'text-uw-up'}>({signed(f.shortTerm.gain)})</span>
            </dd>
          </div>
        </dl>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {f.chips.map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => openPanel(mfChipPanel(f, c))}
            className={cn('inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-left text-xs leading-snug font-medium hover:brightness-95', chipStyle[c.kind])}
          >
            {mfChipText(c)}
          </button>
        ))}
      </div>
    </li>
  )
}

export function MutualFundsView() {
  const { report } = useDemo()
  const m = report.mf
  if (!m.show) {
    return <p className="rounded-uw-card border border-uw-band bg-white p-6 text-sm text-uw-text-2">No mutual funds in this portfolio.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <DemoCard kind="NEW" id="mf-headline" title="Withdraw today at ₹0 tax">
        <p className="-mt-1 text-base font-medium text-uw-text">{mfHeadline(m)}</p>
        <p className="text-xs text-uw-text-2">
          Every SIP instalment is its own lot with its own 12-month clock, and redemptions use the oldest units first (FIFO).
        </p>
      </DemoCard>
      <ul className="flex flex-col gap-2" aria-label="Mutual funds">
        {m.funds.map((f) => (
          <FundRow key={f.symbol} f={f} />
        ))}
      </ul>
      {m.redemptions.length > 0 && (
        <DemoCard kind="NEW" id="mf-redemptions" title="Your redemptions this year">
          <ul className="flex flex-col gap-1 text-sm text-uw-text">
            {m.redemptions.map((r) => (
              <li key={r.symbol + r.day}>
                <b>{r.shortName}:</b> {redemptionText(r)}
              </li>
            ))}
          </ul>
        </DemoCard>
      )}
      <p className="flex items-center gap-2 rounded-xl border border-uw-band bg-white px-3 py-2 text-xs text-uw-text-2">
        <Landmark className="size-4 shrink-0 text-uw-purple" aria-hidden />
        {MF_CHARGES_NOTE} This year: {inr(m.charges.stamp)} stamp duty on {m.charges.orders} orders, {inr(m.charges.brokerage)} brokerage.
      </p>
      <EstimateNote />
    </div>
  )
}
