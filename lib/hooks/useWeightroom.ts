/**
 * lib/hooks/useWeightroom.ts — strength sessions and plans.
 *
 * The logging path is the one that matters. It runs in a gym, on a
 * phone, forty times an hour, so `logSet` is a single read-modify-write
 * of one row with no transaction and no cross-table work — see the note
 * on the schema in lib/db.ts for why sets live inline.
 */

'use client'

import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { todayISO, daysAgoISO } from '@/utils/localDate'
import {
  sessionVolumeKg, isSessionComplete,
  type StrengthSession, type WorkoutPlan, type WorkSet,
} from '@/types/weightroom'

export interface WeightroomApi {
  sessions:  StrengthSession[]
  plans:     WorkoutPlan[]
  isLoading: boolean
  /** Scheduled for today and not finished — what the logger opens on. */
  todaySession: StrengthSession | null
  upcoming:  StrengthSession[]
  history:   StrengthSession[]
  savePlan:  (plan: WorkoutPlan, sessions: StrengthSession[]) => Promise<void>
  deletePlan: (planId: string) => Promise<void>
  logSet:    (sessionId: string, exerciseId: string, setId: string, patch: Partial<WorkSet>) => Promise<void>
  startSession:  (sessionId: string) => Promise<void>
  finishSession: (sessionId: string) => Promise<void>
  rescheduleSession: (sessionId: string, dateISO: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

export function useWeightroom(): WeightroomApi {
  const rawSessions = useLiveQuery(
    async () => (db ? db.strength_sessions.toArray() : []), [],
  )
  const rawPlans = useLiveQuery(
    async () => (db ? db.workout_plans.toArray() : []), [],
  )

  const sessions = useMemo(
    () => [...(rawSessions ?? [])].sort((a, b) =>
      a.scheduledFor.localeCompare(b.scheduledFor) || a.createdAt - b.createdAt),
    [rawSessions],
  )
  const plans = useMemo(
    () => [...(rawPlans ?? [])].filter(p => p.archived !== 1)
      .sort((a, b) => b.createdAt - a.createdAt),
    [rawPlans],
  )

  const today = todayISO()

  const todaySession = useMemo(
    () => sessions.find(s => s.scheduledFor === today && !s.completedAt) ?? null,
    [sessions, today],
  )
  const upcoming = useMemo(
    () => sessions.filter(s => s.scheduledFor > today && !s.completedAt),
    [sessions, today],
  )
  /* Newest first — a log is read backwards. */
  const history = useMemo(
    () => sessions.filter(s => s.completedAt).reverse(),
    [sessions],
  )

  const savePlan = useCallback(async (plan: WorkoutPlan, newSessions: StrengthSession[]) => {
    if (!db) return
    // One transaction: a plan whose sessions failed to write would show
    // up in the list as an empty routine with no way to tell why.
    await db.transaction('rw', db.workout_plans, db.strength_sessions, async () => {
      await db.workout_plans.put(plan)
      await db.strength_sessions.bulkPut(newSessions)
    })
  }, [])

  const deletePlan = useCallback(async (planId: string) => {
    if (!db) return
    await db.transaction('rw', db.workout_plans, db.strength_sessions, async () => {
      const owned = await db.strength_sessions.where('planId').equals(planId).toArray()
      /*
       * Completed sessions survive their plan. Deleting a routine means
       * "stop scheduling this", not "erase the training I already did" —
       * and volume history disappearing because a plan was tidied away
       * would be unrecoverable.
       */
      const toDelete = owned.filter(s => !s.completedAt).map(s => s.id)
      await db.strength_sessions.bulkDelete(toDelete)
      for (const s of owned) {
        if (s.completedAt) await db.strength_sessions.update(s.id, { planId: undefined })
      }
      await db.workout_plans.delete(planId)
    })
  }, [])

  const logSet = useCallback(async (
    sessionId: string, exerciseId: string, setId: string, patch: Partial<WorkSet>,
  ) => {
    if (!db) return
    const session = await db.strength_sessions.get(sessionId)
    if (!session) return

    const exercises = session.exercises.map(ex =>
      ex.id !== exerciseId ? ex : {
        ...ex,
        sets: ex.sets.map(s => (s.id === setId ? { ...s, ...patch } : s)),
      })

    const next: Partial<StrengthSession> = { exercises, updatedAt: Date.now() }
    // First logged set starts the clock, so nobody has to remember to.
    if (!session.startedAt) next.startedAt = Date.now()
    await db.strength_sessions.update(sessionId, next)
  }, [])

  const startSession = useCallback(async (sessionId: string) => {
    if (!db) return
    const s = await db.strength_sessions.get(sessionId)
    if (!s || s.startedAt) return
    await db.strength_sessions.update(sessionId, { startedAt: Date.now(), updatedAt: Date.now() })
  }, [])

  const finishSession = useCallback(async (sessionId: string) => {
    if (!db) return
    await db.strength_sessions.update(sessionId, {
      completedAt: Date.now(), updatedAt: Date.now(),
    })
  }, [])

  const rescheduleSession = useCallback(async (sessionId: string, dateISO: string) => {
    if (!db) return
    await db.strength_sessions.update(sessionId, { scheduledFor: dateISO, updatedAt: Date.now() })
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!db) return
    await db.strength_sessions.delete(sessionId)
  }, [])

  return {
    sessions, plans,
    isLoading: rawSessions === undefined || rawPlans === undefined,
    todaySession, upcoming, history,
    savePlan, deletePlan, logSet,
    startSession, finishSession, rescheduleSession, deleteSession,
  }
}

/* ── Derived stats, for the header strip ───────────────────────────── */

export interface StrengthStats {
  sessionsThisWeek: number
  volumeThisWeekKg: number
  totalSessions:    number
}

/**
 * The header numbers.
 *
 * Uses `daysAgoISO` rather than building a date and calling
 * `toISOString()`: that converts to UTC first, so anyone east of
 * Greenwich gets a cutoff a day out and silently loses or gains a
 * session at the boundary. Same reason the rest of the app stopped
 * doing it.
 *
 * There is deliberately no streak here. A streak needs a rule about what
 * breaks it — a missed week? a light one? — and inventing one would put
 * a number on screen that means whatever the implementation happened to
 * do. Better absent than arbitrary.
 */
export function computeStrengthStats(history: StrengthSession[]): StrengthStats {
  const cutoff = daysAgoISO(7)
  const thisWeek = history.filter(s => s.scheduledFor > cutoff)
  return {
    sessionsThisWeek: thisWeek.length,
    volumeThisWeekKg: thisWeek.reduce((a, s) => a + sessionVolumeKg(s), 0),
    totalSessions:    history.length,
  }
}

export { sessionVolumeKg, isSessionComplete }
