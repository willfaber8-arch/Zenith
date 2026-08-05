'use client'

import { useState, useEffect, useCallback } from 'react'

export const NAV_HIDDEN_STORAGE_KEY = 'zenith_hidden_nav_items_v1'
const STORAGE_KEY = NAV_HIDDEN_STORAGE_KEY

/** Fired by any non-hook writer (the Co-Pilot) so mounted hooks re-read. */
export const NAV_VISIBILITY_EVENT = 'zenith:nav-visibility-change'

export function useHiddenNavItems() {
  const [hidden,  setHidden]  = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const read = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        setHidden(raw ? new Set(JSON.parse(raw) as string[]) : new Set())
      } catch { /* noop */ }
    }
    read()

    /* The Co-Pilot writes this key directly during setup, and another tab
       may write it too. Without these listeners the sidebar would keep
       rendering its mount-time snapshot until a reload. */
    window.addEventListener(NAV_VISIBILITY_EVENT, read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(NAV_VISIBILITY_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [])

  const hideItem = useCallback((id: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }, [])

  const showItem = useCallback((id: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.delete(id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }, [])

  const showAll = useCallback(() => {
    setHidden(new Set())
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [])

  return { hidden: mounted ? hidden : new Set<string>(), hideItem, showItem, showAll, mounted }
}
