// The intent gate (PRODUCT.md §5.1). The product surfaces opportunities; it never manufactures intent.
// Default is "just looking", where every screen stays informational: tax and charges on what is already
// held, no timing prompts and no harvesting actions. Planning appears only once the viewer says they are
// actually considering a sale.
import { INTENT_CONSIDERING, INTENT_CONSIDERING_NOTE, INTENT_EXPLORING, INTENT_EXPLORING_NOTE, INTENT_QUESTION } from '@/engine'
import { cn } from '@/lib/utils'
import { useDemo } from './DemoContext'
import type { Intent } from './scenario'

const OPTIONS: { id: Intent; label: string }[] = [
  { id: 'exploring', label: INTENT_EXPLORING },
  { id: 'considering', label: INTENT_CONSIDERING },
]

export function IntentGate() {
  const { intent, setIntent } = useDemo()
  return (
    <section aria-label="Sell intent" className="rounded-uw-card border border-uw-band bg-white px-3 py-2.5 shadow-card sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium text-uw-text">{INTENT_QUESTION}</span>
        <div role="radiogroup" aria-label="Sell intent" className="flex gap-1 rounded-lg bg-uw-band/60 p-0.5">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={intent === o.id}
              onClick={() => setIntent(o.id)}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition',
                intent === o.id ? 'bg-white text-uw-purple shadow-card' : 'text-uw-text-2 hover:text-uw-text',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-uw-text-2">{intent === 'considering' ? INTENT_CONSIDERING_NOTE : INTENT_EXPLORING_NOTE}</p>
    </section>
  )
}

/** True when action-oriented planning (timing prompts, harvesting figures) may be shown. */
export function useSellPlanning(): boolean {
  return useDemo().intent === 'considering'
}
