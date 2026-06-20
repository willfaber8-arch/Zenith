'use client'

/**
 * PomodoroCanvas
 * Phase 3 · Step 3.2 — Radial Countdown Viewport
 *
 * An SVG-based radial progress ring + a tomato that gradually fills as
 * the active phase elapses, reflecting the exact time remaining down to
 * the second.
 *
 * Visual contract:
 *   WORK / PAUSED-on-WORK → periwinkle (--accent-purple) sweep arc + red tomato fill
 *   SHORT_BREAK / LONG_BREAK → ocean-sage (--accent-green) sweep arc + green fill
 *   PAUSED → arc + fill at reduced opacity (frozen at pause position)
 *   IDLE → empty tomato, track ring only, shows "25:00 / Ready"
 *
 * The tomato fills bottom-to-top in lock-step with the progress arc, so
 * the harvest metaphor (a ripening tomato) doubles as the time readout.
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

/* ── Tomato geometry (centred, sits inside the ring) ─────────────── */
const TOM_CX = 100
const TOM_CY = 118
const TOM_RX = 58
const TOM_RY = 52
const TOM_TOP    = TOM_CY - TOM_RY   // 66
const TOM_HEIGHT = TOM_RY * 2        // 104

/* Tomato palette (no design token exists for tomato red — kept literal,
   mirroring the canvas colour-constant convention). */
const TOMATO_RED = '#e8604c'
const TOMATO_BG  = '#2c1a18'   // unfilled flesh, dark
const LEAF_GREEN = '#4f9d63'
const STALK      = '#5f7d3c'

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
 * Derive the phase description from the live state + duration so the
 * label stays accurate for any focus mode (5/10/15/25-min) — not just
 * the classic Pomodoro lengths.
 */
function intervalLabel(state: TimerState, totalSecs: number): string {
  const mins = Math.max(1, Math.round(totalSecs / 60))
  if (state === 'SHORT_BREAK') return `${mins}-min break`
  if (state === 'LONG_BREAK')  return `${mins}-min rest`
  return `${mins}-min block`
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

  /* Tomato fill rises bottom-to-top with progress. The fill rect spans
     the whole body and is translated down so only the bottom `progress`
     fraction shows through the body-shaped clip — a transform transition
     is universally supported (unlike y/height geometry transitions). */
  const fillColor    = isBreak ? 'var(--accent-green)' : TOMATO_RED
  const fillOpacity  = isPaused ? 0.45 : 1
  const fillShiftY   = (1 - progress) * (TOM_HEIGHT + 14)  // +14 fully clears at p=0

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

          {/* ── Tomato ────────────────────────────────────────────
             Body-shaped clip reveals a rising fill rect; leaves + stalk
             sit on top. The whole fruit "ripens" as the phase elapses. */}
          <defs>
            <clipPath id="tomatoBodyClip">
              <ellipse cx={TOM_CX} cy={TOM_CY} rx={TOM_RX} ry={TOM_RY} />
            </clipPath>
          </defs>

          {/* Unfilled flesh */}
          <ellipse
            cx={TOM_CX} cy={TOM_CY} rx={TOM_RX} ry={TOM_RY}
            fill={TOMATO_BG}
          />

          {/* Rising fill — clipped to the body silhouette */}
          <g clipPath="url(#tomatoBodyClip)">
            <rect
              x={TOM_CX - TOM_RX - 4}
              y={TOM_TOP - 6}
              width={TOM_RX * 2 + 8}
              height={TOM_HEIGHT + 20}
              fill={fillColor}
              fillOpacity={fillOpacity}
              transform={`translate(0 ${fillShiftY})`}
              style={{
                transition: isRunning
                  ? 'transform 0.6s linear, fill 400ms ease, fill-opacity 300ms ease'
                  : 'transform 0.4s ease, fill 400ms ease, fill-opacity 300ms ease',
              }}
            />
          </g>

          {/* Glossy highlight — fixed, gives the fruit volume */}
          <ellipse
            cx={TOM_CX - 18} cy={TOM_CY - 20} rx={15} ry={10}
            fill="rgba(255,255,255,0.16)"
            clipPath="url(#tomatoBodyClip)"
          />

          {/* Body rim */}
          <ellipse
            cx={TOM_CX} cy={TOM_CY} rx={TOM_RX} ry={TOM_RY}
            fill="none"
            stroke={isBreak ? 'rgba(82,204,163,0.55)' : 'rgba(232,96,76,0.55)'}
            strokeWidth={2}
            style={{ transition: 'stroke 400ms ease' }}
          />

          {/* Stalk */}
          <path
            d={`M${TOM_CX} ${TOM_TOP - 2} L${TOM_CX} ${TOM_TOP - 16}`}
            stroke={STALK} strokeWidth={4} strokeLinecap="round" fill="none"
          />

          {/* 5-point leafy sepal */}
          <path
            d={`M${TOM_CX} ${TOM_TOP - 18}
                L${TOM_CX + 9} ${TOM_TOP - 2}
                L${TOM_CX + 26} ${TOM_TOP - 4}
                L${TOM_CX + 13} ${TOM_TOP + 9}
                L${TOM_CX + 19} ${TOM_TOP + 25}
                L${TOM_CX} ${TOM_TOP + 14}
                L${TOM_CX - 19} ${TOM_TOP + 25}
                L${TOM_CX - 13} ${TOM_TOP + 9}
                L${TOM_CX - 26} ${TOM_TOP - 4}
                L${TOM_CX - 9} ${TOM_TOP - 2} Z`}
            fill={LEAF_GREEN}
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={0.75}
            strokeLinejoin="round"
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
            {intervalLabel(timerState, totalSecs)}
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
