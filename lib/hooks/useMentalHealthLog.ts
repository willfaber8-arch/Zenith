'use client'
/**
 * lib/hooks/useMentalHealthLog.ts — Mental Health Log IDB manager
 * Phase 5 · Step 5.7
 *
 * Provides reactive CRUD for MentalHealthLog entries and runs the
 * rolling 3-day MentalStateEvaluation automatically on every IDB change.
 * One log per calendar day — subsequent logs on the same day update the
 * existing row rather than inserting a duplicate.
 *
 * Every write takes the day it is for. Past days are editable (a day you
 * forgot to log, or one that rolled over at midnight while you were still
 * in it); future days are refused.
 */

import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery }                   from 'dexie-react-hooks'
import { db }                             from '@/lib/db'
import { syncHabitSource }                from '@/lib/habitSync'
import { currentDayISO }                from '@/utils/dayBoundary'
import {
  stressEnergyFromCheckin,
  type EmotionAnswers,
} from '@/utils/emotionCheckin'
import {
  evaluateMentalState,
  isLoggableDate,
  nearestMood,
  MOOD_MAP,
  type MoodKey,
  type MoodVector,
  type MentalStateEvaluation,
} from '@/utils/mentalHealthLog'
import type { MentalHealthLog } from '@/lib/db'
import { todayISO, toLocalDateStr } from '@/utils/localDate'

/* ── Lookback window ─────────────────────────────────────────── */

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toLocalDateStr(d)
}

/* ── Writes ──────────────────────────────────────────────────── */

/**
 * Ticks any habit linked to the mood source — but only for an entry about
 * the habit day being tracked now (today, or yesterday while the habit
 * cutoff still counts it). Filling in last Tuesday's mood must not tick
 * today's habit.
 */
function syncMoodHabit(date: string): void {
  if (date === todayISO() || date === currentDayISO()) void syncHabitSource('mood', 1)
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
   * Log a mood for a day (default today).
   * If a log already exists for that day, it is updated atomically.
   * notes defaults to '' if omitted.
   */
  logMood:       (mood: MoodVector, notes?: string, date?: string) => Promise<void>
  /**
   * Quick one-tap log by MoodKey — resolves the vector automatically.
   * This is what the emoji grid buttons call.
   */
  quickLog:      (key: MoodKey, notes?: string, date?: string) => Promise<void>
  /**
   * Save an emotion check-in for a day (default today). An existing log
   * keeps its mood, stress, energy and journal; a day with no log gets
   * stress/energy derived from the answers and the nearest mood.
   */
  saveCheckin:   (answers: EmotionAnswers, date?: string) => Promise<void>
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

  const logMood = useCallback(async (mood: MoodVector, notes = '', date = todayISO()) => {
    if (!isLoggableDate(date)) return
    setSubmitting(true)
    try {
      const existing = await db.mentalHealthLogs
        .where('logDate').equals(date).first()

      if (existing?.id !== undefined) {
        await db.mentalHealthLogs.update(existing.id, {
          stressLevel:      mood.stressLevel,
          energyLevel:      mood.energyLevel,
          qualitativeNotes: notes,
          moodVector:       mood.key,
        })
      } else {
        await db.mentalHealthLogs.add({
          logDate:          date,
          stressLevel:      mood.stressLevel,
          energyLevel:      mood.energyLevel,
          qualitativeNotes: notes,
          moodVector:       mood.key,
          createdAt:        Date.now(),
        })
      }
      syncMoodHabit(date)
    } finally {
      setSubmitting(false)
    }
  }, [])

  /* ── Emotion check-in ─────────────────────────────────────── */

  const saveCheckin = useCallback(async (answers: EmotionAnswers, date = todayISO()) => {
    if (!isLoggableDate(date)) return
    setSubmitting(true)
    try {
      const existing = await db.mentalHealthLogs
        .where('logDate').equals(date).first()

      if (existing?.id !== undefined) {
        // The mood and journal were chosen by hand — the check-in sits
        // beside them rather than overwriting them.
        await db.mentalHealthLogs.update(existing.id, {
          emotions:  answers,
          checkinAt: Date.now(),
        })
      } else {
        const { stressLevel, energyLevel } = stressEnergyFromCheckin(answers)
        await db.mentalHealthLogs.add({
          logDate:          date,
          stressLevel,
          energyLevel,
          qualitativeNotes: '',
          moodVector:       nearestMood(stressLevel, energyLevel).key,
          createdAt:        Date.now(),
          emotions:         answers,
          checkinAt:        Date.now(),
        })
      }
      syncMoodHabit(date)
    } finally {
      setSubmitting(false)
    }
  }, [])

  /* ── Quick log by key ─────────────────────────────────────── */

  const quickLog = useCallback(
    async (key: MoodKey, notes = '', date?: string) => {
      const mood = MOOD_MAP[key]
      if (mood) await logMood(mood, notes, date)
    },
    [logMood],
  )

  return { logs, todayLog, evaluation, submitting, logMood, quickLog, saveCheckin }
}
