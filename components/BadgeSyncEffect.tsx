'use client'
/**
 * BadgeSyncEffect
 * ────────────────────────────────────────────────────────────────
 * Zero-render side-effect component mounted inside the authenticated
 * workspace. Responsibilities:
 *
 *   1. Seeds the userProfile singleton (id=1) on first authenticated
 *      session — safe to call repeatedly (no-op if row exists).
 *   2. Subscribes to live assignment counts and pushes badge numbers
 *      into NavBadgeContext so sidebar pills stay reactive.
 *   3. Takes the daily local snapshot, if one is due, and then tidies
 *      away finished tasks past their retention window — in that order,
 *      so anything the sweep removes is inside a snapshot first.
 *
 * Returns null — this component produces no DOM output.
 */

import { useEffect }                 from 'react'
import { useAuth }                   from '@/lib/AuthContext'
import { seedUserProfile }           from '@/lib/db'
import { useLiveAssignmentBadges }   from '@/lib/hooks/useLiveAssignmentBadges'
import { warn }                      from '@/lib/logger'
import { takeSnapshot }              from '@/utils/dbSnapshots'
import { sweepCompletedTasks }       from '@/utils/taskRetention'

export default function BadgeSyncEffect() {
  const { session } = useAuth()

  /*
   * ── The daily snapshot ──────────────────────────────────────
   *
   * Deferred rather than run on mount. Copying the whole database is
   * the largest read the app ever does, and doing it while the first
   * screen is still rendering trades a visible stall for a backup
   * nobody asked for at that moment. `requestIdleCallback` waits for
   * the browser to have nothing better to do; the timeout is the
   * fallback for Safari, which does not implement it.
   *
   * `takeSnapshot` decides for itself whether one is due, so running
   * this on every load costs a single indexed read on most of them.
   */
  useEffect(() => {
    if (!session?.userHandle) return
    let cancelled = false

    const run = () => {
      if (cancelled) return
      /*
       * Order matters, and is the reason these are chained rather than
       * fired together. The sweep deletes finished tasks permanently;
       * running it after the snapshot means the last few days of them
       * are still sitting in a snapshot if the window turns out to be
       * shorter than someone wanted. A failed snapshot does not block
       * the sweep — the tasks it would remove were already a week old,
       * and leaving the list to grow forever because a copy could not
       * be written trades one small problem for a permanent one.
       */
      void takeSnapshot()
        .catch(err => warn('BadgeSyncEffect', 'daily snapshot failed', err))
        .then(() => { if (!cancelled) return sweepCompletedTasks() })
        .catch(err => warn('BadgeSyncEffect', 'done-task sweep failed', err))
    }

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?:  (h: number) => void
    }

    if (typeof w.requestIdleCallback === 'function') {
      const h = w.requestIdleCallback(run, { timeout: 15_000 })
      return () => { cancelled = true; w.cancelIdleCallback?.(h) }
    }
    const t = setTimeout(run, 8_000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [session?.userHandle])

  /* ── Seed userProfile on first authenticated load ──────────── */
  useEffect(() => {
    if (!session?.userHandle) return
    seedUserProfile(session.userHandle).catch(
      (err) => warn('BadgeSyncEffect', 'seedUserProfile failed', err),
    )
  }, [session?.userHandle])

  /* ── Live assignment count → NavBadge sync ─────────────────── */
  useLiveAssignmentBadges()

  return null
}
