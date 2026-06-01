'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ViewId } from './nav-config'

export type BadgeMap = Partial<Record<ViewId, number>>

interface BadgeCtxState {
  badges:   BadgeMap
  /** Pass null or 0 to clear a badge. */
  setBadge: (view: ViewId, count: number | null) => void
}

const BadgeContext = createContext<BadgeCtxState>({
  badges:   {},
  setBadge: () => {},
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
        next[view] = count
      }
      return next
    })
  }, [])

  return (
    <BadgeContext.Provider value={{ badges, setBadge }}>
      {children}
    </BadgeContext.Provider>
  )
}

export const useNavBadge = () => useContext(BadgeContext)
