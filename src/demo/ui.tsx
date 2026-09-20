// Small building blocks for the demo frame. NEW metrics are visually louder than CONTEXT ones.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatINR } from '@/engine'

export const inr = (p: number) => formatINR(p)
/** "+₹9,000" / "−₹1,100" */
export const signed = (p: number) => (p < 0 ? `−${formatINR(-p)}` : `+${formatINR(p)}`)
export const pct = (x: number, d = 1) => `${x.toFixed(d)}%`

export function Tag({ kind }: { kind: 'NEW' | 'CONTEXT' }) {
  return kind === 'NEW' ? (
    <span className="rounded-full bg-uw-purple px-2 py-0.5 text-[0.625rem] font-bold tracking-wider text-white">NEW</span>
  ) : (
    <span className="rounded-full border border-uw-band px-2 py-0.5 text-[0.625rem] font-medium tracking-wider text-uw-text-2">CONTEXT</span>
  )
}

export const ESTIMATE_NOTE = 'Estimate from your Upstox trades · Not tax advice · Confirm with a CA.'

export function EstimateNote({ className }: { className?: string }) {
  return <p className={cn('text-[0.6875rem] text-uw-text-2', className)}>{ESTIMATE_NOTE}</p>
}

/** A demo card. NEW cards get a purple border and heavier title; CONTEXT cards stay quiet. */
export function DemoCard({
  kind,
  title,
  id,
  action,
  children,
  className,
  footer = true,
}: {
  kind: 'NEW' | 'CONTEXT'
  title: ReactNode
  id?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  footer?: boolean
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-uw-card bg-white p-4 shadow-card sm:p-5',
        kind === 'NEW' ? 'border-2 border-uw-purple/70' : 'border border-uw-band',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 id={id} className={cn(kind === 'NEW' ? 'text-base font-semibold text-uw-text' : 'text-sm font-medium text-uw-text-2')}>
            {title}
          </h3>
          <Tag kind={kind} />
        </div>
        {action}
      </header>
      {children}
      {footer && <EstimateNote className="mt-auto pt-1" />}
    </section>
  )
}

/** A button that looks like a card row / tile and opens a strategy panel. */
export function PanelButton({ onClick, children, className, label }: { onClick: () => void; children: ReactNode; className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'w-full cursor-pointer rounded-xl text-left transition hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uw-purple',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-md bg-charge/20 px-2 py-0.5 text-[0.6875rem] font-semibold text-charge-ink', className)}>Sample data</span>
  )
}
