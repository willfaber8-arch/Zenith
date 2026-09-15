/**
 * How much of the day the week grid draws.
 *
 * This is what makes a week fit on screen: the grid used to render all
 * twenty-four hours at a fixed height inside a 600px box, so it always
 * scrolled. Drawing only the hours that hold something is most of the
 * saving, and getting the bounds wrong either clips a class or brings
 * back the empty night.
 */

import { visibleHourRange, eventsOutsideWindow } from '@/components/views/CalendarView'
import type { CalendarEvent } from '@/lib/db'

/*
 * The grid now draws only the hours you are awake for, so these cases —
 * which are about the range following the events — pass the whole day
 * as the window. The window's own behaviour is covered separately at
 * the bottom of this file.
 */
const ALL_DAY = { startH: 0, endH: 24 }

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
    const { startH, endH } = visibleHourRange([], 'fit', undefined, ALL_DAY)
    expect(startH).toBe(7)
    expect(endH).toBe(21)
    expect(endH - startH).toBeLessThan(24)
  })

  it('opens earlier for an early class', () => {
    const { startH } = visibleHourRange([evt(6, 30, 7, 45)], 'fit', undefined, ALL_DAY)
    expect(startH).toBe(5)          // padded one hour before
  })

  it('extends for a late class', () => {
    const { endH } = visibleHourRange([evt(20, 0, 21, 30)], 'fit', undefined, ALL_DAY)
    expect(endH).toBeGreaterThanOrEqual(22)
  })

  it('keeps the tail of an event that ends mid-hour', () => {
    // Rounding 15:20 down to 15 would cut the last twenty minutes off.
    const { endH } = visibleHourRange([evt(14, 0, 15, 20)], 'fit', undefined, ALL_DAY)
    expect(endH).toBeGreaterThanOrEqual(17)
  })

  it('never runs past the ends of the day', () => {
    const { startH, endH } = visibleHourRange([evt(0, 5, 23, 55)], 'fit', undefined, ALL_DAY)
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
    ], 'fit', undefined, ALL_DAY)
    expect(startH).toBe(7)
    expect(endH).toBe(21)
  })

  it('spans from the earliest start to the latest end', () => {
    const { startH, endH } = visibleHourRange([
      evt(9, 5, 9, 55), evt(14, 30, 15, 45), evt(7, 0, 8, 0),
    ], 'fit', undefined, ALL_DAY)
    expect(startH).toBe(6)
    expect(endH).toBeGreaterThanOrEqual(17)
  })

  it('always returns a span of at least one hour', () => {
    const { startH, endH } = visibleHourRange([evt(12, 0, 12, 30)], 'fit', undefined, ALL_DAY)
    expect(endH).toBeGreaterThan(startH)
  })
})

/* ── The hours you are awake ─────────────────────────────────── */

describe('the waking window', () => {
  const NIGHT_OWL  = { startH: 8,  endH: 24 }   // asleep 12am–8am
  const EARLY_BIRD = { startH: 5,  endH: 21 }

  it('does not draw the hours you are asleep', () => {
    const { startH, endH } = visibleHourRange(
      [evt(9, 0, 10, 0)], 'fit', undefined, NIGHT_OWL)
    expect(startH).toBeGreaterThanOrEqual(8)
    expect(endH).toBeLessThanOrEqual(24)
  })

  /*
   * The point of the window is height, and it is only worth having if
   * an early event cannot vanish into the hours it hides.
   */
  it('does not stretch back open for an event inside the sleeping hours', () => {
    const { startH } = visibleHourRange(
      [evt(4, 0, 6, 0), evt(9, 0, 10, 0)], 'fit', undefined, NIGHT_OWL)
    expect(startH).toBe(8)
  })

  it('but that event is reported as outside, so it can still be shown', () => {
    const flight = evt(4, 0, 6, 0)
    const lecture = evt(9, 0, 10, 0)
    const days = [new Date(2026, 8, 7)]
    const outside = eventsOutsideWindow([flight, lecture], days, NIGHT_OWL)
    expect(outside).toHaveLength(1)
    expect(outside[0].startMs).toBe(flight.startMs)
  })

  it('counts nothing as outside when the whole day is drawn', () => {
    const days = [new Date(2026, 8, 7)]
    expect(eventsOutsideWindow([evt(4, 0, 6, 0)], days, { startH: 0, endH: 24 })).toEqual([])
  })

  it('ignores days that are not on screen', () => {
    const days = [new Date(2026, 8, 8)]   // the event is on the 7th
    expect(eventsOutsideWindow([evt(4, 0, 6, 0)], days, NIGHT_OWL)).toEqual([])
  })

  it('honours a different window', () => {
    const { startH } = visibleHourRange(
      [evt(6, 0, 7, 0)], 'fit', undefined, EARLY_BIRD)
    expect(startH).toBeGreaterThanOrEqual(5)
    expect(startH).toBeLessThanOrEqual(6)
  })

  it('still shows the whole day when asked, window or not', () => {
    const { startH, endH } = visibleHourRange([], 'full', undefined, NIGHT_OWL)
    expect(startH).toBe(0)
    expect(endH).toBe(24)
  })
})
