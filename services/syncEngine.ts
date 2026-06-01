/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Cloud Synchronization Engine
 * Phase 2 · Step 2.2 — Cloud Synchronization Pipeline Hooks
 *
 * Architecture overview:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  IndexedDB (Dexie)                                      │
 *   │   assignments / userProfile  ──hook──▶  pendingSyncQueue│
 *   └──────────────────────────────────────────┬──────────────┘
 *                                              │ drain (debounced 1.5 s)
 *                                              ▼
 *   ┌──────────────────────────────────────────────────────── ┐
 *   │  reconcileLocalToCloud()                                │
 *   │   • navigator.onLine?  NO  → emit OFFLINE_QUEUED       │
 *   │   • supabase session?  NO  → emit SAVED_LOCALLY        │
 *   │   • deduplicate queue  (LWW by timestamp)              │
 *   │   • flush upsert / delete per table                    │
 *   │   • bulkDelete synced items on success                 │
 *   └──────────────────────────────────────────┬─────────────┘
 *                                              │
 *                                              ▼
 *                               supabase_user_profiles
 *                               supabase_urgent_tasks
 *
 * Conflict resolution — Last-Write-Wins (LWW):
 *   For userProfile: local timestamp is compared against the remote
 *   `updated_at` column. If the remote row is newer, our upload is
 *   skipped — the remote state is the truth. A downstream fetch phase
 *   (Phase 2.3) will pull the latest remote state back to local.
 *   For urgent tasks: the local device is always the authoritative source
 *   for its own tasks in Phase 2; no remote-wins check is performed.
 *
 * Offline resilience:
 *   Queue items are retained in IndexedDB across page refreshes.
 *   A `window.online` listener automatically re-triggers reconciliation
 *   when connectivity is restored.
 * ════════════════════════════════════════════════════════════════
 */

import {
  db,
  type Assignment,
  type UserProfile,
  type PendingSyncQueueItem,
} from '@/lib/db'
import { getSupabaseClient } from '@/lib/supabase'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export type SyncStatus =
  | 'SAVED_LOCALLY'       // Local write landed in IndexedDB; cloud sync pending
  | 'SYNCING'             // Actively flushing pending queue to Supabase
  | 'CLOUD_SYNCHRONIZED'  // All queued items flushed; cloud mirrors local state
  | 'OFFLINE_QUEUED'      // Network unavailable; items held in pendingSyncQueue

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const DRAIN_DEBOUNCE_MS = 1_500   // Coalesce rapid mutations before syncing
const MAX_RETRIES       = 3       // Drop a queue item after this many failures

/* ════════════════════════════════════════════════════════════════
   SINGLETON ACCESSOR
   ════════════════════════════════════════════════════════════════ */

let _instance: ZenithSyncEngine | null = null

/**
 * Returns the process-scoped singleton engine.
 * Safe to call multiple times — returns the same instance.
 */
export function getSyncEngine(): ZenithSyncEngine {
  if (!_instance) _instance = new ZenithSyncEngine()
  return _instance
}

/* ════════════════════════════════════════════════════════════════
   ENGINE CLASS
   ════════════════════════════════════════════════════════════════ */

export class ZenithSyncEngine {

  /* ── Internal state ─────────────────────────────────────── */
  private _status:          SyncStatus = 'CLOUD_SYNCHRONIZED'
  private _hooksRegistered  = false
  private _reconciling      = false
  private _drainTimer:      ReturnType<typeof setTimeout> | null = null
  private _listeners        = new Set<(s: SyncStatus) => void>()

  /* ── Public accessors ───────────────────────────────────── */

  get status(): SyncStatus { return this._status }

  /* ── Initialisation ─────────────────────────────────────── */

  /**
   * Idempotent entry-point called by SyncProvider on mount.
   * Registers Dexie table hooks and window network listeners once,
   * then kicks off an initial drain pass for any items that were
   * queued during a previous offline session.
   */
  init(): void {
    if (typeof window === 'undefined') return

    // Dexie db is null on server; guard defensively at runtime
    const safeDb = db as typeof db | null
    if (!safeDb) return

    this.registerHooks(safeDb)
    this.setupNetworkListeners()
    this.scheduleDrain(0)   // flush anything left over from a previous session
  }

  /* ── Status subscription ────────────────────────────────── */

  /**
   * Subscribe to sync status changes.
   * @returns Unsubscribe function — call in useEffect cleanup.
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this._listeners.add(listener)
    listener(this._status)       // emit current state immediately on subscribe
    return () => this._listeners.delete(listener)
  }

  /* ── Public reconciliation trigger ─────────────────────── */

  /**
   * Manually trigger a reconciliation pass (e.g. on "retry" click).
   * Also called automatically by the drain scheduler and the online event.
   */
  async reconcileLocalToCloud(): Promise<void> {
    // Prevent concurrent reconciliation passes
    if (this._reconciling) return

    const safeDb = db as typeof db | null
    if (!safeDb || typeof window === 'undefined') return

    /* ── Network gate ─────────────────────────────────────── */
    if (!navigator.onLine) {
      this.emit('OFFLINE_QUEUED')
      return
    }

    /* ── Supabase client + session gate ───────────────────── */
    const supabase = getSupabaseClient()
    if (!supabase) {
      // Supabase not configured — local-only mode, no error
      return
    }

    let session
    try {
      const result = await supabase.auth.getSession()
      session = result.data.session
    } catch {
      // Token refresh failure — keep queue intact, retry on next mutation
      return
    }

    if (!session) {
      // No Supabase auth session — sync unavailable until Phase 2.3 auth wiring
      // Queue items are preserved; status reflects local-only state
      const queueSize = await safeDb.pendingSyncQueue.count()
      if (queueSize > 0) this.emit('SAVED_LOCALLY')
      return
    }

    const userId = session.user.id

    /* ── Load and deduplicate queue ───────────────────────── */
    const allItems = await safeDb.pendingSyncQueue
      .orderBy('timestamp')
      .toArray()

    if (allItems.length === 0) {
      this.emit('CLOUD_SYNCHRONIZED')
      return
    }

    const deduped = this.deduplicateQueue(allItems)

    /* ── Flush ────────────────────────────────────────────── */
    this._reconciling = true
    this.emit('SYNCING')

    try {
      const { syncedIds, failedIds } = await this.flushToCloud(userId, deduped)

      if (syncedIds.length > 0) {
        await safeDb.pendingSyncQueue.bulkDelete(syncedIds)
      }

      if (failedIds.length > 0) {
        await this.incrementRetries(failedIds)
        this.emit('OFFLINE_QUEUED')
      } else {
        const remaining = await safeDb.pendingSyncQueue.count()
        this.emit(remaining === 0 ? 'CLOUD_SYNCHRONIZED' : 'OFFLINE_QUEUED')
      }
    } catch (err) {
      console.warn('[ZenithSync] Reconciliation failed:', err)
      this.emit('OFFLINE_QUEUED')
    } finally {
      this._reconciling = false
    }
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — DEXIE HOOK REGISTRATION
     ════════════════════════════════════════════════════════ */

  private registerHooks(safeDb: NonNullable<typeof db>): void {
    if (this._hooksRegistered) return
    this._hooksRegistered = true

    /* ── assignments: creating ────────────────────────────── */
    safeDb.assignments.hook('creating', (_primKey, obj: Assignment) => {
      if (!isUrgent(obj.priority)) return

      // Inject the cloud UUID onto the record AS it is stored — this means
      // `supabaseId` will be persisted to IndexedDB in the same write,
      // giving subsequent updates a stable cloud identity to upsert against.
      const supabaseId = crypto.randomUUID()
      ;(obj as Assignment).supabaseId = supabaseId

      // Schedule the queue write outside the current IDB transaction via
      // setTimeout(0). By the time this fires, the transaction has committed.
      const snapshot = { ...obj, supabaseId }
      setTimeout(() => {
        this.enqueueSync('assignments', 'upsert', 0, supabaseId, snapshot)
      }, 0)
    })

    /* ── assignments: updating ────────────────────────────── */
    safeDb.assignments.hook(
      'updating',
      (modifications: Partial<Assignment>, primKey: unknown, obj: Assignment) => {
        // Resolve the effective priority after the update
        const effectivePriority = (modifications.priority ?? obj?.priority)
        if (!isUrgent(effectivePriority)) return

        const merged: Assignment = { ...(obj ?? {}), ...modifications } as Assignment
        merged.id = primKey as number

        // Preserve or generate the cloud UUID
        const supabaseId = merged.supabaseId ?? crypto.randomUUID()
        merged.supabaseId = supabaseId

        // Inject the supabaseId into the update modifications so it is
        // persisted back to IndexedDB if it was newly generated here
        if (!obj?.supabaseId) {
          ;(modifications as Partial<Assignment>).supabaseId = supabaseId
        }

        const snapshot = { ...merged }
        setTimeout(() => {
          this.enqueueSync('assignments', 'upsert', primKey as number, supabaseId, snapshot)
        }, 0)
      },
    )

    /* ── assignments: deleting ────────────────────────────── */
    safeDb.assignments.hook('deleting', (primKey: unknown, obj: Assignment) => {
      // Only push a delete to the cloud if this record was ever synced
      const supabaseId = obj?.supabaseId
      if (!supabaseId) return

      setTimeout(() => {
        this.enqueueSync('assignments', 'delete', primKey as number, supabaseId, obj)
      }, 0)
    })

    /* ── userProfile: creating ────────────────────────────── */
    safeDb.userProfile.hook('creating', (_primKey, obj: UserProfile) => {
      const snapshot = { ...obj }
      setTimeout(() => {
        // For userProfile the cloud ID is auth.uid() — we use a stable
        // sentinel string here; it is replaced by the real userId at flush time.
        this.enqueueSync('userProfile', 'upsert', obj.id, 'PROFILE', snapshot)
      }, 0)
    })

    /* ── userProfile: updating ────────────────────────────── */
    safeDb.userProfile.hook(
      'updating',
      (modifications: Partial<UserProfile>, _primKey: unknown, obj: UserProfile) => {
        const merged: UserProfile = { ...(obj ?? {}), ...modifications } as UserProfile
        const snapshot = { ...merged }
        setTimeout(() => {
          this.enqueueSync('userProfile', 'upsert', 1, 'PROFILE', snapshot)
        }, 0)
      },
    )
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — QUEUE MANAGEMENT
     ════════════════════════════════════════════════════════ */

  /**
   * Writes a sync item to the local pending queue and schedules a drain pass.
   * Called from setTimeout callbacks so the Dexie hook's IDB transaction
   * has already committed before we open a new one.
   */
  private enqueueSync(
    tableName:  PendingSyncQueueItem['tableName'],
    operation:  PendingSyncQueueItem['operation'],
    recordId:   number,
    supabaseId: string,
    record:     unknown,
  ): void {
    const safeDb = db as typeof db | null
    if (!safeDb) return

    this.emit('SAVED_LOCALLY')

    safeDb.pendingSyncQueue.add({
      tableName,
      operation,
      recordId,
      supabaseId,
      payload:    JSON.stringify(record),
      timestamp:  Date.now(),
      retryCount: 0,
    }).then(() => {
      this.scheduleDrain()
    }).catch(() => {
      // Queue write failed — non-fatal; the mutation is safe in IndexedDB
    })
  }

  /**
   * Debounced drain scheduler. Coalesces rapid successive mutations into
   * a single reconciliation pass after DRAIN_DEBOUNCE_MS of inactivity.
   * Pass `delayMs = 0` to drain immediately (e.g. on network restore).
   */
  private scheduleDrain(delayMs = DRAIN_DEBOUNCE_MS): void {
    if (this._drainTimer !== null) clearTimeout(this._drainTimer)
    this._drainTimer = setTimeout(() => {
      this._drainTimer = null
      this.reconcileLocalToCloud().catch(() => {})
    }, delayMs)
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — DEDUPLICATION (LAST-WRITE-WINS)
     ════════════════════════════════════════════════════════ */

  /**
   * Collapses the ordered queue into a deduplicated set by supabaseId:
   *   • Among multiple upserts for the same ID: keep the latest timestamp.
   *   • A delete always supersedes any upsert for the same ID.
   *
   * This prevents sending N upserts for the same record when the user
   * types quickly or saves multiple times in a short window.
   */
  private deduplicateQueue(
    items: PendingSyncQueueItem[],
  ): PendingSyncQueueItem[] {
    const map = new Map<string, PendingSyncQueueItem>()

    for (const item of items) {
      const key      = `${item.tableName}:${item.supabaseId}`
      const existing = map.get(key)

      if (!existing) {
        map.set(key, item)
        continue
      }

      // Delete beats any upsert
      if (item.operation === 'delete') {
        map.set(key, item)
        continue
      }

      // Among upserts: most recent timestamp wins
      if (existing.operation !== 'delete' && item.timestamp > existing.timestamp) {
        map.set(key, item)
      }
    }

    return Array.from(map.values())
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — CLOUD FLUSH
     ════════════════════════════════════════════════════════ */

  private async flushToCloud(
    userId: string,
    items:  PendingSyncQueueItem[],
  ): Promise<{ syncedIds: number[]; failedIds: number[] }> {
    const syncedIds: number[] = []
    const failedIds: number[] = []

    for (const item of items) {
      // Silently retire items that have exhausted their retry budget
      if (item.retryCount >= MAX_RETRIES) {
        console.warn('[ZenithSync] Retiring item after max retries:', {
          table:      item.tableName,
          operation:  item.operation,
          supabaseId: item.supabaseId,
        })
        syncedIds.push(item.id!)
        continue
      }

      try {
        if (item.tableName === 'userProfile') {
          await this.syncUserProfile(userId, item)
        } else if (item.tableName === 'assignments') {
          if (item.operation === 'upsert') {
            await this.syncAssignmentUpsert(userId, item)
          } else {
            await this.syncAssignmentDelete(userId, item)
          }
        }
        syncedIds.push(item.id!)
      } catch (err) {
        console.warn(`[ZenithSync] Item ${item.id} failed:`, err)
        failedIds.push(item.id!)
      }
    }

    return { syncedIds, failedIds }
  }

  /* ── userProfile sync ───────────────────────────────────── */

  /**
   * Upserts the user profile to `supabase_user_profiles`.
   *
   * Last-Write-Wins conflict resolution:
   *   Fetch the remote row's `updated_at`. If the remote timestamp is
   *   strictly newer than our local write timestamp, skip the upload —
   *   the remote state is more recent (e.g. edited from another device).
   *   The local record will be refreshed in the upcoming Phase 2.3 pull pass.
   */
  private async syncUserProfile(
    userId: string,
    item:   PendingSyncQueueItem,
  ): Promise<void> {
    const supabase = getSupabaseClient()!
    const record   = JSON.parse(item.payload) as UserProfile

    // ── LWW check: is the remote row newer than our local change? ──
    const { data: remote } = await supabase
      .from('supabase_user_profiles')
      .select('updated_at')
      .eq('id', userId)
      .maybeSingle()

    if (remote?.updated_at) {
      const remoteTs = new Date(remote.updated_at).getTime()
      if (remoteTs > item.timestamp) {
        // Remote is ahead — skip this upload to avoid overwriting newer data
        return
      }
    }

    const { error } = await supabase
      .from('supabase_user_profiles')
      .upsert(
        {
          id:               userId,
          user_name:        record.userName,
          university_name:  record.universityName,
          major_identifier: record.majorIdentifier,
          current_level:    record.currentLevel,
          exp_points:       record.expPoints,
          health_points:    record.healthPoints,
          // `updated_at` is managed by the DB trigger — never set it manually
        },
        { onConflict: 'id' },
      )

    if (error) throw error
  }

  /* ── assignment upsert ──────────────────────────────────── */

  private async syncAssignmentUpsert(
    userId: string,
    item:   PendingSyncQueueItem,
  ): Promise<void> {
    const supabase = getSupabaseClient()!
    const record   = JSON.parse(item.payload) as Assignment

    // Convert local ISO date string to full timestamptz for Postgres
    const dueDate = record.dueDate
      ? new Date(record.dueDate).toISOString()
      : null

    const { error } = await supabase
      .from('supabase_urgent_tasks')
      .upsert(
        {
          id:         item.supabaseId,
          user_id:    userId,
          title:      record.title,
          due_date:   dueDate,
          course_id:  record.courseId,
          status:     record.status,
          priority:   record.priority,
          created_at: new Date(record.createdAt).toISOString(),
        },
        { onConflict: 'id' },
      )

    if (error) throw error
  }

  /* ── assignment delete ──────────────────────────────────── */

  private async syncAssignmentDelete(
    userId: string,
    item:   PendingSyncQueueItem,
  ): Promise<void> {
    const supabase = getSupabaseClient()!

    const { error } = await supabase
      .from('supabase_urgent_tasks')
      .delete()
      .eq('id', item.supabaseId)
      .eq('user_id', userId)    // belt-and-suspenders alongside RLS policy

    if (error) throw error
  }

  /* ── retry counter ──────────────────────────────────────── */

  private async incrementRetries(ids: number[]): Promise<void> {
    const safeDb = db as typeof db | null
    if (!safeDb) return

    await Promise.all(
      ids.map(id =>
        safeDb.pendingSyncQueue
          .where('id').equals(id)
          .modify(item => { item.retryCount += 1 })
      ),
    )
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — NETWORK LISTENERS
     ════════════════════════════════════════════════════════ */

  private setupNetworkListeners(): void {
    window.addEventListener('online',  this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  private readonly handleOnline = (): void => {
    // Immediate drain — network just came back
    if (this._status === 'OFFLINE_QUEUED' || this._status === 'SAVED_LOCALLY') {
      this.scheduleDrain(0)
    }
  }

  private readonly handleOffline = (): void => {
    this.emit('OFFLINE_QUEUED')
  }

  /* ════════════════════════════════════════════════════════
     PRIVATE — STATUS EMITTER
     ════════════════════════════════════════════════════════ */

  private emit(status: SyncStatus): void {
    if (this._status === status) return  // no-op if unchanged
    this._status = status
    this._listeners.forEach(fn => fn(status))
  }
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */

function isUrgent(priority: string | undefined): boolean {
  return priority === 'high' || priority === 'critical'
}
