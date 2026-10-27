'use client'
/**
 * lib/hooks/useCheckinFactors.ts — the other days, for the check-in's links
 *
 * Reads what Zenith already tracks over a window and turns it into "which
 * days had X" sets (utils/emotionCheckin.ts → buildFactorDays): workouts
 * (cardio and strength), focus sessions, reading, habits kept, and days
 * with a pile of tasks due. Read-only — nothing here writes anywhere.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { addDaysISO, toLocalDateStr } from '@/utils/localDate'
import { buildFactorDays, habitDayStats, type FactorDays } from '@/utils/emotionCheckin'

/** How far back links look. Long enough for a few days on each side. */
export const LINK_WINDOW_DAYS = 60

const dayOf = (ms: number | undefined | null) =>
  typeof ms === 'number' && Number.isFinite(ms) ? toLocalDateStr(new Date(ms)) : null

export function useCheckinFactors(endDate: string): { factors: FactorDays | undefined; from: string } {
  const from = addDaysISO(endDate, -(LINK_WINDOW_DAYS - 1))

  const factors = useLiveQuery(async () => {
    if (!db) return undefined
    const fromMs = new Date(from + 'T00:00:00').getTime()
    const toMs   = new Date(addDaysISO(endDate, 1) + 'T00:00:00').getTime()

    const [cardio, strength, focus, reading, tasks, habits, completions] = await Promise.all([
      db.cardioSessions.where('logDate').between(from, endDate, true, true).toArray(),
      db.strength_sessions.where('completedAt').between(fromMs, toMs, true, false).toArray(),
      db.pomodoroSessions.where('completedAt').between(fromMs, toMs, true, false).toArray(),
      db.reading_sessions.where('createdAt').between(fromMs, toMs, true, false).toArray(),
      db.assignments.where('dueDate').between(from, addDaysISO(endDate, 1), true, false).toArray(),
      db.habits.toArray(),
      db.habitCompletions.where('date').between(from, endDate, true, true).toArray(),
    ])

    return buildFactorDays({
      workoutDates: [
        ...cardio.map(c => c.logDate),
        ...strength.map(s => dayOf(s.completedAt)).filter((d): d is string => d != null),
      ],
      focusDates:   focus.filter(f => f.sessionType === 'work').map(f => dayOf(f.completedAt)).filter((d): d is string => d != null),
      readingDates: reading.map(r => r.date).filter(Boolean),
      taskDueDates: tasks.map(t => t.dueDate).filter(Boolean),
      habitDays:    habitDayStats(habits, completions, from, endDate),
    })
  }, [from, endDate])

  return { factors, from }
}
