/**
 * ════════════════════════════════════════════════════════════════
 * RefineScoreEvaluator — Step 3.3
 * Mine Refiner · Pure Scoring Engine
 *
 * Converts a completed Minesweeper session into a resource payout
 * summary using strict integer arithmetic to prevent floating-point
 * boundary errors. No React, no DOM, no Dexie — plain TypeScript.
 *
 * Payout formula:
 *   rawSpent     = correctFlags × 10
 *   penalty      = incorrectFlags × 2
 *   refinedYield = max(0, rawSpent − penalty)
 *
 * Victory vs detonation scoring:
 *   Victory    → correctFlags = totalMines (all mines successfully
 *                avoided; the board outcome verifies all mines).
 *                incorrectFlags still penalises wrong anchors.
 *   Detonated  → correctFlags = only player-placed flags on real mines.
 *
 * isStorageCapped / discardedOverflow in RefineScoreSummary are
 * initialised to false/0 here. The caller should populate them after
 * receiving the addResources() return value from useZenithEconomy.
 * ════════════════════════════════════════════════════════════════
 */

/* ════════════════════════════════════════════════════════════════
   §1  PUBLIC INTERFACES
   ════════════════════════════════════════════════════════════════ */

/**
 * Snapshot of the game outcome captured at the moment the board ends.
 * Produced by `computeRefineOutcome` from the final grid state.
 */
export interface RefineSessionOutcome {
  /** Discriminator — identifies this result as a Mine Refiner session. */
  readonly gameId: 'gal_mines'
  /** Total mines seeded into the board for this session. */
  readonly totalMines: number
  /**
   * F_true: flags correctly placed on mine coordinates.
   * On a victory this equals totalMines (all mines validated by the win).
   * On a detonation this is only the player-placed correct flags.
   */
  readonly correctFlags: number
  /**
   * F_false: flags incorrectly placed on safe cells.
   * Each costs 2 units from the payout (efficiency penalty).
   */
  readonly incorrectFlags: number
  /** Session wall-clock duration in whole seconds (integer). */
  readonly elapsedSeconds: number
  /** How the session ended. */
  readonly terminationStatus: 'victory' | 'detonated'
}

/**
 * Economic summary computed from a RefineSessionOutcome.
 * Produced by `computeRefineSummary`.
 *
 * `isStorageCapped` and `discardedOverflow` should be updated by the
 * caller after the `addResources()` write confirms the inventory state.
 * Until then they default to false/0 (pre-collection placeholders).
 */
export interface RefineScoreSummary {
  /** Gross yield before penalty deduction (correctFlags × 10). */
  rawSpent: number
  /** Net resource payout after penalty. Floor at 0. */
  refinedYield: number
  /**
   * Ratio of refinedYield to rawSpent in the range [0.0, 1.0].
   * 1.0 = perfect run (no wrong flags). 0.0 = fully penalised.
   * Stored as a pre-multiplied integer: 1000 = 100.0%, 750 = 75.0%.
   * Use `fmtEfficiency()` to render as a display string.
   */
  efficiencyPermille: number
  /**
   * True when adding `refinedYield` to the inventory hit the storage
   * ceiling. Populated by the caller after `addResources()` returns.
   */
  isStorageCapped: boolean
  /**
   * Units incinerated by the storage cap. Populated by the caller after
   * `addResources()` returns. Zero until then.
   */
  discardedOverflow: number
}

/* ════════════════════════════════════════════════════════════════
   §2  INTERNAL TYPES
   ════════════════════════════════════════════════════════════════ */

/**
 * Minimal cell shape required by this engine.
 * `MinesweeperCell` satisfies this structurally — no import needed.
 */
interface GridCellSnapshot {
  readonly isMine: boolean
  readonly isFlagged: boolean
  /** True when this cell is flagged AND contains a mine. */
  readonly isRefineLocked: boolean
}

/* ════════════════════════════════════════════════════════════════
   §3  CORE COMPUTATION  — computeRefineOutcome
   ════════════════════════════════════════════════════════════════ */

/**
 * Scans a flattened grid snapshot to count correct and incorrect flag
 * placements, then packages the session outcome.
 *
 * @param cells            Flattened grid at game-over moment (grid.flat()).
 * @param totalMines       Mine count for this session.
 * @param elapsedSeconds   Integer seconds elapsed since first click.
 * @param terminationStatus  How the game ended.
 *
 * Time complexity: O(n) — one pass over the 100-cell flat array.
 */
export function computeRefineOutcome(
  cells: GridCellSnapshot[],
  totalMines: number,
  elapsedSeconds: number,
  terminationStatus: 'victory' | 'detonated',
): RefineSessionOutcome {
  // Integer seconds — truncate any sub-second remainder
  const wholeSeconds = Math.max(0, Math.floor(elapsedSeconds))

  let playerCorrectFlags = 0
  let incorrectFlags     = 0

  for (const cell of cells) {
    if (!cell.isFlagged) continue
    // isRefineLocked is set true only when the player flags an actual mine
    if (cell.isRefineLocked) {
      playerCorrectFlags++
    } else {
      incorrectFlags++
    }
  }

  /*
   * Victory outcome: by clearing the board the player has implicitly
   * identified every mine (none detonated). Credit all mines as correct
   * so a no-flag clear still earns full yield — wrong anchors still penalise.
   *
   * Detonation outcome: only count what the player explicitly flagged
   * correctly before hitting the mine.
   */
  const correctFlags =
    terminationStatus === 'victory'
      ? totalMines
      : playerCorrectFlags

  return {
    gameId:            'gal_mines',
    totalMines,
    correctFlags,
    incorrectFlags,
    elapsedSeconds:    wholeSeconds,
    terminationStatus,
  }
}

/* ════════════════════════════════════════════════════════════════
   §4  PAYOUT COMPUTATION  — computeRefineSummary
   ════════════════════════════════════════════════════════════════ */

/**
 * Converts a RefineSessionOutcome into an economic payout summary.
 *
 * All arithmetic uses integer operations — multiplication, subtraction,
 * and Math.max/Math.floor — with no division that could accumulate
 * floating-point error. The only division is in `efficiencyPermille`
 * where the result is immediately truncated to an integer.
 *
 * Storage fields (isStorageCapped, discardedOverflow) default to
 * false/0 and should be updated by the caller after addResources().
 */
export function computeRefineSummary(
  outcome: RefineSessionOutcome,
): RefineScoreSummary {
  // ── Payout formula (integer arithmetic) ──────────────────────
  // rawSpent: base units from correctly identified mines
  const rawSpent = outcome.correctFlags * 10     // exactinteger, no float

  // penalty: deduction per incorrectly placed anchor flag
  const penalty = outcome.incorrectFlags * 2     // exact integer

  // refinedYield: floor at 0 — a heavily penalised session earns 0, not negative
  const refinedYield = Math.max(0, rawSpent - penalty)

  // ── Efficiency permille (integer, 0–1000) ─────────────────────
  // Represent efficiency as parts-per-thousand to avoid float:
  //   1000 = 100.0%, 950 = 95.0%, 0 = 0.0%
  // Truncate (Math.floor) not round — player gets the conservative value.
  const efficiencyPermille =
    rawSpent > 0
      ? Math.min(1000, Math.floor((refinedYield * 1000) / rawSpent))
      : 0

  return {
    rawSpent,
    refinedYield,
    efficiencyPermille,
    isStorageCapped:   false,
    discardedOverflow: 0,
  }
}

/* ════════════════════════════════════════════════════════════════
   §5  DISPLAY UTILITIES
   ════════════════════════════════════════════════════════════════ */

/**
 * Formats an efficiency permille (0–1000) as a human-readable string.
 * Uses integer arithmetic — no floating-point formatting.
 *
 * @example
 *   fmtEfficiency(1000) → "100.0%"
 *   fmtEfficiency(950)  → "95.0%"
 *   fmtEfficiency(667)  → "66.7%"
 *   fmtEfficiency(0)    → "0.0%"
 */
export function fmtEfficiency(permille: number): string {
  const clamped = Math.min(1000, Math.max(0, Math.floor(permille)))
  const whole   = Math.floor(clamped / 10)
  const frac    = clamped % 10
  return `${whole}.${frac}%`
}

/**
 * Formats an elapsed-second count as a zero-padded MM:SS string.
 * Both components are integer-divided — no float operations.
 *
 * @example
 *   fmtElapsed(0)   → "00:00"
 *   fmtElapsed(75)  → "01:15"
 *   fmtElapsed(600) → "10:00"
 */
export function fmtElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
