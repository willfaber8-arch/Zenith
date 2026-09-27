'use client'
/**
 * CubeScoreboard — your own leaderboard for the Cube Timer.
 * ────────────────────────────────────────────────────────────────
 * "My 10 fastest singles", "my 25 best ao5s": the ranking the stats table
 * only shows the top line of. It reads the same solves as the rest of the
 * page, in the same scope (This Session / All Sessions), and never writes
 * anything — every number here is derived.
 *
 * The ranking itself is `topSingles` / `topAverages` in utils/cubeStats.ts,
 * pure and tested; this component only chooses what to ask for and lays
 * it out. #1 is therefore always the same PB / best aoN the stats table
 * shows beside it.
 *
 * Averages are listed without overlap — each solve counts toward one
 * ranked average at most — so a single hot streak cannot fill the board
 * with five near-copies of itself. Expanding a row shows the solves in it,
 * with the trimmed best and worst in parentheses as a results sheet does,
 * and any solve can be opened in the list below.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  formatTime, topSingles, topAverages, trimmedInWindow, type StatSolve,
} from '@/utils/cubeStats'
import styles from './CubeScoreboard.module.css'

export type ScoreSolve = StatSolve & {
  id:        string
  createdAt: number
  puzzle:    string
}

type Metric = 'single' | 'ao5' | 'ao12' | 'ao100'
const METRICS: { id: Metric; label: string; size: number }[] = [
  { id: 'single', label: 'Singles', size: 1 },
  { id: 'ao5',    label: 'ao5',     size: 5 },
  { id: 'ao12',   label: 'ao12',    size: 12 },
  { id: 'ao100',  label: 'ao100',   size: 100 },
]
const COUNTS = [5, 10, 25, 50, 100] as const

/* The choice of board is a per-browser preference, versioned like every key. */
const PREFS_KEY = 'zenith_cube_scoreboard_v1'
interface Prefs { metric: Metric; count: number }
const DEFAULT_PREFS: Prefs = { metric: 'single', count: 10 }

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    return {
      metric: METRICS.some(m => m.id === raw?.metric) ? raw!.metric! : DEFAULT_PREFS.metric,
      count:  COUNTS.includes(raw?.count as never) ? raw!.count! : DEFAULT_PREFS.count,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

interface Props {
  /** Chronological (oldest → newest) solves for the current scope. */
  solves:     ScoreSolve[]
  /** Fractional-second digits (2 or 3), matching the timer's option. */
  decimals:   number
  /** "This session" / "All sessions · 3x3" — what the board is ranking. */
  scopeLabel: string
  /** Open a solve in the list (expand it and scroll to it). */
  onOpen:     (id: string) => void
}

export default function CubeScoreboard({ solves, decimals, scopeLabel, onOpen }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [open, setOpen]   = useState<number | null>(null)   // expanded average, by start index

  useEffect(() => { setPrefs(loadPrefs()) }, [])
  const choose = (patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
    setOpen(null)
  }

  const metric = METRICS.find(m => m.id === prefs.metric) ?? METRICS[0]
  const last   = solves.length - 1
  const mixed  = useMemo(() => new Set(solves.map(s => s.puzzle)).size > 1, [solves])

  const fmt = (ms: number) => formatTime(ms, 'OK', decimals)
  const label = (s: StatSolve) =>
    s.penalty === 'DNF' ? 'DNF' : formatTime(s.timeMs, s.penalty, decimals)

  const singles = useMemo(
    () => (metric.size === 1 ? topSingles(solves, prefs.count) : []),
    [solves, metric.size, prefs.count],
  )
  const averages = useMemo(
    () => (metric.size > 1 ? topAverages(solves, metric.size, prefs.count) : []),
    [solves, metric.size, prefs.count],
  )

  const rows = metric.size === 1 ? singles.length : averages.length
  const needed = metric.size > 1 && solves.length < metric.size

  return (
    <section className={styles.card} aria-labelledby="cube-scoreboard-title">
      <div className={styles.header}>
        <div>
          <p id="cube-scoreboard-title" className={styles.eyebrow}>Personal Scoreboard</p>
          <p className={styles.scope}>{scopeLabel}</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.seg} role="radiogroup" aria-label="Rank by">
            {METRICS.map(m => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={prefs.metric === m.id}
                className={`${styles.segBtn} ${prefs.metric === m.id ? styles.segBtnActive : ''}`}
                onClick={() => choose({ metric: m.id })}
              >{m.label}</button>
            ))}
          </div>
          <label className={styles.countLabel}>
            Top
            <select
              className={styles.countSelect}
              value={prefs.count}
              onChange={e => choose({ count: Number(e.target.value) })}
            >
              {COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>

      {rows === 0 ? (
        <p className={styles.empty}>
          {needed
            ? `An ${metric.label} needs ${metric.size} solves — ${metric.size - solves.length} to go.`
            : metric.size === 1
              ? 'No finished solves yet.'
              : `Every ${metric.label} so far has two or more DNFs, so none counts yet.`}
        </p>
      ) : (
        <ol className={styles.list}>
          {metric.size === 1 && singles.map((r, rank) => {
            const s = solves[r.index]
            return (
              <li key={s.id}>
                <button type="button" className={styles.row} onClick={() => onOpen(s.id)}>
                  <span className={`${styles.rank} ${rank === 0 ? styles.rankFirst : ''}`}>{rank + 1}</span>
                  <span className={styles.time}>{label(s)}</span>
                  <span className={styles.meta}>
                    Solve #{r.index + 1} · {fmtDate(s.createdAt)}
                    {mixed && <span className={styles.tag}>{s.puzzle}</span>}
                    {r.index === last && <span className={styles.tagNew}>latest</span>}
                  </span>
                </button>
              </li>
            )
          })}

          {metric.size > 1 && averages.map((r, rank) => {
            const window  = solves.slice(r.start, r.start + r.size)
            const endSolve = window[window.length - 1]
            const isOpen  = open === r.start
            const trimmed = isOpen ? trimmedInWindow(window) : null
            const includesLatest = r.start + r.size - 1 === last
            return (
              <li key={r.start}>
                <button
                  type="button"
                  className={styles.row}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : r.start)}
                >
                  <span className={`${styles.rank} ${rank === 0 ? styles.rankFirst : ''}`}>{rank + 1}</span>
                  <span className={styles.time}>{fmt(r.ms)}</span>
                  <span className={styles.meta}>
                    Solves #{r.start + 1}–{r.start + r.size} · {fmtDate(endSolve.createdAt)}
                    {includesLatest && <span className={styles.tagNew}>latest</span>}
                  </span>
                  <span className={styles.chev} aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className={styles.window}>
                    {window.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`${styles.chip} ${trimmed?.has(i) ? styles.chipTrimmed : ''}`}
                        onClick={() => onOpen(s.id)}
                        title={`Solve #${r.start + i + 1} — open in the list`}
                      >
                        {trimmed?.has(i) ? `(${label(s)})` : label(s)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {metric.size > 1 && rows > 0 && (
        <p className={styles.note}>
          Each solve counts toward one ranked average at most, so one hot streak can’t fill the board.
          Times in parentheses are the best and worst, which an average leaves out.
        </p>
      )}
    </section>
  )
}
