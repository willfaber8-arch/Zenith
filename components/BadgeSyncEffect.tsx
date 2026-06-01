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
 *
 * Returns null — this component produces no DOM output.
 */

import { useEffect }                 from 'react'
import { useAuth }                   from '@/lib/AuthContext'
import { seedUserProfile }           from '@/lib/db'
import { useLiveAssignmentBadges }   from '@/lib/hooks/useLiveAssignmentBadges'

export default function BadgeSyncEffect() {
  const { session } = useAuth()

  /* ── Seed userProfile on first authenticated load ──────────── */
  useEffect(() => {
    if (!session?.userHandle) return
    seedUserProfile(session.userHandle).catch(
      (err) => console.warn('[BadgeSyncEffect] seedUserProfile:', err),
    )
  }, [session?.userHandle])

  /* ── Live assignment count → NavBadge sync ─────────────────── */
  useLiveAssignmentBadges()

  return null
}
