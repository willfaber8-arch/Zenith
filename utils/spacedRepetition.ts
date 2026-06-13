/**
 * Zenith OS — SM-2 Spaced Repetition Algorithm Utility
 * Phase 8 · Step 8.1 — Atomic Recall State Calculator
 *
 * Pure function — no React, no Dexie imports.
 * Takes the current card state + a user performance grade (0–5)
 * and returns a new card state with all SM-2 tracking fields updated.
 *
 * Algorithm reference: SuperMemo SM-2 (simplified Leitner variant)
 */

import type { VocabCard, RecallGrade } from '@/types/vocabulary'

/**
 * Calculate the next SM-2 card state after a user recall attempt.
 *
 * EF update formula:
 *   newEF = EF + (0.1 − (5 − grade) × (0.08 + (5 − grade) × 0.02))
 *   floored at 1.3 to prevent degenerate intervals.
 *
 * Interval schedule:
 *   grade < 3  → restart: interval = 1 day, successStreak = 0
 *   successes = 1 → 1 day
 *   successes = 2 → 6 days
 *   successes > 2 → round(previousInterval × newEF)
 *
 * Stability factor:
 *   A normalized 0–1 confidence metric derived from successStreak × EF
 *   for UI display purposes (not part of the SM-2 spec).
 */
export function calculateNextReviewCardState(
  card: VocabCard,
  grade: RecallGrade,
): VocabCard {
  // ── 1. Ease Factor update ──────────────────────────────────
  const delta  = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
  const newEF  = Math.max(1.3, card.easeFactor + delta)

  // ── 2. Consecutive success streak ─────────────────────────
  const newSuccesses = grade >= 3 ? card.consecutiveSuccesses + 1 : 0

  // ── 3. Review interval calculation ────────────────────────
  let newInterval: number
  if (grade < 3) {
    // Failed recall — restart the card from scratch
    newInterval = 1
  } else if (newSuccesses === 1) {
    newInterval = 1
  } else if (newSuccesses === 2) {
    newInterval = 6
  } else {
    // Growth phase: multiply previous interval by the updated ease factor
    newInterval = Math.round(card.reviewIntervalDays * newEF)
  }

  // ── 4. Next review timestamp ───────────────────────────────
  const nextReviewTimestamp = Date.now() + newInterval * 86_400_000

  // ── 5. Stability factor (0–1 confidence metric for the UI) ─
  // Asymptotes toward 1.0 as successes accumulate relative to a
  // reference EF of 2.5. Ten consecutive perfect reviews ≈ 1.0.
  const newStability = Math.min(
    1,
    (newSuccesses / 10) * (newEF / 2.5),
  )

  return {
    ...card,
    easeFactor:           newEF,
    consecutiveSuccesses: newSuccesses,
    reviewIntervalDays:   newInterval,
    nextReviewTimestamp,
    stabilityFactor:      newStability,
  }
}
