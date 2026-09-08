'use client'

/**
 * lib/hooks/useNavLayout.ts — React access to the custom sidebar groups.
 *
 * Mirrors useHiddenNavItems: read once on mount, write through to
 * localStorage, and broadcast so any other mounted copy re-reads. The
 * arrangement is a preference rather than data, so it stays out of IDB.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ViewId } from '@/lib/nav-config'
import {
  loadLayout, saveLayout, addGroup, renameGroup, removeGroup,
  assignItem, unassignItem, moveItem, moveGroup, assignedIds,
  EMPTY_LAYOUT, NAV_LAYOUT_EVENT,
  type NavLayout,
} from '@/lib/navLayout'

export function useNavLayout() {
  /* Starts empty so the server render and the first client render agree;
     the stored arrangement arrives in the effect below. */
  const [layout, setLayout] = useState<NavLayout>(EMPTY_LAYOUT)

  useEffect(() => {
    setLayout(loadLayout())
    const reread = () => setLayout(loadLayout())
    window.addEventListener(NAV_LAYOUT_EVENT, reread)
    window.addEventListener('storage', reread)   // another tab
    return () => {
      window.removeEventListener(NAV_LAYOUT_EVENT, reread)
      window.removeEventListener('storage', reread)
    }
  }, [])

  /* Every mutation goes through one path: apply the pure operation,
     persist, and take the result as the new state. */
  const apply = useCallback((fn: (l: NavLayout) => NavLayout) => {
    setLayout(prev => {
      const next = fn(prev)
      if (next !== prev) saveLayout(next)
      return next
    })
  }, [])

  return {
    layout,
    assigned:  assignedIds(layout),
    addGroup:      useCallback((label: string) => apply(l => addGroup(l, label)), [apply]),
    renameGroup:   useCallback((id: string, label: string) => apply(l => renameGroup(l, id, label)), [apply]),
    removeGroup:   useCallback((id: string) => apply(l => removeGroup(l, id)), [apply]),
    assignItem:    useCallback((gid: string, v: ViewId) => apply(l => assignItem(l, gid, v)), [apply]),
    unassignItem:  useCallback((v: ViewId) => apply(l => unassignItem(l, v)), [apply]),
    moveItem:      useCallback((gid: string, v: ViewId, d: -1 | 1) => apply(l => moveItem(l, gid, v, d)), [apply]),
    moveGroup:     useCallback((gid: string, d: -1 | 1) => apply(l => moveGroup(l, gid, d)), [apply]),
  }
}
