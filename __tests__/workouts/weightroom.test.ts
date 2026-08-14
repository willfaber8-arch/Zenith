/**
 * Strength-session maths.
 *
 * Pure, and the part that has to be right: volume is the one number
 * people watch move, and the logger's idea of "what's next" is what the
 * whole one-handed phone flow is built on.
 */

import {
  sessionVolumeKg, sessionSetCounts, isSessionComplete, nextSet,
  suggestedWeight, toKg,
  type StrengthSession, type WorkSet, type PlannedExercise,
} from '@/types/weightroom'

function set(over: Partial<WorkSet> = {}): WorkSet {
  return {
    id: Math.random().toString(36).slice(2),
    targetReps: 8, reps: null, weight: null, unit: 'kg', completed: false,
    ...over,
  }
}

function exercise(name: string, sets: WorkSet[]): PlannedExercise {
  return { id: name, name, muscleGroup: 'chest', sets }
}

function session(exercises: PlannedExercise[]): StrengthSession {
  return {
    id: 's1', title: 'Push', splitDay: 'Push', exercises,
    scheduledFor: '2026-08-14', createdAt: 0, updatedAt: 0,
  }
}

describe('toKg', () => {
  it('leaves kilograms alone', () => {
    expect(toKg(100, 'kg')).toBe(100)
  })
  it('converts pounds', () => {
    expect(Math.round(toKg(220, 'lb'))).toBe(100)
  })
})

describe('sessionVolumeKg', () => {
  it('multiplies reps by weight across every completed set', () => {
    const s = session([exercise('Bench', [
      set({ reps: 10, weight: 60, completed: true }),
      set({ reps: 8,  weight: 60, completed: true }),
    ])])
    expect(sessionVolumeKg(s)).toBe(10 * 60 + 8 * 60)
  })

  it('ignores sets that were planned but never done', () => {
    // A plan is not an achievement. Counting it would make the number go
    // up for doing nothing, which is the one thing it must never do.
    const s = session([exercise('Bench', [
      set({ reps: 10, weight: 60, completed: true }),
      set({ targetReps: 8 }),
    ])])
    expect(sessionVolumeKg(s)).toBe(600)
  })

  it('normalises a mixed-unit log', () => {
    const s = session([exercise('Row', [
      set({ reps: 10, weight: 50,  unit: 'kg', completed: true }),
      set({ reps: 10, weight: 110, unit: 'lb', completed: true }),
    ])])
    // 500kg + 10 x 49.9kg. Not 1000: 110lb is 49.9kg, not a round 50.
    expect(sessionVolumeKg(s)).toBe(999)
  })

  it('is zero for an untouched session', () => {
    expect(sessionVolumeKg(session([exercise('Bench', [set(), set()])]))).toBe(0)
  })

  it('counts a completed bodyweight set without inventing load', () => {
    const s = session([exercise('Push-up', [set({ reps: 20, weight: 0, completed: true })])])
    expect(sessionVolumeKg(s)).toBe(0)
    expect(sessionSetCounts(s).done).toBe(1)
  })
})

describe('sessionSetCounts / isSessionComplete', () => {
  it('counts across exercises', () => {
    const s = session([
      exercise('Bench', [set({ completed: true }), set()]),
      exercise('Fly',   [set({ completed: true })]),
    ])
    expect(sessionSetCounts(s)).toEqual({ done: 2, total: 3 })
    expect(isSessionComplete(s)).toBe(false)
  })

  it('is complete only when every set is ticked', () => {
    const s = session([exercise('Bench', [set({ completed: true }), set({ completed: true })])])
    expect(isSessionComplete(s)).toBe(true)
  })

  it('an empty session is not complete', () => {
    // Otherwise a session with no exercises would congratulate you.
    expect(isSessionComplete(session([]))).toBe(false)
  })
})

describe('nextSet', () => {
  it('returns the first unticked set in order', () => {
    const s = session([
      exercise('Bench', [set({ completed: true }), set({ targetReps: 6 })]),
      exercise('Fly',   [set()]),
    ])
    const n = nextSet(s)!
    expect(n.exercise.name).toBe('Bench')
    expect(n.set.targetReps).toBe(6)
    expect([n.exerciseIndex, n.setIndex]).toEqual([0, 1])
  })

  it('moves on to the next exercise once one is finished', () => {
    const s = session([
      exercise('Bench', [set({ completed: true })]),
      exercise('Fly',   [set()]),
    ])
    expect(nextSet(s)!.exercise.name).toBe('Fly')
  })

  it('returns null when everything is done, so the UI can close out', () => {
    const s = session([exercise('Bench', [set({ completed: true })])])
    expect(nextSet(s)).toBeNull()
  })

  it('skips back over a set ticked out of order', () => {
    // Tick set 2 first and set 1 is still what is owed.
    const s = session([exercise('Bench', [set(), set({ completed: true })])])
    expect(nextSet(s)!.setIndex).toBe(0)
  })
})

describe('suggestedWeight', () => {
  it('offers the previous set of the same exercise', () => {
    const s = session([exercise('Bench', [
      set({ weight: 60, unit: 'kg', completed: true }),
      set(),
    ])])
    expect(suggestedWeight(s, 0, 1)).toEqual({ weight: 60, unit: 'kg' })
  })

  it('reaches back past a set that was skipped', () => {
    const s = session([exercise('Bench', [
      set({ weight: 60, completed: true }), set(), set(),
    ])])
    expect(suggestedWeight(s, 0, 2)).toEqual({ weight: 60, unit: 'kg' })
  })

  it('offers nothing rather than guessing on the first set', () => {
    // Inventing a number here puts it under a barbell.
    const s = session([exercise('Bench', [set()])])
    expect(suggestedWeight(s, 0, 0)).toBeNull()
  })

  it('does not borrow a weight from a different exercise', () => {
    const s = session([
      exercise('Squat', [set({ weight: 100, completed: true })]),
      exercise('Curl',  [set()]),
    ])
    expect(suggestedWeight(s, 1, 0)).toBeNull()
  })
})
