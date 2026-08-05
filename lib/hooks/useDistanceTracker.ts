/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — useDistanceTracker
 * Phase 9 · Step 9.4 — Geolocation State + Haversine Engine Hook
 *
 * Manages the full lifecycle of the privacy-preserving distance
 * tracker:
 *
 *   1. Requests browser geolocation permission
 *   2. Polls navigator.geolocation.getCurrentPosition automatically
 *      every 12 hours (passive background sync) — only ever while the
 *      permission is ALREADY granted, and only when the stored position
 *      has aged past PASSIVE_FRESH_MS. Acquisition is a module-level
 *      singleton, so N mounted widgets share ONE request.
 *   3. Writes own coordinates to db.peer_locations['self'] (IDB only)
 *   4. Watches the peer_locations table reactively via useLiveQuery
 *   5. Computes Haversine distance to the nearest connected peer
 *      via calculateHaversineDistanceMiles — result in miles
 *   6. Exposes syncNow() for on-demand manual refresh
 *
 * Privacy guarantees enforced by this hook:
 *   • Raw coordinates are NEVER returned to the caller
 *   • Raw coordinates are NEVER exposed in JSX
 *   • Only the computed number (distanceMiles) reaches the surface
 *   • Coordinate writes go to IDB only; Supabase is never touched
 * ════════════════════════════════════════════════════════════════
 */

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLiveQuery }          from 'dexie-react-hooks'
import { db, storeSelfLocation } from '@/lib/db'
import type { PeerLocation }     from '@/types/distanceTracker'
import { SELF_LOCATION_ID, LOCATION_STALE_MS } from '@/types/distanceTracker'
import {
  calculateHaversineDistanceMiles,
  compassBearing,
  formatDistanceMiles,
} from '@/utils/geoMath'

/* ── Constants ─────────────────────────────────────────────── */

/** Passive background sync interval — twice per day */
const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1_000   // 12 hours

/**
 * A stored own-position younger than this is considered good enough for
 * the passive sync, which then skips geolocation entirely. This is a
 * "how far apart are we" widget measured in miles — a six-hour-old fix
 * is indistinguishable from a fresh one, and skipping the call avoids
 * waking the device's location stack (and the Windows location-service
 * indicator) on every launch and every widget remount.
 */
const PASSIVE_FRESH_MS = 6 * 60 * 60 * 1_000    // 6 hours

/** Cached browser fix accepted by the passive sync. */
const PASSIVE_MAX_AGE_MS = 6 * 60 * 60 * 1_000  // 6 hours

/**
 * Cached browser fix accepted by an explicit user-initiated sync.
 * Non-zero on purpose: `maximumAge: 0` forces a brand-new hardware fix
 * on every press, which is what makes the OS location indicator flash.
 * A one-minute-old fix is still "now" for a mileage readout.
 */
const MANUAL_MAX_AGE_MS = 60 * 1_000            // 1 minute

/* ══════════════════════════════════════════════════════════════
   Module-level acquisition singleton
   --------------------------------------------------------------
   Every mounted DistanceTrackerWidget shares ONE geolocation
   acquisition. Previously each hook instance owned its own
   `isSyncingRef` debounce, so the debounce was per-instance and not
   global: the widget is rendered by BOTH WidgetSandbox (Classic
   layout) and FreeWidgetCanvas (Free layout), and every remount fired
   a fresh getCurrentPosition. Measured before this change: one page
   load plus three layout toggles produced FOUR geolocation calls.
   ══════════════════════════════════════════════════════════════ */

export interface SyncOutcome {
  ok:    boolean
  code?: number
}

interface SharedSyncState {
  isSyncing: boolean
  error:     string | null
}

let sharedState: SharedSyncState = { isSyncing: false, error: null }
let inFlight: Promise<SyncOutcome> | null = null
/** Unix ms of the last successful acquisition in this browser session. */
let lastAcquiredAt = 0

const syncListeners = new Set<(s: SharedSyncState) => void>()

function emitSync(next: SharedSyncState): void {
  sharedState = next
  syncListeners.forEach(l => l(sharedState))
}

function describeGeoError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access denied. Enable it in browser settings.'
    case error.TIMEOUT:
      return 'Location request timed out — please try again.'
    default:
      return 'Unable to retrieve location. Check device GPS.'
  }
}

/**
 * Acquire the device position exactly once, no matter how many hook
 * instances ask concurrently. A request already in flight is reused.
 */
function runAcquisition(manual: boolean): Promise<SyncOutcome> {
  if (inFlight) return inFlight
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    return Promise.resolve({ ok: false })
  }

  emitSync({ isSyncing: true, error: null })

  const request = new Promise<SyncOutcome>(resolve => {
    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          // Write own coordinates — IDB ONLY. Never touches Supabase.
          await storeSelfLocation(
            position.coords.latitude,
            position.coords.longitude,
          )
        } catch {
          /* IDB write failed — non-fatal, position still acquired */
        }
        lastAcquiredAt = Date.now()
        emitSync({ isSyncing: false, error: null })
        resolve({ ok: true })
      },
      error => {
        emitSync({ isSyncing: false, error: describeGeoError(error) })
        resolve({ ok: false, code: error.code })
      },
      {
        enableHighAccuracy: false,   // battery-friendly; street-level is plenty
        timeout:            10_000,
        maximumAge:         manual ? MANUAL_MAX_AGE_MS : PASSIVE_MAX_AGE_MS,
      },
    )
  }).then(result => {
    inFlight = null
    return result
  })

  inFlight = request
  return request
}

/**
 * Passive (non-gesture) sync. Skips entirely when a recent own-position
 * already exists, so launching the app repeatedly does not re-acquire.
 */
function runPassiveSync(ownLastSyncAt: number | null): void {
  const now = Date.now()
  if (now - lastAcquiredAt < PASSIVE_FRESH_MS) return
  if (ownLastSyncAt != null && now - ownLastSyncAt < PASSIVE_FRESH_MS) {
    // Persisted position is still fresh — adopt its timestamp so other
    // instances mounting later skip too, and make no geolocation call.
    lastAcquiredAt = ownLastSyncAt
    return
  }
  void runAcquisition(false)
}

/* ── Return type ────────────────────────────────────────────── */

export type GeoPermission = 'unknown' | 'granted' | 'denied' | 'prompt' | 'unavailable'

export interface NearestPeerResult {
  peerIdString:   string
  distanceMiles:  number
  distanceLabel:  string   // formatted: "243.5"
  bearing:        string   // "NE", "SW", etc.
  lastUpdated:    number   // peer's lastUpdatedTimestamp (Unix ms)
  isStale:        boolean  // peer's location > 24 h old
}

export interface UseDistanceTrackerReturn {
  /** Formatted distance string (e.g. "243.5") — null until both locations known */
  distanceLabel:        string | null
  /** Full nearest-peer result — null if no peer location stored yet */
  nearestPeer:          NearestPeerResult | null
  /** Current browser geolocation permission state */
  permissionStatus:     GeoPermission
  /** True while getCurrentPosition is in-flight */
  isSyncing:            boolean
  /** Unix ms of the most recent successful own-location write */
  ownLastSyncAt:        number | null
  /** True if own location was stored > 24 hours ago */
  isOwnLocationStale:   boolean
  /** Error string from the most recent failed sync */
  syncError:            string | null
  /** Trigger an immediate manual geolocation sync */
  syncNow:              () => void
  /** True if at least one peer location exists in IDB */
  hasPeerLocation:      boolean
}

/* ══════════════════════════════════════════════════════════════
   Hook
   ══════════════════════════════════════════════════════════════ */

export function useDistanceTracker(): UseDistanceTrackerReturn {

  /* ── Mutable refs (avoid stale closures in intervals) ────── */
  const isMountedRef    = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  /* ── Local state ─────────────────────────────────────────── */
  const [permissionStatus, setPermissionStatus] = useState<GeoPermission>('unknown')

  /* Sync state is shared across every mounted instance. */
  const [sync, setSync] = useState<SharedSyncState>(sharedState)
  useEffect(() => {
    syncListeners.add(setSync)
    setSync(sharedState)
    return () => { syncListeners.delete(setSync) }
  }, [])

  const isSyncing = sync.isSyncing
  const syncError = sync.error

  /* ── Reactive IDB subscription ───────────────────────────── */
  // Any write to peer_locations (own or peer) automatically triggers
  // a re-render and re-computation of the nearest distance.
  const rawLocations = useLiveQuery(
    () => db.peer_locations.toArray(),
    [],
  )
  /** false until Dexie has delivered the first result (boot frame). */
  const locationsLoaded = rawLocations !== undefined
  const allLocations: PeerLocation[] = rawLocations ?? []

  /* ── Derived location state ──────────────────────────────── */
  const ownLocation = useMemo(
    () => allLocations.find(l => l.peerIdString === SELF_LOCATION_ID),
    [allLocations],
  )
  const peerLocations = useMemo(
    () => allLocations.filter(l => l.peerIdString !== SELF_LOCATION_ID),
    [allLocations],
  )

  /* ── Haversine distance computation ─────────────────────────
     Runs only when allLocations changes — never on every render.
     Coordinates flow into calculateHaversineDistanceMiles but the
     raw values are never returned out of this useMemo.           */
  const nearestPeer = useMemo((): NearestPeerResult | null => {
    if (!ownLocation || peerLocations.length === 0) return null

    let best: NearestPeerResult | null = null

    for (const peer of peerLocations) {
      // ─── coordinates are used HERE only ─────────────────────
      const miles = calculateHaversineDistanceMiles(
        ownLocation.latitude,  ownLocation.longitude,
        peer.latitude,         peer.longitude,
      )
      const bearing = compassBearing(
        ownLocation.latitude,  ownLocation.longitude,
        peer.latitude,         peer.longitude,
      )
      // ─── raw coordinates never leave this closure ─────────

      const isStale = (Date.now() - peer.lastUpdatedTimestamp) > LOCATION_STALE_MS

      if (!best || miles < best.distanceMiles) {
        best = {
          peerIdString:  peer.peerIdString,
          distanceMiles: miles,
          distanceLabel: formatDistanceMiles(miles),
          bearing,
          lastUpdated:   peer.lastUpdatedTimestamp,
          isStale,
        }
      }
    }

    return best
  }, [ownLocation, peerLocations])

  /* ── Permission probe ────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setPermissionStatus('unavailable')
      return
    }

    if (!('permissions' in navigator)) {
      setPermissionStatus('prompt')
      return
    }

    let permResult: PermissionStatus | null = null
    // The query is async: if this effect is torn down before it settles
    // (StrictMode's simulated remount, or a fast layout switch) the
    // cleanup below would run while permResult is still null and leave
    // an orphaned onchange handler attached forever.
    let cancelled = false

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(result => {
        if (cancelled) return
        permResult = result
        setPermissionStatus(result.state as GeoPermission)
        result.onchange = () => {
          if (isMountedRef.current) {
            setPermissionStatus(result.state as GeoPermission)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPermissionStatus('prompt')
      })

    return () => {
      cancelled = true
      if (permResult) permResult.onchange = null
    }
  }, [])

  /* ── Computed own-location freshness ──────────────────────── */

  const ownLastSyncAt = ownLocation?.lastUpdatedTimestamp ?? null

  /* Kept in a ref so the polling interval reads the current value
     without re-registering on every IDB write. */
  const ownLastSyncAtRef = useRef(ownLastSyncAt)
  ownLastSyncAtRef.current = ownLastSyncAt

  /* ── Manual sync (explicit user gesture) ──────────────────── */
  const syncNow = useCallback(() => {
    void runAcquisition(true).then(result => {
      if (!isMountedRef.current) return
      if (result.ok) setPermissionStatus('granted')
      else if (result.code === 1 /* PERMISSION_DENIED */) setPermissionStatus('denied')
    })
  }, [])

  /* ── Passive 12-hour background polling ──────────────────── */
  useEffect(() => {
    // Only auto-sync when the browser has ALREADY granted geolocation.
    // Calling getCurrentPosition() while the permission is still 'prompt'
    // is what makes the browser ask for location on every page load. The
    // user grants location explicitly via the "Enable Location" /
    // "Sync location" buttons (syncNow) — the only path allowed to
    // surface a prompt.
    if (permissionStatus !== 'granted') return
    // Wait for Dexie's first result so the freshness check below sees the
    // stored position instead of an empty boot frame.
    if (!locationsLoaded) return

    runPassiveSync(ownLastSyncAtRef.current)

    const timer = setInterval(
      () => runPassiveSync(ownLastSyncAtRef.current),
      SYNC_INTERVAL_MS,
    )
    return () => clearInterval(timer)
  }, [permissionStatus, locationsLoaded])  // re-arms once permission flips to 'granted'

  /* ── Computed return values ───────────────────────────────── */

  const isOwnLocationStale = ownLastSyncAt != null
    ? (Date.now() - ownLastSyncAt) > LOCATION_STALE_MS
    : false

  return {
    distanceLabel:      nearestPeer?.distanceLabel ?? null,
    nearestPeer,
    permissionStatus,
    isSyncing,
    ownLastSyncAt,
    isOwnLocationStale,
    syncError,
    syncNow,
    hasPeerLocation:    peerLocations.length > 0,
  }
}
