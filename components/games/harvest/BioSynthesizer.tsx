'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * BioSynthesizer — Games Tab · Harvest Station
 * (Displayed as "Ball Catcher".)
 *
 * Endless ball-catcher arcade game on a responsive canvas.
 *
 * Mechanics:
 *   • A collector bin sits at the bottom of the arena. The player
 *     moves it via mouse / touch / pen drag (Pointer Events) or the
 *     ArrowLeft / ArrowRight keys. The bin follows the pointer x,
 *     clamped to the arena bounds.
 *   • Coloured balls ("spores") fall from the top at random x.
 *     A single TARGET colour is shown in the HUD.
 *   • Catching a GOOD (target-colour) ball → +score, green flash.
 *   • The game ENDS when the player either:
 *       (a) MISSES a good ball (it falls past the bin), or
 *       (b) CATCHES a BAD (wrong-colour) ball.
 *     Bad balls should be allowed to fall past harmlessly.
 *   • Difficulty ramps: fall speed and spawn rate increase slowly
 *     with elapsed time. Smooth and fair early on.
 *
 * Endless — no fixed timer; runs until failure.
 * Payout:  addResources('organic_spores', Math.floor(finalScore / 2))
 *
 * Rendering:
 *   • Canvas is responsive: sized to its container via ResizeObserver,
 *     capped at MAX_CANVAS_W, with a 3:4 aspect ratio. devicePixelRatio
 *     scaling keeps rendering crisp. Gameplay coordinates are expressed
 *     in a fixed logical space (LOGICAL_W × LOGICAL_H) and scaled to the
 *     backing store, so physics is resolution-independent.
 *   • RAF loop via frameRef pattern — no stale closures.
 *   • All canvas draws use hex literals + ctx.globalAlpha (Canvas 2D
 *     does not support CSS colour functions).
 *   • Best score persisted to localStorage (zenith_biosynth_best_v1).
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import { useZenithEconomy } from '@/hooks/useZenithEconomy'
import styles from './BioSynthesizer.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

// Logical gameplay space (physics coordinates). The canvas backing
// store scales to fit its container; gameplay always runs in this space.
const LOGICAL_W   = 480
const LOGICAL_H   = 640          // 3:4 aspect ratio
const MAX_CANVAS_W = 640         // cap CSS width so it never over-inflates

const BALL_R      = 16           // ball radius (logical px)
const BIN_W       = 104          // collector bin width (logical px)
const BIN_H       = 26           // collector bin height (logical px)
const BIN_Y       = LOGICAL_H - 54   // bin top-edge Y (logical px)
const KEY_STEP    = 46           // px per ArrowLeft / ArrowRight press

// Difficulty ramp — base values grow slowly with elapsed seconds.
const BASE_FALL_SPEED = 150      // logical px/s at t=0
const FALL_SPEED_RAMP = 11       // + px/s per elapsed second
const MAX_FALL_SPEED  = 560

const BASE_SPAWN_MS   = 1150     // ms between spawns at t=0
const SPAWN_RAMP_MS   = 11       // - ms per elapsed second
const MIN_SPAWN_MS    = 440

const FLASH_MS    = 300          // catch flash duration (ms)
const TARGET_SWITCH_EVERY = 6    // re-roll target colour every N good catches

// Design token mirrors — must match app/globals.css exactly
const C_BG      = '#0b0d13'
const C_CARD    = '#141923'
const C_GREEN   = '#52cca3'
const C_PURPLE  = '#7c95ff'
const C_MUTED   = '#9ba3c4'
const C_DARK    = '#5c6487'

const BEST_KEY  = 'zenith_biosynth_best_v1'

/* ════════════════════════════════════════════════════════════════
   §2  PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export type BallColor = 'green' | 'purple'

export interface FallingBall {
  id:    number
  x:     number   // centre x (logical px)
  y:     number   // centre y (logical px)
  color: BallColor
  vx:    number   // slight horizontal drift for variety
}

export interface BioSynthesizerProps {
  /** Called on game over with the final score. */
  onSessionComplete?: (finalScore: number) => void
  /** Alias hook — also called on game over with the final score. */
  onGameComplete?: (finalScore: number) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type GamePhase = 'idle' | 'active' | 'ended'
type FlashType = 'catch' | 'miss' | null

/* ════════════════════════════════════════════════════════════════
   §4  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

function randomBallX(): number {
  const margin = BALL_R + 10
  return margin + Math.random() * (LOGICAL_W - margin * 2)
}

function randomColor(): BallColor {
  return Math.random() < 0.5 ? 'green' : 'purple'
}

function otherColor(c: BallColor): BallColor {
  return c === 'green' ? 'purple' : 'green'
}

function resolveHex(c: BallColor): string {
  return c === 'green' ? C_GREEN : C_PURPLE
}

/** Fall speed at elapsed seconds, clamped to a fair maximum. */
function fallSpeedAt(elapsedS: number): number {
  return Math.min(MAX_FALL_SPEED, BASE_FALL_SPEED + elapsedS * FALL_SPEED_RAMP)
}

/** Spawn interval (ms) at elapsed seconds, clamped to a fair minimum. */
function spawnMsAt(elapsedS: number): number {
  return Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS - elapsedS * SPAWN_RAMP_MS)
}

/* ════════════════════════════════════════════════════════════════
   §5  CANVAS DRAW ENGINE
   Pure functions operating in logical space (the ctx is pre-scaled
   so 1 unit == 1 logical px). All fills use hex + globalAlpha only.
   ════════════════════════════════════════════════════════════════ */

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
  ctx.fillStyle = C_BG
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

  // Faint vertical column guides for depth
  ctx.save()
  ctx.globalAlpha = 0.04
  ctx.strokeStyle = C_MUTED
  ctx.lineWidth   = 1
  for (let gx = LOGICAL_W / 6; gx < LOGICAL_W; gx += LOGICAL_W / 6) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, LOGICAL_H)
    ctx.stroke()
  }
  ctx.restore()

  // Guide line above bin
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = C_DARK
  ctx.lineWidth   = 1
  ctx.setLineDash([6, 9])
  ctx.beginPath()
  ctx.moveTo(0,        BIN_Y - 16)
  ctx.lineTo(LOGICAL_W, BIN_Y - 16)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawBall(ctx: CanvasRenderingContext2D, ball: FallingBall): void {
  const hex = resolveHex(ball.color)

  // Glow halo
  ctx.save()
  ctx.globalAlpha = 0.20
  ctx.fillStyle   = hex
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, BALL_R + 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Core
  ctx.fillStyle = hex
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2)
  ctx.fill()

  // Specular highlight
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  ctx.beginPath()
  ctx.arc(ball.x - BALL_R * 0.32, ball.y - BALL_R * 0.32, BALL_R * 0.30, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Renders the collector bin, tinted to the current target colour.
 * flash === 'catch' → brighter border + stronger glow.
 */
function drawBin(
  ctx:     CanvasRenderingContext2D,
  binX:    number,
  target:  BallColor,
  flash:   FlashType,
): void {
  // On a wrong-colour catch the bin flashes red to signal the penalty.
  const hex = flash === 'miss' ? '#f87171' : resolveHex(target)

  // Ambient glow under bin
  ctx.save()
  ctx.globalAlpha = flash ? 0.38 : 0.14
  ctx.fillStyle   = hex
  ctx.beginPath()
  ctx.roundRect(binX - 7, BIN_Y - 7, BIN_W + 14, BIN_H + 14, 14)
  ctx.fill()
  ctx.restore()

  // Bin body
  ctx.fillStyle   = C_CARD
  ctx.strokeStyle = hex
  ctx.lineWidth   = flash ? 3 : 2
  ctx.beginPath()
  ctx.roundRect(binX, BIN_Y, BIN_W, BIN_H, 8)
  ctx.fill()
  ctx.stroke()

  // Interior colour strip
  ctx.save()
  ctx.globalAlpha = 0.82
  ctx.fillStyle   = hex
  ctx.beginPath()
  ctx.roundRect(binX + 12, BIN_Y + 5, BIN_W - 24, 6, 3)
  ctx.fill()
  ctx.restore()
}

/** Idle-state prompt overlay drawn onto the canvas. */
function drawIdleOverlay(ctx: CanvasRenderingContext2D, target: BallColor): void {
  ctx.save()
  ctx.fillStyle = 'rgba(11,13,19,0.76)'
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = C_GREEN
  ctx.font      = '700 20px monospace'
  ctx.fillText('BALL CATCHER', LOGICAL_W / 2, LOGICAL_H / 2 - 74)

  ctx.fillStyle = C_MUTED
  ctx.font      = '600 13px monospace'
  ctx.fillText('CLICK / DRAG OR PRESS AN ARROW TO BEGIN', LOGICAL_W / 2, LOGICAL_H / 2 - 34)

  // Target sample swatch
  const hex = resolveHex(target)
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle   = hex
  ctx.beginPath()
  ctx.arc(LOGICAL_W / 2, LOGICAL_H / 2 + 12, BALL_R + 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = hex
  ctx.beginPath()
  ctx.arc(LOGICAL_W / 2, LOGICAL_H / 2 + 12, BALL_R, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = C_DARK
  ctx.font      = '500 11px monospace'
  ctx.fillText('CATCH THE TARGET COLOUR · AVOID THE REST', LOGICAL_W / 2, LOGICAL_H / 2 + 56)
  ctx.fillText('DRAG THE BIN · MISS OR WRONG CATCH ENDS THE RUN', LOGICAL_W / 2, LOGICAL_H / 2 + 74)
  ctx.restore()
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function BioSynthesizer({
  onSessionComplete,
  onGameComplete,
}: BioSynthesizerProps) {
  const { addResources } = useZenithEconomy()

  /* ── React state (DOM: HUD + overlay) ────────────────────────── */
  const [phase, setPhase]   = useState<GamePhase>('idle')
  const [score, setScore]   = useState(0)
  const [target, setTarget] = useState<BallColor>('green')
  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0
  })

  /* ── Refs ────────────────────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Hot-path gameplay refs (read / mutated inside RAF; never stale)
  const phaseRef        = useRef<GamePhase>('idle')
  const scoreRef        = useRef(0)
  const targetRef       = useRef<BallColor>('green')
  const catchesSinceRef = useRef(0)               // good catches since last target switch
  const startTsRef      = useRef(0)               // performance.now() at session start
  const ballsRef        = useRef<FallingBall[]>([])
  const binXRef         = useRef((LOGICAL_W - BIN_W) / 2)
  const flashRef        = useRef<FlashType>(null)
  const flashEndRef     = useRef(0)
  const spawnAccRef     = useRef(0)               // ms accumulator until next spawn
  const nextIdRef       = useRef(0)
  const prevTsRef       = useRef(-1)              // last RAF timestamp
  const isMountedRef    = useRef(true)
  const rafRef          = useRef(0)

  // Pointer-drag state
  const draggingRef     = useRef(false)

  // Backing-store dimensions (CSS px) — set by ResizeObserver.
  const cssWRef         = useRef(LOGICAL_W)
  const cssHRef         = useRef(LOGICAL_H)

  /* ── Stable callback mirrors ─────────────────────────────────── */
  const addResourcesRef = useRef(addResources)
  addResourcesRef.current = addResources

  /* ── Game-over handler ───────────────────────────────────────── */
  const commitGameOver = useCallback(() => {
    if (!isMountedRef.current) return
    if (phaseRef.current === 'ended') return
    phaseRef.current = 'ended'
    setPhase('ended')

    const final  = scoreRef.current
    const payout = Math.max(0, Math.floor(final / 2))

    setBestScore(b => {
      const next = Math.max(b, final)
      if (next !== b) localStorage.setItem(BEST_KEY, String(next))
      return next
    })

    if (payout > 0) void addResourcesRef.current('organic_spores', payout).catch(() => {})
    onSessionComplete?.(final)
    onGameComplete?.(final)
  }, [onSessionComplete, onGameComplete])

  const commitGameOverRef = useRef(commitGameOver)
  commitGameOverRef.current = commitGameOver

  /* ── Coordinate helper: pointer clientX → logical bin position ── */
  const pointerToLogicalX = useCallback((clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return binXRef.current + BIN_W / 2
    const t = (clientX - rect.left) / rect.width      // 0..1
    return t * LOGICAL_W
  }, [])

  /* ── RAF frame (reassigned each render via ref) ──────────────── */
  const frameRef = useRef<(ts: number) => void>((_ts) => {})
  frameRef.current = (ts: number) => {
    if (!isMountedRef.current) return

    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const phase = phaseRef.current

    // Reset transform then scale so 1 unit == 1 logical px on the
    // device-pixel backing store.
    const dpr    = Math.min(window.devicePixelRatio || 1, 2)
    const cssW   = cssWRef.current
    const cssH   = cssHRef.current
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale((cssW * dpr) / LOGICAL_W, (cssH * dpr) / LOGICAL_H)

    /* ── Physics ────────────────────────────────────────────── */
    if (phase === 'active') {
      if (prevTsRef.current < 0) prevTsRef.current = ts
      const dt = Math.min((ts - prevTsRef.current) / 1000, 0.1)
      prevTsRef.current = ts

      const elapsedS = (ts - startTsRef.current) / 1000
      const speed    = fallSpeedAt(elapsedS)
      const spawnMs  = spawnMsAt(elapsedS)

      // Spawn
      spawnAccRef.current += dt * 1000
      if (spawnAccRef.current >= spawnMs) {
        spawnAccRef.current -= spawnMs
        // Bias slightly toward the target colour so runs stay fun.
        const color = Math.random() < 0.58 ? targetRef.current : otherColor(targetRef.current)
        ballsRef.current.push({
          id:    nextIdRef.current++,
          x:     randomBallX(),
          y:     -BALL_R,
          color,
          vx:    (Math.random() - 0.5) * 22,
        })
      }

      const binX = binXRef.current
      const alive: FallingBall[] = []
      let gameOver = false

      for (const ball of ballsRef.current) {
        ball.y += speed * dt
        ball.x += ball.vx * dt
        // Bounce off side walls
        if (ball.x < BALL_R)            { ball.x = BALL_R;            ball.vx = Math.abs(ball.vx) }
        if (ball.x > LOGICAL_W - BALL_R) { ball.x = LOGICAL_W - BALL_R; ball.vx = -Math.abs(ball.vx) }

        // Collision window: ball overlaps the bin's top band
        const inBand = ball.y + BALL_R >= BIN_Y &&
                       ball.y - BALL_R <= BIN_Y + BIN_H
        if (inBand) {
          const catchL = binX - BALL_R * 0.35
          const catchR = binX + BIN_W + BALL_R * 0.35
          if (ball.x >= catchL && ball.x <= catchR) {
            if (ball.color === targetRef.current) {
              // GOOD catch
              scoreRef.current += 1
              setScore(scoreRef.current)
              flashRef.current    = 'catch'
              flashEndRef.current = ts + FLASH_MS

              catchesSinceRef.current += 1
              if (catchesSinceRef.current >= TARGET_SWITCH_EVERY) {
                catchesSinceRef.current = 0
                const next = randomColor()
                targetRef.current = next
                setTarget(next)
              }
            } else {
              // BAD catch → small penalty, NOT game over. The only failure
              // condition is missing a correct-colour ball (below).
              scoreRef.current = Math.max(0, scoreRef.current - 1)
              setScore(scoreRef.current)
              flashRef.current    = 'miss'
              flashEndRef.current = ts + FLASH_MS
            }
            continue  // ball consumed
          }
        }

        // Fell past the bottom
        if (ball.y - BALL_R > LOGICAL_H) {
          if (ball.color === targetRef.current) {
            // Missed a GOOD ball → game over
            gameOver = true
          }
          continue  // bad balls falling past are harmless
        }

        alive.push(ball)
      }

      ballsRef.current = alive

      if (flashRef.current && ts >= flashEndRef.current) flashRef.current = null

      if (gameOver) {
        commitGameOverRef.current()
        // fall through to a final draw of the frozen board
      }
    } else {
      prevTsRef.current = -1
    }

    /* ── Draw ───────────────────────────────────────────────── */
    drawBackground(ctx)
    for (const ball of ballsRef.current) drawBall(ctx, ball)
    drawBin(ctx, binXRef.current, targetRef.current, flashRef.current)
    if (phaseRef.current === 'idle') drawIdleOverlay(ctx, targetRef.current)

    rafRef.current = requestAnimationFrame((t) => frameRef.current(t))
  }

  /* ── Responsive sizing via ResizeObserver ────────────────────── */
  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas  = canvasRef.current
    if (!wrapper || !canvas) return

    const applySize = () => {
      const avail = wrapper.clientWidth
      if (avail <= 0) return
      const cssW = Math.min(avail, MAX_CANVAS_W)
      const cssH = cssW * (LOGICAL_H / LOGICAL_W)   // 4/3 tall
      cssWRef.current = cssW
      cssHRef.current = cssH

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width  = `${cssW}px`
      canvas.style.height = `${cssH}px`
    }

    applySize()
    const ro = new ResizeObserver(applySize)
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [])

  /* ── Mount / unmount RAF loop ─────────────────────────────────── */
  useEffect(() => {
    isMountedRef.current = true
    rafRef.current = requestAnimationFrame((t) => frameRef.current(t))
    return () => {
      isMountedRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /* ── Activate session ────────────────────────────────────────── */
  const activateSession = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    phaseRef.current       = 'active'
    prevTsRef.current      = -1
    startTsRef.current     = performance.now()
    spawnAccRef.current    = 0
    catchesSinceRef.current = 0
    setPhase('active')
  }, [])

  /* ── Keyboard handler ────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const key = e.key
      if (key !== 'ArrowLeft' && key !== 'ArrowRight') return
      e.preventDefault()

      if (phaseRef.current === 'idle') activateSession()
      if (phaseRef.current !== 'active') return

      if (key === 'ArrowLeft')  binXRef.current = Math.max(0, binXRef.current - KEY_STEP)
      else                      binXRef.current = Math.min(LOGICAL_W - BIN_W, binXRef.current + KEY_STEP)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activateSession])

  /* ── Pointer drag (mouse / touch / pen) ──────────────────────── */
  const moveBinToPointer = useCallback((clientX: number) => {
    const centre = pointerToLogicalX(clientX)
    binXRef.current = Math.max(0, Math.min(LOGICAL_W - BIN_W, centre - BIN_W / 2))
  }, [pointerToLogicalX])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current === 'idle') activateSession()
    if (phaseRef.current !== 'active') return
    draggingRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
    moveBinToPointer(e.clientX)
  }, [activateSession, moveBinToPointer])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'active') return
    if (!draggingRef.current) return
    moveBinToPointer(e.clientX)
  }, [moveBinToPointer])

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }, [])

  /* ── Reset ───────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)

    phaseRef.current        = 'idle'
    scoreRef.current        = 0
    ballsRef.current        = []
    binXRef.current         = (LOGICAL_W - BIN_W) / 2
    flashRef.current        = null
    prevTsRef.current       = -1
    spawnAccRef.current     = 0
    nextIdRef.current       = 0
    catchesSinceRef.current = 0
    draggingRef.current     = false
    const freshTarget       = randomColor()
    targetRef.current       = freshTarget

    setTarget(freshTarget)
    setPhase('idle')
    setScore(0)

    rafRef.current = requestAnimationFrame((t) => frameRef.current(t))
  }, [])

  /* ── Derived display values ──────────────────────────────────── */
  const sporesPayout = Math.max(0, Math.floor(score / 2))
  const targetLabel  = target === 'green' ? 'GREEN' : 'PURPLE'
  const targetHex    = resolveHex(target)

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.root} data-phase={phase}>

      {/* ════════════════════════════════════════════════════════
          HUD — score | best | target
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsBar} aria-label="Game statistics">

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SCORE</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>{score}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>BEST</span>
          <span className={styles.statValue}>{bestScore}</span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>TARGET</span>
          <span className={styles.targetChip} aria-live="polite">
            <span
              className={styles.targetSwatch}
              style={{ backgroundColor: targetHex, boxShadow: `0 0 8px ${targetHex}` }}
              aria-hidden="true"
            />
            <span className={styles.statValue} style={{ color: targetHex }}>
              {targetLabel}
            </span>
          </span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SPORES</span>
          <span className={`${styles.statValue} ${styles.statPurple}`}>+{sporesPayout}</span>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════
          CANVAS ARENA — responsive
          ════════════════════════════════════════════════════════ */}
      <div className={styles.canvasWrapper} ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Ball Catcher game arena — drag the bin to catch the target colour"
          role="img"
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'idle'   && 'Drag the bin or press ← → to catch the target colour.'}
        {phase === 'active' && 'Catch the target colour · avoid the rest · a miss or wrong catch ends the run.'}
        {phase === 'ended'  && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          GAME-OVER OVERLAY
          ════════════════════════════════════════════════════════ */}
      {phase === 'ended' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Game over"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>Run complete</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Balls Caught</span>
                <span className={styles.resultVal}>{score}</span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Best Score</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>{bestScore}</span>
              </div>
              <div className={styles.resultDivider} aria-hidden="true" />
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Organic Spores</span>
                <span className={`${styles.resultVal} ${styles.resultGreen}`}>+{sporesPayout}</span>
              </div>
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new run"
            >
              Play Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
