/**
 * __tests__/engines/ReviewScheduler.test.ts
 *
 * The scheduler is the piece the whole review system rests on, and it
 * replaces an implementation that looked correct and silently did
 * nothing. So these tests check the arithmetic against the published SM-2
 * algorithm rather than against whatever the code happens to do.
 */

import {
  scheduleNext, adjustEase, initialState, backfillState,
  isDue, formatDue,
  DEFAULT_EASE_FACTOR, MIN_EASE_FACTOR, MAX_EASE_FACTOR,
  FIRST_INTERVAL_DAYS, SECOND_INTERVAL_DAYS, MAX_INTERVAL_DAYS,
  type RecallGrade, type SchedulingState,
} from '@/lib/engines/ReviewScheduler'

const DAY = 86_400_000
const T0  = 1_800_000_000_000   // fixed epoch — no Date.now() in tests

const fresh = (): SchedulingState => ({
  easeFactor:           DEFAULT_EASE_FACTOR,
  reviewIntervalDays:   0,
  consecutiveSuccesses: 0,
})

const daysOut = (at: number) => Math.round((at - T0) / DAY)

describe('adjustEase — the published SM-2 formula', () => {

  it('leaves ease unchanged at grade 4', () => {
    // EF + (0.1 − 1×(0.08 + 1×0.02)) = EF + 0
    expect(adjustEase(2.5, 4)).toBe(2.5)
  })

  it('raises ease at grade 5', () => {
    expect(adjustEase(2.5, 5)).toBeCloseTo(2.6, 2)
  })

  it('lowers ease at grade 3', () => {
    // EF + (0.1 − 2×(0.08 + 2×0.02)) = EF − 0.14
    expect(adjustEase(2.5, 3)).toBeCloseTo(2.36, 2)
  })

  it('drops ease sharply on a blackout', () => {
    // EF + (0.1 − 5×(0.08 + 5×0.02)) = EF − 0.8
    expect(adjustEase(2.5, 0)).toBeCloseTo(1.7, 2)
  })

  it('floors at 1.3 however many failures', () => {
    let ef = DEFAULT_EASE_FACTOR
    for (let i = 0; i < 20; i++) ef = adjustEase(ef, 0)
    expect(ef).toBe(MIN_EASE_FACTOR)
  })

  it('caps ease so perfect streaks cannot run away', () => {
    // Not in the original algorithm, which is unbounded above — without a
    // cap a flawless card drifts to intervals measured in years.
    let ef = DEFAULT_EASE_FACTOR
    for (let i = 0; i < 20; i++) ef = adjustEase(ef, 5)
    expect(ef).toBe(MAX_EASE_FACTOR)
  })
})

describe('scheduleNext — the interval ladder', () => {

  it('first pass schedules one day out', () => {
    const r = scheduleNext(fresh(), 4, T0)
    expect(r.reviewIntervalDays).toBe(FIRST_INTERVAL_DAYS)
    expect(r.consecutiveSuccesses).toBe(1)
    expect(daysOut(r.nextReviewAt)).toBe(1)
  })

  it('second pass schedules six days out', () => {
    const first  = scheduleNext(fresh(), 4, T0)
    const second = scheduleNext(first, 4, T0)
    expect(second.reviewIntervalDays).toBe(SECOND_INTERVAL_DAYS)
    expect(second.consecutiveSuccesses).toBe(2)
  })

  it('third pass multiplies by the ease factor', () => {
    let s: SchedulingState = fresh()
    s = scheduleNext(s, 4, T0)   // 1
    s = scheduleNext(s, 4, T0)   // 6
    const third = scheduleNext(s, 4, T0)
    // 6 × 2.5 = 15
    expect(third.reviewIntervalDays).toBe(15)
  })

  it('intervals grow monotonically on repeated passes', () => {
    let s: SchedulingState = fresh()
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      s = scheduleNext(s, 4, T0)
      seen.push(s.reviewIntervalDays)
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    }
  })

  it('caps the interval so a long streak stays inside a decade', () => {
    let s: SchedulingState = fresh()
    for (let i = 0; i < 60; i++) s = scheduleNext(s, 5, T0)
    expect(s.reviewIntervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS)
  })
})

describe('scheduleNext — failure handling', () => {

  it.each([0, 1, 2] as RecallGrade[])('grade %i resets the interval to one day', g => {
    let s: SchedulingState = fresh()
    for (let i = 0; i < 5; i++) s = scheduleNext(s, 5, T0)
    expect(s.reviewIntervalDays).toBeGreaterThan(10)

    const failed = scheduleNext(s, g, T0)
    expect(failed.reviewIntervalDays).toBe(FIRST_INTERVAL_DAYS)
    expect(failed.consecutiveSuccesses).toBe(0)
    expect(daysOut(failed.nextReviewAt)).toBe(1)
  })

  it('reduces ease on failure but does not reset it', () => {
    // A card known for months, blanked on once, is not a new card.
    let s: SchedulingState = fresh()
    for (let i = 0; i < 5; i++) s = scheduleNext(s, 5, T0)
    const before = s.easeFactor
    const after  = scheduleNext(s, 2, T0)

    expect(after.easeFactor).toBeLessThan(before)
    expect(after.easeFactor).toBeGreaterThan(MIN_EASE_FACTOR)
    expect(after.easeFactor).not.toBe(DEFAULT_EASE_FACTOR)
  })

  it('grade 3 counts as a pass, not a failure', () => {
    const r = scheduleNext(fresh(), 3, T0)
    expect(r.consecutiveSuccesses).toBe(1)
  })
})

describe('scheduleNext — robustness', () => {

  it('recovers from a zero ease factor', () => {
    // Rows written before this engine existed may carry junk.
    const r = scheduleNext(
      { easeFactor: 0, reviewIntervalDays: 0, consecutiveSuccesses: 0 }, 4, T0,
    )
    expect(r.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
    expect(r.nextReviewAt).toBeGreaterThan(T0)
  })

  it('handles a streak with no recorded interval', () => {
    const r = scheduleNext(
      { easeFactor: 2.5, reviewIntervalDays: 0, consecutiveSuccesses: 7 }, 4, T0,
    )
    expect(r.reviewIntervalDays).toBeGreaterThan(0)
  })

  it('is pure — same input, same output', () => {
    const a = scheduleNext(fresh(), 4, T0)
    const b = scheduleNext(fresh(), 4, T0)
    expect(a).toEqual(b)
  })
})

describe('initialState', () => {
  it('makes a new card due immediately', () => {
    const s = initialState(T0)
    expect(isDue(s.nextReviewAt, T0)).toBe(true)
    expect(s.easeFactor).toBe(DEFAULT_EASE_FACTOR)
    expect(s.consecutiveSuccesses).toBe(0)
  })
})

describe('backfillState — repairing cards that were always due', () => {

  it('keeps a never-passed card due now', () => {
    const s = backfillState({ consecutiveSuccesses: 0 }, T0)
    expect(isDue(s.nextReviewAt, T0)).toBe(true)
  })

  it('pushes a well-known card well into the future', () => {
    const s = backfillState({ consecutiveSuccesses: 6, easeFactor: 2.5 }, T0)
    expect(daysOut(s.nextReviewAt)).toBeGreaterThan(30)
  })

  it('orders due dates by mastery', () => {
    const out = [0, 1, 2, 3, 4, 5, 6].map(
      n => backfillState({ consecutiveSuccesses: n }, T0).nextReviewAt,
    )
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(out[i - 1])
    }
  })

  it('spreads same-mastery cards across days', () => {
    // 200 evenly-known cards must not all resurface on one morning.
    const dates = new Set(
      Array.from({ length: 9 }, (_, i) =>
        backfillState({ consecutiveSuccesses: 4 }, T0, i).nextReviewAt),
    )
    expect(dates.size).toBeGreaterThan(1)
  })

  it('does not spread a never-passed card away from now', () => {
    // Spread must never delay a card that genuinely needs studying.
    for (let i = 0; i < 5; i++) {
      expect(isDue(backfillState({ consecutiveSuccesses: 0 }, T0, i).nextReviewAt, T0)).toBe(true)
    }
  })

  it('fixes the bug it exists for: not everything is due', () => {
    const deck = Array.from({ length: 40 }, (_, i) => ({ consecutiveSuccesses: i % 7 }))
    const due = deck
      .map((c, i) => backfillState(c, T0, i))
      .filter(s => isDue(s.nextReviewAt, T0))
    expect(due.length).toBeGreaterThan(0)          // some work remains
    expect(due.length).toBeLessThan(deck.length)   // but not all of it
  })
})

describe('formatDue', () => {
  it.each([
    [0,   'Due now'],
    [1,   'Tomorrow'],
    [12,  'In 12 days'],
  ])('renders %i days out as "%s"', (days, expected) => {
    expect(formatDue(T0 + days * DAY, T0)).toBe(expected)
  })

  it('switches to months past 30 days', () => {
    expect(formatDue(T0 + 60 * DAY, T0)).toMatch(/month/)
  })

  it('reports an overdue card as due now', () => {
    expect(formatDue(T0 - 5 * DAY, T0)).toBe('Due now')
  })
})
