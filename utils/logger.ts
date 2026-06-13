/**
 * utils/logger.ts
 * Phase 12.3 — Production Logging Stripping & Build Freezing
 *
 * This module is the public-facing telemetry surface for Zenith OS.
 * It provides two complementary APIs:
 *
 *   zenithLog(channel, message, payload?)
 *     Channel-keyed trace function — completely silent in production.
 *     All calls are stripped at build time by compiler.removeConsole
 *     in next.config.ts, and are also guarded at runtime by a NODE_ENV
 *     check so that any dynamic code path that escapes the SWC pass is
 *     still silenced.  Use this for background sync loop telemetry,
 *     IDB query traces, WebRTC connection events, and feature flags.
 *
 *   log / debug / warn / error
 *     Scope-keyed typed logger (re-exported from lib/logger.ts).
 *     warn and error are preserved in production; log and debug are not.
 *     Use these for structured component-level diagnostics.
 *
 * PRODUCTION BEHAVIOUR SUMMARY
 * ────────────────────────────
 *   zenithLog  → stripped by SWC removeConsole + IS_DEV runtime guard
 *   log        → stripped by SWC removeConsole + IS_DEV runtime guard
 *   debug      → stripped by SWC removeConsole + IS_DEV runtime guard
 *   warn       → preserved (exclude: ['warn'] in removeConsole config)
 *   error      → preserved (exclude: ['error'] in removeConsole config)
 *
 * USAGE
 * ─────
 *   import { zenithLog }        from '@/utils/logger'
 *   import { log, warn, error } from '@/utils/logger'   // re-exports
 *
 *   zenithLog('SyncBroker', 'Outbox flushed', { count: 3 })
 *   zenithLog('WebRTC',     'Peer connected', { peerId })
 *   zenithLog('IDB',        'Seed complete')
 *
 *   log('CalendarView', 'Feed refreshed', { feedId: 3 })
 *   warn('SyncEngine',  'Retry limit reached', { id })
 *   error('Boundary',   'Subtree crashed', err)
 */

/* ── Re-export the typed scope-keyed logger ──────────────────── */
export { log, debug, warn, error } from '@/lib/logger'

/* ── Runtime guard ───────────────────────────────────────────── */

/**
 * True only in the development Node.js environment.
 * SWC's removeConsole strips the wrapping console.log call at build time;
 * this guard is the runtime fallback for dynamic eval paths.
 */
const IS_DEV = process.env.NODE_ENV !== 'production'

/* ── zenithLog ───────────────────────────────────────────────── */

/**
 * Channel-keyed telemetry trace — completely silent in production.
 *
 * @param channel  Subsystem name, uppercased in the output label.
 *                 Convention: single word or acronym e.g. 'SyncBroker',
 *                 'WebRTC', 'IDB', 'Audio', 'Pomodoro'.
 * @param message  Human-readable description of the event.
 * @param payload  Optional structured data (object, error, primitive).
 *                 Omit for events with no associated data.
 *
 * Output format (development only):
 *   [ZENITH // SYNCBROKER] Outbox flushed { count: 3 }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zenithLog(channel: string, message: string, payload?: any): void {
  if (!IS_DEV) return
  // SWC removeConsole strips this call at build time — the IS_DEV check
  // is the defence-in-depth fallback only.
  const label = `[ZENITH // ${channel.toUpperCase()}]`
  if (payload !== undefined) {
    console.log(label, message, payload)
  } else {
    console.log(label, message)
  }
}

/* ── Sync-specific channel helpers ──────────────────────────── */
/*
 * These narrow wrappers pre-bind the channel name so call sites in the
 * synchronisation services stay terse.  They are tree-shaken away in
 * production just like zenithLog itself.
 */

/** Traces for the ZenithSyncEngine (pendingSyncQueue drain pipeline) */
export const syncLog    = (msg: string, data?: unknown) =>
  zenithLog('SyncEngine', msg, data)

/** Traces for the SyncBroker (outboxMutations batch flush) */
export const brokerLog  = (msg: string, data?: unknown) =>
  zenithLog('SyncBroker', msg, data)

/** Traces for the IDB layer (Dexie hooks, table reads) */
export const idbLog     = (msg: string, data?: unknown) =>
  zenithLog('IDB', msg, data)

/** Traces for the WebRTC / PeerJS layer */
export const rtcLog     = (msg: string, data?: unknown) =>
  zenithLog('WebRTC', msg, data)

/** Traces for the Arcade Hub economy (resource transactions, Crucible) */
export const arcadeLog  = (msg: string, data?: unknown) =>
  zenithLog('Arcade', msg, data)
