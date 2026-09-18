'use client'
/**
 * useHabitProgress
 * ────────────────────────────────────────────────────────────────
 * Live reactive habit metrics hook. Derives today's completion
 * percentage, streak totals, and full habit list from IndexedDB
 * via useLiveQuery — UI updates immediately when any habit changes.
 *
 * Import only from `'use client'` components.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit } from '@/lib/db'
import { currentDayISO } from '@/utils/dayBoundary'

export interface HabitProgressResult {
  /** All tracked habits, ordered by streak desc */
  habits:         Habit[]
  /** Count of habits with daily frequency */
  total:          number
  /** Count whose lastCompletedDate === today (ISO) */
  completedToday: number
  /** Rounded integer 0–100 */
  percentage:     number
  /** ISO date for today's comparison key */
  todayISO:       string
}

export function useHabitProgress(): HabitProgressResult {
  /*
   * The habit day, not the calendar day.
   *
   * A tick at 01:00 is written under yesterday's key by design, so a ring
   * comparing against the calendar day read every habit as untouched and
   * sat at 0% until 4am — the one time of night it is least deserved.
   */
  const todayISO = currentDayISO()

  const habits = useLiveQuery(
    async (): Promise<Habit[]> => {
      if (!db) return []
      /* Sort by streak descending so top performers show first */
      return db.habits
        .orderBy('streakCount')
        .reverse()
        .toArray()
    },
    [],
    [] as Habit[],
  )

  const total          = habits.length
  const completedToday = habits.filter(h => h.lastCompletedDate === todayISO).length
  const percentage     = total > 0 ? Math.round((completedToday / total) * 100) : 0

  return { habits, total, completedToday, percentage, todayISO }
}
