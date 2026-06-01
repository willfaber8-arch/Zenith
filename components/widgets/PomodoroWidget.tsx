'use client'
/**
 * PomodoroWidget — Phase 1 stub
 * ────────────────────────────────────────────────────────────────
 * Displays the focus timer UI shell. Timer logic and session
 * persistence will be wired in Phase 2 (Study Shield module).
 * The UI is fully styled and ready to receive state from a
 * dedicated usePomodoroTimer() hook.
 */

import { useState, useEffect, useRef } from 'react'
import styles from './Widget.module.css'

const FOCUS_SECS  = 25 * 60   // 25 minutes
const BREAK_SECS  = 5  * 60   // 5 minutes

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

type Phase = 'focus' | 'break'

export default function PomodoroWidget() {
  const [phase,     setPhase]    = useState<Phase>('focus')
  const [remaining, setRem]      = useState(FOCUS_SECS)
  const [running,   setRunning]  = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Tick ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRem(prev => {
        if (prev <= 1) {
          /* Auto-switch phase */
          setPhase(p => p === 'focus' ? 'break' : 'focus')
          setRunning(false)
          return prev === 1
            ? (phase === 'focus' ? BREAK_SECS : FOCUS_SECS)
            : prev - 1
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => setRunning(r => !r)

  const handleReset = () => {
    setRunning(false)
    setPhase('focus')
    setRem(FOCUS_SECS)
  }

  return (
    <div
      className={styles.widget}
      style={{ '--widget-accent': 'var(--accent-purple)' } as React.CSSProperties}
    >
      <div className={styles.widgetHeader}>
        <p className={styles.widgetEyebrow}>Focus · Session</p>
        {running && (
          <span className={styles.widgetBadge} aria-live="polite">
            {phase === 'focus' ? 'FOCUS' : 'BREAK'}
          </span>
        )}
      </div>

      <p className={styles.widgetTitle}>
        {phase === 'focus' ? 'Deep Focus' : 'Short Break'}
      </p>

      <div className={styles.pomodoroBody}>
        <time
          className={styles.timerDisplay}
          aria-label={`${fmtSecs(remaining)} remaining`}
          suppressHydrationWarning
        >
          {fmtSecs(remaining)}
        </time>

        <p className={styles.timerLabel}>
          {phase === 'focus' ? '25-minute block' : '5-minute break'}
        </p>

        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            className={styles.startBtn}
            onClick={handleToggle}
            aria-label={running ? 'Pause timer' : 'Start focus session'}
          >
            {running ? 'Pause' : 'Start Focus'}
          </button>
          {(running || remaining !== FOCUS_SECS) && (
            <button
              type="button"
              className={styles.startBtn}
              onClick={handleReset}
              aria-label="Reset timer"
              style={{ opacity: 0.55 }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
