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

/*
 * 'fit' by default.
 *
 * This was 'full', which meant the day window below did nothing until
 * you found the toggle — the grid still drew midnight to midnight and
 * still spent a third of its height on hours nobody schedules in. 'fit'
 * is only safe to default to because nothing can hide inside it:
 * anything falling in the skipped hours is listed above the grid, with
 * a button that switches to 'full' for the times you do need 3am.
 */
export function loadHourSpan(): HourSpan {
  try {
    return localStorage.getItem(HOURS_KEY) === 'full' ? 'full' : 'fit'
  } catch {
    return 'fit'
  }
}

export function saveHourSpan(span: HourSpan): void {
  try { localStorage.setItem(HOURS_KEY, span) } catch { /* noop */ }
}

/* ── The hours you are actually awake ────────────────────────────── */

export const DAY_WINDOW_KEY = 'zenith_cal_day_window_v1'

/**
 * The slice of the day the grid draws.
 *
 * A calendar that always renders midnight to midnight spends a third of
 * its height on hours nobody schedules anything in, which is the whole
 * reason the rest of it is too small to read. Saying "I sleep from 12 to
 * 8" buys those eight hours back and gives them to the sixteen that
 * matter.
 *
 * Stored as the waking window rather than the sleeping one, because
 * that is what the grid needs and converting at every read is how the
 * two drift apart. `startH` is inclusive, `endH` exclusive, so 8 → 24
 * is "8am until midnight".
 */
export interface DayWindow {
  startH: number   // 0–23
  endH:   number   // 1–24, always greater than startH
}

/** Awake from 8am to midnight — the sleep window the request described. */
export const DEFAULT_DAY_WINDOW: DayWindow = { startH: 8, endH: 24 }

/** Never let the window collapse to nothing, whatever is in storage. */
export const MIN_WINDOW_HOURS = 4

export function clampDayWindow(w: DayWindow): DayWindow {
  const startH = Math.min(20, Math.max(0, Math.round(w.startH)))
  const endH   = Math.min(24, Math.max(startH + MIN_WINDOW_HOURS, Math.round(w.endH)))
  return { startH, endH }
}

export function loadDayWindow(): DayWindow {
  try {
    const raw = localStorage.getItem(DAY_WINDOW_KEY)
    if (!raw) return DEFAULT_DAY_WINDOW
    const parsed = JSON.parse(raw) as Partial<DayWindow>
    if (typeof parsed?.startH !== 'number' || typeof parsed?.endH !== 'number') {
      return DEFAULT_DAY_WINDOW
    }
    return clampDayWindow({ startH: parsed.startH, endH: parsed.endH })
  } catch {
    return DEFAULT_DAY_WINDOW
  }
}

export function saveDayWindow(w: DayWindow): void {
  try {
    localStorage.setItem(DAY_WINDOW_KEY, JSON.stringify(clampDayWindow(w)))
  } catch { /* noop */ }
}

/** "8am – 12am", for a button that has to say what it will do. */
export function formatHour12(h: number): string {
  const hour = ((h % 24) + 24) % 24
  if (hour === 0)  return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

export function describeDayWindow(w: DayWindow): string {
  return `${formatHour12(w.startH)} – ${formatHour12(w.endH)}`
}
