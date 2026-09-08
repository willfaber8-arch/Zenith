/**
 * Turning a repeat rule into actual dates.
 *
 * This is the half the parser was missing, and its absence was invisible
 * in the worst way: a weekly class imported as one January event, the
 * toast said "2 events imported", and the calendar was empty. Most of
 * these tests exist to make sure a series lands on the days a person
 * would point at on a wall calendar.
 */

import {
  parseRRule, expandOccurrences, MAX_OCCURRENCES,
} from '@/utils/recurrence'

/** 2026-01-12 is a Monday. */
const MON = new Date(2026, 0, 12, 14, 0).getTime()
const HOUR = 3_600_000

const days = (occ: { startMs: number }[]) =>
  occ.map(o => new Date(o.startMs).toISOString().slice(0, 10))

describe('parseRRule', () => {
  it('reads a weekly class rule', () => {
    const r = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1')
    expect(r).toMatchObject({ freq: 'WEEKLY', interval: 1, byDay: [1, 3] })
  })

  it('reads COUNT and UNTIL', () => {
    expect(parseRRule('FREQ=DAILY;COUNT=10')?.count).toBe(10)
    expect(parseRRule('FREQ=DAILY;UNTIL=20260301T000000Z')?.until)
      .toBe(Date.UTC(2026, 2, 1))
  })

  it('defaults a missing interval to 1', () => {
    expect(parseRRule('FREQ=WEEKLY')?.interval).toBe(1)
  })

  it('ignores an ordinal prefix but keeps the weekday', () => {
    // "2TH" means the second Thursday. Honouring the ordinal is more
    // than a first pass needs; losing the Thursday would be wrong.
    expect(parseRRule('FREQ=MONTHLY;BYDAY=2TH')?.byDay).toEqual([4])
  })

  it('returns null for anything it does not understand', () => {
    // An unparsed rule leaves one occurrence — the old behaviour, which
    // beats inventing dates.
    for (const bad of ['', 'FREQ=HOURLY', 'nonsense', 'INTERVAL=2']) {
      expect(parseRRule(bad)).toBeNull()
    }
  })

  it('refuses a nonsensical interval rather than looping oddly', () => {
    expect(parseRRule('FREQ=DAILY;INTERVAL=0')?.interval).toBe(1)
    expect(parseRRule('FREQ=DAILY;INTERVAL=-5')?.interval).toBe(1)
  })
})

describe('expandOccurrences', () => {
  it('returns the event itself when there is no rule', () => {
    const out = expandOccurrences(MON, MON + HOUR, null)
    expect(out).toEqual([{ startMs: MON, endMs: MON + HOUR }])
  })

  it('expands a weekly class across the term', () => {
    // The reported bug: this used to be one event in January.
    const rule = parseRRule('FREQ=WEEKLY;BYDAY=MO;UNTIL=20260223T000000Z')
    const out = expandOccurrences(MON, MON + HOUR, rule)
    expect(days(out)).toEqual([
      '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02',
      '2026-02-09', '2026-02-16',
    ])
  })

  it('honours COUNT exactly', () => {
    const out = expandOccurrences(MON, MON + HOUR, parseRRule('FREQ=DAILY;COUNT=5'))
    expect(out).toHaveLength(5)
  })

  it('keeps every occurrence the same length', () => {
    const out = expandOccurrences(MON, MON + 90 * 60_000,
      parseRRule('FREQ=WEEKLY;COUNT=4'))
    for (const o of out) expect(o.endMs - o.startMs).toBe(90 * 60_000)
  })

  it('lands on both days of a Monday/Wednesday class', () => {
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'))
    const dows = out.map(o => new Date(o.startMs).getDay())
    expect(dows).toEqual([1, 3, 1, 3])
  })

  it('never starts before the event itself', () => {
    // A Mon/Wed rule starting on the Wednesday must not back-fill Monday.
    const wed = new Date(2026, 0, 14, 14, 0).getTime()
    const out = expandOccurrences(wed, wed + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3'))
    expect(Math.min(...out.map(o => o.startMs))).toBe(wed)
  })

  it('respects INTERVAL for a fortnightly meeting', () => {
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;INTERVAL=2;COUNT=3'))
    expect(days(out)).toEqual(['2026-01-12', '2026-01-26', '2026-02-09'])
  })

  it('skips cancelled dates listed in EXDATE', () => {
    // This is how a calendar says "no class that week". Ignoring it
    // would resurrect a meeting that was called off.
    const skip = new Date(2026, 0, 19, 14, 0).getTime()
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=MO;COUNT=4'), [skip])
    expect(days(out)).not.toContain('2026-01-19')
  })

  it('matches an EXDATE written as a bare date', () => {
    const skipMidnight = new Date(2026, 0, 19, 0, 0).getTime()
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=MO;COUNT=4'), [skipMidnight])
    expect(days(out)).not.toContain('2026-01-19')
  })

  it('does not spill a monthly rule into the wrong month', () => {
    // 31 January + one month must not land in March.
    const jan31 = new Date(2026, 0, 31, 9, 0).getTime()
    const out = expandOccurrences(jan31, jan31 + HOUR,
      parseRRule('FREQ=MONTHLY;COUNT=3'))
    expect(out.map(o => new Date(o.startMs).getMonth())).toEqual([0, 1, 2])
  })

  it('keeps the same wall-clock time across a daylight-saving change', () => {
    // Adding milliseconds would shift the class by an hour in March.
    const feb = new Date(2026, 1, 2, 9, 30).getTime()
    const out = expandOccurrences(feb, feb + HOUR, parseRRule('FREQ=WEEKLY;COUNT=12'))
    for (const o of out) {
      const d = new Date(o.startMs)
      expect([d.getHours(), d.getMinutes()]).toEqual([9, 30])
    }
  })

  it('bounds an endless daily rule instead of running forever', () => {
    const out = expandOccurrences(MON, MON + HOUR, parseRRule('FREQ=DAILY'))
    expect(out.length).toBeGreaterThan(100)
    expect(out.length).toBeLessThanOrEqual(MAX_OCCURRENCES)
  })

  it('caps a rule whose COUNT is absurd', () => {
    const out = expandOccurrences(MON, MON + HOUR, parseRRule('FREQ=DAILY;COUNT=99999'))
    expect(out.length).toBeLessThanOrEqual(MAX_OCCURRENCES)
  })

  it('stops at UNTIL even when COUNT would allow more', () => {
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=DAILY;COUNT=100;UNTIL=20260116T235900Z'))
    expect(days(out)[days(out).length - 1] <= '2026-01-16').toBe(true)
  })

  it('returns occurrences in chronological order', () => {
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=FR,MO,WE;COUNT=9'))
    const starts = out.map(o => o.startMs)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })

  it('never produces the same instant twice', () => {
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=WEEKLY;BYDAY=MO,MO;COUNT=5'))
    expect(new Set(out.map(o => o.startMs)).size).toBe(out.length)
  })

  it('still yields the event when the rule produces nothing in range', () => {
    // An event must never disappear from the calendar entirely.
    const out = expandOccurrences(MON, MON + HOUR,
      parseRRule('FREQ=DAILY;UNTIL=20200101T000000Z'))
    expect(out).toHaveLength(1)
    expect(out[0].startMs).toBe(MON)
  })
})
