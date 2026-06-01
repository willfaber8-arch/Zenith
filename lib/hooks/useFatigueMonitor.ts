'use client'

/**
 * useFatigueMonitor — Phase 5 · Step 5.6
 * ─────────────────────────────────────────────────────────────────
 * Ergonomic fatigue state engine.  Reads two live IDB streams and
 * derives a combined fatigue index:
 *
 *   continuousWorkMinutes  — sum of consecutive `work` Pomodoro
 *     sessions in the last 3 hours with no intervening break.
 *     Resets to 0 as soon as any break session appears after the
 *     latest work run.  Threshold: ≥ 90 min → fatigued.
 *
 *   currentHealth — userProfile.healthPoints singleton.
 *     Threshold: < 40 HP → fatigued.
 *
 * Returns a FatigueMetrics snapshot; the hook is reactive via
 * useLiveQuery so any IDB write (new session, HP change) re-runs
 * the computation automatically.
 */

import { useMemo }      from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'

/* ── Public types ─────────────────────────────────────────────── */

export interface FatigueMetrics {
  isFatigued:            boolean
  continuousWorkMinutes: number
  currentHealth:         number
  fatigueReason:         'work_time' | 'low_health' | 'both' | null
}

/* ── Constants ────────────────────────────────────────────────── */

/** Consecutive Pomodoro work minutes that trigger fatigue */
export const FATIGUE_WORK_MINS = 90

/** HP value below which the user is considered critically fatigued */
export const FATIGUE_HEALTH_HP = 40

/** Rolling window for session lookback — sessions older than 3 h are ignored */
const LOOKBACK_MS = 3 * 60 * 60 * 1000

/* ── Hook ─────────────────────────────────────────────────────── */

export function useFatigueMonitor(): FatigueMetrics {
  /* Live profile stream — updates whenever HP or other fields change */
  const profile = useLiveQuery(() => db?.userProfile?.get(1), [])

  /* Live session stream — sessions completed in the last 3 hours */
  const sessions = useLiveQuery(
    () => db?.pomodoroSessions
      ?.where('completedAt')
      .above(Date.now() - LOOKBACK_MS)
      .toArray(),
    [],
  )

  /* Continuous work minute calculation:
     Walk the session array backwards to find the last break,
     then sum all work-session durations that follow it.          */
  const continuousWorkMinutes = useMemo<number>(() => {
    if (!sessions || sessions.length === 0) return 0

    const sorted = [...sessions].sort((a, b) => a.completedAt - b.completedAt)

    let lastBreakIdx = -1
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].sessionType !== 'work') {
        lastBreakIdx = i
        break
      }
    }

    return sorted
      .slice(lastBreakIdx + 1)
      .filter(s => s.sessionType === 'work')
      .reduce((sum, s) => sum + (s.durationMinutes ?? 25), 0)
  }, [sessions])

  const currentHealth = profile?.healthPoints ?? 100
  const overWork      = continuousWorkMinutes >= FATIGUE_WORK_MINS
  const lowHealth     = currentHealth < FATIGUE_HEALTH_HP

  const fatigueReason: FatigueMetrics['fatigueReason'] =
    overWork && lowHealth ? 'both'
    : overWork            ? 'work_time'
    : lowHealth           ? 'low_health'
    : null

  return {
    isFatigued: overWork || lowHealth,
    continuousWorkMinutes,
    currentHealth,
    fatigueReason,
  }
}
