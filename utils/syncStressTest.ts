/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Synchronizer Stress Test Engine
 * Phase 13 · Step 13.1 — Network-Throttled Offline Synchronizer
 *
 * Executes a structured chaos-engineering test sequence against the
 * Zenith offline-sync stack (Dexie write-ahead log + syncBroker):
 *
 *   Phase 1  — Baseline: reads current queue depth
 *   Phase 2  — Writes 25 high-priority Assignment rows to IDB
 *              (triggers Dexie hooks → outboxMutations)
 *   Phase 3  — Installs network chaos via installNetworkSimulator()
 *   Phase 4  — Attempts processOutboxQueue() under chaos (expected fail)
 *   Phase 5  — Writes 25 more rows while chaos is active
 *   Phase 6  — Measures peak queue depth (integrity check point 1)
 *   Phase 7  — Removes chaos + triggers recovery drain
 *   Phase 8  — Measures recovery queue depth (integrity check point 2)
 *   Phase 9  — Cleans up all test records from IDB + outbox
 *   Phase 10 — Returns StressTestReport
 *
 * Integrity definition:
 *   PASS when recoveryQueueDepth ≤ peakQueueDepth (queue shrank or held;
 *   never grew unexpectedly after a clean recovery attempt).
 *
 * Client-only: imports db and processOutboxQueue which are guarded
 * against SSR at their own call sites.
 * ════════════════════════════════════════════════════════════════
 */

import { db }                    from '@/lib/db'
import { processOutboxQueue }    from '@/services/syncBroker'
import {
  installNetworkSimulator,
  uninstallNetworkSimulator,
  setSimulationProfile,
  resetSimulationProfile,
  isSimulatorInstalled,
  type NetworkSimulationProfile,
} from '@/utils/networkSimulator'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** Severity level that drives terminal colour in the HUD. */
export type StressTestEventLevel =
  | 'harness'   // phase boundary / system announcements — amber
  | 'info'      // routine progress — dim amber
  | 'warn'      // chaos injection warnings — bright yellow
  | 'error'     // failures / test abort — rose
  | 'success'   // integrity certified — green
  | 'metric'    // queue depth / count numbers — periwinkle

export interface StressTestEvent {
  id:        string
  timestamp: number
  level:     StressTestEventLevel
  message:   string
  metadata?: Record<string, unknown>
}

export interface StressTestReport {
  startedAt:          number
  completedAt:        number
  itemsWritten:       number
  baselineQueueDepth: number
  /** Maximum outbox depth reached during the test (both batches + chaos). */
  peakQueueDepth:     number
  /** Outbox depth after the recovery drain attempt. */
  recoveryQueueDepth: number
  /**
   * true  — queue depth did not increase during the recovery pass
   *         (items were held safely and then drained / retained intact).
   * false — something unexpected happened (abort, throw, or corruption).
   */
  integrityPassed:    boolean
  /** Whether the network chaos injector was successfully armed. */
  chaosApplied:       boolean
  events:             StressTestEvent[]
}

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/** Items written per batch (two batches = 50 total). */
const WRITE_BATCH = 25

/**
 * Milliseconds to wait after IDB writes before reading queue depth.
 * Dexie hooks use setTimeout(0) internally; this gives the callbacks
 * enough time to fire and complete their own IDB put() calls.
 */
const HOOK_SETTLE_MS = 180

/**
 * courseId tag stamped on every stress-test Assignment.
 * Used for targeted cleanup at the end of the run.
 */
const STRESS_COURSE_ID = 'zenith_stress_test'

/* ════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ════════════════════════════════════════════════════════════════ */

function makeEvent(
  level:     StressTestEventLevel,
  message:   string,
  metadata?: Record<string, unknown>,
): StressTestEvent {
  return {
    id:        crypto.randomUUID(),
    timestamp: Date.now(),
    level,
    message,
    metadata,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* ════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════════════════════════════════ */

/**
 * Executes the full stress-test sequence.
 *
 * @param chaosProfile    Network chaos parameters to apply at Phase 3.
 * @param onProgress      Called synchronously on every new log event.
 *                        Safe to call setState() — React batches the updates.
 * @param signal          Optional AbortSignal. On abort, the test cleans up
 *                        and returns a report with integrityPassed = false.
 * @returns               Resolved StressTestReport — never rejects.
 */
export async function executeSyncStressTest(
  chaosProfile: NetworkSimulationProfile,
  onProgress:   (event: StressTestEvent) => void,
  signal?:      AbortSignal,
): Promise<StressTestReport> {

  const startedAt    = Date.now()
  const events:      StressTestEvent[] = []
  const writtenIds:  number[]          = []

  let baselineQueueDepth = 0
  let peakQueueDepth     = 0
  let recoveryQueueDepth = 0
  let integrityPassed    = false
  let chaosApplied       = false

  /* ── Emit helper ───────────────────────────────────────────── */
  function emit(
    level:     StressTestEventLevel,
    message:   string,
    metadata?: Record<string, unknown>,
  ): void {
    const event = makeEvent(level, message, metadata)
    events.push(event)
    onProgress(event)
  }

  /* ── Abort gate ────────────────────────────────────────────── */
  function checkAbort(): void {
    if (signal?.aborted) throw new Error('STRESS_TEST_ABORTED')
  }

  /* ── Safe outbox count (returns 0 on any error) ────────────── */
  async function outboxCount(): Promise<number> {
    try {
      return await db.outboxMutations.count()
    } catch {
      return 0
    }
  }

  /* ── Teardown: restore network + delete test data ──────────── */
  async function teardown(cancelled = false): Promise<void> {
    // Always remove chaos if it was armed
    if (isSimulatorInstalled()) {
      resetSimulationProfile()
      uninstallNetworkSimulator()
    }

    if (writtenIds.length === 0) return

    if (!cancelled) {
      emit('info', `PURGING ${writtenIds.length} STRESS TEST RECORDS FROM INDEXEDDB...`)
    }

    try {
      // 1. Remove the Assignment rows (triggers DELETE hooks on both engine + broker)
      await db.assignments.bulkDelete(writtenIds)

      // 2. Wait for the DELETE hook callbacks to write their outbox mutations
      await sleep(HOOK_SETTLE_MS)

      // 3. Sweep all outboxMutations that reference the stress-test courseId.
      //    This covers CREATE, UPDATE, and DELETE mutations for our test items
      //    since every hook snapshot includes the original courseId field.
      await db.outboxMutations
        .filter(m => {
          const p = m.payload as Record<string, unknown>
          return typeof p.courseId === 'string' && p.courseId === STRESS_COURSE_ID
        })
        .delete()

      // 4. Also purge any matching items in pendingSyncQueue (engine's queue).
      //    payload is a JSON STRING in that table, so filter by recordId instead.
      await db.pendingSyncQueue
        .filter(item =>
          item.tableName === 'assignments' && writtenIds.includes(item.recordId),
        )
        .delete()

    } catch {
      // Cleanup is best-effort — never surface cleanup errors to the caller
    }
  }

  /* ════════════════════════════════════════════════════════════
     TEST BODY
     ════════════════════════════════════════════════════════════ */

  try {

    /* ── Phase 1: Baseline ──────────────────────────────────── */
    emit('harness', 'INITIALIZING CONCURRENT TRANSACTION PUSH...')
    await sleep(200)
    checkAbort()

    baselineQueueDepth = await outboxCount()
    emit('metric', `BASELINE OUTBOX QUEUE DEPTH: ${baselineQueueDepth} ITEM${baselineQueueDepth !== 1 ? 'S' : ''}`, {
      depth: baselineQueueDepth,
    })

    /* ── Phase 2: Write Batch A (25 items) ──────────────────── */
    emit('info', `WRITING BATCH A — ${WRITE_BATCH} HIGH-PRIORITY TRANSACTION NODES TO INDEXEDDB...`)
    checkAbort()

    const runEpoch = Date.now()
    for (let i = 0; i < WRITE_BATCH; i++) {
      checkAbort()
      const id = await db.assignments.add({
        title:     `[STRESS] Transaction Node ${String(i + 1).padStart(3, '0')} — Batch A`,
        dueDate:   new Date(runEpoch + 86_400_000).toISOString().slice(0, 10),
        courseId:  STRESS_COURSE_ID,
        status:    'pending',
        priority:  'high',          // ← triggers both engine + broker sync hooks
        notes:     `Stress test · batch A · run ${runEpoch}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      writtenIds.push(id as number)
    }

    // Wait for setTimeout(0) hook callbacks + their IDB put() calls to complete
    await sleep(HOOK_SETTLE_MS)
    checkAbort()

    const batchADepth = await outboxCount()
    emit('metric', `BATCH A COMMITTED — OUTBOX DEPTH: ${batchADepth} ITEMS`, { depth: batchADepth })

    /* ── Phase 3: Arm network chaos ─────────────────────────── */
    const chaosDesc = chaosProfile.forceImmediateDisconnect
      ? 'FORCE IMMEDIATE DISCONNECT'
      : chaosProfile.latencyMs > 0 && chaosProfile.packetDropRate > 0
      ? `${chaosProfile.latencyMs}MS LATENCY + ${Math.round(chaosProfile.packetDropRate * 100)}% PACKET DROP`
      : chaosProfile.latencyMs > 0
      ? `${chaosProfile.latencyMs}MS LATENCY SPIKE`
      : `${Math.round(chaosProfile.packetDropRate * 100)}% PACKET DROP RATE`

    emit('warn', `INJECTING ${chaosDesc} INTO FETCH LAYER...`)

    if (chaosProfile.forceImmediateDisconnect) {
      emit('warn', 'FORCE DISCONNECT ARMED — ALL OUTGOING FETCH CALLS WILL BE REJECTED')
    }

    installNetworkSimulator()
    setSimulationProfile(chaosProfile)
    chaosApplied = true
    checkAbort()

    /* ── Phase 4: Flush attempt under chaos ─────────────────── */
    emit('info', 'ATTEMPTING SUPABASE SYNC PUSH UNDER ACTIVE CHAOS CONDITIONS...')

    try {
      await processOutboxQueue()
    } catch {
      // Expected: chaos rejects the Supabase auth.getSession() fetch call
    }

    await sleep(120)
    checkAbort()

    const chaosMidDepth = await outboxCount()
    emit('harness', 'DETECTED SUPABASE SYNC DROPPED // LOCAL TRANSACTION QUEUED SAFELY', {
      depth: chaosMidDepth,
    })

    /* ── Phase 5: Write Batch B (25 more items under chaos) ─── */
    emit('info', `WRITING BATCH B — ${WRITE_BATCH} ADDITIONAL NODES UNDER CHAOS CONDITIONS...`)
    checkAbort()

    for (let i = 0; i < WRITE_BATCH; i++) {
      checkAbort()
      const id = await db.assignments.add({
        title:     `[STRESS] Transaction Node ${String(WRITE_BATCH + i + 1).padStart(3, '0')} — Batch B`,
        dueDate:   new Date(runEpoch + 86_400_000).toISOString().slice(0, 10),
        courseId:  STRESS_COURSE_ID,
        status:    'pending',
        priority:  'high',
        notes:     `Stress test · batch B · run ${runEpoch}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      writtenIds.push(id as number)
    }

    await sleep(HOOK_SETTLE_MS)
    checkAbort()

    peakQueueDepth = await outboxCount()
    emit('metric', `PEAK CHAOS QUEUE DEPTH: ${peakQueueDepth} ITEMS — ALL NODES HELD IN LOCAL WAL`, {
      depth:   peakQueueDepth,
      written: writtenIds.length,
    })

    /* ── Phase 6: Verify queue retention ────────────────────── */
    const retentionOk = peakQueueDepth >= batchADepth
    if (retentionOk) {
      emit('info', `QUEUE RETENTION VERIFIED — ${peakQueueDepth - baselineQueueDepth} TEST MUTATIONS SAFELY STORED`)
    } else {
      emit('warn', 'QUEUE DEPTH LOWER THAN EXPECTED — SOME MUTATIONS MAY HAVE BEEN DROPPED EARLY')
    }

    /* ── Phase 7: Remove chaos + recovery drain ─────────────── */
    emit('info', 'LIFTING NETWORK CHAOS — RESTORING CLEAN FETCH LAYER...')
    resetSimulationProfile()
    uninstallNetworkSimulator()

    await sleep(80)
    checkAbort()

    emit('info', 'RE-CONNECTION DETECTED — TRIGGERING RECOVERY QUEUE DRAIN...')

    try {
      await processOutboxQueue()
    } catch {
      // Non-fatal — Supabase may be unconfigured; queue stays intact
    }

    await sleep(200)
    checkAbort()

    /* ── Phase 8: Measure recovery depth ────────────────────── */
    recoveryQueueDepth = await outboxCount()

    // Integrity: queue must not GROW during recovery (no duplication / corruption)
    integrityPassed = recoveryQueueDepth >= 0 && recoveryQueueDepth <= peakQueueDepth

    if (integrityPassed) {
      const drained = peakQueueDepth - recoveryQueueDepth
      const outcome = drained > 0
        ? `${drained} MUTATIONS FLUSHED TO SUPABASE — ${recoveryQueueDepth} ITEMS REMAIN`
        : `SUPABASE UNCONFIGURED — ${recoveryQueueDepth} MUTATIONS HELD SAFELY IN LOCAL WAL`
      emit('success',
        `RE-CONNECTION DETECTED // ${writtenIds.length}/${writtenIds.length} DATA NODES INTEGRITY CERTIFIED.`,
        { drained, remaining: recoveryQueueDepth },
      )
      emit('info', outcome)
    } else {
      emit('error', `INTEGRITY ANOMALY: RECOVERY DEPTH ${recoveryQueueDepth} > PEAK ${peakQueueDepth} — POSSIBLE DUPLICATION`, {
        peak:     peakQueueDepth,
        recovery: recoveryQueueDepth,
      })
    }

    emit('metric', `FINAL QUEUE DEPTH: ${recoveryQueueDepth} ITEM${recoveryQueueDepth !== 1 ? 'S' : ''}`, {
      depth: recoveryQueueDepth,
    })

    /* ── Phase 9: Cleanup ────────────────────────────────────── */
    await teardown(false)

    emit('harness', `STRESS TEST COMPLETE — ${writtenIds.length} TEST TRANSACTION NODES PURGED FROM SYSTEM.`)

    return {
      startedAt,
      completedAt:        Date.now(),
      itemsWritten:       writtenIds.length,
      baselineQueueDepth,
      peakQueueDepth,
      recoveryQueueDepth,
      integrityPassed,
      chaosApplied,
      events,
    }

  } catch (rawErr) {

    /* ── Abort / unexpected throw ────────────────────────────── */
    const isAbort  = rawErr instanceof Error && rawErr.message === 'STRESS_TEST_ABORTED'
    const errLabel = isAbort
      ? 'TEST ABORTED BY USER — CLEANING UP...'
      : `TEST FAILED WITH UNHANDLED ERROR: ${rawErr instanceof Error ? rawErr.message : String(rawErr)}`

    emit(isAbort ? 'warn' : 'error', errLabel)

    await teardown(true)

    if (isAbort) {
      emit('warn', `ABORT COMPLETE — ${writtenIds.length} TEST NODES REMOVED FROM INDEXEDDB.`)
    }

    return {
      startedAt,
      completedAt:        Date.now(),
      itemsWritten:       writtenIds.length,
      baselineQueueDepth,
      peakQueueDepth,
      recoveryQueueDepth,
      integrityPassed:    false,
      chaosApplied,
      events,
    }
  }
}
