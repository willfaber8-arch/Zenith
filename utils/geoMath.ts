/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Geospatial Mathematics Utility
 * Phase 9 · Step 9.4 — Haversine Distance Engine
 *
 * All calculations are pure functions (no side effects, no imports,
 * no network calls). Safe to import anywhere including Server
 * Components — no browser API usage.
 *
 * Privacy note:
 *   These functions RECEIVE raw coordinates as parameters.
 *   Call sites must never log, store remotely, or render the
 *   coordinate arguments. Only the returned distance value
 *   is safe for display.
 * ════════════════════════════════════════════════════════════════
 */

/** Mean radius of the Earth in statute miles (WGS-84 reference) */
const EARTH_RADIUS_MILES = 3_958.8

/**
 * Converts decimal degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Haversine formula — great-circle distance between two points on
 * the Earth's surface, expressed in statute miles.
 *
 * Accuracy: sub-0.5% error for distances > 1 km (sufficient for
 * displaying city-level separation between peers). Uses the
 * spherical Earth model (equatorial radius 3,958.8 mi), which
 * introduces a maximum ≈ 0.3% error vs the WGS-84 ellipsoid.
 *
 * @param lat1  Latitude  of point A (decimal degrees, −90 to +90)
 * @param lon1  Longitude of point A (decimal degrees, −180 to +180)
 * @param lat2  Latitude  of point B (decimal degrees, −90 to +90)
 * @param lon2  Longitude of point B (decimal degrees, −180 to +180)
 * @returns     Distance in statute miles, rounded to 1 decimal place
 *
 * @example
 * // New York City → Los Angeles (approx. 2,450 mi)
 * calculateHaversineDistanceMiles(40.7128, -74.0060, 34.0522, -118.2437)
 * // → 2,450.9
 */
export function calculateHaversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  // Angular deltas in radians
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  // Haversine central-angle calculation
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  // Arc distance × Earth radius, rounded to 1 decimal place
  return Math.round(EARTH_RADIUS_MILES * c * 10) / 10
}

/**
 * Formats a computed distance for display.
 * Applies locale-aware thousands separator so "2450.9" renders
 * as "2,450.9" in US/UK locales — important for large distances.
 *
 * @param miles   Distance in statute miles (output of calculateHaversineDistanceMiles)
 * @returns       Formatted string, e.g. "243.5" or "2,450.9"
 */
export function formatDistanceMiles(miles: number): string {
  return miles.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/**
 * Returns the approximate cardinal compass bearing from point A to
 * point B (e.g. "NE", "SW"). Useful for a directional hint without
 * exposing raw coordinates.
 *
 * @param lat1  Origin latitude
 * @param lon1  Origin longitude
 * @param lat2  Destination latitude
 * @param lon2  Destination longitude
 * @returns     One of 8 compass directions: N, NE, E, SE, S, SW, W, NW
 */
export function compassBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const dLon   = toRadians(lon2 - lon1)
  const lat1r  = toRadians(lat1)
  const lat2r  = toRadians(lat2)

  const y      = Math.sin(dLon) * Math.cos(lat2r)
  const x      = Math.cos(lat1r) * Math.sin(lat2r) -
                 Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)

  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  const idx     = Math.round(bearing / 45) % 8
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][idx]
}
