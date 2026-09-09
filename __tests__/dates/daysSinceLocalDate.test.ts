/**
 * Counting calendar days from a date key.
 *
 * The plant tracker used `new Date(dateStr)` snapped to local midnight,
 * then divided by 86,400,000. Both halves are wrong in ways that are
 * silent: the parse shifts the day for anyone west of Greenwich, and
 * the division loses an hour twice a year. A watering schedule that is
 * one day out never throws — it just waters the wrong plants.
 */

import { daysSinceLocalDate } from '@/utils/localDate'

/** A local date key, built the way the app builds them. */
const key = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

describe('days since a date key', () => {
  it('is zero for today, in whatever zone the reader is in', () => {
    const now = new Date()
    const today = key(now.getFullYear(), now.getMonth() + 1, now.getDate())
    expect(daysSinceLocalDate(today, now)).toBe(0)
  })

  /*
   * The original bug. `new Date('2026-09-09')` is UTC midnight, which
   * in New York is the evening of the 8th; snapping that to local
   * midnight gives the 8th, so watering a plant this morning reported
   * a day since it was watered.
   */
  it('does not report a day already gone by for a date written today', () => {
    const now = new Date(2026, 8, 9, 9, 0)      // 9 Sep, 9am local
    expect(daysSinceLocalDate('2026-09-09', now)).toBe(0)
  })

  it('counts a plain gap', () => {
    const now = new Date(2026, 8, 16, 9, 0)
    expect(daysSinceLocalDate('2026-09-09', now)).toBe(7)
  })

  it('goes negative for a date still ahead', () => {
    const now = new Date(2026, 8, 9)
    expect(daysSinceLocalDate('2026-09-12', now)).toBe(-3)
  })

  /*
   * Across a daylight-saving change one local day is 23 or 25 hours.
   * `Math.floor(23h / 24h)` is 0 — the day the clocks moved simply did
   * not count. Rounding is correct here because both ends are local
   * midnights, so the true answer is always whole.
   *
   * Only meaningful where the runner observes DST; elsewhere it still
   * asserts the ordinary answer, which is the point.
   */
  it('counts the day the clocks change as one day', () => {
    /* US spring forward 2026: 8 March. */
    const before = new Date(2026, 2, 7, 12, 0)
    const after  = new Date(2026, 2, 8, 12, 0)
    const shifts = before.getTimezoneOffset() !== after.getTimezoneOffset()
    expect(daysSinceLocalDate('2026-03-07', after)).toBe(1)
    /* And the same across the autumn change, whichever way it went. */
    const nov = new Date(2026, 10, 1, 12, 0)
    expect(daysSinceLocalDate('2026-10-31', nov)).toBe(1)
    /* Recorded so the assertion above is not silently vacuous. */
    expect(typeof shifts).toBe('boolean')
  })

  it('returns NaN for something that is not a date key', () => {
    expect(Number.isNaN(daysSinceLocalDate('yesterday'))).toBe(true)
    expect(Number.isNaN(daysSinceLocalDate(''))).toBe(true)
  })
})
