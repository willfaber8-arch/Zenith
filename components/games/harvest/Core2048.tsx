'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Core2048 — Games Tab · Harvest Station
 *
 * Classic 2048 sliding-tile game on a 4×4 grid with REAL tile motion.
 *
 * Tile-identity model:
 *   • Each tile is an object { id, value, row, col }. Ids are stable
 *     across moves, so React reuses the DOM node and a CSS
 *     `transition: transform` glides the tile to its new cell.
 *   • Tiles are `position:absolute` inside a `position:relative` board
 *     of fixed pixel size. Position = translate(col*STEP, row*STEP).
 *
 * Movement engine (pure, tile-aware):
 *   • `moveTiles(tiles, dir)` — projects the tile set onto lines
 *     (rows for L/R, columns for U/D), slides + merges each line while
 *     preserving tile identity, and returns the moved tile set, the
 *     ids of newly-merged result tiles (for the merge pop), and score.
 *   • Merged pairs: both source tiles slide onto the same destination
 *     cell; the surviving tile takes the doubled value and pops; the
 *     absorbed tile is removed after the slide completes.
 *   • `spawnTile` — inserts value 2 (90%) or 4 (10%) into a random
 *     empty cell after every move that changed the board; it pops in.
 *   • `isGameOver` — no empty cells AND no adjacent equal pairs.
 *
 * Win / game-over:
 *   • Reaching 2048 for the first time shows a win overlay.
 *     "Keep Going" dismisses it without ending the game.
 *   • Game-over triggers payout: addResources('quantum_fuel',
 *     Math.floor(finalScore / 40)).
 *
 * Input:
 *   • Arrow keys via stable window keydown listener (useRef pattern).
 *   • Pointer swipe on the board (mouse + touch + pen, MIN_SWIPE 24px).
 *
 * Stale-closure prevention:
 *   • tilesRef / scoreRef / phaseRef / hasWonRef mirror React state.
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

/** Fixed cell geometry (must match the CSS values below). */
const CELL = 74   // px — tile size
const GAP  = 8    // px — gap between cells
const STEP = CELL + GAP            // 82 — per-cell translate step
const BOARD_PX = CELL * GRID + GAP * (GRID - 1)  // 344 — inner board size

/** Duration of the slide transition (keep in sync with CSS). */
const SLIDE_MS = 120

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

/** A single tile with a stable identity so React reuses its DOM node. */
interface Tile {
  id:    number
  value: number
  row:   number
  col:   number
  /** True for one render immediately after this tile is spawned. */
  isNew?:    boolean
  /** True for one render immediately after this tile absorbs a merge. */
  isMerged?: boolean
}

interface MoveResult {
  tiles:      Tile[]
  scoreDelta: number
  changed:    boolean
}

/* ════════════════════════════════════════════════════════════════
   §4  PURE MATH & TILE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/** Monotonic id generator for stable tile identities. */
let TILE_SEQ = 1
function nextId(): number { return TILE_SEQ++ }

/** Empty [row][col] board indices helper. */
function emptyCells(tiles: Tile[]): TileCoordinates[] {
  const occupied = new Set<number>()
  for (const t of tiles) occupied.add(t.row * GRID + t.col)
  const out: TileCoordinates[] = []
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!occupied.has(r * GRID + c)) out.push({ x: c, y: r })
    }
  }
  return out
}

/**
 * Applies a directional move to the tile set, preserving tile identity.
 *
 * For each line (row for L/R, column for U/D), tiles are ordered along
 * the travel axis; equal adjacent tiles merge once per move. On a merge
 * the leading tile keeps its id, doubles its value, and is flagged
 * `isMerged`; the absorbed tile is dropped from the returned set.
 *
 * Returns the moved tiles, the score earned, and whether anything moved.
 */
function moveTiles(tiles: Tile[], direction: Direction): MoveResult {
  const useCol  = direction === 'up'    || direction === 'down'
  const reverse = direction === 'right' || direction === 'down'

  const out: Tile[] = []
  let scoreDelta = 0
  let changed    = false

  for (let lineIdx = 0; lineIdx < GRID; lineIdx++) {
    // Collect tiles on this line, ordered along the travel direction.
    const lineTiles = tiles
      .filter(t => (useCol ? t.col : t.row) === lineIdx)
      .sort((a, b) => {
        const pa = useCol ? a.row : a.col
        const pb = useCol ? b.row : b.col
        return reverse ? pb - pa : pa - pb
      })

    // Slide + merge along the line, producing target slot positions
    // measured from the leading edge (0 = closest to the edge we push
    // towards).
    let slot = 0
    let i = 0
    while (i < lineTiles.length) {
      const cur = lineTiles[i]
      const nxt = lineTiles[i + 1]

      if (nxt && nxt.value === cur.value) {
        // Merge: surviving tile keeps its id, doubles value, pops.
        const mergedValue = cur.value * 2
        const pos = reverse ? GRID - 1 - slot : slot
        out.push({
          id:       cur.id,
          value:    mergedValue,
          row:      useCol ? pos : lineIdx,
          col:      useCol ? lineIdx : pos,
          isMerged: true,
        })
        scoreDelta += mergedValue
        changed = true
        i += 2   // consume both source tiles
      } else {
        const pos = reverse ? GRID - 1 - slot : slot
        const nr = useCol ? pos : lineIdx
        const nc = useCol ? lineIdx : pos
        if (nr !== cur.row || nc !== cur.col) changed = true
        out.push({ id: cur.id, value: cur.value, row: nr, col: nc })
        i += 1
      }
      slot += 1
    }
  }

  return { tiles: out, scoreDelta, changed }
}

/**
 * Inserts a new tile into a random empty cell.
 * Value 2 at 90% probability, 4 at 10%.
 * Returns a new tile set (with the spawned tile flagged `isNew`), or the
 * same set when the board is full.
 */
function spawnTile(tiles: Tile[]): Tile[] {
  const empty = emptyCells(tiles)
  if (empty.length === 0) return tiles

  const cell = empty[Math.floor(Math.random() * empty.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  return [
    ...tiles,
    { id: nextId(), value, row: cell.y, col: cell.x, isNew: true },
  ]
}

/**
 * Returns true when the board is in a terminal state:
 * no empty cells exist AND no orthogonally adjacent cells share a value.
 */
function isGameOver(tiles: Tile[]): boolean {
  if (tiles.length < GRID * GRID) return false

  // Build a value grid for O(1) neighbour lookups.
  const grid: number[] = Array<number>(GRID * GRID).fill(0)
  for (const t of tiles) grid[t.row * GRID + t.col] = t.value

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = grid[r * GRID + c]
      if (c < GRID - 1 && v === grid[r * GRID + c + 1]) return false  // horizontal
      if (r < GRID - 1 && v === grid[(r + 1) * GRID + c]) return false  // vertical
    }
  }

  return true
}

/** Creates the initial tile set with exactly 2 randomly placed tiles. */
function createInitialTiles(): Tile[] {
  let tiles: Tile[] = []
  tiles = spawnTile(tiles)
  tiles = spawnTile(tiles)
  return tiles
}

/** Highest tile value currently on the board. */
function maxValue(tiles: Tile[]): number {
  let m = 0
  for (const t of tiles) if (t.value > m) m = t.value
  return m
}

/* ════════════════════════════════════════════════════════════════
   §5  TILE STYLE HELPERS
   Dynamic visual tokens mapped from tile value.
   Colour progression: green ramp (2–64) →
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
  const [tiles,      setTiles]      = useState<Tile[]>(() => createInitialTiles())
  const [score,      setScore]      = useState(0)
  const [bestScore,  setBestScore]  = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10)
  })
  const [phase,      setPhase]      = useState<GamePhase>('active')
  const [hasWon,     setHasWon]     = useState(false)
  const [wonAcked,   setWonAcked]   = useState(false)   // player pressed "Keep Going"

  /* ── Refs: synchronous reads for event handlers ──────────────── */
  const tilesRef        = useRef(tiles)
  const scoreRef        = useRef(score)
  const phaseRef        = useRef<GamePhase>('active')
  const hasWonRef       = useRef(false)
  const lockedRef       = useRef(false)   // input lock during slide animation
  const processMoveRef  = useRef<(dir: Direction) => void>(() => {})
  const pointerStartRef = useRef<TileCoordinates | null>(null)

  // Sync refs every render
  tilesRef.current  = tiles
  scoreRef.current  = score
  phaseRef.current  = phase
  hasWonRef.current = hasWon

  /* ── Lifecycle ───────────────────────────────────────────────── */

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
    if (lockedRef.current) return   // ignore input mid-slide

    const prev = tilesRef.current
    const { tiles: moved, scoreDelta, changed } = moveTiles(prev, dir)

    if (!changed) return

    // Phase 1 — render the slide: reuse tile ids so transforms animate.
    // Clear stale animation flags on non-merged tiles so only the freshly
    // merged tiles pop this frame.
    const slid = moved.map(t => ({ ...t, isNew: false }))
    lockedRef.current = true
    tilesRef.current  = slid
    setTiles(slid)

    const newScore = scoreRef.current + scoreDelta
    scoreRef.current = newScore
    setScore(newScore)
    setBestScore(b => Math.max(b, newScore))

    // Win detection: first time a 2048 tile appears on the board
    if (!hasWonRef.current && maxValue(slid) >= 2048) {
      hasWonRef.current = true
      setHasWon(true)
    }

    // Phase 2 — after the slide finishes, drop absorbed tiles' flags,
    // spawn a new tile, and evaluate game-over.
    window.setTimeout(() => {
      const spawned = spawnTile(
        tilesRef.current.map(t => ({ ...t, isMerged: false })),
      )
      tilesRef.current  = spawned
      lockedRef.current = false
      setTiles(spawned)

      if (isGameOver(spawned)) {
        phaseRef.current = 'gameover'
        setPhase('gameover')
        handleGameOver(scoreRef.current)
      }
    }, SLIDE_MS)
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

  /* ── Swipe via Pointer Events (works for mouse drag AND touch) ──
     Pointer events unify mouse / touch / pen and are bound to the board
     element so they don't hijack the rest of the page. */
  const onBoardPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onBoardPointerUp = useCallback((e: React.PointerEvent) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const MIN_SWIPE = 24   // px
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE) return
    if (Math.abs(dx) > Math.abs(dy)) {
      processMoveRef.current(dx > 0 ? 'right' : 'left')
    } else {
      processMoveRef.current(dy > 0 ? 'down' : 'up')
    }
  }, [])

  /* ── Reset / new game ────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    const fresh = createInitialTiles()
    tilesRef.current  = fresh
    scoreRef.current  = 0
    phaseRef.current  = 'active'
    hasWonRef.current = false
    lockedRef.current = false

    setTiles(fresh)
    setScore(0)
    setPhase('active')
    setHasWon(false)
    setWonAcked(false)
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
          PUZZLE BOARD — fixed-size relative frame
          Background cells form the static grid; tiles are absolutely
          positioned overlays translated to (col*STEP, row*STEP). Stable
          keys (tile.id) let React reuse each node so `transition:
          transform` glides tiles between cells on every move.
          ════════════════════════════════════════════════════════ */}
      <div className={styles.boardWrapper}>
        <div
          className={styles.board}
          role="grid"
          aria-label="2048 puzzle grid — use arrow keys or swipe to slide tiles"
          aria-roledescription="sliding tile game"
          onPointerDown={onBoardPointerDown}
          onPointerUp={onBoardPointerUp}
          style={{
            width:      `${BOARD_PX}px`,
            height:     `${BOARD_PX}px`,
            touchAction: 'none',
          }}
        >
          {/* Static background grid (16 empty cells) */}
          {Array.from({ length: GRID * GRID }).map((_, i) => (
            <div
              key={`bg-${i}`}
              className={styles.cellBg}
              aria-hidden="true"
              style={{
                transform: `translate3d(${(i % GRID) * STEP}px, ${Math.floor(i / GRID) * STEP}px, 0)`,
              }}
            />
          ))}

          {/* Moving tiles */}
          {tiles.map(tile => {
            const ts = getTileStyle(tile.value)
            const cls =
              `${styles.tile}` +
              (tile.isNew    ? ` ${styles.tileNew}`    : '') +
              (tile.isMerged ? ` ${styles.tileMerged}` : '')

            return (
              <div
                key={tile.id}
                className={cls}
                role="gridcell"
                aria-label={String(tile.value)}
                style={{
                  transform: `translate3d(${tile.col * STEP}px, ${tile.row * STEP}px, 0)`,
                  background: ts.background,
                  color:      ts.color,
                  border:     ts.border    ?? 'none',
                  boxShadow:  ts.boxShadow ?? 'none',
                }}
              >
                <span
                  className={styles.tileNum}
                  style={{ fontSize: ts.fontSize }}
                >
                  {tile.value}
                </span>
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
