/**
 * Ephemeral module-level state that lets one navigation context (e.g.
 * CosmeticPointsIndicator or SettingsView's "Browse Shop" link) request a
 * specific tab for GamesTabShell.
 *
 * Two delivery paths so the request lands whether the shell is freshly
 * mounting or already on screen:
 *   1. Fresh mount  — GamesTabShell reads peekRequestedTab() in its useState
 *      initialiser (pure, non-clearing — StrictMode-safe), then consumes it
 *      in a mount effect.
 *   2. Already mounted — GamesTabShell subscribes via subscribeGamesTab() and
 *      switches tabs immediately when a request fires.
 */

let _requestedTab: string | null = null
const listeners = new Set<(tab: string) => void>()

/** Set the tab GamesTabShell should open to, and notify any live shell. */
export function requestGamesTab(tab: string): void {
  _requestedTab = tab
  listeners.forEach(fn => fn(tab))
}

/** Non-clearing read — safe to call from a useState initialiser. */
export function peekRequestedTab(): string | null {
  return _requestedTab
}

/**
 * Read and clear the pending tab request.
 * Returns null when no request was set (GamesTabShell falls back to 'arcade').
 */
export function consumeRequestedTab(): string | null {
  const t = _requestedTab
  _requestedTab = null
  return t
}

/** Subscribe a live GamesTabShell so deep-links work without a remount. */
export function subscribeGamesTab(fn: (tab: string) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
