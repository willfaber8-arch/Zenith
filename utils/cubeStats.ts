/**
 * utils/cubeStats.ts — penalty-aware speedsolving statistics
 *
 * Pure module — no React, no DB imports. Operates on a minimal structural
 * solve shape so the Dexie `CubeSolve` row satisfies it without coupling.
 *
 * TIME MODEL
 *   All solve times are stored in milliseconds. Penalties:
 *     OK    → time counts as-is
 *     PLUS2 → time + 2000 ms (a 2-second penalty)
 *     DNF   → Did Not Finish; no finite time (treated as +infinity / worst)
 *
 * AVERAGE MODEL (WCA)
 *   average-of-N (aoN) trims the single best and single worst effective
 *   times, then means the remaining N-2. A DNF is always "worst". If two or
 *   more DNFs remain after removing one worst, the average is a DNF (null).
 *   mean-of-3 (mo3) and session mean require every solve to be non-DNF.
 */

export type Penalty = 'OK' | 'PLUS2' | 'DNF'

/** Minimal structural shape every stats function operates on. */
export interface StatSolve {
  timeMs:  number
  penalty: Penalty
}

/**
 * Effective time for a solve, in ms.
 * Returns null for a DNF (no finite time).
 */
export function effectiveMs(solve: StatSolve): number | null {
  if (solve.penalty === 'DNF') return null
  if (solve.penalty === 'PLUS2') return solve.timeMs + 2000
  return solve.timeMs
}

/**
 * Format a millisecond duration as a speedcubing time string.
 *   < 60s   → "S.CC"       e.g. 12.34
 *   ≥ 60s   → "M:SS.CC"    e.g. 1:04.09
 *   DNF     → "DNF"
 *   PLUS2   → trailing "+"  e.g. 14.34+
 *
 * @param ms       effective or raw time in ms (null → DNF)
 * @param penalty  optional penalty; when 'PLUS2', pass the RAW time and the
 *                 +2000 is added here and a trailing "+" is shown.
 * @param decimals fractional-second precision — 2 (centiseconds, default) or 3
 *                 (milliseconds). Any other value is clamped to 2.
 */
export function formatTime(
  ms: number | null,
  penalty: Penalty = 'OK',
  decimals: number = 2,
): string {
  if (penalty === 'DNF' || ms === null) return 'DNF'

  const total  = penalty === 'PLUS2' ? ms + 2000 : ms
  const suffix = penalty === 'PLUS2' ? '+' : ''

  if (decimals === 3) {
    const totalMs   = Math.round(total)
    const frac      = (totalMs % 1000).toString().padStart(3, '0')
    const totalSecs = Math.floor(totalMs / 1000)
    const secs      = totalSecs % 60
    const mins      = Math.floor(totalSecs / 60)
    if (mins > 0) {
      const ss = secs.toString().padStart(2, '0')
      return `${mins}:${ss}.${frac}${suffix}`
    }
    return `${secs}.${frac}${suffix}`
  }

  const totalCs   = Math.round(total / 10)          // centiseconds
  const cs        = totalCs % 100
  const totalSecs = Math.floor(totalCs / 100)
  const secs      = totalSecs % 60
  const mins      = Math.floor(totalSecs / 60)

  const cc = cs.toString().padStart(2, '0')

  if (mins > 0) {
    const ss = secs.toString().padStart(2, '0')
    return `${mins}:${ss}.${cc}${suffix}`
  }
  return `${secs}.${cc}${suffix}`
}

/**
 * Format a long span (total solving time) as a coarse human duration.
 *   ≥ 1h → "1h 23m"   ·  ≥ 1m → "12m 34s"   ·  else → "42s"
 */
export function formatLongDuration(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '0s'
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/* ── single-solve aggregates ─────────────────────────────────────── */

/** Best (fastest) effective time, ignoring DNFs. null if none finite. */
export function best(solves: StatSolve[]): number | null {
  let b: number | null = null
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e === null) continue
    if (b === null || e < b) b = e
  }
  return b
}

/**
 * Worst (slowest) time. A DNF counts as worst → returns null (infinite).
 * If no DNF present, returns the slowest finite time.
 */
export function worst(solves: StatSolve[]): number | null {
  if (solves.length === 0) return null
  let w = 0
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e === null) return null   // a DNF is the worst possible
    if (e > w) w = e
  }
  return w
}

/**
 * Session mean of every solve. Any DNF → null (mean is undefined with a DNF).
 */
export function mean(solves: StatSolve[]): number | null {
  if (solves.length === 0) return null
  let sum = 0
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e === null) return null
    sum += e
  }
  return sum / solves.length
}

/* ── windowed averages ───────────────────────────────────────────── */

/**
 * WCA average of the most recent N solves.
 *   - Requires at least N solves (else null).
 *   - For N ≥ 5: trim one best + one worst, mean the rest. A DNF is worst;
 *     if 2+ DNFs remain after removing a single worst → average is DNF (null).
 *   - For N < 5 (mo3-style / N=3): treated as a strict mean — any DNF → null.
 *
 * Uses the LAST N solves of the array (array is assumed chronological OR you
 * may pass a pre-sliced window; this always takes the final N entries).
 */
export function average(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null
  const window = solves.slice(solves.length - n)

  // Small windows (mo3): strict mean, DNF-intolerant.
  if (n < 5) {
    return mean(window)
  }

  const effs = window.map(effectiveMs)   // (number | null)[]
  const dnfCount = effs.filter(e => e === null).length

  // Trim exactly one worst and one best.
  // If 2+ DNFs, removing one worst still leaves a DNF in the counted set.
  if (dnfCount >= 2) return null

  // Determine the best (min finite) and worst (max finite, or the one DNF).
  const finite = effs.filter((e): e is number => e !== null)

  let sum = 0
  let removedBest  = false
  let removedWorst = false

  if (dnfCount === 1) {
    // The DNF is the worst; remove it. Then remove the single best finite.
    removedWorst = true
    const minFinite = Math.min(...finite)
    for (const e of finite) {
      if (!removedBest && e === minFinite) { removedBest = true; continue }
      sum += e
    }
  } else {
    // No DNF: remove one best and one worst finite value.
    const minFinite = Math.min(...finite)
    const maxFinite = Math.max(...finite)
    for (const e of finite) {
      if (!removedBest && e === minFinite)  { removedBest = true;  continue }
      if (!removedWorst && e === maxFinite) { removedWorst = true; continue }
      sum += e
    }
  }

  const counted = n - 2
  return sum / counted
}

/**
 * Mean-of-3 — strict mean of the last 3 solves, DNF-intolerant.
 */
export function mo3(solves: StatSolve[]): number | null {
  return average(solves, 3)
}

/**
 * Best rolling average-of-N across the whole session.
 * Slides a window of size N over the (chronological) solve list and returns
 * the fastest valid aoN found. null if fewer than N solves or every window
 * evaluates to DNF.
 */
export function bestAverage(solves: StatSolve[], n: number): number | null {
  if (solves.length < n) return null
  let bestVal: number | null = null
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n)
    const avg = average(window, n)
    if (avg === null) continue
    if (bestVal === null || avg < bestVal) bestVal = avg
  }
  return bestVal
}

/* ── dispersion & reliability ────────────────────────────────────── */

/**
 * Population standard deviation (σ) of the finite (non-DNF) effective times.
 * Requires at least 2 finite solves, else null. DNFs are excluded from the
 * calculation (they have no finite time to disperse).
 */
export function stdev(solves: StatSolve[]): number | null {
  const finite: number[] = []
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e !== null) finite.push(e)
  }
  if (finite.length < 2) return null
  const m = finite.reduce((a, b) => a + b, 0) / finite.length
  const variance = finite.reduce((a, b) => a + (b - m) * (b - m), 0) / finite.length
  return Math.sqrt(variance)
}

/** Percentage (0–100) of solves that are not DNF. Empty set → 0. */
export function successRate(solves: StatSolve[]): number {
  if (solves.length === 0) return 0
  const ok = solves.reduce((n, s) => n + (s.penalty === 'DNF' ? 0 : 1), 0)
  return (ok / solves.length) * 100
}

/** Count solves carrying a given penalty. */
export function penaltyCount(solves: StatSolve[], penalty: Penalty): number {
  return solves.reduce((n, s) => n + (s.penalty === penalty ? 1 : 0), 0)
}

/** Longest run of consecutive non-DNF solves anywhere in the list. */
export function longestStreak(solves: StatSolve[]): number {
  let best = 0
  let cur = 0
  for (const s of solves) {
    if (s.penalty !== 'DNF') { cur += 1; if (cur > best) best = cur }
    else cur = 0
  }
  return best
}

/** Sum of every finite (non-DNF) effective time — total time spent solving. */
export function sumEffective(solves: StatSolve[]): number {
  let sum = 0
  for (const s of solves) {
    const e = effectiveMs(s)
    if (e !== null) sum += e
  }
  return sum
}

/**
 * Rolling average-of-N series aligned to `solves` indices (chronological in).
 * Entry i is the aoN of solves[0..i] (i.e. the aoN ending at solve i), or null
 * when fewer than N solves precede/include i, or the window evaluates to DNF.
 * Powers the chart's ao5/ao12 overlay lines.
 */
export function rollingSeries(solves: StatSolve[], n: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < solves.length; i++) {
    out.push(i + 1 < n ? null : average(solves.slice(0, i + 1), n))
  }
  return out
}
