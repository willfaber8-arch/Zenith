/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Distance Tracker Type Definitions
 * Phase 9 · Step 9.4 — Privacy-Preserving Geolocation Widget
 *
 * ┌─ Privacy constraints ─────────────────────────────────────┐
 * │  latitude and longitude are INTERNAL CALCULATION FIELDS.  │
 * │                                                            │
 * │  They MUST NOT:                                            │
 * │    • Be rendered to the screen at any point                │
 * │    • Be written to any Supabase / remote table             │
 * │    • Appear in log output in production                    │
 * │                                                            │
 * │  They MAY:                                                 │
 * │    • Be stored in local IndexedDB (peer_locations table)   │
 * │    • Be transmitted over the WebRTC DataChannel (DTLS E2E) │
 * │    • Be read by calculateHaversineDistanceMiles() only     │
 * └────────────────────────────────────────────────────────────┘
 *
 * The only value ever shown in the UI is the computed distance
 * in miles, which carries no coordinate information.
 * ════════════════════════════════════════════════════════════════
 */

/**
 * One row in the peer_locations IndexedDB table.
 * peerIdString mirrors the same PK convention used in
 * peer_leaderboard_snapshots: 'self' = local user, PeerJS
 * peer ID string = any connected remote peer.
 */
export interface PeerLocation {
  /** Explicit string PK — 'self' or a PeerJS peer ID */
  peerIdString:         string

  /**
   * @private Decimal-degree latitude.
   * INTERNAL CALCULATION USE ONLY — never render to screen.
   */
  latitude:             number

  /**
   * @private Decimal-degree longitude.
   * INTERNAL CALCULATION USE ONLY — never render to screen.
   */
  longitude:            number

  /** Unix ms — when this location was last recorded / received */
  lastUpdatedTimestamp: number
}

/** Reserved primary key for the local user's own location row */
export const SELF_LOCATION_ID = 'self' as const

/** Maximum age (ms) before a stored location is considered stale */
export const LOCATION_STALE_MS = 24 * 60 * 60 * 1_000   // 24 hours

/** Returns true if the stored location is older than LOCATION_STALE_MS */
export function isLocationStale(loc: PeerLocation): boolean {
  return Date.now() - loc.lastUpdatedTimestamp > LOCATION_STALE_MS
}
