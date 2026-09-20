// The case study at "/case-study" (PRODUCT.md §5): hero, the problem, what exists vs what's new,
// how it works, assumptions & limits, roadmap & success metrics, sources. The interactive product
// frame is NOT here: it is the page at "/". Case-study palette (TECH.md §8.2).
import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, HelpCircle, X } from 'lucide-react'
import { analyze, formatDay, POSITIONING, RULES_AS_OF, UPSTOX_TLH_URL } from '@/engine'
import { R2_LTCG_EXEMPTION, R11_REBATE_INCOME_LIMIT } from '@/engine/rules'
import { buildInput, initialState } from '@/demo/scenario'
import { inr } from '@/demo/ui'
import { DEFAULT_PERSONA_ID } from '@/sample/personas'
import { SOURCES } from './sources'

const L = (p: number) => `₹${(p / 100 / 1_00_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`

function Section({ id, eyebrow, title, children, className }: { id?: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 px-4 py-14 sm:scroll-mt-20 sm:py-20 ${className ?? ''}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id ? `${id}-title` : undefined} className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-upstox-black sm:text-4xl">
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

function Nav() {
  const links = [
    ['Problem', '#problem'],
    ['How it works', '#how'],
    ['Roadmap', '#roadmap'],
    ['Metrics', '#metrics'],
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3">
        <a href="/" className="flex items-center gap-1.5 text-sm font-semibold text-upstox-black hover:text-upstox-purple">
          <ArrowLeft className="size-4" /> Back to the product
        </a>
        <nav aria-label="Page sections" className="flex gap-4 text-sm text-muted">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="hover:text-upstox-purple">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  // The hero always tells the default persona's story (Priya, §10), straight from the engine.
  const r = useMemo(() => {
    const s = initialState(DEFAULT_PERSONA_ID)
    return analyze(buildInput(s), s.settings)
  }, [])
  const soon = r.strategies.waitForLongTerm[0]
  return (
    <section id="top" className="bg-[radial-gradient(ellipse_at_top_right,var(--color-upstox-wash),transparent_60%)] px-4 pt-14 pb-12 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">PM case study · built on Upstox Developer APIs</p>
        <h1 className="mt-3 max-w-4xl text-4xl leading-[1.1] font-bold tracking-[-0.035em] text-upstox-black sm:text-6xl">
          You made <span className="tabular text-upstox-purple">{inr(r.summary.grossGains)}</span> this year. You’ll keep{' '}
          <span className="tabular text-gain-ink">{inr(r.summary.keep)}</span>.
          {soon && (
            <>
              {' '}
              And {soon.symbol} turns long-term in <span className="tabular text-upstox-purple">{soon.days} days</span>.
            </>
          )}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Upstox’s reports tell you what happened. <b className="text-upstox-black">Tax &amp; Cost Insights</b> tells you what to do before it happens: how much you keep,
          which holdings turn long-term soon, what waiting would save, and what charges cost you.
        </p>
        <p className="mt-3 max-w-2xl text-base font-medium text-upstox-purple-dark">{POSITIONING}</p>
        <p className="mt-3 max-w-2xl text-base text-muted">
          Existing brokerage reports answer <b className="text-upstox-black">“what happened?”</b>. This answers{' '}
          <b className="text-upstox-black">“what does it mean for me before I act?”</b> — and it stops there: it shows the consequence of selling, waiting or doing
          nothing, and never tells you which to choose.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-upstox-purple px-5 py-3 text-sm font-semibold text-white shadow-card hover:bg-upstox-purple-dark"
          >
            Try the product <ArrowRight className="size-4" />
          </a>
          <span className="text-xs text-muted">Sample persona, FY {r.fy.label}, as of {formatDay(r.asOf)}. No login needed.</span>
        </div>
      </div>
    </section>
  )
}

/** 'yes' | 'no' | 'unknown', 'yes:<note>' (a check with a short note), or free text */
type Mark = 'yes' | 'no' | 'unknown' | string
function Cell({ v }: { v: Mark }) {
  if (v === 'yes') return <Check className="mx-auto size-4 text-gain-ink" aria-label="Yes" />
  if (v.startsWith('yes:')) {
    return (
      <span className="flex flex-col items-center">
        <Check className="size-4 text-gain-ink" aria-label="Yes" />
        <span className="text-[0.625rem] leading-tight text-muted">{v.slice(4)}</span>
      </span>
    )
  }
  if (v === 'no') return <X className="mx-auto size-4 text-tax-ink" aria-label="No" />
  if (v === 'unknown') return <HelpCircle className="mx-auto size-4 text-muted" aria-label="Not found" />
  return <span className="text-xs text-muted">{v}</span>
}

function CompareTable({ caption, rows, highlight }: { caption: string; rows: [string, Mark, Mark, Mark][]; highlight?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${highlight ? 'border-upstox-purple' : 'border-border'} bg-surface shadow-card`}>
      <table className="w-full text-sm">
        <caption className={`px-4 py-3 text-left text-sm font-semibold ${highlight ? 'bg-upstox-purple text-white' : 'bg-upstox-wash text-upstox-black'}`}>{caption}</caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left font-medium">Insight</th>
            <th className="w-20 px-2 py-2 font-medium">Upstox</th>
            <th className="w-20 px-2 py-2 font-medium">Zerodha</th>
            <th className="w-20 px-2 py-2 font-medium">Groww</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, c]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-upstox-black">{label}</td>
              <td className="px-2 py-2.5 text-center">
                <Cell v={a} />
              </td>
              <td className="px-2 py-2.5 text-center">
                <Cell v={b} />
              </td>
              <td className="px-2 py-2.5 text-center">
                <Cell v={c} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Problem() {
  const limit = L(R2_LTCG_EXEMPTION)
  const rebate = L(R11_REBATE_INCOME_LIMIT)
  return (
    <Section id="problem" eyebrow="The problem" title="Reports are records of the past. Investors decide before they sell.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-muted">
            Upstox already gives users the raw facts: Ledger, P&amp;L, Dividend, Tax, Holdings and Trade reports. They are downloads you read at ITR time. None of
            them answer the questions an investor has before acting:
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-upstox-black">
            {[
              '“If I sell this today, how much tax do I pay? What if I wait?”',
              '“How much of my profit do I actually keep after tax and charges?”',
              `“Am I wasting my ${limit} tax-free limit this year?”`,
              '“Are ₹20-per-order charges eating my small trades?”',
              `“My income is under ${rebate}, so my stock gains are tax-free, right?” (No.)`,
            ].map((q) => (
              <li key={q} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm shadow-card">
                {q}
              </li>
            ))}
          </ul>
        </div>
        <figure className="flex flex-col justify-center">
          <img
            src="/upstox-reports.png"
            width={957}
            height={232}
            alt="Upstox web, Funds page: the Reports card with Ledger, Profit & Loss, Dividend, Tax, Holdings and Trade report chips"
            className="h-auto w-full rounded-2xl border border-border bg-white shadow-card"
            loading="lazy"
          />
          <figcaption className="mt-3 text-sm text-muted">
            Upstox web · Funds → Reports. <b className="font-medium text-upstox-black">Reports tell you what happened.</b>
          </figcaption>
        </figure>
      </div>

      <figure className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <blockquote className="text-lg font-medium text-upstox-black">
          Thinking the ₹1.25L exemption means no filing is needed “creates a false sense of safety.”
        </blockquote>
        <figcaption className="mt-2 text-sm text-muted">
          Tax experts in{' '}
          <a
            href="https://upstox.com/news/personal-finance/tax/filing-itr-before-july-31-tax-experts-say-first-time-investors-are-struggling-with-ltcg-reporting/article-197763/"
            target="_blank"
            rel="noreferrer"
            className="text-upstox-purple underline underline-offset-2"
          >
            Upstox News, 29 Jul 2026
          </a>
          : first-time investors confuse short- and long-term gains, pick the wrong ITR form, and think gains under ₹1.25L mean no filing is needed.
        </figcaption>
      </figure>

      <h3 className="mt-14 text-xl font-semibold text-upstox-black">What exists vs what’s new</h3>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CompareTable
          caption="Competitors today"
          rows={[
            ['Downloadable tax P&L report', 'yes', 'yes', 'yes'],
            ['Holding age per lot', 'unknown', 'yes', 'unknown'],
            ['Tax-loss harvesting', 'yes:Mar 2025; in-app Mar 2026', 'yes', 'yes'],
            [`Gain harvesting (use the ${limit} limit)`, 'no', 'unknown', 'no'],
            ['Tax estimate before selling', 'no', 'no', 'MF only'],
          ]}
        />
        <CompareTable
          highlight
          caption="New: the reason this feature exists"
          rows={[
            ['“You actually keep ₹X” (profit − tax − charges)', 'no', 'no', 'no'],
            ['Tax if you sold today (unsold holdings)', 'no', 'no', 'MF only'],
            ['Days to long-term + ₹ saved by waiting, per holding', 'no', 'age, no ₹', 'no'],
            ['Tax-free gains you can still book this year', 'no', 'unknown', 'no'],
            ['Charges as % of gains, cost by order size', 'no', 'no', 'no'],
            ['Section 156 (87A) rebate warning', 'no', 'no', 'no'],
            ['Advance tax due, from your trades', 'no', 'no', 'no'],
            ['Lot-level view (oldest sold first), which Upstox users asked for in TLH', 'no', 'age per lot', 'unknown'],
            ['SIP lot split: each instalment’s own tax clock, per fund', 'no', 'unknown', 'unknown'],
            ['Withdraw today at ₹0 tax, stocks + MF under one ₹1.25L limit', 'no', 'no', 'no'],
            ['ELSS unlock tracker: locked vs unlocked, next unlock', 'no', 'no', 'no'],
          ]}
        />
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <caption className="bg-upstox-wash px-4 py-3 text-left font-semibold text-upstox-black">Already in Upstox: link to it, don’t rebuild it</caption>
          <tbody>
            {[
              ['Ledger, P&L, Dividend, Tax, Holdings, Trade reports', 'Funds → Reports'],
              ['Realized short-/long-term split, charges', 'Tax report / Tax P&L download'],
              [
                'Tax-loss harvesting: tax summary, loss-making stocks to sell (FIFO), buy-back nudge after T+1. Losses only, stocks only, no F&O.',
                <a key="tlh" href={UPSTOX_TLH_URL} target="_blank" rel="noreferrer" className="text-upstox-purple underline underline-offset-2">
                  Reports → Tax-loss harvesting
                </a>,
              ],
              ['Tax filing', 'Quicko and ClearTax integrations'],
              ['Holdings with P&L', 'Holdings page, Holdings report'],
            ].map(([a, b]) => (
              <tr key={String(a)} className="border-t border-border align-top">
                <td className="px-4 py-2.5 text-upstox-black">{a}</td>
                <td className="px-4 py-2.5 text-muted">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 rounded-xl border border-upstox-purple/30 bg-upstox-wash px-4 py-3 text-sm text-upstox-black">
        <b>{POSITIONING}</b> Upstox’s tax-loss harvesting already covers losses in March, so this builds on it: losses link straight to it, and everything in the
        “New” table is what it doesn’t cover (gains, the ₹1.25L limit, waiting, charges, lot-level detail, the rest of the year).
      </p>
      <p className="mt-3 text-sm text-muted">
        Mutual funds, said plainly: MF-only tools are catching up. Kuvera shows MF units you can redeem within the ₹1.25L limit, and Groww shows MF tax at
        redemption. What’s new here is the combined stocks + MF view of the one ₹1.25L limit, and the ELSS unlock tracker.
      </p>
    </Section>
  )
}

function HowItWorks() {
  // Three steps in plain words. What is live, recorded or sample is one line underneath; the endpoint
  // list lives in TECH.md §3, not on this page.
  const steps: [string, string][] = [
    ['Upstox data', 'Your holdings, trades, charges and current prices, read from Upstox. Read-only: it can never place an order.'],
    ['Tax engine', 'Rebuilds every purchase lot and applies this year’s tax rules — holding period, the ₹1.25L limit, charges, cess.'],
    ['Decision on screen', 'One line per holding: what selling today would cost, when it turns long-term, and what you actually keep.'],
  ]
  return (
    <Section id="how" eyebrow="How it works" title="Upstox data → tax engine → a decision on screen">
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="relative rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-upstox-purple text-xs font-bold text-white">{i + 1}</span>
              <h3 className="font-semibold text-upstox-black">{title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted">{text}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="absolute top-1/2 -right-3 hidden size-5 -translate-y-1/2 text-upstox-purple sm:block" aria-hidden />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-3xl text-sm text-muted">
        <b className="text-upstox-black">Live from Upstox now:</b> fund NAVs and instrument data.{' '}
        <b className="text-upstox-black">Recorded:</b> the account APIs (holdings, trades, charges, P&amp;L), because a personal app only lets its owner log in and
        that owner has no active demat account. <b className="text-upstox-black">Sample:</b> the persona trades you are clicking through.
      </p>
    </Section>
  )
}

function Assumptions() {
  const limits = [
    'The demo runs on sample data. The owner has no active demat account, and personal Upstox apps only let the owner log in.',
    'Upstox trade history covers 3 financial years. Older lots are known to be long-term, but their cost comes from the average price.',
    'Shares moved in from another broker have no buy trade, so their cost is approximate.',
    'Pre-2018 lots use the 31-Jan-2018 candle high. It isn’t confirmed whether Upstox candles are adjusted for later splits and bonuses.',
    'The ₹1.25L limit is shared across brokers. The app relies on your input for gains booked elsewhere.',
    'Slab-rate tax depends on the income you enter.',
    'What Upstox already offers (e.g. tax-loss harvesting) was checked against public sources only; confirm in the live Upstox app before presenting.',
  ]
  const engine = [
    'Long-term means held more than 12 months: from the day after the 12-month anniversary of the buy date.',
    'Brokerage, GST, exchange, SEBI and DP charges are deductible against capital gains; STT is not. For intraday and F&O, every charge is deductible.',
    'Tax is rounded to the nearest rupee. Tax if sold today assumes no sell-side charges.',
    'Only the new tax regime is encoded. Surcharge marginal relief and rebate marginal relief above ₹12L are not modelled.',
    'Advance tax: for salaried users it covers the tax on your trades (salary tax is covered by TDS); otherwise it covers your total tax (no TDS assumed).',
    'Moving the date keeps prices at the snapshot. Persona charges follow a ₹20/order tariff and are illustrative.',
  ]
  const guardrails = [
    'No order placement, no investment advice, no “buy this” or “sell this”.',
    'Every number is labelled as an estimate and says to check with a CA.',
    'Harvesting always says to buy back the next day and warns about overnight price risk.',
    'The demo frame carries a “Concept · Not an official Upstox product” badge. The page never presents itself as upstox.com.',
  ]
  const list = (items: string[]) => (
    <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  )
  return (
    <Section id="assumptions" eyebrow="Assumptions & limits" title="What the numbers are, and what they aren’t" className="bg-[#FBFAFD]">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="font-semibold text-upstox-black">Guardrails</h3>
          {list(guardrails)}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="font-semibold text-upstox-black">Known limits</h3>
          {list(limits)}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="font-semibold text-upstox-black">Engine assumptions</h3>
          {list(engine)}
        </div>
      </div>
      <p className="mt-5 text-sm font-medium text-upstox-black">
        {RULES_AS_OF} Income-tax Act, 2025 as amended by Finance Act 2026: new sections are shown with the old one in brackets, e.g. “Sec 198 (earlier 112A)”.
      </p>
    </Section>
  )
}

function Roadmap() {
  const steps = [
    ['v1', 'Ship as an extension of the tax-loss harvesting page (same data, same FIFO lots), then move to Holdings chips + insights for stocks & ETFs'],
    ['v2', 'Mutual funds'],
    ['v3', 'Intraday & F&O'],
    ['v4', 'Advance-tax reminders'],
    ['Later', 'Real reminders (scheduled notifications) and a before-you-sell tax line on the Sell screen'],
  ]
  const metrics = [
    ['Primary', 'The “missed long-term” rate: % of short-term sells made within 30 days of turning long-term. It should fall.'],
    ['', '% of users who delay a sale after seeing a “wait N days” chip'],
    ['', '₹ tax and charges saved per active user per year'],
    ['', '% of users with long-term gains who leave the ₹1.25L limit unused at 31 March (should fall)'],
    ['', 'Insights card opens per month, and repeat visits'],
    ['', 'Support tickets about tax statements (should fall)'],
  ]
  return (
    <Section id="roadmap" eyebrow="Roadmap & success metrics" title="Ship the chips first, measure the missed long-term rate">
      <ol className="grid gap-3 sm:grid-cols-5">
        {steps.map(([v, t]) => (
          <li key={v} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="text-xs font-bold text-upstox-purple">{v}</div>
            <div className="mt-1 text-sm text-upstox-black">{t}</div>
          </li>
        ))}
      </ol>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-upstox-black">Success metrics (if shipped in Upstox)</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {metrics.map(([tag, m]) => (
              <li key={m} className="flex gap-2 text-muted">
                {tag ? <span className="h-fit rounded bg-upstox-purple px-1.5 text-[0.625rem] font-bold text-white">{tag}</span> : <span className="text-upstox-purple">•</span>}
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-upstox-wash p-5">
            <h3 className="font-semibold text-upstox-black">Validate before building</h3>
            <p className="mt-2 text-sm text-muted">
              From its own data, Upstox can measure the missed long-term rate and the ₹ of tax users paid that waiting would have avoided. If these are small, the
              feature isn’t worth building.
            </p>
          </div>
          <div className="rounded-2xl border border-warn-border bg-warn-bg p-5">
            <h3 className="font-semibold text-warn-ink">The honest trade-off</h3>
            <p className="mt-2 text-sm text-warn-ink">
              Better decision support may mean <b>fewer</b> transactions, not more: a user who sees the tax on a sale may decide not to make it. That is a real
              revenue question, and a hypothesis to test rather than a claim to assert — see{' '}
              <a href="#metrics" className="underline">
                Metrics &amp; experimentation
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------------ Metrics & experimentation (PM)

function Metrics() {
  const secondary = [
    'Active-user rate and repeat investing/trading',
    'Feature engagement: insight opens, repeat visits, chips expanded',
    'Reactivation of dormant users',
    'Revenue per retained user (not revenue per trade)',
    'Legitimate transaction conversion: sales the user already intended',
  ]
  const trust: [string, string][] = [
    ['Tax-insight → transaction conversion', 'Watched, never maximised'],
    ['% of transactions where the user had prior sell/redeem intent', 'Should be high'],
    ['Support complaints about tax or trading suggestions', 'Should not rise'],
    ['Comprehension: “Did this insight help you understand your decision?”', 'Should rise'],
    ['Accuracy: displayed tax vs the year-end tax statement', 'Reconciliation rate'],
  ]
  const tradeoffs: [string, string][] = [
    ['User value', 'Less tax confusion, less manual calculation, a clear view of what a sale or redemption actually costs.'],
    ['Upstox value', 'Potentially better engagement, retention and trust, and transactions that are better informed.'],
    ['Potential downside', 'Some users may trade less once they can see the tax and charges. That cost is real and has to be measured, not assumed away.'],
  ]
  const box = 'rounded-2xl border border-border bg-surface p-5 shadow-card'
  return (
    <Section id="metrics" eyebrow="Metrics & experimentation" title="Decision confidence before a financial action">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className={box}>
          <h3 className="font-semibold text-upstox-black">The north star</h3>
          <p className="mt-2 text-sm text-muted">
            <b className="text-upstox-black">% of users who view an insight and then act with a clear understanding of the tax and cost consequence</b> — not
            the number of trades generated. Where that cannot be measured directly, the comprehension and intent metrics below stand in for it.
          </p>
          <h3 className="mt-5 font-semibold text-upstox-black">The business hypothesis</h3>
          <p className="mt-2 text-sm text-muted">
            This feature may <b className="text-upstox-black">reduce</b> some unnecessary transactions, which is a short-term transaction-revenue trade-off. The bet
            is that it improves trust, retention, engagement, reactivation and the quality of the decisions users make, and that those outweigh it. So the question
            is not “does this generate more trades?” but:
          </p>
          <p className="mt-2 rounded-xl bg-upstox-wash p-3 text-sm font-medium text-upstox-purple-dark">
            Does the long-term value created by better decision support outweigh any short-term transaction revenue lost from unnecessary trades?
          </p>
          <p className="mt-2 text-sm text-muted">
            No revenue growth is claimed here. This is an empirical product hypothesis that should be validated through experimentation.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className={box}>
            <h3 className="font-semibold text-upstox-black">The experiment</h3>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-upstox-black">Control</dt>
                <dd className="text-muted">Today’s Upstox experience.</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-upstox-black">Treatment</dt>
                <dd className="text-muted">Tax &amp; Cost Insights, with the intent gate on by default.</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-upstox-black">Primary</dt>
                <dd className="text-muted">30-day and 90-day retention.</dd>
              </div>
            </dl>
            <h4 className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">Secondary</h4>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-muted">
              {secondary.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-warn-border bg-warn-bg p-5">
            <h3 className="font-semibold text-warn-ink">Guardrail: unnecessary-action rate</h3>
            <p className="mt-2 text-sm text-warn-ink">
              The share of users who execute a transaction shortly after seeing a tax insight <b>despite showing no prior sell or redeem intent</b>. It says whether
              the product is serving intent that already existed or manufacturing new trading activity. If it rises, the feature is doing the wrong thing, however
              good retention looks.
            </p>
          </div>
        </div>
      </div>
      <div className={`${box} mt-4`}>
        <h3 className="font-semibold text-upstox-black">Trust and safety metrics</h3>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {trust.map(([m, why]) => (
            <li key={m} className="flex flex-col rounded-xl border border-border bg-white p-3">
              <span className="text-upstox-black">{m}</span>
              <span className="text-xs text-muted">{why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">The goal is not maximum transaction conversion. It is better-informed decisions and long-term user value.</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {tradeoffs.map(([h, t]) => (
          <div key={h} className="rounded-2xl border border-border bg-upstox-wash p-4">
            <h4 className="text-sm font-semibold text-upstox-black">{h}</h4>
            <p className="mt-1 text-sm text-muted">{t}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Sources() {
  return (
    <footer className="border-t border-border bg-upstox-black px-4 py-12 text-white/80">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-lg font-semibold text-white">Sources</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((g) => (
            <div key={g.group}>
              <h3 className="text-xs font-semibold tracking-wider text-upstox-purple-light uppercase">{g.group}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {g.links.map(([label, href]) => (
                  <li key={href + label}>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="break-words underline decoration-white/30 underline-offset-2 hover:text-white">
                        {label}
                      </a>
                    ) : (
                      <span>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-white/60">
          Concept by Varun Tripathi · Not an official Upstox product · Estimates only, not tax advice. {RULES_AS_OF}
        </p>
      </div>
    </footer>
  )
}

export function CaseStudy() {
  return (
    <>
      <a href="#problem" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Assumptions />
        <Roadmap />
        <Metrics />
        <section className="border-t border-border bg-white px-4 py-12 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-upstox-purple px-5 py-3 text-sm font-semibold text-white shadow-card hover:bg-upstox-purple-dark"
          >
            Try the product <ArrowRight className="size-4" />
          </a>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted">
            The working demo: six personas, live recalculation, and every number from the tax engine.
          </p>
        </section>
      </main>
      <Sources />
    </>
  )
}
