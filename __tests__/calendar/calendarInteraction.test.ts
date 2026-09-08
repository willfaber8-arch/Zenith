/**
 * Dragging events around the week grid.
 *
 * The failures here are arithmetic, not rendering: a drop that lands 15
 * minutes off, a resize that inverts an event into a negative duration,
 * a move that pushes something above the first drawn hour where it is
 * painted off the top of the column and looks deleted.
 */

import {
  snapMinutes, deltaMinutesFromPx, deltaDaysFromPx,
  applyMove, applyResize, clampToVisibleDay, popoverPosition,
  SNAP_MINUTES, MIN_DURATION_MINUTES,
} from '@/utils/calendarInteraction'

const at = (h: number, m = 0) => new Date(2026, 8, 7, h, m).getTime()
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

describe('snapping', () => {
  it('rounds to the nearest quarter hour', () => {
    expect(snapMinutes(7)).toBe(0)             // rounds down
    expect(snapMinutes(8)).toBe(SNAP_MINUTES)  // rounds up
    expect(snapMinutes(22)).toBe(15)
    expect(snapMinutes(23)).toBe(30)
    expect(snapMinutes(0)).toBe(0)
  })

  it('survives nonsense without producing NaN', () => {
    expect(snapMinutes(NaN)).toBe(0)
    expect(snapMinutes(Infinity)).toBe(0)
  })
})

describe('pixels to time', () => {
  it('converts a vertical drag into snapped minutes', () => {
    expect(deltaMinutesFromPx(60, 60)).toBe(60)   // one hour tall = one hour
    expect(deltaMinutesFromPx(30, 60)).toBe(30)
    expect(deltaMinutesFromPx(-60, 60)).toBe(-60)
  })

  it('snaps a drag that lands between lines', () => {
    // Dropped at 10:07 should become 10:00, not stay at 10:07.
    expect(deltaMinutesFromPx(7, 60)).toBe(0)
    expect(deltaMinutesFromPx(9, 60)).toBe(15)
  })

  it('refuses to divide by a zero-height hour', () => {
    expect(deltaMinutesFromPx(50, 0)).toBe(0)
    expect(Number.isFinite(deltaMinutesFromPx(50, NaN))).toBe(true)
  })

  it('rounds a horizontal drag to the nearest column', () => {
    // Most of the way to the next day should land there.
    expect(deltaDaysFromPx(120, 200)).toBe(1)
    expect(deltaDaysFromPx(70, 200)).toBe(0)
    expect(deltaDaysFromPx(-180, 200)).toBe(-1)
  })

  it('refuses a zero-width column', () => {
    expect(deltaDaysFromPx(100, 0)).toBe(0)
  })
})

describe('applyMove', () => {
  it('shifts an event and keeps its length exactly', () => {
    // Moving is not resizing — duration must survive untouched.
    const r = applyMove(at(9), at(10, 30), 1, 60)
    expect(hhmm(r.startMs)).toBe('10:00')
    expect(r.endMs - r.startMs).toBe(90 * 60_000)
    expect(new Date(r.startMs).getDate()).toBe(8)
  })

  it('moves backwards as readily as forwards', () => {
    const r = applyMove(at(9), at(10), -2, -30)
    expect(hhmm(r.startMs)).toBe('08:30')
    expect(new Date(r.startMs).getDate()).toBe(5)
  })

  it('does nothing when nothing moved', () => {
    const r = applyMove(at(9), at(10), 0, 0)
    expect(r).toEqual({ startMs: at(9), endMs: at(10) })
  })

  it('keeps wall-clock time when a move crosses a month boundary', () => {
    const r = applyMove(at(9), at(10), 25, 0)
    expect(hhmm(r.startMs)).toBe('09:00')
  })
})

describe('applyResize', () => {
  it('extends an event by dragging its bottom edge down', () => {
    const r = applyResize(at(9), at(10), 30)
    expect(hhmm(r.endMs)).toBe('10:30')
    expect(r.startMs).toBe(at(9))
  })

  it('shortens an event by dragging up', () => {
    expect(hhmm(applyResize(at(9), at(11), -60).endMs)).toBe('10:00')
  })

  it('never lets an event end before it starts', () => {
    // A negative duration draws as an invisible sliver and the day view
    // cannot represent it at all.
    const r = applyResize(at(9), at(10), -600)
    expect(r.endMs).toBeGreaterThan(r.startMs)
    expect(r.endMs - r.startMs).toBe(MIN_DURATION_MINUTES * 60_000)
  })

  it('holds the floor exactly at the minimum duration', () => {
    const r = applyResize(at(9), at(9, 30), -15)
    expect(r.endMs - r.startMs).toBe(MIN_DURATION_MINUTES * 60_000)
  })

  it('never moves the start', () => {
    for (const d of [-500, -30, 0, 45, 900]) {
      expect(applyResize(at(9), at(10), d).startMs).toBe(at(9))
    }
  })
})

describe('clampToVisibleDay', () => {
  it('leaves an event inside the drawn hours alone', () => {
    const m = { startMs: at(10), endMs: at(11) }
    expect(clampToVisibleDay(m, 7, 21)).toEqual(m)
  })

  it('pulls an event back down when dragged above the first hour', () => {
    // Above the top of the column it is painted off-screen and looks deleted.
    const r = clampToVisibleDay({ startMs: at(3), endMs: at(4) }, 7, 21)
    expect(hhmm(r.startMs)).toBe('07:00')
    expect(r.endMs - r.startMs).toBe(60 * 60_000)
  })

  it('pulls an event back up when dragged past the last hour', () => {
    const r = clampToVisibleDay({ startMs: at(23), endMs: at(23, 59) }, 7, 21)
    expect(new Date(r.startMs).getHours()).toBeLessThanOrEqual(21)
  })

  it('keeps duration through a clamp', () => {
    const r = clampToVisibleDay({ startMs: at(2), endMs: at(4) }, 7, 21)
    expect(r.endMs - r.startMs).toBe(2 * 60 * 60_000)
  })
})

describe('popoverPosition', () => {
  const card = { width: 280, height: 200 }
  const vp   = { width: 1200, height: 800 }

  it('sits to the right of the event when there is room', () => {
    const p = popoverPosition({ left: 300, top: 200, right: 420, bottom: 260 }, card, vp)
    expect(p.side).toBe('right')
    expect(p.left).toBeGreaterThan(420)
  })

  it('flips to the left rather than opening off the edge', () => {
    const p = popoverPosition({ left: 1000, top: 200, right: 1150, bottom: 260 }, card, vp)
    expect(p.side).toBe('left')
    expect(p.left + card.width).toBeLessThanOrEqual(vp.width)
  })

  it('slides up so a card near the bottom stays fully visible', () => {
    const p = popoverPosition({ left: 300, top: 760, right: 420, bottom: 790 }, card, vp)
    expect(p.top + card.height).toBeLessThanOrEqual(vp.height)
  })

  it('never positions the card off the top or left', () => {
    const p = popoverPosition({ left: 0, top: -50, right: 40, bottom: 10 }, card, vp)
    expect(p.left).toBeGreaterThanOrEqual(0)
    expect(p.top).toBeGreaterThanOrEqual(0)
  })

  it('stays on screen even when the card barely fits', () => {
    const tiny = { width: 1190, height: 790 }
    const p = popoverPosition({ left: 600, top: 400, right: 700, bottom: 440 }, tiny, vp)
    expect(p.left).toBeGreaterThanOrEqual(0)
    expect(p.top).toBeGreaterThanOrEqual(0)
  })
})
