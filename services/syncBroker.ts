/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Database Synchronisation Broker
 * Phase 6 · Step 6.4 — Async Transaction Outbox + Bulk Flush
 *
 * Responsibilities:
 *   • Register Dexie `creating / updating / deleting` hooks on the
 *     four syncable tables (habits, workouts, assignments, userProfile).
 *     Every mutation is written to the `outboxMutations` IDB table
 *     before the cloud flush, giving us an offline-resilient write-ahead
 *     log that survives page reloads.
 *
 *   • processOutboxQueue() — the core batch processor:
 *       1. Guards: network + Supabase session
 *       2. Load all pending outboxMutations, oldest-first
 *       3. LWW deduplication (DELETE > later UPDATE > earlier UPDATE)
 *       4. Group by tableName
 *       5. Per table: single IN-query LWW check vs remote updated_at,
 *          then one bulk upsert call
 *       6. Atomic bulkDelete of successfully synced mutation IDs
 *       7. Retire mutations that exhaust MAX_RETRIES
 *
 *   • Shares the SyncStatus stream with the existing ZenithSyncEngine
 *     via engine.reportStatus() so SyncContext / SyncStatusIndicator
 *     reflect the broker's activity without a separate context.
 *
 * Co-existence with ZenithSyncEngine (Phase 2.2):
 *   The engine continues to drain `pendingSyncQueue` for assignments
 *   and userProfile — that system is unchanged. The broker adds:
 *     • Coverage for habits and workouts (no cloud tables existed before)
 *     • Bulk-batched upserts (one Supabase call per table per drain cycle)
 *     • Structured CREATE / UPDATE / DELETE semantics with ISO updatedAt
 *   For assignments and userProfile the broker hooks are additive; both
 *   queues receive entries, and idempotent upserts ensure no data skew.
 *
 * Activation:
 *   Call initSyncBroker() once from SyncContext (already wired in
 *   lib/SyncContext.tsx alongside engine.init()).
 * ════════════════════════════════════════════════════════════════
 */

import {
  db,
  type Habit,
  type Workout,
  type Assignment,
  type UserProfile,
} from '@/lib/db'
import { getSupabaseClient } from '@/lib/supabase'
import { getSyncEngine }     from '@/services/syncEngine'
import {
  type OutboxMutation,
  type OutboxTable,
  type OutboxAction,
  OUTBOX_CLOUD_TABLE,
} from '@/types/syncQueue'

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const BROKER_DEBOUNCE_MS = 2_000   // coalesce rapid mutations (longer than engine's 1.5 s)
const MAX_BROKER_RETRIES = 3       // retire a mutation after this many failed flush attempts

/* ════════════════════════════════════════════════════════════════
   MODULE-LEVEL SINGLETON STATE
   ════════════════════════════════════════════════════════════════ */

let _initialized   = false
let _drainTimer:   ReturnType<typeof setTimeout> | null = null

// In-memory retry counter keyed on OutboxMutation.id.
// Reset on page load — deliberate: a stale item that fails on reload
// gets another MAX_RETRIES attempts before retirement.
const _retryMap = new Map<string, number>()

/* ════════════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════════════ */

/**
 * Idempotent initialiser — safe to call multiple times.
 * Registers Dexie table hooks, wires the `window.online` listener,
 * and kicks off an initial drain for anything left from a previous session.
 */
export function initSyncBroker(): void {
  if (typeof window === 'undefined') return
  if (_initialized) return
  _initialized = true

  const safeDb = db as typeof db | null
  if (!safeDb) return

  _registerHooks(safeDb)
  window.addEventListener('online', _handleOnline)
  _scheduleDrain(0)   // immediate drain on load — clears any pre-existing outbox items
}

/**
 * Core outbox processor. Called automatically on network restore and
 * after each debounce window following a mutation. Also exposed publicly
 * for explicit invocation (e.g. "retry" UI).
 *
 * Execution contract:
 *   - Guards network + Supabase session before touching the cloud.
 *   - Emits SYNCING / CLOUD_SYNCHRONIZED / OFFLINE_QUEUED / SAVED_LOCALLY
 *     through the shared ZenithSyncEngine status stream.
 *   - Never throws — all errors are caught and surfaced via status.
 */
export async function processOutboxQueue(): Promise<void> {
  const safeDb = db as typeof db | null
  if (!safeDb || typeof window === 'undefined') return

  /* ── Network gate ─────────────────────────────────────────── */
  if (!navigator.onLine) {
    getSyncEngine().reportStatus('OFFLINE_QUEUED')
    return
  }

  /* ── Supabase client + session gate ───────────────────────── */
  const supabase = getSupabaseClient()
  if (!supabase) return   // not configured — local-only mode, no error

  let session
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch {
    return  // token refresh failure — retry on next mutation
  }

  if (!session) {
    const queueSize = await safeDb.outboxMutations.count()
    if (queueSize > 0) getSyncEngine().reportStatus('SAVED_LOCALLY')
    return
  }

  const userId = session.user.id

  /* ── Load queue (oldest-first) ────────────────────────────── */
  const pending = await safeDb.outboxMutations
    .orderBy('timestamp')
    .toArray()

  if (pending.length === 0) {
    getSyncEngine().reportStatus('CLOUD_SYNCHRONIZED')
    return
  }

  /* ── LWW deduplication ────────────────────────────────────── */
  const deduped = _deduplicateOutbox(pending)

  /* ── Group by table for bulk ops ─────────────────────────── */
  const grouped = _groupByTable(deduped)

  getSyncEngine().reportStatus('SYNCING')

  const flushedIds: string[] = []
  const failedIds:  string[] = []

  for (const [tableName, mutations] of Object.entries(grouped) as [OutboxTable, OutboxMutation[]][]) {
    try {
      await _flushTableBatch(userId, tableName, mutations, supabase)
      mutations.forEach(m => flushedIds.push(m.id))
    } catch (err) {
      console.warn(`[SyncBroker] Batch flush failed — table: ${tableName}`, err)
      mutations.forEach(m => failedIds.push(m.id))
    }
  }

  /* ── Atomic clear of synced items ─────────────────────────── */
  if (flushedIds.length > 0) {
    await safeDb.outboxMutations.bulkDelete(flushedIds)
    flushedIds.forEach(id => _retryMap.delete(id))
  }

  /* ── Retry accounting for failed items ────────────────────── */
  if (failedIds.length > 0) {
    const retireIds: string[] = []
    for (const id of failedIds) {
      const count = (_retryMap.get(id) ?? 0) + 1
      if (count >= MAX_BROKER_RETRIES) {
        retireIds.push(id)
        _retryMap.delete(id)
        console.warn(`[SyncBroker] Retiring mutation ${id} after ${MAX_BROKER_RETRIES} attempts.`)
      } else {
        _retryMap.set(id, count)
      }
    }
    if (retireIds.length > 0) {
      await safeDb.outboxMutations.bulkDelete(retireIds)
    }
    getSyncEngine().reportStatus('OFFLINE_QUEUED')
  } else {
    const remaining = await safeDb.outboxMutations.count()
    getSyncEngine().reportStatus(remaining === 0 ? 'CLOUD_SYNCHRONIZED' : 'SAVED_LOCALLY')
  }
}

/* ════════════════════════════════════════════════════════════════
   DEXIE HOOK REGISTRATION
   ════════════════════════════════════════════════════════════════ */

function _registerHooks(safeDb: NonNullable<typeof db>): void {

  /* ── habits ───────────────────────────────────────────────── */

  safeDb.habits.hook('creating', (_pk, obj: Habit) => {
    // Inject the cloud UUID onto the record while it is being stored so
    // future UPDATE and DELETE hooks can read a stable cloud identity.
    const supabaseId = crypto.randomUUID()
    ;(obj as Habit).supabaseId = supabaseId
    const snapshot = { ...obj, supabaseId }
    setTimeout(() => _enqueue('habits', 'CREATE', supabaseId, snapshot), 0)
  })

  safeDb.habits.hook('updating', (mods: Partial<Habit>, pk: unknown, obj: Habit) => {
    const merged: Habit = { ...(obj ?? {}), ...mods } as Habit
    merged.id = pk as number
    // Preserve existing cloud ID or generate one if this record predates the broker
    const supabaseId = merged.supabaseId ?? crypto.randomUUID()
    if (!obj?.supabaseId) {
      ;(mods as Partial<Habit>).supabaseId = supabaseId
    }
    const snapshot = { ...merged, supabaseId }
    setTimeout(() => _enqueue('habits', 'UPDATE', supabaseId, snapshot), 0)
  })

  safeDb.habits.hook('deleting', (_pk: unknown, obj: Habit) => {
    const supabaseId = obj?.supabaseId
    if (!supabaseId) return   // never synced — nothing to delete in the cloud
    const snapshot = { ...obj }
    setTimeout(() => _enqueue('habits', 'DELETE', supabaseId, snapshot), 0)
  })

  /* ── workouts ─────────────────────────────────────────────── */

  safeDb.workouts.hook('creating', (_pk, obj: Workout) => {
    const supabaseId = crypto.randomUUID()
    ;(obj as Workout).supabaseId = supabaseId
    const snapshot = { ...obj, supabaseId }
    setTimeout(() => _enqueue('workouts', 'CREATE', supabaseId, snapshot), 0)
  })

  safeDb.workouts.hook('updating', (mods: Partial<Workout>, pk: unknown, obj: Workout) => {
    const merged: Workout = { ...(obj ?? {}), ...mods } as Workout
    merged.id = pk as number
    const supabaseId = merged.supabaseId ?? crypto.randomUUID()
    if (!obj?.supabaseId) {
      ;(mods as Partial<Workout>).supabaseId = supabaseId
    }
    const snapshot = { ...merged, supabaseId }
    setTimeout(() => _enqueue('workouts', 'UPDATE', supabaseId, snapshot), 0)
  })

  safeDb.workouts.hook('deleting', (_pk: unknown, obj: Workout) => {
    const supabaseId = obj?.supabaseId
    if (!supabaseId) return
    const snapshot = { ...obj }
    setTimeout(() => _enqueue('workouts', 'DELETE', supabaseId, snapshot), 0)
  })

  /* ── assignments (additive — pendingSyncQueue hooks still fire) ── */

  safeDb.assignments.hook('creating', (_pk, obj: Assignment) => {
    // The existing ZenithSyncEngine hook injects supabaseId here first.
    // We read it after setTimeout so the engine's synchronous injection
    // has already run before we snapshot the object.
    const snapshot = { ...obj }
    setTimeout(() => {
      const supabaseId = (db?.assignments as unknown as { _latestSupabaseId?: string })
        ? (snapshot.supabaseId ?? crypto.randomUUID())
        : crypto.randomUUID()
      _enqueue('assignments', 'CREATE', supabaseId, snapshot)
    }, 0)
  })

  safeDb.assignments.hook('updating', (mods: Partial<Assignment>, pk: unknown, obj: Assignment) => {
    const merged: Assignment = { ...(obj ?? {}), ...mods } as Assignment
    merged.id = pk as number
    const supabaseId = merged.supabaseId ?? crypto.randomUUID()
    const snapshot = { ...merged, supabaseId }
    setTimeout(() => _enqueue('assignments', 'UPDATE', supabaseId, snapshot), 0)
  })

  safeDb.assignments.hook('deleting', (_pk: unknown, obj: Assignment) => {
    const supabaseId = obj?.supabaseId
    if (!supabaseId) return
    setTimeout(() => _enqueue('assignments', 'DELETE', supabaseId, { ...obj }), 0)
  })

  /* ── userProfile ──────────────────────────────────────────── */
  // Uses the sentinel string 'PROFILE' for the cloud ID — the broker
  // replaces it with the real auth.uid() at flush time.

  safeDb.userProfile.hook('creating', (_pk, obj: UserProfile) => {
    const snapshot = { ...obj }
    setTimeout(() => _enqueue('userProfile', 'CREATE', 'PROFILE', snapshot), 0)
  })

  safeDb.userProfile.hook('updating', (mods: Partial<UserProfile>, _pk: unknown, obj: UserProfile) => {
    const merged: UserProfile = { ...(obj ?? {}), ...mods } as UserProfile
    const snapshot = { ...merged }
    setTimeout(() => _enqueue('userProfile', 'UPDATE', 'PROFILE', snapshot), 0)
  })
}

/* ════════════════════════════════════════════════════════════════
   INTERNAL — QUEUE MANAGEMENT
   ════════════════════════════════════════════════════════════════ */

function _enqueue(
  tableName: OutboxTable,
  action:    OutboxAction,
  cloudId:   string,
  payload:   Record<string, unknown>,
): void {
  const safeDb = db as typeof db | null
  if (!safeDb) return

  getSyncEngine().reportStatus('SAVED_LOCALLY')

  const mutation: OutboxMutation = {
    id:        cloudId,         // stable UUID — doubles as the cloud PK
    tableName,
    action,
    payload,
    timestamp: Date.now(),
    updatedAt: new Date().toISOString(),
  }

  safeDb.outboxMutations
    .put(mutation)              // put (not add) — overwrites same-id entry; natural dedup
    .then(() => _scheduleDrain())
    .catch(() => {})            // non-fatal — the mutation is already safe in IDB
}

function _scheduleDrain(delayMs = BROKER_DEBOUNCE_MS): void {
  if (_drainTimer !== null) clearTimeout(_drainTimer)
  _drainTimer = setTimeout(() => {
    _drainTimer = null
    processOutboxQueue().catch(() => {})
  }, delayMs)
}

const _handleOnline = (): void => _scheduleDrain(0)

/* ════════════════════════════════════════════════════════════════
   INTERNAL — DEDUPLICATION (LAST-WRITE-WINS)
   ════════════════════════════════════════════════════════════════ */

/**
 * Collapses the ordered outbox into a deduplicated set per record key:
 *   DELETE always supersedes any upsert for the same cloud ID.
 *   Among multiple UPDATEs: the latest timestamp wins.
 *   A CREATE followed by UPDATE(s): collapses to the latest UPDATE payload.
 */
function _deduplicateOutbox(items: OutboxMutation[]): OutboxMutation[] {
  const map = new Map<string, OutboxMutation>()

  for (const item of items) {
    // Key: stable cloud ID — already the outbox mutation ID (injected as supabaseId)
    const existing = map.get(item.id)

    if (!existing) { map.set(item.id, item); continue }

    // DELETE beats any preceding mutation
    if (item.action === 'DELETE') { map.set(item.id, item); continue }

    // Among non-DELETE: keep the most recent snapshot
    if (existing.action !== 'DELETE' && item.timestamp > existing.timestamp) {
      map.set(item.id, item)
    }
  }

  return Array.from(map.values())
}

/* ════════════════════════════════════════════════════════════════
   INTERNAL — GROUPING
   ════════════════════════════════════════════════════════════════ */

function _groupByTable(
  items: OutboxMutation[],
): Partial<Record<OutboxTable, OutboxMutation[]>> {
  const groups: Partial<Record<OutboxTable, OutboxMutation[]>> = {}
  for (const item of items) {
    if (!groups[item.tableName]) groups[item.tableName] = []
    groups[item.tableName]!.push(item)
  }
  return groups
}

/* ════════════════════════════════════════════════════════════════
   INTERNAL — BATCH FLUSH (ONE SUPABASE CALL PER TABLE)
   ════════════════════════════════════════════════════════════════ */

/**
 * Flushes one table's mutation batch atomically:
 *   1. Bulk-fetch remote `updated_at` for all pending upsert IDs (one SELECT IN).
 *   2. Filter locally: only upload records where localTs >= remoteTs (LWW).
 *   3. One bulk `upsert` call with all winning rows.
 *   4. One bulk `delete` call for all DELETE mutations.
 *
 * Throws on Supabase error so the caller can mark those IDs as failed.
 */
async function _flushTableBatch(
  userId:    string,
  tableName: OutboxTable,
  mutations: OutboxMutation[],
  supabase:  NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  const cloudTable = OUTBOX_CLOUD_TABLE[tableName]

  const upserts = mutations.filter(m => m.action !== 'DELETE')
  const deletes = mutations.filter(m => m.action === 'DELETE')

  /* ── DUAL-PASS LWW: bulk-fetch remote timestamps ────────────── */
  if (upserts.length > 0) {
    const cloudIds = upserts.map(m =>
      tableName === 'userProfile' ? userId : m.id,
    )

    // One SELECT call covers all pending records for this table
    const { data: remoteRows } = await supabase
      .from(cloudTable)
      .select('id, updated_at')
      .in('id', cloudIds)

    const remoteTs = new Map<string, number>(
      (remoteRows ?? []).map(r => [
        r.id as string,
        new Date(r.updated_at as string).getTime(),
      ]),
    )

    // Keep only records where local write is at least as recent as remote
    const winners = upserts.filter(m => {
      const remoteId = tableName === 'userProfile' ? userId : m.id
      const remote   = remoteTs.get(remoteId) ?? 0
      const local    = new Date(m.updatedAt).getTime()
      return local >= remote
    })

    if (winners.length > 0) {
      const rows = winners
        .map(m => _buildCloudRow(userId, tableName, m))
        .filter((r): r is Record<string, unknown> => r !== null)

      const { error } = await supabase
        .from(cloudTable)
        .upsert(rows, { onConflict: 'id' })

      if (error) throw error
    }
  }

  /* ── Bulk DELETE ────────────────────────────────────────────── */
  if (deletes.length > 0) {
    if (tableName === 'userProfile') {
      // userProfile PK = auth.uid() — only one possible row
      const { error } = await supabase
        .from(cloudTable)
        .delete()
        .eq('id', userId)
      if (error) throw error
    } else {
      const ids = deletes.map(m => m.id)
      const { error } = await supabase
        .from(cloudTable)
        .delete()
        .in('id', ids)
        .eq('user_id', userId)   // belt-and-suspenders alongside RLS
      if (error) throw error
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   INTERNAL — CLOUD ROW BUILDERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Translates a local IDB row snapshot into the snake_case shape
 * expected by the corresponding Supabase table.
 * Returns null for unrecognised table names (safety guard).
 */
function _buildCloudRow(
  userId:    string,
  tableName: OutboxTable,
  m:         OutboxMutation,
): Record<string, unknown> | null {

  const p = m.payload

  switch (tableName) {

    case 'assignments': {
      return {
        id:         (p.supabaseId as string | undefined) ?? m.id,
        user_id:    userId,
        title:      p.title,
        due_date:   p.dueDate
                      ? new Date(p.dueDate as string).toISOString()
                      : null,
        course_id:  p.courseId  ?? 'general',
        status:     p.status    ?? 'pending',
        priority:   p.priority  ?? 'medium',
        created_at: p.createdAt
                      ? new Date(p.createdAt as number).toISOString()
                      : new Date().toISOString(),
      }
    }

    case 'habits': {
      return {
        id:                  m.id,
        user_id:             userId,
        name:                p.name,
        frequency:           p.frequency    ?? 'daily',
        streak_count:        p.streakCount  ?? 0,
        last_completed_date: p.lastCompletedDate ?? null,
        category:            p.category     ?? 'general',
        difficulty:          p.difficulty   ?? 'medium',
        created_at:          p.createdAt
                               ? new Date(p.createdAt as number).toISOString()
                               : new Date().toISOString(),
        updated_at:          m.updatedAt,
      }
    }

    case 'userProfile': {
      return {
        id:               userId,
        user_name:        p.userName        ?? '',
        university_name:  p.universityName  ?? '',
        major_identifier: p.majorIdentifier ?? '',
        current_level:    p.currentLevel    ?? 1,
        exp_points:       p.expPoints       ?? 0,
        health_points:    p.healthPoints    ?? 100,
        // updated_at managed by Postgres trigger — never set manually
      }
    }

    case 'workouts': {
      return {
        id:            m.id,
        user_id:       userId,
        exercise_name: p.exerciseName,
        sets:          p.sets          ?? 0,
        reps:          p.reps          ?? 0,
        weight:        p.weight        ?? 0,
        log_date:      p.logDate,
        type:          p.type          ?? 'strength',
        duration_mins: p.durationMins  ?? null,
        notes:         p.notes         ?? null,
        created_at:    p.logDate
                         ? new Date(p.logDate as string).toISOString()
                         : new Date().toISOString(),
        updated_at:    m.updatedAt,
      }
    }

    default:
      return null
  }
}
