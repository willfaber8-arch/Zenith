'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * BioSynthesizer — Games Tab · Step 4.4 · Harvest Station
 *
 * Falling color-coded droplet balancer game on a 360×400 canvas.
 *
 * Mechanics:
 *   • Color-coded droplets (green | purple) fall from the top
 *     of the canvas at FALL_SPEED px/s with delta-time physics.
 *   • Player slides a collector bin across the bottom via:
 *       ArrowLeft / ArrowRight — translate bin 44 px per press
 *       ArrowUp / Space        — rotate bin color (green ↔ purple)
 *       Canvas click           — left half slides left, right half
 *                                slides right; starts game if idle
 *   • Matched catch  → +1 fusion score, green flash on bin.
 *   • Mismatched hit → −1 stability (floor 0), red flash on bin.
 *   • Missed droplet (falls below canvas) → no penalty.
 *
 * Session: 60-second countdown; begins on the first input.
 * Payout:  addResources('organic_spores', Math.floor(fusionScore / 2))
 *
 * Rendering:
 *   • RAF loop via processFrameRef pattern — no stale closures.
 *   • All canvas draws use hex literals + ctx.globalAlpha (no CSS
 *     functions — Canvas 2D API does not support them).
 *   • Stats bar + result overlay are React DOM (accessible labels).
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

const CANVAS_W    = 360       // canvas pixel width
const CANVAS_H    = 400       // canvas pixel height
const DROPLET_R   = 14        // droplet circle radius (px)
const BIN_W       = 84        // collector bin width (px)
const BIN_H       = 24        // collector bin height (px)
const BIN_Y       = CANVAS_H - 42   // bin top-edge Y
const BIN_STEP    = 44        // px per ArrowLeft / ArrowRight press
const FALL_SPEED  = 88        // px per second droplet descent
const SPAWN_MS    = 1700      // ms between successive droplet spawns
const SESSION_S   = 60        // session length in seconds
const FLASH_MS    = 340       // match / mismatch flash duration (ms)

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

export type DropletColor = 'green' | 'purple'

export interface BioDroplet {
  id:    number
  x:     number   // centre x (px)
  y:     number   // centre y (px)
  color: DropletColor
}

export interface BioSynthesizerProps {
  onSessionComplete?: (finalScore: number) => void
}

/* ════════════════════════════════════════════════════════════════
   §3  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

type GamePhase = 'idle' | 'active' | 'ended'
type FlashType = 'match' | 'miss' | null

interface BinState {
  x:     number          // bin left-edge X (px)
  color: DropletColor
}

/* ════════════════════════════════════════════════════════════════
   §4  PURE UTILITIES
   ════════════════════════════════════════════════════════════════ */

/** Random droplet centre X within canvas bounds (plus DROPLET_R margin). */
function randomDropletX(): number {
  const margin = DROPLET_R + 8
  return margin + Math.floor(Math.random() * (CANVAS_W - margin * 2))
}

function randomDropletColor(): DropletColor {
  return Math.random() < 0.5 ? 'green' : 'purple'
}

function resolveHex(c: DropletColor): string {
  return c === 'green' ? C_GREEN : C_PURPLE
}

function fmtTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ════════════════════════════════════════════════════════════════
   §5  CANVAS DRAW ENGINE
   Pure functions — accept CanvasRenderingContext2D plus snapshot data.
   No React hooks. All fills / strokes use hex + globalAlpha only.
   ════════════════════════════════════════════════════════════════ */

/** Fills canvas with bg-main + subtle separation line above bin zone. */
function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.fillStyle = C_BG
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Horizontal guide line above bin
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = C_DARK
  ctx.lineWidth   = 1
  ctx.setLineDash([5, 8])
  ctx.beginPath()
  ctx.moveTo(0,       BIN_Y - 14)
  ctx.lineTo(CANVAS_W, BIN_Y - 14)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/** Renders one falling droplet: ambient glow ring + core circle + specular. */
function drawDroplet(ctx: CanvasRenderingContext2D, drop: BioDroplet): void {
  const hex = resolveHex(drop.color)

  // Glow halo
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle   = hex
  ctx.beginPath()
  ctx.arc(drop.x, drop.y, DROPLET_R + 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Core
  ctx.fillStyle = hex
  ctx.beginPath()
  ctx.arc(drop.x, drop.y, DROPLET_R, 0, Math.PI * 2)
  ctx.fill()

  // Specular dot
  ctx.save()
  ctx.fillStyle   = 'rgba(255,255,255,0.32)'
  ctx.beginPath()
  ctx.arc(drop.x - 4, drop.y - 4, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Renders the collector bin.
 *
 * flash === 'match' → bright green border + glow
 * flash === 'miss'  → warning rose border + glow
 * flash === null    → neutral bin color tint
 */
function drawBin(
  ctx:   CanvasRenderingContext2D,
  bin:   BinState,
  flash: FlashType,
): void {
  const baseHex   = resolveHex(bin.color)
  const flashHex  = flash === 'match' ? C_GREEN
                  : flash === 'miss'  ? '#ff6b8a'
                  : baseHex

  // Ambient glow under bin
  ctx.save()
  ctx.globalAlpha = flash ? 0.32 : 0.12
  ctx.fillStyle   = flashHex
  ctx.beginPath()
  ctx.roundRect(bin.x - 6, BIN_Y - 6, BIN_W + 12, BIN_H + 12, 12)
  ctx.fill()
  ctx.restore()

  // Bin body (dark fill + coloured border)
  ctx.fillStyle   = C_CARD
  ctx.strokeStyle = flashHex
  ctx.lineWidth   = flash ? 2.5 : 1.5
  ctx.beginPath()
  ctx.roundRect(bin.x, BIN_Y, BIN_W, BIN_H, 7)
  ctx.fill()
  ctx.stroke()

  // Color-indicator strip across the top interior of the bin
  ctx.save()
  ctx.globalAlpha = 0.80
  ctx.fillStyle   = flashHex
  ctx.beginPath()
  ctx.roundRect(bin.x + 10, BIN_Y + 4, BIN_W - 20, 5, 3)
  ctx.fill()
  ctx.restore()

  // Centre label glyph (◈ = green / ◆ = purple)
  ctx.save()
  ctx.fillStyle    = flashHex
  ctx.font         = '700 11px monospace'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    bin.color === 'green' ? '◈' : '◆',
    bin.x + BIN_W / 2,
    BIN_Y + BIN_H / 2 + 2,
  )
  ctx.restore()
}

/** Idle-state instruction overlay rendered directly onto the canvas. */
function drawIdleOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.fillStyle = 'rgba(11,13,19,0.74)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle    = C_MUTED
  ctx.font         = '600 11px monospace'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PRESS ANY ARROW KEY OR CLICK TO BEGIN', CANVAS_W / 2, CANVAS_H / 2 - 18)

  ctx.fillStyle = C_DARK
  ctx.font      = '500 10px monospace'
  ctx.fillText('← →   slide collector bin', CANVAS_W / 2, CANVAS_H / 2 + 4)
  ctx.fillText('↑ / Space   rotate bin color', CANVAS_W / 2, CANVAS_H / 2 + 20)
  ctx.restore()
}

/* ════════════════════════════════════════════════════════════════
   §6  COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function BioSynthesizer({ onSessionComplete }: BioSynthesizerProps) {
  const { addResources } = useZenithEconomy()

  /* ── React state (DOM-only: stats bar + overlay) ─────────────── */
  const [phase,    setPhase]    = useState<GamePhase>('idle')
  const [score,    setScore]    = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_S)
  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10)
  })

  /* ── Canvas ref ──────────────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── Hot-path refs (read / mutated inside RAF; never stale) ──── */
  const phaseRef        = useRef<GamePhase>('idle')
  const scoreRef        = useRef(0)
  const timeRef         = useRef(SESSION_S)       // seconds remaining (float)
  const lastSecRef      = useRef(SESSION_S)       // last rendered whole second
  const sessionEndRef   = useRef(0)              // performance.now() epoch
  const dropsRef        = useRef<BioDroplet[]>([])
  const binRef          = useRef<BinState>({ x: (CANVAS_W - BIN_W) / 2, color: 'green' })
  const flashRef        = useRef<FlashType>(null)
  const flashEndRef     = useRef(0)
  const spawnAccRef     = useRef(0)              // ms accumulator until next spawn
  const nextIdRef       = useRef(0)
  const prevTsRef       = useRef(-1)             // last RAF timestamp
  const isMountedRef    = useRef(true)
  const rafRef          = useRef(0)

  /* ── addResources ref mirror (ensures latest stable callback) ── */
  const addResourcesRef = useRef(addResources)
  addResourcesRef.current = addResources

  /* ── Session-end handler ─────────────────────────────────────── */
  const commitSessionEnd = useCallback(() => {
    if (!isMountedRef.current) return
    phaseRef.current = 'ended'
    setPhase('ended')

    const final  = scoreRef.current
    const payout = Math.floor(final / 2)

    setBestScore(b => {
      const next = Math.max(b, final)
      localStorage.setItem(BEST_KEY, String(next))
      return next
    })

    if (payout > 0) void addResourcesRef.current('organic_spores', payout).catch(() => {})
    onSessionComplete?.(final)
  }, [onSessionComplete])

  const commitSessionEndRef = useRef(commitSessionEnd)
  commitSessionEndRef.current = commitSessionEnd

  /* ── RAF frame function (reassigned each render via ref) ─────── */
  const frameRef = useRef<(ts: number) => void>((_ts) => {})
  frameRef.current = (ts: number) => {
    if (!isMountedRef.current) return

    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const phase = phaseRef.current

    /* ── Physics update ─────────────────────────────────────── */
    if (phase === 'active') {
      // Delta time, capped at 100ms to absorb tab-resume spikes
      if (prevTsRef.current < 0) prevTsRef.current = ts
      const dt = Math.min((ts - prevTsRef.current) / 1000, 0.1)
      prevTsRef.current = ts

      // Update countdown
      const remaining = (sessionEndRef.current - ts) / 1000
      timeRef.current  = Math.max(0, remaining)

      // Push updated second to React DOM (one setState per second, not per frame)
      const wholeSec = Math.ceil(timeRef.current)
      if (wholeSec !== lastSecRef.current) {
        lastSecRef.current = wholeSec
        setTimeLeft(wholeSec)
      }

      if (remaining <= 0) {
        commitSessionEndRef.current()
        return  // stop loop
      }

      // Spawn droplets on interval accumulator
      spawnAccRef.current += dt * 1000
      if (spawnAccRef.current >= SPAWN_MS) {
        spawnAccRef.current = 0
        dropsRef.current.push({
          id:    nextIdRef.current++,
          x:     randomDropletX(),
          y:     -DROPLET_R,
          color: randomDropletColor(),
        })
      }

      // Advance droplet positions + resolve bin collisions
      const bin   = binRef.current
      const alive: BioDroplet[] = []

      for (const drop of dropsRef.current) {
        drop.y += FALL_SPEED * dt

        // Collision window: drop centre within bin vertical band
        const inBand = drop.y + DROPLET_R >= BIN_Y &&
                       drop.y - DROPLET_R <= BIN_Y + BIN_H
        if (inBand) {
          const binL = bin.x - DROPLET_R * 0.45
          const binR = bin.x + BIN_W + DROPLET_R * 0.45
          if (drop.x >= binL && drop.x <= binR) {
            // Matched or mismatched catch
            if (drop.color === bin.color) {
              scoreRef.current += 1
              setScore(scoreRef.current)
              flashRef.current = 'match'
            } else {
              scoreRef.current = Math.max(0, scoreRef.current - 1)
              setScore(scoreRef.current)
              flashRef.current = 'miss'
            }
            flashEndRef.current = ts + FLASH_MS
            continue  // consumed — omit from alive list
          }
        }

        // Cull droplets that exited the canvas bottom
        if (drop.y - DROPLET_R > CANVAS_H) continue

        alive.push(drop)
      }

      dropsRef.current = alive

      // Expire flash after FLASH_MS
      if (flashRef.current && ts >= flashEndRef.current) {
        flashRef.current = null
      }
    } else {
      // Idle / ended: reset prevTs so next active frame has clean dt
      prevTsRef.current = -1
    }

    /* ── Draw ───────────────────────────────────────────────── */
    drawBackground(ctx)

    for (const drop of dropsRef.current) {
      drawDroplet(ctx, drop)
    }

    drawBin(ctx, binRef.current, flashRef.current)

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
  }, [])   // empty deps — runs once; frame reads state from refs

  /* ── Helper: activate game session ──────────────────────────── */
  const activateSession = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    phaseRef.current    = 'active'
    prevTsRef.current   = -1
    sessionEndRef.current = performance.now() + SESSION_S * 1000
    spawnAccRef.current = SPAWN_MS   // spawn first droplet on first frame
    lastSecRef.current  = SESSION_S
    setPhase('active')
    setTimeLeft(SESSION_S)
  }, [])

  /* ── Keyboard handler (stable, registered once) ──────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const key = e.key
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) return
      e.preventDefault()

      if (phaseRef.current === 'idle') activateSession()
      if (phaseRef.current !== 'active') return

      const bin = binRef.current
      if      (key === 'ArrowLeft')                 bin.x = Math.max(0, bin.x - BIN_STEP)
      else if (key === 'ArrowRight')                bin.x = Math.min(CANVAS_W - BIN_W, bin.x + BIN_STEP)
      else if (key === 'ArrowUp' || key === ' ')    bin.color = bin.color === 'green' ? 'purple' : 'green'
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activateSession])

  /* ── Canvas click handler (slide + activate) ─────────────────── */
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current === 'idle') activateSession()
    if (phaseRef.current !== 'active') return

    const rect   = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX       = CANVAS_W / rect.width
    const canvasClickX = (e.clientX - rect.left) * scaleX
    const bin          = binRef.current

    if (canvasClickX < CANVAS_W / 2) bin.x = Math.max(0, bin.x - BIN_STEP)
    else                              bin.x = Math.min(CANVAS_W - BIN_W, bin.x + BIN_STEP)
  }, [activateSession])

  /* ── Reset ───────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)

    phaseRef.current      = 'idle'
    scoreRef.current      = 0
    timeRef.current       = SESSION_S
    lastSecRef.current    = SESSION_S
    dropsRef.current      = []
    binRef.current        = { x: (CANVAS_W - BIN_W) / 2, color: 'green' }
    flashRef.current      = null
    prevTsRef.current     = -1
    spawnAccRef.current   = 0
    nextIdRef.current     = 0

    setPhase('idle')
    setScore(0)
    setTimeLeft(SESSION_S)

    rafRef.current = requestAnimationFrame((t) => frameRef.current!(t))
  }, [])

  /* ── Derived display values ──────────────────────────────────── */
  const sporasPayout   = Math.floor(score / 2)
  const isUrgent       = phase === 'active' && timeLeft <= 10

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className={styles.root} data-phase={phase}>

      {/* ════════════════════════════════════════════════════════
          STATS BAR — fusion score | best | time | spore preview
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsBar} aria-label="Session statistics">

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>FUSION</span>
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
          <span className={styles.statLabel}>TIME</span>
          <span
            className={`${styles.statValue} ${isUrgent ? styles.statUrgent : ''}`}
            aria-live="polite"
          >
            {fmtTime(timeLeft)}
          </span>
        </div>

        <div className={styles.statDivider} aria-hidden="true" />

        <div className={styles.statGroup}>
          <span className={styles.statLabel}>SPORES</span>
          <span className={`${styles.statValue} ${styles.statPurple}`}>
            +{sporasPayout}
          </span>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════
          CANVAS ARENA
          ════════════════════════════════════════════════════════ */}
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={styles.canvas}
          onClick={handleCanvasClick}
          aria-label="BioSynthesizer game arena — match falling droplets to your collector bin"
          role="img"
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          FOOTER HINT
          ════════════════════════════════════════════════════════ */}
      <p className={styles.hint} aria-live="polite">
        {phase === 'idle'   && 'Press any arrow key or click the arena to begin synthesizing.'}
        {phase === 'active' && '← → slide bin  ·  ↑ / Space toggle color'}
        {phase === 'ended'  && ' '}
      </p>

      {/* ════════════════════════════════════════════════════════
          SESSION-END OVERLAY
          ════════════════════════════════════════════════════════ */}
      {phase === 'ended' && (
        <div
          className={styles.resultOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Synthesis session complete"
        >
          <div className={styles.resultCard}>

            <p className={styles.resultHeading}>Synthesis complete</p>

            <div className={styles.resultGrid}>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Fusion Score</span>
                <span className={styles.resultVal}>{score}</span>
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
                  +{sporasPayout}
                </span>
              </div>
            </div>

            <button
              className={styles.restartBtn}
              onClick={handleReset}
              aria-label="Start a new synthesis session"
            >
              Synthesize Again
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
