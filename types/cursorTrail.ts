/**
 * cursorTrail.ts — Phase 14.3 · Custom Mouse Cursor Trailing
 *
 * Particle entity physics matrix. Every active trail particle is
 * represented by a plain object conforming to this shape — no class
 * overhead, no prototype chain, just a mutable data bag that the RAF
 * loop mutates in-place each frame.
 */

export type TrailParticle = {
  x:         number   // Current X position in CSS pixels
  y:         number   // Current Y position in CSS pixels
  vx:        number   // Velocity X vector (px per frame)
  vy:        number   // Velocity Y vector (px per frame)
  alpha:     number   // Opacity tracking — starts ≤1.0, decays to 0
  size:      number   // Diameter in CSS pixels
  decayRate: number   // Alpha reduction per frame (~0.025–0.055)
}
