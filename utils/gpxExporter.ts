function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Serialises a trail's coordinate array into a standards-compliant GPX 1.1
 * document and triggers a browser download of the resulting file.
 *
 * Coordinates must be in [longitude, latitude] (GeoJSON) order — they are
 * swapped to [lat, lon] in the <trkpt> attributes as the GPX spec requires.
 */
export function exportTrailAsGpx(
  trailName: string,
  coordinates: [number, number][],
): void {
  const safeName = escapeXml(trailName)
  const timestamp = new Date().toISOString()

  const trkpts = coordinates
    .map(
      ([lon, lat]) =>
        `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"></trkpt>`,
    )
    .join('\n')

  const gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Zenith OS"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`

  const blob = new Blob([gpxString], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${trailName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.gpx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
