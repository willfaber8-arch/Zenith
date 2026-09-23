/**
 * Changing the time on something that repeats.
 *
 * The rule being pinned down: the time of day and the duration belong to
 * the series, the date belongs to the occurrence. So "I set my daily
 * free time at the wrong hour" is one edit, not forty — while "this
 * particular Tuesday moved to Wednesday" stays where it was put.
 */

import {
  planSeriesTimes, describeTimeChange, moveToTimeOfDay,
  timeOfDayMinutes, wholeDayDelta, startOfLocalDay,
} from '@/utils/seriesEdit'

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime()

/** A daily 3–4pm repeat across five days. */
const daily = [
  { id: 1, startMs: at(2026, 9, 21, 15), endMs: at(2026, 9, 21, 16) },
  { id: 2, startMs: at(2026, 9, 22, 15), endMs: at(2026, 9, 22, 16) },
  { id: 3, startMs: at(2026, 9, 23, 15), endMs: at(2026, 9, 23, 16) },
  { id: 4, startMs: at(2026, 9, 24, 15), endMs: at(2026, 9, 24, 16) },
  { id: 5, startMs: at(2026, 9, 25, 15), endMs: at(2026, 9, 25, 16) },
]

describe('timeOfDayMinutes / wholeDayDelta', () => {
  it('reads the clock, not the instant', () => {
    expect(timeOfDayMinutes(at(2026, 9, 21, 15, 30))).toBe(15 * 60 + 30)
    expect(timeOfDayMinutes(at(2026, 9, 25, 15, 30))).toBe(15 * 60 + 30)
  })

  it('counts calendar days, in both directions', () => {
    expect(wholeDayDelta(at(2026, 9, 21, 15), at(2026, 9, 24, 9))).toBe(3)
    expect(wholeDayDelta(at(2026, 9, 24, 9), at(2026, 9, 21, 23))).toBe(-3)
    expect(wholeDayDelta(at(2026, 9, 21, 1), at(2026, 9, 21, 23))).toBe(0)
  })

  /*
   * The clocks change on 2026-11-01 in US zones. Stepping by date
   * component keeps "same time next day" at the same clock reading;
   * adding 86,400,000ms would land an hour out.
   */
  it('keeps the clock reading across a DST boundary', () => {
    const before = at(2026, 10, 31, 15)
    const after  = moveToTimeOfDay(at(2026, 11, 2, 15), timeOfDayMinutes(before), 3_600_000)
    expect(new Date(after.startMs).getHours()).toBe(15)
  })
})

describe('describeTimeChange', () => {
  const base = { startMs: at(2026, 9, 23, 15), endMs: at(2026, 9, 23, 16) }

  it('sees a plain time move', () => {
    const shape = describeTimeChange(base, {
      startMs: at(2026, 9, 23, 16), endMs: at(2026, 9, 23, 17),
    })
    expect(shape).toEqual({ timeChanged: true, dateChanged: false, dayDelta: 0 })
  })

  it('sees a duration change on its own', () => {
    const shape = describeTimeChange(base, {
      startMs: at(2026, 9, 23, 15), endMs: at(2026, 9, 23, 17),
    })
    expect(shape.timeChanged).toBe(true)
    expect(shape.dateChanged).toBe(false)
  })

  it('sees a date move, and how far', () => {
    const shape = describeTimeChange(base, {
      startMs: at(2026, 9, 24, 15), endMs: at(2026, 9, 24, 16),
    })
    expect(shape).toEqual({ timeChanged: false, dateChanged: true, dayDelta: 1 })
  })

  it('reports nothing changed when nothing did', () => {
    expect(describeTimeChange(base, base))
      .toEqual({ timeChanged: false, dateChanged: false, dayDelta: 0 })
  })
})

describe('planSeriesTimes — occurrence-only', () => {
  it('moves the edited occurrence and nothing else', () => {
    const plan = planSeriesTimes('occurrence-only', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 23, 16), endMs: at(2026, 9, 23, 17) },
    })
    expect(plan).toEqual([
      { id: 3, startMs: at(2026, 9, 23, 16), endMs: at(2026, 9, 23, 17) },
    ])
  })
})

describe('planSeriesTimes — time-of-day', () => {
  it('moves every occurrence to the new hour, each keeping its own date', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 23, 16), endMs: at(2026, 9, 23, 17) },
    })

    expect(plan).toHaveLength(5)
    for (const p of plan) {
      expect(new Date(p.startMs).getHours()).toBe(16)
      expect(p.endMs - p.startMs).toBe(3_600_000)
    }
    /* Each one stayed on its own day — the whole point. */
    expect(plan.map(p => new Date(p.startMs).getDate()).sort())
      .toEqual([21, 22, 23, 24, 25])
  })

  it('carries a duration change too', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 1,
      target: { startMs: at(2026, 9, 21, 15), endMs: at(2026, 9, 21, 17) },
    })
    expect(plan).toHaveLength(5)
    expect(plan.every(p => p.endMs - p.startMs === 2 * 3_600_000)).toBe(true)
  })

  /* A date typed into the form belongs to the occurrence that was open;
     the others are not dragged onto it. */
  it('never moves the other occurrences onto the edited one\'s date', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 30, 16), endMs: at(2026, 9, 30, 17) },
    })
    const dates = plan.map(p => new Date(p.startMs).getDate()).sort((a, b) => a - b)
    expect(dates).toEqual([21, 22, 24, 25, 30])
  })

  it('leaves out rows that are already at the right time', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 23, 15), endMs: at(2026, 9, 23, 16) },
    })
    expect(plan).toEqual([])
  })
})

describe('planSeriesTimes — shift-days', () => {
  it('slides every occurrence by the same number of days', () => {
    const plan = planSeriesTimes('shift-days', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 24, 16), endMs: at(2026, 9, 24, 17) },
    })
    expect(plan.map(p => new Date(p.startMs).getDate()).sort((a, b) => a - b))
      .toEqual([22, 23, 24, 25, 26])
    expect(plan.every(p => new Date(p.startMs).getHours() === 16)).toBe(true)
  })

  it('slides backwards too', () => {
    const plan = planSeriesTimes('shift-days', {
      rows: daily,
      clickedId: 5,
      target: { startMs: at(2026, 9, 24, 15), endMs: at(2026, 9, 24, 16) },
    })
    expect(plan.map(p => new Date(p.startMs).getDate()).sort((a, b) => a - b))
      .toEqual([20, 21, 22, 23, 24])
  })
})

describe('planSeriesTimes — leaving the past alone', () => {
  const today = at(2026, 9, 23, 0)

  it('moves only today onward, whatever the scope reaches', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 3,
      target: { startMs: at(2026, 9, 23, 16), endMs: at(2026, 9, 23, 17) },
      protectBeforeMs: today,
    })
    expect(plan.map(p => p.id).sort()).toEqual([3, 4, 5])
  })

  /*
   * You are looking at it — not moving the one you just edited would be
   * the strangest outcome available, whatever the date on it.
   */
  it('still moves the edited occurrence when it is itself in the past', () => {
    const plan = planSeriesTimes('time-of-day', {
      rows: daily,
      clickedId: 1,
      target: { startMs: at(2026, 9, 21, 16), endMs: at(2026, 9, 21, 17) },
      protectBeforeMs: today,
    })
    expect(plan.map(p => p.id).sort()).toEqual([1, 3, 4, 5])
    expect(plan.find(p => p.id === 1)!.startMs).toBe(at(2026, 9, 21, 16))
  })
})

describe('startOfLocalDay', () => {
  it('is local midnight, not UTC midnight', () => {
    const d = new Date(startOfLocalDay(at(2026, 9, 23, 17, 42)))
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([0, 0, 23])
  })
})
