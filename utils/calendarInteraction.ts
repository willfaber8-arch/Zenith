/**
 * utils/calendarInteraction.ts — the arithmetic behind dragging events.
 *
 * Moving an event across a week grid and resizing it by its bottom edge
 * are both pixel-to-time conversions with rules attached: snap to a
 * sensible minute, never let an event end before it starts, never let a
 * drag push it off the day it belongs to.
 *
 * Kept pure and out of the component because this is where the bugs
 * live — a drag that lands 15 minutes off, or a resize that inverts an
 * event, is a arithmetic mistake, not a rendering one.
 */

/** Dragging snaps to this, which is what a timetable is written in. */
export const SNAP_MINUTES = 15

/** An event can never be shortened past this. */
export const MIN_DURATION_MINUTES = 15

export interface DragGeometry {
  /** Pixels per hour in the current grid. */
  hourPx:   number
  /** First hour drawn, as a float — the grid does not start at midnight. */
  dayStart: number
  /** Width of one day column, in pixels. */
  columnPx: number
}

/** Round a minute count to the nearest snap step. */
export function snapMinutes(mins: number, step = SNAP_MINUTES): number {
  if (!Number.isFinite(mins)) return 0
  return Math.round(mins / step) * step
}

/**
 * Convert a vertical drag into a change in minutes.
 *
 * Snapped, so an event dropped between two lines lands on one of them
 * rather than at 10:07.
 */
export function deltaMinutesFromPx(dy: number, hourPx: number, step = SNAP_MINUTES): number {
  if (!Number.isFinite(dy) || !Number.isFinite(hourPx) || hourPx <= 0) return 0
  return snapMinutes((dy / hourPx) * 60, step)
}

/**
 * Convert a horizontal drag into a whole number of days.
 *
 * Rounded rather than truncated: dragging most of the way to the next
 * column should land there, which is what the hand expects.
 */
export function deltaDaysFromPx(dx: number, columnPx: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(columnPx) || columnPx <= 0) return 0
  return Math.round(dx / columnPx)
}

export interface MoveResult {
  startMs: number
  endMs:   number
}

/**
 * Where an event lands after being dragged.
 *
 * Duration is preserved exactly — moving an event is not a resize — and
 * the day shift is applied with the local date setter so a move across
 * a daylight-saving boundary keeps its wall-clock time.
 */
export function applyMove(
  startMs: number,
  endMs:   number,
  deltaDays:    number,
  deltaMinutes: number,
): MoveResult {
  const duration = Math.max(0, endMs - startMs)
  const d = new Date(startMs)
  if (deltaDays !== 0) d.setDate(d.getDate() + deltaDays)
  if (deltaMinutes !== 0) d.setMinutes(d.getMinutes() + deltaMinutes)
  const nextStart = d.getTime()
  return { startMs: nextStart, endMs: nextStart + duration }
}

/**
 * Where an event's end lands after its bottom edge is dragged.
 *
 * Clamped so an event can never end before it starts — dragging the
 * bottom edge above the top would otherwise produce a negative
 * duration, which the grid draws as an invisible sliver and the day
 * view cannot represent at all.
 */
export function applyResize(
  startMs: number,
  endMs:   number,
  deltaMinutes: number,
  minMinutes = MIN_DURATION_MINUTES,
): MoveResult {
  const d = new Date(endMs)
  d.setMinutes(d.getMinutes() + deltaMinutes)
  const floor = startMs + minMinutes * 60_000
  return { startMs, endMs: Math.max(floor, d.getTime()) }
}

/**
 * Keep a moved event inside the hours the grid is drawing.
 *
 * Without this a drag upward can push an event above the first rendered
 * hour, where it is painted off the top of the column and looks deleted.
 */
export function clampToVisibleDay(
  move:     MoveResult,
  dayStart: number,
  dayEnd:   number,
): MoveResult {
  const start = new Date(move.startMs)
  const mins  = start.getHours() * 60 + start.getMinutes()
  const duration = move.endMs - move.startMs

  const lowest  = dayStart * 60
  const highest = dayEnd * 60 - duration / 60_000

  if (mins < lowest) {
    start.setHours(Math.floor(lowest / 60), lowest % 60, 0, 0)
  } else if (highest > lowest && mins > highest) {
    start.setHours(Math.floor(highest / 60), Math.round(highest % 60), 0, 0)
  } else {
    return move
  }
  const s = start.getTime()
  return { startMs: s, endMs: s + duration }
}

/**
 * Where a details popover should sit next to the event it describes.
 *
 * Prefers the right of the event, flips to the left when that would run
 * off screen, and slides vertically to stay in view — an anchored card
 * that opens half off the edge is worse than one that moved.
 */
export function popoverPosition(
  anchor:   { left: number; top: number; right: number; bottom: number },
  card:     { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 10,
): { left: number; top: number; side: 'right' | 'left' } {
  const fitsRight = anchor.right + gap + card.width <= viewport.width
  const side: 'right' | 'left' = fitsRight ? 'right' : 'left'
  const rawLeft = fitsRight ? anchor.right + gap : anchor.left - gap - card.width
  const left = Math.max(gap, Math.min(rawLeft, viewport.width - card.width - gap))

  const rawTop = anchor.top
  const top = Math.max(gap, Math.min(rawTop, viewport.height - card.height - gap))

  return { left, top, side }
}
