/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Multi-Device Sync Conflict Entity Schemas
 * Phase 13 · Step 13.2 — Multi-Device Latency Replication & Conflict Auditing
 *
 * Provides the type layer that wraps any replicable IDB record with
 * deterministic state metadata, enabling Last-Write-Wins resolution
 * across concurrent browser/device sessions without centralized
 * coordination.
 *
 * Adoption guide:
 *   1. Wrap existing IDB record types: type SyncableAssignment = SyncableRecord<Assignment>
 *   2. Attach SyncMetadata via buildSyncMeta() (from utils/conflictResolver.ts) on every write.
 *   3. On inbound remote records, call resolveDataCollision() before writing to IDB.
 *   No schema migration is required — syncMeta is an application-layer field.
 * ════════════════════════════════════════════════════════════════
 */

/* ════════════════════════════════════════════════════════════════
   CORE METADATA BLOCK
   ════════════════════════════════════════════════════════════════ */

/**
 * State metadata block attached to every replicable IndexedDB record.
 *
 * Rules:
 *  • lastModifiedClientUuid — crypto.randomUUID() generated once per browser
 *    session; persisted in localStorage (zenith_client_uuid_v1) so it survives
 *    page reloads but is unique per physical device / browser profile.
 *  • updatedAtTimestamp — Date.now() captured at the moment of mutation.
 *    LWW resolution accuracy is bounded by the system clock (≥1ms on modern
 *    browsers). The UUID tie-breaker handles sub-millisecond conflicts.
 *  • versionCounter — incremented by 1 on every successful IDB write or
 *    conflict resolution. Provides an audit trail of total revision rounds.
 */
export type SyncMetadata = {
  /** Stable UUID identifying the originating browser/device session. */
  lastModifiedClientUuid: string
  /** High-resolution epoch timestamp (Date.now()) at the moment of mutation. */
  updatedAtTimestamp: number
  /**
   * Monotonically increasing integer — total revisions this record has survived.
   * During conflict resolution, bumped to max(local, remote) + 1 so both devices
   * converge on the same post-resolution version number.
   */
  versionCounter: number
}

/**
 * Wraps any record type T with the SyncMetadata tracking block.
 *
 * Examples:
 *   type SyncableAssignment  = SyncableRecord<Assignment>
 *   type SyncableHabit       = SyncableRecord<Habit>
 *   // Both equal: T & { syncMeta: SyncMetadata }
 *
 * The default generic parameter (Record<string, unknown>) allows use without
 * specifying T when the payload shape is not statically known (e.g. in the
 * generic conflict engine internals).
 */
export type SyncableRecord<
  T extends Record<string, unknown> = Record<string, unknown>,
> = T & { syncMeta: SyncMetadata }

/* ════════════════════════════════════════════════════════════════
   CONFLICT RESOLUTION CONTRACTS
   ════════════════════════════════════════════════════════════════ */

/**
 * Labelled outcome of a resolved LWW conflict event.
 *
 * LOCAL_WINS        — local updatedAtTimestamp > remote → local record stored
 * REMOTE_WINS       — remote updatedAtTimestamp > local → remote payload applied
 * TIE_BROKEN_LOCAL  — equal timestamps; local clientUuid > remote (lexicographic)
 * TIE_BROKEN_REMOTE — equal timestamps; remote clientUuid > local (lexicographic)
 *
 * The tie-breaker guarantees every device node converges to the SAME decision
 * with zero centralized coordination — a property of the LWW Element Set CRDT.
 */
export type ConflictOutcome =
  | 'LOCAL_WINS'
  | 'REMOTE_WINS'
  | 'TIE_BROKEN_LOCAL'
  | 'TIE_BROKEN_REMOTE'

/**
 * Full audit record for one resolved collision event.
 * Accumulated in-session by ConflictAuditPanel for real-time display.
 * Can be persisted to IDB for cross-session auditing if required.
 */
export interface CollisionEvent<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique event identifier (crypto.randomUUID()). */
  id: string
  /** Unix ms epoch when resolution was computed. */
  resolvedAt: number
  /** IDB table name the collision occurred on (for display). */
  tableName: string
  /** LWW algorithm outcome label. */
  outcome: ConflictOutcome
  /** Snapshot of the local record at collision time. */
  localRecord: SyncableRecord<T>
  /** Snapshot of the incoming remote record. */
  incomingRemoteRecord: SyncableRecord<T>
  /** The winning record (local or remote), with versionCounter bumped. */
  winnerRecord: SyncableRecord<T>
  /** Whether the alphabetical UUID tie-breaker was invoked. */
  tieBreakUsed: boolean
}

/**
 * Complete return value of resolveDataCollision<T>.
 * Contains everything needed for the database merge write and audit display.
 */
export interface ConflictResolutionResult<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Which side won the LWW election. */
  winner: 'local' | 'remote'
  /**
   * The winning record, with versionCounter set to
   * max(local.versionCounter, remote.versionCounter) + 1.
   * This is the exact payload to write back to IDB.
   */
  winnerRecord: SyncableRecord<T>
  /** Labelled outcome for audit trail. */
  outcome: ConflictOutcome
  /** Whether the deterministic UUID tie-breaker was invoked. */
  tieBreakUsed: boolean
  /** Metadata snapshot for display and debugging — no side effects. */
  delta: {
    localTimestamp:   number
    remoteTimestamp:  number
    localClientId:    string
    remoteClientId:   string
    /** Absolute millisecond difference between the two timestamps (always ≥ 0). */
    timestampDeltaMs: number
  }
}
