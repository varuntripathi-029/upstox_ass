// The Upstox-web-style demo frame (TECH.md §8.1) plus the prototype controls above it.
import { useState } from 'react'
import { ChevronDown, Eye, Grip, PencilLine, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { formatDay } from '@/engine'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PERSONAS } from '@/sample/personas'
import { sampleMarket } from '@/sample/market'
import { useDemo, type View } from './DemoContext'
import { FundsView } from './FundsView'
import { HoldingsView } from './HoldingsView'
import { InsightsView } from './InsightsView'
import { StrategyPanel } from './StrategyPanel'
import { TradeEditor } from './TradeEditor'
import { todayRange } from './scenario'
import { DataSourceSwitch } from './DataSource'
import { inr, signed } from './ui'

function DemoControls() {
  const { persona, state, setPersona, setToday, resetDemo, edited, dataSource, report } = useDemo()
  const account = dataSource === 'account'
  const [editing, setEditing] = useState(false)
  const range = todayRange(persona)
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-border bg-upstox-wash p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-muted">
          Viewing as
          <Select value={persona.id} onValueChange={(v) => setPersona(v as typeof persona.id)} disabled={account}>
            <SelectTrigger className="w-full bg-white text-upstox-black" aria-label="Viewing as">
              {account ? <span>Demo account · recorded responses</span> : <SelectValue />}
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.tagline}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Today’s date
          <input
            type="date"
            disabled={account}
            min={range.min}
            max={range.max}
            value={state.today}
            onChange={(e) => {
              const v = e.target.value
              if (v && v >= range.min && v <= range.max) setToday(v)
            }}
            className="h-9 rounded-md border border-input bg-white px-2.5 text-sm text-upstox-black"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white" disabled={account} onClick={() => setEditing(true)}>
            <PencilLine className="size-4" /> Edit trades{edited && ' •'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              resetDemo()
              toast.success('Demo reset: default persona, original trades and date.')
            }}
          >
            <RotateCcw className="size-4" /> Reset demo
          </Button>
        </div>
      </div>
      <DataSourceSwitch />
      <p className="text-sm text-upstox-black">
        {account ? (
          <>
            <b>Demo account:</b> recorded Upstox responses (holdings, trade history incl. MF, charges, P&amp;L) mapped by the same code a live call uses. There is no
            login: personal Upstox apps only allow the owner’s account.
          </>
        ) : (
          <>
            <b>{persona.name}:</b> {persona.story}
          </>
        )}
        {!account && state.today !== range.min && <span className="text-muted"> Date moved to {formatDay(state.today)}; prices stay at the {formatDay(range.min)} snapshot.</span>}
        {account && <span className="text-muted"> {report.holdings.length} holdings · {report.mf.funds.length} funds · as of {formatDay(report.asOf)}.</span>}
      </p>
      <TradeEditor open={editing} onOpenChange={setEditing} />
    </div>
  )
}

function Ticker() {
  return (
    <div className="flex items-center gap-4 overflow-hidden border-b border-uw-band bg-white px-4 py-1.5 text-[0.6875rem] whitespace-nowrap text-uw-text">
      {sampleMarket.map((m, i) => (
        <span key={m.name} className={cn('tabular flex items-center gap-1.5', i > 0 && 'hidden border-l border-uw-band pl-4 sm:flex')}>
          <b className="font-medium">{m.name}</b>
          {m.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          <span className={m.changePct < 0 ? 'text-uw-down' : 'text-uw-up'}>
            {m.changePct > 0 ? '+' : ''}
            {m.changePct.toFixed(2)}%
          </span>
          <span className="text-uw-text-2">{m.expiry}</span>
        </span>
      ))}
    </div>
  )
}

function TopNav() {
  const { report, view, setView, persona } = useDemo()
  const holdPnl = report.holdings.reduce((a, h) => a + h.unrealized, 0)
  const item = (label: string, target?: View) => {
    const active = target && (view === target || (target === 'funds' && view === 'insights'))
    return target ? (
      <button
        key={label}
        type="button"
        onClick={() => setView(target)}
        aria-current={active ? 'page' : undefined}
        className={cn('cursor-pointer border-b-2 px-1 py-3 text-sm whitespace-nowrap', active ? 'border-uw-purple font-medium text-uw-purple' : 'border-transparent text-uw-nav hover:text-uw-text')}
      >
        {label}
      </button>
    ) : (
      <span key={label} className="hidden px-1 py-3 text-sm whitespace-nowrap text-uw-nav xl:inline" aria-hidden>
        {label}
      </span>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-uw-band bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-uw-logo text-sm font-bold text-white" aria-label="up (stand-in logo)">
          up
        </div>
        <span className="hidden items-center gap-1 text-xs text-uw-text md:flex">
          {persona.name} <ChevronDown className="size-3" />
        </span>
        <span className="tabular hidden text-[0.6875rem] whitespace-nowrap text-uw-text-2 xl:inline">
          Hol. Total P&amp;L <span className={holdPnl < 0 ? 'text-uw-down' : 'text-uw-up'}>{signed(holdPnl)}</span>
        </span>
        <span className="tabular hidden text-[0.6875rem] whitespace-nowrap text-uw-text-2 2xl:inline">Pos. Total P&amp;L {inr(0)}</span>
        <Eye className="hidden size-3.5 text-uw-text-2 xl:block" aria-hidden />
      </div>
      <nav className="flex items-center gap-3" aria-label="Upstox demo navigation">
        {item('Home')}
        {item('My List')}
        {item('Orders')}
        {item('Positions')}
        {item('Holdings', 'holdings')}
        {item('More ▾')}
        <span className="hidden h-8 w-28 items-center gap-1.5 rounded-md border border-uw-band px-2 text-xs text-uw-text-2 2xl:flex" aria-hidden>
          <Search className="size-3.5" /> Search
        </span>
        <button
          type="button"
          onClick={() => setView('funds')}
          aria-current={view === 'funds' || view === 'insights' ? 'page' : undefined}
          className={cn(
            'cursor-pointer rounded-md border px-2.5 py-1 text-sm',
            view === 'funds' || view === 'insights' ? 'border-uw-purple bg-uw-banner font-medium text-uw-purple' : 'border-uw-band text-uw-text',
          )}
        >
          Funds
        </button>
        <span className="hidden size-8 items-center justify-center rounded-full bg-uw-banner text-xs font-semibold text-uw-purple sm:flex" aria-hidden>
          {persona.name.slice(0, 2).toUpperCase()}
        </span>
        <Grip className="hidden size-4 text-uw-text-2 md:block" aria-hidden />
      </nav>
    </div>
  )
}

export function DemoFrame() {
  const { view, persona } = useDemo()
  return (
    <div>
      <DemoControls />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-card-hover">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-upstox-black px-3 py-1.5 text-[0.6875rem] text-white">
          <span className="font-semibold">Concept · Not an official Upstox product</span>
          <span className="text-white/75">Concept by Varun Tripathi · Sample data</span>
        </div>
        <Ticker />
        <TopNav />
        <div className="bg-[linear-gradient(to_bottom,var(--color-uw-band)_0,var(--color-uw-band)_140px,#F7F6F3_140px)] px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-[900px]">
            {view === 'holdings' && <HoldingsView key={persona.id} />}
            {view === 'funds' && <FundsView />}
            {view === 'insights' && <InsightsView />}
          </div>
        </div>
      </div>
      <StrategyPanel />
    </div>
  )
}
