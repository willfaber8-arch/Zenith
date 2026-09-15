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
  /*
   * The range used to follow the events: start at a default working
   * day, stretch to whatever was scheduled, then clamp to the window.
   * That is why "show my day from 8am until 12am" drew 8am to 9pm —
   * the default end was 8pm and nothing was on later to pull it down.
   *
   * The window is the range now. A control that names its hours and
   * then draws fewer of them is a control that lies, and the events
   * that fall outside are listed above the grid rather than dragging
   * it open, which is what makes taking it literally safe.
   */
  it('draws exactly the hours the window names', () => {
    expect(visibleHourRange([], 'fit', undefined, { startH: 8, endH: 24 }))
      .toEqual({ startH: 8, endH: 24 })
    expect(visibleHourRange([], 'fit', undefined, { startH: 6, endH: 18 }))
      .toEqual({ startH: 6, endH: 18 })
  })

  it('does not shrink to the events inside it', () => {
    // One 9am meeting must not collapse an evening you asked to see.
    const { startH, endH } = visibleHourRange(
      [evt(9, 0, 10, 0)], 'fit', undefined, { startH: 8, endH: 24 })
    expect(startH).toBe(8)
    expect(endH).toBe(24)
  })

  it('does not stretch past it for a late event either', () => {
    const { endH } = visibleHourRange(
      [evt(22, 0, 23, 30)], 'fit', undefined, { startH: 8, endH: 21 })
    expect(endH).toBe(21)
  })

  it('is unmoved by all-day and 11:59 deadline events', () => {
    // Those have their own banner row above the grid.
    expect(visibleHourRange([
      evt(23, 59, 23, 59, { is1159: 1 }),
      evt(0, 0, 23, 59, { allDay: 1 }),
    ], 'fit', undefined, { startH: 8, endH: 22 }))
      .toEqual({ startH: 8, endH: 22 })
  })

  it('shows the whole day when asked, whatever the window says', () => {
    expect(visibleHourRange([], 'full', undefined, { startH: 9, endH: 17 }))
      .toEqual({ startH: 0, endH: 24 })
  })

  it('refuses a window too small to be a day', () => {
    // Four hours is the floor; a one-hour "day" is a broken setting,
    // not a preference worth honouring.
    const { startH, endH } = visibleHourRange([], 'fit', undefined, { startH: 9, endH: 10 })
    expect(endH - startH).toBeGreaterThanOrEqual(4)
  })

  it('never runs past the ends of the day', () => {
    const { startH, endH } = visibleHourRange([], 'fit', undefined, { startH: -3, endH: 99 })
    expect(startH).toBeGreaterThanOrEqual(0)
    expect(endH).toBeLessThanOrEqual(24)
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
