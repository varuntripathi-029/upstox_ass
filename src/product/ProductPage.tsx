// The product at "/" (PRODUCT.md §5): the Upstox-style app frame IS the page. No hero, no tables, no
// roadmap — that all lives at /case-study. The honesty bits stay: the concept badge at the top of the
// frame and the per-card "Estimate · Not tax advice · Confirm with a CA" footers.
import { ArrowRight } from 'lucide-react'
import { DemoFrame } from '@/demo/DemoFrame'

function ProductNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="/" className="flex flex-col gap-0.5 leading-tight">
          <span className="text-lg font-bold tracking-[-0.02em] text-upstox-black sm:text-xl">Tax &amp; Cost Insights</span>
          {/* Wraps on a phone, one line from sm up, so the header never forces sideways scroll. */}
          <span className="text-sm text-muted sm:whitespace-nowrap">Know what you keep, before you sell.</span>
        </a>
        <a
          href="/case-study"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-upstox-purple px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-upstox-purple-dark sm:px-4 sm:py-2 sm:text-sm"
        >
          Case study <ArrowRight className="size-4" />
        </a>
      </div>
    </header>
  )
}

export function ProductPage() {
  return (
    <>
      <ProductNav />
      <main className="px-3 py-4 sm:px-5 sm:py-6">
        {/* id="demo" marks the frame region: deep links and the verification script use it. */}
        <div id="demo" className="mx-auto max-w-[1180px]">
          <DemoFrame />
        </div>
      </main>
      <section className="border-t border-border bg-[#FBFAFD] px-4 py-12 text-center">
        <a
          href="/case-study"
          className="inline-flex items-center gap-2 rounded-lg bg-upstox-purple px-5 py-3 text-sm font-semibold text-white shadow-card hover:bg-upstox-purple-dark"
        >
          See the full case study <ArrowRight className="size-4" />
        </a>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted">
          The problem, what Upstox already has, what’s new, how it works on the Upstox APIs, and the roadmap.
        </p>
      </section>
    </>
  )
}
