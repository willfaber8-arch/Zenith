/**
 * "No more than N" habits.
 *
 * These are not goal habits with the comparison flipped. Reaching a goal
 * is knowable the instant you reach it; staying under a limit is only
 * knowable once the day is over. Every case below exists because
 * treating the two the same got something backwards — most visibly,
 * awarding the day for having one coffee.
 */

import {
  limitDayState, limitStreak, remainingFraction,
} from '@/utils/habitLimit'
import type { Habit } from '@/lib/db'

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 1, name: 'Coffee', frequency: 'daily', activeDays: [],
  targetCompletions: 2, streakCount: 0, lastCompletedDate: null,
  category: 'General', createdAt: new Date(2026, 0, 1).getTime(),
  goalType: 'at_most',
  ...over,
} as Habit)

/* Every day is scheduled, and yesterday is simply the day before. */
const everyDay = () => true
const dayBefore = (_h: Habit, iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

describe('limitDayState', () => {
  it('leaves today undecided while it is still running', () => {
    // One coffee is not success at "no more than two" — it is success so far.
    expect(limitDayState(1, 2, true)).toBe('pending')
    expect(limitDayState(0, 2, true)).toBe('pending')
  })

  it('counts a finished day under the cap as a success', () => {
    expect(limitDayState(2, 2, false)).toBe('success')
    expect(limitDayState(1, 2, false)).toBe('success')
  })

  it('counts a finished day with nothing logged as a success', () => {
    // No coffees is the best possible day. Marking it missed would
    // invert the entire habit.
    expect(limitDayState(0, 2, false)).toBe('success')
  })

  it('fails the moment the cap is passed, today included', () => {
    // Going over is decided immediately — the rest of the day cannot undo it.
    expect(limitDayState(3, 2, true)).toBe('failed')
    expect(limitDayState(3, 2, false)).toBe('failed')
  })
})

describe('limitStreak', () => {
  const today = '2026-03-10'

  it('counts back over finished days under the cap', () => {
    const counts: Record<string, number> = {
      '2026-03-09': 2, '2026-03-08': 0, '2026-03-07': 1,
    }
    const n = limitStreak(habit(), iso => counts[iso] ?? 0, today, everyDay, dayBefore)
    expect(n).toBeGreaterThanOrEqual(3)
  })

  it('stops at the first day that went over', () => {
    const counts: Record<string, number> = {
      '2026-03-09': 2, '2026-03-08': 5, '2026-03-07': 0,
    }
    expect(limitStreak(habit(), iso => counts[iso] ?? 0, today, everyDay, dayBefore)).toBe(1)
  })

  it('ignores today however well it is going', () => {
    // Counting today would let the streak evaporate later the same day,
    // which reads as the app taking something away.
    const counts: Record<string, number> = { '2026-03-10': 0, '2026-03-09': 9 }
    expect(limitStreak(habit(), iso => counts[iso] ?? 0, today, everyDay, dayBefore)).toBe(0)
  })

  it('does not award days from before the habit existed', () => {
    const created = new Date(2026, 2, 8).getTime()   // 2026-03-08
    const n = limitStreak(habit({ createdAt: created }), () => 0, today, everyDay, dayBefore)
    expect(n).toBeLessThanOrEqual(2)
  })

  it('skips unscheduled days rather than breaking on them', () => {
    // A weekday-only limit is not broken by the weekend.
    const weekdaysOnly = (_h: Habit, iso: string) => {
      const d = new Date(iso + 'T12:00:00').getDay()
      return d >= 1 && d <= 5
    }
    const n = limitStreak(habit(), () => 0, '2026-03-10', weekdaysOnly, dayBefore)
    expect(n).toBeGreaterThan(2)
  })

  it('terminates when the walk stops making progress', () => {
    // A previousDay that returns its own input would otherwise spin forever.
    const stuck = (_h: Habit, iso: string) => iso
    expect(() => limitStreak(habit(), () => 0, today, everyDay, stuck)).not.toThrow()
  })
})

describe('remainingFraction', () => {
  it('reports how much allowance is left', () => {
    expect(remainingFraction(0, 4)).toBe(1)
    expect(remainingFraction(2, 4)).toBe(0.5)
    expect(remainingFraction(4, 4)).toBe(0)
  })

  it('floors at zero once the cap is passed', () => {
    expect(remainingFraction(9, 4)).toBe(0)
  })

  it('never returns NaN, whatever it is handed', () => {
    for (const [c, t] of [[NaN, 4], [1, 0], [1, NaN], [-1, 4]] as const) {
      const r = remainingFraction(c, t)
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})
