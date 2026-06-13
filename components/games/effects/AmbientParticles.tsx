'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * AmbientParticles — Games Tab · Step 7.2
 * Dynamic Particles Override Module
 *
 * Gated by the `a2_particles` skill tree node (Branch A · Tier 2
 * of the aesthetic path).  Returns null — zero DOM, zero memory —
 * while the node is locked or while the IDB boot frame resolves.
 *
 * When unlocked, mounts a native RAF canvas loop with two layers:
 *
 *   Passive float layer (40 particles)
 *     Particles drift slowly upward with gentle horizontal wander.
 *     On crossing the top boundary they are re-seeded at the bottom
 *     with a fresh random x — no pop-in or teleporting artefact.
 *
 *   Mouse trail burst layer
 *     Up to 3 × intensityMultiplier short-lived particles fire from
 *     the cursor position on each debounced mousemove event (16 ms
 *     gate ≈ one burst per rendered frame).  Alpha decays linearly
 *     at decayRate per frame; exhausted particles are spliced out.
 *
 * Color synchronization
 *     `--accent-purple` is read from getComputedStyle every 60
 *     frames (≈ 1 s at 60 fps), so CosmeticShop theme switches
 *     propagate to particle tint without restarting the loop.
 *     The hex value is parsed to [r, g, b] integers; canvas
 *     fillStyle receives `rgba(r,g,b,alpha)` — never CSS functions,
 *     which the Canvas 2D API does not support.
 *
 * Lifecycle contract
 *     cancelAnimationFrame on unmount — zero RAF leak.
 *     removeEventListener on mousemove + resize — zero listener
 *     accumulation across tab navigation cycles.
 *
 * Placement note
 *     The canvas is `position: absolute; inset: 0`.  The caller's
 *     wrapper must carry `position: relative` (or any positioned
 *     value) so the overlay fills the correct layer.
 * ════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef } from 'react'
import { useLiveQuery }              from 'dexie-react-hooks'
import { gamesDb, type SkillTreeRecord } from '@/lib/gamesDb'
import styles from './AmbientParticles.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  EXPORTED INTERFACES  (spec-required signatures)
   ════════════════════════════════════════════════════════════════ */

/**
 * One particle in either the ambient float pool or the mouse trail
 * burst pool.  `decayRate` is only present for trail particles —
 * ambient particles maintain a fixed perpetual alpha.
 */
export interface KinematicParticle {
  x:          number
  y:          number
  vx:         number
  vy:         number
  radius:     number
  alpha:      number
  /** Linear alpha deduction per frame.  Trail bursts only. */
  decayRate?: number
}

/**
 * Props accepted by the public AmbientParticles component.
 * `intensityMultiplier` scales trail particle spawn count only —
 * ambient count is always the spec-defined constant 40.
 */
export interface AmbientParticlesProps {
  intensityMultiplier?: number
}

/* ════════════════════════════════════════════════════════════════
   §2  CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/**
 * skill_tree nodeId that unlocks the particle system.
 * Corresponds to Branch A · Tier 2 of the aesthetic path in
 * SkillTreeFirewall.ts.  The spec refers to this as
 * "cosmetic_particles_02"; the stored ID is `a2_particles`.
 */
const PARTICLE_SKILL_NODE = 'a2_particles' as const

/** Number of persistent ambient float particles. */
const AMBIENT_COUNT = 40

/**
 * Minimum milliseconds between trail-burst spawn events.
 * 16 ms ≈ one event per frame at 60 fps — smooth continuous trail
 * without spawning hundreds of particles from rapid mouse sweeps.
 */
const TRAIL_DEBOUNCE_MS = 16

/** Base trail particle spawn count before intensityMultiplier scaling. */
const TRAIL_SPAWN_BASE = 3

/**
 * Refresh CSS color state every N frames.
 * At 60 fps this is ≈ 1 second — fast enough to react to theme
 * changes from CosmeticShop without polling every frame.
 */
const COLOR_REFRESH_FRAMES = 60

/** Fallback [r, g, b] used when the CSS var cannot be parsed. */
const FALLBACK_RGB: readonly [number, number, number] = [124, 149, 255]

/* ════════════════════════════════════════════════════════════════
   §3  PURE HELPERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Parses a `#rrggbb` CSS color string into an [r, g, b] integer
 * tuple.  Returns FALLBACK_RGB for any malformed or empty input —
 * matches the default --accent-purple token value so the visual
 * result is always correct even before layout resolves.
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, '')
  if (cleaned.length < 6) return [...FALLBACK_RGB]
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return [
    Number.isNaN(r) ? FALLBACK_RGB[0] : r,
    Number.isNaN(g) ? FALLBACK_RGB[1] : g,
    Number.isNaN(b) ? FALLBACK_RGB[2] : b,
  ]
}

/**
 * Constructs one ambient float particle at a random position inside
 * the canvas bounds.  Alpha ceiling (0.25) keeps the overlay subtle
 * and non-distracting against Zenith's dark surface tokens.
 */
function spawnAmbient(W: number, H: number): KinematicParticle {
  return {
    x:      Math.random() * W,
    y:      Math.random() * H,
    vx:     (Math.random() - 0.5) * 0.18,         // ±0.09 px/frame lateral wander
    vy:     -(0.15 + Math.random() * 0.30),        // -0.15 → -0.45 px/frame upward
    radius: 1.0 + Math.random() * 1.5,             // 1.0–2.5 px
    alpha:  0.06 + Math.random() * 0.19,           // 0.06–0.25 — subtle presence
  }
}

/* ════════════════════════════════════════════════════════════════
   §4  INNER CANVAS COMPONENT
   ────────────────────────────────────────────────────────────────
   Only instantiated when the skill gate passes — never rendered
   in a dormant state.  Owns the entire RAF lifecycle: setup on
   mount, full teardown on unmount or intensityMultiplier change.
   ════════════════════════════════════════════════════════════════ */

interface ParticleCanvasProps {
  intensityMultiplier: number
}

function ParticleCanvas({ intensityMultiplier }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /* ── §4a  Canvas dimensions ───────────────────────────────────
       Read the CSS-laid-out bounding rect rather than the window so
       the canvas correctly fills its sub-pane container.  Both
       width/height attributes are floored integers to keep the draw
       buffer aligned with device pixels.                           */

    let W = 1
    let H = 1

    const syncSize = (): void => {
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, Math.floor(rect.width))
      H = Math.max(1, Math.floor(rect.height))
      canvas.width  = W
      canvas.height = H
    }
    syncSize()

    /* ── §4b  CSS color synchronization ──────────────────────────
       getComputedStyle on the canvas element resolves CSS variables
       through the full cascade, including overrides applied by
       CosmeticShop's applyThemeCssVars() on document.documentElement.
       The hex result is immediately parsed to integer RGB so that
       fillStyle construction inside the hot render loop is pure
       string interpolation — no CSS parsing in canvas draw calls.  */

    let colorRgb: [number, number, number] = [...FALLBACK_RGB]

    const refreshColor = (): void => {
      const raw = getComputedStyle(canvas)
        .getPropertyValue('--accent-purple')
        .trim()
      colorRgb = hexToRgb(raw)
    }
    refreshColor()

    /* ── §4c  Ambient float pool ──────────────────────────────────
       Fixed pool of AMBIENT_COUNT particles rebuilt from scratch on
       each resize so all particles sit within the new canvas bounds.
       Pool is a plain array — no React state, no re-render cost.   */

    const ambient: KinematicParticle[] = []

    const buildAmbient = (): void => {
      ambient.length = 0
      for (let i = 0; i < AMBIENT_COUNT; i++) {
        ambient.push(spawnAmbient(W, H))
      }
    }
    buildAmbient()

    /* ── §4d  Trail burst pool ────────────────────────────────────
       Appended by mousemove; iterated in reverse so splice() never
       skips the next element after a removal.                      */

    const trails: KinematicParticle[] = []

    /* ── §4e  Mouse trail handler ─────────────────────────────────
       Rate-limited to TRAIL_DEBOUNCE_MS (≈ one event per rendered
       frame at 60 fps) so rapid cursor sweeps don't flood the trail
       pool.  Mouse coordinates are translated from client viewport
       space to canvas-local space via getBoundingClientRect — works
       correctly for sub-pane canvases that are offset from the
       viewport origin.  Out-of-bounds positions are discarded.    */

    let lastTrailMs = 0

    const handleMouseMove = (e: MouseEvent): void => {
      const now = performance.now()
      if (now - lastTrailMs < TRAIL_DEBOUNCE_MS) return
      lastTrailMs = now

      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      if (mx < 0 || mx > W || my < 0 || my > H) return

      const spawnN = Math.max(1, Math.ceil(TRAIL_SPAWN_BASE * intensityMultiplier))

      for (let i = 0; i < spawnN; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.8 + Math.random() * 2.2     // 0.8–3.0 px/frame outward
        trails.push({
          x:         mx,
          y:         my,
          vx:        Math.cos(angle) * speed,
          vy:        Math.sin(angle) * speed,
          radius:    1.5 + Math.random() * 2.0,     // 1.5–3.5 px
          alpha:     0.50 + Math.random() * 0.20,   // 0.50–0.70
          decayRate: 0.016 + Math.random() * 0.010, // dies in ~20–40 frames
        })
      }
    }

    /* ── §4f  Resize handler ──────────────────────────────────────
       Syncs canvas attribute dimensions to the CSS layout size and
       rebuilds the ambient pool so no particles sit outside bounds. */

    const onResize = (): void => {
      syncSize()
      buildAmbient()
    }

    /* ── §4g  RAF render loop ─────────────────────────────────────
       Single loop body drawing both particle layers per frame.

       Ambient: advance position, wrap horizontally, reset on top
       exit (y < -radius) by teleporting to the bottom with a new
       random x — visually seamless since the particle was invisible
       above the canvas edge.

       Trail: advance position, decay alpha, splice on exhaustion.
       Reverse iteration avoids index-shift bugs after each splice.  */

    let rafId  = 0
    let frameN = 0

    const tick = (): void => {
      frameN++

      // Periodic CSS color re-read — picks up theme switches
      if (frameN % COLOR_REFRESH_FRAMES === 0) refreshColor()

      ctx.clearRect(0, 0, W, H)

      const [cr, cg, cb] = colorRgb

      /* ── Ambient float layer ─────────────────────────────────── */
      for (const p of ambient) {
        p.x += p.vx
        p.y += p.vy

        // Horizontal wrap: exit right → enter left, and vice versa
        if (p.x < -p.radius)    p.x = W + p.radius
        if (p.x > W + p.radius) p.x = -p.radius

        // Vertical reset: exit top → re-seed at bottom with random x
        if (p.y + p.radius < 0) {
          p.y = H + p.radius
          p.x = Math.random() * W
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.alpha.toFixed(3)})`
        ctx.fill()
      }

      /* ── Trail burst layer ───────────────────────────────────── */
      for (let i = trails.length - 1; i >= 0; i--) {
        const p = trails[i]

        p.x    += p.vx
        p.y    += p.vy
        p.alpha -= p.decayRate!

        if (p.alpha <= 0) {
          trails.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(p.alpha, 1).toFixed(3)})`
        ctx.fill()
      }

      rafId = requestAnimationFrame(tick)
    }

    /* ── §4h  Event binding ───────────────────────────────────────
       The canvas carries pointer-events: none so mouse events are
       received by the parent element.  Capturing from parentElement
       matches the spec ("parent shell view container") and keeps the
       listener scoped to the Games Tab pane rather than the whole
       document.  window.resize handles pane-size changes that don't
       change the window (e.g., biosphere pane collapse on mobile).  */

    const parent = canvas.parentElement

    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove, { passive: true })
    }

    window.addEventListener('resize', onResize, { passive: true })
    rafId = requestAnimationFrame(tick)

    /* ── §4i  Teardown ────────────────────────────────────────────
       All three resource classes released in order:
         1. cancelAnimationFrame — stops the render loop immediately.
         2. removeEventListener (mousemove) — the same reference used
            at binding time, captured in the parent closure.
         3. removeEventListener (resize) — paired symmetrically.
       No ambient[] or trails[] cleanup needed: GC handles the arrays
       when the effect closure is released.                         */

    return () => {
      cancelAnimationFrame(rafId)

      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove)
      }

      window.removeEventListener('resize', onResize)
    }

  }, [intensityMultiplier])
  // intensityMultiplier in deps: re-runs if caller changes the
  // spawn multiplier — restarts the loop with the new spawn count.

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  )
}

/* ════════════════════════════════════════════════════════════════
   §5  GATING WRAPPER — DEFAULT EXPORT
   ════════════════════════════════════════════════════════════════ */

/**
 * AmbientParticles — the exported surface.
 *
 * Reactively checks the `skill_tree` table via useLiveQuery.
 * Returns null when the `a2_particles` node is locked, absent, or
 * while the IDB boot frame is resolving — zero DOM cost in all
 * dormant states.  If the player unlocks the node while this is
 * mounted, the particles start automatically on the next render
 * without any page reload.
 *
 * @example
 * ```tsx
 * // Wrapper must carry position: relative (or absolute/fixed)
 * // so the canvas's `absolute inset-0` fills the right layer.
 * <div style={{ position: 'relative', overflow: 'hidden' }}>
 *   <AmbientParticles intensityMultiplier={1} />
 *   {/* UI content renders above z-index: 0 canvas *\/}
 * </div>
 * ```
 */
export default function AmbientParticles({
  intensityMultiplier = 1,
}: AmbientParticlesProps = {}) {

  const skillRecord = useLiveQuery<SkillTreeRecord | undefined>(
    // Optional-chain guards SSR (gamesDb is null on the server).
    // The ?? Promise.resolve(undefined) satisfies useLiveQuery's
    // requirement for a Promise even when gamesDb is null.
    () => gamesDb?.skill_tree.get(PARTICLE_SKILL_NODE) ?? Promise.resolve(undefined),
    [],
  )

  // Dormant in the boot frame (undefined), when node is absent
  // (undefined), or when explicitly locked (isUnlocked !== true).
  const isEnabled = skillRecord?.isUnlocked === true

  if (!isEnabled) return null

  return <ParticleCanvas intensityMultiplier={intensityMultiplier} />
}
