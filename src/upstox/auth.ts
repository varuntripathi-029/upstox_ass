import { useState, useEffect } from 'react'
import type { AccountResponses } from './map'


export type ConnectionState =
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'connected'; name?: string; expiresAt?: string; data: AccountResponses; isEmpty: boolean }
  | { status: 'error'; message: string }
  | { status: 'expired' }

export function useUpstoxConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session')
        const session = await res.json()
        if (!session.connected) {
          if (!cancelled) setState({ status: 'not_connected' })
          return
        }

        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          if (!cancelled) setState({ status: 'expired' })
          return
        }

        const portRes = await fetch('/api/portfolio')
        if (!portRes.ok) {
          if (!cancelled) setState({ status: 'error', message: 'Failed to fetch portfolio' })
          return
        }
        const data = await portRes.json() as AccountResponses
        const isEmpty =
          (data.holdings?.data?.length ?? 0) === 0 &&
          (data.trades?.data?.length ?? 0) === 0 &&
          (data.mfTrades?.data?.length ?? 0) === 0

        if (!cancelled) {
          setState({
            status: 'connected',
            name: session.name,
            expiresAt: session.expiresAt,
            data,
            isEmpty,
          })
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: (err as Error).message })
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [])

  return state
}
