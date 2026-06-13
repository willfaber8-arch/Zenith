/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — LWW Conflict Resolution Engine
 * Phase 13 · Step 13.2 — Multi-Device Latency Replication & Conflict Auditing
 *
 * Implements the Last-Write-Wins (LWW) Element Set model for deterministic,
 * convergent conflict resolution across concurrent multi-device IndexedDB
 * mutations replicated via Supabase upserts and WebRTC data channels.
 *
 * Core invariant: given the SAME two colliding records, EVERY device in the
 * replication graph will independently arrive at the EXACT same winner with
 * zero centralized coordination. This is the fundamental safety property of
 * the LWW-Element-Set CRDT.
 *
 * Resolution priority chain (evaluated in order):
 *   1. updatedAtTimestamp — higher epoch wins unconditionally.
 *   2. lastModifiedClientUuid (lexicographic) — deterministic tie-breaker when
 *      timestamps match to the millisecond. Higher UUID string wins.
 *
 * Pure module: no React, no Dexie imports in the resolution algorithm.
 * applyWinnerToDatabase() accepts a DexieTableLike interface so the engine
 * remains framework-agnostic and fully testable in isolation.
 *
 * SSR-safe: all window/localStorage access is guarded.
 * ════════════════════════════════════════════════════════════════
 */

import type {
  SyncMetadata,
  SyncableRecord,
  ConflictOutcome,
  ConflictResolutionResult,
} from '@/types/syncConflict'

/* ════════════════════════════════════════════════════════════════
   CORE LWW ALGORITHM
   ════════════════════════════════════════════════════════════════ */

/**
 * Deterministic Last-Write-Wins conflict resolution.
 *
 * Accepts two colliding SyncableRecord instances and returns the canonical
 * winner along with a full audit delta. The function is PURE — it performs
 * no I/O, no side effects, and is safe to call from any context.
 *
 * @template T   The base record payload shape (without syncMeta).
 *
 * @param localRecord
 *   The version currently stored in local IndexedDB.
 *
 * @param incomingRemoteRecord
 *   The version arriving from a remote device via Supabase upsert or
 *   WebRTC DataChannel. Must carry syncMeta populated by the originating
 *   device at the time of its mutation.
 *
 * @returns
 *   ConflictResolutionResult containing:
 *   • winner          — 'local' | 'remote'
 *   • winnerRecord    — the winning payload with versionCounter bumped
 *   • outcome         — labelled ConflictOutcome for audit display
 *   • tieBreakUsed    — whether UUID tie-breaker was invoked
 *   • delta           — metadata snapshot for debugging
 */
export function resolveDataCollision<T extends Record<string, unknown>>(
  localRecord:          SyncableRecord<T>,
  incomingRemoteRecord: SyncableRecord<T>,
): ConflictResolutionResult<T> {

  const localTs  = localRecord.syncMeta.updatedAtTimestamp
  const remoteTs = incomingRemoteRecord.syncMeta.updatedAtTimestamp
  const localId  = localRecord.syncMeta.lastModifiedClientUuid
  const remoteId = incomingRemoteRecord.syncMeta.lastModifiedClientUuid

  let winner:       'local' | 'remote'
  let outcome:      ConflictOutcome
  let tieBreakUsed = false

  /* ── Condition 1: Timestamp evaluation ────────────────────────
     The record holding the higher numerical timestamp is the absolute
     winner. No further evaluation is required.                         */
  if (remoteTs > localTs) {
    winner  = 'remote'
    outcome = 'REMOTE_WINS'
  } else if (localTs > remoteTs) {
    winner  = 'local'
    outcome = 'LOCAL_WINS'
  } else {

    /* ── Condition 2: Deterministic UUID tie-breaker ─────────────
       Both records carry the SAME millisecond timestamp — a rare but
       valid scenario under concurrent writes on fast machines.

       Rule: incomingRemoteRecord wins if its clientUuid sorts AFTER
       localRecord's clientUuid in standard lexicographic order
       (String comparison, code-point by code-point).

       This rule is SYMMETRIC: every device evaluates the same two UUID
       strings and reaches the same outcome independently. No server
       involvement required.

       Edge case: identical UUIDs means the same device sent both records,
       which is a logic error in the caller. We protect local state.       */
    tieBreakUsed = true

    if (remoteId > localId) {
      winner  = 'remote'
      outcome = 'TIE_BROKEN_REMOTE'
    } else {
      winner  = 'local'
      outcome = 'TIE_BROKEN_LOCAL'
    }
  }

  /* ── Merge: build winner record with bumped versionCounter ────
     versionCounter takes the MAXIMUM of both sides (not just +1 from the
     winner) so a device that was many revisions behind always catches up
     to the highest-ever version number in one resolution step.           */
  const baseWinner = winner === 'remote' ? incomingRemoteRecord : localRecord

  const winnerRecord: SyncableRecord<T> = {
    ...baseWinner,
    syncMeta: {
      ...baseWinner.syncMeta,
      versionCounter: Math.max(
        localRecord.syncMeta.versionCounter,
        incomingRemoteRecord.syncMeta.versionCounter,
      ) + 1,
    },
  } as SyncableRecord<T>

  return {
    winner,
    winnerRecord,
    outcome,
    tieBreakUsed,
    delta: {
      localTimestamp:   localTs,
      remoteTimestamp:  remoteTs,
      localClientId:    localId,
      remoteClientId:   remoteId,
      timestampDeltaMs: Math.abs(remoteTs - localTs),
    },
  }
}

/* ════════════════════════════════════════════════════════════════
   DATABASE MERGE EXECUTOR
   ════════════════════════════════════════════════════════════════ */

/**
 * Minimal Dexie Table interface required by applyWinnerToDatabase.
 *
 * Any Dexie EntityTable<T, PK> satisfies this structurally.
 * Cast at the call site when needed:
 *   const table: DexieTableLike = db.assignments as unknown as DexieTableLike
 */
export interface DexieTableLike {
  update(
    key:     number | string,
    changes: Record<string, unknown>,
  ): Promise<number>
}

/**
 * Atomically applies the winning record's full payload (including the bumped
 * syncMeta.versionCounter) to IndexedDB using Dexie's .update() method.
 *
 * Only the fields on winnerRecord are touched — no surrounding rows are
 * modified. If the record key does not exist, Dexie returns 0 (no rows
 * updated); the caller should handle this as a no-op or a put() fallback.
 *
 * Usage:
 *   const result = resolveDataCollision(localAssignment, remoteAssignment)
 *   await applyWinnerToDatabase(
 *     db.assignments as unknown as DexieTableLike,
 *     localAssignment.id!,
 *     result.winnerRecord,
 *   )
 *
 * @param table        A DexieTableLike reference (e.g. db.assignments)
 * @param recordId     Primary key of the row to update (auto-increment int or UUID string)
 * @param winnerRecord The fully resolved winner from resolveDataCollision()
 * @returns            Number of rows updated (0 = key not found, 1 = success)
 */
export async function applyWinnerToDatabase<T extends Record<string, unknown>>(
  table:        DexieTableLike,
  recordId:     number | string,
  winnerRecord: SyncableRecord<T>,
): Promise<number> {
  return table.update(recordId, winnerRecord as Record<string, unknown>)
}

/* ════════════════════════════════════════════════════════════════
   CLIENT IDENTITY & SYNC-META UTILITIES
   ════════════════════════════════════════════════════════════════ */

/** localStorage key for the stable per-device client UUID. */
export const CLIENT_UUID_STORAGE_KEY = 'zenith_client_uuid_v1'

/**
 * Returns a stable UUID identifying this browser/device session.
 *
 * Generated once via crypto.randomUUID() on first call, then persisted to
 * localStorage so it survives page reloads. If localStorage is unavailable
 * (private browsing restrictions), a fresh UUID is returned each call —
 * this degrades tie-breaking consistency but does not break correctness
 * because the timestamp check (Condition 1) resolves the vast majority of
 * real conflicts.
 *
 * SSR-safe: returns an empty string on the server.
 */
export function getLocalClientId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const stored = window.localStorage.getItem(CLIENT_UUID_STORAGE_KEY)
    if (stored) return stored

    const fresh = crypto.randomUUID()
    window.localStorage.setItem(CLIENT_UUID_STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage blocked (e.g. strict Safari ITP in private mode)
    return crypto.randomUUID()
  }
}

/**
 * Constructs a fresh SyncMetadata block for a new or mutated record.
 *
 * Call this every time you write to IDB to ensure the metadata block stays
 * current. Pass the record's existing versionCounter as prevVersion so the
 * counter increments monotonically.
 *
 * @param prevVersion  The record's current versionCounter (omit or pass 0 for new records).
 * @returns            A SyncMetadata block ready to attach as { ...record, syncMeta }.
 */
export function buildSyncMeta(prevVersion = 0): SyncMetadata {
  return {
    lastModifiedClientUuid: getLocalClientId(),
    updatedAtTimestamp:     Date.now(),
    versionCounter:         prevVersion + 1,
  }
}
