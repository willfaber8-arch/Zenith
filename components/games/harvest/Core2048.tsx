'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Core2048 — Games Tab · Step 4.3 · Harvest Station
 *
 * Classic 2048 sliding-tile game on a 4×4 grid.
 *
 * Movement engine:
 *   • `slideLine` — single reusable primitive that packs, merges, and
 *     pads one row/column to the LEFT. All four directions (L/R/U/D)
 *     reuse it by optionally reversing the extracted line before and
 *     after sliding — no direction-specific duplicate logic.
 *   • `executeMove` — extracts each of 4 rows or columns from the flat
 *     16-element matrix, calls slideLine with correct reversal, writes
 *     back, and accumulates the score delta.
 *   • `spawnTile` — inserts value 2 (90%) or 4 (10%) into a random
 *     empty cell after every move that changed the board.
 *   • `isGameOver` — no empty cells AND no horizontally or vertically
 *     adjacent equal pairs.
 *
 * Win / game-over:
 *   • Reaching 2048 for the first time shows a win overlay.
 *     "Keep Going" dismisses it without ending the game.
 *   • Game-over triggers payout: addResources('raw_data_shards',
 *     Math.floor(currentScore / 10)).
 *
 * Input:
 *   • Arrow keys via stable window keydown listener (useRef pattern).
 *   • Touch swipe via touchstart/touchend (30 px threshold).
 *
 * Stale-closure prevention:
 *   • matrixRef / scoreRef / phaseRef / hasWonRef mirror React state.
 *   • processMoveRef keeps the stable keyboard listener always current.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import { useZenithEconomy }      from '@/hooks/useZenithEconomy'
import type { GameSessionResult } from '@/components/games/UniversalGameWrapper'
import styles from './Core2048.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const GRID = 4
const SIZE = GRID * GRID   // 16

/** localStorage key for persisting the all-time best score. */
const BEST_SCORE_KEY = 'zenith_2048_best_v1'

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** (x, y) coordinates within the 4×4 grid: x = column, y = row. */
export interface TileCoordinates {
  x: number
  y: number
}

/** Complete game state snapshot for external consumers. */
export interface Board2048State {
  /** Flat 16-element array representing the 4×4 board. */
  matrix:       number[]
  currentScore: number
  isTerminated: boolean
  /** True once a 2048 tile has been created — stays true after that. */
  hasWon:       boolean
}

export interface Core2048Props {
  onSessionComplete?: (finalScore: number) => void
  /** Injected by UniversalGameWrapper when mounted as an Arcade plugin. */
  onGameComplete?:    (result: GameSessionResult) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type Direction = 'left' | 'right' | 'up' | 'down'
type GamePhase = 'active' | 'gameover'

interface MoveResult {
  matrix:     number[]
  scoreDelta: number
  changed:    boolean
}

/* ════════════════════════════════════════════════════════════════
   §4  PURE MATH & GRID UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Slides and merges one line (length 4) towards the LEFT edge.
 *
 *   1. Pack: strip all zeros → compress numbers to the front.
 *   2. Merge: left-to-right pass — any two consecutive equal values
 *      collapse into one doubled value; the vacated slot becomes 0
 *      (preventing a chain-merge on the same pass).
 *   3. Re-pack: strip zeros introduced by merge, pad trailing zeros
 *      back to length 4.
 *
 * Returns the resulting line and the score earned from merges.
 */
function slideLine(line: number[]): { result: number[]; score: number } {
  // Step 1 — pack
  const packed = line.filter(v => v !== 0)

  // Step 2 — merge (single left-to-right pass)
  let score = 0
  for (let i = 0; i < packed.length - 1; i++) {
    if (packed[i] !== 0 && packed[i] === packed[i + 1]) {
      packed[i]     *= 2
      score         += packed[i]
      packed[i + 1]  = 0
    }
  }

  // Step 3 — re-pack and pad
  const merged = packed.filter(v => v !== 0)
  while (merged.length < GRID) merged.push(0)

  return { result: merged, score }
}

// ── Row helpers ──────────────────────────────────────────────

function getRow(m: number[], r: number): number[] {
  return [m[r*GRID], m[r*GRID+1], m[r*GRID+2], m[r*GRID+3]]
}
function setRow(m: number[], r: number, line: number[]): void {
  m[r*GRID] = line[0]; m[r*GRID+1] = line[1]
  m[r*GRID+2] = line[2]; m[r*GRID+3] = line[3]
}

// ── Column helpers ───────────────────────────────────────────

function getColumn(m: number[], c: number): number[] {
  return [m[c], m[c+GRID], m[c+GRID*2], m[c+GRID*3]]
}
function setColumn(m: number[], c: number, line: number[]): void {
  m[c] = line[0]; m[c+GRID] = line[1]
  m[c+GRID*2] = line[2]; m[c+GRID*3] = line[3]
}

/**
 * Applies a directional move to the entire matrix.
 *
 * All four directions reuse `slideLine` (which slides LEFT):
 *   • left  — extract rows as-is, slide, write back.
 *   • right — extract rows, reverse, slide, reverse result, write back.
 *   • up    — extract columns, slide, write back.
 *   • down  — extract columns, reverse, slide, reverse result, write back.
 *
 * Returns the new matrix, score delta, and whether anything changed.
 */
function executeMove(matrix: number[], direction: Direction): MoveResult {
  const next     = [...matrix]
  let scoreDelta = 0
  let changed    = false

  const useCol  = direction === 'up'    || direction === 'down'
  const reverse = direction === 'right' || direction === 'down'

  for (let i = 0; i < GRID; i++) {
    const raw     = useCol ? getColumn(next, i) : getRow(next, i)
    const toSlide = reverse ? [...raw].reverse() : [...raw]

    const { result, score } = slideLine(toSlide)
    scoreDelta += score

    const final = reverse ? [...result].reverse() : result

    if (final.some((v, j) => v !== raw[j])) changed = true

    if (useCol) setColumn(next, i, final)
    else        setRow(next, i, final)
  }

  return { matrix: next, scoreDelta, changed }
}

/**
 * Inserts a new tile into a random empty cell.
 * Value 2 at 90% probability, 4 at 10%.
 * Returns the new matrix and the index of the spawned tile (-1 if full).
 */
function spawnTile(matrix: number[]): { matrix: number[]; spawnedIdx: number } {
  const empty = matrix.reduce<number[]>(
    (acc, v, i) => (v === 0 ? [...acc, i] : acc), []
  )
  if (empty.length === 0) return { matrix, spawnedIdx: -1 }

  const idx  = empty[Math.floor(Math.random() * empty.length)]
  const next = [...matrix]
  next[idx]  = Math.random() < 0.9 ? 2 : 4
  return { matrix: next, spawnedIdx: idx }
}

/**
 * Returns true when the board is in a terminal state:
 * no empty cells exist AND no orthogonally adjacent cells share a value.
 */
function isGameOver(matrix: number[]): boolean {
  if (matrix.includes(0)) return false

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = matrix[r * GRID + c]
      if (c < GRID - 1 && v === matrix[r * GRID + c + 1]) return false  // horizontal
      if (r < GRID - 1 && v === matrix[(r + 1) * GRID + c]) return false  // vertical
    }
  }

  return true
}

/** Creates the initial board with exactly 2 randomly placed tiles. */
function createInitialBoard(): number[] {
  let m = Array<number>(SIZE).fill(0)
  ;({ matrix: m } = spawnTile(m))
  ;({ matrix: m } = spawnTile(m))
  return m
}

/* ════════════════════════════════════════════════════════════════
   §5  TILE STYLE HELPERS
   Dynamic visual tokens mapped from tile value.
   Colour progression: neutral → green ramp (2–64) →
   purple ramp (128–512) → bright green glow (1024+).
   All values use CSS custom properties — no hardcoded hex.
   ════════════════════════════════════════════════════════════════ */

interface TileStyle {
  background: string
  color:      string
  border?:    string
  boxShadow?: string
  fontSize:   string
}

function getTileStyle(value: number): TileStyle {
  const fontSize =
    value >= 1000 ? '0.88rem'
    : value >= 100  ? '1.0rem'
    :                 '1.25rem'

  if (value === 0) return {
    background: 'color-mix(in srgb, var(--text-muted) 6%, transparent)',
    color:      'transparent',
    fontSize,
  }

  // Green ramp: 2 → 64
  if (value <= 2)   return { background: 'var(--surface-card)',                                                           color: 'var(--text-muted)',   fontSize }
  if (value <= 4)   return { background: 'color-mix(in srgb, var(--accent-green)  8%, var(--surface-card))',              color: 'var(--text-primary)', fontSize }
  if (value <= 8)   return { background: 'color-mix(in srgb, var(--accent-green) 18%, var(--surface-card))',              color: 'var(--text-primary)', fontSize }
  if (value <= 16)  return { background: 'color-mix(in srgb, var(--accent-green) 28%, var(--surface-card))',              color: 'var(--text-primary)', fontSize }
  if (value <= 32)  return { background: 'color-mix(in srgb, var(--accent-green) 38%, var(--surface-card))',              color: 'var(--text-primary)', fontSize }
  if (value <= 64)  return { background: 'color-mix(in srgb, var(--accent-green) 50%, var(--surface-card))',              color: 'var(--bg-main)',      fontSize }

  // Purple ramp: 128 → 512
  if (value <= 128) return { background: 'color-mix(in srgb, var(--accent-purple) 22%, var(--surface-card))',             color: 'var(--text-primary)', fontSize }
  if (value <= 256) return { background: 'color-mix(in srgb, var(--accent-purple) 35%, var(--surface-card))',             color: 'var(--text-primary)', fontSize }
  if (value <= 512) return { background: 'color-mix(in srgb, var(--accent-purple) 48%, var(--surface-card))',             color: 'var(--text-primary)', fontSize }

  // High-tier 1024: green glow + border
  if (value <= 1024) return {
    background: 'color-mix(in srgb, var(--accent-green) 62%, var(--surface-card))',
    color:      'var(--bg-main)',
    border:     '2px solid var(--accent-green)',
    boxShadow:  '0 0 16px color-mix(in srgb, var(--accent-green) 40%, transparent)',
    fontSize,
  }

  // 2048: intense green glow + border
  if (value <= 2048) return {
    background: 'color-mix(in srgb, var(--accent-green) 82%, var(--surface-card))',
    color:      'var(--bg-main)',
    border:     '2px solid var(--accent-green)',
    boxShadow:  '0 0 28px color-mix(in srgb, var(--accent-green) 65%, transparent)',
    fontSize,
  }

  // 4096+: full radiant
  return {
    background: 'color-mix(in srgb, var(--accent-green) 90%, transparent)',
    color:      'var(--bg-main)',
    border:     '2px solid var(--accent-green)',
    boxShadow:  '0 0 40px color-mix(in srgb, var(--accent-green) 80%, transparent)',
    fontSize,
  }
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function Core2048({
  onSessionComplete,
  onGameComplete,
}: Core2048Props) {
  const { addResources } = useZenithEconomy()

  /* ── Game state ──────────────────────────────────────────────── */
  const [matrix,     setMatrix]     = useState<number[]>(() => createInitialBoard())
  const [score,      setScore]      = useState(0)
  const [bestScore,  setBestScore]  = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10)
  })
  const [phase,      setPhase]      = useState<GamePhase>('active')
  const [hasWon,     setHasWon]     = useState(false)
  const [wonAcked,   setWonAcked]   = useState(false)   // player pressed "Keep Going"
  const [spawnedIdx, setSpawnedIdx] = useState(-1)       // index of last spawned tile

  /* ── Refs: synchronous reads for event handlers ──────────────── */
  const matrixRef      = useRef(matrix)
  const scoreRef       = useRef(score)
  const phaseRef       = useRef<GamePhase>('active')
  const hasWonRef      = useRef(false)
  const processMoveRef = useRef<(dir: Direction) => void>(() => {})
  const touchStartRef  = useRef<TileCoordinates | null>(null)

  // Sync refs every render
  matrixRef.current  = matrix
  scoreRef.current   = score
  phaseRef.current   = phase
  hasWonRef.current  = hasWon

  /* ── Lifecycle ───────────────────────────────────────────────── */
  useEffect(() => {
    // Clear spawnedIdx after the pop-in animation completes
    if (spawnedIdx === -1) return
    const t = setTimeout(() => setSpawnedIdx(-1), 260)
    return () => clearTimeout(t)
  }, [spawnedIdx])

  // Persist best score to localStorage
  useEffect(() => {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore))
  }, [bestScore])

  /* ── Game-over payout ────────────────────────────────────────── */
  const handleGameOver = useCallback((finalScore: number) => {
    // Refined resource → smaller divisor keeps payouts within quantum_fuel caps.
    const payout = Math.floor(finalScore / 40)
    if (payout > 0) {
      void addResources('quantum_fuel', payout).catch(() => {})
    }
    onSessionComplete?.(finalScore)
    onGameComplete?.({ score: finalScore, status: 'completed' })
  }, [addResources, onSessionComplete, onGameComplete])

  /* ── Core move processor ─────────────────────────────────────── */
  const processMove = useCallback((dir: Direction) => {
    if (phaseRef.current === 'gameover') return

    const prev = matrixRef.current
    const { matrix: moved, scoreDelta, changed } = executeMove(prev, dir)

    if (!changed) return

    const { matrix: afterSpawn, spawnedIdx: sIdx } = spawnTile(moved)

    const newScore = scoreRef.current + scoreDelta
    // Sync refs immediately — protects against rapid successive key events
    // before React's next render cycle updates the state.
    matrixRef.current = afterSpawn
    scoreRef.current  = newScore

    setMatrix(afterSpawn)
    setScore(newScore)
    if (sIdx >= 0) setSpawnedIdx(sIdx)
    setBestScore(b => {
      const next = Math.max(b, newScore)
      return next
    })

    // Win detection: first time a 2048 tile appears on the board
    if (!hasWonRef.current && afterSpawn.includes(2048)) {
      hasWonRef.current = true
      setHasWon(true)
    }

    // Game-over detection
    if (isGameOver(afterSpawn)) {
      phaseRef.current = 'gameover'
      setPhase('gameover')
      handleGameOver(newScore)
    }
  }, [handleGameOver])

  // Keep ref in sync so stable event listeners always call latest version
  processMoveRef.current = processMove

  /* ── Keyboard handler (stable, registered once) ──────────────── */
  useEffect(() => {
    const DIR_MAP: Record<string, Direction> = {
      ArrowLeft:  'left',
      ArrowRight: 'right',
      ArrowUp:    'up',
      ArrowDown:  'down',
    }

    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const dir = DIR_MAP[e.key]
      if (!dir) return

      e.preventDefault()
      processMoveRef.current(dir)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── Touch / swipe handler (stable, registered once) ────────── */
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      touchStartRef.current = null

      const MIN_SWIPE = 30   // minimum swipe distance in px
      if (Math.abs(dx) > Math.abs(dy)) {
        if      (dx >  MIN_SWIPE) processMoveRef.current('right')
        else if (dx < -MIN_SWIPE) processMoveRef.current('left')
      } else {
        if      (dy >  MIN_SWIPE) processMoveRef.current('down')
        else if (dy < -MIN_SWIPE) processMoveRef.current('up')
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [])

  /* ── Reset / new game ────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    const fresh = createInitialBoard()
    matrixRef.current  = fresh
    scoreRef.current   = 0
    phaseRef.current   = 'active'
    hasWonRef.current  = false

    setMatrix(fresh)
    setScore(0)
    setPhase('active')
    setHasWon(false)
    setWonAcked(false)
    setSpawnedIdx(-1)
  }, [])

  /* ── Derived display values ──────────────────────────────────── */
  const showWinOverlay = hasWon && !wonAcked && phase !== 'gameover'

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div
      className={styles.root}
      data-phase={phase}
    >

      {/* ════════════════════════════════════════════════════════
          STATS STRIP
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsBar} aria-label="Game statistics">

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SCORE</span>
          <span className={styles.statValue}>{score.toLocaleString('en-US')}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>BEST</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {bestScore.toLocaleString('en-US')}
          </span>
        </div>

        {hasWon && (
          <>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statGroup}>
              <span className={`${styles.statLabel} ${styles.statGreenLabel}`}>
                2048 ✓
              </span>
            </div>
          </>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════
          PUZZLE BOARD — 4×4 CSS grid
          key={idx} on each cell keeps DOM stable for transition;
          values changing causes background/color CSS transitions.
          The spawned cell gets .cellNew for the pop-in animation.
          ════════════════════════════════════════════════════════ */}
      <div className={styles.boardWrapper}>
        <div
          className={styles.board}
          role="grid"
          aria-label="2048 puzzle grid — use arrow keys or swipe to slide tiles"
          aria-roledescription="sliding tile game"
        >
          {matrix.map((value, idx) => {
            const ts    = getTileStyle(value)
            const isNew = idx === spawnedIdx && value !== 0

            return (
              <div
                key={idx}
                className={`${styles.cell} ${isNew ? styles.cellNew : ''}`}
                style={{
                  background: ts.background,
                  color:      ts.color,
                  border:     ts.border    ?? 'none',
                  boxShadow:  ts.boxShadow ?? 'none',
                  // background + boxShadow transition gives the merge colour pop
                  transition: 'background 180ms ease-in-out, box-shadow 180ms ease-in-out',
                }}
                role="gridcell"
                aria-label={value !== 0 ? String(value) : 'empty cell'}
              >
                {value !== 0 && (
                  <span
                    className={styles.cellNum}
                    style={{ fontSize: ts.fontSize }}
                  >
                    {value}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'active' && 'Arrow keys or swipe to slide and merge tiles.'}
        {phase === 'gameover' && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          WIN OVERLAY — "Keep Going" or "New Game"
          Dismissed by the player; game continues after dismissal.
          ════════════════════════════════════════════════════════ */}
      {showWinOverlay && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="You reached 2048!"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>2048 reached</p>
            <p className={styles.resultSubtitle}>
              Nicely done.
            </p>

            <div className={styles.resultActions}>
              <button
                className={styles.continueBtn}
                onClick={() => setWonAcked(true)}
                aria-label="Continue playing beyond 2048"
              >
                Keep Going
              </button>
              <button
                className={styles.restartBtn}
                onClick={handleReset}
                aria-label="Start a new game"
              >
                New Game
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          GAME-OVER OVERLAY — score breakdown + payout summary
          ════════════════════════════════════════════════════════ */}
      {phase === 'gameover' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Game over — no valid moves remain"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>No valid moves</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Final Score</span>
                <span className={styles.resultVal}>
                  {score.toLocaleString('en-US')}
                </span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Best Score</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  {bestScore.toLocaleString('en-US')}
                </span>
              </div>

              <div className={styles.resultDivider} aria-hidden="true" />

              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Quantum Fuel Awarded</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  +{Math.floor(score / 40).toLocaleString('en-US')}
                </span>
              </div>

              {hasWon && (
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>Achievement</span>
                  <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                    2048 ✓
                  </span>
                </div>
              )}
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new game"
            >
              Play Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
