'use client'

import { useState, useMemo } from 'react'
import { CORNELL_FLORA } from '@/config/botanyData'
import type { FloraType } from '@/types/botany'
import styles from './ForagingLog.module.css'

/* ── Constants ───────────────────────────────────────────────────── */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const TYPE_LABEL: Record<FloraType, string> = {
  forageable_edible: 'Forageable',
  ornamental_bloom:  'Bloom',
  foliage:           'Foliage',
}

/* ── Seasonal theme resolver ─────────────────────────────────────── */

interface SeasonTheme {
  color: string
  dim: string
  border: string
  label: string
}

function getSeasonTheme(month: number): SeasonTheme {
  // Spring — April (3) and May (4)
  if (month === 3 || month === 4) return {
    color:  '#52cca3',
    dim:    'rgba(82, 204, 163, 0.13)',
    border: 'rgba(82, 204, 163, 0.38)',
    label:  'Spring',
  }
  // Autumn — September (8) and October (9)
  if (month === 8 || month === 9) return {
    color:  '#cc8f52',
    dim:    'rgba(204, 143, 82, 0.13)',
    border: 'rgba(204, 143, 82, 0.38)',
    label:  'Autumn',
  }
  // Default — Slate-Indigo (Winter / Summer)
  return {
    color:  '#7c95ff',
    dim:    'rgba(124, 149, 255, 0.11)',
    border: 'rgba(124, 149, 255, 0.28)',
    label:  month <= 2 || month === 11 ? 'Winter' : 'Summer',
  }
}

/* ── Component ───────────────────────────────────────────────────── */

export default function ForagingLog() {
  const currentMonth = new Date().getMonth()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const theme = getSeasonTheme(selectedMonth)

  const activeFlora = useMemo(
    () => CORNELL_FLORA.filter(f => f.peakMonths.includes(selectedMonth)),
    [selectedMonth],
  )

  return (
    <div
      className={styles.foragingLog}
      style={{
        '--season-color':  theme.color,
        '--season-dim':    theme.dim,
        '--season-border': theme.border,
      } as React.CSSProperties}
    >

      {/* ── Season header ───────────────────────────────────── */}
      <div className={styles.seasonHeader}>
        <div className={styles.seasonBadge}>{theme.label}</div>
        <div className={styles.headerRight}>
          <span className={styles.monthTitle}>{MONTHS_FULL[selectedMonth]}</span>
          <span className={styles.peakCount}>
            {activeFlora.length} species at peak
          </span>
        </div>
      </div>

      {/* ── Month selector row ──────────────────────────────── */}
      <div className={styles.monthSelector}>
        {MONTHS_SHORT.map((m, i) => {
          const t = getSeasonTheme(i)
          const isSelected = i === selectedMonth
          const isCurrent  = i === currentMonth
          return (
            <button
              key={m}
              className={[
                styles.monthChip,
                isSelected ? styles.monthChipSelected : '',
                isCurrent && !isSelected ? styles.monthChipCurrent : '',
              ].join(' ')}
              onClick={() => setSelectedMonth(i)}
              style={
                isSelected
                  ? { '--chip-color': t.color, '--chip-dim': t.dim, '--chip-border': t.border } as React.CSSProperties
                  : undefined
              }
            >
              {m}
              {CORNELL_FLORA.some(f => f.peakMonths.includes(i)) && (
                <span
                  className={styles.chipDot}
                  style={isSelected ? { background: t.color } : undefined}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Species × month matrix ──────────────────────────── */}
      <div className={styles.matrixContainer}>
        <div className={styles.matrixScroll}>
          <div className={styles.matrix}>

            {/* Header row */}
            <div className={styles.matrixHeaderRow}>
              <div className={styles.matrixSpeciesCol}>Species</div>
              {MONTHS_SHORT.map((m, i) => (
                <div
                  key={m}
                  className={[
                    styles.matrixMonthHead,
                    i === selectedMonth ? styles.matrixMonthActive : '',
                  ].join(' ')}
                >
                  {m}
                </div>
              ))}
            </div>

            {/* Species rows */}
            {CORNELL_FLORA.map(flora => (
              <div key={flora.id} className={styles.matrixRow}>
                <div className={styles.matrixSpeciesCell}>
                  <span className={`${styles.typeDot} ${styles[`dot_${flora.type}`]}`} />
                  <span className={styles.matrixSpeciesName}>
                    {flora.speciesName.split('(')[0].trim()}
                  </span>
                </div>
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className={[
                      styles.matrixCell,
                      i === selectedMonth ? styles.matrixCellActive : '',
                    ].join(' ')}
                  >
                    {flora.peakMonths.includes(i)
                      ? <span className={`${styles.peakDot} ${styles[`dot_${flora.type}`]}`} />
                      : <span className={styles.emptyDot} />
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <span className={`${styles.legendDot} ${styles.dot_forageable_edible}`} />Forageable
            <span className={`${styles.legendDot} ${styles.dot_ornamental_bloom}`}  />Bloom
            <span className={`${styles.legendDot} ${styles.dot_foliage}`}           />Foliage
          </div>
        </div>
      </div>

      {/* ── Active flora cards ──────────────────────────────── */}
      <div className={styles.activeSection}>
        <div className={styles.sectionLabel}>
          Active in {MONTHS_FULL[selectedMonth]}
        </div>

        {activeFlora.length === 0 ? (
          <div className={styles.emptyState}>
            No species registered at peak for this month.
          </div>
        ) : (
          <div className={styles.floraGrid}>
            {activeFlora.map(flora => (
              <div
                key={flora.id}
                className={`${styles.floraCard} ${styles[`card_${flora.type}`]}`}
              >
                <div className={styles.floraCardTop}>
                  <span className={`${styles.typeBadge} ${styles[`badge_${flora.type}`]}`}>
                    {TYPE_LABEL[flora.type]}
                  </span>
                  <div className={styles.floraName}>{flora.speciesName}</div>
                </div>
                <p className={styles.floraDesc}>{flora.description}</p>
                <div className={styles.floraLocations}>
                  {flora.primaryLocations.map(loc => (
                    <span key={loc} className={styles.locChip}>{loc}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
