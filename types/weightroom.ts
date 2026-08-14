/**
 * types/weightroom.ts — strength training.
 *
 * Separate from `CardioSession`, which records one number: how long you
 * moved. Strength is a nested thing — a session holds exercises, an
 * exercise holds sets, and a set is the unit that actually gets logged,
 * one at a time, usually on a phone, usually with one hand.
 *
 * That shape drives the schema. Sets are stored on the session rather
 * than in their own table: a session is always read whole, never queried
 * across, and keeping them inline means logging a set is one write to one
 * row instead of a transaction across two.
 */

/** The split a session belongs to. Free-form so nobody is boxed in. */
export type SplitDay = string

/** Preset splits offered when building a plan, in a sensible order. */
export const COMMON_SPLITS: readonly string[] = [
  'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body',
  'Chest', 'Back', 'Shoulders', 'Arms', 'Core',
]

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'other'

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'other',
]

/** Kilograms or pounds — stored per set, so a mixed gym still adds up. */
export type WeightUnit = 'kg' | 'lb'

/**
 * One set.
 *
 * `targetReps` is what the plan asked for; `reps` is what happened. Both
 * are kept because the gap between them is the whole point of a log —
 * collapsing them would throw away the only signal that says whether the
 * plan is too easy or too hard.
 */
export interface WorkSet {
  id:          string
  targetReps:  number
  /** Null until the set is actually done. */
  reps:        number | null
  weight:      number | null
  unit:        WeightUnit
  /** Marked done, even at zero weight — bodyweight sets are still sets. */
  completed:   boolean
  /** Seconds of rest the plan suggests after this set. */
  restSeconds?: number
  notes?:      string
}

export interface PlannedExercise {
  id:            string
  name:          string
  muscleGroup:   MuscleGroup
  sets:          WorkSet[]
  /** Free-text cue from the plan — "3s down, pause at the bottom". */
  cue?:          string
  supersetWith?: string
}

/**
 * A session: one workout, on one day, belonging to one split.
 *
 * Doubles as both the plan and the record. A session generated for next
 * Tuesday and the same session after it has been worked through are the
 * same row — `startedAt` is what distinguishes "planned" from "done", so
 * nothing has to be copied from a template into a log.
 */
export interface StrengthSession {
  id:          string
  planId?:     string
  title:       string
  splitDay:    SplitDay
  exercises:   PlannedExercise[]
  /** ISO "YYYY-MM-DD" — the day this is scheduled for. */
  scheduledFor: string
  /** UTC ms; unset means it has not been started. */
  startedAt?:   number
  completedAt?: number
  notes?:      string
  createdAt:   number
  updatedAt:   number
}

/** A named routine — several sessions that repeat on a weekly cycle. */
export interface WorkoutPlan {
  id:         string
  name:       string
  /** What the user asked the model for; kept so a plan can be regenerated. */
  brief?:     string
  /** Days per week the plan assumes. */
  daysPerWeek: number
  /** Where it came from, which matters when judging whether to trust it. */
  source:     'ai' | 'manual'
  createdAt:  number
  archived?:  0 | 1
}

/* ── Volume ────────────────────────────────────────────────────────── */

/** Pounds per kilogram, for normalising a mixed log. */
const LB_PER_KG = 2.2046226218

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight / LB_PER_KG
}

/**
 * Total load moved, in kilograms.
 *
 * Sets × reps × weight, counting only completed sets — a session that was
 * planned but not done has no volume, and counting it would make the one
 * number people track go up for doing nothing.
 */
export function sessionVolumeKg(session: StrengthSession): number {
  let total = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (!s.completed || s.reps == null || s.weight == null) continue
      total += s.reps * toKg(s.weight, s.unit)
    }
  }
  return Math.round(total)
}

export function sessionSetCounts(session: StrengthSession): { done: number; total: number } {
  let done = 0, total = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) { total++; if (s.completed) done++ }
  }
  return { done, total }
}

/** True once every set has been ticked — what closes a session out. */
export function isSessionComplete(session: StrengthSession): boolean {
  const { done, total } = sessionSetCounts(session)
  return total > 0 && done === total
}

/**
 * The set the logger should put in front of you next.
 *
 * First unticked set in order. Returns null when the session is done,
 * which is what the UI uses to swap the counter for a summary.
 */
export function nextSet(session: StrengthSession):
  { exercise: PlannedExercise; set: WorkSet; exerciseIndex: number; setIndex: number } | null {
  for (let i = 0; i < session.exercises.length; i++) {
    const ex = session.exercises[i]
    for (let j = 0; j < ex.sets.length; j++) {
      if (!ex.sets[j].completed) {
        return { exercise: ex, set: ex.sets[j], exerciseIndex: i, setIndex: j }
      }
    }
  }
  return null
}

/**
 * What to suggest for a set with no weight entered yet.
 *
 * The previous set of the same exercise, otherwise the last completed one
 * anywhere in the session. Guessing beyond that would be inventing a
 * number and putting it under a barbell.
 */
export function suggestedWeight(
  session: StrengthSession, exerciseIndex: number, setIndex: number,
): { weight: number; unit: WeightUnit } | null {
  const ex = session.exercises[exerciseIndex]
  if (!ex) return null

  for (let j = setIndex - 1; j >= 0; j--) {
    const s = ex.sets[j]
    if (s.weight != null) return { weight: s.weight, unit: s.unit }
  }
  for (let i = exerciseIndex - 1; i >= 0; i--) {
    for (const s of [...session.exercises[i].sets].reverse()) {
      if (s.weight != null && session.exercises[i].name === ex.name) {
        return { weight: s.weight, unit: s.unit }
      }
    }
  }
  return null
}
