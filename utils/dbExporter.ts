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
import { gamesDb } from '@/lib/gamesDb'

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

  /* ── Added in format version 2 ──────────────────────────────────
   * All three optional, so a version 1 file still imports: the fields
   * are simply absent and the importer skips them.
   */

  /** ZenithGamesOS db.verno at export time. */
  gamesSchemaVersion?: number
  /**
   * The Arcade's database, which is a second Dexie instance entirely
   * (`ZenithGamesOS`). It was not in the backup at all, so credits,
   * resources, the biosphere, crucible jobs and the skill tree did not
   * survive a restore or reach another browser profile.
   */
  gamesTables?: { [tableName: string]: unknown[] }
  /**
   * Everything kept in localStorage under the `zenith_` prefix — which
   * is where nearly every customisation lives: the theme, widget
   * positions, sizes and order, dashboard presets, which nav items are
   * hidden, calendar hours, cube-timer options, and around a hundred
   * more. None of it was backed up, so "restore" gave you your data
   * back with someone else's settings.
   */
  settings?: { [key: string]: string }
}

const BACKUP_FORMAT_VERSION = 2

/** Only Zenith's own keys — the origin is shared with other software. */
export const SETTINGS_PREFIX = 'zenith_'

/**
 * Settings that must not travel between browser profiles or devices.
 *
 * Everything else under the prefix is a preference and belongs in the
 * backup. These two are facts about *this* browser:
 *
 *   zenith_snapshot_meta_v1 — this profile's cloud-sync watermark.
 *     Restoring another profile's would make this one believe it is in
 *     sync when it has never pushed, and the next pull would look like
 *     a conflict that is not there.
 *   zenith_session_active — who is signed in on this device.
 */
export const SETTINGS_EXCLUDED: ReadonlySet<string> = new Set([
  'zenith_snapshot_meta_v1',
  'zenith_session_active',
])

/**
 * Read the customisations out of localStorage.
 *
 * Enumerated by prefix rather than from a list of known keys: there are
 * well over a hundred of them and a hardcoded list would be missing the
 * newest one the day after it was written — which is exactly the kind
 * of gap that makes a backup quietly incomplete.
 */
export function collectSettings(): { [key: string]: string } {
  const out: { [key: string]: string } = {}
  if (typeof window === 'undefined') return out
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(SETTINGS_PREFIX)) continue
      if (SETTINGS_EXCLUDED.has(key)) continue
      const value = localStorage.getItem(key)
      if (value !== null) out[key] = value
    }
  } catch { /* storage unavailable — an empty set is honest */ }
  return out
}

/* ══════════════════════════════════════════════════════════════════
   buildBackupPayload
   ══════════════════════════════════════════════════════════════════ */

/**
 * Reads every registered Dexie table and returns the complete backup
 * envelope — WITHOUT touching the DOM or triggering a download.
 *
 * This is the shared serialisation core used by:
 *   • exportLocalDatabaseToJson()  → file download (Eject Button)
 *   • services/cloudSnapshot.ts    → Supabase whole-database snapshot
 *
 * Browser-only: must be called from an event handler, useEffect, or any
 * other client-side context — never during SSR.
 */
export async function buildBackupPayload(): Promise<MasterBackupPayload> {
  const tables: { [tableName: string]: unknown[] } = {}

  /*
   * db.tables returns every Table object registered via version().stores().
   * We iterate sequentially (not Promise.all) to avoid saturating the IDB
   * connection pool on large datasets; the sequential cost is negligible
   * since this is a one-shot user-triggered action.
   */
  for (const table of db.tables) {
    /*
     * The automatic local snapshots are left out of an exported file.
     * Each one already holds a copy of everything else, so including
     * them would put three near-complete copies of the database inside
     * a fourth — a file several times larger than the data it is
     * backing up, holding nothing the file does not already have.
     */
    if (table.name === 'db_snapshots') continue

    try {
      tables[table.name] = await table.toArray()
    } catch {
      /* A table failing (e.g., mid-upgrade) is non-fatal; record empty. */
      tables[table.name] = []
    }
  }

  /*
   * The Arcade lives in its own Dexie database. Reading it in the same
   * loop is not possible — different instance, different tables — so it
   * gets its own pass, guarded because a browser that has never opened
   * the Arcade has no such database to read.
   */
  const gamesTables: { [tableName: string]: unknown[] } = {}
  let gamesSchemaVersion = 0
  if (gamesDb) {
    gamesSchemaVersion = gamesDb.verno
    for (const table of gamesDb.tables) {
      try {
        gamesTables[table.name] = await table.toArray()
      } catch {
        gamesTables[table.name] = []
      }
    }
  }

  return {
    version:       BACKUP_FORMAT_VERSION,
    exportedAt:    Date.now(),
    schemaVersion: db.verno,
    tables,
    gamesSchemaVersion,
    gamesTables,
    settings:      collectSettings(),
  }
}

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
  const payload = await buildBackupPayload()

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
