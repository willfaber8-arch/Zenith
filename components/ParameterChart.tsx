'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Water Parameter Chart
   Phase 4 · Step 4.3

   Pure-SVG time-series line chart for ammonia, nitrite, and nitrate.
   No external charting library — hand-rolled smooth cubic bezier paths.
   Integrates the Nitrogen Cycle auditor: displays the stabilisation
   banner when the cycle is confirmed complete.
   ════════════════════════════════════════════════════════════════ */

import { useMemo } from 'react'
import type { WaterLog } from '@/utils/waterChemistry'
import { analyzeCycleStatus } from '@/utils/waterChemistry'
import styles from './ParameterChart.module.css'

/* ── SVG layout constants ─────────────────────────────────────── */

const VW   = 560
const VH   = 210
const PAD  = { top: 14, right: 14, bottom: 48, left: 52 }
const PW   = VW - PAD.left - PAD.right   // 494
const PH   = VH - PAD.top  - PAD.bottom  // 148

/* ── Series config ────────────────────────────────────────────── */

const SERIES = [
  { key: 'ammonia' as const, label: 'Ammonia (NH3)',  color: '#f59e0b', area: 'rgba(245,158,11,0.08)'  },
  { key: 'nitrite' as const, label: 'Nitrite (NO2⁻)',  color: '#f87171', area: 'rgba(248,113,113,0.08)' },
  { key: 'nitrate' as const, label: 'Nitrate (NO3⁻)',  color: '#52cca3', area: 'rgba(82,204,163,0.10)'  },
]

/* ── Helpers ──────────────────────────────────────────────────── */

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

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function niceMax(v: number): number {
  if (v <= 0) return 4
  const step = v <= 5 ? 1 : v <= 20 ? 5 : v <= 80 ? 20 : 40
  return Math.ceil(v / step) * step
}

/* ── Component ────────────────────────────────────────────────── */

interface Props {
  logs: WaterLog[]
}

export default function ParameterChart({ logs }: Props) {
  const status = useMemo(() => analyzeCycleStatus(logs), [logs])

  const sorted = useMemo(
    () => [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate)),
    [logs],
  )

  /* Unified Y scale: max across all 3 series with breathing room */
  const yMax = useMemo(() => {
    if (sorted.length === 0) return 8
    const rawMax = Math.max(
      ...sorted.map(l => Math.max(l.ammonia, l.nitrite, l.nitrate)),
    )
    return niceMax(rawMax)
  }, [sorted])

  /* Grid tick values (5 ticks from 0 to yMax) */
  const yTicks = useMemo(() => {
    const step = yMax / 4
    return [0, step, step * 2, step * 3, yMax]
  }, [yMax])

  /* Pixel coordinate helpers */
  const xOf = (idx: number) =>
    PAD.left + (sorted.length <= 1 ? PW / 2 : (idx / (sorted.length - 1)) * PW)

  const yOf = (val: number) =>
    PAD.top + PH - (val / yMax) * PH

  /* X-axis label decimation — show at most 7 labels */
  const xLabels = useMemo(() => {
    if (sorted.length === 0) return []
    const step = Math.max(1, Math.ceil(sorted.length / 7))
    return sorted
      .map((l, i) => ({ idx: i, label: fmtDate(l.logDate) }))
      .filter((_, i) => i % step === 0 || i === sorted.length - 1)
  }, [sorted])

  /* ── Empty state ─────────────────────────────────────────────── */
  if (sorted.length === 0) {
    return (
      <div className={styles.chart}>
        <div className={styles.legend}>
          {SERIES.map(s => (
            <span key={s.key} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className={styles.emptyChart}>
          <p className={styles.emptyText}>No readings logged yet.</p>
          <p className={styles.emptySubtext}>Add water test results to visualise the nitrogen cycle curve.</p>
        </div>
      </div>
    )
  }

  /* ── SVG series paths ────────────────────────────────────────── */
  const seriesPaths = SERIES.map(s => {
    const pts = sorted.map<[number, number]>((l, i) => [xOf(i), yOf(l[s.key])])
    return { ...s, pts, linePath: smoothPath(pts), aPath: areaPath(pts, yOf(0)) }
  })

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.chart}>

      {/* Legend */}
      <div className={styles.legend}>
        {SERIES.map(s => (
          <span key={s.key} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className={styles.svg}
        aria-label="Water parameter time series"
        role="img"
      >
        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={PAD.left + PW}
              y1={yOf(tick)}  y2={yOf(tick)}
              stroke="rgba(82,204,163,0.07)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6} y={yOf(tick)}
              textAnchor="end" dominantBaseline="middle"
              fill="rgba(155,163,196,0.65)"
              fontSize={9}
              fontFamily="'Cascadia Code', monospace"
            >
              {tick % 1 === 0 ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Border box */}
        <rect
          x={PAD.left} y={PAD.top}
          width={PW} height={PH}
          fill="none"
          stroke="rgba(82,204,163,0.10)"
          strokeWidth={1}
        />

        {/* Area fills (under lines) */}
        {seriesPaths.map(s => (
          <path
            key={s.key + '-area'}
            d={s.aPath}
            fill={s.area}
            strokeWidth={0}
            clipPath={`url(#clip-plot)`}
          />
        ))}

        {/* Series lines */}
        {seriesPaths.map(s => (
          <path
            key={s.key + '-line'}
            d={s.linePath}
            fill="none"
            stroke={s.color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Data point dots */}
        {seriesPaths.map(s =>
          s.pts.map(([x, y], i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={x} cy={y} r={2.5}
              fill={s.color}
              stroke="rgba(11,15,17,0.8)"
              strokeWidth={1}
            />
          )),
        )}

        {/* X-axis labels */}
        {xLabels.map(({ idx, label }) => (
          <text
            key={idx}
            x={xOf(idx)}
            y={PAD.top + PH + 16}
            textAnchor="middle"
            fill="rgba(155,163,196,0.65)"
            fontSize={9}
            fontFamily="'Cascadia Code', monospace"
          >
            {label}
          </text>
        ))}

        {/* X-axis label: "Date" */}
        <text
          x={PAD.left + PW / 2}
          y={VH - 2}
          textAnchor="middle"
          fill="rgba(92,100,135,0.70)"
          fontSize={8}
          fontFamily="'Cascadia Code', monospace"
        >
          LOG DATE
        </text>

        {/* Y-axis label: "ppm" */}
        <text
          x={12}
          y={PAD.top + PH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 12, ${PAD.top + PH / 2})`}
          fill="rgba(92,100,135,0.70)"
          fontSize={8}
          fontFamily="'Cascadia Code', monospace"
        >
          PPM
        </text>

        {/* Clip path for areas */}
        <defs>
          <clipPath id="clip-plot">
            <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
          </clipPath>
        </defs>
      </svg>

      {/* Nitrogen Cycle Status Banner */}
      <div
        className={`${styles.cycleStatus} ${status.isCycled ? styles.cycleStatusCycled : ''}`}
        data-phase={status.phase}
      >
        <div className={styles.cycleStatusHeader}>
          {status.isCycled && <span className={styles.cyclePulse} />}
          <span className={styles.cycleMessage}>{status.message}</span>
        </div>
        <p className={styles.cycleDetail}>{status.detail}</p>
      </div>
    </div>
  )
}
