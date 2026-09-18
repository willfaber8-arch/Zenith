/**
 * lib/calendarNavState.ts — deep-linking to a tab of the Universal Calendar.
 *
 * The Work Due widget used to open Study Shield, because that is where
 * the work list was. The list lives in the Calendar's Tasks tab now, and
 * "open the Calendar" alone would land on Personal — the week grid —
 * which is not what you clicked a card headed "Work Due" to see.
 *
 * Mirrors lib/gamesNavState deliberately, including the two delivery
 * paths, because the same two situations arise: the view may be
 * mounting fresh, or already on screen.
 *   1. Fresh mount    — CalendarView reads peekCalendarTab() in its
 *      useState initialiser (pure, non-clearing — StrictMode-safe) and
 *      consumes it in a mount effect.
 *   2. Already mounted — CalendarView subscribes and switches at once.
 */

export type CalendarTab = 'personal' | 'tasks'

let _requested: CalendarTab | null = null
const listeners = new Set<(tab: CalendarTab) => void>()

/** Set the tab the Calendar should open to, and notify a live view. */
export function requestCalendarTab(tab: CalendarTab): void {
  _requested = tab
  listeners.forEach(fn => fn(tab))
}

/** Non-clearing read — safe to call from a useState initialiser. */
export function peekCalendarTab(): CalendarTab | null {
  return _requested
}

/** Read and clear the pending request. */
export function consumeCalendarTab(): CalendarTab | null {
  const t = _requested
  _requested = null
  return t
}

/** Subscribe a live CalendarView so deep-links work without a remount. */
export function subscribeCalendarTab(fn: (tab: CalendarTab) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
