'use client'

/**
 * useCloudSnapshot — React controller for the whole-database Cloud Snapshot.
 *
 * Responsibilities:
 *   • Availability probe (Supabase configured + real signed-in user).
 *   • Debounced AUTO-PUSH after local database changes, plus an opportunistic
 *     push when the tab is hidden or unloaded.
 *   • AUTO-PULL on load when the cloud is newer AND this profile has nothing
 *     unpushed — this is what makes switching browser profiles "just work".
 *   • CONFLICT detection: remote newer BUT local has unpushed edits. Never
 *     auto-resolved; the UI must offer an explicit choice.
 *
 * All effects are SSR-safe and fully torn down on unmount.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import {
  isSnapshotAvailable,
  getUnavailableReason,
  pushSnapshot,
  pullSnapshot,
  getRemoteMeta,
  getSnapshotMeta,
  hasUnpushedLocalChanges,
  isRemoteNewer,
  hasMeaningfulLocalData,
  startSnapshotChangeTracking,
  type RemoteSnapshotMeta,
} from '@/services/cloudSnapshot'

/* ── Types ────────────────────────────────────────────────────────── */

export type SnapshotStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unavailable'

export interface CloudSnapshotState {
  available:      boolean
  /** Why snapshots are unavailable, when `available` is false. */
  reason:         string | null
  status:         SnapshotStatus
  /** Remote `updated_at` this profile last pushed or pulled (ISO). */
  lastSyncedAt:   string | null
  remoteMeta:     RemoteSnapshotMeta | null
  pushing:        boolean
  pulling:        boolean
  /** Remote is newer but this profile has unpushed edits — needs a decision. */
  conflict:       boolean
  /** Last operation's error message, if any. */
  error:          string | null
  push:           () => Promise<boolean>
  pull:           () => Promise<boolean>
  refreshRemote:  () => Promise<void>
}

/* ── Tuning ───────────────────────────────────────────────────────── */

/** Quiet period after the last DB write before an auto-push fires. */
const AUTO_PUSH_DEBOUNCE_MS = 9_000

/** Backstop sweep for changes that slipped past the hooks (other tabs, etc.). */
const DIRTY_CHECK_INTERVAL_MS = 60_000

/* ══════════════════════════════════════════════════════════════════
   useCloudSnapshot
   ══════════════════════════════════════════════════════════════════ */

export function useCloudSnapshot(): CloudSnapshotState {
  const { session, isReady } = useAuth()

  const [available,    setAvailable   ] = useState(false)
  const [reason,       setReason      ] = useState<string | null>(null)
  const [status,       setStatus      ] = useState<SnapshotStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [remoteMeta,   setRemoteMeta  ] = useState<RemoteSnapshotMeta | null>(null)
  const [pushing,      setPushing     ] = useState(false)
  const [pulling,      setPulling     ] = useState(false)
  const [conflict,     setConflict    ] = useState(false)
  const [error,        setError       ] = useState<string | null>(null)

  /* Refs keep the event/interval callbacks stable — no listener churn. */
  const mountedRef     = useRef(true)
  const busyRef        = useRef(false)
  const availableRef   = useRef(false)
  const autoPulledRef  = useRef(false)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /* ── Hydrate the local watermark once on mount ─────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const meta = getSnapshotMeta()
    setLastSyncedAt(meta.lastSyncedAt)
    startSnapshotChangeTracking()
  }, [])

  /* ── Core operations ───────────────────────────────────────────── */

  const runPush = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || !availableRef.current) return false
    busyRef.current = true
    if (mountedRef.current) {
      setPushing(true)
      setStatus('syncing')
      setError(null)
    }

    const result = await pushSnapshot()

    busyRef.current = false
    if (!mountedRef.current) return result.ok

    setPushing(false)
    if (result.ok) {
      setStatus('synced')
      setConflict(false)
      setError(null)
      if (result.updatedAt) {
        setLastSyncedAt(result.updatedAt)
        setRemoteMeta(prev =>
          prev
            ? { ...prev, updatedAt: result.updatedAt! }
            : { updatedAt: result.updatedAt!, deviceLabel: null },
        )
      }
      return true
    }

    setStatus('error')
    setError(result.error ?? 'Cloud save failed.')
    return false
  }, [])

  const runPull = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || !availableRef.current) return false
    busyRef.current = true
    if (mountedRef.current) {
      setPulling(true)
      setStatus('syncing')
      setError(null)
    }

    const result = await pullSnapshot()

    busyRef.current = false
    if (!mountedRef.current) return result.ok

    setPulling(false)
    if (result.ok) {
      setStatus('synced')
      setConflict(false)
      setError(null)
      if (result.updatedAt) setLastSyncedAt(result.updatedAt)
      return true
    }

    setStatus('error')
    setError(result.error ?? 'Cloud load failed.')
    return false
  }, [])

  const refreshRemote = useCallback(async (): Promise<void> => {
    if (!availableRef.current) return
    const meta = await getRemoteMeta()
    if (!mountedRef.current) return
    setRemoteMeta(meta)
    if (meta) {
      setConflict(isRemoteNewer(meta.updatedAt) && hasUnpushedLocalChanges())
    } else {
      setConflict(false)
    }
  }, [])

  /* ── Availability probe + auto-pull on sign-in ─────────────────── */

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isReady) return

    let cancelled = false

    void (async () => {
      const ok = await isSnapshotAvailable()
      if (cancelled || !mountedRef.current) return

      availableRef.current = ok
      setAvailable(ok)

      if (!ok) {
        setReason(await getUnavailableReason())
        if (!cancelled && mountedRef.current) setStatus('unavailable')
        return
      }

      setReason(null)
      setStatus(prev => (prev === 'unavailable' ? 'idle' : prev))

      /* ── Remote probe ──────────────────────────────────────────── */
      const meta = await getRemoteMeta()
      if (cancelled || !mountedRef.current) return
      setRemoteMeta(meta)

      if (!meta) return

      const local      = getSnapshotMeta()
      const remoteNew  = isRemoteNewer(meta.updatedAt, local)
      const localDirty = hasUnpushedLocalChanges(local)

      /*
       * AUTO-PULL RULE
       *   remote newer  AND  nothing unpushed here  →  safe to adopt the cloud.
       *   remote newer  AND  unpushed local edits   →  CONFLICT, never auto-pull
       *                                                (auto-pulling would
       *                                                 destroy real work).
       */
      if (!remoteNew) return

      if (localDirty) {
        setConflict(true)
        return
      }

      /*
       * First-run safety: a profile that predates this feature has no watermark
       * and therefore looks "clean" even though it may hold months of work.
       * Only adopt the cloud automatically when this profile has never synced
       * AND holds no user data; otherwise surface the conflict and let the user
       * decide which side wins.
       */
      if (!local.lastSyncedAt && await hasMeaningfulLocalData()) {
        if (cancelled || !mountedRef.current) return
        setConflict(true)
        return
      }

      if (cancelled || !mountedRef.current) return

      if (!autoPulledRef.current) {
        autoPulledRef.current = true
        await runPull()
      }
    })()

    return () => { cancelled = true }
    /* session identity drives re-probing after sign-in / sign-out */
  }, [isReady, session?.sessionToken, runPull])

  /* ── Debounced auto-push on local DB changes ───────────────────── */

  useEffect(() => {
    if (typeof window === 'undefined') return

    const scheduleAutoPush = () => {
      if (!availableRef.current) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        /* Conflicts must be resolved by the user, never by a background push. */
        if (!availableRef.current || busyRef.current) return
        if (!hasUnpushedLocalChanges()) return
        void runPush()
      }, AUTO_PUSH_DEBOUNCE_MS)
    }

    /* Flush immediately when the tab goes away — the debounce may never fire. */
    const flushNow = () => {
      if (!availableRef.current || busyRef.current) return
      if (!hasUnpushedLocalChanges()) return
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      void runPush()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }

    window.addEventListener('zenith:db-changed', scheduleAutoPush)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushNow)

    /* Backstop: catches writes that bypassed the Dexie hooks. */
    const sweep = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!availableRef.current || busyRef.current) return
      if (hasUnpushedLocalChanges()) scheduleAutoPush()
    }, DIRTY_CHECK_INTERVAL_MS)

    return () => {
      window.removeEventListener('zenith:db-changed', scheduleAutoPush)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushNow)
      clearInterval(sweep)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [runPush])

  return {
    available,
    reason,
    status,
    lastSyncedAt,
    remoteMeta,
    pushing,
    pulling,
    conflict,
    error,
    push:  runPush,
    pull:  runPull,
    refreshRemote,
  }
}

export default useCloudSnapshot
