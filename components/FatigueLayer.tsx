'use client'

/**
 * FatigueLayer — Phase 5 · Step 5.6
 * ─────────────────────────────────────────────────────────────────
 * Zero-DOM ambient biofeedback rendering layer.  Mounted at layout
 * level (after Toast) so it covers the entire authenticated workspace.
 *
 * Responsibilities:
 *   1. Desaturation overlay (z:589) — backdrop-filter: saturate(0.75)
 *      applied to all painted content below it when isFatigued.
 *
 *   2. Warm tint overlay (z:590) — soft-light amber wash mimicking
 *      blue-light dampening when isFatigued.
 *
 *   3. Floating fatigue alert bar (z:591) — pill at bottom-centre
 *      with a one-click "Initialize Recovery" action.
 *
 *   4. Onset toast — fires once per fatigue episode (debounced by
 *      notifiedRef so it doesn't spam on every render cycle).
 *
 *   5. RecoveryCockpit (z:595) — rendered when isRecovering.
 *
 * Both overlays use opacity + visibility transitions rather than
 * conditional mounting so that the 1.5 s ease transition on exit
 * completes smoothly before the element is removed from compositing.
 */

import { useEffect, useRef }  from 'react'
import { useFatigue }          from '@/lib/FatigueContext'
import { useToast }            from '@/lib/ToastContext'
import RecoveryCockpit         from './RecoveryCockpit'
import styles                  from './FatigueLayer.module.css'

export default function FatigueLayer() {
  const {
    isFatigued,
    fatigueReason,
    continuousWorkMinutes,
    currentHealth,
    isRecovering,
    startRecovery,
  } = useFatigue()

  const { toast } = useToast()

  /* ── One-shot onset toast per fatigue episode ─────────────────
     notifiedRef resets to false whenever isFatigued clears so
     the next episode fires a fresh notification.               */
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (!isFatigued) {
      notifiedRef.current = false
      return
    }
    if (notifiedRef.current || isRecovering) return

    notifiedRef.current = true
    const msg =
      fatigueReason === 'work_time'
        ? `${continuousWorkMinutes} min of continuous work detected. Recovery recommended.`
        : fatigueReason === 'low_health'
        ? `HP at ${currentHealth} — focus reserves critically depleted.`
        : `Fatigue: ${continuousWorkMinutes} min unbroken work, HP ${currentHealth}.`

    toast(msg, 'error')
  }, [
    isFatigued, isRecovering, fatigueReason,
    continuousWorkMinutes, currentHealth, toast,
  ])

  /* ── Active only when fatigued and NOT in recovery ────────── */
  const overlayOn = isFatigued && !isRecovering

  /* ── Build a human-readable alert label ───────────────────── */
  const alertLabel =
    fatigueReason === 'work_time'
      ? `${continuousWorkMinutes} min unbroken — fatigue detected`
      : fatigueReason === 'low_health'
      ? `HP critical (${currentHealth}) — recovery needed`
      : `Fatigue — ${continuousWorkMinutes} min, HP ${currentHealth}`

  return (
    <>
      {/* Desaturation layer */}
      <div
        className={styles.filterOverlay}
        style={{
          opacity:    overlayOn ? 1 : 0,
          visibility: overlayOn ? 'visible' : 'hidden',
        }}
        aria-hidden="true"
      />

      {/* Warm tint layer */}
      <div
        className={styles.warmOverlay}
        style={{
          opacity:    overlayOn ? 1 : 0,
          visibility: overlayOn ? 'visible' : 'hidden',
        }}
        aria-hidden="true"
      />

      {/* Floating fatigue alert bar */}
      {overlayOn && (
        <div
          className={`${styles.fatigueBar} anim-slide-in`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.fatigueDot} aria-hidden="true" />
          <span className={styles.fatigueText}>{alertLabel}</span>
          <button
            type="button"
            className={styles.recoveryBtn}
            onClick={startRecovery}
          >
            Initialize Recovery
          </button>
        </div>
      )}

      {/* Recovery cockpit — rendered over the entire workspace */}
      {isRecovering && <RecoveryCockpit />}
    </>
  )
}
