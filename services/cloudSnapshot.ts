/**
 * cloudSnapshot.ts — Whole-Database Cloud Snapshot
 *
 * Each browser profile owns an isolated IndexedDB, so the same person running
 * two Edge profiles (school / personal) ends up with two divergent copies of
 * ZenithOS. The per-table sync broker only mirrors 4 of ~44 tables — far too
 * little to make a profile switch feel seamless.
 *
 * This module instead pushes the ENTIRE local database as a single row in
 * Supabase (`zenith_snapshots`, one row per auth user), using the exact same
 * MasterBackupPayload envelope as the "Eject Button" JSON backup.
 *
 * Conflict policy: LAST-WRITE-WINS. The user works in one profile at a time on
 * one laptop, so the newest snapshot is authoritative. The React controller
 * (lib/hooks/useCloudSnapshot.ts) refuses to auto-pull over unpushed local
 * edits and raises an explicit conflict instead.
 *
 * Design contract:
 *   - Browser-only. Every export guards `typeof window` and returns a typed
 *     error result rather than throwing.
 *   - Zero React imports — this is a pure service module.
 *   - Requires a REAL Supabase session. The local-only "Continue offline"
 *     session has no auth.uid() and cannot satisfy the RLS policies.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { buildBackupPayload }                      from '@/utils/dbExporter'
import { importJsonToLocalDatabase }               from '@/utils/dbImporter'

/* ── Constants ────────────────────────────────────────────────────── */

const SNAPSHOT_TABLE = 'zenith_snapshots'

/** localStorage key holding this browser profile's sync watermark. */
export const SNAPSHOT_META_KEY = 'zenith_snapshot_meta_v1'

/**
 * Soft ceiling for the serialised payload. Postgres jsonb handles far more
 * (TOAST-compressed), but past this size the push starts to feel slow and it
 * usually signals runaway table growth worth investigating.
 */
const PAYLOAD_WARN_BYTES = 4 * 1024 * 1024

/* ── Result types ─────────────────────────────────────────────────── */

export type SnapshotResult = {
  ok:         boolean
  /** Server-authoritative `updated_at` of the snapshot row after the op. */
  updatedAt?: string
  error?:     string
}

export type RemoteSnapshotMeta = {
  updatedAt:   string
  deviceLabel: string | null
}

/** This profile's view of the sync state — persisted in localStorage. */
export type SnapshotMeta = {
  /** Remote `updated_at` that this profile last pushed OR pulled. */
  lastSyncedAt:      string | null
  /** Unix ms of the most recent local DB mutation observed in this profile. */
  lastLocalChangeAt: number | null
}

const EMPTY_META: SnapshotMeta = {
  lastSyncedAt:      null,
  lastLocalChangeAt: null,
}

/**
 * In-memory mirror of the newest local-change stamp.
 *
 * Dexie's creating/updating/deleting hooks fire once PER ROW, so a bulkPut of a
 * thousand rows would otherwise mean a thousand localStorage writes. The
 * throttle below persists at most once per second, and this volatile stamp
 * keeps the in-process view exact in between flushes.
 */
let _volatileChangeAt: number | null = null
let _lastMarkFlush = 0
const MARK_THROTTLE_MS = 1_000

/* ══════════════════════════════════════════════════════════════════
   §1 — Local meta (localStorage watermark)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Reads this browser profile's sync watermark. Always returns a valid object;
 * malformed or absent storage degrades to EMPTY_META.
 */
export function getSnapshotMeta(): SnapshotMeta {
  if (typeof window === 'undefined') return { ...EMPTY_META }
  try {
    const raw = localStorage.getItem(SNAPSHOT_META_KEY)
    if (!raw) return { ...EMPTY_META }
    const parsed = JSON.parse(raw) as Partial<SnapshotMeta>
    const stored =
      typeof parsed.lastLocalChangeAt === 'number' ? parsed.lastLocalChangeAt : null
    return {
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      /* The volatile stamp wins while a throttled flush is still pending. */
      lastLocalChangeAt: Math.max(stored ?? 0, _volatileChangeAt ?? 0) || null,
    }
  } catch {
    return { ...EMPTY_META }
  }
}

/** Shallow-merges a patch into the stored watermark. */
export function setSnapshotMeta(patch: Partial<SnapshotMeta>): SnapshotMeta {
  /* Explicitly clearing the change stamp must also drop the volatile mirror,
     otherwise getSnapshotMeta() would immediately resurrect it. */
  if ('lastLocalChangeAt' in patch && patch.lastLocalChangeAt == null) {
    _volatileChangeAt = null
  }

  const next: SnapshotMeta = { ...getSnapshotMeta(), ...patch }
  if (typeof window === 'undefined') return next
  try {
    localStorage.setItem(SNAPSHOT_META_KEY, JSON.stringify(next))
  } catch {
    /* Quota or private-mode failure is non-fatal — sync still works, it
       just re-evaluates from scratch on the next load. */
  }
  return next
}

/**
 * Stamps `lastLocalChangeAt = Date.now()` and emits `zenith:db-changed` so the
 * React controller can schedule a debounced auto-push.
 *
 * Called by the Dexie change tracker below; also safe to call manually from any
 * code path that mutates non-Dexie persisted state worth snapshotting.
 */
export function markLocalChange(): void {
  if (typeof window === 'undefined') return

  const now = Date.now()
  _volatileChangeAt = now

  /* Throttled persistence — a burst of row-level hooks costs one write. */
  if (now - _lastMarkFlush < MARK_THROTTLE_MS) return
  _lastMarkFlush = now

  setSnapshotMeta({ lastLocalChangeAt: now })
  window.dispatchEvent(new CustomEvent('zenith:db-changed'))
}

/**
 * True when this profile has local mutations that were never pushed.
 * Compares the local change stamp against the remote watermark we last synced.
 */
export function hasUnpushedLocalChanges(meta: SnapshotMeta = getSnapshotMeta()): boolean {
  if (meta.lastLocalChangeAt == null) return false
  if (!meta.lastSyncedAt)             return true
  const syncedMs = Date.parse(meta.lastSyncedAt)
  if (Number.isNaN(syncedMs))         return true
  return meta.lastLocalChangeAt > syncedMs
}

/**
 * Tables that exist in a brand-new profile even though the user has never
 * entered anything: transient sync queues, plus the auto-seeded userProfile
 * singleton. They must not count as "this profile has real data".
 */
const NON_USER_TABLES: ReadonlySet<string> = new Set([
  'pendingSyncQueue',
  'outboxMutations',
  'userProfile',
])

/**
 * True when this profile contains user-authored data.
 *
 * This is the safety gate for the very first run of the feature: a profile that
 * has been used for months but has no sync watermark yet must never be silently
 * replaced by an auto-pull. Counts stop at the first non-empty table, so the
 * common case is one IDB count().
 */
export async function hasMeaningfulLocalData(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const { db } = await import('@/lib/db')
    if (!db) return false
    for (const table of db.tables) {
      if (NON_USER_TABLES.has(table.name)) continue
      if ((await table.count()) > 0) return true
    }
    return false
  } catch {
    /* Unreadable DB — assume data exists so the conflict path is taken
       rather than the destructive auto-pull path. */
    return true
  }
}

/* ══════════════════════════════════════════════════════════════════
   §2 — Dexie change tracking
   ══════════════════════════════════════════════════════════════════ */

let _trackingStarted = false

/**
 * Registers creating/updating/deleting hooks on every Dexie table so any write
 * anywhere in the app stamps the local-change watermark.
 *
 * Dexie has no built-in global change stream without the Observable addon, so
 * this per-table hook registration is the lightweight equivalent. The hook body
 * is a single localStorage write plus an event dispatch — the debounce lives in
 * the React controller, so bursts of writes never cause bursts of pushes.
 *
 * Idempotent: repeated calls are ignored.
 */
export function startSnapshotChangeTracking(): void {
  if (typeof window === 'undefined' || _trackingStarted) return

  /* Dynamic import keeps the Dexie instance off the SSR module graph. */
  void import('@/lib/db').then(({ db }) => {
    if (_trackingStarted || !db) return
    _trackingStarted = true

    for (const table of db.tables) {
      /*
       * Queue tables churn constantly as a *side effect* of syncing; treating
       * their writes as user changes would keep the profile permanently dirty.
       */
      if (table.name === 'pendingSyncQueue' || table.name === 'outboxMutations') {
        continue
      }
      try {
        table.hook('creating', () => { markLocalChange() })
        table.hook('updating', () => { markLocalChange(); return undefined })
        table.hook('deleting', () => { markLocalChange() })
      } catch {
        /* A table that refuses hooks is non-fatal — the periodic dirty-check
           in the controller still catches it on the next visibility change. */
      }
    }
  }).catch(() => { /* db unavailable — snapshot stays manual-only */ })
}

/* ══════════════════════════════════════════════════════════════════
   §3 — Identity guards
   ══════════════════════════════════════════════════════════════════ */

/**
 * Resolves the signed-in Supabase user id, or null when Supabase is not
 * configured / the session is the local-only offline mock.
 */
async function resolveUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

/**
 * True when cloud snapshots can actually run: Supabase configured AND a real
 * Supabase user is signed in.
 */
export async function isSnapshotAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!isSupabaseConfigured)         return false
  return (await resolveUserId()) !== null
}

/** Human-readable reason snapshots are unavailable, or null when available. */
export async function getUnavailableReason(): Promise<string | null> {
  if (typeof window === 'undefined') return 'Not available during server render.'
  if (!isSupabaseConfigured) {
    return 'Cloud is not configured for this build — no Supabase project keys are set.'
  }
  if ((await resolveUserId()) === null) {
    return 'Sign in with an account to use cloud snapshots. Offline sessions stay on this device.'
  }
  return null
}

/* ── Device label ─────────────────────────────────────────────────── */

/**
 * Best-effort "which browser wrote this" hint, e.g. "Edge · Windows".
 * Display-only — never used for routing or access control.
 */
function resolveDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device'
  const ua = navigator.userAgent

  let browser = 'Browser'
  if      (/Edg\//.test(ua))                       browser = 'Edge'
  else if (/OPR\//.test(ua))                       browser = 'Opera'
  else if (/Firefox\//.test(ua))                   browser = 'Firefox'
  else if (/Chrome\//.test(ua))                    browser = 'Chrome'
  else if (/Safari\//.test(ua))                    browser = 'Safari'

  let platform = 'Unknown OS'
  if      (/Windows/.test(ua))                     platform = 'Windows'
  else if (/Mac OS X|Macintosh/.test(ua))          platform = 'macOS'
  else if (/Android/.test(ua))                     platform = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua))            platform = 'iOS'
  else if (/Linux/.test(ua))                       platform = 'Linux'

  return `${browser} · ${platform}`
}

/* ══════════════════════════════════════════════════════════════════
   §4 — Push
   ══════════════════════════════════════════════════════════════════ */

/**
 * Serialises the entire local database and upserts it as this account's single
 * snapshot row. On success the server's `updated_at` becomes this profile's new
 * sync watermark and the local-change flag is cleared.
 */
export async function pushSnapshot(): Promise<SnapshotResult> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { ok: false, error: 'Cloud is not configured for this build.' }
  }

  const userId = await resolveUserId()
  if (!userId) {
    return { ok: false, error: 'Sign in with an account to save to the cloud.' }
  }

  /*
   * Snapshot the dirty stamp BEFORE reading the database. If the user writes
   * again while the upload is in flight, that newer edit is not represented in
   * the uploaded payload — so the profile must stay dirty rather than be marked
   * clean, or the change would silently never reach the cloud.
   */
  const stampAtCapture = getSnapshotMeta().lastLocalChangeAt

  let payload
  try {
    payload = await buildBackupPayload()
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Could not read the local database.' }
  }

  /* ── Size telemetry ─────────────────────────────────────────── */
  try {
    const bytes = new Blob([JSON.stringify(payload)]).size
    if (bytes > PAYLOAD_WARN_BYTES) {
      console.warn(
        `[cloudSnapshot] Snapshot payload is ${(bytes / 1024 / 1024).toFixed(2)} MB. ` +
        'Postgres jsonb handles this fine, but pushes will get slower — consider ' +
        'pruning large tables.',
      )
    }
  } catch {
    /* Blob sizing is diagnostic only — never block the push on it. */
  }

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .upsert(
      {
        user_id:        userId,
        payload,
        schema_version: payload.schemaVersion,
        device_label:   resolveDeviceLabel(),
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('updated_at')
    .single()

  if (error) {
    return { ok: false, error: describeError(error.message) }
  }

  const updatedAt = (data as { updated_at: string } | null)?.updated_at
    ?? new Date().toISOString()

  /*
   * Clearing lastLocalChangeAt marks this profile clean: everything local is
   * now represented in the cloud row identified by `updatedAt`. If a write
   * landed mid-upload the stamp has moved on — keep it, so the next debounce
   * pushes that edit too.
   */
  const stampNow = getSnapshotMeta().lastLocalChangeAt
  setSnapshotMeta({
    lastSyncedAt:      updatedAt,
    lastLocalChangeAt: stampNow === stampAtCapture ? null : stampNow,
  })

  return { ok: true, updatedAt }
}

/* ══════════════════════════════════════════════════════════════════
   §5 — Pull
   ══════════════════════════════════════════════════════════════════ */

/**
 * Downloads this account's snapshot and REPLACES the local database with it.
 *
 * The importer clears every table before repopulating (and skips the transient
 * sync-queue tables), then dispatches `zenith:db-restored` so live views and
 * localStorage mirrors can react.
 */
export async function pullSnapshot(): Promise<SnapshotResult> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { ok: false, error: 'Cloud is not configured for this build.' }
  }

  const userId = await resolveUserId()
  if (!userId) {
    return { ok: false, error: 'Sign in with an account to load from the cloud.' }
  }

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: describeError(error.message) }
  }
  if (!data) {
    return {
      ok:    false,
      error: 'No cloud snapshot yet — save this profile to the cloud first.',
    }
  }

  const row = data as { payload: unknown; updated_at: string }
  if (!row.payload || typeof row.payload !== 'object') {
    return { ok: false, error: 'The cloud snapshot is empty or unreadable.' }
  }

  try {
    /*
     * The importer takes a JSON string (it is shared with the file-restore
     * path), so the jsonb object is re-serialised here. Round-tripping through
     * JSON also strips any non-cloneable values before they reach IndexedDB.
     */
    await importJsonToLocalDatabase(JSON.stringify(row.payload))
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Restore failed.' }
  }

  /* Local now mirrors the remote row exactly — clean watermark. */
  setSnapshotMeta({ lastSyncedAt: row.updated_at, lastLocalChangeAt: null })

  return { ok: true, updatedAt: row.updated_at }
}

/* ══════════════════════════════════════════════════════════════════
   §6 — Remote metadata probe
   ══════════════════════════════════════════════════════════════════ */

/**
 * Cheap "is the cloud newer than me?" probe — selects only the two metadata
 * columns and never touches the (potentially large) payload.
 *
 * Returns null when unavailable or when no snapshot exists yet.
 */
export async function getRemoteMeta(): Promise<RemoteSnapshotMeta | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const userId = await resolveUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('updated_at, device_label')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as { updated_at: string; device_label: string | null }
  return { updatedAt: row.updated_at, deviceLabel: row.device_label ?? null }
}

/* ══════════════════════════════════════════════════════════════════
   §7 — Helpers
   ══════════════════════════════════════════════════════════════════ */

/**
 * Turns raw PostgREST failures into something a user can act on. The most
 * common one by far is a missing table (migration not run yet).
 */
function describeError(message: string): string {
  const m = message || 'Unknown cloud error.'
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m)) {
    return 'The cloud snapshot table is missing — run the zenith_snapshots migration in your Supabase project.'
  }
  if (/JWT|not authenticated|permission denied|row-level security/i.test(m)) {
    return 'Cloud rejected the request — sign out and back in, then try again.'
  }
  return m
}

/** True when `remoteUpdatedAt` is strictly newer than the local watermark. */
export function isRemoteNewer(
  remoteUpdatedAt: string,
  meta: SnapshotMeta = getSnapshotMeta(),
): boolean {
  const remoteMs = Date.parse(remoteUpdatedAt)
  if (Number.isNaN(remoteMs)) return false
  if (!meta.lastSyncedAt)     return true
  const localMs = Date.parse(meta.lastSyncedAt)
  if (Number.isNaN(localMs))  return true
  return remoteMs > localMs
}
