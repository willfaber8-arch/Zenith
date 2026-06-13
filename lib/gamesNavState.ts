/**
 * Ephemeral module-level state that lets one navigation context (e.g.
 * CosmeticPointsIndicator) request a specific initial tab when
 * GamesTabShell mounts after a navigate() call.
 *
 * Pattern:
 *   1. Caller writes the target tab via requestGamesTab().
 *   2. navigate('games', 'creator') fires.
 *   3. GamesTabShell reads consumeRequestedTab() in its useState initialiser.
 *   4. consumeRequestedTab() clears the stored value so the next mount uses 'arcade'.
 */

let _requestedTab: string | null = null

/** Set the tab GamesTabShell should open to on its next mount. */
export function requestGamesTab(tab: string): void {
  _requestedTab = tab
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
