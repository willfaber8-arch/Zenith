'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'zenith_hidden_nav_items_v1'

export function useHiddenNavItems() {
  const [hidden,  setHidden]  = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]))
    } catch { /* noop */ }
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
