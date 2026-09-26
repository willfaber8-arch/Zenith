'use client'

/**
 * lib/CloudSyncContext.tsx — cloud sync that runs by itself, safely.
 *
 * One instance for the whole signed-in app, mounted by AppShell, so sync
 * happens on every screen of every device. It used to live inside the
 * Settings panel's own hook: auto-save and auto-load only ran while
 * Settings was on screen, and everywhere else nothing synced unless you
 * remembered to press the button.
 *
 * When it acts:
 *   · a few seconds after a change on this device      → save
 *   · when the app is hidden or closed                  → save now
 *   · on opening, on returning to the app, on reconnect → check the cloud;
 *     load its newer copy if this device has nothing unsaved
 *   · every minute while the app is open                → check the cloud,
 *     but only *offer* a newer copy (a banner) rather than reload the page
 *     under someone who is in the middle of reading it
 *
 * What it will never do on its own — see `decideSync` and the push/pull
 * guards in services/cloudSnapshot.ts: overwrite a cloud copy it has not
 * seen, load over unsaved work, cross accounts, let an older Zenith save
 * over a newer one's copy, save a sudden mass deletion, or replace
 * anything without first keeping a safety copy. Each of those stops with a
 * reason in `blocked`, and the banner asks the user.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/lib/ToastContext'
import { reloadPage } from '@/lib/reloadPage'
import {
  isSnapshotAvailable, getUnavailableReason, pushSnapshot, pullSnapshot, getRemoteMeta,
  getSnapshotMeta, hasUnpushedLocalChanges, hasMeaningfulLocalData, startSnapshotChangeTracking,
  currentCloudUserId, decideSync,
  type RemoteSnapshotMeta, type SnapshotResult, type SyncBlock, type PushOptions, type PullOptions,
} from '@/services/cloudSnapshot'

export type CloudSyncStatus = 'unavailable' | 'offline' | 'idle' | 'syncing' | 'synced' | 'error'

export interface CloudSync {
  available:    boolean
  /** Why sync is unavailable, when it is. */
  reason:       string | null
  status:       CloudSyncStatus
  /** Server time of the version this device last saved or loaded. */
  lastSyncedAt: string | null
  remoteMeta:   RemoteSnapshotMeta | null
  error:        string | null
  /** A safeguard stopped sync and needs the user. */
  blocked:      SyncBlock | null
  /** The cloud has newer changes; they load on return, or now on request. */
  updateReady:  boolean
  pushing:      boolean
  pulling:      boolean

  /** Save now — still refuses to overwrite a cloud copy it has not seen. */
  saveNow:        () => Promise<boolean>
  /** Load now — keeps a safety copy first; refuses over unsaved work. */
  loadNow:        () => Promise<boolean>
  /** Conflict: keep this device's version. The cloud's is kept here first. */
  keepThisDevice: () => Promise<boolean>
  /** Conflict: keep the cloud's version. This device's is kept here first. */
  keepCloud:      () => Promise<boolean>
  /** Mass-deletion guard: yes, the smaller copy is what I want saved. */
  confirmShrink:  () => Promise<boolean>
  /** No safety copy could be made: load anyway. */
  loadAnyway:     () => Promise<boolean>
  /** Another account's data is here: replace it with this account's copy. */
  useAccountData: () => Promise<boolean>
  refreshRemote:  () => Promise<void>
}

const CloudSyncContext = createContext<CloudSync | null>(null)

/* ── Tuning ───────────────────────────────────────────────────────── */

/** Quiet period after the last change before saving. */
const SAVE_DEBOUNCE_MS = 3_000
/** How often an open, visible app checks the cloud. */
const POLL_MS = 60_000
/** Carries "what just loaded" across the reload that follows a load. */
const LOADED_FLAG = 'zenith_cloud_loaded_from'

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { session, isReady } = useAuth()
  const { toast } = useToast()

  const [available,    setAvailable]    = useState(false)
  const [reason,       setReason]       = useState<string | null>(null)
  const [status,       setStatus]       = useState<CloudSyncStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [remoteMeta,   setRemoteMeta]   = useState<RemoteSnapshotMeta | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [blocked,      setBlocked]      = useState<SyncBlock | null>(null)
  const [updateReady,  setUpdateReady]  = useState(false)
  const [pushing,      setPushing]      = useState(false)
  const [pulling,      setPulling]      = useState(false)

  const mounted   = useRef(true)
  const busy      = useRef(false)
  const availRef  = useRef(false)
  const blockRef  = useRef<SyncBlock | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /*
   * Set when this page load is the reload that follows a load. If the
   * cloud still looks newer straight after one — the watermark could not
   * be saved, say, because storage is full — loading again would reload
   * again, forever. The first check after a load only ever offers.
   */
  const justLoaded = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const setBlock = useCallback((b: SyncBlock | null) => {
    blockRef.current = b
    if (mounted.current) setBlocked(b)
  }, [])

  /* ── After a load, the page reloads; say what happened once it has. ── */
  useEffect(() => {
    try {
      const from = sessionStorage.getItem(LOADED_FLAG)
      if (from !== null) {
        justLoaded.current = true
        sessionStorage.removeItem(LOADED_FLAG)
        toast(from ? `Loaded your latest changes from ${from}.` : 'Loaded your latest changes.', 'success')
      }
    } catch { /* storage blocked */ }
  }, [toast])

  useEffect(() => {
    setLastSyncedAt(getSnapshotMeta().lastSyncedAt)
    startSnapshotChangeTracking()
  }, [])

  /* ── The two primitives, with their outcomes reflected in state ───── */

  const afterResult = useCallback((r: SnapshotResult, kind: 'push' | 'pull'): boolean => {
    if (!mounted.current) return r.ok
    if (r.ok) {
      setBlock(null)
      setError(null)
      setStatus('synced')
      setUpdateReady(false)
      if (r.updatedAt) setLastSyncedAt(r.updatedAt)
      if (kind === 'push' && r.updatedAt) {
        setRemoteMeta(prev => prev ? { ...prev, updatedAt: r.updatedAt! } : prev)
      }
      return true
    }
    if (r.blocked === 'busy') { setStatus('idle'); return false }   // another tab has it
    if (r.blocked) { setBlock(r.blocked); setStatus('idle'); return false }
    setError(r.error ?? 'Cloud sync failed.')
    setStatus('error')
    return false
  }, [setBlock])

  const doPush = useCallback(async (opts: PushOptions = {}): Promise<boolean> => {
    if (busy.current || !availRef.current) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return false }
    busy.current = true
    if (mounted.current) { setPushing(true); setStatus('syncing') }
    try {
      return afterResult(await pushSnapshot(opts), 'push')
    } finally {
      busy.current = false
      if (mounted.current) setPushing(false)
    }
  }, [afterResult])

  /** Loads, then reloads the page so no screen keeps the old data in memory. */
  const doPull = useCallback(async (opts: PullOptions = {}): Promise<boolean> => {
    if (busy.current || !availRef.current) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return false }
    busy.current = true
    if (mounted.current) { setPulling(true); setStatus('syncing') }
    try {
      const from = (await getRemoteMeta())?.deviceLabel ?? ''
      const ok = afterResult(await pullSnapshot(opts), 'pull')
      if (ok) {
        /*
         * A reload, not an in-place refresh. A screen holding a draft — the
         * note editor's text, a form — would otherwise save its stale copy
         * straight back over what was just loaded.
         */
        try { sessionStorage.setItem(LOADED_FLAG, from) } catch { /* noop */ }
        reloadPage()
      }
      return ok
    } finally {
      busy.current = false
      if (mounted.current) setPulling(false)
    }
  }, [afterResult])

  /* ── The check: what should happen now? ──────────────────────────── */

  const check = useCallback(async (why: 'open' | 'return' | 'poll' | 'change') => {
    if (!availRef.current || busy.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (mounted.current) setStatus('offline')
      return
    }

    const [remote, userId] = await Promise.all([getRemoteMeta(), currentCloudUserId()])
    if (!mounted.current || !userId) return
    setRemoteMeta(remote)

    const meta = getSnapshotMeta()
    const localDirty = hasUnpushedLocalChanges(meta)
    const { db } = await import('@/lib/db')
    const decision = decideSync({
      meta, userId, remote, localDirty,
      /* Only asked when it can change the answer — a count per table. */
      localHasData: !meta.lastSyncedAt ? await hasMeaningfulLocalData() : true,
      localSchema:  db?.verno ?? 0,
    })

    if (decision.action !== 'pull') justLoaded.current = false

    switch (decision.action) {
      case 'idle':
        setBlock(null)
        setUpdateReady(false)
        setStatus('synced')
        return
      case 'push':
        await doPush()
        return
      case 'pull':
        /*
         * Loading reloads the page. That is right when you have just
         * opened or come back to the app — and wrong while you are reading
         * it, so the minute-by-minute check only offers it.
         */
        if (why === 'poll' || why === 'change' || justLoaded.current) {
          justLoaded.current = false
          setUpdateReady(true)
          setStatus('idle')
          return
        }
        await doPull()
        return
      case 'blocked':
        setBlock(decision.reason)
        setStatus('idle')
        return
    }
  }, [doPush, doPull, setBlock])

  /* ── Availability, then the first check ──────────────────────────── */

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    void (async () => {
      const ok = await isSnapshotAvailable()
      if (cancelled || !mounted.current) return
      availRef.current = ok
      setAvailable(ok)
      if (!ok) {
        setReason(await getUnavailableReason())
        if (!cancelled && mounted.current) setStatus('unavailable')
        return
      }
      setReason(null)
      await check('open')
    })()
    return () => { cancelled = true }
  }, [isReady, session?.sessionToken, check])

  /* ── Triggers ─────────────────────────────────────────────────────── */

  useEffect(() => {
    const scheduleSave = () => {
      if (!availRef.current) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        /* A safeguard is waiting on the user; do not keep hammering it. */
        if (blockRef.current) return
        if (hasUnpushedLocalChanges()) void check('change')
      }, SAVE_DEBOUNCE_MS)
    }

    /* Leaving: save now — the debounce may never get to fire. */
    const flush = () => {
      if (!availRef.current || blockRef.current || busy.current) return
      if (!hasUnpushedLocalChanges()) return
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
      void doPush()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else void check('return')
    }
    const onOnline  = () => void check('return')
    const onOffline = () => { if (mounted.current) setStatus('offline') }
    const onFocus   = () => void check('return')

    window.addEventListener('zenith:db-changed', scheduleSave)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', onFocus)

    /* Also catches a changed setting, which no database hook sees. */
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void check('poll')
    }, POLL_MS)

    return () => {
      window.removeEventListener('zenith:db-changed', scheduleSave)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
  }, [check, doPush])

  /* ── What the user can choose ────────────────────────────────────── */

  const value = useMemo<CloudSync>(() => ({
    available, reason, status, lastSyncedAt, remoteMeta, error, blocked, updateReady, pushing, pulling,
    saveNow:        () => doPush(),
    loadNow:        () => doPull(),
    keepThisDevice: () => doPush({ overwriteCloud: true }),
    keepCloud:      () => doPull({ discardLocal: true }),
    confirmShrink:  () => doPush({ allowShrink: true }),
    loadAnyway:     () => doPull({ withoutBackup: true }),
    useAccountData: () => doPull({ adoptAccount: true, discardLocal: true }),
    refreshRemote:  async () => { setRemoteMeta(await getRemoteMeta()) },
  }), [available, reason, status, lastSyncedAt, remoteMeta, error, blocked, updateReady,
       pushing, pulling, doPush, doPull])

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>
}

/** Cloud sync state and actions. Must be inside `CloudSyncProvider` (AppShell). */
export function useCloudSync(): CloudSync {
  const ctx = useContext(CloudSyncContext)
  if (!ctx) throw new Error('useCloudSync must be used inside CloudSyncProvider')
  return ctx
}
