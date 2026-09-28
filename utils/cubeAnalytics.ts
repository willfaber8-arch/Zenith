/**
 * utils/cubeAnalytics.ts — the Cube Timer's advanced statistics.
 *
 * Pure: no React, no Dexie. Every figure here is built from the same
 * `effectiveMs` / `average` the stats table uses (utils/cubeStats.ts), so
 * a number on the Advanced Stats card can never disagree with the same
 * number elsewhere on the page.
 *
 * All inputs are chronological (oldest first). Four families:
 *
 *   phaseBreakdown   — per-phase average / best / share, for multi-phase solves
 *   distribution     — histogram of finished times, bucket width chosen to fit
 *   pbHistory        — every time a single / aoN record fell, and by how much
 *   progress         — share under a target time, and a per-day series
 */

import { average, bestAverage, effectiveMs, type StatSolve } from './cubeStats'
import { phaseDurations } from './cubePhases'
import { toLocalDateStr } from './localDate'

/** A solve as the analytics need it. */
export type AnalyticSolve = StatSolve & {
  createdAt:   number
  splits?:     number[]
  phaseNames?: string[]
}

/* ── rolling averages, cheaply ───────────────────────────────────── */

/**
 * aoN ending at every index, WCA rules (null before N solves or when the
 * window is a DNF). Each window is sliced on its own, so this is O(n·N),
 * not the O(n²) of slicing the whole prefix every time.
 */
export function rollingAverages(solves: StatSolve[], n: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < solves.length; i++) {
    out.push(i + 1 < n ? null : average(solves.slice(i + 1 - n, i + 1), n))
  }
  return out
}

/* ── phase breakdown ─────────────────────────────────────────────── */

export interface PhaseStat {
  name:   string
  mean:   number          // ms
  best:   number          // ms
  ao5:    number | null   // latest ao5 of this phase alone
  ao12:   number | null
  /** Best rolling ao12 of this phase alone; null under 12 solves. */
  bestAo12: number | null
  /** This phase's share of the whole solve, 0–1 (shares sum to 1). */
  share:  number
  /**
   * Room to improve, ms: how far the average sits above the best ao12 —
   * a pace you have actually sustained — or above the best single when
   * there are fewer than 12. Measured against a single, one lucky skip
   * would make that phase look like the problem forever.
   */
  gap:    number
}

export interface PhaseBreakdown {
  names:  string[]
  /** Solves the breakdown is built from. */
  count:  number
  phases: PhaseStat[]
  /** The phase with the most room to improve (largest gap), by index. */
  focus:  number
}

/**
 * Per-phase figures for the solves timed in phases.
 *
 * Only solves with the same phase names can be compared, so when a
 * session mixes set-ups (CFOP one week, Roux the next) the breakdown uses
 * `preferNames` if any solve matches it, otherwise the most common set-up.
 * DNFs are left out — a DNF has no meaningful split. A +2 still counts:
 * the penalty belongs to the solve, not to any one phase, so the phase
 * times themselves are unaffected.
 */
export function phaseBreakdown(
  solves: AnalyticSolve[],
  preferNames?: string[],
): PhaseBreakdown | null {
  const groups = new Map<string, { names: string[]; rows: number[][] }>()
  for (const s of solves) {
    if (s.penalty === 'DNF') continue
    const d = phaseDurations(s.splits)
    if (!d || !s.phaseNames || s.phaseNames.length !== d.length) continue
    const key = s.phaseNames.join('\u0000')
    const g = groups.get(key) ?? { names: s.phaseNames, rows: [] }
    g.rows.push(d)
    groups.set(key, g)
  }
  if (groups.size === 0) return null

  const preferred = preferNames ? groups.get(preferNames.join('\u0000')) : undefined
  const group = preferred ?? [...groups.values()].sort((a, b) => b.rows.length - a.rows.length)[0]

  const phases: PhaseStat[] = group.names.map((name, p) => {
    const times = group.rows.map(r => r[p])
    const asSolves: StatSolve[] = times.map(t => ({ timeMs: t, penalty: 'OK' }))
    return {
      name,
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      best: Math.min(...times),
      ao5:  average(asSolves, 5),
      ao12: average(asSolves, 12),
      bestAo12: bestAverage(asSolves, 12),
      share: 0,
      gap:   0,
    }
  })
  const total = phases.reduce((a, p) => a + p.mean, 0) || 1
  let focus = 0
  phases.forEach((p, i) => {
    p.share = p.mean / total
    p.gap   = Math.max(0, p.mean - (p.bestAo12 ?? p.best))
    if (p.gap > phases[focus].gap) focus = i
  })
  return { names: group.names, count: group.rows.length, phases, focus }
}

/* ── distribution ────────────────────────────────────────────────── */

export interface Bucket { fromMs: number; toMs: number; count: number }
export interface Distribution {
  buckets:  Bucket[]
  widthMs:  number
  dnfCount: number
  /** The bucket holding the most solves, by index. */
  modeIndex: number
}

/** Widths a bucket can take, smallest first: ¼s up to a minute. */
const BUCKET_WIDTHS = [250, 500, 1000, 2000, 5000, 10000, 30000, 60000]

/**
 * Histogram of finished (effective) times. The width is the smallest in
 * BUCKET_WIDTHS that fits the spread into `maxBuckets` bars, and buckets
 * start on a multiple of it, so bars read as "10–11s", never "10.37–11.37s".
 * Empty buckets in the middle are kept — a gap is information.
 */
export function distribution(solves: StatSolve[], maxBuckets = 18): Distribution | null {
  const times: number[] = []
  let dnfCount = 0
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e === null) dnfCount++
    else times.push(e)
  }
  if (times.length === 0) return null

  const lo = Math.min(...times)
  const hi = Math.max(...times)
  const widthMs = BUCKET_WIDTHS.find(w => Math.floor(hi / w) - Math.floor(lo / w) + 1 <= maxBuckets)
    ?? BUCKET_WIDTHS[BUCKET_WIDTHS.length - 1]

  const first = Math.floor(lo / widthMs)
  const last  = Math.floor(hi / widthMs)
  const buckets: Bucket[] = []
  for (let b = first; b <= last; b++) buckets.push({ fromMs: b * widthMs, toMs: (b + 1) * widthMs, count: 0 })
  for (const t of times) buckets[Math.floor(t / widthMs) - first].count++

  let modeIndex = 0
  buckets.forEach((b, i) => { if (b.count > buckets[modeIndex].count) modeIndex = i })
  return { buckets, widthMs, dnfCount, modeIndex }
}

/* ── PB history ──────────────────────────────────────────────────── */

export type RecordMetric = 'single' | 'ao5' | 'ao12' | 'ao100'
export const RECORD_METRICS: RecordMetric[] = ['single', 'ao5', 'ao12', 'ao100']
const METRIC_SIZE: Record<RecordMetric, number> = { single: 1, ao5: 5, ao12: 12, ao100: 100 }

export interface RecordEntry {
  /** Index of the solve that set it (the last solve of the window). */
  index:  number
  at:     number          // createdAt of that solve
  ms:     number
  /** The record it replaced; null for the first one. */
  prevMs: number | null
}

/**
 * Every time `metric` set a new personal best, oldest first. A tie is not
 * a new record — only strictly faster counts, as in the stats table.
 */
export function pbHistory(solves: AnalyticSolve[], metric: RecordMetric): RecordEntry[] {
  const values = METRIC_SIZE[metric] === 1
    ? solves.map(effectiveMs)
    : rollingAverages(solves, METRIC_SIZE[metric])
  const out: RecordEntry[] = []
  let best: number | null = null
  values.forEach((v, index) => {
    if (v === null) return
    if (best === null || v < best) {
      out.push({ index, at: solves[index].createdAt, ms: v, prevMs: best })
      best = v
    }
  })
  return out
}

/* ── progress & consistency ──────────────────────────────────────── */

/**
 * Share (0–1) of solves under `targetMs`. A DNF counts as not under —
 * it is an attempt that did not make it — and a +2 is judged on its
 * penalised time. null for no solves.
 */
export function shareUnder(solves: StatSolve[], targetMs: number): number | null {
  if (solves.length === 0) return null
  let under = 0
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e !== null && e < targetMs) under++
  }
  return under / solves.length
}

export interface DayStat {
  date:  string          // local "YYYY-MM-DD"
  count: number          // every attempt that day, DNFs included
  mean:  number | null   // mean of finished solves
  best:  number | null
  /** Population σ of finished solves; null under two. */
  sd:    number | null
}

/**
 * One entry per local calendar day that has solves, oldest first. The
 * day is the device's local date — a session at 11pm belongs to that
 * evening, not to tomorrow in UTC.
 */
export function dailySeries(solves: AnalyticSolve[]): DayStat[] {
  const byDay = new Map<string, { count: number; times: number[] }>()
  for (const s of solves) {
    const key = toLocalDateStr(new Date(s.createdAt))
    const d = byDay.get(key) ?? { count: 0, times: [] }
    d.count++
    const e = effectiveMs(s)
    if (e !== null) d.times.push(e)
    byDay.set(key, d)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, { count, times }]) => {
      if (times.length === 0) return { date, count, mean: null, best: null, sd: null }
      const mean = times.reduce((a, b) => a + b, 0) / times.length
      const sd = times.length < 2 ? null
        : Math.sqrt(times.reduce((a, t) => a + (t - mean) ** 2, 0) / times.length)
      return { date, count, mean, best: Math.min(...times), sd }
    })
}
