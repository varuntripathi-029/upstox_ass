// Optional trade editor: add a buy or sell to the current persona. Edits are kept per persona in this browser.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatDay, formatINRPaise } from '@/engine'
import { istDay } from '@/engine/dates'
import { isMfClass } from '@/engine/mf'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDemo } from './DemoContext'
import { editorTrade, heldOn } from './scenario'
import { SampleBadge } from './ui'

export function TradeEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persona, input, state, addTrade, removeTrade } = useDemo()
  // Stocks only: mutual fund purchases are SIP instalments with NAV-based units, not editable here.
  const symbols = persona.portfolio.instruments.filter((i) => i.assetClass !== 'FNO' && !isMfClass(i.assetClass))
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [symbol, setSymbol] = useState(symbols[0]?.symbol ?? '')
  const [qty, setQty] = useState('10')
  const holding = input.holdings.find((h) => h.symbol === symbol)
  const lastPrice = holding?.ltpPaise ?? [...input.trades].reverse().find((t) => t.symbol === symbol)?.pricePaise ?? 10_000
  const [price, setPrice] = useState('')
  const [day, setDay] = useState(state.today)
  const [error, setError] = useState('')

  const submit = () => {
    const q = Number(qty)
    const p = Math.round(Number(price === '' ? lastPrice / 100 : price) * 100)
    if (!Number.isInteger(q) || q <= 0) return setError('Quantity must be a whole number above 0.')
    if (!Number.isFinite(p) || p <= 0) return setError('Price must be above ₹0.')
    if (day > state.today) return setError(`The date can’t be after today (${formatDay(state.today)}).`)
    if (day < persona.portfolio.tradeHistoryFrom) return setError(`Trade history starts on ${formatDay(persona.portfolio.tradeHistoryFrom)}.`)
    if (side === 'SELL') {
      const held = heldOn(input, symbol, day)
      if (q > held) return setError(`You held ${held} ${symbol} on ${formatDay(day)}.`)
    }
    addTrade(editorTrade({ symbol, day, side, qty: q, pricePaise: p }))
    setError('')
  }

  const added = state.edits.added
  const recent = [...input.trades].filter((t) => !added.some((a) => a.id === t.id) && t.segment !== 'FO').slice(-8).reverse()
  const field = 'h-9 rounded-md border border-input bg-white px-2.5 text-sm text-uw-text'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-uw-band pr-12">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-uw-purple">Viewing as {persona.name}</span>
            <SampleBadge />
          </div>
          <SheetTitle className="text-lg font-semibold">Edit trades</SheetTitle>
          <SheetDescription>Add a buy or sell and every number recalculates. Edits stay in this browser only. “Reset demo” clears them.</SheetDescription>
        </SheetHeader>
        {symbols.length === 0 && (
          <p className="px-4 text-sm text-uw-text-2">This persona holds only mutual funds. SIP instalments can be removed below; new fund purchases aren’t editable here.</p>
        )}
        <form
          hidden={symbols.length === 0}
          className="grid grid-cols-2 gap-3 px-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
            Side
            <Select value={side} onValueChange={(v) => setSide(v as 'BUY' | 'SELL')}>
              <SelectTrigger className="w-full bg-white" aria-label="Side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">Buy</SelectItem>
                <SelectItem value="SELL">Sell</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
            Stock
            <Select
              value={symbol}
              onValueChange={(v) => {
                setSymbol(v)
                setPrice('')
              }}
            >
              <SelectTrigger className="w-full bg-white" aria-label="Stock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol}>
                    {s.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
            Quantity
            <input className={field} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-uw-text-2">
            Price (₹)
            <input
              className={field}
              inputMode="decimal"
              placeholder={(lastPrice / 100).toFixed(2)}
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-uw-text-2">
            Trade date
            <input type="date" className={field} min={persona.portfolio.tradeHistoryFrom} max={state.today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
          {error && (
            <p className="col-span-2 text-sm text-uw-down" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="col-span-2 bg-uw-purple hover:bg-uw-logo">
            <Plus className="size-4" /> Add {side === 'BUY' ? 'buy' : 'sell'}
          </Button>
        </form>

        <div className="flex flex-col gap-3 px-4 pb-6">
          <h3 className="text-sm font-semibold text-uw-text">Your edits ({added.length + state.edits.removedIds.length})</h3>
          {added.length === 0 && state.edits.removedIds.length === 0 && <p className="text-xs text-uw-text-2">No edits yet.</p>}
          <ul className="flex flex-col gap-1">
            {added.map((t) => (
              <TradeRow key={t.id} t={t} label="added" onRemove={() => removeTrade(t.id)} />
            ))}
            {state.edits.removedIds.length > 0 && <li className="text-xs text-uw-text-2">{state.edits.removedIds.length} original trade(s) removed</li>}
          </ul>
          <h3 className="mt-2 text-sm font-semibold text-uw-text">Latest trades</h3>
          <ul className="flex flex-col gap-1">
            {recent.map((t) => (
              <TradeRow key={t.id} t={t} onRemove={() => removeTrade(t.id)} />
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TradeRow({ t, label, onRemove }: { t: { id: string; symbol: string; side: string; qty: number; pricePaise: number; time: string }; label?: string; onRemove: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-uw-band px-3 py-1.5 text-xs">
      <span className="tabular min-w-0 text-uw-text">
        <b className={t.side === 'BUY' ? 'text-uw-up' : 'text-uw-down'}>{t.side}</b> {t.qty} {t.symbol} @ {formatINRPaise(t.pricePaise)} · {formatDay(istDay(t.time), 'd MMM yy')}
        {label && <span className="ml-1 rounded bg-uw-banner px-1 text-uw-purple">{label}</span>}
      </span>
      <button type="button" onClick={onRemove} className="cursor-pointer rounded p-1 text-uw-text-2 hover:bg-uw-band hover:text-uw-down" aria-label={`Remove ${t.side} ${t.symbol}`}>
        <Trash2 className="size-3.5" />
      </button>
    </li>
  )
}
