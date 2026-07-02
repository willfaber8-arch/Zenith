'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * ShiftMatrix — Games Tab · Step 4.2 · Harvest Station
 *
 * Classic 15-puzzle (4×4 sliding-tile) with:
 *   • Guaranteed-solvable init via inversion-count parity analysis.
 *     Swapping the first two non-blank tiles flips inversion parity,
 *     converting any unsolvable shuffle into a solvable one in O(n²).
 *   • Buttery smooth tile animation: tiles are position:absolute
 *     within a position:relative board container. React `key={value}`
 *     keeps each tile's DOM element stable across re-renders, so only
 *     `transform: translate(x,y)` changes — CSS transitions animate it.
 *   • Click + ArrowKey slide mechanics with stale-closure prevention
 *     via tilesRef mirrors.
 *   • Victory payout: 300 raw_data_shards + 5 quantum_fuel committed
 *     atomically via addResources on solve detection.
 *   • boardKey remount on reset prevents tiles animating to shuffled
 *     positions at the start of a new game.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useZenithEconomy }      from '@/hooks/useZenithEconomy'
import type { GameSessionResult } from '@/components/games/UniversalGameWrapper'
import styles from './ShiftMatrix.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const GRID_SIZE  = 4
const TILE_COUNT = GRID_SIZE * GRID_SIZE                              // 16
const TILE_PX    = 72                                                 // tile width/height (px)
const GAP_PX     = 8                                                  // inter-tile gap (px)
const BOARD_PX   = GRID_SIZE * TILE_PX + (GRID_SIZE - 1) * GAP_PX   // 312 px

/** The unique solved configuration — 1–15 ascending, blank at bottom-right. */
const SOLVED_TILES: readonly number[] = Object.freeze(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]
)

/* Solving the puzzle refines stardust glass. Kept small to fit refined caps. */
const GLASS_PAYOUT = 15

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** Describes a single tile's runtime position and slide eligibility. */
export interface ShiftTileNode {
  /** Tile face value. 0 represents the empty cell slot. */
  value: number
  /** Flat index 0–15 in the current tiles array. */
  currentPosition: number
  /** True when the tile is orthogonally adjacent to the empty cell. */
  isMovable: boolean
}

/** Complete game state snapshot — mirrors the component's internal React state. */
export interface ShiftMatrixState {
  tiles:          number[]
  moveCount:      number
  isSolved:       boolean
  elapsedSeconds: number
}

export interface ShiftMatrixProps {
  onSessionComplete?: (finalScore: number) => void
  /** Injected by UniversalGameWrapper when mounted as an Arcade plugin. */
  onGameComplete?:    (result: GameSessionResult) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type GamePhase = 'idle' | 'active' | 'won'

/* ════════════════════════════════════════════════════════════════
   §4  PURE MATH & PUZZLE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Counts inversions in the non-blank portion of the tile array.
 * An inversion is any pair (i < j) where arr[i] > arr[j],
 * ignoring the blank (value 0).
 *
 * Time complexity: O(n²) on 15 elements — negligible.
 */
function countInversions(arr: number[]): number {
  const seq = arr.filter(v => v !== 0)
  let inv = 0
  for (let i = 0; i < seq.length - 1; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      if (seq[i] > seq[j]) inv++
    }
  }
  return inv
}

/**
 * Determines whether a 4×4 15-puzzle configuration is reachable
 * from the solved state (i.e., is solvable).
 *
 * Rule (even-width grid):
 *   • blank on ODD  row from bottom → solvable iff inversions EVEN
 *   • blank on EVEN row from bottom → solvable iff inversions ODD
 * Row counting is 1-indexed starting at the bottom of the grid.
 */
function isPuzzleSolvable(tiles: number[]): boolean {
  const inv           = countInversions(tiles)
  const emptyIdx      = tiles.indexOf(0)
  const rowFromBottom = GRID_SIZE - Math.floor(emptyIdx / GRID_SIZE)  // 1-indexed

  return rowFromBottom % 2 === 1
    ? inv % 2 === 0   // odd row  from bottom → even inversions → solvable
    : inv % 2 === 1   // even row from bottom → odd  inversions → solvable
}

/**
 * Generates a fully shuffled, guaranteed-solvable 15-puzzle configuration.
 *
 * Algorithm:
 *   1. Fisher-Yates shuffle of [1…15, 0].
 *   2. If the result fails the solvability test, swap the first two
 *      non-blank tiles — this flips inversion parity without changing
 *      the blank's row, making any unsolvable state solvable.
 */
function generateSolvable(): number[] {
  const arr: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  if (!isPuzzleSolvable(arr)) {
    // Find the first two non-blank positions and swap them
    let a = -1, b = -1
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== 0) {
        if (a === -1) a = i
        else          { b = i; break }
      }
    }
    ;[arr[a], arr[b]] = [arr[b], arr[a]]
  }

  return arr
}

/**
 * Returns true when `targetIdx` is orthogonally adjacent to `emptyIdx`
 * in a GRID_SIZE × GRID_SIZE grid (no wrap-around).
 */
function isAdjacentToBlank(emptyIdx: number, targetIdx: number): boolean {
  if (targetIdx < 0 || targetIdx >= TILE_COUNT) return false
  const dr = Math.abs(Math.floor(targetIdx / GRID_SIZE) - Math.floor(emptyIdx / GRID_SIZE))
  const dc = Math.abs(targetIdx % GRID_SIZE - emptyIdx % GRID_SIZE)
  return dr + dc === 1
}

/**
 * Returns the set of flat indices that are currently movable —
 * all four orthogonal neighbours of the blank cell that lie within bounds.
 */
function buildMovableSet(emptyIdx: number): Set<number> {
  const s = new Set<number>()
  const row = Math.floor(emptyIdx / GRID_SIZE)
  const col = emptyIdx % GRID_SIZE
  if (row > 0)             s.add(emptyIdx - GRID_SIZE)
  if (row < GRID_SIZE - 1) s.add(emptyIdx + GRID_SIZE)
  if (col > 0)             s.add(emptyIdx - 1)
  if (col < GRID_SIZE - 1) s.add(emptyIdx + 1)
  return s
}

/**
 * Pixel translation for the tile at flat index `idx`.
 * All tiles are positioned from the board's top-left corner via
 * `transform: translate(x, y)` so CSS can animate position changes.
 */
function tileTranslate(idx: number): { x: number; y: number } {
  return {
    x: (idx % GRID_SIZE) * (TILE_PX + GAP_PX),
    y: Math.floor(idx / GRID_SIZE) * (TILE_PX + GAP_PX),
  }
}

/** Formats a total-seconds count as `M:SS`. */
function fmtTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ════════════════════════════════════════════════════════════════
   §5  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function ShiftMatrix({
  onSessionComplete,
  onGameComplete,
}: ShiftMatrixProps) {
  const { addResources } = useZenithEconomy()

  /* ── Game state ──────────────────────────────────────────────── */
  const [tiles,          setTiles]          = useState<number[]>(() => generateSolvable())
  const [moveCount,      setMoveCount]      = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [phase,          setPhase]          = useState<GamePhase>('idle')
  /**
   * boardKey — incremented on every new game to force full remount
   * of the tile grid, preventing CSS transitions from animating tiles
   * to their freshly shuffled positions at the start of a session.
   */
  const [boardKey, setBoardKey] = useState(0)

  /* ── Refs: synchronous hot-path reads inside event handlers ──── */
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef  = useRef(true)
  const hasStartedRef = useRef(false)
  /** Always mirrors `tiles` so the keyboard handler never captures stale state. */
  const tilesRef      = useRef(tiles)
  /** Stable callback ref — prevents keyboard useEffect from re-registering. */
  const slideAtRef    = useRef<(targetIdx: number) => void>(() => {})

  // Sync refs synchronously at the top of every render
  tilesRef.current = tiles

  /* ── Lifecycle ───────────────────────────────────────────────── */
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  /* ── Derived: empty tile position + movable set ─────────────── */
  const emptyIdx   = tiles.indexOf(0)
  const movableSet = useMemo(() => buildMovableSet(emptyIdx), [emptyIdx])

  /* ── Timer ───────────────────────────────────────────────────── */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      if (isMountedRef.current) setElapsedSeconds(s => s + 1)
    }, 1000)
  }, [stopTimer])

  /* ── Victory commit ──────────────────────────────────────────── */
  const handleVictory = useCallback(() => {
    stopTimer()
    setPhase('won')

    // Refine stardust glass on solve — throw-never, fire-and-forget
    void addResources('stardust_glass', GLASS_PAYOUT).catch(() => {})

    onSessionComplete?.(GLASS_PAYOUT)
    onGameComplete?.({ score: GLASS_PAYOUT, status: 'completed' })
  }, [stopTimer, addResources, onSessionComplete, onGameComplete])

  /* ── Core slide action ───────────────────────────────────────── */
  /**
   * Attempts to slide the tile at `targetIdx` into the blank space.
   * Reads from `tilesRef` (always current) rather than captured state
   * to avoid stale-closure issues in rapid keyboard input.
   *
   * Keyboard convention: arrow keys move the BLANK in that direction
   * (the adjacent tile slides into the blank in the opposite direction).
   */
  const slideAt = useCallback((targetIdx: number) => {
    if (phase === 'won') return

    const current = tilesRef.current
    const emptyI  = current.indexOf(0)

    if (!isAdjacentToBlank(emptyI, targetIdx)) return

    // Start the clock on the player's very first valid move
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      startTimer()
      setPhase('active')
    }

    const next = [...current]
    next[emptyI]    = next[targetIdx]
    next[targetIdx] = 0

    // Update ref immediately so rapid arrow key events read fresh state
    tilesRef.current = next
    setTiles(next)
    setMoveCount(m => m + 1)

    if (next.every((v, i) => v === SOLVED_TILES[i])) handleVictory()
  }, [phase, startTimer, handleVictory])

  // Keep slideAtRef in sync so the stable keyboard listener always
  // calls the latest version without re-registering on every render.
  slideAtRef.current = slideAt

  /* ── Keyboard handler (stable, registered once) ──────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const current  = tilesRef.current
      const emptyI   = current.indexOf(0)
      const emptyRow = Math.floor(emptyI / GRID_SIZE)
      const emptyCol = emptyI % GRID_SIZE

      // Arrow key → direction the BLANK moves → target tile slides opposite
      let target = -1
      switch (e.key) {
        case 'ArrowUp':
          // Blank moves up → tile directly above blank slides down
          if (emptyRow > 0) target = emptyI - GRID_SIZE
          break
        case 'ArrowDown':
          // Blank moves down → tile directly below blank slides up
          if (emptyRow < GRID_SIZE - 1) target = emptyI + GRID_SIZE
          break
        case 'ArrowLeft':
          // Blank moves left → tile directly left of blank slides right
          if (emptyCol > 0) target = emptyI - 1
          break
        case 'ArrowRight':
          // Blank moves right → tile directly right of blank slides left
          if (emptyCol < GRID_SIZE - 1) target = emptyI + 1
          break
        default:
          return
      }

      if (target === -1) return
      e.preventDefault()
      slideAtRef.current(target)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])   // ← empty deps: listener is stable via slideAtRef

  /* ── Reset / new game ────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    stopTimer()
    hasStartedRef.current = false

    const fresh = generateSolvable()
    tilesRef.current = fresh

    setTiles(fresh)
    setMoveCount(0)
    setElapsedSeconds(0)
    setPhase('idle')
    setBoardKey(k => k + 1)   // remount board → no slide animation on shuffle
  }, [stopTimer])

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div
      className={styles.root}
      data-phase={phase}
    >

      {/* ════════════════════════════════════════════════════════
          STATS STRIP
          ════════════════════════════════════════════════════════ */}
      <div
        className={styles.statsBar}
        style={{ width: BOARD_PX }}
        aria-label="Game statistics"
      >
        <div className={styles.stat}>
          <span className={styles.statLabel}>MOVES</span>
          <span className={styles.statValue}>{moveCount}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.stat}>
          <span className={styles.statLabel}>TIME</span>
          <span className={styles.statValue}>{fmtTime(elapsedSeconds)}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.stat}>
          <span className={styles.statLabel}>PRIZE</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {GLASS_PAYOUT} glass
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PUZZLE BOARD
          Tiles are position:absolute within this position:relative
          container. key={value} keeps DOM elements stable so only
          their `transform` changes — CSS transitions animate it.
          key={boardKey} on the wrapper forces full remount on reset.
          ════════════════════════════════════════════════════════ */}
      <div className={styles.boardWrapper}>
        <div
          key={boardKey}
          className={styles.board}
          style={{ width: BOARD_PX, height: BOARD_PX }}
          role="grid"
          aria-label="15-puzzle grid. Use arrow keys or click tiles to slide."
          aria-roledescription="sliding puzzle"
        >
          {tiles.map((value, idx) => {
            const { x, y }  = tileTranslate(idx)
            const isMovable = movableSet.has(idx)

            if (value === 0) {
              return (
                <div
                  key={0}
                  className={styles.tileEmpty}
                  style={{
                    width:     TILE_PX,
                    height:    TILE_PX,
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  aria-hidden="true"
                />
              )
            }

            return (
              <div
                key={value}
                className={`${styles.tile} ${isMovable ? styles.tileMovable : ''}`}
                style={{
                  width:      TILE_PX,
                  height:     TILE_PX,
                  transform:  `translate(${x}px, ${y}px)`,
                  transition: 'transform 200ms ease-out',
                }}
                onClick={() => slideAt(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    slideAt(idx)
                  }
                }}
                role="gridcell"
                tabIndex={isMovable ? 0 : -1}
                aria-label={`Tile ${value}${isMovable ? ', movable — press Enter or Space to slide' : ''}`}
              >
                <span className={styles.tileNum}>{value}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'idle'   && 'Click a tile or use arrow keys to start the clock.'}
        {phase === 'active' && 'Arrange 1–15 in order with the blank at bottom-right.'}
        {phase === 'won'    && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          VICTORY OVERLAY
          ════════════════════════════════════════════════════════ */}
      {phase === 'won' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Puzzle solved — results"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>Solved</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Total Moves</span>
                <span className={styles.resultVal}>{moveCount}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Elapsed Time</span>
                <span className={styles.resultVal}>{fmtTime(elapsedSeconds)}</span>
              </div>

              <div className={styles.resultDivider} aria-hidden="true" />

              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Stardust Glass</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  +{GLASS_PAYOUT}
                </span>
              </div>
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new puzzle"
            >
              Defragment Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
