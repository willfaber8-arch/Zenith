'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ViewId } from './nav-config'

/**
 * What a sidebar item can say about itself.
 *
 * A count answers "how many are waiting" — the shape of a task list,
 * where the number only falls as you work. Habits are the other shape:
 * a fixed set for the day that fills up, where "3" means nothing
 * without the 8 it is out of. A ring shows the ratio in the same space
 * a count would take, and at a glance rather than as arithmetic.
 */
export type NavBadge =
  | { kind: 'count'; count: number }
  | { kind: 'ring';  done: number; total: number }

export type BadgeMap = Partial<Record<ViewId, NavBadge>>

interface BadgeCtxState {
  badges:   BadgeMap
  /** Pass null or 0 to clear a badge. */
  setBadge: (view: ViewId, count: number | null) => void
  /** A progress ring instead of a count. `total` of 0 clears it — a
      ring out of nothing has no reading. */
  setRingBadge: (view: ViewId, done: number, total: number) => void
}

const BadgeContext = createContext<BadgeCtxState>({
  badges:       {},
  setBadge:     () => {},
  setRingBadge: () => {},
})

export function NavBadgeProvider({ children }: { children: ReactNode }) {
  const [badges, setBadges] = useState<BadgeMap>({})

  /*
   * useCallback with empty deps so this function reference is
   * stable across re-renders. setBadges (React state setter) is
   * always stable, so no deps are needed.
   * Without this, any useEffect that lists setBadge as a dep would
   * loop infinitely because a new function is created each render.
   */
  const setBadge = useCallback((view: ViewId, count: number | null) => {
    setBadges(prev => {
      const next = { ...prev }
      if (!count || count <= 0) {
        delete next[view]
      } else {
        next[view] = { kind: 'count', count }
      }
      return next
    })
  }, [])

  const setRingBadge = useCallback((view: ViewId, done: number, total: number) => {
    setBadges(prev => {
      const existing = prev[view]
      if (total <= 0) {
        if (!existing) return prev
        const next = { ...prev }
        delete next[view]
        return next
      }
      /*
       * Bail out when nothing moved. This runs from an effect watching
       * live query results, which re-resolve on every write anywhere in
       * the table — returning a fresh object each time would re-render
       * the whole sidebar for a ring that looks identical.
       */
      if (existing?.kind === 'ring' && existing.done === done && existing.total === total) {
        return prev
      }
      return { ...prev, [view]: { kind: 'ring', done, total } }
    })
  }, [])

  return (
    <BadgeContext.Provider value={{ badges, setBadge, setRingBadge }}>
      {children}
    </BadgeContext.Provider>
  )
}

export const useNavBadge = () => useContext(BadgeContext)
