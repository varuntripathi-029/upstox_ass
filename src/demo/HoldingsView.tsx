// Holdings view (opens first): holdings with chips (C1–C6), the "Turning long-term soon" timeline, and the sell simulator.
import { useMemo, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { chipText, formatDay, formatINRPaise, LTCG_BASIS_NOTE, simulateSell, type Chip, type HoldingView, type LotView } from '@/engine'
import { isMfClass } from '@/engine/mf'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MutualFundsView } from './MutualFundsView'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDemo, type Panel } from './DemoContext'
import { IntentGate, useSellPlanning } from './IntentGate'
import { DemoCard, EstimateNote, inr, PanelButton, pct, signed, Tag } from './ui'
import { SourceTag } from './DataSource'

/**
 * Which panel a holding's chip opens, if any. `planning` is the intent gate (PRODUCT.md §5.1): with
 * "just looking" the tax-free chip stays a statement of fact and opens nothing to act on.
 */
export function chipPanel(h: HoldingView, lossUsable: boolean, r10 = false, planning = true): Panel | null {
  const c = h.chip
  if (!c) return null
  if (c.kind === 'WAIT') {
    const lotIndex = h.lots.findIndex((l) => l.savingByWaiting > 0 && l.daysLeft === c.days)
    return { kind: 'wait', symbol: h.symbol, lotIndex }
  }
  if (c.kind === 'TAX_FREE') return planning ? { kind: 'harvest' } : null
  if (c.kind === 'NO_TAX') return r10 ? { kind: 'r10' } : null
  return lossUsable ? { kind: 'loss' } : null
}

const chipStyle: Record<Chip['kind'], string> = {
  WAIT: 'border-uw-banner-border bg-uw-banner text-uw-purple',
  TAX_FREE: 'border-uw-up/40 bg-uw-up/10 text-uw-up',
  NO_TAX: 'border-uw-banner-border bg-white text-uw-text-2',
  LOSS: 'border-uw-band bg-uw-band/60 text-uw-text-2',
}

function HoldingChip({ h }: { h: HoldingView }) {
  const planning = useSellPlanning()
  const { openPanel, report } = useDemo()
  if (!h.chip) return null
  const panel = chipPanel(h, report.lossesToUse.show, report.section156.unusedBasicExemption.absorbed > 0, planning)
  const text = h.chip.kind === 'LOSS' && !panel ? 'Loss · no gains booked this year to cut' : chipText(h.chip)
  const cls = cn('inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-left text-xs leading-snug font-medium', chipStyle[h.chip.kind])
  return panel ? (
    <button
      type="button"
      className={cn(cls, 'cursor-pointer hover:brightness-95')}
      onClick={(e) => {
        e.stopPropagation()
        openPanel(panel)
      }}
    >
      {text}
    </button>
  ) : (
    <span className={cls}>{text}</span>
  )
}

function PnL({ value, cost }: { value: number; cost: number }) {
  const pnl = value - cost
  return (
    <span className={pnl < 0 ? 'text-uw-down' : 'text-uw-up'}>
      {signed(pnl)} <span className="text-xs">({pct(cost ? (pnl / cost) * 100 : 0, 2)})</span>
    </span>
  )
}

function HoldingsTable() {
  const { report, openPanel, setView } = useDemo()
  const planning = useSellPlanning()
  const stocks = report.holdings.filter((h) => !isMfClass(h.assetClass))
  const open = (h: HoldingView) => {
    const p = chipPanel(h, report.lossesToUse.show, report.section156.unusedBasicExemption.absorbed > 0, planning)
    if (p) openPanel(p)
  }
  if (stocks.length === 0) {
    return (
      <div className="rounded-uw-card border border-uw-band bg-white p-6 text-sm text-uw-text-2">
        {report.trading.show ? (
          <>
            No delivery holdings. Your trades are intraday and F&amp;O, see{' '}
            <button type="button" onClick={() => setView('insights')} className="cursor-pointer font-medium text-uw-purple underline">
              Insights
            </button>
            .
          </>
        ) : report.mf.show ? (
          'No stocks. Your mutual funds are in the Mutual funds tab.'
        ) : (
          'No holdings on this date.'
        )}
      </div>
    )
  }
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-uw-card border border-uw-band bg-white shadow-card md:block">
        <table className="tabular w-full text-sm">
          <caption className="sr-only">Holdings with tax chips</caption>
          <thead className="border-b border-uw-band text-xs text-uw-text-2">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Instrument</th>
              <th className="px-3 py-3 text-right font-medium">Qty</th>
              <th className="px-3 py-3 text-right font-medium">Avg. cost</th>
              <th className="px-3 py-3 text-right font-medium">
                LTP <SourceTag kind="price" className="ml-1 align-middle" />
              </th>
              <th className="px-3 py-3 text-right font-medium">Cur. value</th>
              <th className="px-4 py-3 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((h) => (
              <tr
                key={h.symbol}
                onClick={() => open(h)}
                className={cn('border-b border-uw-band/70 align-top last:border-0', h.chip && 'cursor-pointer hover:bg-uw-banner/60')}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-uw-text">{h.symbol}</div>
                  <div className="mb-1.5 text-xs text-uw-text-2">{h.name}</div>
                  <HoldingChip h={h} />
                </td>
                <td className="px-3 py-3 text-right">{h.qty}</td>
                <td className="px-3 py-3 text-right">{formatINRPaise(h.avgCost)}</td>
                <td className="px-3 py-3 text-right">{formatINRPaise(h.ltp)}</td>
                <td className="px-3 py-3 text-right">{formatINRPaise(h.value)}</td>
                <td className="px-4 py-3 text-right">
                  <PnL value={h.value} cost={h.cost} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phone: cards */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Holdings">
        {stocks.map((h) => (
          <li key={h.symbol} className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-uw-text">{h.symbol}</div>
                <div className="text-xs text-uw-text-2">
                  {h.qty} × {formatINRPaise(h.avgCost)} · LTP {formatINRPaise(h.ltp)}
                </div>
              </div>
              <div className="tabular text-right text-sm">
                <div>{formatINRPaise(h.value)}</div>
                <PnL value={h.value} cost={h.cost} />
              </div>
            </div>
            <div className="mt-2">
              <HoldingChip h={h} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function lotPanel(l: LotView, index: number, lossUsable: boolean, harvest: boolean, r10: boolean, planning = true): Panel | null {
  if (l.gain < 0) return lossUsable ? { kind: 'loss' } : null
  if (l.longTerm) return harvest && planning ? { kind: 'harvest' } : null
  if (l.savingByWaiting > 0) return { kind: 'wait', symbol: l.symbol, lotIndex: index }
  return r10 ? { kind: 'r10' } : null
}

function Timeline() {
  const planning = useSellPlanning()
  const { report, openPanel } = useDemo()
  const lots = report.timeline.filter((l) => !isMfClass(report.holdings.find((h) => h.symbol === l.symbol)!.assetClass))
  if (lots.length === 0) return null
  return (
    <DemoCard kind="NEW" id="timeline" title="Turning long-term soon">
      <p className="-mt-1 text-xs text-uw-text-2">
        Each purchase lot, soonest to turn long-term first. A lot is long-term from the day after its 12-month anniversary.
      </p>
      <ul className="flex flex-col gap-1.5">
        {lots.map((l) => {
          const holding = report.holdings.find((h) => h.symbol === l.symbol)!
          const index = holding.lots.indexOf(l)
          const panel = lotPanel(l, index, report.lossesToUse.show, report.strategies.gainHarvest.show, report.section156.unusedBasicExemption.absorbed > 0, planning)
          const total = (l.daysHeld ?? 0) + l.daysLeft
          const fill = l.longTerm || !total ? 100 : ((l.daysHeld ?? 0) / total) * 100
          const color = l.gain < 0 ? 'bg-uw-text-2/40' : l.longTerm ? 'bg-gain' : l.daysLeft <= 30 ? 'bg-upstox-purple' : 'bg-timeline-later'
          const body = (
            <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 px-2 py-2 sm:grid-cols-[7rem_1fr_13rem]">
              <div className="text-sm font-medium text-uw-text">
                {l.symbol}
                {l.gain < 0 && <span className="ml-1 rounded bg-uw-band px-1 text-[0.625rem] font-medium text-uw-text-2">Loss</span>}
                <span className="block text-[0.6875rem] font-normal text-uw-text-2">
                  {l.qty} · {l.acquired ? formatDay(l.acquired, 'd MMM yy') : 'date unknown'}
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-uw-band" aria-hidden>
                <div className={cn('h-3 rounded-full', color)} style={{ width: `${fill}%` }} />
                <div className="absolute -top-1 right-0 h-5 w-0.5 bg-upstox-black" title="Long-term line" />
              </div>
              <div className="col-span-2 text-xs sm:col-span-1 sm:text-right">
                {l.longTerm ? (
                  <span className="font-medium text-gain-ink">Long-term</span>
                ) : (
                  <span className="text-uw-text">
                    <b>{l.daysLeft} days</b> · long-term from {formatDay(l.longTermFrom!, 'd MMM')}
                  </span>
                )}
                <span className="ml-1 text-uw-text-2">
                  {l.gain < 0 ? `· loss ${inr(-l.gain)}` : l.savingByWaiting > 0 ? `· save ${inr(l.savingByWaiting)}` : !l.longTerm && l.taxToday <= 0 ? '· no tax either way' : `· gain ${inr(l.gain)}`}
                </span>
              </div>
            </div>
          )
          return (
            <li key={`${l.symbol}-${index}`}>
              {panel ? (
                <PanelButton
                  onClick={() => openPanel(panel)}
                  className="hover:bg-uw-banner/70 hover:shadow-none"
                  label={`${l.symbol}: open strategy panel`}
                >
                  {body}
                </PanelButton>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-uw-text-2">
        <Legend className="bg-upstox-purple" label="Long-term within 30 days" />
        <Legend className="bg-timeline-later" label="Later" />
        <Legend className="bg-gain" label="Already long-term" />
        <Legend className="bg-uw-text-2/40" label="At a loss" />
        <Legend className="h-3 w-0.5 rounded-none bg-upstox-black" label="Long-term line" />
      </div>
    </DemoCard>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block size-2.5 rounded-full', className)} />
      {label}
    </span>
  )
}

function DecisionTiles() {
  const { report, openPanel } = useDemo()
  const planning = useSellPlanning()
  const tiles = [
    {
      title: 'Tax if you sold everything today',
      value: inr(Math.max(0, report.totalTaxIfSoldToday)),
      note: report.totalTaxIfSoldToday < 0 ? 'Selling would cut this year’s tax' : 'Short- and long-term rules applied to each lot',
      panel: null as Panel | null,
      kind: 'NEW' as const,
    },
    {
      title: planning ? 'Gains you could book tax-free' : 'Long-term gains inside your tax-free limit',
      value: inr(report.bookTaxFree.total),
      note: `${inr(report.limit.left)} of the ${inr(report.limit.limit)} limit left this year. ${LTCG_BASIS_NOTE}`,
      panel: planning && report.strategies.gainHarvest.show ? ({ kind: 'harvest' } as Panel) : null,
      kind: 'NEW' as const,
    },
    {
      title: 'Losses that could offset gains',
      value: report.lossesToUse.show ? inr(report.lossesToUse.losses) : '—',
      note: report.lossesToUse.show ? `Realizing them may offset eligible gains (about ${inr(report.lossesToUse.taxCut)} less tax)` : 'No unrealized losses to set against gains',
      panel: report.lossesToUse.show ? ({ kind: 'loss' } as Panel) : null,
      // Upstox's tax-loss harvesting already covers losses: context here, with a link to it.
      kind: 'CONTEXT' as const,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((t) => {
        const inner = (
          <div className={cn('h-full rounded-uw-card bg-white p-4 shadow-card', t.kind === 'NEW' ? 'border-2 border-uw-purple/70' : 'border border-uw-band')}>
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-uw-text-2">
              {t.title}
              <Tag kind={t.kind} />
            </div>
            <div className={cn('tabular mt-1 font-semibold text-uw-text', t.kind === 'NEW' ? 'text-2xl' : 'text-lg')}>{t.value}</div>
            <div className="mt-1 text-xs text-uw-text-2">{t.note}</div>
            {t.panel && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-uw-purple">
                {t.kind === 'NEW' ? 'See how' : 'Details and Upstox tax-loss harvesting'} <ArrowRight className="size-3" />
              </div>
            )}
          </div>
        )
        return t.panel ? (
          <PanelButton key={t.title} onClick={() => openPanel(t.panel!)} className="rounded-uw-card">
            {inner}
          </PanelButton>
        ) : (
          <div key={t.title}>{inner}</div>
        )
      })}
    </div>
  )
}

function SellSimulator() {
  const { report, input, state } = useDemo()
  const holdings = report.holdings
  const [symbol, setSymbol] = useState(holdings[0]?.symbol ?? '')
  const current = holdings.find((h) => h.symbol === symbol) ?? holdings[0]
  const [qtyText, setQtyText] = useState('')
  const [day, setDay] = useState(state.today)
  // MF units carry 3 decimals: round away float artifacts (1040.0620000000001).
  const qty = qtyText === '' ? Number((current?.qty ?? 0).toFixed(3)) : Number(qtyText)
  const sellDay = day < state.today ? state.today : day

  const result = useMemo(() => {
    if (!current) return null
    if (!Number.isFinite(qty) || qty <= 0 || qty > current.qty) return { error: `Enter 1 to ${current.qty} units.` }
    try {
      return { sim: simulateSell(input, state.settings, { symbol: current.symbol, qty, day: sellDay }) }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [current, qty, input, state.settings, sellDay])

  if (!current) return null
  return (
    <DemoCard kind="NEW" id="simulate" title="Simulate a sell">
      <p className="-mt-1 text-xs text-uw-text-2">Pick a holding, a quantity and a date. The engine compares tax on that date with the first long-term day. Prices stay at today’s LTP.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
          Holding
          <Select
            value={current.symbol}
            onValueChange={(v) => {
              setSymbol(v)
              setQtyText('')
            }}
          >
            <SelectTrigger className="w-full bg-white text-uw-text" aria-label="Holding">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {holdings.map((h) => (
                <SelectItem key={h.symbol} value={h.symbol}>
                  {h.symbol} ({(h.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
          Quantity
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={current.qty}
            value={qtyText === '' ? Number(current.qty.toFixed(3)) : qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-2.5 text-sm text-uw-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
          Sell on
          <input
            type="date"
            min={state.today}
            value={sellDay}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-2.5 text-sm text-uw-text"
          />
        </label>
      </div>
      {result && 'error' in result && <p className="text-sm text-uw-down">{result.error}</p>}
      {result && 'sim' in result && result.sim && (
        <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
          <div className="rounded-xl bg-uw-band/50 p-3">
            <div className="text-xs text-uw-text-2">Sell {(result.sim.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })} on {formatDay(result.sim.day)}</div>
            <div className="tabular text-xl font-semibold text-uw-text">
              {result.sim.taxOnDay < 0 ? `Tax cut ${inr(-result.sim.taxOnDay)}` : `Tax ${inr(result.sim.taxOnDay)}`}
            </div>
            <div className="text-xs text-uw-text-2">
              Gain {signed(result.sim.gain)} on {inr(result.sim.proceeds)}
            </div>
          </div>
          <div className={cn('rounded-xl p-3', result.sim.waitUntil ? 'bg-uw-banner ring-1 ring-uw-banner-border' : 'bg-uw-band/50')}>
            {result.sim.waitUntil ? (
              <>
                <div className="text-xs text-uw-text-2">Sell on or after {formatDay(result.sim.waitUntil)}</div>
                <div className="tabular text-xl font-semibold text-uw-purple">Tax {inr(result.sim.taxOnWaitDay ?? 0)}</div>
                <div className="text-xs font-medium text-uw-purple">
                  {result.sim.saving > 0 ? `Waiting saves ${inr(result.sim.saving)}` : 'No tax either way: waiting saves nothing'}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-uw-text-2">First long-term day</div>
                <div className="text-sm font-medium text-uw-text">
                  {result.sim.gain <= 0 ? 'A loss: waiting doesn’t lower the tax' : 'Already long-term on this date: nothing to wait for'}
                </div>
              </>
            )}
          </div>
          {result.sim.lots.length > 1 && (
            <ul className="text-xs text-uw-text-2 sm:col-span-2">
              {result.sim.lots.map((l, i) => (
                <li key={i}>
                  Lot {i + 1}: {(l.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })} bought {l.acquired ? formatDay(l.acquired) : '(date unknown)'} ·{' '}
                  {l.longTerm ? 'long-term' : `long-term from ${l.longTermFrom ? formatDay(l.longTermFrom) : '—'}`} · {signed(l.gain)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DemoCard>
  )
}

export function HoldingsView() {
  const { report, setView } = useDemo()
  const stocks = report.holdings.filter((h) => !isMfClass(h.assetClass))
  const [tab, setTab] = useState<'stocks' | 'mf'>(stocks.length === 0 && report.mf.show ? 'mf' : 'stocks')
  const value = report.holdings.reduce((a, h) => a + h.value, 0)
  const cost = report.holdings.reduce((a, h) => a + h.cost, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-uw-text">Holdings ({report.holdings.length})</h2>
            <p className="text-xs text-uw-text-2">{report.mf.show ? 'Equity · delivery · mutual funds' : 'Equity · delivery'}</p>
          </div>
          <dl className="tabular grid grid-cols-3 gap-4 text-right text-sm sm:gap-8">
            <div>
              <dt className="text-xs text-uw-text-2">Current value</dt>
              <dd className="font-medium text-uw-text">{inr(value)}</dd>
            </div>
            <div>
              <dt className="text-xs text-uw-text-2">Invested</dt>
              <dd className="font-medium text-uw-text">{inr(cost)}</dd>
            </div>
            <div>
              <dt className="text-xs text-uw-text-2">Total P&amp;L</dt>
              <dd className="font-medium">
                <PnL value={value} cost={cost} />
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 rounded-xl border border-uw-banner-border bg-uw-banner px-4 py-3 text-sm text-uw-text sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-uw-purple" aria-hidden />
          <span>
            <b className="text-uw-purple">New:</b> Tax &amp; cost insights. See what you keep after tax and charges, before you sell.
          </span>
        </span>
        <Button size="sm" className="bg-uw-purple hover:bg-uw-logo" onClick={() => setView('insights')}>
          Open insights
        </Button>
      </div>

      {/* Upstox web keeps mutual funds under Holdings: Stocks | Mutual funds */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'stocks' | 'mf')} className="gap-3">
        <TabsList className="bg-white">
          <TabsTrigger value="stocks" className="px-4">
            Stocks ({stocks.length})
          </TabsTrigger>
          <TabsTrigger value="mf" className="px-4">
            Mutual funds ({report.mf.funds.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stocks" className="flex flex-col gap-4">
          {/* The gate comes before any chip or tile: intent is established first (PRODUCT.md §5.1). */}
          <IntentGate />
          <HoldingsTable />
          {stocks.length > 0 && (
            <>
              <DecisionTiles />
              <Timeline />
            </>
          )}
        </TabsContent>
        <TabsContent value="mf">
          <MutualFundsView />
        </TabsContent>
      </Tabs>
      {report.holdings.length > 0 && <SellSimulator />}
      <EstimateNote />
    </div>
  )
}
