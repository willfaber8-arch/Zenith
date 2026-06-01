'use client'
/**
 * GritAnalyticsChart — Phase 5 · Step 5.3
 * ────────────────────────────────────────────────────────────────
 * Pure-SVG time-series line chart rendering a 30-day rolling
 * Grit Score. Follows the established ParameterChart pattern:
 *   • Cubic-Bézier smooth path (midpoint control-point algorithm)
 *   • Gradient fill below the curve (periwinkle → transparent)
 *   • X-axis label decimation (max 7 labels across 30 data points)
 *   • Fixed Y-axis 0–100 with grid lines at 0/25/50/75/100
 *
 * SSR safety: chart renders only after client mount (useState/useEffect
 * pattern) to prevent hydration mismatches.
 *
 * Beneath the chart:
 *   • Three-stat summary row (Current / 7-Day Avg / 30-Day High)
 *   • Trajectory callout based on 3-day slope evaluation
 */

import { useState, useEffect, useMemo }  from 'react'
import {
  evaluateTrend,
  latestScore,
  weeklyAverage,
  periodHigh,
  type GritDataPoint,
  type GritTrend,
}                                         from '@/utils/gritScore'
import styles from './GritAnalyticsChart.module.css'

/* ════════════════════════════════════════════════════════════════
   SVG LAYOUT CONSTANTS  (matches ParameterChart conventions)
   ════════════════════════════════════════════════════════════════ */

const VW  = 560
const VH  = 200
const PAD = { top: 16, right: 20, bottom: 40, left: 50 } as const
const PW  = VW - PAD.left - PAD.right   // 490
const PH  = VH - PAD.top  - PAD.bottom  // 144

/* Y-axis ticks — fixed 0–100 scale */
const Y_TICKS = [0, 25, 50, 75, 100]

/* ════════════════════════════════════════════════════════════════
   PATH HELPERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Smooth cubic-Bézier path through an array of [x, y] points.
 * Uses the midpoint-tangent algorithm (same as ParameterChart).
 */
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

/** Closed area path — smooth line + vertical drop + horizontal base. */
function areaPath(pts: [number, number][], baseY: number): string {
  if (pts.length === 0) return ''
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]
  return `${line} L ${last[0]} ${baseY} L ${pts[0][0]} ${baseY} Z`
}

/* ════════════════════════════════════════════════════════════════
   TREND CALLOUT CONFIG
   ════════════════════════════════════════════════════════════════ */

const TREND_CONFIG: Record<GritTrend, { cls: string; label: string }> = {
  gaining: {
    cls:   styles.trendGaining,
    label: 'TRAJECTORY: GAINING MOMENTUM',
  },
  recovering: {
    cls:   styles.trendRecovering,
    label: 'TRAJECTORY: RECOVERY CRITICAL // INITIATE HABIT STACKING',
  },
  steady: {
    cls:   styles.trendSteady,
    label: 'TRAJECTORY: HOLDING STEADY',
  },
}

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

interface Props {
  points: GritDataPoint[]
}

export default function GritAnalyticsChart({ points }: Props) {

  /* ── Client-side mount guard (SSR safety) ──────────────────── */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  /* ── Derived values ────────────────────────────────────────── */
  const trend     = useMemo(() => evaluateTrend(points), [points])
  const current   = useMemo(() => latestScore(points),   [points])
  const avg7      = useMemo(() => weeklyAverage(points), [points])
  const high30    = useMemo(() => periodHigh(points),    [points])

  /* Pixel coordinate helpers */
  const n     = points.length
  const xOf   = (i: number) =>
    PAD.left + (n <= 1 ? PW / 2 : (i / (n - 1)) * PW)
  const yOf   = (v: number) =>
    PAD.top + PH - (v / 100) * PH

  /* SVG point coords from score data */
  const pts = useMemo<[number, number][]>(
    () => points.map((p, i) => [xOf(i), yOf(p.score)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points],
  )

  /* X-axis label decimation — show at most 7 labels for 30 points */
  const xLabels = useMemo(() => {
    if (points.length === 0) return []
    const step = Math.max(1, Math.ceil(points.length / 7))
    return points
      .map((p, i) => ({ i, label: p.label }))
      .filter((_, i) => i % step === 0 || i === points.length - 1)
  }, [points])

  const trendInfo = TREND_CONFIG[trend]

  /* ── Skeleton (pre-mount) ──────────────────────────────────── */
  if (!mounted) {
    return (
      <div className={styles.card}>
        <div className={styles.skeleton} aria-busy="true" />
      </div>
    )
  }

  /* ── Empty state (no habits yet) ───────────────────────────── */
  if (points.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Grit Score · 30-Day Trend</p>
        </div>
        <div className={styles.emptyState} role="status">
          <span className={styles.emptyIcon} aria-hidden="true">◈</span>
          <p className={styles.emptyText}>No habit data to analyse yet.</p>
          <p className={styles.emptySubtext}>
            Start tracking habits in Study Shield to see your Grit Score
            develop over time.
          </p>
        </div>
      </div>
    )
  }

  /* ── Full chart ────────────────────────────────────────────── */
  const linePath  = smoothPath(pts)
  const fillPath  = areaPath(pts, yOf(0))
  const gradId    = 'grit-area-gradient'

  return (
    <div className={styles.card}>

      {/* Header */}
      <div className={styles.header}>
        <p className={styles.eyebrow}>Grit Score · 30-Day Trend</p>
        <div className={styles.currentScore} aria-label={`Current Grit Score: ${current}`}>
          <span className={styles.scoreNum}>{current}</span>
          <span className={styles.scoreUnit}>/ 100</span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className={styles.svg}
        aria-label="30-day Grit Score time series"
        role="img"
      >
        <defs>
          {/* Periwinkle gradient fill — top opacity fades to transparent */}
          <linearGradient
            id={gradId}
            x1="0" y1={PAD.top}
            x2="0" y2={VH - PAD.bottom}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#7c95ff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#7c95ff" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {Y_TICKS.map(tick => (
          <g key={tick}>
            <line
              x1={PAD.left}       y1={yOf(tick)}
              x2={PAD.left + PW}  y2={yOf(tick)}
              stroke="rgba(124,149,255,0.07)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="rgba(155,163,196,0.65)"
              fontSize={9}
              fontFamily="'Cascadia Code', monospace"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Gradient fill area */}
        <path
          d={fillPath}
          fill={`url(#${gradId})`}
        />

        {/* Main score line — periwinkle (#7c95ff) anti-aliased Bézier */}
        <path
          d={linePath}
          fill="none"
          stroke="#7c95ff"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          shapeRendering="geometricPrecision"
        />

        {/* Latest-point marker dot */}
        {pts.length > 0 && (
          <circle
            cx={pts[pts.length - 1][0]}
            cy={pts[pts.length - 1][1]}
            r={4}
            fill="#7c95ff"
            stroke="var(--surface-card)"
            strokeWidth={2}
          />
        )}

        {/* X-axis date labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xOf(i)}
            y={VH - 8}
            textAnchor="middle"
            fill="rgba(155,163,196,0.55)"
            fontSize={8}
            fontFamily="'Cascadia Code', monospace"
          >
            {label}
          </text>
        ))}

        {/* X-axis baseline */}
        <line
          x1={PAD.left}       y1={yOf(0)}
          x2={PAD.left + PW}  y2={yOf(0)}
          stroke="rgba(124,149,255,0.15)"
          strokeWidth={1}
        />
      </svg>

      {/* Three-stat summary row */}
      <div className={styles.statRow} aria-label="Grit Score statistics">
        <div className={styles.statCell}>
          <span className={styles.statCellLabel}>Current</span>
          <span className={styles.statCellValue}>{current}</span>
          <span className={styles.statCellUnit}>points</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statCellLabel}>7-Day Avg</span>
          <span className={styles.statCellValue}>{avg7}</span>
          <span className={styles.statCellUnit}>avg</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statCellLabel}>30-Day High</span>
          <span className={styles.statCellValue}>{high30}</span>
          <span className={styles.statCellUnit}>peak</span>
        </div>
      </div>

      {/* Trajectory callout */}
      <div
        className={`${styles.trendCallout} ${trendInfo.cls}`}
        role="status"
        aria-label={`Trajectory: ${trend}`}
      >
        <div className={styles.trendDot} aria-hidden="true" />
        <span className={styles.trendTag}>[ {trendInfo.label} ]</span>
      </div>

    </div>
  )
}
