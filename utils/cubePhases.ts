/**
 * utils/cubePhases.ts — multi-phase timing and typed-in times.
 *
 * Pure: no React, no Dexie. The Cube Timer uses these for two things it
 * borrowed from csTimer.
 *
 * MULTI-PHASE TIMING
 *   With phases on, each press while the clock runs marks the end of a
 *   phase; the last press stops it. A solve stores `splits` — the elapsed
 *   ms at the end of each phase, cumulative, so the last split is the
 *   solve's raw time — and the `phaseNames` in force when it was done, so
 *   renaming phases later never re-labels old solves. A +2 or DNF applies
 *   to the whole solve, never to a phase: phase times are always raw.
 *
 * TYPED TIMES
 *   For solves timed somewhere else (a stackmat, a competition), a time
 *   can be typed instead: "12.34", "1:02.34", "12.34+" for a +2, or "DNF".
 */

import type { Penalty } from './cubeStats'

/* ── phase configuration ─────────────────────────────────────────── */

export const MIN_PHASES = 2
export const MAX_PHASES = 6
export const MAX_PHASE_NAME = 16

export const PHASE_PRESETS: { id: string; label: string; names: string[] }[] = [
  { id: 'cfop', label: 'CFOP', names: ['Cross', 'F2L', 'OLL', 'PLL'] },
  { id: 'roux', label: 'Roux', names: ['FB', 'SB', 'CMLL', 'LSE'] },
  { id: 'zz',   label: 'ZZ',   names: ['EOLine', 'F2L', 'LL'] },
]

/** Multi-phase settings for one puzzle. */
export interface PhaseConfig {
  enabled: boolean
  names:   string[]
}

/** What a puzzle gets before anyone touches the setting: off, CFOP ready. */
export const DEFAULT_PHASE_CONFIG: PhaseConfig = {
  enabled: false,
  names:   [...PHASE_PRESETS[0].names],
}

/**
 * A stored config made safe to use: 2–6 names, each trimmed, clamped and
 * never empty ("Phase 3" stands in for a blank one). Anything unreadable
 * falls back to the default, so a corrupt setting cannot break the timer.
 */
export function normalisePhaseConfig(raw: unknown): PhaseConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PHASE_CONFIG, names: [...DEFAULT_PHASE_CONFIG.names] }
  const r = raw as { enabled?: unknown; names?: unknown }
  let names = Array.isArray(r.names) ? r.names.map(n => (typeof n === 'string' ? n : '')) : [...DEFAULT_PHASE_CONFIG.names]
  if (names.length < MIN_PHASES) names = [...names, ...Array(MIN_PHASES - names.length).fill('')]
  names = names.slice(0, MAX_PHASES).map((n, i) => n.trim().slice(0, MAX_PHASE_NAME) || `Phase ${i + 1}`)
  return { enabled: r.enabled === true, names }
}

/** A config resized to `count` phases, keeping the names already typed. */
export function resizePhases(cfg: PhaseConfig, count: number): PhaseConfig {
  const n = Math.min(MAX_PHASES, Math.max(MIN_PHASES, Math.round(count)))
  const names = cfg.names.slice(0, n)
  while (names.length < n) names.push(`Phase ${names.length + 1}`)
  return { ...cfg, names }
}

/* ── splits → phase durations ────────────────────────────────────── */

/**
 * The time spent in each phase, from cumulative splits. Returns null for
 * anything that is not a real split list — missing, a single entry, not
 * strictly increasing — so a malformed row reads as "no phases" rather
 * than as a negative phase time.
 */
export function phaseDurations(splits: readonly number[] | undefined | null): number[] | null {
  if (!Array.isArray(splits) || splits.length < MIN_PHASES) return null
  const out: number[] = []
  let prev = 0
  for (const s of splits) {
    if (typeof s !== 'number' || !Number.isFinite(s) || s <= prev) return null
    out.push(s - prev)
    prev = s
  }
  return out
}

/* ── typed times ─────────────────────────────────────────────────── */

export interface TypedTime {
  timeMs:  number
  penalty: Penalty
}

/** Longest believable solve: an hour. Anything longer is a typo. */
const MAX_TYPED_MS = 60 * 60 * 1000

/**
 * Reads a typed time. Accepts:
 *   "12.34"  "12.3"  "12"         seconds
 *   "1:02.34"  "1:02"             minutes:seconds
 *   "12.34+"                      the time with a +2
 *   "DNF"  "dnf"  "DNF(12.34)"    a DNF (with the time it would have been)
 * Returns null for anything else, so the field can say "not a time"
 * rather than guessing — "1234" is not read as 12.34 the way some timers
 * do, because typing 1234 meaning twenty minutes is just as plausible.
 */
export function parseTypedTime(input: string): TypedTime | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  const dnf = /^dnf(?:\((.*)\))?$/.exec(s)
  if (dnf) {
    const inner = dnf[1] ? parseClock(dnf[1]) : 0
    if (inner === null) return null
    return { timeMs: inner, penalty: 'DNF' }
  }

  const plus2 = s.endsWith('+')
  const ms = parseClock(plus2 ? s.slice(0, -1) : s)
  if (ms === null || ms <= 0) return null
  return { timeMs: ms, penalty: plus2 ? 'PLUS2' : 'OK' }
}

/** "1:02.34" / "62.34" / "62" → ms, or null. */
function parseClock(s: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,4})(?:\.(\d{1,3}))?$/.exec(s)
  if (!m) return null
  const mins = m[1] ? Number(m[1]) : 0
  const secs = Number(m[2])
  if (m[1] && secs >= 60) return null                 // "1:75" is not a time
  const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0
  const ms = (mins * 60 + secs) * 1000 + frac
  return ms > MAX_TYPED_MS ? null : ms
}
