'use client'
/**
 * useHabitRingBadge
 * ────────────────────────────────────────────────────────────────
 * Keeps the Habits sidebar ring in step with today's progress, the
 * same way useLiveAssignmentBadges keeps the Calendar's count pill in
 * step with the task list.
 *
 * It reads through `useHabits()` rather than counting habits itself.
 * The denominator is a genuinely awkward number — habits not scheduled
 * today don't belong in it, nor do skipped ones, and a limit habit is
 * never "done" while the day is still running — and every one of those
 * rules already lives in that hook, which is what the Habits view
 * itself displays. Recomputing them here would produce a second
 * opinion, and the two would disagree on exactly the days the rules
 * matter (see the note in CLAUDE.md on readers of the habit day
 * agreeing with the writer). A sidebar that says 3/8 while the page it
 * links to says 3/5 is worse than no sidebar number at all.
 *
 * Import only from `'use client'` components.
 */

import { useEffect } from 'react'
import { useHabits } from '@/lib/hooks/useHabits'
import { useNavBadge } from '@/lib/NavBadgeContext'

export interface HabitRingState {
  done:  number
  total: number
}

/**
 * Returns today's done/scheduled counts and pushes them to the sidebar
 * as a side-effect.
 */
export function useHabitRingBadge(): HabitRingState {
  const { setRingBadge } = useNavBadge()
  const { doneCount, scheduledCount } = useHabits()

  useEffect(() => {
    /* A day with nothing due clears the ring rather than drawing an
       empty one: 0 of 0 is not a state anyone is behind on. */
    setRingBadge('habits', doneCount, scheduledCount)
  }, [doneCount, scheduledCount, setRingBadge])

  return { done: doneCount, total: scheduledCount }
}
