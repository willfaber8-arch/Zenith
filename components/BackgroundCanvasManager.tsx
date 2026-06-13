'use client'

/**
 * BackgroundCanvasManager.tsx
 * Phase 11.3 — Hardware-Accelerated Dynamic Canvas Background Options
 *
 * Renders one of three ultra-low-saturation animated canvas scripts at z-index 0.
 * Sits below CosmosCanvas (z:1) and above ThemeBackground (z:0, DOM-order first).
 *
 * Performance contracts:
 *   · RAF loop is halted when document.hidden === true (tab visibility API)
 *   · Canvas resized via debounced ResizeObserver (no layout thrash)
 *   · All drawing uses literal hex colours — no CSS var() (Canvas API limitation)
 *   · GPU layer promoted via transform: translate3d(0,0,0) + will-change: transform
 */

import { useEffect, useRef } from 'react'
import styles from './BackgroundCanvasManager.module.css'
import {
  type BackgroundStyle,
  BACKDROP_STORAGE_KEY,
  BACKDROP_DEFAULT,
} from '@/types/backgrounds'

// ─────────────────────────────────────────────────────────────
// Colour constants (warm mineral-dark palette, literal hex for Canvas API)
// ─────────────────────────────────────────────────────────────
const C_BG_MAIN      = '#0d0f12'   // --color-bg-main
const C_TEXT_MUTED   = '#8a94a6'   // --color-text-muted
const C_SURFACE_CARD = '#14171c'   // --color-surface-card
// C_BG_MAIN as rgb components for rgba() use
const BG_R = 13, BG_G = 15, BG_B = 18

// ─────────────────────────────────────────────────────────────
// Utility — read backdrop preference from localStorage (SSR-safe)
// ─────────────────────────────────────────────────────────────
function readBackdropStyle(): BackgroundStyle {
  if (typeof window === 'undefined') return BACKDROP_DEFAULT
  try {
    const v = window.localStorage.getItem(BACKDROP_STORAGE_KEY)
    if (v === 'CLASSIC_STARFIELD' || v === 'RAINDROPS_ON_GLASS' || v === 'MINIMAL_GRID_MATRIX') {
      return v
    }
  } catch {
    /* localStorage unavailable */
  }
  return BACKDROP_DEFAULT
}

// ─────────────────────────────────────────────────────────────
// Script 1 — CLASSIC_STARFIELD
// 3D perspective particle field drifting from central focus vector.
// Particles start transparent near center and fade to --text-muted
// as they drift outward toward the viewport edges.
// ─────────────────────────────────────────────────────────────
interface Star {
  x: number   // −1..1 normalised canvas space
  y: number
  z: number   // 0..1 depth (0 = far, 1 = near)
  vz: number  // drift speed along z axis
}

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x:  (Math.random() - 0.5) * 2,
    y:  (Math.random() - 0.5) * 2,
    z:  Math.random(),
    vz: 0.0002 + Math.random() * 0.0004,
  }))
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stars: Star[],
  dt: number,
): void {
  ctx.clearRect(0, 0, w, h)

  const cx = w * 0.5
  const cy = h * 0.5
  const fov = Math.min(w, h) * 0.6

  for (const s of stars) {
    // Advance z; reset to far end when it reaches camera
    s.z += s.vz * dt
    if (s.z >= 1) {
      s.x  = (Math.random() - 0.5) * 2
      s.y  = (Math.random() - 0.5) * 2
      s.z  = 0
    }

    const perspective = fov / (1 - s.z)
    const sx = cx + s.x * perspective
    const sy = cy + s.y * perspective

    // Only draw if within canvas bounds
    if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue

    const radius = 0.4 + s.z * 1.2
    // Alpha: transparent near center (small z) → opaque far out (z near 1)
    const alpha = s.z * s.z * 0.55

    ctx.beginPath()
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(138, 148, 166, ${alpha.toFixed(3)})`
    ctx.fill()
  }
}

// ─────────────────────────────────────────────────────────────
// Script 2 — RAINDROPS_ON_GLASS
// Expanding concentric circle ripples that slowly slide downward.
// Trail cleared with a very low-opacity fill to create motion blur.
// ─────────────────────────────────────────────────────────────
interface Raindrop {
  x:       number
  y:       number
  r:       number   // current radius
  maxR:    number
  vy:      number   // vertical drift speed
  opacity: number   // starting opacity
  rings:   number   // number of concentric rings
}

function makeRaindrop(w: number, h: number): Raindrop {
  return {
    x:       Math.random() * w,
    y:       Math.random() * h * 0.6,
    r:       0,
    maxR:    20 + Math.random() * 50,
    vy:      0.05 + Math.random() * 0.12,
    opacity: 0.12 + Math.random() * 0.14,
    rings:   1 + Math.floor(Math.random() * 3),
  }
}

function drawRaindrops(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  drops: Raindrop[],
  dt: number,
): void {
  // Alpha-trail clear — creates smear / motion blur residue
  ctx.fillStyle = `rgba(${BG_R}, ${BG_G}, ${BG_B}, 0.08)`
  ctx.fillRect(0, 0, w, h)

  for (const d of drops) {
    // Grow radius and drift down
    d.r  += 0.15 * dt
    d.y  += d.vy * dt

    if (d.r > d.maxR || d.y > h + d.maxR) {
      // Reset to top portion of canvas
      Object.assign(d, makeRaindrop(w, h))
      d.y = -d.maxR
      continue
    }

    const progress = d.r / d.maxR
    const alpha = d.opacity * (1 - progress * progress)

    for (let i = 0; i < d.rings; i++) {
      const rOff = (i / d.rings) * d.maxR * 0.35
      const rr   = d.r - rOff
      if (rr <= 0) continue

      ctx.beginPath()
      ctx.arc(d.x, d.y, rr, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(138, 148, 166, ${(alpha / (i + 1)).toFixed(3)})`
      ctx.lineWidth   = 0.8
      ctx.stroke()
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Script 3 — MINIMAL_GRID_MATRIX
// Structural 40px grid in --surface-card colour.
// Intersection nodes pulse opacity via a scrolling sine wave.
// ─────────────────────────────────────────────────────────────
function drawGridMatrix(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
): void {
  ctx.clearRect(0, 0, w, h)

  const CELL = 40
  const cols = Math.ceil(w / CELL) + 1
  const rows = Math.ceil(h / CELL) + 1

  // Grid lines — very subtle surface-card colour
  ctx.strokeStyle = C_SURFACE_CARD
  ctx.lineWidth   = 1
  ctx.globalAlpha = 0.65

  for (let c = 0; c <= cols; c++) {
    const x = c * CELL
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    const y = r * CELL
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  ctx.globalAlpha = 1

  // Intersection node dots — sine wave sweeping across canvas
  const WAVE_SPEED = 0.0006   // radians per ms
  const t          = elapsed * WAVE_SPEED

  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r <= rows; r++) {
      const x    = c * CELL
      const y    = r * CELL
      // Wave travels diagonally
      const wave = Math.sin(t + (c * 0.35) + (r * 0.28))
      const alpha = 0.08 + (wave * 0.5 + 0.5) * 0.22

      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(138, 148, 166, ${alpha.toFixed(3)})`
      ctx.fill()
    }
  }
}

// ─────────────────────────────────────────────────────────────
// BackgroundCanvasManager component
// ─────────────────────────────────────────────────────────────
export default function BackgroundCanvasManager() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── Determine which script to run ──────────────────────
    const style = readBackdropStyle()

    // ── Per-script state ───────────────────────────────────
    const stars: Star[]      = style === 'CLASSIC_STARFIELD'   ? makeStars(160) : []
    let drops: Raindrop[]    = []

    // Stable non-null references captured once — safe because the effect
    // only runs after the guard `if (!canvas) return` above.
    const cvs: HTMLCanvasElement      = canvas
    const cx2: CanvasRenderingContext2D = ctx

    // ── Resize handler (debounced) ─────────────────────────
    let resizeTimer = 0
    function handleResize() {
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        cvs.width  = cvs.offsetWidth  * window.devicePixelRatio
        cvs.height = cvs.offsetHeight * window.devicePixelRatio
        cx2.scale(window.devicePixelRatio, window.devicePixelRatio)

        // Re-seed raindrops to spread across the new canvas size
        if (style === 'RAINDROPS_ON_GLASS') {
          const w = cvs.offsetWidth
          const h = cvs.offsetHeight
          drops = Array.from({ length: 40 }, () => makeRaindrop(w, h))
          // Scatter initial positions across full canvas height
          drops.forEach(d => { d.y = Math.random() * h })
          // Full clear on resize to remove stale alpha residue
          cx2.clearRect(0, 0, w, h)
        }
      }, 120)
    }

    // Initial size
    canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const ro = new ResizeObserver(handleResize)
    ro.observe(canvas)

    // Seed raindrops after initial size is known
    if (style === 'RAINDROPS_ON_GLASS') {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      drops = Array.from({ length: 40 }, () => makeRaindrop(w, h))
      drops.forEach(d => { d.y = Math.random() * h })
    }

    // ── RAF loop ───────────────────────────────────────────
    let rafId    = 0
    let lastTs   = 0
    let elapsed  = 0  // cumulative ms

    const frameRef = { current: (_ts: number) => {} }

    frameRef.current = (ts: number) => {
      // Halt when tab is hidden — zero CPU cost
      if (document.hidden) {
        lastTs = 0
        rafId = requestAnimationFrame(t => frameRef.current(t))
        return
      }

      if (lastTs === 0) lastTs = ts
      const dt = Math.min(ts - lastTs, 50)  // cap at 50ms to handle tab wake-up jitter
      lastTs   = ts
      elapsed += dt

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      if (w > 0 && h > 0) {
        switch (style) {
          case 'CLASSIC_STARFIELD':
            drawStarfield(ctx, w, h, stars, dt)
            break
          case 'RAINDROPS_ON_GLASS':
            drawRaindrops(ctx, w, h, drops, dt)
            break
          case 'MINIMAL_GRID_MATRIX':
            drawGridMatrix(ctx, w, h, elapsed)
            break
        }
      }

      rafId = requestAnimationFrame(t => frameRef.current(t))
    }

    rafId = requestAnimationFrame(t => frameRef.current(t))

    // ── Visibility change listener — halt/resume ──────────
    function onVisibilityChange() {
      if (!document.hidden && lastTs === 0) {
        // Reset lastTs so dt doesn't spike on resume
        lastTs = 0
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <div className={styles.canvasRoot} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
