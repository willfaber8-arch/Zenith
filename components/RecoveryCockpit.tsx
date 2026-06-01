'use client'

/**
 * RecoveryCockpit — Phase 5 · Step 5.6
 * ─────────────────────────────────────────────────────────────────
 * Full-viewport recovery modal.  Rendered by FatigueLayer when
 * isRecovering is true.  Manages its own epoch-based countdown
 * (un-pausable, per spec) and fires the reward on natural completion:
 *   • +25 HP (capped at 100)
 *   • +15 Zenith Gold
 *   • Success toast
 *
 * SECURE LOCKDOWN: the cockpit covers all workspace UI at z-index 595.
 * Attempting to close early shows an inline gentle-lockout prompt
 * instead of actually dismissing the panel.
 *
 * Breathing animation: two concentric SVG circles scale between
 * 0.84 → 1.16 (outer) and 0.72 → 1.28 (inner) on a 4 s ease
 * cycle, alternating inhale/exhale phases via React class toggling.
 * transform-box: fill-box + transform-origin: center ensures each
 * circle expands around its own geometric centre.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFatigue }   from '@/lib/FatigueContext'
import { useToast }     from '@/lib/ToastContext'
import { db }           from '@/lib/db'
import styles           from './RecoveryCockpit.module.css'

/* ── Constants ────────────────────────────────────────────────── */

const RECOVERY_SECS = 10 * 60   // 10 minutes
const HP_REWARD     = 25
const GOLD_REWARD   = 15
const HP_CAP        = 100

/* ── SVG layout ───────────────────────────────────────────────── */

const CX   = 110
const CY   = 110
const R    = 80   // progress arc radius
const CIRC = 2 * Math.PI * R

/* ── Component ────────────────────────────────────────────────── */

export default function RecoveryCockpit() {
  const { endRecovery } = useFatigue()
  const { toast }       = useToast()

  /* Entrance animation — single rAF guarantees initial paint at opacity:0 */
  const [visible,         setVisible]         = useState(false)
  const [secondsLeft,     setSecondsLeft]     = useState(RECOVERY_SECS)
  const [showEarlyPrompt, setShowEarlyPrompt] = useState(false)
  const [phase,           setPhase]           = useState<'inhale' | 'exhale'>('inhale')

  const epochRef     = useRef<number>(Date.now())
  const completedRef = useRef(false)

  /* ── Entrance (setTimeout instead of double-rAF — StrictMode safe) */
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [])

  /* ── Breathing cycle: alternate inhale/exhale every 4 s ───────── */
  useEffect(() => {
    const id = setInterval(
      () => setPhase(p => p === 'inhale' ? 'exhale' : 'inhale'),
      4000,
    )
    return () => clearInterval(id)
  }, [])

  /* ── Reward on natural completion ─────────────────────────────── */
  const handleComplete = useCallback(async () => {
    if (completedRef.current) return
    completedRef.current = true

    try {
      // Atomic transaction: HP restore + Gold grant in a single modify call
      await db.userProfile.where('id').equals(1).modify(profile => {
        profile.healthPoints = Math.min(HP_CAP, (profile.healthPoints ?? 0) + HP_REWARD)
        profile.goldPoints   = (profile.goldPoints ?? 0) + GOLD_REWARD
        profile.lastActiveAt = Date.now()
      })
    } catch {
      /* Profile not seeded yet — non-fatal, reward is lost silently */
    }

    toast('Recovery Cycle Complete. Health restored. Ready to focus.', 'success')
    endRecovery()
  }, [endRecovery, toast])

  /* ── Epoch-based countdown (250 ms cadence, immune to tab throttle) */
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - epochRef.current) / 1000)
      const rem     = Math.max(0, RECOVERY_SECS - elapsed)
      setSecondsLeft(rem)
      if (rem <= 0) handleComplete()
    }, 250)
    return () => clearInterval(id)
  }, [handleComplete])

  /* ── Formatted time display ───────────────────────────────────── */
  const mins    = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  /* Progress arc: 0 = full circle, increases toward CIRC as time passes */
  const arcOffset = CIRC * (secondsLeft / RECOVERY_SECS)

  return (
    <div
      className={styles.overlay}
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.97)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Recovery Cycle — workspace locked"
    >
      <div className={styles.cockpit}>

        {/* ── Header ────────────────────────────────────────── */}
        <div className={styles.header}>
          <span className={styles.eyebrow}>Zenith · Recovery Protocol</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setShowEarlyPrompt(true)}
            aria-label="Request early exit"
          >
            ✕
          </button>
        </div>

        {/* ── Breathing SVG canvas ──────────────────────────── */}
        <div className={styles.breathCanvas}>
          <svg
            viewBox="0 0 220 220"
            width="220"
            height="220"
            className={styles.svg}
            aria-hidden="true"
          >
            {/* Track ring — static faint guide */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke="rgba(82, 204, 163, 0.10)"
              strokeWidth="2.5"
            />

            {/* Progress arc — shrinks as time runs (countdown reveals it) */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke="rgba(82, 204, 163, 0.70)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={arcOffset}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />

            {/* Outer breathing ring */}
            <circle
              cx={CX} cy={CY} r={55}
              fill="rgba(82, 204, 163, 0.05)"
              stroke="rgba(82, 204, 163, 0.22)"
              strokeWidth="1.5"
              className={`${styles.ringOuter} ${
                phase === 'inhale' ? styles.outerExpand : styles.outerContract
              }`}
            />

            {/* Inner breathing ring */}
            <circle
              cx={CX} cy={CY} r={33}
              fill="rgba(82, 204, 163, 0.08)"
              stroke="rgba(82, 204, 163, 0.38)"
              strokeWidth="2"
              className={`${styles.ringInner} ${
                phase === 'inhale' ? styles.innerExpand : styles.innerContract
              }`}
            />

            {/* Center dot with pulseGlow */}
            <circle
              cx={CX} cy={CY} r={5}
              fill="rgba(82, 204, 163, 0.75)"
              className={styles.centerDot}
            />

            {/* Countdown timer */}
            <text
              x={CX}
              y={CY - 11}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.timerText}
            >
              {timeStr}
            </text>

            {/* Breathing phase label */}
            <text
              x={CX}
              y={CY + 15}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.phaseLabel}
            >
              {phase === 'inhale' ? 'INHALE' : 'EXHALE'}
            </text>
          </svg>
        </div>

        {/* ── Instructions ──────────────────────────────────── */}
        <div className={styles.instructions}>
          <p className={styles.mainInstruction}>
            Step away from the screen. Let your eyes rest.
          </p>
          <p className={styles.subInstruction}>
            Look at something 20 feet away. Roll your shoulders.
            Breathe slowly with the rhythm above.
            Return in {timeStr}.
          </p>
        </div>

        {/* ── Reward preview strip ──────────────────────────── */}
        <div className={styles.rewardRow}>
          <div className={styles.rewardChip}>
            <span className={styles.rewardIcon} aria-hidden="true">♥</span>
            <span className={styles.rewardValue}>+{HP_REWARD} HP</span>
          </div>
          <div className={styles.rewardSep} aria-hidden="true" />
          <div className={styles.rewardChip}>
            <span className={`${styles.rewardIcon} ${styles.rewardGoldIcon}`} aria-hidden="true">◈</span>
            <span className={`${styles.rewardValue} ${styles.rewardGoldValue}`}>
              +{GOLD_REWARD} Gold
            </span>
          </div>
          <span className={styles.rewardLabel}>on completion</span>
        </div>

        {/* ── Early-exit lockout prompt ──────────────────────── */}
        {showEarlyPrompt && (
          <div className={`${styles.earlyPrompt} anim-scale-in`} role="alert">
            <p className={styles.earlyPromptText}>
              Your recovery is incomplete. Protect your streak by resting.
            </p>
            <button
              type="button"
              className={styles.continueBtn}
              onClick={() => setShowEarlyPrompt(false)}
            >
              Continue Recovery
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
