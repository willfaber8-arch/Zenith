'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Sync Stress Test Harness
 * Phase 13 · Step 13.1 — Network-Throttled Offline Synchronizer
 *
 * Diagnostic control cockpit embedded in SettingsView.
 * Provides a mineral-dark terminal interface for engineers to:
 *
 *   1. Configure chaos parameters (latency / packet-drop / disconnect)
 *   2. Fire a 50-transaction IDB write surge
 *   3. Observe real-time log output in an auto-scrolling terminal
 *   4. Verify queue integrity after network recovery
 *
 * State machine:
 *   idle → running → complete (integrityPassed = true)
 *                 → error    (integrityPassed = false | aborted)
 *   error → idle (reset)
 *   complete → idle (reset)
 *
 * No external dependencies — uses only the internal sync stack.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  executeSyncStressTest,
  type StressTestEvent,
  type StressTestReport,
  type StressTestEventLevel,
} from '@/utils/syncStressTest'
import type { NetworkSimulationProfile } from '@/utils/networkSimulator'
import styles from './SyncStressTestHarness.module.css'

/* ── Types ───────────────────────────────────────────────────── */

type HarnessPhase = 'idle' | 'running' | 'complete' | 'error'

/* ── Helpers ─────────────────────────────────────────────────── */

/** Formats a Unix ms timestamp as HH:MM:SS.mmm */
function fmtTime(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms3 = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms3}`
}

/** Maps event level to its CSS class. */
function levelClass(level: StressTestEventLevel): string {
  switch (level) {
    case 'harness': return styles.logLineHarness
    case 'info':    return styles.logLineInfo
    case 'warn':    return styles.logLineWarn
    case 'error':   return styles.logLineError
    case 'success': return styles.logLineSuccess
    case 'metric':  return styles.logLineMetric
    default:        return styles.logLineInfo
  }
}

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function SyncStressTestHarness() {

  /* ── Test phase state ─────────────────────────────────────── */
  const [phase,  setPhase]  = useState<HarnessPhase>('idle')
  const [events, setEvents] = useState<StressTestEvent[]>([])
  const [report, setReport] = useState<StressTestReport | null>(null)

  /* ── Chaos profile sliders ────────────────────────────────── */
  const [latencyMs,       setLatencyMs]       = useState(3500)
  const [packetDropPct,   setPacketDropPct]   = useState(30)    // 0–100 integer
  const [forceDisconnect, setForceDisconnect] = useState(false)

  /* ── Refs ─────────────────────────────────────────────────── */
  const terminalRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)

  /* ── Auto-scroll terminal on new events ───────────────────── */
  useEffect(() => {
    const el = terminalRef.current
    if (!el) return
    // Only auto-scroll if the user is within 60px of the bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (atBottom || phase === 'running') {
      el.scrollTop = el.scrollHeight
    }
  }, [events, phase])

  /* ── Abort on unmount (component removed while test runs) ──── */
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  /* ── Derive current queue depth from latest metric event ───── */
  const currentQueueDepth = (() => {
    const metricEvents = events.filter(e => e.level === 'metric')
    if (metricEvents.length === 0) return null
    const last = metricEvents[metricEvents.length - 1]
    const depth = last.metadata?.depth
    return typeof depth === 'number' ? depth : null
  })()

  /* ── Run / Abort ──────────────────────────────────────────── */
  const handleRun = useCallback(async () => {
    if (phase === 'running') {
      abortRef.current?.abort()
      return
    }

    // Fresh run — reset all state
    setPhase('running')
    setEvents([])
    setReport(null)

    const controller    = new AbortController()
    abortRef.current    = controller

    const profile: NetworkSimulationProfile = {
      latencyMs,
      packetDropRate:           packetDropPct / 100,
      forceImmediateDisconnect: forceDisconnect,
    }

    // executeSyncStressTest never throws — returns a report even on abort/error
    const result = await executeSyncStressTest(
      profile,
      (event) => setEvents(prev => [...prev, event]),
      controller.signal,
    )

    setReport(result)
    setPhase(result.integrityPassed ? 'complete' : 'error')
  }, [phase, latencyMs, packetDropPct, forceDisconnect])

  /* ── Reset harness ────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    setPhase('idle')
    setEvents([])
    setReport(null)
  }, [])

  /* ── Slider fill percentage (0–100 string for CSS var) ─────── */
  const latencyFillPct     = `${(latencyMs / 5000) * 100}%`
  const packetDropFillPct  = `${packetDropPct}%`

  /* ── Derived button label ────────────────────────────────── */
  const runBtnLabel  = phase === 'running'
    ? '[ ✕  ABORT STRESS TEST ]'
    : '[ INJECT FLAKY NETWORK STRESS TEST ]'

  const runBtnClass = [
    styles.runBtn,
    phase === 'running'                    ? styles.runBtnRunning : '',
    phase === 'complete' || phase === 'error' ? styles.runBtnDone  : '',
  ].join(' ')

  /* ── Integrity derived values ────────────────────────────── */
  const integrityLabel = report
    ? (report.integrityPassed ? 'PASS' : 'FAIL')
    : phase === 'running' ? 'TESTING' : '—'

  const integrityClass = report
    ? (report.integrityPassed ? styles.metricValuePass : styles.metricValueFail)
    : phase === 'running' ? styles.metricValueActive : styles.metricValuePending

  const chaosActiveClass = phase === 'running' && !report
    ? styles.metricValueActive
    : styles.metricValue

  return (
    <div className={styles.harness}>

      {/* ════════════════════════════════════════════════════════
          CONTROL SHELF
          ════════════════════════════════════════════════════════ */}
      <div className={styles.controlShelf}>

        {/* Latency slider */}
        <div className={styles.sliderGroup}>
          <div className={styles.sliderLabel}>
            <span className={styles.sliderLabelText}>Artificial Latency</span>
            <span className={styles.sliderValue}>
              {latencyMs === 0 ? '0 ms (disabled)' : `${latencyMs.toLocaleString()} ms`}
            </span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={5000}
            step={100}
            value={latencyMs}
            onChange={e => setLatencyMs(Number(e.target.value))}
            disabled={phase === 'running'}
            style={{ '--fill-pct': latencyFillPct } as React.CSSProperties}
            aria-label="Artificial latency in milliseconds"
          />
        </div>

        {/* Packet drop slider */}
        <div className={styles.sliderGroup}>
          <div className={styles.sliderLabel}>
            <span className={styles.sliderLabelText}>Packet Drop Rate</span>
            <span className={styles.sliderValue}>
              {packetDropPct === 0 ? '0 % (disabled)' : `${packetDropPct} %`}
            </span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={100}
            step={5}
            value={packetDropPct}
            onChange={e => setPacketDropPct(Number(e.target.value))}
            disabled={phase === 'running'}
            style={{ '--fill-pct': packetDropFillPct } as React.CSSProperties}
            aria-label="Packet drop probability percentage"
          />
        </div>

        {/* Force disconnect toggle */}
        <div className={styles.toggleGroup}>
          <span className={styles.toggleGroupLabel}>Force Disconnect</span>
          <button
            type="button"
            role="switch"
            aria-checked={forceDisconnect}
            className={`${styles.toggle} ${forceDisconnect ? styles.toggleOn : ''}`}
            onClick={() => setForceDisconnect(v => !v)}
            disabled={phase === 'running'}
            aria-label="Force immediate disconnect — drops all fetch calls"
          >
            <span className={styles.toggleThumb} />
          </button>
          {forceDisconnect && (
            <span className={styles.toggleWarning}>
              ⚠ ALL FETCH CALLS WILL BE HARD-REJECTED
            </span>
          )}
        </div>

        <div className={styles.shelfDivider} />

        {/* Primary action */}
        <button
          type="button"
          className={runBtnClass}
          onClick={() => void handleRun()}
          disabled={phase === 'complete' || phase === 'error'}
          aria-label={runBtnLabel}
        >
          {runBtnLabel}
        </button>

        {/* Reset (only after completion) */}
        {(phase === 'complete' || phase === 'error') && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
          >
            [ RESET HARNESS ]
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          METRICS STRIP — visible once test starts
          ════════════════════════════════════════════════════════ */}
      {phase !== 'idle' && (
        <div className={styles.metricsStrip} role="status" aria-live="polite">

          <div className={styles.metricChip}>
            <span className={styles.metricLabel}>Nodes Written</span>
            <span className={styles.metricValue}>
              {report?.itemsWritten ?? (phase === 'running' ? '—' : '—')}
            </span>
          </div>

          <div className={styles.metricChip}>
            <span className={styles.metricLabel}>Queue Depth</span>
            <span className={styles.metricValue}>
              {report
                ? report.recoveryQueueDepth
                : currentQueueDepth !== null
                ? currentQueueDepth
                : '—'}
            </span>
          </div>

          <div className={styles.metricChip}>
            <span className={styles.metricLabel}>Chaos Active</span>
            <span className={chaosActiveClass}>
              {phase === 'running' && !report ? 'ARMED' : 'CLEAR'}
            </span>
          </div>

          <div className={styles.metricChip}>
            <span className={styles.metricLabel}>Integrity</span>
            <span className={`${styles.metricValue} ${integrityClass}`}>
              {integrityLabel}
            </span>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TERMINAL LOG
          ════════════════════════════════════════════════════════ */}
      {events.length > 0 && (
        <div
          className={styles.terminal}
          ref={terminalRef}
          role="log"
          aria-label="Stress test execution log"
          aria-live="polite"
        >
          {events.map(event => (
            <div
              key={event.id}
              className={`${styles.logLine} ${levelClass(event.level)}`}
            >
              <span className={styles.logTimestamp}>
                {fmtTime(event.timestamp)}
              </span>
              <span className={styles.logPrefix}>
                [{event.level.toUpperCase()}]
              </span>
              <span className={styles.logMessage}>
                {event.message}
              </span>
            </div>
          ))}

          {/* Blinking cursor while running */}
          {phase === 'running' && (
            <div className={`${styles.logLine} ${styles.logLineCursor}`}>
              <span className={styles.logTimestamp} />
              <span className={styles.logPrefix} />
              <span className={styles.cursor}>▮</span>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          RESULT SUMMARY CARD
          ════════════════════════════════════════════════════════ */}
      {report && (
        <div
          className={`${styles.resultCard} ${report.integrityPassed ? styles.resultCardPass : styles.resultCardFail}`}
          role="region"
          aria-label="Stress test result summary"
        >
          <p className={styles.resultHeader}>
            {report.integrityPassed
              ? '✓  INTEGRITY CERTIFIED — ALL TRANSACTION NODES PRESERVED'
              : '✗  INTEGRITY ANOMALY — REVIEW LOG FOR DETAILS'}
          </p>

          <div className={styles.resultGrid}>
            <div className={styles.resultStat}>
              <span className={styles.resultStatLabel}>Items Written</span>
              <span className={styles.resultStatValue}>{report.itemsWritten}</span>
            </div>
            <div className={styles.resultStat}>
              <span className={styles.resultStatLabel}>Peak Queue</span>
              <span className={styles.resultStatValue}>{report.peakQueueDepth}</span>
            </div>
            <div className={styles.resultStat}>
              <span className={styles.resultStatLabel}>Post-Recovery</span>
              <span className={styles.resultStatValue}>{report.recoveryQueueDepth}</span>
            </div>
            <div className={styles.resultStat}>
              <span className={styles.resultStatLabel}>Duration</span>
              <span className={styles.resultStatValue}>
                {((report.completedAt - report.startedAt) / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
