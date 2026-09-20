// Per-viewer convenience only: remembers the chosen persona and trade edits in this browser.
// Every read and write is wrapped: the demo works the same when storage is blocked or empty.
import { PERSONAS, type Persona } from '@/sample/personas'
import type { DemoEdits } from './scenario'

const KEY = 'tax-cost-insights-demo-v1'

export interface Saved {
  personaId: Persona['id']
  editsByPersona: Partial<Record<Persona['id'], DemoEdits>>
  todayByPersona: Partial<Record<Persona['id'], string>>
}

export function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Saved
    if (!PERSONAS.some((p) => p.id === parsed.personaId)) return null
    const edits: Saved['editsByPersona'] = {}
    for (const p of PERSONAS) {
      const e = parsed.editsByPersona?.[p.id]
      if (e && Array.isArray(e.added) && Array.isArray(e.removedIds)) edits[p.id] = e
    }
    const today: Saved['todayByPersona'] = {}
    for (const p of PERSONAS) {
      const d = parsed.todayByPersona?.[p.id]
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) today[p.id] = d
    }
    return { personaId: parsed.personaId, editsByPersona: edits, todayByPersona: today }
  } catch {
    return null
  }
}

export function save(s: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked or full: keep working in memory
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
