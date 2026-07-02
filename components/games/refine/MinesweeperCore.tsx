'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * MinesweeperCore — Steps 3.1 · 3.2 · 3.3
 * Mine Refiner — Active Refining Game
 *
 * Step 3.1 — Grid matrix, mine placement (Fisher-Yates safe-zone),
 *            BFS flood-reveal, win/loss detection.
 *
 * Step 3.2 — Flag Node State Interceptor: context-menu hijack,
 *            hard flag-capacity gate, isRefineLocked, efficiencyPenalty.
 *
 * Step 3.3 — Row-Clear Asset Upgrades / Score Evaluator:
 *   • High-resolution session clock (performance.now() epoch)
 *   • Collect-gate flow: game ends → RefineOverlay → user clicks
 *     "Collect" → onGameComplete fires → wrapper processes economy
 *   • RefineScoreEvaluator computes correctFlags, refinedYield,
 *     efficiencyPermille via strict integer arithmetic
 *   • Live overflow estimate from useZenithEconomy (read-only)
 *   • Overlay shows: Mines Refined · Efficiency · Yield · Est. Overflow
 *   • isCollecting guard prevents double-submission
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useZenithEconomy }      from '@/hooks/useZenithEconomy'
import {
  computeRefineOutcome,
  computeRefineSummary,
  fmtEfficiency,
  fmtElapsed,
  type RefineSessionOutcome,
  type RefineScoreSummary,
} from '@/lib/engines/RefineScoreEvaluator'
import type { GameSessionResult } from '@/components/games/UniversalGameWrapper'
import styles from './MinesweeperCore.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const ROWS          = 10
const COLS          = 10
const DEFAULT_MINES = 15

/* ── Difficulty levels ─────────────────────────────────────────────
   More mines on the same 10×10 board = more squares to sweep = harder. */
type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert'
const DIFFICULTIES: { id: DifficultyId; label: string; mines: number }[] = [
  { id: 'easy',   label: 'Easy',   mines: 10 },
  { id: 'medium', label: 'Medium', mines: 15 },
  { id: 'hard',   label: 'Hard',   mines: 28 },
  { id: 'expert', label: 'Expert', mines: 40 },
]
const DIFFICULTY_KEY = 'zenith_minesweeper_difficulty_v1'

function readStoredDifficulty(): DifficultyId {
  if (typeof window === 'undefined') return 'medium'
  const raw = localStorage.getItem(DIFFICULTY_KEY)
  return DIFFICULTIES.some(d => d.id === raw) ? (raw as DifficultyId) : 'medium'
}

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export interface MinesweeperCell {
  x: number
  y: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  /**
   * Step 3.2 — Refine Anchor.
   * true when this cell is flagged AND is a real mine.
   * Used by RefineScoreEvaluator to count correct anchors.
   */
  isRefineLocked: boolean
  /** Count of immediately adjacent mines (0–8). Always 0 on mine cells. */
  neighborMines: number
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

/** Phase machine: waiting → active → won | lost */
type GamePhase = 'waiting' | 'active' | 'won' | 'lost'

/** Bundled result computed when the game ends — drives the overlay. */
interface RefineResult {
  outcome: RefineSessionOutcome
  summary: RefineScoreSummary
}

interface MinesweeperCoreProps {
  /**
   * Injected by UniversalGameWrapper via React.cloneElement.
   * Optional at the type level; always provided at runtime.
   */
  onGameComplete?: (result: GameSessionResult) => void
  /** Mines to seed. Defaults to 15. */
  mineCount?: number
}

/* ════════════════════════════════════════════════════════════════
   §4  PURE MATH HELPERS  (Step 3.1)
   ════════════════════════════════════════════════════════════════ */

function getNeighbourCoords(x: number, y: number): [number, number][] {
  const result: [number, number][] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) result.push([nx, ny])
    }
  }
  return result
}

function createBlankGrid(): MinesweeperCell[][] {
  return Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => ({
      x, y,
      isMine:         false,
      isRevealed:     false,
      isFlagged:      false,
      isRefineLocked: false,
      neighborMines:  0,
    }))
  )
}

/**
 * Partial Fisher-Yates mine placement with 9-cell safe zone.
 * O(eligible) — typically O(91).
 */
function placeMines(
  grid: MinesweeperCell[][],
  mineCount: number,
  safeX: number,
  safeY: number,
): MinesweeperCell[][] {
  const excluded = new Set<string>()
  excluded.add(`${safeX},${safeY}`)
  for (const [nx, ny] of getNeighbourCoords(safeX, safeY)) excluded.add(`${nx},${ny}`)

  const eligible: [number, number][] = []
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!excluded.has(`${x},${y}`)) eligible.push([x, y])

  const n     = eligible.length
  const count = Math.min(mineCount, n)
  for (let i = n - 1; i >= n - count; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }

  const next = grid.map(row => row.map(cell => ({ ...cell })))
  for (let i = n - count; i < n; i++) {
    const [mx, my] = eligible[i]
    next[my][mx].isMine = true
  }
  return next
}

function computeNeighbourCounts(grid: MinesweeperCell[][]): MinesweeperCell[][] {
  return grid.map(row =>
    row.map(cell => {
      if (cell.isMine) return { ...cell, neighborMines: 0 }
      const count = getNeighbourCoords(cell.x, cell.y)
        .filter(([nx, ny]) => grid[ny][nx].isMine).length
      return { ...cell, neighborMines: count }
    }),
  )
}

/**
 * BFS flood-reveal. Propagates through zero-neighbour cells;
 * numbered border cells are revealed but do not propagate further.
 */
function floodReveal(
  grid: MinesweeperCell[][],
  startX: number,
  startY: number,
): MinesweeperCell[][] {
  const next    = grid.map(row => row.map(cell => ({ ...cell })))
  const queue: [number, number][] = [[startX, startY]]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const [x, y] = queue.shift()!
    const key    = `${x},${y}`
    if (visited.has(key)) continue
    visited.add(key)
    const cell = next[y][x]
    if (cell.isMine || cell.isFlagged || cell.isRevealed) continue
    cell.isRevealed = true
    if (cell.neighborMines === 0)
      for (const [nx, ny] of getNeighbourCoords(x, y)) {
        const nk = `${nx},${ny}`
        if (!visited.has(nk) && !next[ny][nx].isRevealed && !next[ny][nx].isFlagged)
          queue.push([nx, ny])
      }
  }
  return next
}

/** Reveal all mines — called on detonation to expose the minefield. */
function revealAllMines(grid: MinesweeperCell[][]): MinesweeperCell[][] {
  return grid.map(row =>
    row.map(cell => (cell.isMine ? { ...cell, isRevealed: true } : { ...cell })),
  )
}

/**
 * Flag all un-flagged mines — visual completion on victory.
 * Sets isRefineLocked: true on auto-flags (they are confirmed mines).
 */
function flagRemainingMines(grid: MinesweeperCell[][]): MinesweeperCell[][] {
  return grid.map(row =>
    row.map(cell =>
      cell.isMine && !cell.isFlagged
        ? { ...cell, isFlagged: true, isRefineLocked: true }
        : { ...cell },
    ),
  )
}

function checkWin(grid: MinesweeperCell[][], mineCount: number): boolean {
  let revealed = 0
  for (const row of grid)
    for (const cell of row)
      if (cell.isRevealed && !cell.isMine) revealed++
  return revealed === ROWS * COLS - mineCount
}

function countRevealedSafe(grid: MinesweeperCell[][]): number {
  let n = 0
  for (const row of grid)
    for (const cell of row)
      if (cell.isRevealed && !cell.isMine) n++
  return n
}

/* ════════════════════════════════════════════════════════════════
   §5  UI HELPERS
   ════════════════════════════════════════════════════════════════ */

/* Distinct, high-contrast colour per adjacency count so 1/2/3… never blur
   together (classic Minesweeper palette, tuned for the dark surface). */
function getNumberColour(n: number): string {
  switch (n) {
    case 1:  return '#5b9dff'   // blue
    case 2:  return '#52cca3'   // green
    case 3:  return '#f87171'   // red
    case 4:  return '#c084fc'   // violet
    case 5:  return '#f59e0b'   // amber
    case 6:  return '#22d3ee'   // cyan
    case 7:  return '#f472b6'   // pink
    case 8:  return '#e8eaf6'   // white
    default: return 'var(--text-primary)'
  }
}

function getCellAriaLabel(cell: MinesweeperCell, phase: GamePhase): string {
  const pos = `${cell.x + 1},${cell.y + 1}`
  if (!cell.isRevealed && cell.isFlagged)  return `Cell ${pos}: refine anchor flagged`
  if (!cell.isRevealed)                    return `Cell ${pos}: hidden`
  if (cell.isMine && phase === 'lost')     return `Cell ${pos}: mine`
  if (cell.neighborMines > 0)             return `Cell ${pos}: ${cell.neighborMines} adjacent mines`
  return `Cell ${pos}: clear`
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function MinesweeperCore({
  onGameComplete,
  mineCount: mineCountProp = DEFAULT_MINES,
}: MinesweeperCoreProps) {

  /* ── Economy (read-only) — for overflow pre-estimate ────────── */
  const { resources } = useZenithEconomy()

  /* ── State ───────────────────────────────────────────────────── */
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(() => readStoredDifficulty())
  const [grid,     setGrid]     = useState<MinesweeperCell[][]>(() => createBlankGrid())
  const [phase,    setPhase]    = useState<GamePhase>('waiting')
  /** Coordinates of the mine the player clicked — rose highlight. */
  const [exploded, setExploded] = useState<[number, number] | null>(null)

  /**
   * Step 3.3 — Collect-gate result.
   * Populated when the game ends; drives the refine overlay.
   * Cleared implicitly when the wrapper unmounts this component
   * (phase 'playing' → 'result' transition).
   */
  const [refineResult,  setRefineResult]  = useState<RefineResult | null>(null)
  /**
   * Guards against double-submission on rapid "Collect" clicks.
   * The component unmounts after the first successful call so this
   * never needs resetting — it's a one-way latch.
   */
  const [isCollecting, setIsCollecting] = useState(false)

  /* ── Refs ────────────────────────────────────────────────────── */

  /**
   * Stable ref for onGameComplete — prevents stale prop closure.
   * Step 3.3: no longer called directly from event handlers; instead
   * called via handleCollectYield after the overlay is shown.
   */
  const onCompleteRef = useRef(onGameComplete)
  useEffect(() => { onCompleteRef.current = onGameComplete }, [onGameComplete])

  /**
   * Step 3.3 — High-resolution session clock.
   * Set to performance.now() when the first click transitions the
   * board from 'waiting' to 'active'. Used to compute elapsedSeconds
   * at game-over for the RefineSessionOutcome.
   * Ref (not state) — updates do not trigger re-renders.
   */
  const sessionStartRef = useRef<number | null>(null)

  /* ── Cleanup on unmount ──────────────────────────────────────── */
  useEffect(() => {
    return () => {
      // Clear the session epoch reference to allow GC — no intervals
      // or timers run in this component so no clearInterval needed.
      sessionStartRef.current = null
    }
  }, [])

  /* ── Derived values ──────────────────────────────────────────── */

  const flagCount = useMemo(
    () => grid.flat().filter(c => c.isFlagged).length,
    [grid],
  )

  /** Step 3.2 — count of wrong anchors on the board right now. */
  const efficiencyPenalty = useMemo(
    () => grid.flat().filter(c => c.isFlagged && !c.isRefineLocked).length,
    [grid],
  )

  /* Effective mine count is driven by the selected difficulty (falls back to
     the prop for any external caller that passes an explicit count). */
  const mineCount = DIFFICULTIES.find(d => d.id === difficultyId)?.mines ?? mineCountProp

  /** Switch difficulty and reset the board to a fresh waiting state. */
  const changeDifficulty = useCallback((id: DifficultyId) => {
    setDifficultyId(id)
    if (typeof window !== 'undefined') localStorage.setItem(DIFFICULTY_KEY, id)
    setGrid(createBlankGrid())
    setPhase('waiting')
    setExploded(null)
    setRefineResult(null)
    sessionStartRef.current = null
  }, [])

  const minesRemaining = mineCount - flagCount
  const canPlaceFlag   = phase === 'active' && flagCount < mineCount

  /* ── Step 3.3: live overflow estimate ────────────────────────────
     Read the current raw_data_shards balance from the economy hook
     (read-only — no writes here) to pre-compute the likely storage
     overflow before the player clicks "Collect Yield". This lets the
     overlay display an accurate estimate without waiting for the async
     addResources() write in the wrapper.                             */
  const rawShardsNode  = resources['raw_data_shards']
  const currentBalance = rawShardsNode?.balance    ?? 0
  const maxCapacity    = rawShardsNode?.maxCapacity ?? null  // null = infinite

  function estimateOverflow(refinedYield: number): number {
    if (maxCapacity === null) return 0
    return Math.max(0, currentBalance + refinedYield - maxCapacity)
  }

  /* ── Step 3.3 helpers ────────────────────────────────────────────
     Compute the elapsed session time at the moment the game ends.
     Returns whole seconds — sub-second precision is discarded.        */
  function computeElapsedSeconds(): number {
    if (sessionStartRef.current === null) return 0
    return Math.max(0, Math.floor((performance.now() - sessionStartRef.current) / 1000))
  }

  /**
   * Builds a RefineResult from the current grid state.
   * Called BEFORE auto-flagging on win (so correctFlags only reflects
   * player-placed anchors — but victory scoring overrides this to
   * totalMines inside computeRefineOutcome anyway).
   */
  function buildRefineResult(
    cells: MinesweeperCell[],
    terminationStatus: 'victory' | 'detonated',
  ): RefineResult {
    const outcome = computeRefineOutcome(
      cells,
      mineCount,
      computeElapsedSeconds(),
      terminationStatus,
    )
    const summary = computeRefineSummary(outcome)
    return { outcome, summary }
  }

  /* ── Primary click handler ───────────────────────────────────── */
  function handleCellClick(x: number, y: number): void {
    // Board is locked once the game has ended (refineResult is set)
    // or once the player is reviewing results.
    if (phase === 'won' || phase === 'lost') return
    if (refineResult !== null) return

    const cell = grid[y][x]
    if (cell.isRevealed || cell.isFlagged) return

    /* ── First click: deferred mine placement → active phase ─────── */
    if (phase === 'waiting') {
      let next = placeMines(grid, mineCount, x, y)
      next     = computeNeighbourCounts(next)
      next     = floodReveal(next, x, y)

      // Step 3.3 — stamp session start epoch the moment play begins
      sessionStartRef.current = performance.now()

      if (checkWin(next, mineCount)) {
        // Edge case: first click opens the entire board
        const result = buildRefineResult(next.flat(), 'victory')
        const final  = flagRemainingMines(next)
        setGrid(final)
        setPhase('won')
        setRefineResult(result)
      } else {
        setGrid(next)
        setPhase('active')
      }
      return
    }

    /* ── Mine hit → detonation ──────────────────────────────────── */
    if (cell.isMine) {
      // Compute outcome BEFORE revealing mines (isRefineLocked intact)
      const result     = buildRefineResult(grid.flat(), 'detonated')
      const finalGrid  = revealAllMines(grid)
      setGrid(finalGrid)
      setPhase('lost')
      setExploded([x, y])
      setRefineResult(result)
      return
    }

    /* ── Safe cell → BFS reveal → check win ─────────────────────── */
    const next = floodReveal(grid, x, y)

    if (checkWin(next, mineCount)) {
      // Count player flags BEFORE auto-flagging so the engine sees
      // only intentional anchors (auto-flags would inflate the count)
      const result = buildRefineResult(next.flat(), 'victory')
      const final  = flagRemainingMines(next)
      setGrid(final)
      setPhase('won')
      setRefineResult(result)
    } else {
      setGrid(next)
    }
  }

  /* ── Step 3.2 — Flag Node State Interceptor ──────────────────────
     Context-menu hijack + capacity gate + isRefineLocked evaluation.
     Typed as React.MouseEvent<HTMLButtonElement> — exact synthetic
     event type for the button element emitting the right-click.       */
  function handleRightClick(
    e: React.MouseEvent<HTMLButtonElement>,
    x: number,
    y: number,
  ): void {
    e.preventDefault()            // swallow the browser's context menu
    e.stopPropagation()           // and stop it reaching the app's custom
                                  // right-click menu (document-level listener)
    if (phase !== 'active') return
    if (refineResult !== null) return

    const cell = grid[y][x]
    if (cell.isRevealed) return   // revealed cells cannot be flagged

    if (cell.isFlagged) {
      // Removing: always permitted
      setGrid(prev =>
        prev.map(row =>
          row.map(c =>
            c.x === x && c.y === y
              ? { ...c, isFlagged: false, isRefineLocked: false }
              : c,
          ),
        ),
      )
    } else {
      // Placing: cap enforced inside the functional updater so rapid
      // right-clicks cannot race past the flag limit
      setGrid(prev => {
        const latest = prev[y][x]
        if (latest.isRevealed || latest.isFlagged) return prev
        const activeFlagCount = prev.flat().filter(c => c.isFlagged).length
        if (activeFlagCount >= mineCount) return prev
        return prev.map(row =>
          row.map(c =>
            c.x === x && c.y === y
              ? { ...c, isFlagged: true, isRefineLocked: c.isMine }
              : c,
          ),
        )
      })
    }
  }

  /* ── Step 3.3 — Collect Yield ────────────────────────────────────
     Called when the player clicks "Collect" in the refine overlay.
     Fires onGameComplete with the computed refinedYield as the score
     (payoutFormula in the wrapper is identity → 1:1 resource credit).
     isCollecting guard prevents duplicate calls on rapid clicks.       */
  function handleCollectYield(): void {
    if (!refineResult || isCollecting) return
    setIsCollecting(true)

    const { outcome, summary } = refineResult

    // Populate the storage fields now that we know the live balance
    const estOverflow = estimateOverflow(summary.refinedYield)
    const finalSummary: RefineScoreSummary = {
      ...summary,
      isStorageCapped:   estOverflow > 0,
      discardedOverflow: estOverflow,
    }

    onCompleteRef.current?.({
      score:  summary.refinedYield,
      status: 'completed',
      metadata: {
        refineOutcome: outcome,
        refineSummary: finalSummary,
      },
    })
  }

  /* ── Display values ──────────────────────────────────────────── */
  const phaseLabel =
    phase === 'waiting' ? 'ARMED'
    : phase === 'active' ? 'ACTIVE'
    : phase === 'won'    ? 'CLEARED'
    : 'DETONATED'

  const phaseTagClass = [
    styles.phaseTag,
    phase === 'won'  && styles.phaseTagWon,
    phase === 'lost' && styles.phaseTagLost,
  ].filter(Boolean).join(' ')

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.gameRoot} data-ctx-suppress="true">

      {/* ── Difficulty selector (before the first click) ──────── */}
      {phase === 'waiting' && (
        <div className={styles.difficultyBar} role="group" aria-label="Difficulty">
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              type="button"
              className={`${styles.difficultyBtn} ${difficultyId === d.id ? styles.difficultyBtnActive : ''}`}
              aria-pressed={difficultyId === d.id}
              onClick={() => changeDifficulty(d.id)}
            >
              {d.label}
              <span className={styles.difficultyMines}>{d.mines}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className={styles.statusBar} role="status" aria-label="Game status">

        <div className={styles.stat}>
          <span className={styles.statGlyph} aria-hidden="true">◉</span>
          <span className={styles.statValue} aria-label={`${minesRemaining} mines remaining`}>
            {minesRemaining}
          </span>
          <span className={styles.statLabel}>mines</span>
        </div>

        <span className={phaseTagClass} aria-live="polite">{phaseLabel}</span>

        <div className={styles.stat}>
          <span className={styles.statGlyph} aria-hidden="true">◈</span>
          <span
            className={[
              styles.statValue,
              minesRemaining === 0 ? styles.statValueCapReached : '',
            ].join(' ')}
            aria-label={`${flagCount} flags placed`}
          >
            {flagCount}
          </span>
          <span className={styles.statLabel}>flags</span>
        </div>

      </div>

      {/* ── Game board ────────────────────────────────────────── */}
      <div className={styles.boardContainer}>
        <div
          className={styles.board}
          role="grid"
          aria-label={`Mine Refiner ${COLS}×${ROWS} grid`}
          aria-rowcount={ROWS}
          aria-colcount={COLS}
        >
          {grid.map(row =>
            row.map(cell => {
              const isExploded =
                exploded !== null &&
                exploded[0] === cell.x &&
                exploded[1] === cell.y

              const isFlagEligible =
                canPlaceFlag && !cell.isRevealed && !cell.isFlagged

              const cellClass = [
                styles.cell,
                cell.isRevealed
                  ? cell.isMine
                    ? isExploded
                      ? `${styles.cellMine} ${styles.cellExploded}`
                      : styles.cellMine
                    : styles.cellRevealed
                  : cell.isFlagged
                    ? `${styles.cellHidden} ${styles.cellFlagged}`
                    : isFlagEligible
                      ? `${styles.cellHidden} ${styles.cellFlagEligible}`
                      : styles.cellHidden,
              ].join(' ')

              let content: React.ReactNode = null
              if (!cell.isRevealed && cell.isFlagged) {
                content = (
                  <span style={{ color: 'var(--accent-purple)' }} aria-hidden="true">🚩</span>
                )
              } else if (cell.isRevealed && cell.isMine) {
                content = (
                  <span
                    style={{ color: isExploded ? '#f87171' : 'var(--accent-purple)' }}
                    aria-hidden="true"
                  >
                    ◉
                  </span>
                )
              } else if (cell.isRevealed && cell.neighborMines > 0) {
                content = (
                  <span style={{ color: getNumberColour(cell.neighborMines) }}>
                    {cell.neighborMines}
                  </span>
                )
              }

              const isDisabled =
                cell.isRevealed    ||
                phase === 'won'    ||
                phase === 'lost'   ||
                refineResult !== null

              return (
                <button
                  key={`${cell.x}-${cell.y}`}
                  className={cellClass}
                  onClick={() => handleCellClick(cell.x, cell.y)}
                  onContextMenu={(e: React.MouseEvent<HTMLButtonElement>) =>
                    handleRightClick(e, cell.x, cell.y)
                  }
                  disabled={isDisabled}
                  role="gridcell"
                  aria-label={getCellAriaLabel(cell, phase)}
                  aria-pressed={cell.isFlagged && !cell.isRevealed ? true : undefined}
                  aria-rowindex={cell.y + 1}
                  aria-colindex={cell.x + 1}
                >
                  {content}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Hint / efficiency feedback ─────────────────────────── */}
      <p className={styles.hintLine} aria-live="polite">
        {phase === 'waiting' && 'Click any cell to begin — first move is always safe.'}
        {phase === 'active' && efficiencyPenalty === 0 && 'Right-click to anchor a Refine target.'}
        {phase === 'active' && efficiencyPenalty > 0 &&
          `⊘ ${efficiencyPenalty} misplaced anchor${efficiencyPenalty > 1 ? 's' : ''} · −${efficiencyPenalty * 2} yield`
        }
      </p>

      {/* ══════════════════════════════════════════════════════════
          Step 3.3 — REFINE RESULT OVERLAY
          Shown when the game ends (win or loss), before the player
          collects their yield and the wrapper's economy overlay fires.
          ════════════════════════════════════════════════════════ */}
      {refineResult !== null && (() => {
        const { outcome, summary } = refineResult
        const isVictory  = outcome.terminationStatus === 'victory'
        const estOverflow = estimateOverflow(summary.refinedYield)

        return (
          <div
            className={styles.refineOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="Refine session results"
          >
            <div className={styles.refineCard}>

              {/* ── Header ──────────────────────────────────── */}
              <h3
                className={[
                  styles.refineHeader,
                  isVictory ? styles.refineHeaderWon : styles.refineHeaderLost,
                ].join(' ')}
              >
                {isVictory ? 'Board Cleared' : 'Detonated'}
              </h3>

              {/* ── Data matrix ─────────────────────────────── */}
              <div className={styles.refineStats}>

                {/* Mines Refined */}
                <div className={styles.refineRow}>
                  <span className={styles.refineLabel}>Mines Refined</span>
                  <span className={[
                    styles.refineValue,
                    isVictory ? styles.refineValueGreen : styles.refineValuePurple,
                  ].join(' ')}>
                    {outcome.correctFlags} / {outcome.totalMines}
                  </span>
                </div>

                {/* Efficiency Multiplier */}
                <div className={styles.refineRow}>
                  <span className={styles.refineLabel}>Efficiency</span>
                  <span className={styles.refineValue}>
                    {fmtEfficiency(summary.efficiencyPermille)}
                  </span>
                </div>

                {/* Penalty breakdown — only show when anchors were misplaced */}
                {outcome.incorrectFlags > 0 && (
                  <div className={styles.refineRow}>
                    <span className={styles.refineLabel}>Anchor Penalty</span>
                    <span className={`${styles.refineValue} ${styles.refineValuePurple}`}>
                      −{outcome.incorrectFlags * 2} units
                    </span>
                  </div>
                )}

                <div className={styles.refineDivider} aria-hidden="true" />

                {/* Refined Assets Formed */}
                <div className={styles.refineRow}>
                  <span className={styles.refineLabel}>Refined Assets</span>
                  <span className={`${styles.refineValue} ${styles.refineValueGreen}`}>
                    +{summary.refinedYield} shards
                  </span>
                </div>

                {/* Overflow Dropped due to Capacity limits */}
                {estOverflow > 0 && (
                  <div className={styles.refineRow}>
                    <span className={styles.refineLabel}>Overflow Lost</span>
                    <span className={`${styles.refineValue} ${styles.refineValuePurple}`}>
                      ~{estOverflow} discarded
                    </span>
                  </div>
                )}

                {/* Duration */}
                <div className={styles.refineRow}>
                  <span className={styles.refineLabel}>Duration</span>
                  <span className={styles.refineValue}>
                    {fmtElapsed(outcome.elapsedSeconds)}
                  </span>
                </div>

              </div>

              {/* Storage advisory when cap is imminent */}
              {estOverflow > 0 && (
                <p className={styles.refineCapNotice}>
                  Inventory ceiling reached — upgrade storage or spend
                  existing shards in the Crucible to avoid future waste.
                </p>
              )}

              {/* Collect / Dismiss */}
              <button
                className={[
                  styles.collectBtn,
                  isVictory ? styles.collectBtnWon : styles.collectBtnLost,
                ].join(' ')}
                onClick={handleCollectYield}
                disabled={isCollecting}
                aria-label={
                  summary.refinedYield > 0
                    ? `Collect ${summary.refinedYield} refined shards`
                    : 'Dismiss results'
                }
              >
                {isCollecting
                  ? 'Processing…'
                  : summary.refinedYield > 0
                    ? `Collect ${summary.refinedYield} Shards`
                    : 'Dismiss'}
              </button>

            </div>
          </div>
        )
      })()}

    </div>
  )
}
