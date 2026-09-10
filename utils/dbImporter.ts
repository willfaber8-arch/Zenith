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

/*
 * Tables left completely alone — neither cleared nor repopulated.
 *
 * `db_snapshots` holds the automatic local copies. Clearing it would
 * destroy the way back at the exact moment someone is using a way back:
 * restore the wrong snapshot and every other snapshot, including the
 * one taken seconds earlier as a safety net, would be gone with it.
 * They are recovery state rather than user data, so a restore has no
 * business touching them.
 */
const PRESERVE: ReadonlySet<string> = new Set([
  'db_snapshots',
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
   inspectBackup — read the file without touching the database
   ══════════════════════════════════════════════════════════════════ */

/** What a backup file contains, for showing before anything is replaced. */
export type BackupSummary = {
  /** When the backup was taken. */
  exportedAt:    number
  /** Schema version the backup was written at, when it recorded one. */
  schemaVersion: number | null
  /** Tables carrying at least one row. */
  tableCount:    number
  /** Rows across every table in the file. */
  rowCount:      number
  /** The largest tables, for a recognisable "yes, that's my data" check. */
  largest:       { name: string; rows: number }[]
}

/**
 * Parses and validates a backup, and describes what is in it.
 *
 * Restoring replaces everything: it clears every table before writing.
 * That is the correct behaviour for a restore and a catastrophic
 * behaviour for a misclick, and the two are indistinguishable at the
 * moment a file is chosen. Reading the file first means the question
 * "replace all of this with that?" can be asked with both halves
 * actually named, rather than being answered by the act of opening a
 * file picker.
 *
 * Throws the same human-readable errors as the restore itself, so a
 * malformed file is refused before anything is at risk rather than
 * after.
 */
export function inspectBackup(jsonString: string): BackupSummary {
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

  const tables = (payload as MasterBackupPayload).tables
  const counts = Object.entries(tables)
    .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
    .map(([name, rows]) => ({ name, rows: (rows as unknown[]).length }))
    .sort((a, b) => b.rows - a.rows)

  const raw = payload as MasterBackupPayload & { schemaVersion?: unknown }

  return {
    exportedAt:    raw.exportedAt,
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : null,
    tableCount:    counts.length,
    rowCount:      counts.reduce((n, c) => n + c.rows, 0),
    largest:       counts.slice(0, 4),
  }
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
      /* Step 0 — some tables are not part of a restore at all */
      if (PRESERVE.has(table.name)) continue

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
