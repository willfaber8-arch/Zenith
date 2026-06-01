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
  /* Compute once at call time — stays stable within a render */
  const todayISO = new Date().toISOString().slice(0, 10)

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
