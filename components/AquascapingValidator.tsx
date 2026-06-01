'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Aquascaping Biological Compatibility Validator
   Phase 4 · Step 4.1

   Two-panel dashboard:
     Left  — Tank profile (volume, temp, pH sliders) + species combobox
     Right — Live audit feed (bioload bar, parameter summary, conflict cards)
   ════════════════════════════════════════════════════════════════ */

import {
  useState, useMemo, useRef, useEffect, useCallback,
  type KeyboardEvent, type CSSProperties,
} from 'react'
import type { AquaSpecies, TankInhabitant } from '@/types/aquascaping'
import { SPECIES_LIBRARY, analyzeCompatibility } from '@/utils/aquascapingMath'
import styles from './AquascapingValidator.module.css'

/* ── Constants ────────────────────────────────────────────────── */

type TypeFilter = 'all' | 'fish' | 'shrimp' | 'snail' | 'plant'

const TYPE_ACCENT: Record<string, string> = {
  fish:   '#52cca3',
  shrimp: '#f0a060',
  snail:  '#90b8c0',
  plant:  '#68c87a',
}

const AGGRESSION_LABEL: Record<string, string> = {
  peaceful:        'Peaceful',
  'semi-aggressive': 'Semi',
  aggressive:      'Aggressive',
}

const CONFLICT_TYPE_LABEL: Record<string, string> = {
  temperature:   'Temperature',
  ph:            'pH',
  predator_prey: 'Predator / Prey',
  tank_size:     'Tank Size',
  aggression:    'Aggression',
}

/* ── Component ────────────────────────────────────────────────── */

export default function AquascapingValidator() {

  /* Tank config */
  const [tankGallons, setTankGallons] = useState(20)
  const [tankTemp,    setTankTemp]    = useState(76)
  const [tankPh,      setTankPh]      = useState(7.0)

  /* Inhabitants */
  const [inhabitants, setInhabitants] = useState<TankInhabitant[]>([])

  /* Combobox */
  const [query,        setQuery]        = useState('')
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all')
  const [isOpen,       setIsOpen]       = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  /* ── Report (pure memoised calculation) ─────────────────────── */
  const report = useMemo(
    () => analyzeCompatibility(
      { volumeGallons: tankGallons, temperature: tankTemp, pH: tankPh },
      inhabitants,
    ),
    [tankGallons, tankTemp, tankPh, inhabitants],
  )

  /* ── Filtered species for dropdown ──────────────────────────── */
  const filteredSpecies = useMemo(() => {
    const q = query.toLowerCase().trim()
    return SPECIES_LIBRARY.filter(s => {
      const matchType  = typeFilter === 'all' || s.type === typeFilter
      const matchQuery = !q || s.name.toLowerCase().includes(q)
      return matchType && matchQuery
    })
  }, [query, typeFilter])

  /* ── O(1) lookup of added species ───────────────────────────── */
  const inhabitantSet = useMemo(
    () => new Set(inhabitants.map(i => i.species.id)),
    [inhabitants],
  )

  /* ── Mutations ───────────────────────────────────────────────── */
  const addSpecies = useCallback((species: AquaSpecies) => {
    setInhabitants(prev => {
      const existing = prev.find(i => i.species.id === species.id)
      if (existing) {
        return prev.map(i =>
          i.species.id === species.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { species, quantity: 1 }]
    })
    setQuery('')
    setIsOpen(false)
    setHighlightIdx(0)
  }, [])

  const adjustQuantity = useCallback((id: string, delta: number) => {
    setInhabitants(prev =>
      prev
        .map(i => i.species.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0),
    )
  }, [])

  const removeSpecies = useCallback((id: string) => {
    setInhabitants(prev => prev.filter(i => i.species.id !== id))
  }, [])

  const clearAll = useCallback(() => setInhabitants([]), [])

  /* ── Keyboard navigation ─────────────────────────────────────── */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true)
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, filteredSpecies.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredSpecies[highlightIdx]) addSpecies(filteredSpecies[highlightIdx])
        break
      case 'Escape':
        setIsOpen(false)
        setQuery('')
        break
    }
  }, [isOpen, filteredSpecies, highlightIdx, addSpecies])

  /* ── Close on outside click ──────────────────────────────────── */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        inputRef.current    && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  /* Reset highlight when filter/query changes */
  useEffect(() => setHighlightIdx(0), [filteredSpecies])

  /* ── Derived audit values ────────────────────────────────────── */
  const criticalCount = report.conflicts.filter(c => c.severity === 'critical').length
  const warningCount  = report.conflicts.filter(c => c.severity === 'warning').length
  const totalCount    = inhabitants.reduce((n, i) => n + i.quantity, 0)

  const bioloadColor =
    report.bioload.capacityPct > 100 ? 'var(--v-critical)'
    : report.bioload.capacityPct > 70  ? 'var(--v-warn)'
    : 'var(--v-accent)'

  /* ── Slider fill helper ──────────────────────────────────────── */
  const fillPct = (val: number, min: number, max: number) =>
    ({ '--fill-pct': `${((val - min) / (max - min)) * 100}%` } as CSSProperties)

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.validator}>
      <div className={styles.layout}>

        {/* ══════════════════════════════════════════════════════
            LEFT PANEL — Tank profile & species selector
            ══════════════════════════════════════════════════════ */}
        <div className={styles.panel}>

          {/* Header */}
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Tank Profile</span>
          </div>

          {/* Volume slider */}
          <div className={styles.sliderGroup}>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>Volume</span>
              <span className={styles.sliderValue}>{tankGallons} gal</span>
            </div>
            <input
              type="range" min={5} max={250} step={5}
              value={tankGallons}
              onChange={e => setTankGallons(Number(e.target.value))}
              className={styles.slider}
              style={fillPct(tankGallons, 5, 250)}
            />
            <div className={styles.sliderTicks}>
              <span>5 gal</span><span>125 gal</span><span>250 gal</span>
            </div>
          </div>

          {/* Temperature slider */}
          <div className={styles.sliderGroup}>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>Temperature</span>
              <span className={styles.sliderValue}>{tankTemp}°F</span>
            </div>
            <input
              type="range" min={50} max={95} step={1}
              value={tankTemp}
              onChange={e => setTankTemp(Number(e.target.value))}
              className={styles.slider}
              style={fillPct(tankTemp, 50, 95)}
            />
            <div className={styles.sliderTicks}>
              <span>50°F</span><span>72°F</span><span>95°F</span>
            </div>
          </div>

          {/* pH slider */}
          <div className={styles.sliderGroup}>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>pH</span>
              <span className={styles.sliderValue}>{tankPh.toFixed(1)}</span>
            </div>
            <input
              type="range" min={5.0} max={9.0} step={0.1}
              value={tankPh}
              onChange={e => setTankPh(Number(e.target.value))}
              className={styles.slider}
              style={fillPct(tankPh, 5.0, 9.0)}
            />
            <div className={styles.sliderTicks}>
              <span>pH 5.0</span><span>pH 7.0</span><span>pH 9.0</span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Species selector */}
          <div className={styles.selectorSection}>
            <div className={styles.selectorHeader}>
              <span className={styles.panelLabel}>Add Species</span>
            </div>

            {/* Type filter chips */}
            <div className={styles.typeFilters}>
              {(['all', 'fish', 'shrimp', 'snail', 'plant'] as TypeFilter[]).map(t => (
                <button
                  key={t}
                  className={`${styles.filterChip} ${typeFilter === t ? styles.filterChipActive : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                </button>
              ))}
            </div>

            {/* Combobox */}
            <div className={styles.combobox}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search species…"
                value={query}
                onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                className={styles.searchInput}
                aria-label="Search species"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                autoComplete="off"
              />

              {isOpen && (
                <div
                  ref={dropdownRef}
                  className={styles.dropdown}
                  role="listbox"
                >
                  {filteredSpecies.length === 0 ? (
                    <div className={styles.dropdownEmpty}>No species found</div>
                  ) : filteredSpecies.map((species, idx) => (
                    <button
                      key={species.id}
                      role="option"
                      aria-selected={inhabitantSet.has(species.id)}
                      className={`${styles.dropdownItem} ${idx === highlightIdx ? styles.dropdownItemActive : ''}`}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => addSpecies(species)}
                    >
                      <div className={styles.dropdownMain}>
                        <span
                          className={styles.speciesTypeBadge}
                          style={{ color: TYPE_ACCENT[species.type] }}
                        >
                          {species.type}
                        </span>
                        <span className={styles.dropdownName}>{species.name}</span>
                        {inhabitantSet.has(species.id) && (
                          <span className={styles.addedPill}>Added</span>
                        )}
                      </div>
                      <div className={styles.dropdownMeta}>
                        <span>{species.minTankSize}+ gal</span>
                        <span>{species.tempMin}–{species.tempMax}°F</span>
                        <span>pH {species.phMin}–{species.phMax}</span>
                        <span
                          className={`${styles.aggrTag} ${
                            species.aggression === 'peaceful'        ? styles.aggrPeaceful :
                            species.aggression === 'semi-aggressive' ? styles.aggrSemi :
                            styles.aggrAggressive
                          }`}
                        >
                          {AGGRESSION_LABEL[species.aggression]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inhabitants list */}
          {inhabitants.length > 0 && (
            <div className={styles.inhabitantsList}>
              <div className={styles.inhabitantsHeader}>
                <span className={styles.panelLabel}>
                  Inhabitants · {totalCount} individual{totalCount !== 1 ? 's' : ''}
                </span>
                <button className={styles.clearBtn} onClick={clearAll}>Clear all</button>
              </div>

              {inhabitants.map(({ species, quantity }) => (
                <div key={species.id} className={styles.inhabitantRow}>
                  <div className={styles.inhabitantInfo}>
                    <span
                      className={styles.inhabitantTypeLabel}
                      style={{ color: TYPE_ACCENT[species.type] }}
                    >
                      {species.type}
                    </span>
                    <span className={styles.inhabitantName}>{species.name}</span>
                  </div>
                  <div className={styles.qtyControls}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => adjustQuantity(species.id, -1)}
                      aria-label="Decrease quantity"
                    >−</button>
                    <span className={styles.qtyValue}>{quantity}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => adjustQuantity(species.id, +1)}
                      aria-label="Increase quantity"
                    >+</button>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeSpecies(species.id)}
                      aria-label={`Remove ${species.name}`}
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            RIGHT PANEL — Ecosystem audit feed
            ══════════════════════════════════════════════════════ */}
        <div className={styles.panel}>

          {/* Header + status chips */}
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Ecosystem Audit</span>
            <div className={styles.statusChips}>
              {criticalCount > 0 && (
                <span className={`${styles.statusChip} ${styles.chipCritical}`}>
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className={`${styles.statusChip} ${styles.chipWarning}`}>
                  {warningCount} Warning
                </span>
              )}
              {inhabitants.length > 0 && report.conflicts.length === 0 && (
                <span className={`${styles.statusChip} ${styles.chipOk}`}>All Clear</span>
              )}
            </div>
          </div>

          {/* Bioload meter */}
          <div className={styles.bioloadBlock}>
            <div className={styles.bioloadTop}>
              <span className={styles.bioloadLabel}>Bioload Capacity</span>
              <span className={styles.bioloadPct} style={{ color: bioloadColor }}>
                {report.bioload.capacityPct.toFixed(1)}%
              </span>
            </div>
            <div className={styles.bioloadTrack}>
              <div
                className={styles.bioloadFill}
                style={{
                  width: `${Math.min(report.bioload.capacityPct, 100)}%`,
                  background: bioloadColor,
                }}
              />
              <div className={styles.marker70} title="70% threshold" />
            </div>
            <div className={styles.bioloadFooter}>
              <span>{report.bioload.totalBioload.toFixed(2)} / {report.bioload.capacity.toFixed(1)} units</span>
              <span>{totalCount} individual{totalCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Parameter compatibility grid */}
          {inhabitants.length > 0 && (
            <div className={styles.paramGrid}>
              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>Viable Temp Range</span>
                <span className={styles.paramValue}>
                  {report.overlapTempMin !== null
                    ? `${report.overlapTempMin}–${report.overlapTempMax}°F`
                    : <span className={styles.paramConflict}>No Overlap</span>}
                </span>
              </div>
              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>Viable pH Range</span>
                <span className={styles.paramValue}>
                  {report.overlapPhMin !== null
                    ? `${report.overlapPhMin.toFixed(1)}–${report.overlapPhMax!.toFixed(1)}`
                    : <span className={styles.paramConflict}>No Overlap</span>}
                </span>
              </div>
              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>Tank Volume</span>
                <span className={styles.paramValue}>{tankGallons} gal</span>
              </div>
              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>Ecosystem Status</span>
                <span
                  className={styles.paramValue}
                  style={{
                    color: report.isViable ? 'var(--v-accent)' : 'var(--v-critical)',
                  }}
                >
                  {report.isViable ? 'Viable' : 'Conflict Detected'}
                </span>
              </div>
            </div>
          )}

          {/* Conflict feed / empty / all-clear */}
          {inhabitants.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No inhabitants configured</p>
              <p className={styles.emptyBody}>
                Add species from the left panel to run the biological compatibility analysis.
              </p>
            </div>
          ) : report.conflicts.length === 0 ? (
            <div className={styles.allClear}>
              <div className={styles.allClearDot} />
              <div>
                <p className={styles.allClearTitle}>Ecosystem Compatible</p>
                <p className={styles.allClearBody}>
                  All selected species share viable temperature, pH, and behavioral parameters.
                  No biological conflicts detected.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.conflictFeed}>
              {report.conflicts.map((conflict, idx) => (
                <div
                  key={`${conflict.type}-${idx}`}
                  className={`${styles.conflictCard} ${
                    conflict.severity === 'critical'
                      ? styles.conflictCritical
                      : styles.conflictWarning
                  } anim-scale-in`}
                  style={{ animationDelay: `${idx * 55}ms` }}
                >
                  <div className={styles.conflictHeader}>
                    <span className={styles.conflictBadge}>
                      {conflict.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                    <span className={styles.conflictTypeLabel}>
                      {CONFLICT_TYPE_LABEL[conflict.type] ?? conflict.type}
                    </span>
                  </div>
                  <p className={styles.conflictMessage}>{conflict.message}</p>
                  {conflict.speciesInvolved.length > 0 && (
                    <div className={styles.conflictSpecies}>
                      {conflict.speciesInvolved.map(name => (
                        <span key={name} className={styles.conflictSpeciesChip}>{name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
