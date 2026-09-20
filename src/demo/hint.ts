// First-run hint: a pulse on the first holdings chip so a new visitor knows the chips are clickable.
// It shows once per browser, disappears on the first chip click or after 8 seconds, and never blocks
// anything — no modal, no overlay, and the ring/tooltip are drawn outside the layout flow.
// `?hint=0` suppresses it (used by the screenshot runs). Storage is optional: if it is blocked the
// hint simply shows again next time.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'tax-cost-insights-hint-v1'
const DISMISS_AFTER_MS = 8000

const suppressedByUrl = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('hint') === '0'
  } catch {
    return false
  }
}

const alreadySeen = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === 'seen'
  } catch {
    return false // storage blocked: show the hint, remember nothing
  }
}

const remember = (): void => {
  try {
    window.localStorage.setItem(KEY, 'seen')
  } catch {
    // storage blocked or full: the hint just shows again next visit
  }
}

export function clearHint(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

/** `show` is true only on a first visit, until the viewer clicks a chip or 8 seconds pass. */
export function useFirstRunHint(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(() => !suppressedByUrl() && !alreadySeen())

  const dismiss = useCallback(() => {
    setShow(false)
    remember()
  }, [])

  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(dismiss, DISMISS_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [show, dismiss])

  return { show, dismiss }
}
