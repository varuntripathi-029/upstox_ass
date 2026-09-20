// Insights view (Funds → Reports → Tax & cost insights). Every figure comes from the engine report.
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Info } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { formatDay, GAIN_HARVEST_NOTE, KEEP_CONTRAST, KEEP_TITLE, MF_CHARGES_NOTE, profitTakeaway, type Report } from '@/engine'
import { SECTIONS } from '@/engine/rules'
import type { Settings } from '@/engine/types'
import { cn } from '@/lib/utils'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDemo, type Panel } from './DemoContext'
import { SourceTag } from './DataSource'

const sourceLabel = {
  sample: 'Sample data',
  live: 'Sample data + live Upstox prices',
  account: 'Demo account (recorded API responses)',
} as const
import { DemoCard, EstimateNote, inr, PanelButton, pct, SampleBadge, Tag } from './ui'

/** D4 percentages: one decimal from 1%, two below (1.9% · 0.65% · 0.29%) */
const costPct = (x: number) => pct(x, x >= 1 ? 1 : 2)

// TECH.md §8 chart colours
const C = {
  keep: '#00D4AA',
  tax: '#FF6B6B',
  charges: '#FFB830',
  brokerage: '#542087',
  stt: '#9B6DFF',
  gst: '#4DA8FF',
  dp: '#FFB830',
  other: '#CFC8DA',
}

// ------------------------------------------------------------------ settings bar (§6)

function RupeeInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (paise: number) => void }) {
  const rupees = Math.round(value / 100)
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-uw-text-2">
      {label}
      <div className="flex h-9 items-center rounded-md border border-input bg-white px-2.5 focus-within:outline-2 focus-within:outline-uw-purple">
        <span className="mr-1 text-sm text-uw-text-2">₹</span>
        <input
          id={id}
          inputMode="numeric"
          className="tabular w-full min-w-0 bg-transparent text-sm text-uw-text outline-none"
          value={rupees.toLocaleString('en-IN')}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
            onChange(Number(digits || '0') * 100)
          }}
        />
      </div>
    </label>
  )
}

function SettingsBar() {
  const { state, setSettings, report, dataSource } = useDemo()
  const s = state.settings
  const set = (patch: Partial<Settings>) => setSettings({ ...s, ...patch })
  return (
    <div className="rounded-uw-card border border-uw-band bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-uw-text">Your settings</h3>
        <div className="flex items-center gap-2 text-xs text-uw-text-2">
          <span className="font-medium text-uw-text">{sourceLabel[dataSource]}</span>
          <SourceTag kind="nav" />
          <SourceTag kind="price" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
          Financial year
          <Select value={report.fy.label}>
            <SelectTrigger className="w-full bg-white text-uw-text" aria-label="Financial year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={report.fy.label}>{report.fy.label} (current)</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
          Tax regime
          <Select value="new">
            <SelectTrigger className="w-full bg-white text-uw-text" aria-label="Tax regime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New regime</SelectItem>
              <SelectItem value="old" disabled>
                Old regime (not encoded yet)
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="flex flex-col gap-1">
          <RupeeInput id="other-income" label="Other taxable income (salary etc.)" value={s.otherIncomePaise} onChange={(v) => set({ otherIncomePaise: v })} />
          <label className="flex items-center gap-1.5 text-[0.6875rem] text-uw-text-2">
            <input
              type="checkbox"
              checked={s.otherIncomeIsSalary}
              onChange={(e) => set({ otherIncomeIsSalary: e.target.checked })}
              className="accent-uw-purple"
            />
            It’s salary (₹75,000 standard deduction)
          </label>
        </div>
        <RupeeInput
          id="other-broker"
          label="Long-term equity gains with other brokers"
          value={s.otherBrokerLtcgPaise}
          onChange={(v) => set({ otherBrokerLtcgPaise: v })}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ A. summary strip

function SummaryStrip() {
  const { report, openPanel } = useDemo()
  const s = report.summary
  const tile = 'h-full rounded-uw-card border border-uw-band bg-white p-4'
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={tile}>
        <div className="flex items-center justify-between gap-1 text-xs text-uw-text-2">
          Gross gains this year <Tag kind="CONTEXT" />
        </div>
        <div className="tabular mt-1 text-lg font-semibold text-uw-text">{inr(s.grossGains)}</div>
        <div className="text-[0.6875rem] text-uw-text-2">After losses, before tax and charges</div>
      </div>
      <div className={tile}>
        <div className="flex items-center justify-between gap-1 text-xs text-uw-text-2">
          Estimated tax so far <Tag kind="CONTEXT" />
        </div>
        <div className="tabular mt-1 text-lg font-semibold text-tax-ink">{inr(s.tax)}</div>
        <div className="text-[0.6875rem] text-uw-text-2">Incl. 4% cess, after the rebate</div>
      </div>
      <PanelButton onClick={() => openPanel({ kind: 'charges' })} className="rounded-uw-card" label="Charges paid: open the charges panel">
        <div className={tile}>
          <div className="flex items-center justify-between gap-1 text-xs text-uw-text-2">
            Charges paid <Tag kind="CONTEXT" />
          </div>
          <div className="tabular mt-1 text-lg font-semibold text-charge-ink">{inr(s.charges)}</div>
          <div className="text-[0.6875rem] text-uw-text-2">{pct(s.chargesPctOfGross)} of gross gains</div>
        </div>
      </PanelButton>
      <div className="col-span-2 h-full rounded-uw-card bg-uw-purple p-4 text-white shadow-card-hover lg:col-span-1">
        <div className="flex items-center justify-between gap-1 text-xs font-medium text-white/85">
          <span>
            {KEEP_TITLE.replace(' and charges', '')} <b className="text-white">and</b> charges
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[0.625rem] font-bold text-uw-purple">NEW</span>
        </div>
        <div className="tabular mt-1 text-3xl font-bold">{inr(s.keep)}</div>
        <div className="text-xs text-white/85">
          {pct(s.keepPct)} of your gross gains. {KEEP_CONTRAST}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ donut + buckets + limit

const donutConfig = {
  keep: { label: 'You keep', color: C.keep },
  tax: { label: 'Tax', color: C.tax },
  charges: { label: 'Charges', color: C.charges },
} satisfies ChartConfig

function ProfitDonut() {
  const { report, openPanel } = useDemo()
  const s = report.summary
  const data = [
    { key: 'keep', value: Math.max(0, s.keep), fill: C.keep },
    { key: 'tax', value: s.tax, fill: C.tax },
    { key: 'charges', value: s.charges, fill: C.charges },
  ]
  const panelFor = (key: string): Panel | null =>
    key === 'charges' ? { kind: 'charges' } : key === 'tax' && report.section156.show ? { kind: 's156' } : null
  return (
    <DemoCard kind="NEW" id="donut" title="Where your profit went" className="self-start">
      <p className="-mt-1 text-sm font-medium text-uw-text">{profitTakeaway(report)}</p>
      <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ChartContainer config={donutConfig} className="aspect-square h-[180px] w-[180px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={(v, n) => `${donutConfig[n as keyof typeof donutConfig]?.label}: ${inr(Number(v))}`} />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                isAnimationActive={false}
                innerRadius={55}
                outerRadius={85}
                strokeWidth={2}
                onClick={(_d, index) => {
                  const p = panelFor(data[index].key)
                  if (p) openPanel(p)
                }}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={d.fill} className={panelFor(d.key) ? 'cursor-pointer' : ''} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-xl font-bold text-uw-text">{pct(s.keepPct, 0)}</span>
            <span className="text-[0.6875rem] text-uw-text-2">you keep</span>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {data.map((d) => {
            const p = panelFor(d.key)
            const row = (
              <span className="flex w-full items-center justify-between gap-3 px-2 py-1.5">
                <span className="flex items-center gap-2 text-uw-text">
                  <span className="size-3 rounded-sm" style={{ background: d.fill }} />
                  {donutConfig[d.key as keyof typeof donutConfig].label}
                </span>
                <span className="tabular font-medium text-uw-text">
                  {inr(d.value)}
                  {p && <ArrowRight className="ml-1 inline size-3 text-uw-purple" aria-hidden />}
                </span>
              </span>
            )
            return <li key={d.key}>{p ? <PanelButton onClick={() => openPanel(p)} className="rounded-md hover:bg-uw-banner hover:shadow-none">{row}</PanelButton> : row}</li>
          })}
        </ul>
      </div>
    </DemoCard>
  )
}

function LimitMeter() {
  const { report, openPanel } = useDemo()
  const l = report.limit
  const used = Math.min(100, (l.used / l.limit) * 100)
  const body = (
    <div className="rounded-xl border-2 border-uw-purple/70 bg-white p-3">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-uw-text">
        <span className="flex items-center gap-2">
          Tax-free long-term limit <Tag kind="NEW" />
        </span>
        <span className="text-uw-text-2">resets {formatDay(l.resetsOn, 'd MMM')}</span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-upstox-wash"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={l.limit / 100}
        aria-valuenow={l.used / 100}
        aria-label="Tax-free limit used"
      >
        <div className="h-3 rounded-full bg-gain" style={{ width: `${used}%` }} />
      </div>
      <div className="tabular mt-1.5 flex flex-wrap justify-between gap-1 text-xs text-uw-text-2">
        <span>
          Used {inr(l.used)} of {inr(l.limit)}
          {l.usedOtherBrokers > 0 && ` (incl. ${inr(l.usedOtherBrokers)} elsewhere)`}
        </span>
        <b className="text-gain-ink">{inr(l.left)} left</b>
      </div>
      {report.strategies.gainHarvest.show && (
        <div className="mt-1 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-uw-purple">
            Book {inr(report.bookTaxFree.total)} tax-free <ArrowRight className="size-3" />
          </span>
          <span className="mt-0.5 block text-uw-text-2">{GAIN_HARVEST_NOTE}</span>
        </div>
      )}
    </div>
  )
  return report.strategies.gainHarvest.show ? (
    <PanelButton onClick={() => openPanel({ kind: 'harvest' })} className="rounded-xl" label="Tax-free limit: open the gain-harvest panel">
      {body}
    </PanelButton>
  ) : (
    body
  )
}

function BucketsCard() {
  const { report } = useDemo()
  const rows = report.buckets.filter((b) => b.active)
  return (
    <DemoCard kind="CONTEXT" id="buckets" title="Tax by bucket">
      {rows.length === 0 ? (
        <p className="text-sm text-uw-text-2">No gains or losses booked this year.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-uw-band/70">
          {rows.map((b) => (
            <li key={b.id} className="py-2 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-uw-text">{b.label}</span>
                <span className="tabular shrink-0 text-sm font-semibold text-uw-text">{inr(b.tax)}</span>
              </div>
              <div className="text-[0.625rem] text-uw-text-2">{b.rate}</div>
              <dl className="tabular mt-1 grid grid-cols-3 gap-2 text-[0.6875rem] text-uw-text-2">
                <div>
                  <dt>Realized gain</dt>
                  <dd className="text-uw-text">{inr(b.gains)}</dd>
                </div>
                <div>
                  <dt>Losses set off</dt>
                  <dd className="text-uw-text">{b.lossesSetOff ? `−${inr(b.lossesSetOff)}` : '—'}</dd>
                </div>
                <div>
                  <dt>Taxable</dt>
                  <dd className="text-uw-text">{inr(b.taxable)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <LimitMeter />
      {report.lossSetOff && (
        <p className="rounded-lg bg-uw-banner px-3 py-2 text-xs text-uw-text">
          <Tag kind="NEW" /> <span className="ml-1">{inr(report.lossSetOff.losses)} of losses cut your tax by <b>{inr(report.lossSetOff.taxSaved)}</b>.</span>
        </p>
      )}
      {report.carryForward.length > 0 && (
        <div className="text-xs text-uw-text-2">
          <div className="font-medium text-uw-text">Losses carried forward (if you file on time)</div>
          <ul>
            {report.carryForward.map((c) => (
              <li key={c.label}>
                {c.label}: {inr(c.amount)} · {c.years} years
              </li>
            ))}
          </ul>
        </div>
      )}
    </DemoCard>
  )
}

// ------------------------------------------------------------------ B3 warning / R10

function RebateWarning() {
  const { report, openPanel } = useDemo()
  const s = report.section156
  const r10 = s.unusedBasicExemption
  if (!s.show && !(r10.show && r10.absorbed > 0)) return null
  return (
    <PanelButton onClick={() => openPanel(s.show ? { kind: 's156' } : { kind: 'r10' })} className="rounded-uw-card" label="Open the rebate explanation">
      <div className={cn('flex gap-3 rounded-uw-card border p-4', s.show ? 'border-warn-border bg-warn-bg' : 'border-uw-banner-border bg-uw-banner')}>
        {s.show ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn-ink" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0 text-uw-purple" aria-hidden />}
        <div className={cn('text-sm', s.show ? 'text-warn-ink' : 'text-uw-text')}>
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            {s.show ? `${SECTIONS.rebate} rebate doesn’t cover stock gains` : 'Your unused basic exemption absorbs your gains'}
            <Tag kind="NEW" />
          </div>
          {s.show && (
            <p className="mt-1">
              Your income ({inr(s.totalIncome)}) is within the ₹12L rebate, but the rebate doesn’t cover <b>{inr(s.stockTax)}</b> of tax on stock gains.
            </p>
          )}
          {r10.show && r10.absorbed > 0 && (
            <p className="mt-1">
              Your other income is below ₹4L, so the unused part of the basic exemption absorbs {inr(r10.absorbed)} of your gains, saving{' '}
              <b>{inr(r10.taxSaved)}</b>. {inr(r10.left)} of the exemption is still unused.
            </p>
          )}
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium">
            Why? <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </PanelButton>
  )
}

// ------------------------------------------------------------------ D. charges

const orderConfig = { pct: { label: 'Cost % of order value', color: C.brokerage } } satisfies ChartConfig
const monthConfig = {
  brokerage: { label: 'Brokerage', color: C.brokerage },
  stt: { label: 'STT', color: C.stt },
  gst: { label: 'GST', color: C.gst },
  dp: { label: 'DP', color: C.dp },
  other: { label: 'Other', color: C.other },
} satisfies ChartConfig

function ChargesCards() {
  const { report, openPanel } = useDemo()
  const ch = report.charges
  const orderData = ch.orderSize.map((o) => ({ size: o.label, pct: o.pctOfValue, orders: o.orders }))
  // The costliest order-size group (highest charges as % of order value) is highlighted.
  const worst = ch.orderSize.reduce((a, b) => (b.orders && b.pctOfValue > a.pctOfValue ? b : a), ch.orderSize[0])
  const months = ch.byMonth.map((m) => ({
    month: formatDay(`${m.month}-01`, 'MMM'),
    brokerage: m.brokerage / 100,
    stt: m.stt / 100,
    gst: m.gst / 100,
    dp: m.dp / 100,
    other: (m.exchange + m.sebi + m.stamp) / 100,
  }))
  const open = () => openPanel({ kind: 'charges' })
  const totalOrders = ch.smallOrders.totalOrders
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DemoCard
        kind="NEW"
        id="charges-pct"
        title="Charges as % of gains"
        action={
          <button type="button" onClick={open} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-uw-purple hover:underline">
            {report.strategies.charges.perYear > 0 ? `Save ≈${inr(report.strategies.charges.perYear)} a year` : 'How charges add up'} <ArrowRight className="size-3" />
          </button>
        }
      >
        <PanelButton onClick={open} className="rounded-xl hover:shadow-none" label="Open the charges panel">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-xl bg-uw-banner p-3">
            <div>
              <div className="tabular text-3xl font-bold text-charge-ink">{pct(ch.pctOfGross)}</div>
              <div className="text-xs text-uw-text-2">
                of gross gains went on charges
                {report.summary.tax > 0 && report.summary.charges > report.summary.tax && (
                  <b className="text-charge-ink">, {(report.summary.charges / report.summary.tax).toFixed(1)}× your tax</b>
                )}
              </div>
            </div>
            <div>
              <div className="tabular text-lg font-semibold text-uw-text">
                {ch.smallOrders.count} of {totalOrders}
              </div>
              <div className="text-xs text-uw-text-2">cash orders were under ₹2k · cost {inr(ch.smallOrders.cost)}</div>
            </div>
          </div>
        </PanelButton>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-uw-text">
            Cost by order size <Tag kind="NEW" />
          </div>
          {ch.smallOrders.totalOrders === 0 ? (
            <p className="rounded-lg bg-uw-band/40 px-3 py-4 text-xs text-uw-text-2">No stock orders this year.</p>
          ) : (
          <ChartContainer config={orderConfig} className="aspect-auto h-[150px] w-full">
            <BarChart data={orderData} layout="vertical" margin={{ left: 8, right: 40 }} onClick={open}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" dataKey="pct" tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="size" width={64} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, _n, item) => `${Number(v).toFixed(2)}% of order value · ${(item.payload as { orders: number }).orders} orders`} />} />
              <Bar dataKey="pct" radius={4} className="cursor-pointer">
                {orderData.map((d) => (
                  <Cell key={d.size} fill={C.charges} fillOpacity={d.size === worst.label ? 1 : 0.4} />
                ))}
                <LabelList dataKey="pct" position="right" className="fill-uw-text" fontSize={11} formatter={(v: unknown) => costPct(Number(v))} />
              </Bar>
            </BarChart>
          </ChartContainer>
          )}
          <ul className="tabular mt-1 grid grid-cols-3 gap-2 text-center text-[0.6875rem] text-uw-text-2">
            {ch.orderSize.map((o) => (
              <li key={o.id} className={cn('rounded-lg px-1 py-1.5', o.id === worst.id ? 'bg-charge/15 ring-1 ring-charge' : 'bg-uw-band/40')}>
                <div className="font-medium text-uw-text">
                  {o.label}
                  {o.id === worst.id && <span className="ml-1 text-[0.625rem] font-semibold text-charge-ink">costliest</span>}
                </div>
                <div>
                  {o.orders} {o.orders === 1 ? 'order' : 'orders'} · <b className="text-uw-text">{costPct(o.pctOfValue)}</b>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DemoCard>

      <DemoCard kind="CONTEXT" id="charges-month" title="Charges per month">
        <PanelButton onClick={open} className="rounded-xl hover:shadow-none" label="Charges per month: open the charges panel">
          <ChartContainer config={monthConfig} className="aspect-auto h-[190px] w-full">
            <BarChart data={months} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `₹${v}`} tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => `${monthConfig[n as keyof typeof monthConfig]?.label}: ₹${Number(v).toFixed(2)}`} />} />
              {(Object.keys(monthConfig) as (keyof typeof monthConfig)[]).map((k) => (
                <Bar key={k} dataKey={k} stackId="c" fill={monthConfig[k].color} />
              ))}
            </BarChart>
          </ChartContainer>
        </PanelButton>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-uw-text-2">
          {(Object.keys(monthConfig) as (keyof typeof monthConfig)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: monthConfig[k].color }} />
              {monthConfig[k].label}{' '}
              {inr(k === 'other' ? ch.byType.exchange + ch.byType.sebi + ch.byType.stamp : ch.byType[k])}
            </span>
          ))}
        </div>
        <p className="text-xs text-uw-text-2">
          Split: delivery {inr(ch.split.delivery)} · intraday {inr(ch.split.intraday)} · F&amp;O {inr(ch.split.fno)}
        </p>
        {report.mf.charges.orders > 0 && (
          <p className="rounded-lg bg-uw-banner px-3 py-2 text-xs text-uw-text">
            {MF_CHARGES_NOTE} Mutual funds this year: {inr(report.mf.charges.stamp)} stamp duty on {report.mf.charges.orders} orders ({inr(report.mf.charges.amount)} invested),{' '}
            {inr(report.mf.charges.brokerage)} brokerage.
          </p>
        )}
      </DemoCard>
    </div>
  )
}

// ------------------------------------------------------------------ E and F

function TradingCard({ report }: { report: Report }) {
  const t = report.trading
  if (!t.show) return null
  return (
    <DemoCard kind="NEW" id="trading" title="Intraday & F&O">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {t.intraday.present && (
          <div className="rounded-xl bg-uw-band/40 p-3">
            <div className="text-xs font-medium text-uw-text">Intraday (speculative)</div>
            <dl className="tabular mt-1 space-y-0.5 text-xs text-uw-text-2">
              <div className="flex justify-between gap-2"><dt>Net</dt><dd className="font-medium text-uw-text">{inr(t.intraday.net)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Turnover (ICAI)</dt><dd>{inr(t.intraday.turnover)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Tax at your slab</dt><dd className="font-medium text-tax-ink">{inr(t.intraday.tax)}</dd></div>
            </dl>
          </div>
        )}
        <div className="rounded-xl bg-uw-band/40 p-3">
          <div className="text-xs font-medium text-uw-text">F&amp;O (non-speculative)</div>
          {t.fno.present ? (
            <dl className="tabular mt-1 space-y-0.5 text-xs text-uw-text-2">
              <div className="flex justify-between gap-2"><dt>Net</dt><dd className="font-medium text-uw-text">{inr(t.fno.net)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Turnover (ICAI)</dt><dd>{inr(t.fno.turnover)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Charges</dt><dd>{pct(t.fno.chargesPctOfTurnover, 2)} of turnover</dd></div>
              <div className="flex justify-between gap-2"><dt>Tax at your slab</dt><dd className="font-medium text-tax-ink">{inr(t.fno.tax)}</dd></div>
            </dl>
          ) : (
            <p className="mt-1 text-xs text-uw-text-2">No F&amp;O trades this year.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-uw-text-2">{t.sttNote} Turnover per the ICAI guidance note is needed for ITR-3.</p>
    </DemoCard>
  )
}

function FilingCard() {
  const { report, openPanel } = useDemo()
  const f = report.filing
  const a = f.advanceTax
  return (
    <DemoCard kind="NEW" id="filing" title="Filing pointer">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-uw-purple">{f.itr}</span>
        <span className="text-xs text-uw-text-2">{f.reason}</span>
      </div>
      <p className="text-sm text-uw-text">
        File by <b>{formatDay(f.deadline)}</b>
      </p>
      {a.applies && a.next ? (
        <PanelButton onClick={() => openPanel({ kind: 'advance' })} className="rounded-xl" label="Open the advance tax panel">
          <div className="rounded-xl border border-warn-border bg-warn-bg p-3 text-sm text-warn-ink">
            {a.past.length > 0 && (
              <div className="mb-1 text-xs">
                {a.past[a.past.length - 1].cumulativePct}% ({inr(a.past[a.past.length - 1].amount)}) was due by {formatDay(a.past[a.past.length - 1].date)}.
              </div>
            )}
            Next: <b>{inr(a.next.amount)}</b> ({a.next.cumulativePct}% cumulative) by {formatDay(a.next.date)}
            <ArrowRight className="ml-1 inline size-3" />
            <div className="mt-1 text-xs">
              {a.basis === 'total' ? `On your total tax of ${inr(a.total)}, including other income (no TDS assumed).` : `On the ${inr(a.total)} of tax from your trades (salary tax is covered by TDS).`}
            </div>
          </div>
        </PanelButton>
      ) : (
        <p className="text-xs text-uw-text-2">Advance tax: not needed (tax {inr(a.total)} is within ₹10,000).</p>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href="https://upstox.com/market-talk/5-things-traders-and-investors-need-to-know-about-itr-filing/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-uw-purple px-3 py-1.5 text-xs font-medium text-uw-purple hover:bg-uw-banner"
        >
          Open Upstox Tax report <ExternalLink className="size-3" />
        </a>
        {[
          ['File with Quicko', 'https://quicko.com/'],
          ['File with ClearTax', 'https://cleartax.in/'],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-uw-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-uw-logo"
          >
            {label} <ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </DemoCard>
  )
}

// ------------------------------------------------------------------ view

export function InsightsView() {
  const { report, setView } = useDemo()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setView('funds')} className="inline-flex cursor-pointer items-center gap-1 text-xs text-uw-text-2 hover:text-uw-purple">
          <ArrowLeft className="size-3.5" /> Funds › Reports
        </button>
        <SampleBadge />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-uw-text">Tax &amp; cost insights</h2>
        <p className="text-sm text-uw-text-2">
          FY {report.fy.label} · 1 Apr to {formatDay(report.asOf)}. Know what you keep, before you sell.
        </p>
      </div>
      <SettingsBar />
      <SummaryStrip />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfitDonut />
        <BucketsCard />
      </div>
      <RebateWarning />
      <ChargesCards />
      <div className={cn('grid gap-4', report.trading.show && 'lg:grid-cols-2')}>
        <TradingCard report={report} />
        <FilingCard />
      </div>
      <EstimateNote />
    </div>
  )
}
