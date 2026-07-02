'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * ZenSnake — Games Tab · Step 4.4 · Harvest Station
 *
 * Classic grid-locked snake on a 15×15 coordinate field.
 *
 * Movement matrix:
 *   • Arrow keys queue direction changes (180° reversal blocked).
 *     Up to DIR_Q_MAX (2) pending inputs are buffered so rapid
 *     corner turns feel crisp without teleporting the head.
 *   • Game state advances every TICK_MS (120ms) via a timestamp-
 *     based RAF accumulator — immune to setInterval drift and
 *     tab-hibernation desync.
 *
 * Spore pellet generation:
 *   • Single purple pellet at a random vacant grid cell.
 *   • Eating it appends one tail segment, increments score, and
 *     instantly spawns a fresh pellet at another empty cell.
 *
 * Collision matrix:
 *   • Wall boundary hit  → game over
 *   • Self-intersection  → game over (tail check excludes the
 *     vacating tail tip, which moves away on the same tick)
 *   • Game over payout:  addResources('organic_spores', score × 5)
 *
 * Rendering:
 *   • Pure canvas 360×360 (15 cells × 24 px).
 *   • RAF loop via frameRef pattern — always reads from refs.
 *   • Snake fades from bright green (head) toward dim (tail).
 *   • Dead snake turns purple for the game-over frame.
 *   • Touch swipe supported (30 px threshold — same as Core2048).
 *   • Best score persisted to localStorage (zenith_zensnake_best_v1).
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import { useZenithEconomy } from '@/hooks/useZenithEconomy'
import styles from './ZenSnake.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const GRID       = 15         // grid dimension (cells per axis)
const CELL       = 24         // px per grid cell
const CANVAS_W   = GRID * CELL  // 360
const CANVAS_H   = GRID * CELL  // 360
const TICK_MS    = 120        // game-state tick interval (ms)
const DIR_Q_MAX  = 2          // max queued direction changes

// Design token mirrors — must match app/globals.css exactly
const C_BG     = '#0b0d13'
const C_CARD   = '#141923'
const C_GREEN  = '#52cca3'
const C_PURPLE = '#7c95ff'
const C_MUTED  = '#9ba3c4'
const C_DARK   = '#5c6487'

const BEST_KEY = 'zenith_zensnake_best_v1'

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

/** (x, y) coordinate pair within the 15×15 grid (zero-indexed). */
export interface CoordinatePair {
  x: number
  y: number
}

/** Full game state snapshot — exported for external consumers. */
export interface ZenSnakeState {
  snakeBody:        CoordinatePair[]
  currentDirection: CoordinatePair
  targetPellet:     CoordinatePair
  sessionScore:     number
  isGameOver:       boolean
}

export interface ZenSnakeProps {
  onSessionComplete?: (finalScore: number) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type GamePhase = 'idle' | 'active' | 'gameover'

/* ════════════════════════════════════════════════════════════════
   §4  PURE GRID UTILITIES
   No React. No side-effects. All functions accept only plain values.
   ════════════════════════════════════════════════════════════════ */

/** True when two CoordinatePairs occupy the same grid cell. */
function sameCell(a: CoordinatePair, b: CoordinatePair): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * True when `next` is the exact opposite of `current`.
 * Prevents the snake reversing into its own neck.
 */
function isReversal(next: CoordinatePair, current: CoordinatePair): boolean {
  return next.x === -current.x && next.y === -current.y
}

/**
 * Picks a random grid cell not occupied by the snake body.
 * Uses a Set for O(1) occupied-cell lookup.
 * Falls back to (0, 0) only when the board is completely full
 * (unreachable at any normal snake length < 225).
 */
function spawnPellet(snake: CoordinatePair[]): CoordinatePair {
  const occupied = new Set(snake.map(c => `${c.x},${c.y}`))
  const empty: CoordinatePair[] = []

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(`${x},${y}`)) empty.push({ x, y })
    }
  }

  return empty.length > 0
    ? empty[Math.floor(Math.random() * empty.length)]
    : { x: 0, y: 0 }
}

/**
 * Creates the initial 3-segment snake, centred on the grid,
 * oriented horizontally and moving right.
 *
 *   [head(7,7), (6,7), (5,7)]  — facing right (+x)
 */
function createInitialSnake(): CoordinatePair[] {
  const midX = Math.floor(GRID / 2)
  const midY = Math.floor(GRID / 2)
  return [
    { x: midX,     y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ]
}

/** Converts a grid coordinate to its top-left canvas pixel position. */
const toPx = (n: number): number => n * CELL

/* ════════════════════════════════════════════════════════════════
   §5  CANVAS DRAW ENGINE
   Pure functions — ctx + snapshot data only. No hooks.
   Canvas API constraint: only hex strings and rgba() for colors.
   ctx.roundRect() is available in all browsers targeted by Next.js 15.
   ════════════════════════════════════════════════════════════════ */

/** Fills the canvas with bg-main + draws faint cell-grid lines. */
function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = C_BG
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.save()
  ctx.strokeStyle = C_DARK
  ctx.lineWidth   = 0.5
  ctx.globalAlpha = 0.18

  for (let i = 0; i <= GRID; i++) {
    // Vertical lines
    ctx.beginPath()
    ctx.moveTo(toPx(i), 0)
    ctx.lineTo(toPx(i), CANVAS_H)
    ctx.stroke()

    // Horizontal lines
    ctx.beginPath()
    ctx.moveTo(0,       toPx(i))
    ctx.lineTo(CANVAS_W, toPx(i))
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Renders the snake body.
 *
 * • Head (i=0): brightest C_GREEN, rounded 5px, white centre dot.
 * • Body: same fill, fades via globalAlpha from 0.95 (neck) → 0.38 (tail tip).
 * • Dead snake: all segments switch to C_PURPLE at reduced opacity.
 */
function drawSnake(
  ctx:    CanvasRenderingContext2D,
  snake:  CoordinatePair[],
  isOver: boolean,
): void {
  const n = snake.length

  for (let i = 0; i < n; i++) {
    const seg    = snake[i]
    const isHead = i === 0
    const t      = n > 1 ? i / (n - 1) : 0   // 0 = head, 1 = tail tip

    ctx.save()
    ctx.globalAlpha = isOver
      ? Math.max(0.30, 0.85 - t * 0.55)
      : Math.max(0.38, 0.96 - t * 0.58)

    ctx.fillStyle = isOver ? C_PURPLE : C_GREEN

    const pad    = isHead ? 1 : 3
    const radius = isHead ? 5 : 3

    ctx.beginPath()
    ctx.roundRect(
      toPx(seg.x) + pad,
      toPx(seg.y) + pad,
      CELL - pad * 2,
      CELL - pad * 2,
      radius,
    )
    ctx.fill()
    ctx.restore()

    // White centre dot on the head (alive only)
    if (isHead && !isOver) {
      ctx.save()
      ctx.fillStyle   = 'rgba(255,255,255,0.58)'
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(
        toPx(seg.x) + CELL / 2,
        toPx(seg.y) + CELL / 2,
        3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.restore()
    }
  }
}

/**
 * Renders the spore pellet: ambient glow halo + C_PURPLE core + specular.
 */
function drawPellet(ctx: CanvasRenderingContext2D, pellet: CoordinatePair): void {
  const cx = toPx(pellet.x) + CELL / 2
  const cy = toPx(pellet.y) + CELL / 2
  const r  = CELL / 2 - 4

  // Glow halo
  ctx.save()
  ctx.fillStyle   = C_PURPLE
  ctx.globalAlpha = 0.20
  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Core circle
  ctx.fillStyle = C_PURPLE
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Specular dot
  ctx.save()
  ctx.fillStyle   = 'rgba(255,255,255,0.36)'
  ctx.beginPath()
  ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Translucent idle-state instruction overlay drawn onto the canvas. */
function drawIdleOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.fillStyle = 'rgba(11,13,19,0.74)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle    = C_MUTED
  ctx.font         = '600 11px monospace'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PRESS ANY ARROW KEY TO BEGIN', CANVAS_W / 2, CANVAS_H / 2 - 12)

  ctx.fillStyle = C_DARK
  ctx.font      = '500 10px monospace'
  ctx.fillText('Eat the purple spore pellets to grow', CANVAS_W / 2, CANVAS_H / 2 + 8)
  ctx.fillText('Avoid walls and your own tail', CANVAS_W / 2, CANVAS_H / 2 + 22)
  ctx.restore()
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function ZenSnake({ onSessionComplete }: ZenSnakeProps) {
  const { addResources } = useZenithEconomy()

  /* ── React state (DOM-only: stats bar + overlay) ─────────────── */
  const [phase,     setPhase]     = useState<GamePhase>('idle')
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10)
  })

  /* ── Canvas ref ──────────────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── Hot-path refs (all game state; mutated inside RAF) ──────── */
  const phaseRef      = useRef<GamePhase>('idle')
  const snakeRef      = useRef<CoordinatePair[]>(createInitialSnake())
  const dirRef        = useRef<CoordinatePair>({ x: 1, y: 0 })    // facing right
  const dirQRef       = useRef<CoordinatePair[]>([])               // pending direction queue
  const pelletRef     = useRef<CoordinatePair>({ x: 0, y: 0 })    // set on game start
  const scoreRef      = useRef(0)
  const lastTickRef   = useRef(-1)                                 // performance.now() of last tick
  const isMountedRef  = useRef(true)
  const rafRef        = useRef(0)

  // Touch-swipe refs (same 30px threshold pattern as Core2048)
  const touchStartRef = useRef<CoordinatePair | null>(null)

  /* ── addResources ref mirror ─────────────────────────────────── */
  const addResourcesRef = useRef(addResources)
  addResourcesRef.current = addResources

  /* ── Game-tick: advance snake by one step ────────────────────── */
  // Defined as a ref-updated function so the RAF frame can call it
  // without capturing stale React state.
  const tickRef = useRef<() => void>(() => {})
  tickRef.current = () => {
    // Consume the next valid direction from the queue
    while (dirQRef.current.length > 0) {
      const candidate = dirQRef.current.shift()!
      if (!isReversal(candidate, dirRef.current)) {
        dirRef.current = candidate
        break
      }
    }

    const dir   = dirRef.current
    const snake = snakeRef.current
    const head  = snake[0]

    const nextHead: CoordinatePair = {
      x: head.x + dir.x,
      y: head.y + dir.y,
    }

    // ── Boundary collision ───────────────────────────────────────
    if (
      nextHead.x < 0 || nextHead.x >= GRID ||
      nextHead.y < 0 || nextHead.y >= GRID
    ) {
      triggerGameOver()
      return
    }

    // ── Self-collision ───────────────────────────────────────────
    // Exclude the tail tip (snake.length - 1) because it vacates
    // its current cell on this same tick — the head can safely
    // move into that position when the snake is exactly 1 segment
    // behind the tail (straight-line self-overlap edge case).
    for (let i = 0; i < snake.length - 1; i++) {
      if (sameCell(nextHead, snake[i])) {
        triggerGameOver()
        return
      }
    }

    // ── Pellet consumption ───────────────────────────────────────
    const ate = sameCell(nextHead, pelletRef.current)

    if (ate) {
      // Grow: prepend next head, keep full body
      const nextSnake = [nextHead, ...snake]
      snakeRef.current  = nextSnake
      scoreRef.current += 1
      setScore(scoreRef.current)
      pelletRef.current = spawnPellet(nextSnake)
    } else {
      // Move: prepend next head, drop tail tip
      snakeRef.current = [nextHead, ...snake.slice(0, -1)]
    }
  }

  /* ── Game-over: halt loop, commit payout ────────────────────── */
  function triggerGameOver() {
    if (!isMountedRef.current) return
    phaseRef.current = 'gameover'
    setPhase('gameover')

    const final = scoreRef.current
    setBestScore(b => {
      const next = Math.max(b, final)
      localStorage.setItem(BEST_KEY, String(next))
      return next
    })

    const payout = final * 5
    if (payout > 0) void addResourcesRef.current('cosmic_dust', payout).catch(() => {})
    onSessionComplete?.(final)
    // Do NOT request next frame — loop halts here
  }

  /* ── RAF frame function (updated every render) ───────────────── */
  const frameRef = useRef<(ts: number) => void>((_ts) => {})
  frameRef.current = (ts: number) => {
    if (!isMountedRef.current) return

    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const phase = phaseRef.current

    // ── Tick gate (120ms accumulator) ───────────────────────────
    if (phase === 'active') {
      if (lastTickRef.current < 0) lastTickRef.current = ts

      const elapsed = ts - lastTickRef.current
      if (elapsed >= TICK_MS) {
        // Carry remainder to prevent drift accumulation
        lastTickRef.current = ts - (elapsed % TICK_MS)
        tickRef.current!()

        // triggerGameOver may have set phase to gameover — re-read
        if (phaseRef.current === 'gameover') {
          // Draw final dead-snake frame, then stop
          drawGrid(ctx)
          drawPellet(ctx, pelletRef.current)
          drawSnake(ctx, snakeRef.current, true)
          return
        }
      }
    } else {
      lastTickRef.current = -1
    }

    // ── Draw ────────────────────────────────────────────────────
    drawGrid(ctx)

    if (phase !== 'idle') {
      drawPellet(ctx, pelletRef.current)
      drawSnake(ctx, snakeRef.current, phase === 'gameover')
    }

    if (phase === 'idle') {
      drawIdleOverlay(ctx)
    }

    rafRef.current = requestAnimationFrame((t) => frameRef.current!(t))
  }

  /* ── Mount / unmount ─────────────────────────────────────────── */
  useEffect(() => {
    isMountedRef.current = true
    rafRef.current = requestAnimationFrame((t) => frameRef.current!(t))
    return () => {
      isMountedRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])   // empty deps — frame function reads all state from refs

  /* ── Keyboard handler (stable, registered once) ──────────────── */
  useEffect(() => {
    const DIR_MAP: Record<string, CoordinatePair> = {
      ArrowUp:    { x:  0, y: -1 },
      ArrowDown:  { x:  0, y:  1 },
      ArrowLeft:  { x: -1, y:  0 },
      ArrowRight: { x:  1, y:  0 },
    }

    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const dir = DIR_MAP[e.key]
      if (!dir) return
      e.preventDefault()

      if (phaseRef.current === 'idle') {
        // Start: apply direction only if not a reversal of the initial right-facing direction
        const initial: CoordinatePair = { x: 1, y: 0 }
        if (!isReversal(dir, initial)) dirRef.current = dir
        phaseRef.current    = 'active'
        lastTickRef.current = -1
        pelletRef.current   = spawnPellet(snakeRef.current)
        setPhase('active')
        return
      }

      if (phaseRef.current !== 'active') return

      // Queue direction change (cap to prevent input flooding)
      if (dirQRef.current.length < DIR_Q_MAX) {
        dirQRef.current.push(dir)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── Touch swipe handler (stable, registered once) ───────────── */
  useEffect(() => {
    const MIN_SWIPE = 30   // minimum swipe distance in px

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      touchStartRef.current = null

      const dirMap = {
        right: { x:  1, y:  0 },
        left:  { x: -1, y:  0 },
        down:  { x:  0, y:  1 },
        up:    { x:  0, y: -1 },
      }

      let swipeDir: CoordinatePair | null = null
      if (Math.abs(dx) > Math.abs(dy)) {
        if      (dx >  MIN_SWIPE) swipeDir = dirMap.right
        else if (dx < -MIN_SWIPE) swipeDir = dirMap.left
      } else {
        if      (dy >  MIN_SWIPE) swipeDir = dirMap.down
        else if (dy < -MIN_SWIPE) swipeDir = dirMap.up
      }

      if (!swipeDir) return

      if (phaseRef.current === 'idle') {
        const initial: CoordinatePair = { x: 1, y: 0 }
        if (!isReversal(swipeDir, initial)) dirRef.current = swipeDir
        phaseRef.current    = 'active'
        lastTickRef.current = -1
        pelletRef.current   = spawnPellet(snakeRef.current)
        setPhase('active')
        return
      }

      if (phaseRef.current === 'active' && dirQRef.current.length < DIR_Q_MAX) {
        dirQRef.current.push(swipeDir)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [])

  /* ── Reset ───────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)

    phaseRef.current    = 'idle'
    scoreRef.current    = 0
    lastTickRef.current = -1
    snakeRef.current    = createInitialSnake()
    dirRef.current      = { x: 1, y: 0 }
    dirQRef.current     = []
    pelletRef.current   = { x: 0, y: 0 }

    setPhase('idle')
    setScore(0)

    rafRef.current = requestAnimationFrame((t) => frameRef.current!(t))
  }, [])

  /* ── Render ──────────────────────────────────────────────────── */
  const snakeLength = score + 3   // initial length 3 + pellets eaten

  return (
    <div className={styles.root} data-phase={phase}>

      {/* ════════════════════════════════════════════════════════
          STATS BAR — score | best | length | spore preview
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsBar} aria-label="Game statistics">

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SCORE</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {score}
          </span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>BEST</span>
          <span className={styles.statValue}>{bestScore}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>LENGTH</span>
          <span className={styles.statValue}>{snakeLength}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SPORES</span>
          <span className={`${styles.statValue} ${styles.statPurple}`}>
            +{score * 5}
          </span>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════
          CANVAS GRID
          ════════════════════════════════════════════════════════ */}
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={styles.canvas}
          aria-label="ZenSnake game grid — navigate with arrow keys or swipe"
          role="img"
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'idle'     && 'Press any arrow key or swipe to begin navigating.'}
        {phase === 'active'   && `Collecting cosmic dust — length: ${snakeLength}`}
        {phase === 'gameover' && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          GAME-OVER OVERLAY
          ════════════════════════════════════════════════════════ */}
      {phase === 'gameover' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Collision detected — snake game over"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>Collision</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Pellets Harvested</span>
                <span className={styles.resultVal}>{score}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Final Length</span>
                <span className={styles.resultVal}>{snakeLength}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Best Score</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  {bestScore}
                </span>
              </div>
              <div className={styles.resultDivider} aria-hidden="true" />
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Organic Spores</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>
                  +{score * 5}
                </span>
              </div>
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new navigation session"
            >
              Navigate Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
