'use client'

/**
 * PomodoroCanvas
 * Phase 3 · Step 3.2 — Radial Countdown Viewport
 *
 * An SVG-based radial progress ring that reflects the exact time
 * remaining in the active Pomodoro phase, down to the second.
 *
 * Visual contract:
 *   WORK / PAUSED-on-WORK → periwinkle (--accent-purple) sweep arc
 *   SHORT_BREAK / LONG_BREAK → ocean-sage (--accent-green) sweep arc
 *   PAUSED → arc at reduced opacity (frozen at pause position)
 *   IDLE → no arc, track ring only, shows "25:00 / Ready"
 *
 * Session pips row below the ring mirrors the current cycle position
 * (0–3) using the same filled/empty visual language as the top bar.
 */

import type { TimerState } from '@/lib/hooks/usePomodoroStateMachine'
import styles from './PomodoroCanvas.module.css'

/* ── Ring geometry (matches existing StudyPomodoroArena constants) ─ */
const R    = 80
const CX   = 100
const CY   = 100
const CIRC = 2 * Math.PI * R  // ≈ 502.655

const SESSIONS_PER_CYCLE = 4

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function phaseLabel(state: TimerState): string {
  switch (state) {
    case 'WORK':        return 'Focus'
    case 'SHORT_BREAK': return 'Break'
    case 'LONG_BREAK':  return 'Long Break'
    case 'PAUSED':      return 'Paused'
    default:            return 'Ready'
  }
}

/**
 * Derive the phase description from totalSecs so the label stays
 * accurate even in PAUSED state (where timerState = 'PAUSED' but
 * totalSecs still holds the pre-pause phase duration).
 */
function intervalLabel(totalSecs: number): string {
  if (totalSecs === 300) return '5-min reset'
  if (totalSecs === 900) return '15-min rest'
  return '25-min block'
}

/* ── Component ───────────────────────────────────────────────────── */

interface PomodoroCanvasProps {
  timerState:    TimerState
  /** Seconds remaining — drives the progress arc */
  remaining:     number
  /** Full phase duration — unchanged through PAUSED for correct arc math */
  totalSecs:     number
  /** 0–3: number of filled pips in the current 4-session cycle */
  cyclePosition: number
}

export default function PomodoroCanvas({
  timerState,
  remaining,
  totalSecs,
  cyclePosition,
}: PomodoroCanvasProps) {
  const isBreak   = timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isRunning = timerState === 'WORK' || timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isIdle    = timerState === 'IDLE'
  const isPaused  = timerState === 'PAUSED'

  /* Arc progress — IDLE shows no arc (progress = 0, full dashOffset) */
  const progress   = isIdle ? 0 : Math.max(0, Math.min(1, (totalSecs - remaining) / totalSecs))
  const dashOffset = CIRC * (1 - progress)

  /* Color tokens: purple for focus, green for rest */
  const ringColor    = isBreak ? 'var(--accent-green)'  : 'var(--accent-purple)'
  const ringOpacity  = isPaused ? 0.5 : 1

  /* Track ring dims when idle to soften the "empty" appearance */
  const trackOpacity = isIdle ? 0.04 : 0.07

  return (
    <div className={styles.root}>

      {/* ── Ring + overlay ──────────────────────────────────────── */}
      <div className={styles.ringWrap}>
        <svg
          width={220}
          height={220}
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          {/* Subtle tick marks at 12 clock positions */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360 - 90
            const rad   = (angle * Math.PI) / 180
            const inner = R - 6
            const outer = R + 1
            return (
              <line
                key={i}
                x1={CX + inner * Math.cos(rad)}
                y1={CY + inner * Math.sin(rad)}
                x2={CX + outer * Math.cos(rad)}
                y2={CY + outer * Math.sin(rad)}
                stroke="rgba(124,149,255,0.12)"
                strokeWidth={1}
              />
            )
          })}

          {/* Track ring */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="rgba(124,149,255,1)"
            strokeOpacity={trackOpacity}
            strokeWidth={5}
            style={{ transition: 'stroke-opacity 400ms ease' }}
          />

          {/* Progress arc — starts at 12 o'clock */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={ringColor}
            strokeOpacity={ringOpacity}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{
              transition: isRunning
                ? 'stroke-dashoffset 0.25s linear, stroke 400ms ease, stroke-opacity 300ms ease'
                : 'stroke 400ms ease, stroke-opacity 300ms ease',
            }}
          />
        </svg>

        {/* Time + label overlay — centered inside the ring */}
        <div className={styles.overlay}>
          <span className={`${styles.phaseTag} ${isBreak ? styles.phaseTagBreak : ''}`}>
            {phaseLabel(timerState)}
          </span>

          <time
            className={styles.timerDisplay}
            aria-live="polite"
            aria-atomic="true"
            aria-label={`${fmtSecs(remaining)} remaining`}
            suppressHydrationWarning
          >
            {fmtSecs(remaining)}
          </time>

          <span className={styles.intervalLabel}>
            {intervalLabel(totalSecs)}
          </span>
        </div>
      </div>

      {/* ── Session pips ────────────────────────────────────────── */}
      <div
        className={styles.pips}
        role="status"
        aria-label={`${cyclePosition} of ${SESSIONS_PER_CYCLE} sessions completed this cycle`}
      >
        {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
          <span
            key={i}
            className={`${styles.pip} ${i < cyclePosition ? styles.pipFilled : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

    </div>
  )
}
