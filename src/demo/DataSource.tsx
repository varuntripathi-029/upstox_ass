// Data-source switch and the small "where this number came from" tags (PRODUCT.md §11).
import { Check, CloudOff, Radio } from 'lucide-react'
import { formatDay } from '@/engine'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDemo } from './DemoContext'
import type { DataSource } from './live'

const OPTIONS: { id: DataSource; label: string; hint: string }[] = [
  { id: 'sample', label: 'Sample', hint: 'Bundled seed data. Every §10 figure is exact.' },
  { id: 'live', label: 'Sample + live Upstox prices', hint: 'Same trades, with current NAVs from the Upstox MF instrument file (no token) and live prices when an Analytics Token is set.' },
  { id: 'account', label: 'Demo account (recorded API responses)', hint: 'Recorded Upstox responses (holdings, trade history, charges, P&L, MF) mapped by the same code a live call uses.' },
  { id: 'connected', label: 'Connect Upstox (live)', hint: 'Live data from the connected Upstox account.' },
]

export function DataSourceSwitch() {
  const { dataSource, setDataSource, liveLoading, connection } = useDemo()
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">Data source</span>
      <div role="radiogroup" aria-label="Data source" className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-card">
        {OPTIONS.map((o) => (
          <Tooltip key={o.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={dataSource === o.id}
                onClick={() => setDataSource(o.id)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition',
                  dataSource === o.id ? 'bg-upstox-purple text-white' : 'text-upstox-black hover:bg-upstox-wash',
                )}
              >
                {dataSource === o.id && <Check className="mr-1 inline size-3" aria-hidden />}
                {o.label}
                {o.id === 'live' && liveLoading && dataSource === 'live' && <span className="ml-1 animate-pulse">…</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{o.hint}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {dataSource === 'connected' && (
        <div className="mt-2 rounded-lg border border-uw-band bg-upstox-wash p-3 text-sm">
          {connection.status === 'loading' && <p>Checking connection...</p>}
          {(connection.status === 'not_connected' || connection.status === 'expired') && (
            <div>
              {connection.status === 'expired' && <p className="mb-2 text-red-600 font-medium">Session expired, please reconnect.</p>}
              <a href="/api/auth/login" className="inline-block rounded-md bg-upstox-purple px-4 py-2 font-medium text-white hover:bg-upstox-purple/90">
                Connect Upstox
              </a>
              <p className="mt-2 text-xs text-upstox-black/70">
                This is a personal developer app. Only the app owner can log in. Other users require multi-client approval from Upstox.
              </p>
            </div>
          )}
          {connection.status === 'error' && (
            <div className="text-red-600">
              <p className="font-medium">Connection error</p>
              <p className="text-xs">{connection.message}</p>
              <a href="/api/auth/login" className="mt-2 inline-block text-xs font-medium underline">Try again</a>
            </div>
          )}
          {connection.status === 'connected' && (
            <div>
              <div className="flex items-center justify-between">
                <p className="font-medium text-upstox-black">
                  Connected as <span className="text-upstox-purple">{connection.name || 'User'}</span>
                </p>
                <a href="/api/auth/logout" className="text-xs text-upstox-black/60 hover:underline">Disconnect</a>
              </div>
              {connection.expiresAt && (
                <p className="text-xs text-upstox-black/60">
                  Session expires at {new Date(connection.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
                </p>
              )}
              {connection.isEmpty && (
                <p className="mt-2 text-xs text-orange-600 font-medium">
                  No holdings or trades in this account yet. Showing sample data.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** "NAV from Upstox · 18 Sep" / "Price from Upstox · 15:21 IST" / "Using cached values". */
export function SourceTag({ kind, className }: { kind: 'nav' | 'price'; className?: string }) {
  const { dataSource, live } = useDemo()
  if (dataSource !== 'live') return null
  const state = kind === 'nav' ? live.navState : live.priceState
  const at = kind === 'nav' ? live.navFetchedAt : live.priceFetchedAt
  const reason = kind === 'nav' ? live.navReason : live.priceReason
  const when = at ? new Date(at) : null
  const label =
    state === 'live'
      ? kind === 'nav'
        ? `NAV from Upstox · ${when ? formatDay(when.toISOString().slice(0, 10), 'd MMM') : 'today'}`
        : `Price from Upstox · ${when ? when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : ''} IST`
      : 'Using cached values'
  const tag = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap',
        state === 'live' ? 'border-uw-up/40 bg-uw-up/10 text-uw-up' : 'border-uw-band bg-uw-band/50 text-uw-text-2',
        className,
      )}
    >
      {state === 'live' ? <Radio className="size-2.5" aria-hidden /> : <CloudOff className="size-2.5" aria-hidden />}
      {label}
    </span>
  )
  return reason && state === 'cached' ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{tag}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  ) : (
    tag
  )
}
