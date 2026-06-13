/**
 * dbImporter.ts — Phase 15.1 · The "Eject Button" Restore Engine
 *
 * Atomic multi-table restore from a MasterBackupPayload JSON string.
 *
 * Design contract:
 *   - Validation gates run before any write to give a clear error message
 *     instead of a partial corrupt state.
 *   - The Dexie transaction locks ALL registered tables so no other tab
 *     can write while the restore is in progress.
 *   - Every table is cleared before bulkPut — prevents duplicate-key
 *     collisions from auto-increment tables whose IDB sequence doesn't
 *     reset on clear().
 *   - Transient queue tables (pendingSyncQueue, outboxMutations) are
 *     cleared but NOT restored — replaying stale outbox mutations post-
 *     restore would corrupt the sync engine's LWW state.
 *   - Dexie's useLiveQuery subscribers automatically re-query when their
 *     table changes — zero page reload needed.
 *   - A zenith:db-restored CustomEvent is dispatched for any non-Dexie
 *     state (localStorage mirrors, in-memory caches) to react to.
 */

import { db } from '@/lib/db'
import type { MasterBackupPayload } from './dbExporter'

/* ── Tables excluded from restore (cleared, not repopulated) ─────── */

/*
 * These tables contain ephemeral operational data.
 * - pendingSyncQueue: stale mutations would confuse the sync engine
 * - outboxMutations:  same — broker uses LWW timestamps
 * Clearing them on restore is safe; they'll refill naturally on next sync.
 */
const SKIP_RESTORE: ReadonlySet<string> = new Set([
  'pendingSyncQueue',
  'outboxMutations',
])

/* ── Return type ─────────────────────────────────────────────────── */

export type ImportResult = {
  /** Tables that were cleared and repopulated from the backup. */
  restoredTables:   string[]
  /** Tables cleared but not repopulated (transient queues or absent from backup). */
  clearedTables:    string[]
  /** Total row count written across all restored tables. */
  totalRowsWritten: number
}

/* ── Validation ──────────────────────────────────────────────────── */

function isValidPayload(data: unknown): data is MasterBackupPayload {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    typeof o.version   === 'number' &&
    typeof o.exportedAt === 'number' &&
    typeof o.tables    === 'object' &&
    o.tables !== null &&
    !Array.isArray(o.tables)
  )
}

/* ══════════════════════════════════════════════════════════════════
   importJsonToLocalDatabase
   ══════════════════════════════════════════════════════════════════ */

/**
 * Parses `jsonString`, validates the envelope, then atomically:
 *   1. Acquires a write-lock on all Dexie tables.
 *   2. Clears every table.
 *   3. Repopulates from backup data, skipping transient queue tables.
 *
 * Throws a human-readable Error on parse failure or schema mismatch.
 * On success returns an ImportResult summary.
 */
export async function importJsonToLocalDatabase(
  jsonString: string,
): Promise<ImportResult> {

  /* ── Parse ──────────────────────────────────────────────────── */
  let payload: unknown
  try {
    payload = JSON.parse(jsonString)
  } catch {
    throw new Error(
      'Could not parse file — make sure you selected a valid Zenith OS backup (.json).',
    )
  }

  if (!isValidPayload(payload)) {
    throw new Error(
      'File structure does not match the Zenith OS backup format. ' +
      'Expected { version, exportedAt, tables } — this file may be corrupted or from an incompatible source.',
    )
  }

  /* ── Build result accumulators ──────────────────────────────── */
  const restoredTables:   string[] = []
  const clearedTables:    string[] = []
  let   totalRowsWritten           = 0

  /* ── Atomic transaction across all tables ───────────────────── */
  /*
   * Passing db.tables (Table[]) as the second argument locks every
   * registered table for the duration of the callback.  This prevents
   * concurrent IDB writes from other tabs while the restore is in-flight.
   *
   * Execution order per table:
   *   1. clear()             — wipe existing rows + reset auto-increment
   *   2. bulkPut(rows)       — restore from backup (skipped for queues
   *                            and tables absent from the backup file)
   */
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      /* Step 1 — always clear, regardless of what the backup contains */
      await table.clear()

      /* Step 2 — transient queues: clear only, never repopulate */
      if (SKIP_RESTORE.has(table.name)) {
        clearedTables.push(table.name)
        continue
      }

      /* Step 3 — look up this table's rows in the backup payload */
      const rows = (payload as MasterBackupPayload).tables[table.name]

      if (!Array.isArray(rows)) {
        /*
         * Table not present in the backup (e.g., added in a later schema
         * version than when the backup was made).  It was already cleared
         * above — record it and move on.
         */
        clearedTables.push(table.name)
        continue
      }

      /* Step 4 — bulk-insert the backup rows */
      if (rows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (table as any).bulkPut(rows)
        totalRowsWritten += rows.length
      }

      restoredTables.push(table.name)
    }
  })

  /* ── Signal non-Dexie consumers ────────────────────────────── */
  /*
   * Dexie useLiveQuery hooks re-fire automatically after the transaction
   * commits.  This event lets any localStorage-mirrored state (e.g.,
   * zenith_vitality_v1, zenith_cozy_biome_v1) know a restore occurred.
   * Consumers can listen with: window.addEventListener('zenith:db-restored', ...)
   */
  window.dispatchEvent(new CustomEvent('zenith:db-restored'))

  return { restoredTables, clearedTables, totalRowsWritten }
}
