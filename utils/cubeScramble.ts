/**
 * utils/cubeScramble.ts — Rubik's cube scramble generators
 *
 * Pure module — no React, no DOM. Generates human-readable scramble
 * sequences for the speedsolving timer.
 *
 * NOTE ON SCRAMBLE QUALITY:
 *   These are **random-move** scrambles, the long-standing norm for hobby
 *   timers. They pick moves at random subject to simple adjacency rules
 *   (no same-face twice in a row, and axis-repeat avoidance where cheap).
 *   True WCA competition scrambles use random-STATE generation, which
 *   requires a full puzzle solver (e.g. two-phase / Kociemba) to guarantee
 *   a uniform-random, well-distributed solved state and a minimum move
 *   count. A solver is out of scope for this local-first timer, so
 *   random-move scrambles are used instead — they are more than adequate
 *   for practice and personal-best tracking.
 */

export type PuzzleId = '222' | '333' | '444' | 'pyraminx'

export const PUZZLE_LABELS: Record<PuzzleId, string> = {
  '222':      '2x2',
  '333':      '3x3',
  '444':      '4x4',
  'pyraminx': 'Pyraminx',
}

/** Ordered list for building selector UIs. */
export const PUZZLE_IDS: PuzzleId[] = ['222', '333', '444', 'pyraminx']

/* ── helpers ─────────────────────────────────────────────────────── */

/** Face → axis grouping for opposite-face awareness (U/D, L/R, F/B). */
const AXIS: Record<string, string> = {
  U: 'y', D: 'y',
  L: 'x', R: 'x',
  F: 'z', B: 'z',
}

const MODIFIERS = ['', "'", '2'] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Builds a cubic (NxN-style) random-move scramble.
 *
 * @param faces      allowed base faces (e.g. ['U','D','L','R','F','B'])
 * @param count      number of moves to emit
 * @param wideFaces  optional wide-move variants (e.g. ['Uw','Rw',…]); when
 *                   provided, each emitted move may randomly be a wide move.
 * @param avoidAxis  when true, avoid two moves in a row on the same axis
 *                   (reduces trivially-cancelling / redundant sequences).
 */
function cubicScramble(
  faces:     readonly string[],
  count:     number,
  wideFaces: readonly string[] = [],
  avoidAxis  = true,
): string {
  const moves: string[] = []
  let lastFace = ''
  let lastAxis = ''

  while (moves.length < count) {
    const face = pick(faces)
    // never the same base face twice in a row
    if (face === lastFace) continue
    // avoid axis-repeat where possible (best-effort; not enforced if it
    // would stall on tiny face sets like the 2x2's U/R/F)
    if (avoidAxis && AXIS[face] === lastAxis && faces.length > 3) continue

    // possibly upgrade to a wide move if a matching wide variant exists
    let base = face
    if (wideFaces.length && Math.random() < 0.4) {
      const wide = `${face}w`
      if (wideFaces.includes(wide)) base = wide
    }

    moves.push(base + pick(MODIFIERS))
    lastFace = face
    lastAxis = AXIS[face]
  }

  return moves.join(' ')
}

/**
 * Pyraminx random-move scramble: rotations from U/L/R/B (no '2' — a face
 * turn is 120°, so only '' and "'" are meaningful), no consecutive repeats,
 * followed by 0–4 lowercase tip moves (u/l/r/b).
 */
function pyraminxScramble(): string {
  const faces = ['U', 'L', 'R', 'B'] as const
  const tips  = ['u', 'l', 'r', 'b'] as const
  const mod   = ['', "'"] as const

  const moves: string[] = []
  let last = ''
  const bodyCount = 8 + Math.floor(Math.random() * 3) // 8–10 body moves
  while (moves.length < bodyCount) {
    const f = pick(faces)
    if (f === last) continue
    moves.push(f + pick(mod))
    last = f
  }

  // 0–4 tip moves, each a distinct tip (tips commute, so dedupe)
  const tipCount = Math.floor(Math.random() * 5)
  const usedTips = new Set<string>()
  while (usedTips.size < tipCount) {
    const t = pick(tips)
    if (usedTips.has(t)) continue
    usedTips.add(t)
    moves.push(t + pick(mod))
  }

  return moves.join(' ')
}

/* ── public API ──────────────────────────────────────────────────── */

/**
 * Generate a random-move scramble for the given puzzle.
 * See the module-level note on scramble quality.
 */
export function generateScramble(puzzle: PuzzleId): string {
  switch (puzzle) {
    case '222':
      // 11 moves from U R F only — standard 2x2 random-move length
      return cubicScramble(['U', 'R', 'F'], 11, [], false)
    case '333':
      // 20 moves from all six faces
      return cubicScramble(['U', 'D', 'L', 'R', 'F', 'B'], 20)
    case '444':
      // 46 moves, six faces + wide moves
      return cubicScramble(
        ['U', 'D', 'L', 'R', 'F', 'B'],
        46,
        ['Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'],
      )
    case 'pyraminx':
      return pyraminxScramble()
  }
}
