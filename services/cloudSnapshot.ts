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
import { buildBackupPayload, collectSettings }     from '@/utils/dbExporter'
import { importJsonToLocalDatabase }               from '@/utils/dbImporter'
import { storeSafetyCopy }                         from '@/utils/dbSnapshots'

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

/**
 * Why a sync step refused to run — each one a safeguard, never an error.
 *
 *   conflict         The cloud changed since this device last synced, and
 *                    this device has changes of its own. Writing would
 *                    replace the other device's work; loading would
 *                    replace this one's. Only the user can choose.
 *   account-mismatch This device's data belongs to a different account
 *                    than the one signed in. Syncing would copy one
 *                    person's workspace into another's.
 *   outdated-app     The cloud copy was written by a newer Zenith than the
 *                    one running here. This copy does not know that
 *                    version's tables, so saving from it would drop them.
 *   mass-deletion    Saving now would shrink the cloud copy drastically —
 *                    what cleared browser storage or a bad import looks
 *                    like. Held until the user confirms it is intended.
 *   no-backup        A safety copy could not be made before replacing this
 *                    device's data, so the replacement did not happen.
 *   busy             Another tab of this browser is already syncing.
 */
export type SyncBlock =
  | 'conflict'
  | 'account-mismatch'
  | 'outdated-app'
  | 'mass-deletion'
  | 'no-backup'
  | 'busy'

export type SnapshotResult = {
  ok:         boolean
  /** Server-authoritative `updated_at` of the snapshot row after the op. */
  updatedAt?: string
  error?:     string
  /** Set when a safeguard stopped the operation. `ok` is false. */
  blocked?:   SyncBlock
}

export type RemoteSnapshotMeta = {
  updatedAt:     string
  deviceLabel:   string | null
  /** Dexie schema version of the app that wrote it. */
  schemaVersion: number | null
  /**
   * False when the copy was written before secrets were stripped, and so
   * may still contain API keys. Optional so older callers and fixtures
   * that do not set it read as "unknown", never as "leaky".
   */
  secretsStripped?: boolean
}

/** This profile's view of the sync state — persisted in localStorage. */
export type SnapshotMeta = {
  /** Remote `updated_at` that this profile last pushed OR pulled. */
  lastSyncedAt:      string | null
  /** Unix ms of the most recent local DB mutation observed in this profile. */
  lastLocalChangeAt: number | null
  /**
   * Fingerprint of the customisations as they were at the last sync.
   *
   * Dexie hooks catch database edits, but nearly every customisation —
   * the theme, widget layout, hidden nav items, calendar hours — lives
   * in localStorage, which has no hook to fire. Changing only a setting
   * left the profile looking clean, so a push never ran and the setting
   * never reached the cloud however many times you changed it.
   *
   * Comparing a fingerprint on demand catches that without intercepting
   * every write to localStorage.
   */
  settingsFingerprint: string | null
  /**
   * The account this device's data was last synced with.
   *
   * Local data outlives a sign-out — Zenith is local-first — so without
   * this, whoever signed in next on the same browser would have the
   * previous person's workspace pushed into their account, or theirs
   * pulled over it. Sync refuses while the two disagree.
   */
  ownerUserId?:        string | null
  /** Rows in the copy last pushed or pulled, for the mass-deletion guard. */
  lastSyncedRowCount?: number | null
}

const EMPTY_META: SnapshotMeta = {
  lastSyncedAt:        null,
  lastLocalChangeAt:   null,
  settingsFingerprint: null,
  ownerUserId:         null,
  lastSyncedRowCount:  null,
}

/**
 * A cheap, stable hash of every backed-up setting.
 *
 * Stored rather than the settings themselves: the point is only to tell
 * "same as at last sync" from "different", and keeping a second copy of
 * a hundred keys in the same storage they live in would be silly.
 */
export function settingsFingerprint(): string {
  const entries = Object.entries(collectSettings()).sort(([a], [b]) => a.localeCompare(b))
  let h = 5381
  for (const [k, v] of entries) {
    const pair = `${k}=${v};`
    for (let i = 0; i < pair.length; i++) {
      h = ((h << 5) + h + pair.charCodeAt(i)) | 0
    }
  }
  return `${entries.length}:${(h >>> 0).toString(36)}`
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
      /* Absent on a profile that last synced before settings were
         backed up — null means "no baseline", not "no changes". */
      settingsFingerprint:
        typeof parsed.settingsFingerprint === 'string' ? parsed.settingsFingerprint : null,
      ownerUserId:
        typeof parsed.ownerUserId === 'string' ? parsed.ownerUserId : null,
      lastSyncedRowCount:
        typeof parsed.lastSyncedRowCount === 'number' ? parsed.lastSyncedRowCount : null,
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
  /*
   * A changed setting counts, and is checked first: it is the case the
   * Dexie hooks cannot see at all. Only once something has been synced
   * is the comparison meaningful — before that the database stamp below
   * already decides.
   */
  if (meta.lastSyncedAt && meta.settingsFingerprint !== null
      && settingsFingerprint() !== meta.settingsFingerprint) {
    return true
  }

  /*
   * Any stamp at all means unsaved work.
   *
   * This used to ask whether the stamp was *later* than `lastSyncedAt` —
   * comparing this device's clock with the server's. A phone running a
   * minute behind made an edit just after a sync look older than the
   * sync: "already saved", so it was never pushed, and the next load
   * from the cloud replaced it. The comparison was never needed: every
   * successful push and pull clears the stamp, and a push that raced a
   * new edit leaves it set. So its presence is the whole answer, and no
   * clock enters into it.
   */
  return meta.lastLocalChangeAt != null
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

  /*
   * The Arcade is a second Dexie database, and it was not tracked at
   * all: earning credits or unlocking a biosphere left the profile
   * looking clean, so none of it was ever pushed.
   */
  void import('@/lib/gamesDb').then(({ gamesDb }) => {
    if (!gamesDb) return
    for (const table of gamesDb.tables) {
      try {
        table.hook('creating', () => { markLocalChange() })
        table.hook('updating', () => { markLocalChange(); return undefined })
        table.hook('deleting', () => { markLocalChange() })
      } catch { /* non-fatal, as above */ }
    }
  }).catch(() => { /* Arcade DB unavailable — nothing to track */ })
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
   §4 — Guards shared by push and pull
   ══════════════════════════════════════════════════════════════════ */

/** The schema version of the database running in this tab. */
async function localSchemaVersion(): Promise<number> {
  const { db } = await import('@/lib/db')
  return db?.verno ?? 0
}

/** Rows in a payload, across both databases. */
export function payloadRowCount(payload: {
  tables?: Record<string, unknown>
  gamesTables?: Record<string, unknown>
}): number {
  let n = 0
  for (const rows of Object.values(payload.tables ?? {})) if (Array.isArray(rows)) n += rows.length
  for (const rows of Object.values(payload.gamesTables ?? {})) if (Array.isArray(rows)) n += rows.length
  return n
}

/** Shrinking by at least this share of the last synced copy needs a yes… */
export const MASS_DELETION_RATIO = 0.5
/** …and by at least this many rows, so a small workspace can still be tidied. */
export const MASS_DELETION_MIN_ROWS = 25

/**
 * True when a copy of `now` rows would replace one of `before` rows by
 * losing most of it. Deleting a handful of things never trips this; an
 * emptied database always does.
 */
export function looksLikeMassDeletion(before: number | null | undefined, now: number): boolean {
  if (before == null || before <= 0) return false
  const lost = before - now
  return lost >= MASS_DELETION_MIN_ROWS && now < before * (1 - MASS_DELETION_RATIO)
}

/** True when two server timestamps name the same write. */
export function sameVersion(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const pa = Date.parse(a), pb = Date.parse(b)
  return !Number.isNaN(pa) && pa === pb
}

/*
 * One tab at a time.
 *
 * Every tab of a browser profile shares one IndexedDB and one watermark,
 * so two tabs syncing at once race each other — each would see the
 * other's push as "the cloud changed" and raise a conflict with itself.
 * The Web Locks API serialises them across tabs; where it is missing,
 * the compare-and-swap below still keeps the cloud copy safe.
 */
const LOCK_NAME = 'zenith-cloud-sync'

async function withSyncLock<T>(fn: () => Promise<T>, busy: T): Promise<T> {
  const locks = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { locks?: LockManager }).locks
    : undefined
  if (!locks?.request) return fn()
  let ran = false
  const out = await locks.request(LOCK_NAME, { ifAvailable: true }, async lock => {
    if (!lock) return busy
    ran = true
    return fn()
  })
  return ran ? out : busy
}

/* ══════════════════════════════════════════════════════════════════
   §5 — Push
   ══════════════════════════════════════════════════════════════════ */

export interface PushOptions {
  /**
   * The user chose to keep this device's version over the cloud's. The
   * cloud copy is saved on this device as a safety copy first, and then
   * replaced — still compare-and-swap against the version just read, so
   * a third write arriving in between is not lost either.
   */
  overwriteCloud?: boolean
  /** The user confirmed a push the mass-deletion guard held back. */
  allowShrink?: boolean
  /** The user confirmed this device's data belongs with this account. */
  adoptAccount?: boolean
}

/**
 * Serialises the local database and writes it as this account's cloud copy
 * — but only over the version this device last saw.
 *
 * The write is a compare-and-swap on the server-stamped `updated_at`: the
 * UPDATE matches only while the row is still the one this device last
 * pushed or pulled. If another device wrote in between, nothing matches,
 * nothing is overwritten, and the result is a conflict for the user to
 * resolve. It used to be an unconditional upsert, so a device that had
 * been sitting stale replaced everything written elsewhere the moment
 * anything changed on it.
 */
export async function pushSnapshot(opts: PushOptions = {}): Promise<SnapshotResult> {
  return withSyncLock(() => pushLocked(opts), { ok: false, blocked: 'busy' })
}

async function pushLocked(opts: PushOptions): Promise<SnapshotResult> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { ok: false, error: 'Cloud is not configured for this build.' }
  }

  const userId = await resolveUserId()
  if (!userId) {
    return { ok: false, error: 'Sign in with an account to save to the cloud.' }
  }

  const meta = getSnapshotMeta()
  if (meta.ownerUserId && meta.ownerUserId !== userId && !opts.adoptAccount) {
    return { ok: false, blocked: 'account-mismatch' }
  }

  const remote = await getRemoteMeta()
  const schema = await localSchemaVersion()
  if (remote?.schemaVersion != null && remote.schemaVersion > schema) {
    return { ok: false, blocked: 'outdated-app' }
  }

  /*
   * Snapshot the dirty stamp BEFORE reading the database. If the user writes
   * again while the upload is in flight, that newer edit is not represented in
   * the uploaded payload — so the profile must stay dirty rather than be marked
   * clean, or the change would silently never reach the cloud.
   */
  const stampAtCapture = meta.lastLocalChangeAt

  let payload
  try {
    payload = await buildBackupPayload()
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Could not read the local database.' }
  }
  const rowCount = payloadRowCount(payload)

  if (!opts.allowShrink && looksLikeMassDeletion(meta.lastSyncedRowCount, rowCount)) {
    return { ok: false, blocked: 'mass-deletion' }
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

  /*
   * Which version this write may replace. Normally the one this device
   * last synced; when the user has chosen this device over the cloud,
   * the one just read — after keeping a copy of it here.
   */
  let expected = meta.lastSyncedAt
  if (opts.overwriteCloud && remote) {
    const kept = await keepCloudCopyAside(userId)
    if (!kept) return { ok: false, blocked: 'no-backup' }
    expected = remote.updatedAt
  }

  const body = {
    payload,
    schema_version: payload.schemaVersion,
    device_label:   resolveDeviceLabel(),
    /* The trigger stamps the real time; this only has to change. */
    updated_at:     new Date().toISOString(),
  }

  let updatedAt: string | null = null

  if (remote) {
    /* A cloud copy exists. Replace it only if it is the one we expect. */
    if (!expected || !sameVersion(expected, remote.updatedAt)) {
      return { ok: false, blocked: 'conflict' }
    }
    const { data, error } = await supabase
      .from(SNAPSHOT_TABLE)
      .update(body)
      .eq('user_id', userId)
      .eq('updated_at', expected)
      .select('updated_at')
    if (error) return { ok: false, error: describeError(error.message) }
    const rows = (data ?? []) as { updated_at: string }[]
    /* Nothing matched: someone wrote between our read and our write. */
    if (rows.length === 0) return { ok: false, blocked: 'conflict' }
    updatedAt = rows[0].updated_at
  } else {
    /*
     * No cloud copy yet. INSERT, never upsert: if another device creates
     * the row in the same moment, the primary key rejects this write
     * instead of replacing theirs.
     */
    const { data, error } = await supabase
      .from(SNAPSHOT_TABLE)
      .insert({ user_id: userId, ...body })
      .select('updated_at')
      .single()
    if (error) {
      if (/duplicate key|23505|already exists/i.test(error.message ?? '')) {
        return { ok: false, blocked: 'conflict' }
      }
      return { ok: false, error: describeError(error.message) }
    }
    updatedAt = (data as { updated_at: string } | null)?.updated_at ?? null
  }

  if (!updatedAt) return { ok: false, error: 'The cloud did not confirm the save.' }

  /*
   * Clearing lastLocalChangeAt marks this profile clean: everything local is
   * now represented in the cloud row identified by `updatedAt`. If a write
   * landed mid-upload the stamp has moved on — keep it, so the next debounce
   * pushes that edit too.
   */
  const stampNow = getSnapshotMeta().lastLocalChangeAt
  setSnapshotMeta({
    lastSyncedAt:        updatedAt,
    lastLocalChangeAt:   stampNow === stampAtCapture ? null : stampNow,
    settingsFingerprint: settingsFingerprint(),
    ownerUserId:         userId,
    lastSyncedRowCount:  rowCount,
  })

  return { ok: true, updatedAt }
}

/* ══════════════════════════════════════════════════════════════════
   §6 — Pull
   ══════════════════════════════════════════════════════════════════ */

export interface PullOptions {
  /** The user confirmed this account's data should replace this device's. */
  adoptAccount?: boolean
  /**
   * The user chose the cloud's version over this device's unsaved work.
   * The safety copy below is what makes that recoverable.
   */
  discardLocal?: boolean
  /** The user confirmed loading even though no safety copy could be made. */
  withoutBackup?: boolean
}

/**
 * Downloads this account's cloud copy and loads it in place of this
 * device's data — after keeping a safety copy of what it replaces.
 *
 * Refuses, rather than proceeds, when this device has unsaved work (unless
 * the user chose the cloud's version), when the data belongs to another
 * account, and when a safety copy could not be made. Tables the cloud
 * copy does not mention are left alone: an older Zenith on another device
 * must not be able to empty a table it has never heard of.
 */
export async function pullSnapshot(opts: PullOptions = {}): Promise<SnapshotResult> {
  return withSyncLock(() => pullLocked(opts), { ok: false, blocked: 'busy' })
}

async function pullLocked(opts: PullOptions): Promise<SnapshotResult> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { ok: false, error: 'Cloud is not configured for this build.' }
  }

  const userId = await resolveUserId()
  if (!userId) {
    return { ok: false, error: 'Sign in with an account to load from the cloud.' }
  }

  const meta = getSnapshotMeta()
  if (meta.ownerUserId && meta.ownerUserId !== userId && !opts.adoptAccount) {
    return { ok: false, blocked: 'account-mismatch' }
  }
  if (hasUnpushedLocalChanges(meta) && !opts.discardLocal) {
    return { ok: false, blocked: 'conflict' }
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

  /*
   * A copy of what is about to be replaced, kept on this device. Without
   * one the load does not happen: this is the only thing that makes a
   * wrong choice — or a bad copy in the cloud — recoverable.
   */
  if (!opts.withoutBackup) {
    const kept = await storeSafetyCopy('before-cloud-load')
    if (!kept) return { ok: false, blocked: 'no-backup' }
  }

  try {
    /*
     * The importer takes a JSON string (it is shared with the file-restore
     * path), so the jsonb object is re-serialised here. Round-tripping through
     * JSON also strips any non-cloneable values before they reach IndexedDB.
     */
    await importJsonToLocalDatabase(JSON.stringify(row.payload), { preserveMissingTables: true })
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Restore failed.' }
  }

  /* Local now mirrors the remote row exactly — clean watermark, and the
     settings just written are the new baseline. */
  setSnapshotMeta({
    lastSyncedAt:        row.updated_at,
    lastLocalChangeAt:   null,
    settingsFingerprint: settingsFingerprint(),
    ownerUserId:         userId,
    lastSyncedRowCount:  payloadRowCount(row.payload as { tables?: Record<string, unknown> }),
  })

  return { ok: true, updatedAt: row.updated_at }
}

/**
 * Keeps the cloud's current copy on this device before this device's
 * version replaces it — the "other version kept as a backup" half of
 * resolving a conflict in this device's favour.
 */
async function keepCloudCopyAside(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false
  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return false
  if (!data) return true   // nothing in the cloud to keep
  const payload = (data as { payload: unknown }).payload
  if (!payload || typeof payload !== 'object') return true
  return storeSafetyCopy('cloud-copy', JSON.stringify(payload))
}

/* ══════════════════════════════════════════════════════════════════
   §7 — Remote metadata probe
   ══════════════════════════════════════════════════════════════════ */

/**
 * Cheap "has the cloud changed?" probe — metadata columns only, never the
 * (potentially large) payload. Null when unavailable or when no copy exists.
 */
export async function getRemoteMeta(): Promise<RemoteSnapshotMeta | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const userId = await resolveUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    /* One key out of the payload, not the payload: still a cheap probe. */
    .select('updated_at, device_label, schema_version, secrets_stripped:payload->>secretsStripped')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    updated_at: string; device_label: string | null; schema_version: number | null
    secrets_stripped: string | null
  }
  return {
    updatedAt:       row.updated_at,
    deviceLabel:     row.device_label ?? null,
    schemaVersion:   typeof row.schema_version === 'number' ? row.schema_version : null,
    secretsStripped: row.secrets_stripped === 'true',
  }
}

/** The signed-in account's id, for the controller's account check. */
export async function currentCloudUserId(): Promise<string | null> {
  return resolveUserId()
}

/* ══════════════════════════════════════════════════════════════════
   §8 — What to do next
   ══════════════════════════════════════════════════════════════════ */

export type SyncDecision =
  | { action: 'idle' }
  | { action: 'push' }
  | { action: 'pull' }
  | { action: 'blocked'; reason: SyncBlock }

export interface SyncSituation {
  /** This device's watermark. */
  meta:          SnapshotMeta
  /** The signed-in account. */
  userId:        string
  /** The cloud copy, or null when there is none. */
  remote:        RemoteSnapshotMeta | null
  /** This device has unsaved work (hasUnpushedLocalChanges). */
  localDirty:    boolean
  /** This device holds data a person entered (hasMeaningfulLocalData). */
  localHasData:  boolean
  /** Schema version running here. */
  localSchema:   number
}

/**
 * Given where this device and the cloud stand, what should happen — pure,
 * so every case the safeguards cover can be tested without a network.
 *
 * The automatic actions are only ever the two that cannot lose anything:
 * pushing when the cloud still holds what this device last saw, and
 * loading when this device has nothing unsaved. Everything else stops and
 * says why.
 */
export function decideSync(s: SyncSituation): SyncDecision {
  const { meta, userId, remote, localDirty, localHasData, localSchema } = s

  if (meta.ownerUserId && meta.ownerUserId !== userId) {
    return { action: 'blocked', reason: 'account-mismatch' }
  }

  /* No cloud copy yet: this device's data becomes the first one. */
  if (!remote) {
    return localDirty || localHasData ? { action: 'push' } : { action: 'idle' }
  }

  const cloudMoved = !sameVersion(meta.lastSyncedAt, remote.updatedAt)

  if (!cloudMoved) {
    if (remote.schemaVersion != null && remote.schemaVersion > localSchema) {
      return localDirty ? { action: 'blocked', reason: 'outdated-app' } : { action: 'idle' }
    }
    if (localDirty) return { action: 'push' }
    /*
     * Nothing new to save — but the copy in the cloud was written before
     * secrets were stripped and may still hold API keys. Replace it with a
     * clean one now rather than waiting for the next edit, which on a
     * quiet workspace could be never.
     */
    if (remote.secretsStripped === false) return { action: 'push' }
    return { action: 'idle' }
  }

  /* The cloud has something this device has not seen. */
  if (localDirty) return { action: 'blocked', reason: 'conflict' }

  /*
   * First sync on a device that already holds a workspace: it has never
   * been compared with the cloud, so it looks "clean" while possibly
   * holding months of work. Never replace it without asking.
   */
  if (!meta.lastSyncedAt && localHasData) {
    return { action: 'blocked', reason: 'conflict' }
  }

  return { action: 'pull' }
}

/* ══════════════════════════════════════════════════════════════════
   §9 — Helpers
   ══════════════════════════════════════════════════════════════════ */

/**
 * Turns raw PostgREST failures into something a user can act on. The most
 * common one by far is a missing table (migration not run yet). Never
 * includes any of the payload — only the server's message.
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

/**
 * True when the cloud holds a version this device has not seen.
 *
 * Identity, not ordering: "different from the one I last synced" is the
 * question, and it has an answer even when the two timestamps came from
 * clocks that disagree.
 */
export function isRemoteNewer(
  remoteUpdatedAt: string,
  meta: SnapshotMeta = getSnapshotMeta(),
): boolean {
  if (Number.isNaN(Date.parse(remoteUpdatedAt))) return false
  return !sameVersion(meta.lastSyncedAt, remoteUpdatedAt)
}
