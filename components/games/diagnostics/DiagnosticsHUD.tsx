'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * DiagnosticsHUD — Games Tab · Step 7.3
 * Under-The-Hood Instrumentation Panel
 *
 * Expandable overlay anchored to the bottom-right corner of its
 * nearest positioned ancestor (place it inside the arcade pane
 * or the full GamesTabShell — whichever carries `position:relative`).
 *
 * Performance contract
 * ────────────────────
 * The telemetry interval runs exclusively inside a single
 * useEffect([]) with empty deps — it fires once on mount and
 * never again, completely decoupled from any React re-render cycle.
 * The interval writes to a `useRef` and only flushes to React state
 * every TELEMETRY_INTERVAL_MS, so the HUD contributes at most one
 * re-render every 3 s regardless of how many IDB reads it triggers.
 *
 * Telemetry readings
 * ──────────────────
 *   dbReadLatencyMs   — time to call resource_inventory.toArray()
 *   dbWriteLatencyMs  — rw transaction acquiring a write lock and
 *                       performing a benign no-op update on one row
 *   activeEcosystemMemoryBytes — UTF-16 localStorage footprint in bytes
 *   capturedExceptionsCount    — lifetime count from boundaryLog
 *   lastInterceptedPayload     — most recent GameErrorBoundary catch
 *
 * Override controls (QA / dev convenience)
 * ─────────────────────────────────────────
 *   Force +100 all resources  — direct balance += 100, bypasses caps
 *   Wipe & re-seed            — clears all 5 games tables, re-seeds
 *   Force-unlock Nexus root   — puts nexus_core_01 in skill_tree
 * ════════════════════════════════════════════════════════════════
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { useLiveQuery }   from 'dexie-react-hooks'
import {
  gamesDb,
  seedGamesDatabase,
  RESOURCE_IDS,
  RESOURCE_META,
  type ResourceNode,
  type ResourceId,
} from '@/lib/gamesDb'
import { NEXUS_NODE_ID }        from '@/lib/engines/SkillTreeFirewall'
import { getBoundaryExceptions } from './boundaryLog'
import styles                   from './DiagnosticsHUD.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  EXPORTED INTERFACE  (spec-required signature)
   ════════════════════════════════════════════════════════════════ */

/**
 * Point-in-time telemetry snapshot displayed in the HUD panel.
 * Refreshed every TELEMETRY_INTERVAL_MS via the background interval.
 */
export interface DiagnosticTelemetrySnapshot {
  dbReadLatencyMs:            number
  dbWriteLatencyMs:           number
  /** Estimated UTF-16 localStorage byte count for the current session. */
  activeEcosystemMemoryBytes: number
  capturedExceptionsCount:    number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastInterceptedPayload:     Record<string, any> | null
}

/* ════════════════════════════════════════════════════════════════
   §2  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/** How often the background interval refreshes telemetry (ms). */
const TELEMETRY_INTERVAL_MS = 3_000

/** Latency threshold above which the value renders in amber (ms). */
const SLOW_LATENCY_THRESHOLD_MS = 15

/** Initial snapshot shown before the first measurement completes. */
const INITIAL_SNAPSHOT: DiagnosticTelemetrySnapshot = {
  dbReadLatencyMs:            0,
  dbWriteLatencyMs:           0,
  activeEcosystemMemoryBytes: 0,
  capturedExceptionsCount:    0,
  lastInterceptedPayload:     null,
}

/* ════════════════════════════════════════════════════════════════
   §3  PURE HELPERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Walks the current localStorage entries and returns the total
 * estimated byte size using UTF-16 encoding (2 bytes per code unit).
 * Returns 0 when called outside a browser context.
 */
function measureLocalStorageBytes(): number {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 0
  }
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key   = localStorage.key(i) ?? ''
    const value = localStorage.getItem(key) ?? ''
    total += (key.length + value.length) * 2
  }
  return total
}

/**
 * Formats a byte count into a human-readable string.
 * Stays in KB for the typical localStorage range.
 */
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Formats a latency value with fixed-point precision.
 * Shows '—' during the initial state before any measurement.
 */
function fmtLatency(ms: number): string {
  if (ms === 0) return '—'
  return `${ms.toFixed(2)} ms`
}

/* ════════════════════════════════════════════════════════════════
   §4  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function DiagnosticsHUD(): React.ReactElement {

  /* ── §4a  Panel visibility state ──────────────────────────────── */

  const [isOpen, setIsOpen] = useState<boolean>(false)

  /* ── §4b  Telemetry display state ─────────────────────────────
     The interval writes to snapshotRef (no re-render cost) and
     flushes to displaySnapshot at the end of each cycle.  UI only
     re-renders when the interval fires, not on every measurement.  */

  const snapshotRef     = useRef<DiagnosticTelemetrySnapshot>(INITIAL_SNAPSHOT)
  const [displaySnapshot, setDisplaySnapshot] =
    useState<DiagnosticTelemetrySnapshot>(INITIAL_SNAPSHOT)

  /* ── §4c  Override action pending flag ────────────────────────── */

  const [pendingAction, setPendingAction] = useState<string | null>(null)

  /* ── §4d  Live resource data (reactive) ───────────────────────
     useLiveQuery provides instant reactive updates when any game
     component mutates the inventory — no polling needed for this
     section.  Distinct from the telemetry interval.              */

  const resources = useLiveQuery<ResourceNode[]>(
    () => gamesDb?.resource_inventory.toArray() ?? Promise.resolve([]),
    [],
  )

  /* ── §4e  Background telemetry interval ───────────────────────
     The useEffect has empty deps so it fires exactly once on mount
     and never re-registers.  All measurements are async but their
     results only propagate to React state through the final
     setDisplaySnapshot call at the bottom of runMeasurement.

     The interval itself captures no React state — snapshotRef is
     a stable ref, getBoundaryExceptions reads a module-level var,
     and gamesDb is a module-level singleton.  This guarantees that
     the instrumentation loop degrades performance by ≤ 1 setState
     call every TELEMETRY_INTERVAL_MS.                            */

  useEffect(() => {
    let isMounted = true

    const runMeasurement = async (): Promise<void> => {
      if (!gamesDb) return

      /* ── DB read latency ──────────────────────────────────────
         Time a real .toArray() call on the inventory table.
         This is the same query the ResourceTicker runs on every
         render, so it accurately represents actual read cost.    */
      const readStart = performance.now()
      await gamesDb.resource_inventory.toArray()
      const readLatencyMs = performance.now() - readStart

      /* ── DB write latency ─────────────────────────────────────
         Open a rw transaction, acquire the write lock, perform a
         benign no-op update (writes the same totalEarnedLifetime
         value back), and measure the round-trip.  This reflects
         true write overhead without mutating any visible game data. */
      let writeLatencyMs = 0
      try {
        const writeStart = performance.now()
        await gamesDb.transaction(
          'rw',
          gamesDb.resource_inventory,
          async () => {
            const probe = await gamesDb.resource_inventory.get('raw_data_shards')
            if (probe) {
              await gamesDb.resource_inventory.update('raw_data_shards', {
                totalEarnedLifetime: probe.totalEarnedLifetime,
              })
            }
          },
        )
        writeLatencyMs = performance.now() - writeStart
      } catch {
        // gamesDb not seeded yet — skip write probe this cycle
        writeLatencyMs = 0
      }

      /* ── localStorage footprint ────────────────────────────── */
      const memoryBytes = measureLocalStorageBytes()

      /* ── Exception registry ─────────────────────────────────── */
      const { count, lastPayload } = getBoundaryExceptions()

      /* ── Flush to ref then to state ────────────────────────── */
      snapshotRef.current = {
        dbReadLatencyMs:            parseFloat(readLatencyMs.toFixed(3)),
        dbWriteLatencyMs:           parseFloat(writeLatencyMs.toFixed(3)),
        activeEcosystemMemoryBytes: memoryBytes,
        capturedExceptionsCount:    count,
        lastInterceptedPayload:     lastPayload as DiagnosticTelemetrySnapshot['lastInterceptedPayload'],
      }

      if (isMounted) {
        setDisplaySnapshot({ ...snapshotRef.current })
      }
    }

    // Immediate first measurement on mount
    void runMeasurement()

    // Recurring measurement — entirely outside the render cycle
    const intervalId = setInterval(() => void runMeasurement(), TELEMETRY_INTERVAL_MS)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [])  // empty deps — registers once, never re-runs on re-renders

  /* ── §4f  Override: Force +100 all resources (bypass caps) ────── */

  const forceAddAllResources = useCallback(async (): Promise<void> => {
    if (!gamesDb || pendingAction !== null) return
    setPendingAction('force_add')
    try {
      const all = await gamesDb.resource_inventory.toArray()
      await gamesDb.transaction(
        'rw',
        gamesDb.resource_inventory,
        async () => {
          for (const node of all) {
            // Direct balance += 100 — intentionally bypasses cap enforcement
            await gamesDb.resource_inventory.update(node.id as ResourceId, {
              balance: node.balance + 100,
            })
          }
        },
      )
    } finally {
      setPendingAction(null)
    }
  }, [pendingAction])

  /* ── §4g  Override: Wipe + re-seed to baseline values ────────── */

  const wipeAndReseed = useCallback(async (): Promise<void> => {
    if (!gamesDb || pendingAction !== null) return
    setPendingAction('wipe_reseed')
    try {
      // Clear each table sequentially — Dexie doesn't require them
      // to share a single transaction for a table-by-table wipe.
      await gamesDb.resource_inventory.clear()
      await gamesDb.user_profile_config.clear()
      await gamesDb.crucibleJobs.clear()
      await gamesDb.skill_tree.clear()
      await gamesDb.biosphere_states.clear()
      // Re-seed resource_inventory and user_profile_config to defaults
      await seedGamesDatabase()
    } finally {
      setPendingAction(null)
    }
  }, [pendingAction])

  /* ── §4h  Override: Force-unlock Central Nexus Gateway ────────── */

  const forceUnlockNexus = useCallback(async (): Promise<void> => {
    if (!gamesDb || pendingAction !== null) return
    setPendingAction('unlock_nexus')
    try {
      await gamesDb.skill_tree.put({
        nodeId:       NEXUS_NODE_ID,
        isUnlocked:   true,
        dateUnlocked: Date.now(),
      })
    } finally {
      setPendingAction(null)
    }
  }, [pendingAction])

  /* ── §4i  Render helpers ─────────────────────────────────────── */

  // Build an O(1) resource balance map from the live useLiveQuery array
  const resourceMap: Record<string, ResourceNode> = {}
  for (const node of resources ?? []) {
    resourceMap[node.id] = node
  }

  const {
    dbReadLatencyMs,
    dbWriteLatencyMs,
    activeEcosystemMemoryBytes,
    capturedExceptionsCount,
    lastInterceptedPayload,
  } = displaySnapshot

  /* ── §4j  Render ─────────────────────────────────────────────── */

  return (
    <div className={styles.hudRoot} aria-label="Diagnostics HUD">

      {/* ── Expandable panel — rendered above the toggle button ── */}
      {isOpen && (
        <div
          className={styles.panel}
          role="complementary"
          aria-label="Games Tab diagnostics panel"
        >

          {/* ══ §A — DB TELEMETRY ══════════════════════════════ */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>DB Telemetry</p>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryKey}>Read Δms</span>
              <span
                className={`${styles.telemetryVal} ${
                  dbReadLatencyMs > SLOW_LATENCY_THRESHOLD_MS
                    ? styles.telemetryValSlow
                    : ''
                }`}
              >
                {fmtLatency(dbReadLatencyMs)}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryKey}>Write Δms</span>
              <span
                className={`${styles.telemetryVal} ${
                  dbWriteLatencyMs > SLOW_LATENCY_THRESHOLD_MS
                    ? styles.telemetryValSlow
                    : ''
                }`}
              >
                {fmtLatency(dbWriteLatencyMs)}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryKey}>localStorage</span>
              <span className={styles.telemetryVal}>
                {fmtBytes(activeEcosystemMemoryBytes)}
              </span>
            </div>

            <div className={styles.telemetryRow}>
              <span className={styles.telemetryKey}>Interval</span>
              <span className={styles.telemetryVal}>
                {TELEMETRY_INTERVAL_MS / 1_000} s
              </span>
            </div>
          </div>

          {/* ══ §B — ECOSYSTEM MEMORY (capacity bars) ═════════ */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Ecosystem Memory</p>

            <div className={styles.resourceRows}>
              {RESOURCE_IDS.map(id => {
                const node = resourceMap[id]
                const meta = RESOURCE_META[id]
                const balance     = node?.balance     ?? 0
                const maxCapacity = node?.maxCapacity ?? meta.maxCapacity
                const isInfinite  = maxCapacity === null

                const fillPct  = isInfinite
                  ? 0
                  : Math.min(100, Math.round((balance / (maxCapacity as number)) * 100))

                const isCapped = !isInfinite && balance >= (maxCapacity as number)

                return (
                  <div key={id} className={styles.resourceRow}>
                    <span className={styles.resourceName} title={meta.name}>
                      {meta.name.replace(' ', ' ')}
                    </span>

                    {isInfinite ? (
                      <span className={styles.resourcePct}>∞</span>
                    ) : (
                      <>
                        <span className={styles.resourcePct}>
                          {fillPct}%
                        </span>
                        <div className={styles.resourceBarTrack}>
                          <div
                            className={`${styles.resourceBarFill} ${
                              isCapped ? styles.resourceBarFillCapped : ''
                            }`}
                            style={{
                              '--fill-pct': `${fillPct}%`,
                            } as React.CSSProperties}
                            role="meter"
                            aria-valuenow={balance}
                            aria-valuemin={0}
                            aria-valuemax={maxCapacity as number}
                            aria-label={`${meta.name} capacity`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <p className={styles.memFootnote}>
              LS footprint: {fmtBytes(activeEcosystemMemoryBytes)}
            </p>
          </div>

          {/* ══ §C — OVERRIDE CONTROLS ════════════════════════ */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Override Controls</p>

            <div className={styles.overrideGrid}>

              {/* Override 1: Force +100 to all resources (bypass caps) */}
              <button
                type="button"
                className={styles.overrideBtn}
                onClick={() => void forceAddAllResources()}
                disabled={pendingAction !== null}
                aria-busy={pendingAction === 'force_add'}
                aria-label="Add 100 units to every resource, bypassing capacity caps"
              >
                <span className={styles.overrideGlyph} aria-hidden="true">⊕</span>
                {pendingAction === 'force_add'
                  ? 'Crediting…'
                  : '+100 All Resources (Bypass Caps)'}
              </button>

              {/* Override 2: Wipe all tables and re-seed to baseline */}
              <button
                type="button"
                className={`${styles.overrideBtn} ${styles.overrideBtnDanger}`}
                onClick={() => void wipeAndReseed()}
                disabled={pendingAction !== null}
                aria-busy={pendingAction === 'wipe_reseed'}
                aria-label="Clear all games database tables and re-seed to baseline values"
              >
                <span className={styles.overrideGlyph} aria-hidden="true">⊘</span>
                {pendingAction === 'wipe_reseed'
                  ? 'Wiping…'
                  : 'Wipe & Re-Seed Database'}
              </button>

              {/* Override 3: Force-unlock the Central Nexus Gateway */}
              <button
                type="button"
                className={styles.overrideBtn}
                onClick={() => void forceUnlockNexus()}
                disabled={pendingAction !== null}
                aria-busy={pendingAction === 'unlock_nexus'}
                aria-label={`Force-unlock ${NEXUS_NODE_ID} to open all downstream skill branches`}
              >
                <span className={styles.overrideGlyph} aria-hidden="true">◈</span>
                {pendingAction === 'unlock_nexus'
                  ? 'Unlocking…'
                  : `Unlock ${NEXUS_NODE_ID}`}
              </button>

            </div>
          </div>

          {/* ══ §D — EXCEPTION LOG ════════════════════════════ */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Exception Log</p>

            <p
              className={`${styles.exceptionCount} ${
                capturedExceptionsCount > 0 ? styles.exceptionCountNonZero : ''
              }`}
              aria-live="polite"
            >
              {capturedExceptionsCount === 0
                ? 'No exceptions captured'
                : `${capturedExceptionsCount} exception${capturedExceptionsCount !== 1 ? 's' : ''} intercepted`}
            </p>

            {lastInterceptedPayload !== null ? (
              <pre
                className={styles.lastPayloadBlock}
                aria-label="Last intercepted exception payload"
              >
                {JSON.stringify(lastInterceptedPayload, null, 2)}
              </pre>
            ) : (
              <p className={styles.noExceptions}>
                Last payload: none
              </p>
            )}
          </div>

        </div>
      )}

      {/* ── Toggle button — always visible ───────────────────── */}
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-controls="diag-hud-panel"
        aria-label={isOpen ? 'Close diagnostics panel' : 'Open diagnostics panel'}
      >
        <span className={styles.toggleDot} aria-hidden="true" />
        {isOpen ? 'DIAG ×' : 'DIAG'}
      </button>

    </div>
  )
}
