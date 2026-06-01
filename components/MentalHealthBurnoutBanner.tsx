'use client'
/**
 * MentalHealthBurnoutBanner — Phase 5 · Step 5.7
 * ─────────────────────────────────────────────────────────────────
 * Sticky notification bar mounted between the topbar and the
 * scrollable viewport in AppShell's content frame.
 *
 * Appears when the 3-day rolling MentalStateEvaluation crosses either:
 *   • 'emerging' risk  — single burnout day detected (gentler message)
 *   • 'critical' risk  — 2+ burnout days (prompts Recovery Cycle)
 *
 * Dismiss state persists for 24 h in localStorage so the banner
 * doesn't reappear immediately on every page load.
 */

import { useState, useEffect } from 'react'
import { useMentalHealthLog }  from '@/lib/hooks/useMentalHealthLog'
import { useFatigue }          from '@/lib/FatigueContext'
import styles                  from './MentalHealthBurnoutBanner.module.css'

const DISMISS_LS_KEY  = 'zenith_mh_dismissed_at'
const DISMISS_HOURS   = 24
const DISMISS_WINDOW  = DISMISS_HOURS * 60 * 60 * 1000

function isDismissedNow(): boolean {
  try {
    const ts = typeof localStorage !== 'undefined'
      ? localStorage.getItem(DISMISS_LS_KEY) : null
    if (!ts) return false
    return Date.now() - parseInt(ts, 10) < DISMISS_WINDOW
  } catch { return false }
}

function saveDismissed(): void {
  try { localStorage.setItem(DISMISS_LS_KEY, String(Date.now())) } catch { /* noop */ }
}

export default function MentalHealthBurnoutBanner() {
  const { evaluation }           = useMentalHealthLog()
  const { startRecovery, isRecovering } = useFatigue()
  const [dismissed, setDismissed] = useState(true)  // start hidden, set after mount

  /* Hydrate dismiss state client-side to avoid SSR flash */
  useEffect(() => {
    setDismissed(isDismissedNow())
  }, [])

  /* Reset dismissed state when risk clears completely */
  useEffect(() => {
    if (evaluation.burnoutRisk === 'none') setDismissed(false)
  }, [evaluation.burnoutRisk])

  const isCritical = evaluation.burnoutRisk === 'critical'
  const isEmerging = evaluation.burnoutRisk === 'emerging'
  const visible    = (isCritical || isEmerging) && !dismissed && !isRecovering

  if (!visible) return null

  const handleDismiss = () => {
    setDismissed(true)
    saveDismissed()
  }

  const dotClass   = isCritical ? styles.dot : `${styles.dot} ${styles.dotEmerging}`
  const labelClass = isCritical ? styles.label : `${styles.label} ${styles.labelEmerging}`
  const bannerClass = `${styles.banner} ${isCritical ? styles.bannerCritical : ''}`
  const labelText  = isCritical ? 'Burnout Detected' : 'Fatigue Signal'

  return (
    <div
      className={bannerClass}
      role="alert"
      aria-live="polite"
    >
      <div className={styles.left}>
        <span className={dotClass} aria-hidden="true" />
        <div className={styles.textBlock}>
          <span className={labelClass}>{labelText}</span>
          {evaluation.trendMessage && (
            <span className={styles.message}>{evaluation.trendMessage}</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {isCritical && (
          <button
            type="button"
            className={styles.recoveryBtn}
            onClick={startRecovery}
          >
            Start Recovery
          </button>
        )}
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={handleDismiss}
          aria-label={`Dismiss ${labelText} notification`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
