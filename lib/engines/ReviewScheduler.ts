/**
 * lib/engines/ReviewScheduler.ts — SM-2 spaced repetition.
 *
 * Pure: no React, no Dexie, no clock of its own (callers pass `now`).
 * Mirrors the RefineScoreEvaluator pattern so it can be unit-tested in
 * isolation and reused by any domain that needs review scheduling.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────
 *
 * `VocabCard` already declared `easeFactor`, `reviewIntervalDays`,
 * `consecutiveSuccesses` and `nextReviewTimestamp`, which reads as a
 * working SM-2 implementation. It was not one:
 *
 *   · `nextReviewTimestamp` was written ONLY at card creation
 *     (`Date.now()`, or `0` meaning "immediately due").
 *   · The grading path adjusted `consecutiveSuccesses`, `easeFactor` and
 *     `stabilityFactor` — and never recomputed an interval or a date.
 *   · Yet `nextReviewTimestamp` is read as "due" in VocabBuilderView,
 *     StatsView and VocabWidget.
 *
 * Net effect: every card was permanently due, and the due counts on the
 * dashboard never fell no matter how much the user studied. What existed
 * was a mastery heuristic, not scheduling.
 *
 * This module is the real thing, written once so vocabulary and problem
 * sets share it rather than growing a second half-implementation.
 */

/* ── Grades ────────────────────────────────────────────────────────── */

/**
 * SM-2 performance grade.
 *
 *   0 — total blackout            3 — correct, but a real struggle
 *   1 — wrong; recognised answer  4 — correct after hesitation
 *   2 — wrong; felt close         5 — instant and certain
 *
 * 3 is the pass mark: below it the card resets, at or above it the
 * interval grows.
 */
export type RecallGrade = 0 | 1 | 2 | 3 | 4 | 5

export const PASS_GRADE = 3 as const

/* ── Constants ─────────────────────────────────────────────────────── */

export const DEFAULT_EASE_FACTOR = 2.5
export const MIN_EASE_FACTOR     = 1.3
/** Ease is capped so a run of perfect grades cannot push a card years out. */
export const MAX_EASE_FACTOR     = 3.0

export const FIRST_INTERVAL_DAYS  = 1
export const SECOND_INTERVAL_DAYS = 6
/** Ten years. Guards against overflow and absurd dates on long streaks. */
export const MAX_INTERVAL_DAYS    = 3650

const MS_PER_DAY = 86_400_000

/* ── Types ─────────────────────────────────────────────────────────── */

/** The scheduling state a card carries. Domain-agnostic on purpose. */
export interface SchedulingState {
  easeFactor:           number
  reviewIntervalDays:   number
  consecutiveSuccesses: number
}

export interface ScheduleResult extends SchedulingState {
  /** UTC ms when this card next becomes due. */
  nextReviewAt: number
}

/* ── Engine ────────────────────────────────────────────────────────── */

/**
 * The SM-2 ease adjustment.
 *
 *   EF' = EF + (0.1 − (5−g) × (0.08 + (5−g) × 0.02))
 *
 * Grade 4 leaves ease unchanged; 5 raises it, ≤3 lowers it. Clamped to
 * [MIN, MAX] — the published algorithm floors at 1.3 but has no ceiling,
 * which lets a perfectly-answered card drift to absurd intervals.
 */
export function adjustEase(easeFactor: number, grade: RecallGrade): number {
  const g = grade
  const next = easeFactor + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02))
  return clamp(round2(next), MIN_EASE_FACTOR, MAX_EASE_FACTOR)
}

/**
 * Compute the next review from a grade.
 *
 * A failure (`grade < 3`) resets the interval to one day and clears the
 * success streak, but only *reduces* ease rather than resetting it — a
 * card you have known for months and blank on once should not be treated
 * as brand new.
 *
 * `now` is a parameter rather than read from the clock so this stays pure
 * and testable, and so a caller batching many cards stamps them all with
 * the same instant.
 */
export function scheduleNext(
  state: SchedulingState,
  grade: RecallGrade,
  now: number,
): ScheduleResult {
  const easeFactor = adjustEase(state.easeFactor || DEFAULT_EASE_FACTOR, grade)

  if (grade < PASS_GRADE) {
    return {
      easeFactor,
      reviewIntervalDays:   FIRST_INTERVAL_DAYS,
      consecutiveSuccesses: 0,
      nextReviewAt:         now + FIRST_INTERVAL_DAYS * MS_PER_DAY,
    }
  }

  const successes = state.consecutiveSuccesses + 1

  let intervalDays: number
  if (successes === 1) {
    intervalDays = FIRST_INTERVAL_DAYS
  } else if (successes === 2) {
    intervalDays = SECOND_INTERVAL_DAYS
  } else {
    const prev = state.reviewIntervalDays > 0
      ? state.reviewIntervalDays
      : SECOND_INTERVAL_DAYS
    intervalDays = Math.round(prev * easeFactor)
  }

  intervalDays = clamp(intervalDays, FIRST_INTERVAL_DAYS, MAX_INTERVAL_DAYS)

  return {
    easeFactor,
    reviewIntervalDays:   intervalDays,
    consecutiveSuccesses: successes,
    nextReviewAt:         now + intervalDays * MS_PER_DAY,
  }
}

/** A fresh card: due immediately, default ease, no history. */
export function initialState(now: number): ScheduleResult {
  return {
    easeFactor:           DEFAULT_EASE_FACTOR,
    reviewIntervalDays:   0,
    consecutiveSuccesses: 0,
    nextReviewAt:         now,
  }
}

/* ── Backfill ──────────────────────────────────────────────────────── */

/**
 * Give an existing card a plausible first due-date.
 *
 * Needed because cards created before real scheduling existed all carry
 * `nextReviewTimestamp` of `0` or their creation time — i.e. every one of
 * them is due. Dropping them all in at once would replace a broken count
 * with an unusable one.
 *
 * The interval is derived from `consecutiveSuccesses`, so a card answered
 * correctly six times lands further out than one never passed. This is an
 * estimate, not recovered history — but it is a *defensible* estimate,
 * and it makes the due count immediately reflect what the user knows.
 *
 * `spreadIndex` fans same-mastery cards across consecutive days so a deck
 * of 200 evenly-known cards does not all resurface on one date.
 */
export function backfillState(
  card: { consecutiveSuccesses?: number; easeFactor?: number },
  now: number,
  spreadIndex = 0,
): ScheduleResult {
  const successes  = Math.max(0, card.consecutiveSuccesses ?? 0)
  const easeFactor = clamp(
    card.easeFactor || DEFAULT_EASE_FACTOR,
    MIN_EASE_FACTOR,
    MAX_EASE_FACTOR,
  )

  // Replay the interval ladder for the successes the card already has.
  let intervalDays = 0
  for (let i = 1; i <= successes; i++) {
    if (i === 1)      intervalDays = FIRST_INTERVAL_DAYS
    else if (i === 2) intervalDays = SECOND_INTERVAL_DAYS
    else              intervalDays = Math.round(intervalDays * easeFactor)
  }
  intervalDays = clamp(intervalDays, 0, MAX_INTERVAL_DAYS)

  // Never-passed cards stay due now — they genuinely need studying.
  // Everything else is offset, with a spread so a whole tier doesn't
  // land on the same morning.
  const offsetDays = intervalDays === 0
    ? 0
    : clamp(intervalDays + (spreadIndex % 3), 0, MAX_INTERVAL_DAYS)

  return {
    easeFactor,
    reviewIntervalDays:   intervalDays,
    consecutiveSuccesses: successes,
    nextReviewAt:         now + offsetDays * MS_PER_DAY,
  }
}

/* ── Queries ───────────────────────────────────────────────────────── */

export function isDue(nextReviewAt: number, now: number): boolean {
  return nextReviewAt <= now
}

/** Human label for a due date: "Due now", "Tomorrow", "In 12 days". */
export function formatDue(nextReviewAt: number, now: number): string {
  if (nextReviewAt <= now) return 'Due now'
  const days = Math.ceil((nextReviewAt - now) / MS_PER_DAY)
  if (days === 1) return 'Tomorrow'
  if (days < 30)  return `In ${days} days`
  const months = Math.round(days / 30)
  return months === 1 ? 'In a month' : `In ${months} months`
}

/* ── Utils ─────────────────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Two decimals — keeps ease factors readable and comparisons exact. */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}
