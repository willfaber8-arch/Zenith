export type TimerStatus =
  | 'INACTIVE'
  | 'ACTIVE_HIKING'
  | 'OVERDUE_ALERT_TRIGGERED'

/**
 * Compiles a pre-formatted emergency dispatch string from the active
 * trail's metadata. Coordinates are in GeoJSON [lon, lat] order and
 * are displayed as (lat, lon) for readability.
 */
export function formatEmergencyAlert(
  userName: string,
  trailName: string,
  coordinates: [number, number][],
): string {
  const pts: [number, number][] = []
  if (coordinates.length > 0) pts.push(coordinates[0])
  if (coordinates.length > 2) pts.push(coordinates[Math.floor(coordinates.length / 2)])
  if (coordinates.length > 1) pts.push(coordinates[coordinates.length - 1])

  const coordStr =
    pts.length > 0
      ? pts.map(([lon, lat]) => `(${lat.toFixed(5)}, ${lon.toFixed(5)})`).join(' → ')
      : 'Not available'

  return (
    `EMERGENCY NOTICE: ${userName} initialized a safety check-in for the ` +
    `${trailName} route but failed to return by the checked deadline. ` +
    `Estimated Coordinates: ${coordStr}. Please initiate contact.`
  )
}
