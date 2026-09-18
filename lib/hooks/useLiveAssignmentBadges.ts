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
 * and keeps the Calendar's sidebar badge in sync as a side-effect.
 */
export function useLiveAssignmentBadges(): number {
  const { setBadge } = useNavBadge()

  /* ── Total active assignments ──────────────────────────────── */
  const activeCount = useLiveQuery(
    async (): Promise<number> => {
      if (!db) return 0
      /*
       * Reminders are counted now, where they used to be excluded.
       *
       * The exclusion existed because the badge sat on Study Shield: a
       * study badge counting "buy stamps" stops meaning anything. The
       * badge sits on the Calendar now, which is the one place all
       * three kinds live, so leaving reminders out would under-report
       * the tab's own list — the opposite problem.
       */
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
    /* Follows the work: the Tasks tab moved to the Calendar, and a
       badge pointing at a view that no longer has a task list is just
       a number you cannot act on. */
    setBadge('calendar', activeCount ?? 0)
  }, [activeCount, setBadge])

  return activeCount ?? 0
}
