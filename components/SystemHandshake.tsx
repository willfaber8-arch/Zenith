'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * SystemHandshake — Phase 6 · Step 6.5
 * Boot validation overlay rendered once per browser session after
 * the user authenticates. Runs runSystemHandshake() and prints
 * terminal-style diagnostic rows in real time.
 *
 * Phase machine:
 *   booting  →  (900ms boot header) → scanning
 *   scanning →  (diagnostics run)  → success | fatal
 *   success  →  (1.5s delay)       → fade out → onUnlock()
 *   fatal    →  error card + retry / force-override buttons
 * ════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  runSystemHandshake,
  type CheckResult,
  type DiagnosticReport,
} from '@/utils/systemDiagnostics'
import styles from './SystemHandshake.module.css'

interface Props {
  onUnlock: () => void
}

type Phase = 'booting' | 'scanning' | 'success' | 'fatal'

/* ── Root component ───────────────────────────────────────────── */

export default function SystemHandshake({ onUnlock }: Props) {
  const [phase,   setPhase]   = useState<Phase>('booting')
  const [checks,  setChecks]  = useState<CheckResult[]>([])
  const [report,  setReport]  = useState<DiagnosticReport | null>(null)
  const [fading,  setFading]  = useState(false)
  const unlockedRef           = useRef(false)

  // Stable ref pattern — lets useEffect capture onUnlock without re-subscribing
  const onUnlockRef = useRef(onUnlock)
  useEffect(() => { onUnlockRef.current = onUnlock }, [onUnlock])

  const unlock = useCallback(() => {
    if (unlockedRef.current) return
    unlockedRef.current = true
    setFading(true)
    setTimeout(() => onUnlockRef.current(), 500)
  }, [])

  // Boot header phase: 900ms then begin scanning
  useEffect(() => {
    const t = setTimeout(() => setPhase('scanning'), 900)
    return () => clearTimeout(t)
  }, [])

  // Diagnostics phase
  useEffect(() => {
    if (phase !== 'scanning') return
    let cancelled = false

    const run = async () => {
      const result = await runSystemHandshake((partial) => {
        if (cancelled) return
        setChecks(prev => {
          const idx = prev.findIndex(c => c.id === partial.id)
          if (idx === -1) return [...prev, partial]
          const next = [...prev]
          next[idx] = partial
          return next
        })
      })

      if (cancelled) return
      setReport(result)

      if (result.hasFatal) {
        setPhase('fatal')
      } else {
        setPhase('success')
        setTimeout(() => { if (!cancelled) unlock() }, 1500)
      }
    }

    run()
    return () => { cancelled = true }
  }, [phase, unlock])

  const passCount  = checks.filter(c => c.status === 'passed').length
  const skipCount  = checks.filter(c => c.status === 'skipped').length
  const totalCount = checks.length

  return (
    <div
      className={styles.overlay}
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
    >
      <div className={styles.panel}>

        {/* ── Logo header ────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <span className={styles.logoGlyph}>Z</span>
            <div>
              <div className={styles.logoTitle}>ZENITH OS</div>
              <div className={styles.logoSub}>System Handshake Protocol · v6.5</div>
            </div>
          </div>
          <div className={styles.rule} />
        </div>

        {/* ── Booting: init text ─────────────────────────── */}
        {phase === 'booting' && (
          <div className={styles.initText}>
            <span>INITIATING RUNTIME VALIDATION PROTOCOL...</span>
            <span className={styles.cursor} />
          </div>
        )}

        {/* ── Scanning / complete: check list ────────────── */}
        {phase !== 'booting' && (
          <div className={styles.checkList}>
            {checks.map((c, i) => (
              <CheckRow key={c.id} check={c} index={i} />
            ))}
          </div>
        )}

        {/* ── Success summary ────────────────────────────── */}
        {phase === 'success' && report && (
          <div className={styles.result}>
            <div className={styles.rule} />
            <div className={styles.resultLine} data-type="success">
              SYSTEM HANDSHAKE: {passCount + skipCount}/{totalCount} DIAGNOSTICS CLEAR
            </div>
            <div className={styles.unlockLine}>
              UNLOCKING DASHBOARD...
              <span className={styles.cursor} />
            </div>
          </div>
        )}

        {/* ── Fatal error ────────────────────────────────── */}
        {phase === 'fatal' && report && (
          <div className={styles.result}>
            <div className={styles.rule} data-type="fatal" />
            <div className={styles.resultLine} data-type="fatal">
              SYSTEM HANDSHAKE: CRITICAL FAILURE DETECTED
            </div>
            {report.checks
              .filter(c => c.status === 'failed' && c.isFatal)
              .map(c => (
                <div key={c.id} className={styles.fatalDetail}>
                  ✗ {c.logLine.replace('...', '')}: {c.message}
                </div>
              ))}
            <div className={styles.actions}>
              <button
                className={styles.retryBtn}
                onClick={() => { setChecks([]); setReport(null); setPhase('scanning') }}
              >
                [ Re-run Diagnostics ]
              </button>
              <button className={styles.overrideBtn} onClick={unlock}>
                [ Force Override &amp; Run Offline Boot ]
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ── CheckRow sub-component ───────────────────────────────────── */

function CheckRow({ check, index }: { check: CheckResult; index: number }) {
  const isPassed  = check.status === 'passed'
  const isFailed  = check.status === 'failed'
  const isSkipped = check.status === 'skipped'
  const isRunning = check.status === 'running'
  const showResult = isPassed || isFailed || isSkipped

  return (
    <div
      className={styles.checkRow}
      data-status={check.status}
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <span className={styles.bracket}>[</span>
      <span>&nbsp;{check.logLine}&nbsp;</span>
      <span className={styles.bracket}>]</span>

      {isRunning && <span className={styles.cursor} />}

      {showResult && (
        <>
          <span className={styles.arrow}>&nbsp;-&gt;&nbsp;</span>
          <span className={styles.status} data-val={check.status}>
            {isPassed  && 'PASSED' }
            {isFailed  && 'FAILED' }
            {isSkipped && 'OFFLINE'}
          </span>
        </>
      )}

      {check.message && !isRunning && (
        <span className={styles.checkMsg}>&nbsp;&mdash;&nbsp;{check.message}</span>
      )}
    </div>
  )
}
