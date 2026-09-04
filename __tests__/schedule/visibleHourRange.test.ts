/**
 * How much of the day the week grid draws.
 *
 * This is what makes a week fit on screen: the grid used to render all
 * twenty-four hours at a fixed height inside a 600px box, so it always
 * scrolled. Drawing only the hours that hold something is most of the
 * saving, and getting the bounds wrong either clips a class or brings
 * back the empty night.
 */

import { visibleHourRange } from '@/components/views/CalendarView'
import type { CalendarEvent } from '@/lib/db'

/** An event on 2026-09-07 between two local wall-clock times. */
function evt(startH: number, startM: number, endH: number, endM: number,
             extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: Math.random(), feedId: 1, uid: 'u' + Math.random(), title: 'x',
    startMs: new Date(2026, 8, 7, startH, startM).getTime(),
    endMs:   new Date(2026, 8, 7, endH,   endM).getTime(),
    allDay: 0, is1159: 0, category: 'scholastic',
    ...extra,
  } as CalendarEvent
}

describe('visibleHourRange', () => {
  it('falls back to a working day when there is nothing on', () => {
    // An empty week should not be a sliver, nor a full 24 hours.
    const { startH, endH } = visibleHourRange([])
    expect(startH).toBe(7)
    expect(endH).toBe(21)
    expect(endH - startH).toBeLessThan(24)
  })

  it('opens earlier for an early class', () => {
    const { startH } = visibleHourRange([evt(6, 30, 7, 45)])
    expect(startH).toBe(5)          // padded one hour before
  })

  it('extends for a late class', () => {
    const { endH } = visibleHourRange([evt(20, 0, 21, 30)])
    expect(endH).toBeGreaterThanOrEqual(22)
  })

  it('keeps the tail of an event that ends mid-hour', () => {
    // Rounding 15:20 down to 15 would cut the last twenty minutes off.
    const { endH } = visibleHourRange([evt(14, 0, 15, 20)])
    expect(endH).toBeGreaterThanOrEqual(17)
  })

  it('never runs past the ends of the day', () => {
    const { startH, endH } = visibleHourRange([evt(0, 5, 23, 55)])
    expect(startH).toBe(0)
    expect(endH).toBe(24)
  })

  it('ignores all-day and 11:59 deadline events', () => {
    // Those are drawn in their own banner rows, so letting a 23:59
    // deadline stretch the grid to midnight would undo the whole point.
    const { startH, endH } = visibleHourRange([
      evt(9, 0, 10, 0),
      evt(23, 59, 23, 59, { is1159: 1 }),
      evt(0, 0, 23, 59, { allDay: 1 }),
    ])
    expect(startH).toBe(7)
    expect(endH).toBe(21)
  })

  it('spans from the earliest start to the latest end', () => {
    const { startH, endH } = visibleHourRange([
      evt(9, 5, 9, 55), evt(14, 30, 15, 45), evt(7, 0, 8, 0),
    ])
    expect(startH).toBe(6)
    expect(endH).toBeGreaterThanOrEqual(17)
  })

  it('always returns a span of at least one hour', () => {
    const { startH, endH } = visibleHourRange([evt(12, 0, 12, 30)])
    expect(endH).toBeGreaterThan(startH)
  })
})
