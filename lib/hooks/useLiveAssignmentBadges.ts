'use client'
/**
 * useLiveAssignmentBadges
 * ────────────────────────────────────────────────────────────────
 * Subscribes to the assignments table via useLiveQuery and
 * pushes badge counts into NavBadgeContext so sidebar pills
 * update automatically without any manual fetch/refresh cycle.
 *
 * Import only from `'use client'` components.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect }    from 'react'
import { db }           from '@/lib/db'
import { useNavBadge }  from '@/lib/NavBadgeContext'

/**
 * Returns the live count of active (non-completed) assignments
 * and keeps the study-shield sidebar badge in sync as a side-effect.
 */
export function useLiveAssignmentBadges(): number {
  const { setBadge } = useNavBadge()

  /* ── Total active assignments ──────────────────────────────── */
  const activeCount = useLiveQuery(
    async (): Promise<number> => {
      if (!db) return 0
      return db.assignments
        .where('status')
        .anyOf(['pending', 'in_progress', 'overdue'])
        .count()
    },
    [],
    0,
  )

  /* ── Sync to sidebar badge ─────────────────────────────────── */
  useEffect(() => {
    setBadge('study-shield', activeCount ?? 0)
  }, [activeCount, setBadge])

  return activeCount ?? 0
}
