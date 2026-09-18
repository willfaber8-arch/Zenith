/**
 * A habit ticked off at 1am has to move the score.
 *
 * With the late cutoff configured, the tick is deliberately written under
 * yesterday's key — that is the whole point of the cutoff. Every reader
 * then has to agree, and for a while they did not: the grit chart, the
 * trend series, the completion ring and the streak reconciler were all
 * anchored on the calendar day. So the tick landed on the 17th while the
 * chart's last point was the 18th, a date with no rows in it, and the
 * score sat exactly where it had been however much had just been logged.
 *
 * The reconciler was worse than cosmetic: it wrote `streakCount: 0` for
 * anything two calendar days stale, which at 01:00 meant a live streak
 * three hours before the user's day was actually over.
 */

import type { Habit, HabitCompletion } from '@/lib/db'
import { calculateMovingGritScore } from '@/utils/gritScore'
import { computeCompletionSeries, detectBrokenStreaks } from '@/utils/habitAnalytics'
import { addDaysISO, diffDaysISO } from '@/utils/localDate'
import { DAY_CUTOFF_KEY } from '@/utils/dayBoundary'

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 1,
  name: 'Read',
  frequency: 'daily',
  streakCount: 5,
  lastCompletedDate: '2026-09-17',
  category: 'Life',
  activeDays: [],
  targetCompletions: 20,
  createdAt: new Date(2026, 0, 1).getTime(),
  ...over,
})

/** 1am on the 18th — inside the grace window, so the habit day is the 17th. */
const LATE_NIGHT = new Date(2026, 8, 18, 1, 0)
/** 5am on the 18th — the window has closed and the day has rolled over. */
const MORNING    = new Date(2026, 8, 18, 5, 0)

beforeEach(() => {
  localStorage.setItem(DAY_CUTOFF_KEY, '4')
})

afterEach(() => {
  jest.useRealTimers()
  localStorage.clear()
})

describe('the grit score at 1am', () => {
  it('ends its series on the day the tick was credited to', () => {
    jest.useFakeTimers().setSystemTime(LATE_NIGHT)

    const points = calculateMovingGritScore([habit()])

    // Not the 18th. The 18th has not started as far as the habits are
    // concerned, and drawing it puts an empty day at the end of the line.
    expect(points.at(-1)?.dateISO).toBe('2026-09-17')
  })

  it('credits the tick instead of counting the day as missed', () => {
    jest.useFakeTimers().setSystemTime(LATE_NIGHT)
    const lateNight = calculateMovingGritScore([habit()]).at(-1)!.score

    // The same habit, same state, read at a respectable hour of the same
    // habit day. The score is a property of the day, not of when you look.
    jest.setSystemTime(new Date(2026, 8, 17, 14, 0))
    const afternoon = calculateMovingGritScore([habit()]).at(-1)!.score

    expect(lateNight).toBe(afternoon)
    expect(lateNight).toBeGreaterThan(0)
  })

  it('does roll over once the cutoff passes', () => {
    jest.useFakeTimers().setSystemTime(MORNING)
    const points = calculateMovingGritScore([habit()])

    expect(points.at(-1)?.dateISO).toBe('2026-09-18')
  })

  it('still counts a genuinely missed day against the score', () => {
    jest.useFakeTimers().setSystemTime(MORNING)

    const missed = calculateMovingGritScore([habit()]).at(-1)!.score
    const done   = calculateMovingGritScore(
      [habit({ lastCompletedDate: '2026-09-18' })],
    ).at(-1)!.score

    expect(missed).toBeLessThan(done)
  })
})

describe('the trend series at 1am', () => {
  const completions: HabitCompletion[] = [
    { id: 1, habitId: 1, date: '2026-09-17', count: 20 },
  ]

  it('shows the work that was just logged', () => {
    jest.useFakeTimers().setSystemTime(LATE_NIGHT)

    const points = computeCompletionSeries([habit()], completions, 30)
    const last   = points.at(-1)!

    expect(last.dateISO).toBe('2026-09-17')
    expect(last.score).toBe(100)
  })

  it('spans exactly the days asked for, ending on the habit day', () => {
    jest.useFakeTimers().setSystemTime(LATE_NIGHT)

    const points = computeCompletionSeries([habit()], completions, 30)

    expect(points).toHaveLength(30)
    expect(points[0].dateISO).toBe('2026-08-19')
    expect(points.at(-1)!.dateISO).toBe('2026-09-17')
  })

  it('honours an explicit anchor over the clock', () => {
    jest.useFakeTimers().setSystemTime(MORNING)

    const points = computeCompletionSeries([habit()], completions, 7, '2026-09-17')

    expect(points.at(-1)!.dateISO).toBe('2026-09-17')
  })
})

describe('streak reconciliation during the grace window', () => {
  it('leaves a streak alone while the day is still open', () => {
    jest.useFakeTimers().setSystemTime(LATE_NIGHT)

    // Last done on the 16th. The habit day is the 17th, so this is a
    // one-day gap — yesterday — and there are three hours left to do it.
    const broken = detectBrokenStreaks([habit({ lastCompletedDate: '2026-09-16' })])

    expect(broken).toEqual([])
  })

  it('reports the loss once the day has actually rolled over', () => {
    jest.useFakeTimers().setSystemTime(MORNING)

    const broken = detectBrokenStreaks([habit({ lastCompletedDate: '2026-09-16' })])

    expect(broken).toEqual([
      { habitId: 1, name: 'Read', lostStreak: 5 },
    ])
  })

  it('treats a streak with no completion behind it as lost', () => {
    jest.useFakeTimers().setSystemTime(MORNING)

    expect(detectBrokenStreaks([habit({ lastCompletedDate: null })]))
      .toHaveLength(1)
  })
})

describe('day-key arithmetic', () => {
  it('steps across a month end', () => {
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysISO('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('counts whole days across a daylight-saving shift', () => {
    // US clocks go forward on 2026-03-08 and back on 2026-11-01. Both
    // spans are seven days; only one of them is 7 × 24 hours.
    expect(diffDaysISO('2026-03-05', '2026-03-12')).toBe(7)
    expect(diffDaysISO('2026-10-29', '2026-11-05')).toBe(7)
    expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDaysISO('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('is negative looking backwards and zero on itself', () => {
    expect(diffDaysISO('2026-09-18', '2026-09-17')).toBe(-1)
    expect(diffDaysISO('2026-09-18', '2026-09-18')).toBe(0)
  })
})
