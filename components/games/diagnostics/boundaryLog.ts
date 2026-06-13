/**
 * ════════════════════════════════════════════════════════════════
 * boundaryLog — Games Tab · Step 7.3
 * Shared Exception Registry
 *
 * Module-level singleton that GameErrorBoundary instances write to
 * on each componentDidCatch call and DiagnosticsHUD reads from on
 * its telemetry interval.  No React state, no context — just two
 * plain variables with accessor functions.  This avoids the circular
 * import that would occur if the HUD imported from the Boundary file
 * directly, and keeps the data entirely outside the React tree.
 * ════════════════════════════════════════════════════════════════
 */

import type { ErrorInfo } from 'react'

/* ── Module-level state ──────────────────────────────────────── */

let exceptionCount                    = 0
let lastPayload: Record<string, unknown> | null = null

/* ════════════════════════════════════════════════════════════════
   WRITE — called by GameErrorBoundary.componentDidCatch
   ════════════════════════════════════════════════════════════════ */

/**
 * Records one boundary exception.  Increments the lifetime counter
 * and overwrites the last-payload slot with a compact snapshot of
 * the error so the DiagnosticsHUD can surface it without holding
 * a reference to the original Error object.
 */
export function logBoundaryException(error: Error, info: ErrorInfo): void {
  exceptionCount++
  lastPayload = {
    message:        error.message,
    name:           error.name,
    stack:          (error.stack  ?? '').slice(0, 800),
    componentStack: (info.componentStack ?? '').slice(0, 800),
    timestamp:      Date.now(),
  }
}

/* ════════════════════════════════════════════════════════════════
   READ — polled by DiagnosticsHUD telemetry interval
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the current exception counter and the most recently
 * captured payload.  Callers receive a copy of the count but a
 * direct reference to lastPayload — treat it as read-only.
 */
export function getBoundaryExceptions(): {
  count:       number
  lastPayload: Record<string, unknown> | null
} {
  return { count: exceptionCount, lastPayload }
}
