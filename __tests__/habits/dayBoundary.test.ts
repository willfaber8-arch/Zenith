/**
 * When your day actually ends.
 *
 * The calendar rolls over at midnight; people don't. Ticking a habit off
 * at 02:30 after a late session used to land on tomorrow, marking the
 * day you just worked through as missed and breaking the streak — the
 * opposite of what should happen to someone who stayed up to do it.
 */

import {
  effectiveDateISO, isInGraceWindow, clampCutoff, describeCutoff,
  loadCutoffHour, saveCutoffHour, dayBoundsMs,
  DEFAULT_CUTOFF_HOUR, MAX_CUTOFF_HOUR,
} from '@/utils/dayBoundary'

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min)

describe('effectiveDateISO', () => {
  it('is just the date when no cutoff is set', () => {
    expect(effectiveDateISO(at(2026, 9, 8, 2, 30), 0)).toBe('2026-09-08')
    expect(effectiveDateISO(at(2026, 9, 8, 14, 0), 0)).toBe('2026-09-08')
  })

  it('credits a 3am session to the day before', () => {
    // The whole point: the study session that ran past midnight belongs
    // to the day you were working, not the one you went to bed in.
    expect(effectiveDateISO(at(2026, 9, 8, 3, 0), 4)).toBe('2026-09-07')
    expect(effectiveDateISO(at(2026, 9, 8, 2, 30), 4)).toBe('2026-09-07')
  })

  it('switches over once the cutoff passes', () => {
    expect(effectiveDateISO(at(2026, 9, 8, 3, 59), 4)).toBe('2026-09-07')
    expect(effectiveDateISO(at(2026, 9, 8, 4, 0), 4)).toBe('2026-09-08')
  })

  it('leaves the rest of the day alone', () => {
    for (const h of [4, 9, 13, 18, 23]) {
      expect(effectiveDateISO(at(2026, 9, 8, h), 4)).toBe('2026-09-08')
    }
  })

  it('rolls back across a month boundary', () => {
    expect(effectiveDateISO(at(2026, 9, 1, 1, 0), 4)).toBe('2026-08-31')
  })

  it('rolls back across a year boundary', () => {
    expect(effectiveDateISO(at(2027, 1, 1, 2, 0), 5)).toBe('2026-12-31')
  })

  it('lands on the right date across a daylight-saving change', () => {
    // Subtracting 86,400,000 ms is wrong twice a year; stepping the date
    // component is not.
    for (const day of [8, 9, 10, 11, 12]) {
      const iso = effectiveDateISO(at(2026, 3, day, 2, 0), 4)
      expect(iso).toBe(`2026-03-${String(day - 1).padStart(2, '0')}`)
    }
  })
})

describe('isInGraceWindow', () => {
  it('is true only in the small hours, and only when enabled', () => {
    expect(isInGraceWindow(at(2026, 9, 8, 2), 4)).toBe(true)
    expect(isInGraceWindow(at(2026, 9, 8, 5), 4)).toBe(false)
    expect(isInGraceWindow(at(2026, 9, 8, 2), 0)).toBe(false)
  })
})

describe('clampCutoff', () => {
  it('keeps the setting inside a range that makes sense', () => {
    // A cutoff of 20 would mean most of the day counted as yesterday —
    // baffling to debug and not a setting anyone wants.
    expect(clampCutoff(20)).toBe(MAX_CUTOFF_HOUR)
    expect(clampCutoff(-3)).toBe(0)
    expect(clampCutoff(4)).toBe(4)
  })

  it('falls back to the default on nonsense', () => {
    expect(clampCutoff(NaN)).toBe(DEFAULT_CUTOFF_HOUR)
    expect(clampCutoff(Infinity)).toBe(DEFAULT_CUTOFF_HOUR)
  })

  it('never returns a fractional hour', () => {
    expect(clampCutoff(3.7)).toBe(3)
  })
})

describe('the stored setting', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the late cutoff, not midnight', () => {
    // Number(null) is 0, so reading the key without a null check would
    // have pinned the default to midnight whatever it was set to —
    // silently disabling the whole feature.
    expect(loadCutoffHour()).toBe(DEFAULT_CUTOFF_HOUR)
    expect(DEFAULT_CUTOFF_HOUR).toBeGreaterThan(0)
  })

  it('honours an explicit midnight choice over the default', () => {
    saveCutoffHour(0)
    expect(loadCutoffHour()).toBe(0)
  })

  it('round-trips', () => {
    saveCutoffHour(4)
    expect(loadCutoffHour()).toBe(4)
  })

  it('clamps a value written by an older version', () => {
    localStorage.setItem('zenith_day_cutoff_v1', '99')
    expect(loadCutoffHour()).toBe(MAX_CUTOFF_HOUR)
  })

  it('survives a corrupt value', () => {
    localStorage.setItem('zenith_day_cutoff_v1', 'not a number')
    expect(loadCutoffHour()).toBe(DEFAULT_CUTOFF_HOUR)
  })
})

describe('describeCutoff', () => {
  it('says plainly what the setting does', () => {
    expect(describeCutoff(0)).toMatch(/midnight/i)
    expect(describeCutoff(4)).toMatch(/day before/i)
  })
})


describe('dayBoundsMs', () => {
  it('runs cutoff to cutoff, not midnight to midnight', () => {
    const [start, end] = dayBoundsMs(at(2026, 9, 8, 14, 0), 4)

    expect(new Date(start)).toEqual(at(2026, 9, 8, 4, 0))
    expect(new Date(end + 1)).toEqual(at(2026, 9, 9, 4, 0))
  })

  it('keeps a 00:05 session inside the day it was earned in', () => {
    // The session that finishes just after midnight. Counted by the
    // calendar day it would fall into tomorrow and today's tally would
    // drop to zero at the moment the work was done.
    const justAfterMidnight = at(2026, 9, 9, 0, 5)
    const [start, end] = dayBoundsMs(justAfterMidnight, 4)

    expect(justAfterMidnight.getTime()).toBeGreaterThanOrEqual(start)
    expect(justAfterMidnight.getTime()).toBeLessThanOrEqual(end)
    expect(new Date(start)).toEqual(at(2026, 9, 8, 4, 0))
  })

  it('is the plain calendar day when no cutoff is set', () => {
    const [start, end] = dayBoundsMs(at(2026, 9, 8, 14, 0), 0)

    expect(new Date(start)).toEqual(at(2026, 9, 8, 0, 0))
    expect(new Date(end + 1)).toEqual(at(2026, 9, 9, 0, 0))
  })

  it('covers the whole day with no gap between consecutive days', () => {
    const [, endOfEighth]   = dayBoundsMs(at(2026, 9, 8, 14, 0), 4)
    const [startOfNinth]    = dayBoundsMs(at(2026, 9, 9, 14, 0), 4)

    expect(startOfNinth - endOfEighth).toBe(1)
  })
})
