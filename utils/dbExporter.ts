/**
 * dbExporter.ts — Phase 15.1 · The "Eject Button" Backup System
 *
 * Atomic serialisation engine for the ZenithOS IndexedDB database.
 *
 * Design contract:
 *   - Uses db.tables to enumerate tables dynamically — zero hardcoded
 *     table names, so new schema versions are included automatically.
 *   - Each table is read in its own async call so a single failing
 *     table never aborts the rest of the export.
 *   - The payload is wrapped in telemetry metadata for version-gating
 *     on import and for human-readable audit.
 *   - Download is triggered via a temporary <a> element; the Object URL
 *     is revoked 2 s later so the GC can collect the blob.
 */

import { db } from '@/lib/db'

/* ── Backup envelope ─────────────────────────────────────────────── */

export type MasterBackupPayload = {
  /** Backup format version — not the DB schema version. */
  version:       number
  /** Unix ms timestamp of export. */
  exportedAt:    number
  /** ZenithOS db.verno at export time — for informational display only. */
  schemaVersion: number
  /** Map of tableName → serialised row array for every registered table. */
  tables:        { [tableName: string]: unknown[] }
}

const BACKUP_FORMAT_VERSION = 1

/* ══════════════════════════════════════════════════════════════════
   exportLocalDatabaseToJson
   ══════════════════════════════════════════════════════════════════ */

/**
 * Reads every registered Dexie table, packages the rows into a single
 * JSON archive, and triggers a file download named:
 *   zenith_os_backup_YYYY_MM_DD.json
 *
 * Call from a browser event handler only — never in SSR or useEffect
 * without an explicit client-side guard.
 */
export async function exportLocalDatabaseToJson(): Promise<void> {
  const tables: { [tableName: string]: unknown[] } = {}

  /*
   * db.tables returns every Table object registered via version().stores().
   * We iterate sequentially (not Promise.all) to avoid saturating the IDB
   * connection pool on large datasets; the sequential cost is negligible
   * since this is a one-shot user-triggered action.
   */
  for (const table of db.tables) {
    try {
      tables[table.name] = await table.toArray()
    } catch {
      /* A table failing (e.g., mid-upgrade) is non-fatal; record empty. */
      tables[table.name] = []
    }
  }

  const payload: MasterBackupPayload = {
    version:       BACKUP_FORMAT_VERSION,
    exportedAt:    Date.now(),
    schemaVersion: db.verno,
    tables,
  }

  /* ── Serialise ──────────────────────────────────────────────── */
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)

  /* ── Filename: zenith_os_backup_YYYY_MM_DD.json ─────────────── */
  const now      = new Date()
  const yyyy     = now.getFullYear()
  const mm       = String(now.getMonth() + 1).padStart(2, '0')
  const dd       = String(now.getDate()).padStart(2, '0')
  const filename = `zenith_os_backup_${yyyy}_${mm}_${dd}.json`

  /* ── Trigger download ───────────────────────────────────────── */
  const anchor      = document.createElement('a')
  anchor.href       = url
  anchor.download   = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  /*
   * Revoke after a short delay — the browser needs a tick to start the
   * download stream before the blob reference is invalidated.
   */
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
}
