'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Difficulty, TrailFeature } from '@/types/hiking'
import { TRAILS } from '@/data/trails'
import { exportTrailAsGpx } from '@/utils/gpxExporter'
import styles from './TrailHunter.module.css'

/* ── Leaflet map — client-only dynamic import ─────────────────────── */

const TrailMap = dynamic(() => import('./TrailMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Initializing map…</div>,
})

/* ── Constants ────────────────────────────────────────────────────── */

const MAX_DIST = 25

const FEATURE_LABELS: Record<TrailFeature, string> = {
  waterfall:     'Waterfall',
  gorge_lookout: 'Gorge Lookout',
  canopy_cover:  'Canopy Cover',
  swimming_hole: 'Swimming Hole',
}

const DIFF_LABEL: Record<Difficulty, string> = {
  easy:      'Easy',
  moderate:  'Moderate',
  strenuous: 'Strenuous',
}

/* ── Component ────────────────────────────────────────────────────── */

export default function TrailHunter() {
  const [search,         setSearch]         = useState('')
  const [maxDist,        setMaxDist]         = useState(MAX_DIST)
  const [difficulty,     setDifficulty]      = useState<Difficulty | 'all'>('all')
  const [activeFeatures, setActiveFeatures]  = useState<Set<TrailFeature>>(new Set())
  const [selectedId,     setSelectedId]      = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return TRAILS.filter(trail => {
      if (
        q &&
        !trail.name.toLowerCase().includes(q) &&
        !trail.locationRegion.toLowerCase().includes(q)
      ) return false
      if (maxDist < MAX_DIST && trail.distanceMiles > maxDist) return false
      if (difficulty !== 'all' && trail.difficulty !== difficulty) return false
      if (
        activeFeatures.size > 0 &&
        ![...activeFeatures].every(f => trail.features.includes(f))
      ) return false
      return true
    })
  }, [search, maxDist, difficulty, activeFeatures])

  // If the selected trail was filtered out, treat selection as empty
  const selectedTrail = filtered.find(t => t.id === selectedId) ?? null

  function toggleFeature(f: TrailFeature) {
    setActiveFeatures(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  function handleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id))
  }

  const fillPct  = `${((maxDist / MAX_DIST) * 100).toFixed(1)}%`
  const distLabel = maxDist >= MAX_DIST ? 'Any distance' : `≤ ${maxDist} mi`

  return (
    <div className={styles.trailHunter}>
      <div className={styles.layout}>

        {/* ── Left sidebar ─────────────────────────────────────── */}
        <aside className={styles.sidePanel}>

          {/* Search */}
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8.5 8.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Trail name or region…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Distance slider */}
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <span className={styles.filterLabel}>Max Distance</span>
              <span className={styles.filterValue}>{distLabel}</span>
            </div>
            <input
              type="range"
              min={1}
              max={MAX_DIST}
              value={maxDist}
              onChange={e => setMaxDist(Number(e.target.value))}
              className={styles.slider}
              style={{ '--fill-pct': fillPct } as React.CSSProperties}
            />
            <div className={styles.sliderScale}>
              <span>1 mi</span><span>10 mi</span><span>20+ mi</span>
            </div>
          </div>

          {/* Difficulty */}
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <span className={styles.filterLabel}>Difficulty</span>
            </div>
            <div className={styles.pillRow}>
              {(['all', 'easy', 'moderate', 'strenuous'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={[
                    styles.pill,
                    difficulty === d ? styles.pillActive : '',
                    d !== 'all' ? styles[`pill_${d}`] : '',
                  ].join(' ')}
                >
                  {d === 'all' ? 'All' : DIFF_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <span className={styles.filterLabel}>Landmark Features</span>
            </div>
            <div className={styles.featureGrid}>
              {(Object.keys(FEATURE_LABELS) as TrailFeature[]).map(f => (
                <button
                  key={f}
                  onClick={() => toggleFeature(f)}
                  className={[
                    styles.featureBtn,
                    activeFeatures.has(f) ? styles.featureBtnActive : '',
                  ].join(' ')}
                >
                  <span className={styles.featureCheck}>
                    {activeFeatures.has(f) ? '✓' : '+'}
                  </span>
                  {FEATURE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Trail list */}
          <div className={styles.trailList}>
            <div className={styles.resultsLabel}>
              {filtered.length} trail{filtered.length !== 1 ? 's' : ''} found
            </div>
            <div className={styles.trailListScroll}>
              {filtered.length === 0 ? (
                <div className={styles.emptyState}>
                  No trails match your filters.
                </div>
              ) : (
                filtered.map(trail => (
                  <button
                    key={trail.id}
                    className={[
                      styles.trailItem,
                      selectedId === trail.id ? styles.trailItemActive : '',
                    ].join(' ')}
                    onClick={() => handleSelect(trail.id)}
                  >
                    <div className={styles.trailItemName}>{trail.name}</div>
                    <div className={styles.trailItemRegion}>{trail.locationRegion}</div>
                    <div className={styles.trailItemMeta}>
                      <span className={styles.trailDist}>{trail.distanceMiles} mi</span>
                      <span className={`${styles.diffBadge} ${styles[`diff_${trail.difficulty}`]}`}>
                        {DIFF_LABEL[trail.difficulty]}
                      </span>
                    </div>
                    {trail.features.length > 0 && (
                      <div className={styles.trailTags}>
                        {trail.features.map(f => (
                          <span key={f} className={styles.tag}>{FEATURE_LABELS[f]}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* ── Map panel ────────────────────────────────────────── */}
        <main className={styles.mapPanel}>
          <div className={styles.mapFrame}>
            <TrailMap
              trails={filtered}
              selectedId={selectedId}
              onSelectTrail={handleSelect}
            />
          </div>

          {selectedTrail ? (
            <div className={styles.infoPanel} key={selectedTrail.id}>
              <div className={styles.infoHeader}>
                <div>
                  <div className={styles.infoName}>{selectedTrail.name}</div>
                  <div className={styles.infoRegion}>{selectedTrail.locationRegion}</div>
                </div>
                <div className={styles.infoStats}>
                  <span className={styles.infoStat}>{selectedTrail.distanceMiles} mi</span>
                  <span className={styles.infoStatSep}>·</span>
                  <span className={styles.infoStat}>
                    +{selectedTrail.elevationGainFt.toLocaleString()} ft
                  </span>
                  <span className={`${styles.diffBadge} ${styles[`diff_${selectedTrail.difficulty}`]}`}>
                    {DIFF_LABEL[selectedTrail.difficulty]}
                  </span>
                </div>
              </div>
              <p className={styles.infoDesc}>{selectedTrail.description}</p>
              <div className={styles.infoFeatures}>
                {selectedTrail.features.map(f => (
                  <span key={f} className={styles.tag}>{FEATURE_LABELS[f]}</span>
                ))}
              </div>
              <button
                className={styles.gpxBtn}
                onClick={() =>
                  exportTrailAsGpx(selectedTrail.name, selectedTrail.coordinates)
                }
              >
                Download Vector Track (.GPX)
              </button>
            </div>
          ) : (
            <div className={styles.infoPlaceholder}>
              Select a trail on the map or from the list to view details and export a GPS track.
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
