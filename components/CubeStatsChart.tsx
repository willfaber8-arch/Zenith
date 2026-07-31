'use client'
/**
 * CubeStatsChart — pure-SVG solve-time trend for the Cube Timer.
 * ────────────────────────────────────────────────────────────────
 * Follows the project's hand-rolled chart pattern (GritAnalyticsChart /
 * ParameterChart): no charting library, cubic-Bézier smooth path, gradient
 * fill, decimated X labels, auto-scaled Y with formatTime tick labels.
 *
 *   • Main line — single solve time over the most-recent N solves (green).
 *   • Overlay   — rolling ao5 (periwinkle) + ao12 (amber) average lines.
 *   • DNFs      — skipped from the line, marked with a red tick at the top.
 *   • Y-axis    — auto-scaled to the finite value range (padded), labels
 *                 rendered as speedcubing times.
 *
 * SSR safety: renders only after client mount (matches GritAnalyticsChart).
 */

import { useState, useEffect, useMemo } from 'react'
import { effectiveMs, formatTime, rollingSeries, type StatSolve } from '@/utils/cubeStats'
import styles from './CubeStatsChart.module.css'

/* ── SVG layout constants ─────────────────────────────────────────── */

const VW  = 640
const VH  = 220
const PAD = { top: 18, right: 22, bottom: 40, left: 62 } as const
const PW  = VW - PAD.left - PAD.right
const PH  = VH - PAD.top  - PAD.bottom

const COL_SINGLE = '#52cca3'   // Ocean Sage green — single solve line
const COL_AO5    = '#7c95ff'   // Periwinkle       — ao5 overlay
const COL_AO12   = '#fbbf24'   // Amber            — ao12 overlay
const COL_DNF    = '#f87171'   // Rose             — DNF markers

/* ── path helpers (midpoint-tangent smoothing) ───────────────────── */

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1]
    const [x2, y2] = pts[i]
    const cpx = (x1 + x2) / 2
    d += ` C ${cpx} ${y1} ${cpx} ${y2} ${x2} ${y2}`
  }
  return d
}

function areaPath(pts: [number, number][], baseY: number): string {
  if (pts.length === 0) return ''
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]
  return `${line} L ${last[0]} ${baseY} L ${pts[0][0]} ${baseY} Z`
}

/* ── component ────────────────────────────────────────────────────── */

interface Props {
  /** Chronological (oldest → newest) solves for the current scope. */
  solves: StatSolve[]
  /** Max number of most-recent solves to plot (default 100). */
  limit?: number
  /** Section eyebrow label. */
  title?: string
  /** Show ao5 / ao12 rolling-average overlay lines (default true). */
  showAverages?: boolean
}

export default function CubeStatsChart({
  solves,
  limit = 100,
  title = 'Solve Times',
  showAverages = true,
}: Props) {

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  /* Window of the most-recent `limit` solves + aligned rolling averages. */
  const model = useMemo(() => {
    const all      = solves
    const startIdx = Math.max(0, all.length - limit)
    const win      = all.slice(startIdx)

    const ao5  = rollingSeries(all, 5).slice(startIdx)
    const ao12 = rollingSeries(all, 12).slice(startIdx)

    const singleVals = win.map(effectiveMs)   // (number|null)[]

    const finiteAll: number[] = []
    for (const v of singleVals) if (v !== null) finiteAll.push(v)
    if (showAverages) {
      for (const v of ao5)  if (v !== null) finiteAll.push(v)
      for (const v of ao12) if (v !== null) finiteAll.push(v)
    }

    return { win, startIdx, singleVals, ao5, ao12, finiteAll }
  }, [solves, limit, showAverages])

  if (!mounted) {
    return (
      <div className={styles.card}>
        <div className={styles.skeleton} aria-busy="true" />
      </div>
    )
  }

  const { win, startIdx, singleVals, ao5, ao12, finiteAll } = model

  if (win.length === 0 || finiteAll.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>{title}</p>
        </div>
        <div className={styles.emptyState} role="status">
          <span className={styles.emptyIcon} aria-hidden="true">◈</span>
          <p className={styles.emptyText}>Not enough solves to chart yet.</p>
          <p className={styles.emptySubtext}>
            Record a few solves and your time trend will appear here.
          </p>
        </div>
      </div>
    )
  }

  /* Y range — padded around the finite value spread. */
  const lo   = Math.min(...finiteAll)
  const hi   = Math.max(...finiteAll)
  const span = hi - lo
  const pad  = span > 0 ? span * 0.12 : Math.max(hi * 0.1, 500)
  const yMin = Math.max(0, lo - pad)
  const yMax = hi + pad
  const yRange = yMax - yMin || 1

  const n   = win.length
  const xOf = (i: number) => PAD.left + (n <= 1 ? PW / 2 : (i / (n - 1)) * PW)
  const yOf = (v: number) => PAD.top + PH - ((v - yMin) / yRange) * PH

  /* Build finite point sets for each series. */
  const toPts = (vals: (number | null)[]): [number, number][] => {
    const out: [number, number][] = []
    vals.forEach((v, i) => { if (v !== null) out.push([xOf(i), yOf(v)]) })
    return out
  }

  const singlePts = toPts(singleVals)
  const ao5Pts    = showAverages ? toPts(ao5)  : []
  const ao12Pts   = showAverages ? toPts(ao12) : []

  const baseY    = yOf(yMin)
  const linePath = smoothPath(singlePts)
  const fillPath = areaPath(singlePts, baseY)

  /* Y ticks — 4 evenly spaced, rendered as times. */
  const yTicks = [0, 1, 2, 3].map(k => yMin + (yRange * k) / 3)

  /* X labels — global solve number, decimated to ≤ 7. */
  const xLabels = (() => {
    const step = Math.max(1, Math.ceil(n / 7))
    const out: { i: number; label: string }[] = []
    for (let i = 0; i < n; i++) {
      if (i % step === 0 || i === n - 1) {
        out.push({ i, label: String(startIdx + i + 1) })
      }
    }
    return out
  })()

  /* DNF markers along the top. */
  const dnfMarks: number[] = []
  win.forEach((s, i) => { if (s.penalty === 'DNF') dnfMarks.push(i) })

  const gradId = 'cube-area-gradient'
  const bestVal = lo

  return (
    <div className={styles.card}>

      <div className={styles.header}>
        <p className={styles.eyebrow}>{title}</p>
        <div className={styles.legend} aria-hidden="true">
          <span className={styles.legendItem}><i style={{ background: COL_SINGLE }} />single</span>
          {showAverages && (
            <>
              <span className={styles.legendItem}><i style={{ background: COL_AO5 }} />ao5</span>
              <span className={styles.legendItem}><i style={{ background: COL_AO12 }} />ao12</span>
            </>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className={styles.svg}
        role="img"
        aria-label={`${title} — last ${n} solves`}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="0" y1={PAD.top}
            x2="0" y2={VH - PAD.bottom}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={COL_SINGLE} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COL_SINGLE} stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* horizontal grid + Y tick labels (as times) */}
        {yTicks.map((tick, k) => (
          <g key={k}>
            <line
              x1={PAD.left}      y1={yOf(tick)}
              x2={PAD.left + PW} y2={yOf(tick)}
              stroke="rgba(82,204,163,0.08)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="rgba(155,163,196,0.7)"
              fontSize={10}
              fontFamily="'Cascadia Code', monospace"
            >
              {formatTime(tick)}
            </text>
          </g>
        ))}

        {/* gradient fill under the single-solve line */}
        <path d={fillPath} fill={`url(#${gradId})`} />

        {/* ao12 overlay (behind) */}
        {ao12Pts.length > 1 && (
          <path
            d={smoothPath(ao12Pts)}
            fill="none"
            stroke={COL_AO12}
            strokeWidth={1.6}
            strokeOpacity={0.85}
            strokeDasharray="4 3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* ao5 overlay */}
        {ao5Pts.length > 1 && (
          <path
            d={smoothPath(ao5Pts)}
            fill="none"
            stroke={COL_AO5}
            strokeWidth={1.8}
            strokeOpacity={0.9}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* main single-solve line */}
        <path
          d={linePath}
          fill="none"
          stroke={COL_SINGLE}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          shapeRendering="geometricPrecision"
        />

        {/* best-single marker */}
        {singlePts.length > 0 && (() => {
          const bi = singleVals.findIndex(v => v === bestVal)
          if (bi < 0) return null
          return (
            <circle
              cx={xOf(bi)} cy={yOf(bestVal)} r={3.6}
              fill={COL_SINGLE}
              stroke="var(--surface-card)"
              strokeWidth={2}
            />
          )
        })()}

        {/* DNF markers along the top */}
        {dnfMarks.map(i => (
          <text
            key={`dnf-${i}`}
            x={xOf(i)}
            y={PAD.top + 2}
            textAnchor="middle"
            fill={COL_DNF}
            fontSize={9}
            fontFamily="'Cascadia Code', monospace"
          >
            ✕
          </text>
        ))}

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xOf(i)}
            y={VH - 8}
            textAnchor="middle"
            fill="rgba(155,163,196,0.6)"
            fontSize={9}
            fontFamily="'Cascadia Code', monospace"
          >
            {label}
          </text>
        ))}

        {/* baseline */}
        <line
          x1={PAD.left}      y1={baseY}
          x2={PAD.left + PW} y2={baseY}
          stroke="rgba(82,204,163,0.18)"
          strokeWidth={1}
        />
      </svg>
    </div>
  )
}
