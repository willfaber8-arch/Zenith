'use client'

/**
 * usePomodoroStateMachine
 * Phase 3 · Step 3.2 — Pomodoro FSM Engine
 *
 * Implements a declarative finite state machine for Pomodoro timing.
 * Timing is epoch-based (Date.now() delta) rather than tick-counting,
 * so the clock stays accurate even when the browser throttles intervals
 * in background tabs.
 *
 * State graph:
 *   IDLE ──start──► WORK ──complete──► SHORT_BREAK ─┐
 *                    │                 (every 4th)   │
 *                    │          ──► LONG_BREAK ───────┤
 *                    │                               │
 *                    ◄──────────────── IDLE ◄────────┘
 *
 *   Any active state ──pause──► PAUSED ──resume──► prev state
 *   Any state ──reset──► IDLE
 *   Any state ──skip──► next phase (auto-starts)
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { db, awardXp } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import { useStudyMode } from '@/lib/StudyModeContext'

/* ── Timer constants ─────────────────────────────────────────────── */

export const WORK_SECS        = 25 * 60  // 1500 s
export const SHORT_BREAK_SECS =  5 * 60  // 300 s
export const LONG_BREAK_SECS  = 15 * 60  // 900 s
export const SESSIONS_PER_LONG_BREAK = 4

/* ── Types ───────────────────────────────────────────────────────── */

export type TimerState = 'IDLE' | 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK' | 'PAUSED'

export interface PomodoroMachine {
  /** Current FSM state */
  timerState:       TimerState
  /** Seconds remaining in the active phase */
  remaining:        number
  /** Full duration of the active phase (unchanged during PAUSED) */
  totalSecs:        number
  /** Cumulative completed work sessions this hook lifetime */
  sessionCount:     number
  /** 0–3: position within the current 4-session cycle */
  cyclePosition:    number
  /** Interruptions logged in the current WORK session */
  distractionCount: number
  /** IDLE → WORK */
  start:            () => void
  /** Active → PAUSED */
  pause:            () => void
  /** PAUSED → previous state */
  resume:           () => void
  /** Skip to next phase (increments session count without IDB log) */
  skip:             () => void
  /** Any → IDLE, timer/distraction reset (session count preserved) */
  reset:            () => void
  /** Increment distraction counter + fire toast (WORK only) */
  logDistraction:   () => void
}

/* ── Helper ──────────────────────────────────────────────────────── */

function secsForState(s: TimerState): number {
  if (s === 'SHORT_BREAK') return SHORT_BREAK_SECS
  if (s === 'LONG_BREAK')  return LONG_BREAK_SECS
  return WORK_SECS
}

/* ── Hook ────────────────────────────────────────────────────────── */

export function usePomodoroStateMachine(): PomodoroMachine {
  const { incrementSession } = useStudyMode()
  const { toast }            = useToast()

  /* ── Timing refs (never trigger re-renders) ────────────────────
     epochRef:      Date.now() when the timer last started or resumed.
     remainAtStart: remaining seconds at that same moment.
     Together these let any interval tick compute the exact remaining
     time as: max(0, remainAtStart - floor((now - epoch) / 1000))
     This is immune to setInterval drift and background tab throttling.
  ─────────────────────────────────────────────────────────────── */
  const epochRef        = useRef<number | null>(null)
  const remainAtStart   = useRef(WORK_SECS)

  /* ── FSM state refs (mirror React state for use inside callbacks) */
  const stateRef        = useRef<TimerState>('IDLE')
  const prevStateRef    = useRef<TimerState>('WORK')  // state before PAUSED
  const countRef        = useRef(0)                   // completed work sessions
  const distractRef     = useRef(0)
  const sessionStartRef = useRef(0)                   // wall-clock ms, WORK entry
  const phaseDoneRef    = useRef(false)               // guard: prevent double-fire

  /* ── React display state ────────────────────────────────────── */
  const [timerState,       setTimerState]       = useState<TimerState>('IDLE')
  const [remaining,        setRemaining]        = useState(WORK_SECS)
  const [totalSecs,        setTotalSecs]        = useState(WORK_SECS)
  const [sessionCount,     setSessionCount]     = useState(0)
  const [distractionCount, setDistractionCount] = useState(0)

  /* ── Latest-ref for completePhase (breaks stale-closure problem) */
  const completeFnRef = useRef<(() => void) | null>(null)

  /* ── Phase completion ─────────────────────────────────────────
     Called only when remaining reaches 0 (phaseDoneRef guards against
     double-fire when the interval fires faster than 1 second).
  ─────────────────────────────────────────────────────────────── */
  const completePhase = useCallback(() => {
    const current = stateRef.current

    if (current === 'WORK') {
      const distractions = distractRef.current
      const startMs      = sessionStartRef.current

      // Persist session record and award XP for natural completion
      db.pomodoroSessions.add({
        sessionType:      'work',
        durationMinutes:  25,
        completedAt:      Date.now(),
        startedAt:        startMs,
        distractionCount: distractions,
      }).then(() => awardXp(25)).catch(console.error)

      // Update session counters (ref first, then state for stability)
      countRef.current += 1
      const newCount = countRef.current
      setSessionCount(newCount)
      incrementSession()

      // Every 4th session earns a long break
      const nextState: TimerState =
        newCount % SESSIONS_PER_LONG_BREAK === 0 ? 'LONG_BREAK' : 'SHORT_BREAK'
      const nextSecs = secsForState(nextState)

      // Transition to break — auto-starts immediately
      stateRef.current      = nextState
      epochRef.current      = Date.now()
      remainAtStart.current = nextSecs
      setTimerState(nextState)
      setTotalSecs(nextSecs)
      setRemaining(nextSecs)
      distractRef.current = 0
      setDistractionCount(0)

    } else {
      // Break complete → return to IDLE; user manually starts next block
      stateRef.current      = 'IDLE'
      epochRef.current      = null
      remainAtStart.current = WORK_SECS
      setTimerState('IDLE')
      setTotalSecs(WORK_SECS)
      setRemaining(WORK_SECS)
    }
  }, [incrementSession])

  /* Keep completeFnRef current on every render (latest-ref pattern).
     The interval closure reads completeFnRef.current so it always
     calls the most recent version without needing it in deps. */
  useEffect(() => {
    completeFnRef.current = completePhase
  })

  /* ── Interval: active only during WORK | SHORT_BREAK | LONG_BREAK
     Re-runs whenever timerState changes; cleans up previous interval.
     Each tick computes remaining from the wall-clock epoch — not by
     counting ticks — so background throttling cannot cause drift.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const isActive =
      timerState === 'WORK' ||
      timerState === 'SHORT_BREAK' ||
      timerState === 'LONG_BREAK'

    if (!isActive) return

    phaseDoneRef.current = false

    const id = setInterval(() => {
      if (epochRef.current === null) return
      const elapsed = Math.floor((Date.now() - epochRef.current) / 1000)
      const rem     = Math.max(0, remainAtStart.current - elapsed)
      setRemaining(rem)
      if (rem <= 0 && !phaseDoneRef.current) {
        phaseDoneRef.current = true
        completeFnRef.current?.()
      }
    }, 250) // 250ms cadence: sub-second responsiveness without rendering cost

    return () => clearInterval(id)
  }, [timerState]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Unmount safety: freeze refs so stale callbacks are no-ops ─ */
  useEffect(() => {
    return () => {
      stateRef.current = 'IDLE'
      epochRef.current = null
    }
  }, [])

  /* ── Public actions ───────────────────────────────────────────── */

  const start = useCallback(() => {
    if (stateRef.current !== 'IDLE') return
    const now = Date.now()
    sessionStartRef.current = now
    epochRef.current        = now
    remainAtStart.current   = WORK_SECS
    phaseDoneRef.current    = false
    distractRef.current     = 0
    stateRef.current        = 'WORK'
    setTimerState('WORK')
    setTotalSecs(WORK_SECS)
    setRemaining(WORK_SECS)
    setDistractionCount(0)
  }, [])

  const pause = useCallback(() => {
    const cur = stateRef.current
    if (cur === 'IDLE' || cur === 'PAUSED') return

    // Snapshot the exact remaining at pause time
    const rem = epochRef.current !== null
      ? Math.max(0, remainAtStart.current - Math.floor((Date.now() - epochRef.current) / 1000))
      : remainAtStart.current

    epochRef.current      = null
    remainAtStart.current = rem   // preserved for resume
    prevStateRef.current  = cur
    stateRef.current      = 'PAUSED'
    setTimerState('PAUSED')
    setRemaining(rem)
    // totalSecs is intentionally not changed — phase duration is unchanged
  }, [])

  const resume = useCallback(() => {
    if (stateRef.current !== 'PAUSED') return
    epochRef.current     = Date.now()
    // remainAtStart.current still holds the paused remaining
    const prev           = prevStateRef.current
    phaseDoneRef.current = false
    stateRef.current     = prev
    setTimerState(prev)
    // remaining and totalSecs carry forward from the paused snapshot
  }, [])

  const skip = useCallback(() => {
    phaseDoneRef.current = false

    // Resolve through PAUSED to find the actual phase being skipped
    const effective = stateRef.current === 'PAUSED'
      ? prevStateRef.current
      : stateRef.current

    if (effective === 'IDLE') return

    if (effective === 'WORK') {
      // Skipping focus: count the session but no IDB log or XP award
      countRef.current += 1
      const newCount = countRef.current
      setSessionCount(newCount)
      incrementSession()

      const nextState: TimerState =
        newCount % SESSIONS_PER_LONG_BREAK === 0 ? 'LONG_BREAK' : 'SHORT_BREAK'
      const nextSecs = secsForState(nextState)

      stateRef.current      = nextState
      epochRef.current      = Date.now()
      remainAtStart.current = nextSecs
      setTimerState(nextState)
      setTotalSecs(nextSecs)
      setRemaining(nextSecs)
      distractRef.current = 0
      setDistractionCount(0)

    } else {
      // Skipping a break → back to IDLE
      stateRef.current      = 'IDLE'
      epochRef.current      = null
      remainAtStart.current = WORK_SECS
      setTimerState('IDLE')
      setTotalSecs(WORK_SECS)
      setRemaining(WORK_SECS)
    }
  }, [incrementSession])

  const reset = useCallback(() => {
    phaseDoneRef.current  = false
    stateRef.current      = 'IDLE'
    prevStateRef.current  = 'WORK'
    epochRef.current      = null
    remainAtStart.current = WORK_SECS
    distractRef.current   = 0
    // sessionCount is intentionally preserved — reset means "restart the timer",
    // not "forget this session's history"
    setTimerState('IDLE')
    setTotalSecs(WORK_SECS)
    setRemaining(WORK_SECS)
    setDistractionCount(0)
  }, [])

  const logDistraction = useCallback(() => {
    if (stateRef.current !== 'WORK') return
    distractRef.current += 1
    setDistractionCount(distractRef.current)
    toast('Distraction logged. Refocusing...', 'info')
  }, [toast])

  return {
    timerState,
    remaining,
    totalSecs,
    sessionCount,
    cyclePosition: sessionCount % SESSIONS_PER_LONG_BREAK,
    distractionCount,
    start,
    pause,
    resume,
    skip,
    reset,
    logDistraction,
  }
}
