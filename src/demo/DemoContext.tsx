// Demo state: persona, trade edits, today's date and the settings bar. The engine re-runs on every change.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { analyze, type Report } from '@/engine'
import type { Day, PortfolioInput, Settings, Trade } from '@/engine/types'
import { personaById, type Persona, DEFAULT_PERSONA_ID } from '@/sample/personas'
import { buildInput, initialState, NO_EDITS, todayRange, type DemoEdits, type DemoState, type Intent } from './scenario'
import { clearSaved, loadSaved, save, type Saved } from './storage'
import { applyLive, loadLive, NO_LIVE, type DataSource, type LiveData } from './live'
import { recordedInput, RECORDED_SETTINGS } from '@/upstox/account'
import { useUpstoxConnection, type ConnectionState } from '@/upstox/auth'
import { mapAccount } from '@/upstox/map'

export type Panel =
  | { kind: 'wait'; symbol: string; lotIndex: number }
  | { kind: 'harvest' }
  | { kind: 'loss' }
  | { kind: 'charges' }
  | { kind: 's156' }
  | { kind: 'r10' }
  | { kind: 'advance' }
  | { kind: 'mf'; symbol: string }
  | { kind: 'elss'; symbol: string }

export type View = 'holdings' | 'funds' | 'insights'

interface DemoContextValue {
  persona: Persona
  state: DemoState
  input: PortfolioInput
  report: Report
  /** Sample seed data, the same plus live Upstox prices, or the recorded demo account */
  dataSource: DataSource
  setDataSource: (s: DataSource) => void
  live: LiveData
  /** true while a live fetch is in flight */
  liveLoading: boolean
  /** Intent gate (PRODUCT.md §5.1): action-oriented panels only open once a sale is being considered. */
  intent: Intent
  setIntent: (i: Intent) => void
  connection: ConnectionState
  edited: boolean
  view: View
  setView: (v: View) => void
  panel: Panel | null
  openPanel: (p: Panel) => void
  closePanel: () => void
  setPersona: (id: Persona['id']) => void
  setSettings: (s: Settings) => void
  setToday: (d: Day) => void
  addTrade: (t: Trade) => void
  removeTrade: (id: string) => void
  resetDemo: () => void
}

const Ctx = createContext<DemoContextValue | null>(null)

const EMPTY: Saved = { personaId: DEFAULT_PERSONA_ID, editsByPersona: {}, todayByPersona: {}, intent: 'exploring' }

/** A persona's state, restoring its saved edits and date (if still inside the allowed range). */
function restore(id: Persona['id'], saved: Saved): DemoState {
  const base = initialState(id)
  const range = todayRange(personaById(id))
  const d = saved.todayByPersona[id]
  const today = d && d >= range.min && d <= range.max ? d : base.today
  return { ...base, today, edits: saved.editsByPersona[id] ?? NO_EDITS }
}

function startState(): { state: DemoState; saved: Saved } {
  const saved = loadSaved() ?? EMPTY
  return { state: restore(saved.personaId, saved), saved }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [{ state, saved }, setAll] = useState(startState)
  const [view, setView] = useState<View>('holdings')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('sample')
  const [live, setLive] = useState<LiveData>(NO_LIVE)
  const [liveLoading, setLiveLoading] = useState(false)
  const connection = useUpstoxConnection()
  const [accountSettings, setAccountSettings] = useState(RECORDED_SETTINGS)
  const intent: Intent = saved.intent ?? 'exploring'

  useEffect(() => save(saved), [saved])

  // The demo account is built from recorded Upstox responses through the same mapping a live call uses.
  const seed = useMemo(() => {
    if (dataSource === 'connected' && connection.status === 'connected') {
      return connection.isEmpty ? buildInput(state) : mapAccount(connection.data)
    }
    return dataSource === 'account' ? recordedInput() : buildInput(state)
  }, [dataSource, state, connection])
  const settings = (dataSource === 'account' || (dataSource === 'connected' && connection.status === 'connected' && !connection.isEmpty)) ? accountSettings : state.settings
  const input = useMemo(() => (dataSource === 'live' ? applyLive(seed, live) : seed), [seed, live, dataSource])
  const report = useMemo(() => analyze(input, settings), [input, settings])

  // Live prices: fetched only in "Sample + live Upstox prices", and silently ignored if they fail.
  useEffect(() => {
    if (dataSource !== 'live') {
      setLive(NO_LIVE)
      return
    }
    let cancelled = false
    setLiveLoading(true)
    loadLive(seed)
      .then((d) => !cancelled && setLive(d))
      .catch(() => !cancelled && setLive(NO_LIVE))
      .finally(() => !cancelled && setLiveLoading(false))
    return () => {
      cancelled = true
    }
  }, [dataSource, seed])

  const setEdits = useCallback((f: (e: DemoEdits) => DemoEdits) => {
    setAll(({ state: s, saved: sv }) => {
      const edits = f(s.edits)
      return { state: { ...s, edits }, saved: { ...sv, editsByPersona: { ...sv.editsByPersona, [s.personaId]: edits } } }
    })
  }, [])

  const value: DemoContextValue = {
    persona: personaById(state.personaId),
    state: { ...state, settings },
    input,
    report,
    dataSource,
    setDataSource,
    live,
    liveLoading,
    intent,
    setIntent: (i) => setAll(({ state: st, saved: sv }) => ({ state: st, saved: { ...sv, intent: i } })),
    connection,
    edited: state.edits.added.length + state.edits.removedIds.length > 0,
    view,
    setView,
    panel,
    openPanel: setPanel,
    closePanel: () => setPanel(null),
    setPersona: (id) => {
      const open = personaById(id).openPanel
      setPanel(open ? { kind: open } : null)
      setAll(({ saved: sv }) => ({ state: restore(id, sv), saved: { ...sv, personaId: id } }))
    },
    setSettings: (s) => (dataSource === 'account' ? setAccountSettings(s) : setAll((a) => ({ ...a, state: { ...a.state, settings: s } }))),
    setToday: (today) =>
      setAll(({ state: s, saved: sv }) => ({
        state: { ...s, today },
        saved: { ...sv, todayByPersona: { ...sv.todayByPersona, [s.personaId]: today } },
      })),
    addTrade: (t) => setEdits((e) => ({ ...e, added: [...e.added, t] })),
    removeTrade: (id) =>
      setEdits((e) =>
        e.added.some((t) => t.id === id) ? { ...e, added: e.added.filter((t) => t.id !== id) } : { ...e, removedIds: [...e.removedIds, id] },
      ),
    resetDemo: () => {
      clearSaved()
      setPanel(null)
      setView('holdings')
      setDataSource('sample')
      setAccountSettings(RECORDED_SETTINGS)
      setAll({ state: initialState(DEFAULT_PERSONA_ID), saved: EMPTY })
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDemo(): DemoContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDemo outside DemoProvider')
  return v
}
