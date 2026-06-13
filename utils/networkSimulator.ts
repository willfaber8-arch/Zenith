/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Network Simulation Interceptor
 * Phase 13 · Step 13.1 — Network-Throttled Offline Synchronizer
 *
 * Replaces window.fetch with a configurable chaos-engineering
 * wrapper. Three independent chaos axes:
 *
 *   latencyMs               — artificial delay injected before
 *                             the real request is dispatched
 *   packetDropRate          — 0.0–1.0 probability that any request
 *                             is rejected with SIMULATED_NETWORK_DROP
 *   forceImmediateDisconnect — hard-fails every request instantly,
 *                             simulating a complete loss of connectivity
 *
 * Only one interceptor instance is active at a time (singleton).
 * install() and uninstall() are idempotent — safe to call repeatedly.
 *
 * SSR-safe: every window-touching code path is guarded by
 * `typeof window === 'undefined'` so the module can be imported
 * in a Next.js Server Component without throwing.
 *
 * Usage:
 *   installNetworkSimulator()
 *   setSimulationProfile({ latencyMs: 3500, packetDropRate: 0.3, forceImmediateDisconnect: false })
 *   // ... run stress test ...
 *   uninstallNetworkSimulator()   // restores original window.fetch
 * ════════════════════════════════════════════════════════════════
 */

/* ── Public type ──────────────────────────────────────────────── */

/**
 * Chaos-engineering configuration for the interceptor.
 * All fields are required so there are no silent zero-defaults.
 */
export interface NetworkSimulationProfile {
  /** Artificial delay in milliseconds before each request (0 = no delay). */
  latencyMs: number
  /**
   * Probability 0.0–1.0 that any request is randomly dropped.
   * 0 = never drop · 0.5 = 50 % drop rate · 1 = always drop.
   */
  packetDropRate: number
  /**
   * When true, every outgoing request is rejected immediately regardless
   * of latencyMs or packetDropRate — simulates hard cable pull.
   */
  forceImmediateDisconnect: boolean
}

/* ── Module-level singleton state ─────────────────────────────── */

const DEFAULT_PROFILE: Readonly<NetworkSimulationProfile> = {
  latencyMs:                0,
  packetDropRate:           0,
  forceImmediateDisconnect: false,
}

/** The original window.fetch, saved when the simulator is installed. */
let _originalFetch: (typeof fetch) | null = null

/** Live chaos configuration — mutated by setSimulationProfile(). */
let _profile: NetworkSimulationProfile = { ...DEFAULT_PROFILE }

/* ── Core interceptor ─────────────────────────────────────────── */

/**
 * Drop-in replacement for window.fetch.
 * Reads _profile on every invocation so profile updates take effect
 * immediately without reinstalling the interceptor.
 */
async function throttledFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const prof = _profile   // snapshot — consistent within this request

  /* Hard disconnect: reject before any async work */
  if (prof.forceImmediateDisconnect) {
    throw new Error('SIMULATED_NETWORK_DROP')
  }

  /* Probabilistic packet drop — optionally after latency so the caller
     experiences a "timed-out while connecting" failure pattern.         */
  if (prof.packetDropRate > 0 && Math.random() < prof.packetDropRate) {
    if (prof.latencyMs > 0) await _sleep(prof.latencyMs)
    throw new Error('SIMULATED_NETWORK_DROP')
  }

  /* Artificial latency — inserted before the real request so the full
     wall-clock time includes the delay.                                 */
  if (prof.latencyMs > 0) await _sleep(prof.latencyMs)

  /* Pass-through to the real fetch */
  if (!_originalFetch) throw new Error('SIMULATED_NETWORK_DROP')
  return _originalFetch(input, init)
}

/* ── Public API ───────────────────────────────────────────────── */

/**
 * Replaces window.fetch with the throttled wrapper.
 * Idempotent — calling install() when already installed is a no-op.
 */
export function installNetworkSimulator(): void {
  if (typeof window === 'undefined') return
  if (_originalFetch !== null)       return   // already installed

  _originalFetch = window.fetch.bind(window)
  window.fetch   = throttledFetch
}

/**
 * Restores the original window.fetch and resets the profile.
 * Idempotent — calling uninstall() when not installed is a no-op.
 */
export function uninstallNetworkSimulator(): void {
  if (typeof window === 'undefined') return
  if (_originalFetch === null)       return   // not installed

  window.fetch   = _originalFetch
  _originalFetch = null
  _profile       = { ...DEFAULT_PROFILE }
}

/**
 * Merge new values into the active profile.
 * The interceptor reads _profile on every request so changes take
 * effect immediately — no reinstall needed.
 */
export function setSimulationProfile(
  profile: Partial<NetworkSimulationProfile>,
): void {
  _profile = { ..._profile, ...profile }
}

/**
 * Returns a snapshot of the current simulation profile.
 * The returned object is a copy — mutations have no effect.
 */
export function getSimulationProfile(): NetworkSimulationProfile {
  return { ..._profile }
}

/**
 * Resets the profile to zero-chaos defaults WITHOUT uninstalling
 * the interceptor. Useful for re-arming after a chaos phase ends.
 */
export function resetSimulationProfile(): void {
  _profile = { ...DEFAULT_PROFILE }
}

/**
 * Returns true if the interceptor is currently active over window.fetch.
 */
export function isSimulatorInstalled(): boolean {
  return _originalFetch !== null
}

/* ── Internal helpers ─────────────────────────────────────────── */

function _sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
