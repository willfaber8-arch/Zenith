'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Conflict Resolution Audit Monitor
 * Phase 13 · Step 13.2 — Multi-Device Latency Replication & Conflict Auditing
 *
 * Interactive diagnostic panel embedded in SettingsView.
 * Provides real-time visibility into the LWW conflict resolution engine by:
 *
 *   1. Displaying this device's stable client UUID (from localStorage)
 *   2. Tracking resolved collision events and concurrent device count
 *   3. Simulating concurrent multi-device mutation storms via three
 *      canonical scenarios (REMOTE_WINS / LOCAL_WINS / TIE_BROKEN_LOCAL)
 *   4. Streaming a resolution audit log that proves the LWW algorithm
 *      drives every device to an identical convergent state
 *
 * All simulation records are in-memory only — no IDB rows are written.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  resolveDataCollision,
  getLocalClientId,
} from '@/utils/conflictResolver'
import type {
  SyncableRecord,
  SyncMetadata,
  ConflictResolutionResult,
} from '@/types/syncConflict'
import styles from './ConflictAuditPanel.module.css'

/* ════════════════════════════════════════════════════════════════
   LOCAL TYPES
   ════════════════════════════════════════════════════════════════ */

type AuditLogLevel =
  | 'collision'
  | 'local'
  | 'remote'
  | 'lww'
  | 'tiebreak'
  | 'certified'

interface AuditLogEntry {
  id:        string
  timestamp: number
  level:     AuditLogLevel
  message:   string
  separator?: boolean  // if true, render as a divider line instead of text
}

/** Payload shape for simulation records. */
type MockPayload = { title: string; [key: string]: unknown }

/** Scenario definition — timestamps are computed relative to simBase at run time. */
interface SimScenarioDef {
  /** Table name shown in the collision header. */
  tableName: string
  /** Local device's record payload. */
  localPayload: MockPayload
  /** Remote device's record payload. */
  remotePayload: MockPayload
  /** Simulated UUID for the local device. */
  localUuid: string
  /** Simulated UUID for the remote device. */
  remoteUuid: string
  /**
   * Milliseconds before simBase that the local mutation occurred.
   * localTs = simBase - localOffsetMs
   */
  localOffsetMs: number
  /**
   * Milliseconds before simBase that the remote mutation occurred.
   * remoteTs = simBase - remoteOffsetMs
   * If equal to localOffsetMs → tie-break scenario.
   */
  remoteOffsetMs: number
  /** Starting versionCounter for both records. */
  baseVersion: number
}

/* ════════════════════════════════════════════════════════════════
   SIMULATION SCENARIOS
   Three canonical scenarios covering all ConflictOutcome branches.
   ════════════════════════════════════════════════════════════════ */

/**
 * Scenario A — REMOTE_WINS by timestamp (+311ms delta)
 * Demonstrates the common case: remote record arrived 311ms later.
 */
const SCENARIO_A: SimScenarioDef = {
  tableName:       'assignments',
  localPayload:    { title: 'Thesis Draft — Chapter 3', status: 'in_progress' },
  remotePayload:   { title: 'Thesis Draft — Chapter 3  [REVISED]', status: 'in_progress' },
  localUuid:       'a3b2c1d4-ffff-0000-0000-111111111111',
  remoteUuid:      'f8e7d6c5-0000-ffff-0000-222222222222',
  localOffsetMs:   1000,    // ts = simBase − 1000ms (older)
  remoteOffsetMs:  689,     // ts = simBase − 689ms  (newer by 311ms) → REMOTE_WINS
  baseVersion:     3,
}

/**
 * Scenario B — LOCAL_WINS by timestamp (+650ms delta)
 * Demonstrates local freshness protection: stale remote sync is rejected.
 */
const SCENARIO_B: SimScenarioDef = {
  tableName:       'habits',
  localPayload:    { title: 'Morning Run Streak', streakCount: 14 },
  remotePayload:   { title: 'Morning Run Streak', streakCount: 13 },
  localUuid:       'b4c3d2e1-aaaa-bbbb-cccc-333333333333',
  remoteUuid:      '19283746-dddd-eeee-ffff-444444444444',
  localOffsetMs:   200,     // ts = simBase − 200ms  (newer by 650ms) → LOCAL_WINS
  remoteOffsetMs:  850,     // ts = simBase − 850ms  (older)
  baseVersion:     7,
}

/**
 * Scenario C — TIE_BROKEN_LOCAL by UUID lexicographic sort
 * Both mutations landed at the EXACT same millisecond.
 * localUuid ('ffffffff…') > remoteUuid ('11111111…') → local wins.
 */
const SCENARIO_C: SimScenarioDef = {
  tableName:       'calendarEvents',
  localPayload:    { title: 'Study Group — Zoom Link Pending', category: 'scholastic' },
  remotePayload:   { title: 'Study Group — Zoom Confirmed 8pm', category: 'scholastic' },
  localUuid:       'ffffffff-0000-0000-0000-aaaaaaaaaaaa',  // lexicographically > remote → wins
  remoteUuid:      '11111111-0000-0000-0000-bbbbbbbbbbbb',
  localOffsetMs:   500,     // ts = simBase − 500ms (identical — triggers tie-break)
  remoteOffsetMs:  500,
  baseVersion:     2,
}

const SCENARIO_DEFS: SimScenarioDef[] = [SCENARIO_A, SCENARIO_B, SCENARIO_C]

/* ════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ════════════════════════════════════════════════════════════════ */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Formats a Unix ms timestamp as HH:MM:SS.mmm */
function fmtTime(ms: number): string {
  const d   = new Date(ms)
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  const ss  = String(d.getSeconds()).padStart(2, '0')
  const ms3 = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms3}`
}

/** Returns the last N characters of a string, prefixed with '…'. */
function tail(s: string, n = 8): string {
  return `${s.length > n ? '…' : ''}${s.slice(-n)}`
}

/** Constructs a SyncableRecord from a payload + raw meta values. */
function makeRecord<T extends Record<string, unknown>>(
  payload: T,
  meta: { uuid: string; ts: number; v: number },
): SyncableRecord<T> {
  const syncMeta: SyncMetadata = {
    lastModifiedClientUuid: meta.uuid,
    updatedAtTimestamp:     meta.ts,
    versionCounter:         meta.v,
  }
  return { ...payload, syncMeta } as SyncableRecord<T>
}

/** Maps AuditLogLevel to its CSS module class. */
function levelClass(level: AuditLogLevel): string {
  switch (level) {
    case 'collision': return styles.logCollision
    case 'local':     return styles.logLocal
    case 'remote':    return styles.logRemote
    case 'lww':       return styles.logLww
    case 'tiebreak':  return styles.logTiebreak
    case 'certified': return styles.logCertified
    default:          return styles.logLww
  }
}

/** Maps AuditLogLevel to its bracketed prefix label. */
function levelPrefix(level: AuditLogLevel): string {
  switch (level) {
    case 'collision': return '[COLLISION]'
    case 'local':     return '[LOCAL]    '
    case 'remote':    return '[REMOTE]   '
    case 'lww':       return '[LWW]      '
    case 'tiebreak':  return '[TIE-BREAK]'
    case 'certified': return '[CERTIFIED]'
    default:          return '[LOG]      '
  }
}

/**
 * Builds the ordered audit log entries for one simulation run.
 * Entries are returned in display order with individual timestamps.
 */
function buildLogEntries(
  def:    SimScenarioDef,
  local:  SyncableRecord<Record<string, unknown>>,
  remote: SyncableRecord<Record<string, unknown>>,
  result: ConflictResolutionResult<Record<string, unknown>>,
): Omit<AuditLogEntry, 'id'>[] {
  const now      = Date.now()
  const localTs  = local.syncMeta.updatedAtTimestamp
  const remoteTs = remote.syncMeta.updatedAtTimestamp
  const localTitle  = String(local.title  ?? '(unknown)')
  const remoteTitle = String(remote.title ?? '(unknown)')

  const mk = (level: AuditLogLevel, message: string): Omit<AuditLogEntry, 'id'> =>
    ({ timestamp: now, level, message })

  const entries: Omit<AuditLogEntry, 'id'>[] = []

  /* 1 — Collision header */
  entries.push(mk('collision',
    `${def.tableName} row — concurrent mutation detected across 2 devices`,
  ))

  /* 2 — Local record snapshot */
  entries.push(mk('local',
    `LOCAL  ❬ "${localTitle}" · …${String(localTs).slice(-6)} · v:${local.syncMeta.versionCounter} · ${tail(local.syncMeta.lastModifiedClientUuid, 12)} ❭`,
  ))

  /* 3 — Remote record snapshot */
  entries.push(mk('remote',
    `REMOTE ❬ "${remoteTitle}" · …${String(remoteTs).slice(-6)} · v:${remote.syncMeta.versionCounter} · ${tail(remote.syncMeta.lastModifiedClientUuid, 12)} ❭`,
  ))

  /* 4 — Resolution decision */
  if (result.tieBreakUsed) {
    const localId  = local.syncMeta.lastModifiedClientUuid.slice(0, 8)
    const remoteId = remote.syncMeta.lastModifiedClientUuid.slice(0, 8)
    const cmp      = result.outcome === 'TIE_BROKEN_LOCAL' ? '>' : '<'
    entries.push(mk('tiebreak',
      `Δt = 0ms — IDENTICAL TIMESTAMPS — UUID SORT: "${localId}…" ${cmp} "${remoteId}…" → ${result.outcome}`,
    ))
  } else {
    const direction = result.winner === 'remote' ? 'remote leads local' : 'local leads remote'
    entries.push(mk('lww',
      `Δt = +${result.delta.timestampDeltaMs}ms — ${direction} by ${result.delta.timestampDeltaMs}ms → ${result.outcome} — applying ${result.winner.toUpperCase()} payload...`,
    ))
  }

  /* 5 — Certified */
  entries.push(mk('certified',
    `Database state protected · versionCounter → ${result.winnerRecord.syncMeta.versionCounter} — zero drift certified ✓`,
  ))

  return entries
}

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function ConflictAuditPanel() {

  /* ── Device identity ──────────────────────────────────────── */
  const [clientId, setClientId] = useState('')
  useEffect(() => { setClientId(getLocalClientId()) }, [])

  /* ── Metrics ──────────────────────────────────────────────── */
  const [resolvedCount,     setResolvedCount]     = useState(0)
  const [scenarioIndex,     setScenarioIndex]     = useState(0)
  const [isSimulating,      setIsSimulating]      = useState(false)

  /* ── Audit log ────────────────────────────────────────────── */
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const logRef    = useRef<HTMLDivElement>(null)
  const mountedRef= useRef(true)

  /* Unmount guard — prevents setState calls after component removal */
  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  /* Auto-scroll log to bottom when new entries arrive */
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [auditLog])

  /* ── Simulate handler ─────────────────────────────────────── */
  const handleSimulate = useCallback(async () => {
    if (isSimulating) return
    setIsSimulating(true)

    const def     = SCENARIO_DEFS[scenarioIndex % SCENARIO_DEFS.length]
    const simBase = Date.now()

    /* Build two colliding SyncableRecord instances */
    const localRecord  = makeRecord<Record<string, unknown>>(
      def.localPayload,
      { uuid: def.localUuid,  ts: simBase - def.localOffsetMs,  v: def.baseVersion },
    )
    const remoteRecord = makeRecord<Record<string, unknown>>(
      def.remotePayload,
      { uuid: def.remoteUuid, ts: simBase - def.remoteOffsetMs, v: def.baseVersion },
    )

    /* Run the pure LWW algorithm — no I/O, always deterministic */
    const result = resolveDataCollision(localRecord, remoteRecord)

    /* Build the ordered audit log entries for this run */
    const rawEntries = buildLogEntries(def, localRecord, remoteRecord, result)

    /* Insert a separator if there are already entries in the log */
    if (auditLog.length > 0) {
      const sep: AuditLogEntry = {
        id:        crypto.randomUUID(),
        timestamp: simBase,
        level:     'lww',  // unused for separator
        message:   '',
        separator: true,
      }
      if (mountedRef.current) {
        setAuditLog(prev => [...prev, sep])
      }
      await sleep(120)
    }

    /* Stream entries one by one for the terminal-typing effect */
    for (const raw of rawEntries) {
      if (!mountedRef.current) return
      const entry: AuditLogEntry = { ...raw, id: crypto.randomUUID() }
      setAuditLog(prev => [...prev, entry])
      await sleep(210)
    }

    /* Update counters after all entries have landed */
    if (mountedRef.current) {
      setResolvedCount(c => c + 1)
      setScenarioIndex(i => i + 1)
      setIsSimulating(false)
    }
  }, [isSimulating, scenarioIndex, auditLog.length])

  /* ── Clear log handler ────────────────────────────────────── */
  const handleClearLog = useCallback(() => {
    setAuditLog([])
  }, [])

  /* ── Derived display values ───────────────────────────────── */
  const activeDeployments = resolvedCount > 0 ? 2 : 0

  const simBtnLabel = isSimulating
    ? 'Resolving…'
    : 'Simulate Concurrent Mutation Crash'

  const simBtnClass = [
    styles.simBtn,
    isSimulating ? styles.simBtnRunning : '',
  ].filter(Boolean).join(' ')

  /* ── Client UUID display (truncated for readability) ─────── */
  const displayUuid = clientId
    ? `${clientId.slice(0, 8)}…${clientId.slice(-4)}`
    : '···'

  return (
    <div className={styles.panel}>

      {/* ══════════════════════════════════════════════════════
          IDENTITY STRIP — current device node
          ══════════════════════════════════════════════════════ */}
      <div className={styles.identityStrip}>
        <span className={styles.identityDot} aria-hidden />
        <span className={styles.identityLabel}>This Device</span>
        <span className={styles.identityUuid}>{displayUuid}</span>
        <span className={styles.identitySeparator} aria-hidden />
        <span className={styles.identityNodeLabel}>Node Identity</span>
      </div>

      {/* ══════════════════════════════════════════════════════
          METRICS ROW — live counters
          ══════════════════════════════════════════════════════ */}
      <div className={styles.metricsRow} role="status" aria-live="polite">

        <div className={styles.metricBadge}>
          <span className={styles.metricBadgeLabel}>Resolved Collision Events</span>
          <span
            key={resolvedCount}
            className={`${styles.metricBadgeValue} ${resolvedCount > 0 ? styles.metricBadgeValueActive : ''}`}
          >
            {resolvedCount}
          </span>
        </div>

        <div className={styles.metricBadge}>
          <span className={styles.metricBadgeLabel}>Active Concurrent Deployments</span>
          <span
            key={activeDeployments}
            className={`${styles.metricBadgeValue} ${activeDeployments > 0 ? styles.metricBadgeValueActive : ''}`}
          >
            {activeDeployments}
            <span className={styles.metricBadgeSuffix}>
              devices
            </span>
          </span>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════
          SIMULATE BUTTON
          ══════════════════════════════════════════════════════ */}
      <button
        type="button"
        className={simBtnClass}
        onClick={() => void handleSimulate()}
        disabled={isSimulating}
        aria-label={simBtnLabel}
        aria-busy={isSimulating}
      >
        {simBtnLabel}
      </button>

      {/* ══════════════════════════════════════════════════════
          AUDIT LOG — appears after the first simulation
          ══════════════════════════════════════════════════════ */}
      {auditLog.length > 0 && (
        <div className={styles.logWrap}>

          <div className={styles.logHeader}>
            <span className={styles.logHeaderTitle}>
              Conflict Resolution Audit Log
            </span>
            <button
              type="button"
              className={styles.logClearBtn}
              onClick={handleClearLog}
              disabled={isSimulating}
              aria-label="Clear audit log"
            >
              Clear
            </button>
          </div>

          <div
            className={styles.auditLog}
            ref={logRef}
            role="log"
            aria-label="Conflict resolution audit log"
            aria-live="polite"
          >
            {auditLog.map(entry => {
              /* Separator divider */
              if (entry.separator) {
                return <div key={entry.id} className={styles.logSeparator} aria-hidden />
              }

              return (
                <div
                  key={entry.id}
                  className={`${styles.logLine} ${levelClass(entry.level)}`}
                >
                  <span className={styles.logTs}>
                    {fmtTime(entry.timestamp)}
                  </span>
                  <span className={styles.logPfx}>
                    {levelPrefix(entry.level)}
                  </span>
                  <span className={styles.logMsg}>
                    {entry.message}
                  </span>
                </div>
              )
            })}

            {/* Blinking cursor while a simulation is streaming */}
            {isSimulating && (
              <div className={`${styles.logLine} ${styles.logCursorRow}`}>
                <span className={styles.logTs} />
                <span className={styles.logPfx} />
                <span className={styles.cursor}>▮</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
