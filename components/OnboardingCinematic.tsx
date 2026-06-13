'use client'

/**
 * OnboardingCinematic.tsx
 * Phase 11.4 — First-Time Welcome Cinematic & Onboarding Boot Terminal
 * Phase 12.1 — Integrated Database Audit HUD
 *
 * Intercepts the very first session to print a comforting terminal boot
 * sequence before handing control to the main workspace grid.
 *
 * Boot sequence:
 *   Lines 0–4  — Zenith OS system initialization crawl (600ms cadence)
 *   Audit line — "[ AUDITING LOCAL DATA CONTEXT... ] -> RUNNING"
 *   Result     — clean: warm text   | repairs: sage green confirmation
 *   CTA        — "[ WAKE ZENITH OS WORKSPACE ]" button (auto-focused)
 *
 * Gating contract:
 *   · If localStorage('zenith_onboarding_completed_v1') === 'true' → render null
 *   · Otherwise → render full-screen overlay at z-index 9999
 *
 * Phase machine:  checking → booting → ready → exiting → done
 *   checking  : localStorage not yet read (SSR / hydration frame)
 *   booting   : sequential log lines + audit running
 *   ready     : all lines visible + audit result shown, CTA revealed
 *   exiting   : user clicked wake; CSS spring fade-out playing (650ms)
 *   done      : component unmounts → 0ms overhead from this point forward
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { runMasterDatabaseAudit }                   from '@/utils/dbAuditEngine'
import type { MasterAuditReport }                   from '@/types/dbAudit'
import styles                                        from './OnboardingCinematic.module.css'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'zenith_onboarding_completed_v1'

const BOOT_LINES = [
  '[ LOG 0.1 ] WAKING LOCAL MEMORY ENGINES...',
  '[ LOG 0.2 ] WEAVING COZY DESIGN PARAMETERS...',
  '[ LOG 0.3 ] SEEDING ARCHIVAL CHANNELS...',
  '[ LOG 0.4 ] ARCHITECTING PERSONAL WORKSPACE CORRIDORS...',
  '[ LOG 0.5 ] ZENITH OS BOOT CYCLE COMPLETING // ECOSYSTEM RESTORED.',
] as const

type BootLine = typeof BOOT_LINES[number]

/** Milliseconds before the first log line appears after mount */
const INITIAL_DELAY_MS      = 440
/** Milliseconds between each successive log line */
const LINE_DELAY_MS         = 600
/** Brief pause after the final boot line before showing the audit status */
const AUDIT_SHOW_DELAY_MS   = 280
/** Pause after the audit result line before the CTA button fades in */
const CTA_REVEAL_DELAY_MS   = 480
/** Duration of the CSS overlay exit animation — must match overlayFadeOut */
const EXIT_DURATION_MS      = 650

// ─────────────────────────────────────────────────────────────
// Audit line type — text + whether to render in sage green
// ─────────────────────────────────────────────────────────────

interface AuditLogLine {
  text: string
  sage: boolean
}

/** Build the human-readable result line from the audit report */
function buildAuditResultLine(report: MasterAuditReport): AuditLogLine {
  if (report.fatalTables.length > 0) {
    return {
      text: '[ AUDIT STATUS: PARTIAL // SOME TABLES SKIPPED GRACEFULLY ]',
      sage: false,
    }
  }
  if (report.hadRepairs) {
    const n = report.totalRepairs
    return {
      text: `[ REPAIR COMPLETED // ENFORCED SCHEMA RULES ] +${n} CORRECTION${n !== 1 ? 'S' : ''} APPLIED`,
      sage: true,
    }
  }
  return {
    text: `[ CHECKING RECORD INTEGRITY... ] -> ${report.totalRowsScanned} CELLS SCANNED // DATA LAYERS HARDENED`,
    sage: false,
  }
}

// ─────────────────────────────────────────────────────────────
// Phase machine
// ─────────────────────────────────────────────────────────────

type Phase = 'checking' | 'booting' | 'ready' | 'exiting' | 'done'

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function OnboardingCinematic() {
  const [phase, setPhase]             = useState<Phase>('checking')
  const [visibleCount, setVisibleCount] = useState(0)
  const [auditLines, setAuditLines]   = useState<AuditLogLine[]>([])

  // Audit promise is started the moment 'booting' begins so that by the time
  // 5 lines finish printing (~2.8s), the audit result (~40–180ms) is ready.
  const auditPromiseRef = useRef<Promise<MasterAuditReport> | null>(null)

  // ── Step 1: Hygiene state check ───────────────────────────
  useEffect(() => {
    try {
      const completed = window.localStorage.getItem(STORAGE_KEY) === 'true'
      setPhase(completed ? 'done' : 'booting')
    } catch {
      setPhase('done')
    }
  }, [])

  // ── Step 2: Kick off audit in parallel with boot crawl ────
  // Starts immediately when phase becomes 'booting' so the database
  // scan runs in the background during the 2.8s line-printing sequence.
  useEffect(() => {
    if (phase !== 'booting') return
    auditPromiseRef.current = runMasterDatabaseAudit()
  }, [phase])

  // ── Step 3: Sequential boot crawl + audit HUD ────────────
  useEffect(() => {
    if (phase !== 'booting') return

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    BOOT_LINES.forEach((_line: BootLine, i) => {
      const t = setTimeout(() => {
        if (cancelled) return
        setVisibleCount(i + 1)

        // After the LAST boot line settles, show audit status
        if (i === BOOT_LINES.length - 1) {
          const auditTimer = setTimeout(() => {
            if (cancelled) return

            // Show the "running" indicator immediately
            setAuditLines([{
              text: '[ AUDITING LOCAL DATA CONTEXT... ] -> RUNNING',
              sage: false,
            }])

            // Await the audit promise (should already be resolved at this point)
            void (async () => {
              try {
                const promise = auditPromiseRef.current ?? runMasterDatabaseAudit()
                const report  = await promise

                if (cancelled) return

                const resultLine = buildAuditResultLine(report)

                // Replace running line with completion line + result
                setAuditLines([
                  { text: '[ AUDITING LOCAL DATA CONTEXT... ] -> COMPLETE', sage: false },
                  resultLine,
                ])

                // CTA reveal after the result line settles
                const ctaTimer = setTimeout(() => {
                  if (!cancelled) setPhase('ready')
                }, CTA_REVEAL_DELAY_MS)
                timers.push(ctaTimer)

              } catch {
                // Audit threw unexpectedly — skip its HUD lines and still reveal CTA
                if (cancelled) return
                setAuditLines([])
                const ctaTimer = setTimeout(() => {
                  if (!cancelled) setPhase('ready')
                }, CTA_REVEAL_DELAY_MS)
                timers.push(ctaTimer)
              }
            })()
          }, AUDIT_SHOW_DELAY_MS)

          timers.push(auditTimer)
        }
      }, INITIAL_DELAY_MS + i * LINE_DELAY_MS)

      timers.push(t)
    })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [phase])

  // ── Step 4: Wake action ───────────────────────────────────
  const handleWake = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* ignore write failures — cinematic still exits */ }

    setPhase('exiting')
    setTimeout(() => setPhase('done'), EXIT_DURATION_MS)
  }, [])

  // ─────────────────────────────────────────────────────────
  // Gate — render null during checking/done phases.
  // ─────────────────────────────────────────────────────────
  if (phase === 'checking' || phase === 'done') return null

  const isExiting      = phase === 'exiting'
  const showCursor     = phase === 'booting' && visibleCount > 0 && visibleCount < BOOT_LINES.length
  const showLastCursor = phase === 'booting' && visibleCount === BOOT_LINES.length && auditLines.length === 0
  const showCta        = phase === 'ready'

  // Progress: boot lines count + audit lines (max 2) in total of 7 steps
  const TOTAL_STEPS = BOOT_LINES.length + 2
  const completedSteps = visibleCount + auditLines.length
  const progress = Math.min((completedSteps / TOTAL_STEPS) * 100, 100)

  return (
    <div
      className={`${styles.overlay} ${isExiting ? styles.overlayExit : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Zenith OS system initialization"
    >
      {/* ── Ambient corner ornaments ──────────────────── */}
      <span className={styles.cornerTL} aria-hidden="true">◈</span>
      <span className={styles.cornerBR} aria-hidden="true">◈</span>

      {/* ── Terminal card ──────────────────────────────── */}
      <div className={styles.card}>

        {/* Header row */}
        <div className={styles.header}>
          <span className={styles.headerDot} aria-hidden="true" />
          <span className={styles.headerTitle}>Zenith OS</span>
          <span className={styles.headerSub}>System Initialization</span>
        </div>

        {/* Log lines */}
        <div className={styles.terminal}>
          {/* Idle cursor — visible before the first line appears */}
          {visibleCount === 0 && (
            <p className={styles.logLineIdle} aria-hidden="true">
              <span className={styles.idleCursor} />
            </p>
          )}

          {/* Boot crawl lines */}
          {BOOT_LINES.slice(0, visibleCount).map((line, i) => {
            const isLast    = i === visibleCount - 1
            const hasCursor = isLast && (showCursor || showLastCursor)
            return (
              <p
                key={i}
                className={`${styles.logLine} ${hasCursor ? styles.logLineCursor : ''}`}
              >
                {line}
              </p>
            )
          })}

          {/* Audit HUD lines — shown after all boot lines complete */}
          {auditLines.map((line, i) => (
            <p
              key={`audit-${i}`}
              className={`${styles.logLine} ${line.sage ? styles.logLineSage : ''}`}
            >
              {line.text}
            </p>
          ))}
        </div>

        {/* Progress track */}
        <div className={styles.progressWrap} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Wake CTA — revealed after audit result settles */}
        {showCta && (
          <div className={styles.ctaWrap}>
            <button
              type="button"
              className={styles.ctaBtn}
              onClick={handleWake}
              autoFocus
              aria-label="Enter Zenith OS workspace"
            >
              [ WAKE ZENITH OS WORKSPACE ]
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
