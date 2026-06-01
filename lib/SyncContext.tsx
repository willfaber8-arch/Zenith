'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Sync Context
 * Phase 2 · Step 2.2 — Cloud Synchronization Pipeline Hooks
 *
 * Bridges the ZenithSyncEngine singleton (a plain TypeScript class)
 * into the React tree so any component can read sync state and
 * manually trigger a reconciliation pass.
 *
 * Provider placement (layout.tsx):
 *   AuthProvider
 *     └─ SyncProvider    ← here (inside Auth so session is available)
 *          └─ ToastProvider
 *               └─ ...
 * ════════════════════════════════════════════════════════════════
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { getSyncEngine, type SyncStatus } from '@/services/syncEngine'

/* ── Context shape ──────────────────────────────────────────── */

interface SyncContextValue {
  /** Current state of the cloud synchronization pipeline. */
  status:      SyncStatus
  /**
   * Manually trigger a reconciliation pass.
   * Wired to the "retry" action on the OFFLINE_QUEUED indicator.
   */
  triggerSync: () => void
}

const SyncContext = createContext<SyncContextValue>({
  status:      'CLOUD_SYNCHRONIZED',
  triggerSync: () => {},
})

/* ── Provider ───────────────────────────────────────────────── */

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('CLOUD_SYNCHRONIZED')

  useEffect(() => {
    const engine = getSyncEngine()

    /*
     * init() is idempotent — safe to call on every mount/StrictMode
     * double-invocation. Registers Dexie hooks + window listeners once,
     * then drains any items left over from a previous offline session.
     */
    engine.init()

    /*
     * subscribe() emits the current status immediately on subscription
     * so the initial `useState` value is replaced with the real state
     * before the first paint. Returns the unsubscribe function which
     * React calls on cleanup (StrictMode double-invocation, unmount).
     */
    return engine.subscribe(setStatus)
  }, [])  // intentionally empty — engine is a stable singleton

  const triggerSync = useCallback(() => {
    getSyncEngine().reconcileLocalToCloud().catch(console.error)
  }, [])

  return (
    <SyncContext.Provider value={{ status, triggerSync }}>
      {children}
    </SyncContext.Provider>
  )
}

/* ── Consumer hook ──────────────────────────────────────────── */

/**
 * Returns the live sync status and a manual trigger function.
 *
 * @example
 * const { status, triggerSync } = useSyncStatus()
 * // status: 'SAVED_LOCALLY' | 'SYNCING' | 'CLOUD_SYNCHRONIZED' | 'OFFLINE_QUEUED'
 */
export const useSyncStatus = () => useContext(SyncContext)
