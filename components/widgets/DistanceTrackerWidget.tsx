/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — DistanceTrackerWidget
 * Phase 9 · Step 9.4 — Privacy-Preserving Geolocation Card
 *
 * Displays the Haversine great-circle distance between the local
 * user and their nearest connected peer.
 *
 * Privacy contract (enforced by useDistanceTracker hook):
 *   ✓  Only distanceLabel (formatted miles string) is rendered
 *   ✓  Raw latitude / longitude are NEVER present in any JSX
 *   ✓  Coordinates are NEVER written to Supabase or any remote DB
 *   ✓  Coordinates travel over WebRTC DTLS only (Phase 9.1 channel)
 *
 * Widget states rendered:
 *   1. permission_denied  — instructions to re-enable in settings
 *   2. syncing            — animated dots while getCurrentPosition runs
 *   3. no_peer_location   — own location known, waiting for peer sync
 *   4. ready              — full distance readout with bearing + footer
 *   5. error              — inline error strip with retry CTA
 *   6. unavailable        — geolocation API not present (HTTPS required)
 * ════════════════════════════════════════════════════════════════
 */

'use client'

import { useMemo }              from 'react'
import { useLiveQuery }         from 'dexie-react-hooks'
import { db }                   from '@/lib/db'
import { useDistanceTracker }   from '@/lib/hooks/useDistanceTracker'
import styles                   from './DistanceTrackerWidget.module.css'

/* ── Relative time formatter (re-used from RelationshipNotesWidget pattern) */
function relativeTime(ts: number): string {
  const delta = Date.now() - ts
  const mins  = Math.floor(delta / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/* ── Compass arrow glyphs (unicode) */
const COMPASS_GLYPHS: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
}

/* ════════════════════════════════════════════════════════════════
   Widget component
   ════════════════════════════════════════════════════════════════ */

export default function DistanceTrackerWidget() {

  const {
    distanceLabel,
    nearestPeer,
    permissionStatus,
    isSyncing,
    ownLastSyncAt,
    isOwnLocationStale,
    syncError,
    syncNow,
    hasPeerLocation,
  } = useDistanceTracker()

  /* Look up the nearest peer's display name from peer_friends */
  const peerFriends = useLiveQuery(() => db.peer_friends.toArray(), []) ?? []
  const partnerName = useMemo(() => {
    if (!nearestPeer) return null
    const f = peerFriends.find(f => f.peerIdString === nearestPeer.peerIdString)
    return f?.friendDisplayName ?? 'Your Partner'
  }, [nearestPeer, peerFriends])

  const bearingGlyph = nearestPeer
    ? (COMPASS_GLYPHS[nearestPeer.bearing] ?? '·')
    : null

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className={styles.card}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">⊙</span>
        <span className={styles.headerLabel}>Distance Tracker</span>
        {isOwnLocationStale && ownLastSyncAt != null && (
          <span className={styles.staleBadge} role="status" aria-label="Stale location data">
            Stale
          </span>
        )}
      </div>

      {/* ── Body — conditional on widget state ─────────────── */}

      {permissionStatus === 'unavailable' && (
        <div className={styles.deniedState}>
          <span className={styles.deniedIcon} aria-hidden="true">⊘</span>
          <p className={styles.deniedText}>
            Geolocation is not available.
            <span className={styles.deniedHint}>
              This feature requires a secure HTTPS connection.
            </span>
          </p>
        </div>
      )}

      {permissionStatus === 'denied' && (
        <div className={styles.deniedState}>
          <span className={styles.deniedIcon} aria-hidden="true">⊘</span>
          <p className={styles.deniedText}>
            Location access denied.
            <span className={styles.deniedHint}>
              Open browser settings → Site permissions → Location
              and re-allow access, then refresh.
            </span>
          </p>
        </div>
      )}

      {/* Syncing — show for any non-denied, non-unavailable state */}
      {isSyncing && permissionStatus !== 'denied' && permissionStatus !== 'unavailable' && (
        <div className={styles.syncingState} aria-live="polite" aria-label="Requesting location">
          <div className={styles.syncingDots} aria-hidden="true">
            <span className={styles.syncingDot} />
            <span className={styles.syncingDot} />
            <span className={styles.syncingDot} />
          </div>
          <span className={styles.syncingLabel}>Locating…</span>
        </div>
      )}

      {/* Permission not yet granted — prompt user to enable */}
      {!isSyncing && (permissionStatus === 'unknown' || permissionStatus === 'prompt') && (
        <div className={styles.emptyState} aria-live="polite">
          <span className={styles.emptyGlyph} aria-hidden="true">⊙</span>
          <p className={styles.emptyText}>
            Location access needed to show distance.
          </p>
          <button
            type="button"
            className={styles.syncBtn}
            onClick={syncNow}
            aria-label="Request location access"
          >
            <span className={styles.syncIcon} aria-hidden="true">⊙</span>
            Enable Location
          </button>
        </div>
      )}

      {!isSyncing && permissionStatus === 'granted' && !hasPeerLocation && !syncError && (
        <div className={styles.emptyState} aria-live="polite">
          <span className={styles.emptyGlyph} aria-hidden="true">⊙</span>
          <p className={styles.emptyText}>
            Location synced. Waiting for your partner.
          </p>
        </div>
      )}

      {permissionStatus === 'granted' && !isSyncing && hasPeerLocation && nearestPeer && (
        /* ── Active distance readout ─────────────────────── */
        <div
          className={styles.distanceBlock}
          key={nearestPeer.peerIdString}
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Distance to ${partnerName ?? 'partner'}: ${nearestPeer.distanceMiles} miles`}
        >
          {/* Readout line — the ONLY distance value exposed */}
          <p className={styles.distanceLine}>
            Distance to {partnerName ?? 'partner'} ·{' '}
            <span className={styles.distanceValue}>{nearestPeer.distanceLabel}</span>
            {' '}
            <span className={styles.distanceUnit}>miles</span>
          </p>

          {/* Bearing hint — direction without coordinates */}
          <div className={styles.bearingRow} aria-label={`Direction: ${nearestPeer.bearing}`}>
            <span className={styles.bearingArrow} aria-hidden="true">
              {bearingGlyph}
            </span>
            <span>{nearestPeer.bearing} direction</span>
            {nearestPeer.isStale && (
              <span aria-label="Peer location may be outdated">&nbsp;· location may be outdated</span>
            )}
          </div>
        </div>
      )}

      {/* ── Error strip ──────────────────────────────────────── */}
      {syncError && (
        <p className={styles.errorStrip} role="alert">
          {syncError}
        </p>
      )}

      {/* ── Footer — only once location is granted ──────────── */}
      {permissionStatus === 'granted' && (
        <div className={styles.footer}>
          <span className={styles.syncMeta}>
            {ownLastSyncAt
              ? `Synced ${relativeTime(ownLastSyncAt)}`
              : 'Not yet synced'}
          </span>

          <button
            type="button"
            className={styles.syncBtn}
            onClick={syncNow}
            disabled={isSyncing}
            aria-label="Sync location on-demand"
            title="Recalculate your current position"
          >
            <span
              className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}
              aria-hidden="true"
            >
              ⟳
            </span>
            {isSyncing ? 'Syncing…' : 'Sync location'}
          </button>
        </div>
      )}

    </div>
  )
}
