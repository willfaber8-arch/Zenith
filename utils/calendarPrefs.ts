/**
 * utils/calendarPrefs.ts — small calendar preferences that persist.
 *
 * Two settings that only make sense together with direct manipulation:
 * whether events can be dragged at all, and how much of the day is
 * drawn.
 */

export const LOCK_KEY  = 'zenith_cal_locked_v1'
export const HOURS_KEY = 'zenith_cal_hours_v1'

/**
 * Locked by default.
 *
 * Dragging is one gesture away from moving a class to the wrong week,
 * and most visits to a calendar are to read it. Editing should be
 * something you turn on, not something you avoid.
 */
export function loadLocked(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveLocked(locked: boolean): void {
  try { localStorage.setItem(LOCK_KEY, locked ? 'on' : 'off') } catch { /* noop */ }
}

/**
 * How much of the day the week grid draws.
 *
 * 'full' shows all twenty-four hours so nothing is out of reach — you
 * cannot drag an event to 11pm through an hour that is not rendered.
 * 'fit' shows only the hours that hold something, which is what lets a
 * week sit on screen without scrolling. The two genuinely conflict, so
 * this is a choice rather than a guess.
 */
export type HourSpan = 'full' | 'fit'

export function loadHourSpan(): HourSpan {
  try {
    return localStorage.getItem(HOURS_KEY) === 'fit' ? 'fit' : 'full'
  } catch {
    return 'full'
  }
}

export function saveHourSpan(span: HourSpan): void {
  try { localStorage.setItem(HOURS_KEY, span) } catch { /* noop */ }
}
