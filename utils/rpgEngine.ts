/**
 * utils/rpgEngine.ts — Zenith OS RPG Lifecycle Engine: Pure Math Core
 * Phase 5 · Step 5.1 — Grit-Style Habit Stacking & RPG Lifecycle Engine
 *
 * Zero external dependencies — no React, no Dexie.
 * All functions are deterministic and safe to call in any context.
 */

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

export type HabitDifficulty    = 'easy' | 'medium' | 'hard'
export type AssignmentPriority = 'low' | 'medium' | 'high' | 'critical'

/** Minimal profile fields consumed by the math engine. */
export interface ProfileSnapshot {
  expPoints:    number
  currentLevel: number
  healthPoints: number
}

/** Return value from all atomic progression handlers. */
export interface ProgressResult extends ProfileSnapshot {
  /** True when at least one level threshold was crossed. */
  leveledUp:   boolean
  /**
   * The level the character was at when defeat triggered (HP ≤ 0).
   * Undefined when no defeat occurred this call.
   */
  defeatedAt?: number
}

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

/** Full HP value on a fresh profile or after leveling up. */
export const HP_MAX            = 100

/** HP floor after a defeat — partial restore to keep the run alive. */
export const HP_RESTORE_DEFEAT = 50

/** Flat HP damage applied for each overdue high-priority assignment. */
export const OVERDUE_HP_DAMAGE = 20

/** Fraction of the current level's EXP threshold lost on defeat. */
export const XP_DEFEAT_PENALTY = 0.20

/* ════════════════════════════════════════════════════════════════
   EXP THRESHOLD EQUATION
   ────────────────────────────────────────────────────────────────
   Progressive quadratic curve — each level demands more than
   the last so early gains feel quick and late gains feel earned.

     EXP_Required = 100 × Level^1.5

   Level   1 →   100 XP
   Level   5 →  1118 XP
   Level  10 →  3163 XP
   Level  20 →  8944 XP
   ════════════════════════════════════════════════════════════════ */

export function expRequired(level: number): number {
  return Math.ceil(100 * Math.pow(level, 1.5))
}

/* ════════════════════════════════════════════════════════════════
   POINT ALLOCATION — HABIT COMPLETION
   ════════════════════════════════════════════════════════════════ */

function habitXpBase(difficulty: HabitDifficulty): number {
  switch (difficulty) {
    case 'easy':   return 10
    case 'medium': return 25
    case 'hard':   return 50
  }
}

/**
 * Total XP to award for a single habit completion.
 * Applies a strict 1.5× bonus when `streakCount` is a nonzero
 * multiple of 7 — the weekly discipline milestone.
 */
export function habitXp(
  difficulty:  HabitDifficulty,
  streakCount: number,
): number {
  const base = habitXpBase(difficulty)
  const mul  = streakCount > 0 && streakCount % 7 === 0 ? 1.5 : 1.0
  return Math.round(base * mul)
}

/* ════════════════════════════════════════════════════════════════
   POINT ALLOCATION — ASSIGNMENT COMPLETION
   ════════════════════════════════════════════════════════════════ */

/** XP awarded when an assignment transitions to "completed". */
export function assignmentXp(priority: AssignmentPriority): number {
  switch (priority) {
    case 'low':      return 15
    case 'medium':   return 30
    case 'high':
    case 'critical': return 75
  }
}

/* ════════════════════════════════════════════════════════════════
   ATOMIC PROGRESSION HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * Award XP to a profile snapshot.
 *
 * Cascades through multiple level-up thresholds if the XP gain is
 * large enough. On each level crossed:
 *   • EXP remainder carries forward into the new level.
 *   • currentLevel increments by 1.
 *   • healthPoints fully restores to HP_MAX (100).
 */
export function applyXpGain(
  profile: ProfileSnapshot,
  amount:  number,
): ProgressResult {
  let { expPoints, currentLevel, healthPoints } = profile
  let leveledUp = false

  expPoints += amount

  while (expPoints >= expRequired(currentLevel)) {
    expPoints    -= expRequired(currentLevel)
    currentLevel += 1
    healthPoints  = HP_MAX
    leveledUp     = true
  }

  return { expPoints, currentLevel, healthPoints, leveledUp }
}

/**
 * Apply HP damage to a profile snapshot.
 *
 * Defeat condition (healthPoints ≤ 0):
 *   • healthPoints resets to HP_RESTORE_DEFEAT (50).
 *   • expPoints are penalised by XP_DEFEAT_PENALTY (20%) of the
 *     current level's EXP threshold — floor prevents float drift.
 *   • `defeatedAt` is set to the level at which defeat triggered.
 */
export function applyHpDamage(
  profile: ProfileSnapshot,
  damage:  number,
): ProgressResult {
  let { expPoints, currentLevel, healthPoints } = profile
  let defeatedAt: number | undefined

  healthPoints -= damage

  if (healthPoints <= 0) {
    defeatedAt    = currentLevel
    const penalty = Math.floor(expRequired(currentLevel) * XP_DEFEAT_PENALTY)
    expPoints     = Math.max(0, expPoints - penalty)
    healthPoints  = HP_RESTORE_DEFEAT
  }

  return { expPoints, currentLevel, healthPoints, leveledUp: false, defeatedAt }
}
