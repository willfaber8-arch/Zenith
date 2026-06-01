/**
 * Zenith OS — Structured Logger
 * Phase 6 · Step 6.1 — Log Scrubbing & Memory Disposal
 *
 * Thin wrapper over console that is automatically silenced in production.
 * All `log` and `debug` calls compile to no-ops via compiler.removeConsole
 * in next.config.ts, but this module provides an explicit typed API and
 * lets ESLint enforce "no bare console.log" across the codebase.
 *
 * Usage:
 *   import { log, warn, error } from '@/lib/logger'
 *   log('useCalendarData', 'Feed refreshed', { feedId: 3 })
 *   warn('SyncEngine', 'Retry limit reached for item', { id })
 *   error('ErrorBoundary', 'Subtree crashed', err)
 */

type LogLevel = 'log' | 'debug' | 'warn' | 'error'

const IS_PROD = process.env.NODE_ENV === 'production'

function emit(level: LogLevel, scope: string, message: string, data?: unknown) {
  /* In production, compiler.removeConsole strips log/debug at build time.
     This runtime guard is the fallback for any dynamic code paths.       */
  if (IS_PROD && (level === 'log' || level === 'debug')) return

  const prefix = `[Zenith · ${scope}]`

  if (data !== undefined) {
    console[level](prefix, message, data)
  } else {
    console[level](prefix, message)
  }
}

/** Development-only informational trace — no-op in production builds */
export const log   = (scope: string, message: string, data?: unknown) =>
  emit('log',   scope, message, data)

/** Development-only verbose trace — no-op in production builds */
export const debug = (scope: string, message: string, data?: unknown) =>
  emit('debug', scope, message, data)

/** Preserved in production — use for non-critical anomalies */
export const warn  = (scope: string, message: string, data?: unknown) =>
  emit('warn',  scope, message, data)

/** Preserved in production — use for actionable failures only */
export const error = (scope: string, message: string, data?: unknown) =>
  emit('error', scope, message, data)
