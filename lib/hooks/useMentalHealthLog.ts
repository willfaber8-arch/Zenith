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
  cleanAnswers,
  DEFAULT_ANSWER,
  type CheckinAnswers,
} from '@/utils/emotionCheckin'
import {
  evaluateMentalState,
  isLoggableDate,
  nearestMood,
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
   * Save the day's check-in (default today): the five sliders, and the
   * journal beside them. The stress and energy sliders are the log's
   * stressLevel/energyLevel — both already 1–10 — and the mood shown in
   * the calendar is the nearest preset to them, so everything else that
   * reads a log (burnout banner, calendar colour, Co-Pilot) keeps working.
   */
  saveCheckin:   (answers: CheckinAnswers, notes?: string, date?: string) => Promise<void>
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

  /* ── Daily check-in ──────────────────────────────────────── */

  const saveCheckin = useCallback(async (raw: CheckinAnswers, notes = '', date = todayISO()) => {
    if (!isLoggableDate(date)) return
    const answers = cleanAnswers(raw)
    const stressLevel = answers.stress ?? DEFAULT_ANSWER
    const energyLevel = answers.energy ?? DEFAULT_ANSWER
    const fields = {
      stressLevel,
      energyLevel,
      moodVector:       nearestMood(stressLevel, energyLevel).key,
      qualitativeNotes: notes,
      checkin:          answers,
      checkinAt:        Date.now(),
    }
    setSubmitting(true)
    try {
      const existing = await db.mentalHealthLogs
        .where('logDate').equals(date).first()
      if (existing?.id !== undefined) {
        await db.mentalHealthLogs.update(existing.id, fields)
      } else {
        await db.mentalHealthLogs.add({ logDate: date, createdAt: Date.now(), ...fields })
      }
      syncMoodHabit(date)
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { logs, todayLog, evaluation, submitting, saveCheckin }
}
