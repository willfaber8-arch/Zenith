/**
 * Parsing a model's answer into a training plan.
 *
 * This is the fragile half of AI plan generation, so it is tested
 * without a provider. A model asked for JSON returns it wrapped in
 * prose, or a fence, or both; answers "3-4" where a number was asked
 * for; and invents fields nobody requested.
 *
 * The rule these tests exist to hold: never invent a number that ends up
 * under a barbell.
 */

import {
  extractJson, firstInt, parseWorkoutPlan, buildPlanPrompt, _resetIdSeq,
} from '@/lib/engines/workoutPlanParser'

beforeEach(() => _resetIdSeq())

const GOOD = {
  name: 'Upper / Lower',
  days: [
    { title: 'Upper A', splitDay: 'Upper', exercises: [
      { name: 'Bench Press', muscleGroup: 'chest', sets: 4, reps: 8, restSeconds: 120, cue: 'Pause on the chest' },
      { name: 'Barbell Row', muscleGroup: 'back', sets: 4, reps: 8 },
    ] },
    { title: 'Lower A', splitDay: 'Lower', exercises: [
      { name: 'Back Squat', muscleGroup: 'quads', sets: 5, reps: 5 },
    ] },
  ],
}

describe('extractJson', () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('reads it out of a fenced block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('reads it out of surrounding prose', () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 })
  })

  it('keeps nested objects whole', () => {
    // A greedy regex takes the first closing brace and truncates here.
    expect(extractJson('noise {"a":{"b":2},"c":3} noise')).toEqual({ a: { b: 2 }, c: 3 })
  })

  it('is not fooled by braces inside strings', () => {
    expect(extractJson('{"a":"} not the end {","b":1}')).toEqual({ a: '} not the end {', b: 1 })
  })

  it('returns null rather than throwing on rubbish', () => {
    expect(extractJson('no json at all')).toBeNull()
    expect(extractJson('{ broken')).toBeNull()
    expect(extractJson('')).toBeNull()
  })
})

describe('firstInt', () => {
  it('takes a number as given', () => {
    expect(firstInt(4, 3)).toBe(4)
  })

  it('takes the lower bound of a range', () => {
    // "3-4 sets" is the single most common thing a model returns. The
    // lower bound is what you can definitely do, and a plan that asks
    // slightly too little is recoverable in a way that too much is not.
    expect(firstInt('3-4', 3)).toBe(3)
    expect(firstInt('8-12 reps', 8)).toBe(8)
  })

  it('falls back when there is no number at all', () => {
    expect(firstInt('as many as possible', 8)).toBe(8)
    expect(firstInt(undefined, 3)).toBe(3)
    expect(firstInt(null, 3)).toBe(3)
  })

  it('never returns zero or negative', () => {
    expect(firstInt(0, 3)).toBe(1)
    expect(firstInt(-5, 3)).toBe(1)
  })
})

describe('parseWorkoutPlan', () => {
  it('builds sessions with the right set counts', () => {
    const plan = parseWorkoutPlan(JSON.stringify(GOOD))!
    expect(plan.name).toBe('Upper / Lower')
    expect(plan.sessions).toHaveLength(2)
    expect(plan.sessions[0].exercises[0].sets).toHaveLength(4)
    expect(plan.sessions[0].exercises[0].sets[0].targetReps).toBe(8)
    expect(plan.sessions[1].exercises[0].sets).toHaveLength(5)
  })

  it('NEVER fills in a weight', () => {
    // The one rule. A model does not know what this person can lift, and
    // a number here would arrive looking exactly as authoritative as one
    // the user set themselves.
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x',
      days: [{ title: 'A', exercises: [{ name: 'Bench', sets: 3, reps: 5, weight: 100, load: '80kg' }] }],
    }))!
    for (const s of plan.sessions[0].exercises[0].sets) {
      expect(s.weight).toBeNull()
      expect(s.reps).toBeNull()          // nothing is pre-completed either
      expect(s.completed).toBe(false)
    }
  })

  it('normalises muscle groups, including synonyms', () => {
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x', days: [{ title: 'A', exercises: [
        { name: 'Squat', muscleGroup: 'legs', sets: 3, reps: 5 },
        { name: 'Pulldown', muscleGroup: 'lats', sets: 3, reps: 10 },
        { name: 'Thing', muscleGroup: 'nonsense', sets: 3, reps: 10 },
      ] }],
    }))!
    const groups = plan.sessions[0].exercises.map(e => e.muscleGroup)
    expect(groups).toEqual(['quads', 'back', 'other'])
  })

  it('drops an exercise with no name, and says so', () => {
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x', days: [{ title: 'A', exercises: [
        { name: 'Bench', sets: 3, reps: 5 },
        { sets: 3, reps: 5 },
      ] }],
    }))!
    expect(plan.sessions[0].exercises).toHaveLength(1)
    expect(plan.warnings.join(' ')).toMatch(/no name/i)
  })

  it('drops a day left with nothing usable', () => {
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x', days: [
        { title: 'Real', exercises: [{ name: 'Bench', sets: 3, reps: 5 }] },
        { title: 'Empty', exercises: [] },
      ],
    }))!
    expect(plan.sessions).toHaveLength(1)
    expect(plan.warnings.join(' ')).toMatch(/Empty/)
  })

  it('caps a runaway answer instead of trusting it', () => {
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x', days: [{ title: 'A', exercises: [{ name: 'Bench', sets: 99, reps: 5 }] }],
    }))!
    expect(plan.sessions[0].exercises[0].sets.length).toBeLessThanOrEqual(10)
  })

  it('caps the number of days and warns', () => {
    const days = Array.from({ length: 12 }, (_, i) => ({
      title: `D${i}`, exercises: [{ name: 'Bench', sets: 3, reps: 5 }],
    }))
    const plan = parseWorkoutPlan(JSON.stringify({ name: 'x', days }))!
    expect(plan.sessions).toHaveLength(7)
    expect(plan.warnings.join(' ')).toMatch(/first 7 days/i)
  })

  it('handles ranges throughout', () => {
    const plan = parseWorkoutPlan(JSON.stringify({
      name: 'x', days: [{ title: 'A', exercises: [
        { name: 'Bench', sets: '3-4', reps: '8-12' },
      ] }],
    }))!
    expect(plan.sessions[0].exercises[0].sets).toHaveLength(3)
    expect(plan.sessions[0].exercises[0].sets[0].targetReps).toBe(8)
  })

  it('survives a fenced, prose-wrapped answer', () => {
    const raw = `Here's a solid plan!\n\n\`\`\`json\n${JSON.stringify(GOOD)}\n\`\`\`\n\nGood luck!`
    expect(parseWorkoutPlan(raw)!.sessions).toHaveLength(2)
  })

  it('returns null rather than an empty plan', () => {
    // The caller shows an error; a plan with no sessions would look like
    // a success that quietly did nothing.
    expect(parseWorkoutPlan('sorry, I cannot help with that')).toBeNull()
    expect(parseWorkoutPlan(JSON.stringify({ name: 'x', days: [] }))).toBeNull()
    expect(parseWorkoutPlan(JSON.stringify({ name: 'x' }))).toBeNull()
  })

  it('carries the unit through to every set', () => {
    const plan = parseWorkoutPlan(JSON.stringify(GOOD), 'lb')!
    expect(plan.sessions[0].exercises[0].sets.every(s => s.unit === 'lb')).toBe(true)
  })

  it('gives every set and exercise a distinct id', () => {
    const plan = parseWorkoutPlan(JSON.stringify(GOOD))!
    const ids = plan.sessions.flatMap(s => [
      ...s.exercises.map(e => e.id), ...s.exercises.flatMap(e => e.sets.map(x => x.id)),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildPlanPrompt', () => {
  it('tells the model not to prescribe weights', () => {
    const p = buildPlanPrompt({ brief: 'get stronger', daysPerWeek: 4 })
    expect(p).toMatch(/DO NOT suggest any weights/)
  })

  it('passes the brief and the day count through', () => {
    const p = buildPlanPrompt({ brief: 'bad knees, no squats', daysPerWeek: 3 })
    expect(p).toMatch(/bad knees, no squats/)
    expect(p).toMatch(/Days per week: 3/)
  })

  it('includes the split when one is given', () => {
    const p = buildPlanPrompt({ brief: 'x', daysPerWeek: 4, splits: ['Push', 'Pull'] })
    expect(p).toMatch(/Push, Pull/)
  })
})
