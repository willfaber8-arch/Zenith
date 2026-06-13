/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Atomic Memory & Leak Protection Cleanup Pipeline
 * Phase 13 · Step 13.3 — Master Garbage Collection Hook
 *
 * A composable React hook that tracks and atomically disposes all
 * runtime artifacts registered by high-intensity workflows:
 *   • document/window event listeners
 *   • setInterval / setTimeout ids
 *   • Canvas 2D rendering contexts
 *   • Raw IDBDatabase connections
 *
 * Usage pattern:
 *   const { registerListener, registerInterval, executeTeardown } = useSystemTeardown()
 *
 *   // Register artifacts as you create them:
 *   const handler = (e: Event) => { ... }
 *   document.addEventListener('keydown', handler)
 *   registerListener(document, 'keydown', handler)
 *
 *   // executeTeardown() runs automatically on unmount, or call it explicitly:
 *   const report = executeTeardown()
 *   // → { listenersRemoved: 1, intervalsCleared: 0, ... }
 *
 * Design invariants:
 *  • Idempotent — calling executeTeardown() twice is safe (second call is a no-op).
 *  • Never throws — each cleanup op is wrapped in try/catch.
 *  • Auto-runs on component unmount via useEffect return.
 *  • getLastReport() returns null until the first teardown executes.
 * ════════════════════════════════════════════════════════════════
 */

import { useRef, useCallback, useEffect } from 'react'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** Summary returned by executeTeardown() — describes what was cleaned up. */
export interface TeardownReport {
  /** Number of addEventListener registrations that were removed. */
  listenersRemoved:       number
  /** Number of setInterval/setTimeout ids that were cleared. */
  intervalsCleared:       number
  /** Number of Canvas 2D contexts that received a clearRect reset. */
  canvasContextsUnlinked: number
  /** Number of IDBDatabase connections that were explicitly closed. */
  idbConnectionsClosed:   number
  /** Date.now() timestamp when teardown ran. */
  executedAtMs:           number
}

/* ── Internal registration record types ──────────────────────── */

interface RegisteredListener {
  target:  EventTarget
  type:    string
  handler: EventListener
  options?: boolean | AddEventListenerOptions
}

/* ════════════════════════════════════════════════════════════════
   HOOK IMPLEMENTATION
   ════════════════════════════════════════════════════════════════ */

/**
 * Master garbage collection hook for high-intensity Zenith workflows.
 *
 * Accumulates runtime artifacts in mutable refs (no re-renders on registration).
 * Teardown runs at component unmount via useEffect, or can be triggered
 * imperatively via executeTeardown() for mid-lifecycle cleanup.
 */
export function useSystemTeardown() {
  /* ── Artifact registries (refs — never cause re-renders) ──── */
  const listenersRef = useRef<RegisteredListener[]>([])
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([])
  const canvasRef    = useRef<CanvasRenderingContext2D[]>([])
  const idbRef       = useRef<IDBDatabase[]>([])

  /** True after the first teardown has run — prevents double-disposal. */
  const hasRunRef    = useRef(false)

  /** Preserved report from the most recent teardown execution. */
  const reportRef    = useRef<TeardownReport | null>(null)

  /* ── Registration callbacks ───────────────────────────────── */

  /**
   * Registers an event listener for automatic removal on teardown.
   * Call AFTER addEventListener() — this does NOT add the listener itself.
   */
  const registerListener = useCallback((
    target:   EventTarget,
    type:     string,
    handler:  EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => {
    listenersRef.current.push({ target, type, handler, options })
  }, [])

  /**
   * Registers an interval id for clearInterval() on teardown.
   * Call with the return value of setInterval() or setTimeout().
   */
  const registerInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    intervalsRef.current.push(id)
  }, [])

  /**
   * Registers a Canvas 2D context.
   * Teardown clears the canvas rect and drops the reference — useful for
   * preventing ghost rendering after the owning component unmounts.
   */
  const registerCanvasContext = useCallback((ctx: CanvasRenderingContext2D) => {
    canvasRef.current.push(ctx)
  }, [])

  /**
   * Registers a raw IDBDatabase connection for explicit close() on teardown.
   * Use this for connections opened outside of Dexie (e.g. test scaffolding).
   */
  const registerIDBConnection = useCallback((db: IDBDatabase) => {
    idbRef.current.push(db)
  }, [])

  /* ── Core teardown executor ──────────────────────────────── */

  /**
   * Atomically runs all registered cleanup operations.
   *
   * Safe to call multiple times — after the first run, all registries are
   * emptied and subsequent calls return a zeroed report immediately.
   *
   * @returns TeardownReport describing what was cleaned up.
   */
  const executeTeardown = useCallback((): TeardownReport => {
    // Already torn down — return zeroed report to avoid double-disposal
    if (hasRunRef.current) {
      return reportRef.current ?? {
        listenersRemoved:       0,
        intervalsCleared:       0,
        canvasContextsUnlinked: 0,
        idbConnectionsClosed:   0,
        executedAtMs:           Date.now(),
      }
    }

    hasRunRef.current = true

    let listenersRemoved       = 0
    let intervalsCleared       = 0
    let canvasContextsUnlinked = 0
    let idbConnectionsClosed   = 0

    /* Remove event listeners ----------------------------------- */
    for (const { target, type, handler, options } of listenersRef.current) {
      try {
        target.removeEventListener(type, handler, options)
        listenersRemoved++
      } catch {
        // Listener already removed externally — safe to ignore
      }
    }
    listenersRef.current = []

    /* Clear intervals / timeouts ------------------------------- */
    for (const id of intervalsRef.current) {
      try {
        clearInterval(id)
        intervalsCleared++
      } catch {
        // Already cleared — safe to ignore
      }
    }
    intervalsRef.current = []

    /* Unlink canvas contexts ----------------------------------- */
    for (const ctx of canvasRef.current) {
      try {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        canvasContextsUnlinked++
      } catch {
        // Canvas may already be detached from DOM
      }
    }
    canvasRef.current = []

    /* Close IDB connections ------------------------------------ */
    for (const db of idbRef.current) {
      try {
        db.close()
        idbConnectionsClosed++
      } catch {
        // Connection may already be closed
      }
    }
    idbRef.current = []

    const report: TeardownReport = {
      listenersRemoved,
      intervalsCleared,
      canvasContextsUnlinked,
      idbConnectionsClosed,
      executedAtMs: Date.now(),
    }
    reportRef.current = report
    return report
  }, [])

  /**
   * Returns the TeardownReport from the most recent executeTeardown() call.
   * Returns null if teardown has not run yet.
   */
  const getLastReport = useCallback((): TeardownReport | null => {
    return reportRef.current
  }, [])

  /**
   * Resets the teardown hook to accept new registrations.
   *
   * Call this if the component stays mounted but enters a new "session"
   * (e.g. the stress test completes, a new run begins).
   *
   * ⚠️ Does NOT re-register previously cleaned artifacts — only clears
   * the hasRun flag so executeTeardown() will accept the next batch.
   */
  const resetTeardownState = useCallback(() => {
    hasRunRef.current  = false
    reportRef.current  = null
  }, [])

  /* ── Auto-teardown on unmount ────────────────────────────── */
  useEffect(() => {
    return () => {
      executeTeardown()
    }
  }, [executeTeardown])

  return {
    /** Register an event listener that will be auto-removed on teardown. */
    registerListener,
    /** Register a setInterval/setTimeout id for clearInterval on teardown. */
    registerInterval,
    /** Register a Canvas 2D context for clearRect on teardown. */
    registerCanvasContext,
    /** Register an IDBDatabase connection for close() on teardown. */
    registerIDBConnection,
    /**
     * Execute all cleanup operations now.
     * Also runs automatically on component unmount.
     */
    executeTeardown,
    /** Returns the TeardownReport from the last executeTeardown() call, or null. */
    getLastReport,
    /** Reset the teardown state for a new registration cycle. */
    resetTeardownState,
  }
}
