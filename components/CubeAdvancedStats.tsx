'use client'
/**
 * CubeAdvancedStats — the Cube Timer's deeper numbers, in four tabs.
 * ────────────────────────────────────────────────────────────────
 *   Phases        per-phase average / best / ao5 / ao12 and share of the
 *                 solve, for solves timed in phases, and the phase with the
 *                 most room to improve
 *   Distribution  histogram of finished times (hover a bar for its count)
 *   Records       every new PB single / ao5 / ao12 / ao100, and by how much
 *   Progress      share of solves under a target you set, and a per-day
 *                 chart of your average with a ±σ band
 *
 * Read-only: it derives everything from the solves it is given and writes
 * nothing but its own tab and target preference. The maths is pure and
 * tested in utils/cubeAnalytics.ts, built on the same effectiveMs/average
 * as the stats table, so the two never disagree.
 */

import { useEffect, useMemo, useState } from 'react'
import { formatTime } from '@/utils/cubeStats'
import {
  phaseBreakdown, distribution, pbHistory, shareUnder, dailySeries,
  RECORD_METRICS, type AnalyticSolve, type RecordMetric,
} from '@/utils/cubeAnalytics'
import styles from './CubeAdvancedStats.module.css'

type Tab = 'phases' | 'distribution' | 'records' | 'progress'
const TABS: { id: Tab; label: string }[] = [
  { id: 'phases',       label: 'Phases' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'records',      label: 'Records' },
  { id: 'progress',     label: 'Progress' },
]
const METRIC_LABEL: Record<RecordMetric, string> = { single: 'Single', ao5: 'ao5', ao12: 'ao12', ao100: 'ao100' }

const PREFS_KEY = 'zenith_cube_advstats_v1'
interface Prefs { tab: Tab; targetSec: number; metric: RecordMetric }
const DEFAULT_PREFS: Prefs = { tab: 'phases', targetSec: 20, metric: 'single' }

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    return {
      tab:       TABS.some(t => t.id === raw?.tab) ? raw!.tab! : DEFAULT_PREFS.tab,
      targetSec: typeof raw?.targetSec === 'number' && raw.targetSec > 0 && raw.targetSec < 3600
        ? raw.targetSec : DEFAULT_PREFS.targetSec,
      metric:    RECORD_METRICS.includes(raw?.metric as RecordMetric) ? raw!.metric! : DEFAULT_PREFS.metric,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  /** Chronological solves for the current scope. */
  solves:            AnalyticSolve[]
  decimals:          number
  /** The phase set-up in use now, so the breakdown shows it first. */
  preferPhaseNames?: string[]
  scopeLabel:        string
}

export default function CubeAdvancedStats({ solves, decimals, preferPhaseNames, scopeLabel }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  useEffect(() => { setPrefs(loadPrefs()) }, [])
  const choose = (patch: Partial<Prefs>) => setPrefs(prev => {
    const next = { ...prev, ...patch }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
    return next
  })

  const fmt = (ms: number | null) => (ms === null ? '—' : formatTime(ms, 'OK', decimals))

  return (
    <section className={styles.card} aria-labelledby="cube-adv-title">
      <div className={styles.header}>
        <div>
          <p id="cube-adv-title" className={styles.eyebrow}>Advanced Stats</p>
          <p className={styles.scope}>{scopeLabel}</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Advanced stats">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={prefs.tab === t.id}
              className={`${styles.tab} ${prefs.tab === t.id ? styles.tabActive : ''}`}
              onClick={() => choose({ tab: t.id })}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {prefs.tab === 'phases'       && <PhasesPanel solves={solves} prefer={preferPhaseNames} fmt={fmt} />}
        {prefs.tab === 'distribution' && <DistributionPanel solves={solves} fmt={fmt} />}
        {prefs.tab === 'records'      && <RecordsPanel solves={solves} fmt={fmt} metric={prefs.metric} onMetric={m => choose({ metric: m })} />}
        {prefs.tab === 'progress'     && <ProgressPanel solves={solves} fmt={fmt} targetSec={prefs.targetSec} onTarget={t => choose({ targetSec: t })} />}
      </div>
    </section>
  )
}

type Fmt = (ms: number | null) => string

/* ── Phases ───────────────────────────────────────────────────────── */

function PhasesPanel({ solves, prefer, fmt }: { solves: AnalyticSolve[]; prefer?: string[]; fmt: Fmt }) {
  const b = useMemo(() => phaseBreakdown(solves, prefer), [solves, prefer])
  if (!b) {
    return (
      <p className={styles.empty}>
        No solves timed in phases here yet. Turn on <b>Multi-phase timing</b> in ⚙ Options — then each
        press ends a phase (Cross → F2L → OLL → PLL) and the breakdown appears here.
      </p>
    )
  }
  const focus = b.phases[b.focus]
  return (
    <div className={styles.panel}>
      <div className={styles.stack} aria-hidden="true">
        {b.phases.map((p, i) => (
          <span
            key={p.name}
            className={styles.stackSeg}
            style={{ flexGrow: p.share, '--seg': `var(--seg-${i % 6})` } as React.CSSProperties}
            title={`${p.name} · ${Math.round(p.share * 100)}%`}
          >{p.share > 0.08 ? p.name : ''}</span>
        ))}
      </div>

      <table className={styles.table}>
        <thead>
          <tr><th>Phase</th><th>Average</th><th>Best</th><th>ao5</th><th>ao12</th><th>Share</th></tr>
        </thead>
        <tbody>
          {b.phases.map((p, i) => (
            <tr key={p.name} className={i === b.focus ? styles.focusRow : ''}>
              <td><i className={styles.swatch} style={{ '--seg': `var(--seg-${i % 6})` } as React.CSSProperties} />{p.name}</td>
              <td>{fmt(p.mean)}</td>
              <td>{fmt(p.best)}</td>
              <td>{fmt(p.ao5)}</td>
              <td>{fmt(p.ao12)}</td>
              <td>{Math.round(p.share * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.callout}>
        Most room to improve: <b>{focus.name}</b> — your average is {fmt(focus.gap)} slower than
        {focus.bestAo12 !== null ? ` your best ao12 of ${focus.name}` : ` your best ${focus.name}`}.
      </p>
      <p className={styles.foot}>
        From {b.count} solve{b.count === 1 ? '' : 's'} timed as {b.names.join(' → ')}. DNFs are left out;
        a +2 belongs to the whole solve, so phase times are unaffected by it.
      </p>
    </div>
  )
}

/* ── Distribution ─────────────────────────────────────────────────── */

const DW = 640, DH = 200, DPAD = { top: 14, right: 12, bottom: 30, left: 36 }

function DistributionPanel({ solves, fmt }: { solves: AnalyticSolve[]; fmt: Fmt }) {
  const d = useMemo(() => distribution(solves), [solves])
  const [hover, setHover] = useState<number | null>(null)
  if (!d) return <p className={styles.empty}>No finished solves to chart yet.</p>

  const maxCount = Math.max(...d.buckets.map(b => b.count), 1)
  const total = d.buckets.reduce((a, b) => a + b.count, 0)
  const pw = DW - DPAD.left - DPAD.right
  const ph = DH - DPAD.top - DPAD.bottom
  const bw = pw / d.buckets.length
  const step = Math.max(1, Math.ceil(d.buckets.length / 8))
  const mode = d.buckets[d.modeIndex]
  const h = hover !== null ? d.buckets[hover] : null
  const label = (b: { fromMs: number; toMs: number }) => `${fmt(b.fromMs)}–${fmt(b.toMs)}`

  return (
    <div className={styles.panel}>
      <div className={styles.plotWrap}>
        <svg viewBox={`0 0 ${DW} ${DH}`} className={styles.svg} role="img"
          aria-label={`Distribution of ${total} finished solves`} onPointerLeave={() => setHover(null)}>
          {[0.5, 1].map(f => (
            <g key={f}>
              <line x1={DPAD.left} x2={DPAD.left + pw} y1={DPAD.top + ph * (1 - f)} y2={DPAD.top + ph * (1 - f)} className={styles.grid} />
              <text x={DPAD.left - 6} y={DPAD.top + ph * (1 - f)} className={styles.axis} textAnchor="end" dominantBaseline="middle">
                {Math.round(maxCount * f)}
              </text>
            </g>
          ))}
          {d.buckets.map((b, i) => {
            const bh = (b.count / maxCount) * ph
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={DPAD.left + i * bw} y={DPAD.top} width={bw} height={ph} fill="transparent" />
                <rect
                  x={DPAD.left + i * bw + 1} y={DPAD.top + ph - bh}
                  width={Math.max(1, bw - 2)} height={bh}
                  className={`${styles.bar} ${i === d.modeIndex ? styles.barMode : ''} ${i === hover ? styles.barHover : ''}`}
                  rx={2}
                />
              </g>
            )
          })}
          {d.buckets.map((b, i) => (i % step === 0 ? (
            <text key={`l${i}`} x={DPAD.left + i * bw} y={DH - 10} className={styles.axis} textAnchor="middle">
              {fmt(b.fromMs)}
            </text>
          ) : null))}
          <line x1={DPAD.left} x2={DPAD.left + pw} y1={DPAD.top + ph} y2={DPAD.top + ph} className={styles.baseline} />
        </svg>
        {h && (
          <div className={styles.tip} style={{ left: `${((DPAD.left + (hover! + 0.5) * bw) / DW) * 100}%` }}>
            <b>{label(h)}</b>
            <span>{h.count} solve{h.count === 1 ? '' : 's'} · {Math.round((h.count / total) * 100)}%</span>
          </div>
        )}
      </div>
      <p className={styles.callout}>
        Most common: <b>{label(mode)}</b> ({mode.count} of {total} finished solves).
        {d.dnfCount > 0 && ` ${d.dnfCount} DNF${d.dnfCount === 1 ? '' : 's'} not shown.`}
      </p>
    </div>
  )
}

/* ── Records ──────────────────────────────────────────────────────── */

function RecordsPanel({ solves, fmt, metric, onMetric }: {
  solves: AnalyticSolve[]; fmt: Fmt; metric: RecordMetric; onMetric: (m: RecordMetric) => void
}) {
  const recs = useMemo(() => pbHistory(solves, metric), [solves, metric])
  const size = metric === 'single' ? 1 : Number(metric.slice(2))
  const newestFirst = [...recs].reverse()
  const current = recs[recs.length - 1]
  const daysHeld = current ? Math.floor((Date.now() - current.at) / 86_400_000) : 0

  return (
    <div className={styles.panel}>
      <div className={styles.seg} role="radiogroup" aria-label="Record type">
        {RECORD_METRICS.map(m => (
          <button key={m} type="button" role="radio" aria-checked={metric === m}
            className={`${styles.segBtn} ${metric === m ? styles.segBtnActive : ''}`}
            onClick={() => onMetric(m)}>{METRIC_LABEL[m]}</button>
        ))}
      </div>

      {recs.length === 0 ? (
        <p className={styles.empty}>
          {solves.length < size ? `An ${METRIC_LABEL[metric]} needs ${size} solves — ${size - solves.length} to go.` : 'No record yet.'}
        </p>
      ) : (
        <>
          <p className={styles.callout}>
            Current {METRIC_LABEL[metric]} PB: <b>{fmt(current.ms)}</b>, set {daysHeld === 0 ? 'today' : `${daysHeld} day${daysHeld === 1 ? '' : 's'} ago`} —
            {' '}{recs.length} record{recs.length === 1 ? '' : 's'} in all.
          </p>
          <ol className={styles.records}>
            {newestFirst.map(r => (
              <li key={r.index} className={styles.recordRow}>
                <span className={styles.recordTime}>{fmt(r.ms)}</span>
                <span className={styles.recordGain}>{r.prevMs === null ? 'first' : `−${fmt(r.prevMs - r.ms)}`}</span>
                <span className={styles.recordMeta}>
                  {size === 1 ? `Solve #${r.index + 1}` : `Solves #${r.index + 2 - size}–${r.index + 1}`}
                  {' · '}{new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/* ── Progress ─────────────────────────────────────────────────────── */

const PW = 640, PH = 200, PPAD = { top: 14, right: 12, bottom: 30, left: 48 }

function ProgressPanel({ solves, fmt, targetSec, onTarget }: {
  solves: AnalyticSolve[]; fmt: Fmt; targetSec: number; onTarget: (t: number) => void
}) {
  const [draft, setDraft] = useState(String(targetSec))
  useEffect(() => setDraft(String(targetSec)), [targetSec])
  const targetMs = targetSec * 1000

  const all    = useMemo(() => shareUnder(solves, targetMs), [solves, targetMs])
  const last12 = useMemo(() => shareUnder(solves.slice(-12), targetMs), [solves, targetMs])
  const last50 = useMemo(() => shareUnder(solves.slice(-50), targetMs), [solves, targetMs])
  const days   = useMemo(() => dailySeries(solves).filter(d => d.mean !== null), [solves])
  const [hover, setHover] = useState<number | null>(null)

  const commit = () => {
    const v = Number(draft)
    if (Number.isFinite(v) && v > 0 && v < 3600) onTarget(Math.round(v * 100) / 100)
    else setDraft(String(targetSec))
  }

  /* chart geometry */
  const lo = days.length ? Math.min(...days.map(d => d.mean! - (d.sd ?? 0)), targetMs) : 0
  const hi = days.length ? Math.max(...days.map(d => d.mean! + (d.sd ?? 0)), targetMs) : 1
  const padY = (hi - lo) * 0.1 || 500
  const yMin = Math.max(0, lo - padY), yMax = hi + padY
  const pw = PW - PPAD.left - PPAD.right, ph = PH - PPAD.top - PPAD.bottom
  const x = (i: number) => PPAD.left + (days.length <= 1 ? pw / 2 : (i / (days.length - 1)) * pw)
  const y = (v: number) => PPAD.top + ph - ((v - yMin) / (yMax - yMin)) * ph
  const line = days.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d.mean!)}`).join(' ')
  const band = days.length
    ? `${days.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d.mean! + (d.sd ?? 0))}`).join(' ')} ` +
      `${[...days].reverse().map((d, j) => `L ${x(days.length - 1 - j)} ${y(d.mean! - (d.sd ?? 0))}`).join(' ')} Z`
    : ''
  const hd = hover !== null ? days[hover] : null

  return (
    <div className={styles.panel}>
      <div className={styles.targetRow}>
        <label className={styles.targetLabel}>
          Target
          <input
            className={styles.targetInput}
            value={draft}
            inputMode="decimal"
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            aria-label="Target time in seconds"
          />
          s
        </label>
        <div className={styles.kpis}>
          <Kpi value={pct(last12)} label={`sub-${targetSec} · last 12`} />
          <Kpi value={pct(last50)} label={`sub-${targetSec} · last 50`} />
          <Kpi value={pct(all)}    label={`sub-${targetSec} · all ${solves.length}`} />
        </div>
      </div>

      {days.length === 0 ? (
        <p className={styles.empty}>No finished solves yet.</p>
      ) : (
        <div className={styles.plotWrap}>
          <svg viewBox={`0 0 ${PW} ${PH}`} className={styles.svg} role="img"
            aria-label={`Daily average over ${days.length} days`} onPointerLeave={() => setHover(null)}>
            <path d={band} className={styles.band} />
            <line x1={PPAD.left} x2={PPAD.left + pw} y1={y(targetMs)} y2={y(targetMs)} className={styles.target} />
            <text x={PPAD.left + pw} y={y(targetMs) - 4} textAnchor="end" className={styles.axis}>target {fmt(targetMs)}</text>
            <path d={line} className={styles.line} />
            {days.map((d, i) => (
              <g key={d.date} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={x(i) - pw / Math.max(days.length, 1) / 2} y={PPAD.top} width={pw / Math.max(days.length, 1)} height={ph} fill="transparent" />
                <circle cx={x(i)} cy={y(d.mean!)} r={hover === i ? 4.5 : 2.5} className={styles.dot} />
              </g>
            ))}
            {[yMin, (yMin + yMax) / 2, yMax].map((v, k) => (
              <text key={k} x={PPAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className={styles.axis}>{fmt(v)}</text>
            ))}
            {days.map((d, i) => (i % Math.max(1, Math.ceil(days.length / 7)) === 0 || i === days.length - 1 ? (
              <text key={`d${i}`} x={x(i)} y={PH - 10} textAnchor="middle" className={styles.axis}>{fmtDay(d.date)}</text>
            ) : null))}
          </svg>
          {hd && (
            <div className={styles.tip} style={{ left: `${(x(hover!) / PW) * 100}%` }}>
              <b>{fmtDay(hd.date)}</b>
              <span>{hd.count} solve{hd.count === 1 ? '' : 's'} · mean {fmt(hd.mean)}</span>
              <span>best {fmt(hd.best)} · σ {fmt(hd.sd)}</span>
            </div>
          )}
        </div>
      )}
      <p className={styles.foot}>
        The line is each day’s mean of finished solves; the band is ±σ, so a narrowing band means you are
        getting more consistent. A DNF counts as not under the target.
      </p>
    </div>
  )
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </div>
  )
}
