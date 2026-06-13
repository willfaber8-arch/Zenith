'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Master Stability Release Console
 * Phase 13 · Step 13.3 — Total System Hardening Verification
 *
 * A final release sign-off cockpit that runs the complete Phase 8–13
 * regression suite and surfaces a full-screen cinematic seal once
 * all checks pass. Built for engineers who need to confirm every
 * architectural pillar is green before shipping.
 *
 * State machine:
 *   idle → running → complete → sealed
 *
 * On 'sealed': a hardware-accelerated cinematic overlay renders with
 * staggered entrance animations, the draw-on SVG seal badge, and the
 * certified phase list. Dismiss via click anywhere or Escape key.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  runFullSystemSanityCheck,
  PHASE_CHECK_IDS,
  PHASE_CHECK_LABELS,
  type PhaseCheckId,
  type PhaseCheckResult,
  type DiagnosticManifest,
  type SystemMetrics,
} from '@/utils/systemHardening'
import { useSystemTeardown } from '@/lib/hooks/useSystemTeardown'
import styles from './StabilityReleaseConsole.module.css'

/* ════════════════════════════════════════════════════════════════
   INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type ConsolePhase = 'idle' | 'running' | 'complete' | 'sealed'
type CheckStatus  = 'pending' | 'running' | 'passed' | 'failed'

interface CheckState {
  status:     CheckStatus
  durationMs?: number
  detail?:    string
}

type CheckStateMap = Record<PhaseCheckId, CheckState>

const INITIAL_CHECK_STATES: CheckStateMap = {
  phase8:     { status: 'pending' },
  phase9:     { status: 'pending' },
  phase10:    { status: 'pending' },
  phase11_12: { status: 'pending' },
  phase13:    { status: 'pending' },
}

/* ════════════════════════════════════════════════════════════════
   METRIC CARD SUB-COMPONENT
   ════════════════════════════════════════════════════════════════ */

function MetricCard({
  label,
  value,
  variant,
}: {
  label:   string
  value:   string
  variant: string
}) {
  const valueClass = (() => {
    switch (variant) {
      case 'OPTIMAL':  return styles.metricValueOptimal
      case 'WARNING':  return styles.metricValueWarning
      case 'CRITICAL': return styles.metricValueCritical
      case 'SECURE':   return styles.metricValueSecure
      case 'DEGRADED': return styles.metricValueDegraded
      default:         return styles.metricValueDefault
    }
  })()

  const cardClass = (() => {
    switch (variant) {
      case 'OPTIMAL':  return styles.metricCardOptimal
      case 'WARNING':  return styles.metricCardWarning
      case 'CRITICAL': return styles.metricCardCritical
      case 'SECURE':   return styles.metricCardSecure
      case 'DEGRADED': return styles.metricCardDegraded
      default:         return ''
    }
  })()

  return (
    <div className={`${styles.metricCard} ${cardClass}`}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={`${styles.metricValue} ${valueClass}`}>{value}</p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   CHECK ROW SUB-COMPONENT
   ════════════════════════════════════════════════════════════════ */

function CheckRow({
  phaseId,
  state,
  showDetail,
}: {
  phaseId:    PhaseCheckId
  state:      CheckState
  showDetail: boolean
}) {
  const { status, durationMs, detail } = state

  const rowClass = [
    styles.checkRow,
    status === 'pending'  ? styles.checkRowPending  : '',
    status === 'running'  ? styles.checkRowRunning  : '',
    status === 'passed'   ? styles.checkRowPassed   : '',
    status === 'failed'   ? styles.checkRowFailed   : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className={rowClass}>
        <div className={styles.checkBullet} />
        <span className={styles.checkLabel}>{PHASE_CHECK_LABELS[phaseId]}</span>

        {status === 'passed' && (
          <span className={styles.checkBadge}>[ ENGINES CERTIFIED ]</span>
        )}
        {status === 'failed' && (
          <span className={styles.checkBadgeFailed}>[ CHECK FAILED ]</span>
        )}

        {durationMs != null && (
          <span className={styles.checkDuration}>{durationMs}ms</span>
        )}
      </div>

      {showDetail && detail && (status === 'passed' || status === 'failed') && (
        <p className={styles.checkDetail}>{detail}</p>
      )}
    </>
  )
}

/* ════════════════════════════════════════════════════════════════
   CINEMATIC OVERLAY
   ════════════════════════════════════════════════════════════════ */

function CinematicOverlay({
  manifest,
  onDismiss,
}: {
  manifest:  DiagnosticManifest
  onDismiss: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  const handleDismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(onDismiss, 300)
  }, [onDismiss])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleDismiss])

  const formatBoot = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

  return (
    <div
      className={`${styles.cinematicOverlay} ${leaving ? styles.cinematicLeaving : ''}`}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Stability certification seal — click anywhere to dismiss"
    >
      {/* Ambient sage glow backdrop */}
      <div className={styles.cinematicGlow} aria-hidden="true" />

      {/* Center content */}
      <div className={styles.cinematicInner}>

        {/* ── Seal badge ────────────────────────────────────────── */}
        <div className={styles.sealBadgeWrap} aria-hidden="true">
          {/* Rotating outer dashed ring */}
          <div className={styles.sealOuterRing}>
            <svg viewBox="0 0 120 120" className={styles.sealSvg}>
              <circle
                cx="60" cy="60" r="57"
                fill="none"
                stroke="rgba(99,163,137,0.18)"
                strokeWidth="1"
                strokeDasharray="5 3.5"
              />
            </svg>
          </div>
          {/* Static inner SVG: draw-on circle + glyph */}
          <svg
            viewBox="0 0 120 120"
            className={styles.sealSvg}
            aria-hidden="true"
          >
            <circle
              cx="60" cy="60" r="48"
              fill="none"
              className={styles.sealCircle}
            />
            <text
              x="60" y="57"
              textAnchor="middle"
              dominantBaseline="central"
              className={styles.sealGlyph}
            >
              ◈
            </text>
            <text
              x="60" y="80"
              textAnchor="middle"
              className={styles.sealLabelText}
            >
              SEALED
            </text>
          </svg>
        </div>

        {/* ── Title ─────────────────────────────────────────────── */}
        <p className={styles.cinematicSuper} aria-label="Zenith OS">
          ZENITH OS
        </p>

        {/* Separator */}
        <div className={styles.cinematicSep} aria-hidden="true" />

        {/* ── Tagline ───────────────────────────────────────────── */}
        <h2 className={styles.cinematicTitle}>
          STABILITY CERTIFIED
        </h2>

        {/* Separator */}
        <div className={`${styles.cinematicSep} ${styles.cinematicSepSecond}`} aria-hidden="true" />

        {/* ── Certified phase list ──────────────────────────────── */}
        <ul className={styles.cinematicPhaseList} aria-label="Certified system phases">
          {PHASE_CHECK_IDS.map((id, i) => {
            const result = manifest.checks.find(c => c.phaseId === id)
            return (
              <li
                key={id}
                className={styles.cinematicPhaseItem}
                style={{ animationDelay: `${1200 + i * 90}ms` }}
              >
                <span
                  className={styles.cinematicCheck}
                  aria-hidden="true"
                  style={{ color: result?.passed === false ? '#f87171' : undefined }}
                >
                  {result?.passed === false ? '✗' : '✓'}
                </span>
                {PHASE_CHECK_LABELS[id]}
              </li>
            )
          })}
        </ul>

        {/* ── System velocity ───────────────────────────────────── */}
        <p
          className={styles.cinematicBuild}
          style={{ animationDelay: `${1200 + PHASE_CHECK_IDS.length * 90 + 100}ms` }}
        >
          BOOT: {formatBoot(manifest.systemMetrics.bootTimeMs)}
          <span className={styles.cinematicBuildSlash}>//</span>
          STORAGE: {manifest.systemMetrics.storageFootprint}
          <span className={styles.cinematicBuildSlash}>//</span>
          SECURITY: {manifest.systemMetrics.securityPolicy}
        </p>

        {/* ── Build line ────────────────────────────────────────── */}
        <p className={styles.cinematicBuild}>
          BUILD: 2026.R13
          <span className={styles.cinematicBuildSlash}>//</span>
          PRODUCTION LOCKED &amp; SEALED
        </p>

        {/* ── Dismiss instruction ───────────────────────────────── */}
        <button
          className={styles.cinematicDismiss}
          onClick={e => { e.stopPropagation(); handleDismiss() }}
          aria-label="Return to settings"
        >
          Click anywhere or press Esc to return  ⟵
        </button>

      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function StabilityReleaseConsole() {
  /* ── State ────────────────────────────────────────────────── */
  const [consolePhase, setConsolePhase] = useState<ConsolePhase>('idle')
  const [checkStates, setCheckStates]   = useState<CheckStateMap>(INITIAL_CHECK_STATES)
  const [manifest, setManifest]          = useState<DiagnosticManifest | null>(null)
  const [showCinematic, setShowCinematic] = useState(false)

  /* ── Teardown hook — manages Escape listener lifetime ──────── */
  const { registerListener, executeTeardown } = useSystemTeardown()

  /* ── Abort controller for mid-run unmount safety ────────────── */
  const abortRef    = useRef<AbortController | null>(null)
  const mountedRef  = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      executeTeardown()
    }
  }, [executeTeardown])

  /* ── Diagnostics runner ────────────────────────────────────── */
  const handleRunDiagnostics = useCallback(async () => {
    if (consolePhase === 'running') return

    // Reset state for a fresh run
    setConsolePhase('running')
    setCheckStates(INITIAL_CHECK_STATES)
    setManifest(null)

    const controller = new AbortController()
    abortRef.current = controller

    const result = await runFullSystemSanityCheck(
      {
        onCheckStart: (phaseId) => {
          if (!mountedRef.current) return
          setCheckStates(prev => ({
            ...prev,
            [phaseId]: { status: 'running' },
          }))
        },
        onCheckResult: (checkResult: PhaseCheckResult) => {
          if (!mountedRef.current) return
          setCheckStates(prev => ({
            ...prev,
            [checkResult.phaseId]: {
              status:    checkResult.passed ? 'passed' : 'failed',
              durationMs: checkResult.durationMs,
              detail:    checkResult.detail,
            },
          }))
        },
      },
      { minCheckDisplayMs: 420 },
      controller.signal,
    )

    if (!mountedRef.current) return
    setManifest(result)
    setConsolePhase('complete')
  }, [consolePhase])

  /* ── Seal button handler ──────────────────────────────────── */
  const handleSeal = useCallback(() => {
    setConsolePhase('sealed')
    setShowCinematic(true)
  }, [])

  const handleDismissCinematic = useCallback(() => {
    setShowCinematic(false)
  }, [])

  /* ── Derived display values ───────────────────────────────── */
  const isRunning   = consolePhase === 'running'
  const isComplete  = consolePhase === 'complete' || consolePhase === 'sealed'
  const allPassed   = manifest?.allPassed ?? false

  const formatBootTime = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

  const storageVariant = (f: SystemMetrics['storageFootprint']) => f  // identity for CSS class mapping
  const securityVariant = (s: SystemMetrics['securityPolicy']) => s

  return (
    <div className={styles.console}>

      {/* ── Console header ──────────────────────────────────── */}
      <div className={styles.header}>
        <p className={styles.headerTitle}>
          <span className={styles.headerTitleGlyph}>◈</span>
          Zenith OS · Stability Release Console
        </p>
        <span className={styles.headerBuild}>v 2026.R13</span>
      </div>

      {/* ── Check list ──────────────────────────────────────── */}
      <div className={styles.checkList} role="list" aria-label="System phase checks">
        {PHASE_CHECK_IDS.map(id => (
          <CheckRow
            key={id}
            phaseId={id}
            state={checkStates[id]}
            showDetail={isComplete}
          />
        ))}
      </div>

      {/* ── Run button — visible until checks complete ──────── */}
      {!isComplete && (
        <button
          className={styles.runBtn}
          onClick={() => void handleRunDiagnostics()}
          disabled={isRunning}
          aria-busy={isRunning}
        >
          {isRunning
            ? '[ SCANNING ARCHITECTURE… ]'
            : '[ RUN SYSTEM DIAGNOSTICS ]'
          }
        </button>
      )}

      {/* ── System velocity metrics ─────────────────────────── */}
      {isComplete && manifest && (
        <div className={styles.metricsPanel} aria-label="System velocity metrics">
          <MetricCard
            label="CORE INITIATION BOOT"
            value={formatBootTime(manifest.systemMetrics.bootTimeMs)}
            variant="default"
          />
          <MetricCard
            label="STORAGE FOOTPRINT"
            value={manifest.systemMetrics.storageFootprint}
            variant={storageVariant(manifest.systemMetrics.storageFootprint)}
          />
          <MetricCard
            label="SECURITY POLICY"
            value={manifest.systemMetrics.securityPolicy}
            variant={securityVariant(manifest.systemMetrics.securityPolicy)}
          />
        </div>
      )}

      {/* ── Seal button or sealed banner ────────────────────── */}
      {isComplete && consolePhase !== 'sealed' && (
        <button
          className={`${styles.sealBtn} ${!allPassed ? styles.sealBtnWarning : ''}`}
          onClick={handleSeal}
          aria-label={
            allPassed
              ? 'Execute final system sign-off and lock build'
              : 'View certification status — some checks failed'
          }
        >
          {allPassed
            ? '[ EXECUTE FINAL SYSTEM SIGN-OFF & LOCK BUILD ]'
            : '[ VIEW CERTIFICATION STATUS — CHECKS INCOMPLETE ]'
          }
        </button>
      )}

      {consolePhase === 'sealed' && !showCinematic && (
        <div className={styles.sealedBanner} aria-live="polite">
          <span className={styles.sealedGlyph} aria-hidden="true">◈</span>
          <span className={styles.sealedText}>
            BUILD SEALED · 2026.R13 · PRODUCTION LOCKED
          </span>
        </div>
      )}

      {/* ── Cinematic overlay (portal-like, position:fixed) ── */}
      {showCinematic && manifest && (
        <CinematicOverlay
          manifest={manifest}
          onDismiss={handleDismissCinematic}
        />
      )}

    </div>
  )
}
