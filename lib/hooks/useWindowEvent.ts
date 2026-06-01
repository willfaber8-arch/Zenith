'use client'

/**
 * Zenith OS — useWindowEvent
 * Phase 6 · Step 6.1 — Memory Disposal Policy
 *
 * Drop-in replacement for ad-hoc window.addEventListener / removeEventListener
 * pairs. Guarantees that the listener is registered exactly once (guarded by
 * React StrictMode's double-invoke) and removed cleanly on unmount.
 *
 * Audit of existing global window listeners this replaces / should replace:
 *   · StudyModeContext — Escape key handler
 *   · SyncEngine      — window 'online' reconnect drain
 *   · CosmosCanvas    — (RAF loop, no window listener — fine as-is)
 *
 * Usage:
 *   useWindowEvent('keydown', handler)
 *   useWindowEvent('online',  onReconnect)
 *   useWindowEvent('resize',  onResize, { passive: true })
 */

import { useEffect, useRef } from 'react'

type WindowEventMap_ = WindowEventMap  // alias to keep lines tidy

export function useWindowEvent<K extends keyof WindowEventMap_>(
  type:     K,
  handler:  (event: WindowEventMap_[K]) => void,
  options?: AddEventListenerOptions,
): void {
  /* Stable ref so changing `handler` between renders doesn't re-register
     the listener — the ref always points to the latest function.         */
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    /* Stable inner listener — identity never changes, so add/remove are
       symmetric even in React 18 StrictMode's double-invoke.             */
    function listener(event: WindowEventMap_[K]) {
      handlerRef.current(event)
    }

    window.addEventListener(type, listener as EventListener, options)

    return () => {
      window.removeEventListener(type, listener as EventListener, options)
    }
    // options is assumed stable (object literal at call site) — spread into
    // deps if your use-case changes options dynamically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])
}
