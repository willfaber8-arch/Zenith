/**
 * utils/dbSnapshots.ts — a copy of yesterday, taken without being asked.
 *
 * The export button already existed and works, but it only helps someone
 * who remembered to press it — and the people who most need a way back
 * are exactly the ones who did not. A restore replaces everything, a
 * mass delete is quick, and neither leaves anything behind.
 *
 * So a snapshot is taken quietly, at most once a day, and the last few
 * are kept. It is not a backup: it lives in the same IndexedDB as the
 * data it copies, so it survives a mistake but not a lost laptop. The
 * export is still the thing to use for that, and the UI says so rather
 * than letting this look like more protection than it is.
 */

import { db } from '@/lib/db'
import { buildBackupPayload } from '@/utils/dbExporter'
import { importJsonToLocalDatabase } from '@/utils/dbImporter'

/** How many to keep. Enough to step back past a bad day, not a month. */
export const KEEP_SNAPSHOTS = 3

/** At most one a day — this copies the whole database. */
export const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Above this, the snapshot is skipped rather than taken.
 *
 * Three copies of a very large database in the same storage the app
 * needs to keep working is a way to run a browser out of quota, and the
 * failure mode there is writes silently starting to fail — much worse
 * than not having a snapshot.
 */
export const MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024

export interface SnapshotInfo {
  id:            string
  takenAt:       number
  rowCount:      number
  schemaVersion: number
  bytes:         number
}

export type TakeResult =
  | { taken: true;  info: SnapshotInfo }
  | { taken: false; reason: 'too-soon' | 'too-large' | 'unavailable' }

function newId(): string {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Newest first. Payloads are not read — only what is needed to list them. */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  if (!db) return []
  const rows = await db.db_snapshots.orderBy('takenAt').reverse().toArray()
  return rows.map(r => ({
    id: r.id, takenAt: r.takenAt, rowCount: r.rowCount,
    schemaVersion: r.schemaVersion, bytes: r.payload.length,
  }))
}

/**
 * Takes one, unless it is too soon since the last or the database is
 * too big to copy safely.
 *
 * `force` is for the button in Settings — "take one now" should take one
 * now, whatever the schedule says.
 */
export async function takeSnapshot(opts: { force?: boolean } = {}): Promise<TakeResult> {
  if (!db) return { taken: false, reason: 'unavailable' }

  if (!opts.force) {
    const newest = await db.db_snapshots.orderBy('takenAt').reverse().first()
    if (newest && Date.now() - newest.takenAt < SNAPSHOT_INTERVAL_MS) {
      return { taken: false, reason: 'too-soon' }
    }
  }

  /*
   * `buildBackupPayload` already leaves `db_snapshots` out — without
   * that, each snapshot would contain every previous one and the size
   * would compound: the third holding the second, holding the first.
   */
  const payload = await buildBackupPayload()
  const tables = payload.tables
  const serialised = JSON.stringify(payload)

  if (serialised.length > MAX_SNAPSHOT_BYTES) {
    return { taken: false, reason: 'too-large' }
  }

  const rowCount = Object.values(tables)
    .reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0)

  const row = {
    id: newId(), takenAt: Date.now(), schemaVersion: payload.schemaVersion,
    rowCount, payload: serialised,
  }
  await db.db_snapshots.put(row)
  await pruneSnapshots()

  return {
    taken: true,
    info: { id: row.id, takenAt: row.takenAt, rowCount, schemaVersion: row.schemaVersion, bytes: serialised.length },
  }
}

/** Drops all but the newest `KEEP_SNAPSHOTS`. */
export async function pruneSnapshots(keep = KEEP_SNAPSHOTS): Promise<number> {
  if (!db) return 0
  const all = await db.db_snapshots.orderBy('takenAt').reverse().toArray()
  const doomed = all.slice(keep).map(r => r.id)
  if (doomed.length > 0) await db.db_snapshots.bulkDelete(doomed)
  return doomed.length
}

/**
 * Puts a snapshot back.
 *
 * Goes through the same restore path as a backup file, so there is one
 * definition of what restoring means. It takes a fresh snapshot first:
 * restoring replaces everything, and the state you are leaving is
 * exactly what you will want if the snapshot turns out to be the wrong
 * one. A way back from the way back.
 */
export async function restoreSnapshot(id: string): Promise<{ restoredTables: string[] }> {
  if (!db) throw new Error('No database.')
  const row = await db.db_snapshots.get(id)
  if (!row) throw new Error('That snapshot is no longer here.')

  await takeSnapshot({ force: true })

  /* Read the payload again after the pre-restore snapshot: pruning may
     have run, and the row object in hand is a copy either way. */
  const payload = row.payload
  const result = await importJsonToLocalDatabase(payload)
  return { restoredTables: result.restoredTables }
}

export async function deleteSnapshot(id: string): Promise<void> {
  if (!db) return
  await db.db_snapshots.delete(id)
}
