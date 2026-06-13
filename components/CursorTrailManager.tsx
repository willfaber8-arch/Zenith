'use client'

/**
 * CursorTrailManager — Phase 14.3 · Custom Mouse Cursor Trailing
 *
 * Full-screen hardware-accelerated canvas that emits a faint parchment-gold
 * dust trail following the mouse cursor.
 *
 * Performance contract:
 *   - Mouse events never touch React state — particles are pushed directly
 *     into a mutable ref array so no re-renders are triggered.
 *   - The RAF loop self-terminates when the particle array empties, achieving
 *     idle dampening without any explicit timer.
 *   - canvas.width/height is scaled by devicePixelRatio for crisp Retina/4K
 *     rendering; the context is pre-scaled so all drawing uses CSS px coords.
 *   - z-index: 9000 + pointer-events: none — visible above all UI, zero
 *     interaction blocking.
 */

import { useEffect, useRef } from 'react'
import type { TrailParticle } from '@/types/cursorTrail'

/* ── Rendering constants ──────────────────────────────────────────── */

/** Warm parchment gold — matches AudioAtmosphereWidget accent palette */
const PARTICLE_COLOR = '#e5c17c'

/** Particles spawned per mousemove event */
const SPAWN_MIN = 2
const SPAWN_MAX = 4

/** Particle diameter range in CSS pixels */
const SIZE_MIN = 1.0
const SIZE_MAX = 3.2

/**
 * Alpha decay per frame.
 * At 60 fps: MIN ≈ 21-frame lifetime, MAX ≈ 11-frame lifetime.
 * Particles are gone within ~350 ms of the mouse stopping.
 */
const DECAY_MIN = 0.028
const DECAY_MAX = 0.058

/** ± px per frame initial velocity spread */
const VEL_SPREAD = 1.4

/** Friction coefficient applied each frame — particles slow as they drift */
const FRICTION = 0.93

/** Hard cap on active particles to prevent memory runaway during fast drags */
const MAX_PARTICLES = 240

/* ── Helpers ─────────────────────────────────────────────────────── */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/**
 * Spawn a burst of particles at the cursor position.
 * Each particle gets a randomised velocity so the cloud expands
 * organically like soft vapour rather than a hard line.
 */
function spawnBurst(x: number, y: number): TrailParticle[] {
  const count = Math.round(rand(SPAWN_MIN, SPAWN_MAX))
  const burst: TrailParticle[] = []

  for (let i = 0; i < count; i++) {
    burst.push({
      x,
      y,
      vx:        (Math.random() - 0.5) * VEL_SPREAD * 2,
      /* Mild upward bias (-0.35) so particles drift like warm air */
      vy:        (Math.random() - 0.5) * VEL_SPREAD * 2 - 0.35,
      alpha:     rand(0.58, 0.88),
      size:      rand(SIZE_MIN, SIZE_MAX),
      decayRate: rand(DECAY_MIN, DECAY_MAX),
    })
  }

  return burst
}

/* ══════════════════════════════════════════════════════════════════
   CursorTrailManager
   ══════════════════════════════════════════════════════════════════ */

export default function CursorTrailManager() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const particlesRef  = useRef<TrailParticle[]>([])
  const rafRef        = useRef<number>(0)
  const loopActiveRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /* ── DPR-aware canvas sizing ──────────────────────────────── */
    /*
     * Setting canvas.width resets the context transform to identity,
     * so we must re-apply ctx.scale(dpr, dpr) afterward.
     * All downstream draw calls use CSS-pixel coordinates.
     */
    const applySize = () => {
      const dpr     = window.devicePixelRatio || 1
      canvas.width  = Math.round(window.innerWidth  * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      canvas.style.width  = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }

    applySize()
    window.addEventListener('resize', applySize)

    /* ── RAF paint loop ───────────────────────────────────────── */
    /*
     * Idle dampening: the loop returns (cancels itself) as soon as the
     * particle array is empty. Since particles decay in ~200–350 ms,
     * CPU cost drops to zero well within 1 s of the mouse stopping.
     * The loop restarts automatically on the next mousemove.
     */
    const loop = () => {
      const particles = particlesRef.current

      if (particles.length === 0) {
        loopActiveRef.current = false
        return
      }

      rafRef.current = requestAnimationFrame(loop)

      /* Clear the logical canvas area (CSS px coords, scaled by ctx) */
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      /* Iterate backwards so in-place splice is index-safe */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        /* ── Physics step ─────────────────────────────────────── */
        p.x     += p.vx
        p.y     += p.vy
        p.vx    *= FRICTION     // velocity dampens each frame
        p.vy    *= FRICTION
        p.alpha -= p.decayRate  // opacity fades each frame

        /* Drop fully transparent particles */
        if (p.alpha <= 0) {
          particles.splice(i, 1)
          continue
        }

        /* ── Draw ─────────────────────────────────────────────── */
        ctx.save()
        ctx.globalAlpha = Math.min(p.alpha, 1)
        ctx.fillStyle   = PARTICLE_COLOR
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    const startLoop = () => {
      if (!loopActiveRef.current) {
        loopActiveRef.current = true
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    /* ── Mouse tracking — no React state, pure ref mutation ────── */
    const onMouseMove = (e: MouseEvent) => {
      /* Soft cap prevents runaway accumulation on 240Hz mice */
      if (particlesRef.current.length >= MAX_PARTICLES) return

      const burst = spawnBurst(e.clientX, e.clientY)
      particlesRef.current.push(...burst)
      startLoop()
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize',    applySize)
      cancelAnimationFrame(rafRef.current)
      loopActiveRef.current = false
      particlesRef.current  = []
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        pointerEvents: 'none',
        /* Above all z-index layers (context menu: 800, toast: 600, etc.)
           pointer-events: none guarantees zero interaction blocking.    */
        zIndex:        9000,
        /* GPU compositor promotion — prevents CPU rasterisation cost   */
        transform:     'translate3d(0, 0, 0)',
        willChange:    'transform',
      }}
    />
  )
}
