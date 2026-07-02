'use client'

/**
 * TournamentHubView.tsx
 * Phase 12.2 — Tournament Hub  (Life · Social)
 *
 * Two-tab social coordination tool:
 *
 *   Wheel of Names  — SVG spinner with N colored segments.  Add/remove
 *     participant names; spin generates a smooth 4.5s deceleration via
 *     CSS cubic-bezier transition.  Winner announced with pop animation.
 *     History strip shows last 8 winners.  Persists to localStorage
 *     (zenith_wheel_v1).
 *
 *   Bracket Builder — Single-elimination tournament bracket for 2–32
 *     participants.  Enter names in the textarea (one per line); click
 *     Generate to lay out the bracket.  Click a participant name to
 *     advance them as the round winner.  Rounds resolve automatically
 *     until a champion is crowned.  Persists to localStorage
 *     (zenith_bracket_v1).
 *
 * Lazy-loaded via lib/dynamicViews.tsx — no code in the initial bundle.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import styles     from './TournamentHubView.module.css'

// ─────────────────────────────────────────────────────────────
// Design constants
// ─────────────────────────────────────────────────────────────

const WHEEL_COLORS = [
  '#7c95ff', '#63a389', '#e5c17c', '#c96a6a',
  '#a78bfa', '#38bdf8', '#fb923c', '#34d399',
  '#f472b6', '#a3e635', '#22d3ee', '#fbbf24',
  '#818cf8', '#6ee7b7', '#fcd34d', '#f9a8d4',
]

const WHEEL_CX  = 185
const WHEEL_CY  = 185
const WHEEL_R   = 165
const WHEEL_VB  = 370   // viewBox dimension

const HISTORY_LIMIT = 8
const BRACKET_MAX   = 32

const WHEEL_KEY   = 'zenith_wheel_v1'
const BRACKET_KEY = 'zenith_bracket_v1'

// ─────────────────────────────────────────────────────────────
// Maths helpers
// ─────────────────────────────────────────────────────────────

function polarToXY(angleDeg: number, r: number): { x: number; y: number } {
  // 0° = 12 o'clock; positive = clockwise
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: WHEEL_CX + r * Math.cos(rad), y: WHEEL_CY + r * Math.sin(rad) }
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s
}

// ─────────────────────────────────────────────────────────────
// Weighted wheel geometry
// ─────────────────────────────────────────────────────────────

interface Participant {
  name:   string
  weight: number   // ≥ 1; higher = larger slice / higher probability
}

interface WheelSeg {
  start: number   // degrees, 0 = 12 o'clock, clockwise
  end:   number
  mid:   number
}

/** Cumulative weighted segment boundaries (degrees). */
function computeSegments(weights: number[]): WheelSeg[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1
  let cum = 0
  return weights.map(w => {
    const start = (cum / total) * 360
    cum += w
    const end = (cum / total) * 360
    return { start, end, mid: (start + end) / 2 }
  })
}

/** Pie-slice path between two angles. */
function arcPath(startA: number, endA: number): string {
  const start        = polarToXY(startA, WHEEL_R)
  const end          = polarToXY(endA,   WHEEL_R)
  const largeArcFlag = endA - startA > 180 ? 1 : 0
  return `M ${WHEEL_CX} ${WHEEL_CY} L ${start.x} ${start.y} A ${WHEEL_R} ${WHEEL_R} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
}

/** Which segment sits under the top pointer after rotating `rotation`°. */
function pickWinnerIndex(weights: number[], rotation: number): number {
  const total      = weights.reduce((a, b) => a + b, 0) || 1
  const normalized = (((360 - (rotation % 360)) % 360) + 360) % 360
  const target     = (normalized / 360) * total
  let cum = 0
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i]
    if (target < cum) return i
  }
  return weights.length - 1
}

/** SSR-safe migrating loader: tolerates the legacy string[] format. */
function loadParticipants(): Participant[] {
  const raw = loadJson<unknown>(WHEEL_KEY + '_names', [])
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): Participant => {
      if (typeof item === 'string') return { name: item, weight: 1 }
      if (item && typeof item === 'object' && 'name' in item) {
        const o = item as { name: unknown; weight?: unknown }
        return {
          name:   String(o.name),
          weight: Math.max(1, Math.min(99, Math.round(Number(o.weight) || 1))),
        }
      }
      return { name: String(item), weight: 1 }
    })
    .filter(p => p.name.trim().length > 0)
}

// ─────────────────────────────────────────────────────────────
// Bracket types
// ─────────────────────────────────────────────────────────────

interface BracketMatch {
  p1: string | null
  p2: string | null
  winner: string | null
}

type Bracket = BracketMatch[][]   // bracket[roundIdx][matchIdx]

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function buildBracket(participants: string[]): Bracket {
  const size   = nextPow2(Math.max(participants.length, 2))
  const padded = [...participants]
  while (padded.length < size) padded.push('BYE')

  const rounds: Bracket = []
  let current = padded

  while (current.length > 1) {
    const round: BracketMatch[] = []
    for (let i = 0; i < current.length; i += 2) {
      const p1 = current[i]
      const p2 = current[i + 1]
      // BYE always loses automatically
      const autoWinner = p2 === 'BYE' ? p1 : p1 === 'BYE' ? p2 : null
      round.push({ p1, p2, winner: autoWinner })
    }
    rounds.push(round)
    // Seed next round with winners (TBD where no winner yet)
    current = round.map((m, idx) => m.winner ?? `TBD_${rounds.length - 1}_${idx}`)
  }

  return rounds
}

function advanceWinner(
  bracket:  Bracket,
  round:    number,
  matchIdx: number,
  winner:   string,
): Bracket {
  // Deep clone to avoid mutation
  const next: Bracket = bracket.map(r => r.map(m => ({ ...m })))

  next[round][matchIdx].winner = winner

  // Propagate winner to next round
  if (round + 1 < next.length) {
    const nextMatch    = Math.floor(matchIdx / 2)
    const isP1Position = matchIdx % 2 === 0
    if (isP1Position) {
      next[round + 1][nextMatch].p1 = winner
    } else {
      next[round + 1][nextMatch].p2 = winner
    }
    // Clear any stale winner in next round if a different winner was re-selected
    next[round + 1][nextMatch].winner = null

    // Propagate BYE auto-advancement through subsequent rounds
    for (let r = round + 1; r < next.length; r++) {
      const m   = Math.floor(matchIdx / Math.pow(2, r - round))
      const m2  = next[r][m]
      if (!m2) break
      if (m2.p2 === 'BYE' || m2.p1 === 'BYE') {
        const auto = m2.p2 === 'BYE' ? m2.p1 : m2.p2
        if (auto && !auto.startsWith('TBD_')) {
          m2.winner = auto
          if (r + 1 < next.length) {
            const nm  = Math.floor(m / 2)
            const pos = m % 2 === 0
            if (pos) next[r + 1][nm].p1 = auto
            else     next[r + 1][nm].p2 = auto
            next[r + 1][nm].winner = null
          }
        }
      } else {
        break
      }
    }
  }

  return next
}

function getChampion(bracket: Bracket): string | null {
  if (!bracket.length) return null
  const finalRound = bracket[bracket.length - 1]
  return finalRound[0]?.winner ?? null
}

function roundLabel(roundIdx: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIdx
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Finals'
  if (fromEnd === 2) return 'Quarter-Finals'
  return `Round ${roundIdx + 1}`
}

function isTbd(name: string | null): boolean {
  return !name || name.startsWith('TBD_')
}

// ─────────────────────────────────────────────────────────────
// localStorage helpers (SSR-safe)
// ─────────────────────────────────────────────────────────────

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function saveJson(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ─────────────────────────────────────────────────────────────
// Wheel of Names component
// ─────────────────────────────────────────────────────────────

function WheelOfNames() {
  const [participants, setParticipants] = useState<Participant[]>(loadParticipants)
  const [history,      setHistory]      = useState<string[]>(() =>
    loadJson<string[]>(WHEEL_KEY + '_hist', [])
  )
  const [useWeights, setUseWeights] = useState<boolean>(() =>
    loadJson<boolean>(WHEEL_KEY + '_useWeights', false)
  )
  const [inputVal, setInputVal] = useState('')
  const [rotation, setRotation] = useState(0)
  const [winner,   setWinner]   = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)

  const prevRotRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist
  useEffect(() => { saveJson(WHEEL_KEY + '_names', participants) }, [participants])
  useEffect(() => { saveJson(WHEEL_KEY + '_useWeights', useWeights) }, [useWeights])

  // Clean up the spin timer on unmount
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const addName = useCallback(() => {
    const trimmed = inputVal.trim()
    if (!trimmed) return
    setParticipants(prev =>
      prev.some(p => p.name === trimmed) ? prev : [...prev, { name: trimmed, weight: 1 }],
    )
    setInputVal('')
  }, [inputVal])

  const removeName = useCallback((idx: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== idx))
    setWinner(null)
  }, [])

  /** Quick-remove the most recent winner after a spin. */
  const removeWinner = useCallback(() => {
    if (!winner) return
    setParticipants(prev => prev.filter(p => p.name !== winner))
    setWinner(null)
  }, [winner])

  const adjustWeight = useCallback((idx: number, delta: number) => {
    setParticipants(prev => prev.map((p, i) =>
      i === idx ? { ...p, weight: Math.max(1, Math.min(99, p.weight + delta)) } : p,
    ))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addName()
  }, [addName])

  // Effective weights: all-equal when the weight system is off
  const weights  = useMemo(
    () => participants.map(p => (useWeights ? p.weight : 1)),
    [participants, useWeights],
  )
  const segments = useMemo(() => computeSegments(weights), [weights])

  const spin = useCallback(() => {
    if (spinning || participants.length < 2) return
    setWinner(null)
    setSpinning(true)

    // At minimum 5 full rotations + random 0–359° to land on an unknown slice
    const extraDeg    = Math.floor(Math.random() * 360)
    const newRotation = prevRotRef.current + 5 * 360 + extraDeg
    prevRotRef.current = newRotation
    setRotation(newRotation)

    // Compute winner after the transition duration (4.5 s)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const idx = pickWinnerIndex(weights, newRotation)
      const w   = participants[idx]?.name ?? participants[0].name

      setWinner(w)
      setSpinning(false)

      setHistory(prev => {
        const next = [w, ...prev].slice(0, HISTORY_LIMIT)
        saveJson(WHEEL_KEY + '_hist', next)
        return next
      })
    }, 4520)
  }, [spinning, participants, weights])

  const n = participants.length

  return (
    <div className={styles.wheelLayout}>
      {/* ── Names panel ─────────────────────────── */}
      <div className={styles.namesPanel}>
        <div className={styles.namesPanelHead}>
          <p className={styles.namesPanelTitle}>Participants</p>
          <button
            type="button"
            role="switch"
            aria-checked={useWeights}
            className={`${styles.weightToggle} ${useWeights ? styles.weightToggleOn : ''}`}
            onClick={() => setUseWeights(v => !v)}
            title="Give some names a higher chance of winning"
          >
            ⚖ Weights {useWeights ? 'On' : 'Off'}
          </button>
        </div>

        <div className={styles.nameInputRow}>
          <input
            className={styles.nameInput}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a name…"
            maxLength={32}
            aria-label="New participant name"
          />
          <button className={styles.addBtn} onClick={addName} type="button">
            + Add
          </button>
        </div>

        <div className={styles.nameList} role="list">
          {n === 0 && (
            <p className={styles.namesEmpty}>No participants yet</p>
          )}
          {participants.map((p, i) => (
            <div key={p.name + i} className={styles.nameRow} role="listitem">
              <span
                className={styles.nameDot}
                style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }}
                aria-hidden="true"
              />
              <span className={styles.nameText}>{p.name}</span>

              {useWeights && (
                <span className={styles.weightControls}>
                  <button
                    className={styles.weightBtn}
                    onClick={() => adjustWeight(i, -1)}
                    disabled={p.weight <= 1}
                    aria-label={`Decrease ${p.name} weight`}
                    type="button"
                  >
                    −
                  </button>
                  <span className={styles.weightValue} title="Relative chance">×{p.weight}</span>
                  <button
                    className={styles.weightBtn}
                    onClick={() => adjustWeight(i, +1)}
                    disabled={p.weight >= 99}
                    aria-label={`Increase ${p.name} weight`}
                    type="button"
                  >
                    +
                  </button>
                </span>
              )}

              <button
                className={styles.nameRemove}
                onClick={() => removeName(i)}
                aria-label={`Remove ${p.name}`}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {n > 0 && (
          <button
            className={styles.clearBtn}
            onClick={() => { setParticipants([]); setWinner(null); }}
            type="button"
          >
            Clear All
          </button>
        )}
      </div>

      {/* ── Wheel panel ─────────────────────────── */}
      <div className={styles.wheelPanel}>
        <div className={styles.wheelContainer} aria-hidden="true">
          <svg
            viewBox={`0 0 ${WHEEL_VB} ${WHEEL_VB}`}
            className={styles.wheelSvg}
            role="img"
            aria-label="Wheel of names"
          >
            {/* Spinning group */}
            <g
              className={styles.wheelGroup}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {n >= 2
                ? participants.map((p, i) => {
                    const color    = WHEEL_COLORS[i % WHEEL_COLORS.length]
                    const seg      = segments[i]
                    const path     = arcPath(seg.start, seg.end)
                    const lpr      = WHEEL_R * 0.61
                    const lp       = polarToXY(seg.mid, lpr)
                    const maxChars = n > 8 ? 8 : 12
                    return (
                      <g key={p.name + i}>
                        <path d={path} fill={color} stroke="#0d0f12" strokeWidth="1.5" opacity="0.88" />
                        <text
                          x={lp.x}
                          y={lp.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={n > 10 ? '9' : '11'}
                          fontFamily="var(--font-mono)"
                          fill="#0d0f12"
                          fontWeight="700"
                          transform={`rotate(${seg.mid}, ${lp.x}, ${lp.y})`}
                        >
                          {truncate(p.name, maxChars)}
                        </text>
                      </g>
                    )
                  })
                : (
                  // Placeholder disc when < 2 names
                  <circle
                    cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R}
                    fill="rgba(124,149,255,0.07)"
                    stroke="rgba(124,149,255,0.14)"
                    strokeWidth="1.5"
                  />
                )
              }
            </g>

            {/* Static ring overlay */}
            <circle
              className={styles.wheelRing}
              cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R + 2}
              fill="none"
              stroke="rgba(124,149,255,0.18)"
              strokeWidth="2"
            />

            {/* Pointer triangle at 12 o'clock — apex points DOWN into the wheel */}
            <polygon
              className={styles.wheelPointer}
              points={`${WHEEL_CX},28 ${WHEEL_CX - 9},8 ${WHEEL_CX + 9},8`}
              fill="var(--accent-warm)"
            />
            <circle
              className={styles.wheelPointer}
              cx={WHEEL_CX} cy={8} r={4}
              fill="var(--accent-warm)"
            />

            {/* Center hub */}
            <circle
              className={styles.wheelHub}
              cx={WHEEL_CX} cy={WHEEL_CY} r={22}
              fill="var(--bg-main)"
              stroke="rgba(124,149,255,0.28)"
              strokeWidth="1.5"
            />
            <text
              x={WHEEL_CX} y={WHEEL_CY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--text-dark)"
            >
              ◈
            </text>
          </svg>
        </div>

        <button
          className={styles.spinBtn}
          onClick={spin}
          disabled={spinning || n < 2}
          type="button"
          aria-label={spinning ? 'Spinning…' : 'Spin the wheel'}
        >
          {spinning ? 'Spinning…' : n < 2 ? 'Add 2+ Names' : '▶  Spin'}
        </button>

        {winner && (
          <div className={styles.winnerBox} key={winner} role="status" aria-live="polite">
            <p className={styles.winnerLabel}>Winner</p>
            <p className={styles.winnerName}>{winner}</p>
            <button
              className={styles.winnerRemoveBtn}
              onClick={removeWinner}
              type="button"
            >
              ✕ Remove from wheel
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className={styles.historyStrip} aria-label="Recent winners">
            <span className={styles.historyLabel}>Recent</span>
            {history.map((h, i) => (
              <span key={h + i} className={styles.historyChip} title={h}>{h}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Bracket Builder component
// ─────────────────────────────────────────────────────────────

/* ── Bracket builder settings + parsing helpers ─────────────────── */

type BracketFormat = 'single' | 'round_robin'

interface BracketSettings {
  format:      BracketFormat
  randomize:   boolean   // shuffle seeding before building
  teamsMode:   boolean    // pair participants into teams
  teamSize:    number     // members per team when teamsMode
  thirdPlace:  boolean    // single-elim: add a 3rd-place playoff
}

const DEFAULT_SETTINGS: BracketSettings = {
  format:     'single',
  randomize:  false,
  teamsMode:  false,
  teamSize:   2,
  thirdPlace: false,
}

/** Split on commas OR newlines, trim, drop blanks. Accepts either style. */
function parseParticipants(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/** Fisher-Yates shuffle (non-mutating). */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Group names into teams of `size`, labelled "A & B". */
function chunkIntoTeams(names: string[], size: number): string[] {
  if (size < 2) return names
  const teams: string[] = []
  for (let i = 0; i < names.length; i += size) {
    teams.push(names.slice(i, i + size).join(' & '))
  }
  return teams
}

/** Turn raw input + settings into the final ordered entrant list. */
function resolveEntrants(raw: string, s: BracketSettings): string[] {
  let names = parseParticipants(raw)
  if (s.randomize) names = shuffled(names)
  if (s.teamsMode) names = chunkIntoTeams(names, s.teamSize)
  return names.slice(0, BRACKET_MAX)
}

/* Round-robin: every entrant plays every other once. */
interface RRMatch { a: string; b: string; winner: string | null }

function buildRoundRobin(entrants: string[]): RRMatch[] {
  const matches: RRMatch[] = []
  for (let i = 0; i < entrants.length; i++)
    for (let j = i + 1; j < entrants.length; j++)
      matches.push({ a: entrants[i], b: entrants[j], winner: null })
  return matches
}

interface RRStanding { name: string; wins: number; played: number }

function roundRobinStandings(entrants: string[], matches: RRMatch[]): RRStanding[] {
  const wins:   Record<string, number> = {}
  const played: Record<string, number> = {}
  for (const e of entrants) { wins[e] = 0; played[e] = 0 }
  for (const m of matches) {
    if (m.winner) {
      wins[m.winner] = (wins[m.winner] ?? 0) + 1
      played[m.a] = (played[m.a] ?? 0) + 1
      played[m.b] = (played[m.b] ?? 0) + 1
    }
  }
  return entrants
    .map(name => ({ name, wins: wins[name] ?? 0, played: played[name] ?? 0 }))
    .sort((x, y) => y.wins - x.wins || x.name.localeCompare(y.name))
}

function BracketBuilder() {
  const [textInput, setTextInput] = useState<string>(() => {
    const saved = loadJson<{ input: string }>(BRACKET_KEY, { input: '' })
    return saved.input
  })
  const [bracket, setBracket] = useState<Bracket>(() => {
    const saved = loadJson<{ bracket: Bracket }>(BRACKET_KEY, { bracket: [] })
    return saved.bracket
  })
  const [settings, setSettings] = useState<BracketSettings>(() => {
    const saved = loadJson<{ settings?: BracketSettings }>(BRACKET_KEY, {})
    return { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }
  })
  const [rrMatches, setRrMatches] = useState<RRMatch[]>(() => {
    const saved = loadJson<{ rrMatches?: RRMatch[] }>(BRACKET_KEY, {})
    return saved.rrMatches ?? []
  })
  const [rrEntrants, setRrEntrants] = useState<string[]>(() => {
    const saved = loadJson<{ rrEntrants?: string[] }>(BRACKET_KEY, {})
    return saved.rrEntrants ?? []
  })

  const champion = getChampion(bracket)

  const persist = useCallback((patch: Record<string, unknown>) => {
    const base = loadJson<Record<string, unknown>>(BRACKET_KEY, {})
    saveJson(BRACKET_KEY, { ...base, input: textInput, settings, ...patch })
  }, [textInput, settings])

  const setSetting = useCallback(<K extends keyof BracketSettings>(k: K, v: BracketSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [k]: v }
      const base = loadJson<Record<string, unknown>>(BRACKET_KEY, {})
      saveJson(BRACKET_KEY, { ...base, input: textInput, settings: next })
      return next
    })
  }, [textInput])

  const entrantPreview = useMemo(
    () => resolveEntrants(textInput, settings),
    [textInput, settings],
  )

  const handleGenerate = useCallback(() => {
    const entrants = resolveEntrants(textInput, settings)
    if (entrants.length < 2) return

    if (settings.format === 'round_robin') {
      const matches = buildRoundRobin(entrants)
      setRrEntrants(entrants)
      setRrMatches(matches)
      setBracket([])
      persist({ rrEntrants: entrants, rrMatches: matches, bracket: [] })
    } else {
      const newBracket = buildBracket(entrants)
      setBracket(newBracket)
      setRrMatches([]); setRrEntrants([])
      persist({ bracket: newBracket, rrMatches: [], rrEntrants: [] })
    }
  }, [textInput, settings, persist])

  const handleAdvance = useCallback((
    round: number,
    matchIdx: number,
    winner: string,
  ) => {
    if (isTbd(winner) || winner === 'BYE') return
    setBracket(prev => {
      const next = advanceWinner(prev, round, matchIdx, winner)
      persist({ bracket: next })
      return next
    })
  }, [persist])

  const handleRrPick = useCallback((idx: number, winner: string) => {
    setRrMatches(prev => {
      const next = prev.map((m, i) =>
        i === idx ? { ...m, winner: m.winner === winner ? null : winner } : m)
      persist({ rrMatches: next })
      return next
    })
  }, [persist])

  const handleReset = useCallback(() => {
    setBracket([]); setRrMatches([]); setRrEntrants([])
    persist({ bracket: [], rrMatches: [], rrEntrants: [] })
  }, [persist])

  const participantCount = entrantPreview.length
  const hasResult = bracket.length > 0 || rrMatches.length > 0
  const standings = useMemo(
    () => (rrMatches.length ? roundRobinStandings(rrEntrants, rrMatches) : []),
    [rrEntrants, rrMatches],
  )
  const rrLeader = standings.length && standings[0].wins > 0 ? standings[0].name : null

  return (
    <div className={styles.bracketLayout}>
      {/* ── Setup row ─────────────────────────────── */}
      <div className={styles.setupRow}>
        <div className={styles.setupCard}>
          <p className={styles.setupTitle}>Participants</p>
          <textarea
            className={styles.participantTextarea}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder={'Player One, Player Two, Player Three, …\n(commas or new lines)'}
            aria-label="Participant names, separated by commas or new lines"
            spellCheck={false}
          />
          <p className={styles.participantHint}>
            {participantCount} {settings.teamsMode ? 'team' : 'entrant'}{participantCount !== 1 ? 's' : ''} · max {BRACKET_MAX} · comma or line separated
          </p>

          {/* ── Settings ─────────────────────────── */}
          <div className={styles.bracketSettings}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Format</span>
              <div className={styles.segToggle} role="group" aria-label="Tournament format">
                <button type="button"
                  className={`${styles.segBtn} ${settings.format === 'single' ? styles.segBtnActive : ''}`}
                  aria-pressed={settings.format === 'single'}
                  onClick={() => setSetting('format', 'single')}>Single Elim</button>
                <button type="button"
                  className={`${styles.segBtn} ${settings.format === 'round_robin' ? styles.segBtnActive : ''}`}
                  aria-pressed={settings.format === 'round_robin'}
                  onClick={() => setSetting('format', 'round_robin')}>Round Robin</button>
              </div>
            </div>

            <label className={styles.settingCheck}>
              <input type="checkbox" checked={settings.randomize}
                onChange={e => setSetting('randomize', e.target.checked)} />
              <span>Randomize seeding</span>
            </label>

            <label className={styles.settingCheck}>
              <input type="checkbox" checked={settings.teamsMode}
                onChange={e => setSetting('teamsMode', e.target.checked)} />
              <span>Group into teams</span>
            </label>

            {settings.teamsMode && (
              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>Team size</span>
                <input type="number" min={2} max={8} value={settings.teamSize}
                  className={styles.settingNumber}
                  onChange={e => setSetting('teamSize', Math.max(2, Math.min(8, Number(e.target.value) || 2)))} />
              </div>
            )}

            {settings.format === 'round_robin' && participantCount >= 2 && (
              <p className={styles.settingNote}>
                Everyone plays {Math.max(0, participantCount - 1)} game{participantCount - 1 !== 1 ? 's' : ''} — guaranteed minimum.
              </p>
            )}
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={participantCount < 2}
            type="button"
          >
            {settings.format === 'round_robin' ? 'Generate Schedule' : 'Generate Bracket'}
          </button>
          {hasResult && (
            <button className={styles.resetBtn} onClick={handleReset} type="button">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Champion banner ───────────────────────── */}
      {settings.format === 'single' && champion && !champion.startsWith('TBD_') && (
        <div className={styles.championBanner} role="status" aria-live="polite">
          <span className={styles.championGlyph} aria-hidden="true">◈</span>
          <div className={styles.championMeta}>
            <p className={styles.championLabel}>Champion</p>
            <p className={styles.championName}>{champion}</p>
          </div>
        </div>
      )}
      {settings.format === 'round_robin' && rrLeader && (
        <div className={styles.championBanner} role="status" aria-live="polite">
          <span className={styles.championGlyph} aria-hidden="true">◈</span>
          <div className={styles.championMeta}>
            <p className={styles.championLabel}>Leader</p>
            <p className={styles.championName}>{rrLeader}</p>
          </div>
        </div>
      )}

      {/* ── Round-robin display ───────────────────── */}
      {settings.format === 'round_robin' && rrMatches.length > 0 && (
        <div className={styles.rrLayout}>
          <div className={styles.rrStandings}>
            <p className={styles.roundLabel}>Standings</p>
            {standings.map((s, i) => (
              <div key={s.name} className={styles.rrStandRow}>
                <span className={styles.rrRank}>{i + 1}</span>
                <span className={styles.rrStandName}>{s.name}</span>
                <span className={styles.rrStandWins}>{s.wins}W</span>
                <span className={styles.rrStandPlayed}>{s.played} pl</span>
              </div>
            ))}
          </div>
          <div className={styles.rrMatchList}>
            <p className={styles.roundLabel}>Matches · tap the winner</p>
            {rrMatches.map((m, idx) => (
              <div key={idx} className={styles.rrMatch}>
                {[m.a, m.b].map(name => (
                  <button key={name} type="button"
                    className={`${styles.matchSlot} ${m.winner === name ? styles.matchSlotWinner : ''}`}
                    aria-pressed={m.winner === name}
                    onClick={() => handleRrPick(idx, name)}>
                    <span className={`${styles.slotDot} ${m.winner === name ? styles.slotDotWinner : ''}`} aria-hidden="true" />
                    {name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bracket display (single elim) ─────────── */}
      {settings.format === 'single' && (bracket.length === 0 ? (
        <div className={styles.bracketEmpty} aria-label="Bracket not yet generated">
          <p className={styles.bracketEmptyGlyph}>◈</p>
          <p className={styles.bracketEmptyText}>
            Enter participants and click Generate Bracket
          </p>
        </div>
      ) : (
        <div className={styles.bracketScroll}>
          <div className={styles.bracketRounds} role="region" aria-label="Tournament bracket">
            {bracket.map((round, rIdx) => (
              <div key={rIdx} className={styles.bracketRound}>
                <p className={styles.roundLabel}>
                  {roundLabel(rIdx, bracket.length)}
                </p>
                <div className={styles.bracketRoundInner}>
                  {round.map((match, mIdx) => (
                    <div key={mIdx} className={styles.matchCard}>
                      {([match.p1, match.p2] as Array<string | null>).map((p, pi) => {
                        const isWinner = match.winner === p && p !== null && !isTbd(p)
                        const isBye    = p === 'BYE'
                        const isTbdP   = isTbd(p)
                        return (
                          <button
                            key={pi}
                            className={[
                              styles.matchSlot,
                              isWinner  ? styles.matchSlotWinner : '',
                              isBye     ? styles.matchSlotBye    : '',
                              isTbdP    ? styles.matchSlotTbd    : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => p && !isTbdP && !isBye
                              ? handleAdvance(rIdx, mIdx, p)
                              : undefined
                            }
                            disabled={isBye || isTbdP}
                            aria-pressed={isWinner}
                            aria-label={
                              isTbdP  ? 'Awaiting winner' :
                              isBye   ? 'BYE — auto advance' :
                              `${p}${isWinner ? ' (winner)' : ' — click to advance'}`
                            }
                          >
                            <span
                              className={`${styles.slotDot} ${isWinner ? styles.slotDotWinner : ''}`}
                              aria-hidden="true"
                            />
                            {isTbdP ? 'TBD' : (p ?? 'TBD')}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Root view
// ─────────────────────────────────────────────────────────────

type HubTab = 'wheel' | 'bracket'

export default function TournamentHubView() {
  const [tab, setTab] = useState<HubTab>('wheel')

  return (
    <div className={styles.shell}>
      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        <button
          className={`${styles.tab} ${tab === 'wheel' ? styles.tabActive : ''}`}
          onClick={() => setTab('wheel')}
          role="tab"
          aria-selected={tab === 'wheel'}
          type="button"
        >
          ◎ Wheel of Names
        </button>
        <button
          className={`${styles.tab} ${tab === 'bracket' ? styles.tabActive : ''}`}
          onClick={() => setTab('bracket')}
          role="tab"
          aria-selected={tab === 'bracket'}
          type="button"
        >
          ◈ Bracket Builder
        </button>
      </div>

      {/* Tab content — display:none keeps state alive on tab switch */}
      <div style={{ display: tab === 'wheel'   ? 'contents' : 'none' }}>
        <WheelOfNames />
      </div>
      <div style={{ display: tab === 'bracket' ? 'contents' : 'none' }}>
        <BracketBuilder />
      </div>
    </div>
  )
}
