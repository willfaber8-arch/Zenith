'use client'
/**
 * lib/hooks/useMentalHealthLog.ts — Mental Health Log IDB manager
 * Phase 5 · Step 5.7
 *
 * Provides reactive CRUD for MentalHealthLog entries and runs the
 * rolling 3-day MentalStateEvaluation automatically on every IDB change.
 * One log per calendar day — subsequent logs on the same day update the
 * existing row rather than inserting a duplicate.
 */

import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery }                   from 'dexie-react-hooks'
import { db }                             from '@/lib/db'
import {
  evaluateMentalState,
  todayISO,
  MOOD_MAP,
  type MoodKey,
  type MoodVector,
  type MentalStateEvaluation,
} from '@/utils/mentalHealthLog'
import type { MentalHealthLog } from '@/lib/db'

/* ── Lookback window ─────────────────────────────────────────── */

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

/* ── Hook return type ────────────────────────────────────────── */

export interface MentalHealthLogState {
  /** Last 7 days of logs sorted by logDate descending */
  logs:          MentalHealthLog[]
  /** Today's log entry, or null if none yet */
  todayLog:      MentalHealthLog | null
  /** Rolling 3-day evaluation result */
  evaluation:    MentalStateEvaluation
  /** True while an IDB write is in-flight */
  submitting:    boolean
  /**
   * Log a mood for today.
   * If a log already exists for today, it is updated atomically.
   * notes defaults to '' if omitted.
   */
  logMood:       (mood: MoodVector, notes?: string) => Promise<void>
  /**
   * Quick one-tap log by MoodKey — resolves the vector automatically.
   * This is what the emoji grid buttons call.
   */
  quickLog:      (key: MoodKey, notes?: string) => Promise<void>
}

/* ── Hook ────────────────────────────────────────────────────── */

export function useMentalHealthLog(): MentalHealthLogState {
  const [submitting, setSubmitting] = useState(false)

  /* Live query — last 7 days, sorted desc for display */
  const raw = useLiveQuery(
    () => db?.mentalHealthLogs
      ?.where('logDate')
      .aboveOrEqual(sevenDaysAgo())
      .toArray()
      ?? Promise.resolve([]),
    [],
    [] as MentalHealthLog[],
  )

  const logs: MentalHealthLog[] = useMemo(
    () => [...(raw ?? [])].sort((a, b) => b.logDate.localeCompare(a.logDate)),
    [raw],
  )

  const todayLog = useMemo(
    () => logs.find(l => l.logDate === todayISO()) ?? null,
    [logs],
  )

  const evaluation = useMemo(
    () => evaluateMentalState(logs),
    [logs],
  )

  /* ── Core write operation ─────────────────────────────────── */

  const logMood = useCallback(async (mood: MoodVector, notes = '') => {
    setSubmitting(true)
    const today = todayISO()
    try {
      const existing = await db.mentalHealthLogs
        .where('logDate').equals(today).first()

      if (existing?.id !== undefined) {
        // Update existing entry for today
        await db.mentalHealthLogs.update(existing.id, {
          stressLevel:      mood.stressLevel,
          energyLevel:      mood.energyLevel,
          qualitativeNotes: notes,
          moodVector:       mood.key,
        })
      } else {
        // Insert new entry
        await db.mentalHealthLogs.add({
          logDate:          today,
          stressLevel:      mood.stressLevel,
          energyLevel:      mood.energyLevel,
          qualitativeNotes: notes,
          moodVector:       mood.key,
          createdAt:        Date.now(),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }, [])

  /* ── Quick log by key ─────────────────────────────────────── */

  const quickLog = useCallback(
    async (key: MoodKey, notes = '') => {
      const mood = MOOD_MAP[key]
      if (mood) await logMood(mood, notes)
    },
    [logMood],
  )

  return { logs, todayLog, evaluation, submitting, logMood, quickLog }
}
