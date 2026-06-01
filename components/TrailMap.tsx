'use client'

import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
} from 'react-leaflet'
import type { Trail } from '@/types/hiking'
import 'leaflet/dist/leaflet.css'

/* ── MapController — fits map bounds whenever trails/selection changes ── */

interface MapControllerProps {
  trails: Trail[]
  selectedId: string | null
}

function MapController({ trails, selectedId }: MapControllerProps) {
  const map = useMap()

  useEffect(() => {
    const selectedTrail = trails.find(t => t.id === selectedId)

    if (selectedId && selectedTrail) {
      const latLngs = selectedTrail.coordinates.map(
        ([lon, lat]) => [lat, lon] as [number, number],
      )
      map.fitBounds(latLngs, { padding: [48, 48], maxZoom: 14 })
    } else if (trails.length > 0) {
      const all = trails.flatMap(t =>
        t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      )
      map.fitBounds(all, { padding: [48, 48], maxZoom: 10 })
    }
  }, [map, trails, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/* ── TrailMap ────────────────────────────────────────────────────────── */

interface TrailMapProps {
  trails: Trail[]
  selectedId: string | null
  onSelectTrail: (id: string) => void
}

export default function TrailMap({
  trails,
  selectedId,
  onSelectTrail,
}: TrailMapProps) {
  const hasSelection = selectedId !== null

  return (
    <MapContainer
      center={[39.5, -98.5]}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <MapController trails={trails} selectedId={selectedId} />

      {trails.map(trail => {
        const isSelected = trail.id === selectedId
        const positions = trail.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        )

        return (
          <Polyline
            key={trail.id}
            positions={positions}
            pathOptions={{
              color: '#52cca3',
              weight: isSelected ? 4.5 : 2.5,
              opacity: hasSelection && !isSelected ? 0.28 : 1,
            }}
            eventHandlers={{ click: () => onSelectTrail(trail.id) }}
          />
        )
      })}

      {/* Start-point marker for the selected trail */}
      {trails.map(trail => {
        if (trail.id !== selectedId || trail.coordinates.length === 0) return null
        const [startLon, startLat] = trail.coordinates[0]
        return (
          <CircleMarker
            key={`start-${trail.id}`}
            center={[startLat, startLon]}
            radius={7}
            pathOptions={{
              color: '#0b0f11',
              fillColor: '#52cca3',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )
      })}
    </MapContainer>
  )
}
