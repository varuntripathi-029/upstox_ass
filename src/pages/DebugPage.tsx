// TEMPORARY debug page (stage 1): the engine's output for the sample persona, as plain tables.
// Replaced by the real UI in stage 2.
import type { ReactNode } from 'react'
import { analyze, chipText, formatDay, formatINR, RULES_AS_OF, waitPanel, type LotView } from '@/engine'
import { samplePortfolio, sampleSettings } from '@/sample/portfolio'

const report = analyze(samplePortfolio, sampleSettings)

const inr = (p: number) => formatINR(p)
const pct = (x: number, d = 1) => `${x.toFixed(d)}%`
const day = (d: string | null) => (d ? formatDay(d) : '—')

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold text-upstox-purple">
        <span className="mr-2 rounded bg-upstox-wash px-1.5 py-0.5 text-xs">{id}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
      <table className="tabular w-full text-left text-sm">
        <thead className="bg-upstox-wash text-xs text-muted">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const kv = (pairs: [string, ReactNode][]) => <Table head={['Metric', 'Value']} rows={pairs.map(([k, v]) => [k, v])} />

const lotRow = (l: LotView): ReactNode[] => [
  l.symbol,
  l.qty,
  day(l.acquired),
  l.daysHeld ?? '—',
  l.longTerm ? 'long-term' : `${l.daysLeft} (long-term from ${day(l.longTermFrom)})`,
  <span key="gain" className={l.gain < 0 ? 'text-tax-ink' : 'text-gain-ink'}>{inr(l.gain)}</span>,
  inr(l.taxToday),
  l.taxOnceLongTerm === null ? '—' : inr(l.taxOnceLongTerm),
  inr(l.savingByWaiting),
]

export default function DebugPage() {
  const r = report
  const s = r.summary
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-upstox-purple uppercase">Temporary debug page · Sample data</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Tax engine output</h1>
      <p className="mb-6 text-sm text-muted">
        FY {r.fy.label} · as of {day(r.asOf)} · salary {inr(r.settings.otherIncomePaise)} (new regime) · {samplePortfolio.trades.length} raw trades · {RULES_AS_OF}
      </p>

      <Section id="A" title="Summary strip">
        {kv([
          ['A1 Gross gains this year', inr(s.grossGains)],
          ['A2 Estimated tax so far', inr(s.tax)],
          ['A3 Charges paid', `${inr(s.charges)} (${pct(s.chargesPctOfGross)} of gross)`],
          ['A4 You actually keep', <b key="keep">{`${inr(s.keep)} (${pct(s.keepPct)})`}</b>],
        ])}
      </Section>

      <Section id="B" title="Tax by bucket">
        <Table
          head={['Bucket', 'Realized gain', 'Losses set off', 'Taxable', 'Rate', 'Tax']}
          rows={r.buckets.filter((b) => b.active).map((b) => [b.label, inr(b.gains), inr(b.lossesSetOff), inr(b.taxable), b.rate, inr(b.tax)])}
        />
        <div className="mt-3">
          {kv([
            ['B1 Tax-free limit used', `${inr(r.limit.used)} of ${inr(r.limit.limit)} (Upstox ${inr(r.limit.usedUpstox)} + other brokers ${inr(r.limit.usedOtherBrokers)})`],
            ['B1 Limit left', `${inr(r.limit.left)} · resets ${day(r.limit.resetsOn)}`],
            ['B2 Loss set-off saving', r.lossSetOff ? `${inr(r.lossSetOff.losses)} of losses cut your tax by ${inr(r.lossSetOff.taxSaved)}` : '—'],
            ['B3 Section 156 warning', r.section156.show ? `SHOWN · total income ${inr(r.section156.totalIncome)} ≤ ₹12L, rebate doesn't cover ${inr(r.section156.stockTax)} of stock tax` : 'not shown'],
            ['B3 Unused basic exemption (R10)', r.section156.unusedBasicExemption.show ? `absorbs ${inr(r.section156.unusedBasicExemption.absorbed)}` : 'n/a (other income ≥ ₹4L)'],
            ['B4 Losses carried forward', r.carryForward.length ? r.carryForward.map((c) => `${c.label} ${inr(c.amount)} (${c.years} yrs)`).join('; ') : 'none'],
          ])}
        </div>
      </Section>

      <Section id="C1–C2" title="Holdings">
        <Table
          head={['Stock', 'Qty', 'Avg cost', 'LTP', 'Unrealized', 'ST / LT', 'Tax if sold today', 'Chip']}
          rows={r.holdings.map((h) => [
            h.symbol,
            h.qty,
            inr(h.avgCost),
            inr(h.ltp),
            <span key="u" className={h.unrealized < 0 ? 'text-tax-ink' : 'text-gain-ink'}>{inr(h.unrealized)}</span>,
            `${inr(h.unrealizedShortTerm)} / ${inr(h.unrealizedLongTerm)}`,
            h.taxIfSoldToday < 0 ? `saves ${inr(-h.taxIfSoldToday)}` : inr(h.taxIfSoldToday),
            h.chip ? chipText(h.chip) : '—',
          ])}
        />
        <p className="mt-1 text-xs text-muted">Total tax if everything were sold today: {inr(r.totalTaxIfSoldToday)}</p>
      </Section>

      <Section id="C3–C4" title="Turning long-term soon (lots)">
        <Table head={['Stock', 'Qty', 'Bought', 'Days held', 'Days left (date)', 'Gain', 'Tax today', 'Tax once LT', 'Saved by waiting']} rows={r.timeline.map(lotRow)} />
      </Section>

      <Section id="C5–C6" title="Book tax-free · losses you can use">
        {kv([
          ['C5 Gains you can book tax-free', `${inr(r.bookTaxFree.total)} (${r.bookTaxFree.byHolding.map((b) => `${b.symbol} ${inr(b.amount)}`).join(', ') || '—'})`],
          ['C6 Losses you can use', r.lossesToUse.show ? `${inr(r.lossesToUse.losses)} in ${r.lossesToUse.symbols.join(', ')} → cuts tax by ${inr(r.lossesToUse.taxCut)}` : 'not shown'],
        ])}
      </Section>

      <Section id="D" title="Charges">
        <Table head={['Type', 'Amount']} rows={Object.entries(r.charges.byType).map(([k, v]) => [k, inr(v)])} />
        <div className="mt-3">
          <Table
            head={['Month', 'Total', 'Brokerage', 'STT', 'GST', 'DP', 'Other']}
            rows={r.charges.byMonth.map((m) => [m.month, inr(m.total), inr(m.brokerage), inr(m.stt), inr(m.gst), inr(m.dp), inr(m.exchange + m.sebi + m.stamp)])}
          />
        </div>
        <div className="mt-3">
          <Table
            head={['Order size', 'Orders', 'Order value', 'Charges', 'Cost % of value']}
            rows={r.charges.orderSize.map((o) => [o.label, o.orders, inr(o.value), inr(o.charges), pct(o.pctOfValue, 2)])}
          />
        </div>
        <div className="mt-3">
          {kv([
            ['D3 Charges as % of gross gains', pct(r.charges.pctOfGross)],
            ['D5 Orders under ₹2k', `${r.charges.smallOrders.count} of ${r.charges.smallOrders.totalOrders} orders · cost ${inr(r.charges.smallOrders.cost)}`],
            ['D6 Split', `delivery ${inr(r.charges.split.delivery)} · intraday ${inr(r.charges.split.intraday)} · F&O ${inr(r.charges.split.fno)}`],
          ])}
        </div>
      </Section>

      <Section id="E" title="Intraday & F&O">
        {kv([
          ['E1 Intraday net', inr(r.trading.intraday.net)],
          ['E2 Intraday turnover (ICAI)', inr(r.trading.intraday.turnover)],
          ['E4 Intraday tax', inr(r.trading.intraday.tax)],
          ['E1 F&O net', r.trading.fno.present ? inr(r.trading.fno.net) : 'no F&O'],
          ['E3 F&O charges % of turnover', r.trading.fno.present ? pct(r.trading.fno.chargesPctOfTurnover, 2) : '—'],
          ['Note', r.trading.sttNote],
        ])}
      </Section>

      <Section id="F" title="Filing pointer">
        {kv([
          ['F1 ITR form', `${r.filing.itr} · ${r.filing.reason}`],
          ['F2 Advance tax', r.filing.advanceTax.applies ? `${inr(r.filing.advanceTax.next!.amount)} by ${day(r.filing.advanceTax.next!.date)}` : `not applicable (tax ${inr(r.filing.advanceTax.total)} ≤ ₹10,000)`],
          ['F3 Filing deadline', day(r.filing.deadline)],
        ])}
      </Section>

      <Section id="§8" title="Strategy panels">
        <Table
          head={['Panel', 'Shown', 'Figures']}
          rows={[
            ...r.strategies.waitForLongTerm.map((w) => {
              const p = waitPanel(w)
              return [`${p.headline} (${w.symbol})`, 'yes', `${p.today} · ${p.later} · [${p.remind}]`]
            }),
            [
              'Book tax-free, keep your shares',
              r.strategies.gainHarvest.show ? 'yes' : 'no',
              `${inr(r.strategies.gainHarvest.bookable)} → future tax saved ${inr(r.strategies.gainHarvest.taxSaved)} − est. cost ${inr(r.strategies.gainHarvest.estimatedCost)} = ${inr(r.strategies.gainHarvest.netSaving)}`,
            ],
            ['Use losses', r.strategies.lossHarvest.show ? 'yes' : 'no', `${inr(r.strategies.lossHarvest.losses)} of losses → tax cut ${inr(r.strategies.lossHarvest.taxCut)}`],
            [
              'Save on charges',
              'yes',
              `≈${inr(r.strategies.charges.perYear)} a year (small-order excess ${inr(r.strategies.charges.smallOrderExcess)}, cap ${inr(r.strategies.charges.cap)}, over ${r.strategies.charges.annualizationDays} days)`,
            ],
            ['Section 156', r.strategies.section156.show ? 'yes' : 'no', `stock tax ${inr(r.strategies.section156.stockTax)}`],
            ['Advance tax', r.strategies.advanceTax.show ? 'yes' : 'no', r.strategies.advanceTax.date ? `${inr(r.strategies.advanceTax.amount)} by ${day(r.strategies.advanceTax.date)}` : '—'],
          ]}
        />
      </Section>

      <Section id="!" title="Engine warnings">
        <p className="text-sm text-muted">{r.warnings.length ? r.warnings.join(' · ') : 'None: every holding is explained by the trade history.'}</p>
      </Section>

      <p className="text-xs text-muted">Estimate from your Upstox trades · Not tax advice · Confirm with a CA.</p>
    </main>
  )
}
