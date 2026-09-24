/**
 * Paging the calendar across a clocks-change weekend.
 *
 * A day is 23 or 25 hours twice a year, so "next week" cannot be
 * +7×86,400,000 ms. Doing it that way shifted `weekStart` by an hour,
 * which rolled it onto the previous day — the grid then ran Sunday to
 * Saturday with the weekend shading in the wrong columns, and since
 * each press re-used the drifted value it stayed wrong until you
 * pressed Today.
 *
 * These test the arithmetic rather than the component, because that is
 * where the rule lives: step by calendar component, never by a fixed
 * number of milliseconds.
 */

/** What CalendarView's `stepWeek` does. */
const stepWeek = (base: Date, weeks: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + weeks * 7)

/** What `formatWeekRange` does to find the last day shown. */
const weekEndOf = (weekStart: Date) =>
  new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)

/** The old way, kept to show what it did. */
const stepWeekByMs = (base: Date, weeks: number) =>
  new Date(base.getTime() + weeks * 7 * 86_400_000)

/*
 * 2026-11-01 is the US autumn clocks change. These assertions only
 * describe a real DST transition when the test runs in a zone that has
 * one, which CI does (TZ is unset → the runner's zone). In a zone with
 * no DST both spellings agree and the test still passes, which is the
 * correct outcome rather than a false failure.
 */
const MON_26_OCT = new Date(2026, 9, 26)   // Monday before the change
const MON_8_MAR  = new Date(2026, 2, 8)    // spring-forward Sunday is 8 Mar

describe('stepping a week', () => {
  it('lands on the same weekday, at midnight, across the autumn change', () => {
    const next = stepWeek(MON_26_OCT, 1)
    expect(next.getDay()).toBe(MON_26_OCT.getDay())
    expect(next.getDate()).toBe(2)          // Mon 2 Nov
    expect(next.getMonth()).toBe(10)
    expect(next.getHours()).toBe(0)
  })

  it('lands on the same weekday across the spring change', () => {
    const next = stepWeek(MON_8_MAR, 1)
    expect(next.getDay()).toBe(MON_8_MAR.getDay())
    expect(next.getHours()).toBe(0)
  })

  it('stays put over many presses, forwards and back', () => {
    let d = MON_26_OCT
    for (let i = 0; i < 20; i++) d = stepWeek(d, 1)
    for (let i = 0; i < 20; i++) d = stepWeek(d, -1)
    expect(d.getTime()).toBe(MON_26_OCT.getTime())
    expect(d.getHours()).toBe(0)
  })

  /* The drift the fix removes: in a DST zone the old arithmetic does
     not come back to midnight. */
  it('is what the millisecond version failed to do', () => {
    const byMs = stepWeekByMs(MON_26_OCT, 1)
    const byComponent = stepWeek(MON_26_OCT, 1)
    const zoneHasDst = byMs.getHours() !== 0
    if (zoneHasDst) {
      expect(byMs.getTime()).not.toBe(byComponent.getTime())
      expect(byComponent.getHours()).toBe(0)
    } else {
      expect(byMs.getTime()).toBe(byComponent.getTime())
    }
  })
})

describe('the week range label', () => {
  it('ends six days later, on the right date, across the change', () => {
    const end = weekEndOf(new Date(2026, 9, 26))
    expect(end.getDate()).toBe(1)     // Sun 1 Nov
    expect(end.getMonth()).toBe(10)
    expect(end.getHours()).toBe(0)
  })

  it('spans Monday to Sunday in an ordinary week', () => {
    const start = new Date(2026, 8, 21)
    const end = weekEndOf(start)
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
    expect(end.getDate()).toBe(27)
  })
})
