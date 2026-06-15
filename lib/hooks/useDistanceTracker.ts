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
 *      every 12 hours (passive background sync)
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
  const isSyncingRef    = useRef(false)
  const isMountedRef    = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  /* ── Local state ─────────────────────────────────────────── */
  const [permissionStatus, setPermissionStatus] = useState<GeoPermission>('unknown')
  const [isSyncing,        setIsSyncing]        = useState(false)
  const [syncError,        setSyncError]        = useState<string | null>(null)

  /* ── Reactive IDB subscription ───────────────────────────── */
  // Any write to peer_locations (own or peer) automatically triggers
  // a re-render and re-computation of the nearest distance.
  const allLocations: PeerLocation[] = useLiveQuery(
    () => db.peer_locations.toArray(),
    [],
  ) ?? []

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

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(result => {
        permResult = result
        if (isMountedRef.current) {
          setPermissionStatus(result.state as GeoPermission)
        }
        result.onchange = () => {
          if (isMountedRef.current) {
            setPermissionStatus(result.state as GeoPermission)
          }
        }
      })
      .catch(() => {
        if (isMountedRef.current) setPermissionStatus('prompt')
      })

    return () => {
      if (permResult) permResult.onchange = null
    }
  }, [])

  /* ── Core sync function ───────────────────────────────────── */
  const performSync = useCallback(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) return
    if (isSyncingRef.current) return   // debounce: skip if already in-flight

    isSyncingRef.current = true
    if (isMountedRef.current) {
      setIsSyncing(true)
      setSyncError(null)
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Write own coordinates — IDB ONLY. Never touches Supabase.
          await storeSelfLocation(
            position.coords.latitude,
            position.coords.longitude,
          )
        } catch {
          /* IDB write failed — non-fatal, position still available */
        }
        isSyncingRef.current = false
        if (isMountedRef.current) {
          setIsSyncing(false)
          setPermissionStatus('granted')
        }
      },
      (error) => {
        isSyncingRef.current = false
        if (!isMountedRef.current) return
        setIsSyncing(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setPermissionStatus('denied')
            setSyncError('Location access denied. Enable it in browser settings.')
            break
          case error.TIMEOUT:
            setSyncError('Location request timed out — please try again.')
            break
          default:
            setSyncError('Unable to retrieve location. Check device GPS.')
        }
      },
      {
        enableHighAccuracy: false,   // battery-friendly for background polling
        timeout:            10_000,
        maximumAge:         0,       // always request a fresh reading
      },
    )
  }, [])

  /* Expose stable manual-sync callback to the widget */
  const syncNow = useCallback(() => { performSync() }, [performSync])

  /* ── Passive 12-hour background polling ──────────────────── */
  // Uses a ref to call the always-current performSync without
  // re-registering the interval on every render.
  const syncRef = useRef(performSync)
  syncRef.current = performSync

  useEffect(() => {
    // IMPORTANT: only auto-sync when the browser has ALREADY granted
    // geolocation. Calling getCurrentPosition() while the permission is
    // still 'prompt' is what made the browser ask for location on every
    // single page load. We never auto-trigger the prompt here — the user
    // grants location explicitly via the "Sync Location On-Demand" button
    // (syncNow), which is the only path allowed to surface the prompt.
    if (permissionStatus !== 'granted') return

    // Permission is already granted → safe to sync silently on mount, then
    // twice a day while the app stays open.
    syncRef.current()

    const timer = setInterval(() => syncRef.current(), SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [permissionStatus])  // re-arms once permission flips to 'granted'

  /* ── Computed return values ───────────────────────────────── */

  const ownLastSyncAt      = ownLocation?.lastUpdatedTimestamp ?? null
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
