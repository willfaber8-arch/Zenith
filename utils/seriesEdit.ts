/**
 * utils/seriesEdit.ts — changing the time on something that repeats.
 *
 * Editing one occurrence of a repeat used to carry everything *except*
 * its times to the other occurrences. The reasoning was sound as far as
 * it went: an occurrence's `startMs` is an absolute instant, and writing
 * one instant onto forty rows collapses the whole series onto a single
 * afternoon. So times were dropped, and "this and following" quietly did
 * nothing to the thing people most often want to change.
 *
 * What was missing is that a repeat has two independent parts, and only
 * one of them belongs to the individual occurrence:
 *
 *   · the **date** — which Tuesday this one is. Genuinely per-occurrence.
 *   · the **time of day and duration** — 3pm for an hour. That belongs to
 *     the series, and is what someone means by "I set it at the wrong
 *     time".
 *
 * So a series edit carries the second and leaves the first alone: every
 * occurrence moves to the new time on its own date. Everything here is
 * pure, and the UI runs it to describe an edit before it happens while
 * applyEventPatch runs it to perform one — the preview cannot promise
 * something the write then does differently.
 *
 * All date arithmetic steps by calendar component rather than by adding
 * milliseconds. A day is 23 or 25 hours twice a year, and "same time,
 * next week" has to mean the same clock reading on both sides of that.
 */

/** How a time change on one occurrence reaches the others. */
export type SeriesTimeMode =
  /** Times belong to the occurrence that was edited. Dragging, always. */
  | 'occurrence-only'
  /** Every occurrence takes the new time of day and duration, keeping its own date. */
  | 'time-of-day'
  /** As above, and every occurrence also moves by the same whole-day delta. */
  | 'shift-days'

export interface OccurrenceRow {
  id?:     number
  startMs: number
  endMs:   number
}

export interface PlannedTime {
  id:      number
  startMs: number
  endMs:   number
}

/** Minutes from local midnight. */
export function timeOfDayMinutes(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/** Whole calendar days between two instants, by local date. */
export function wholeDayDelta(fromMs: number, toMs: number): number {
  const a = new Date(fromMs)
  const b = new Date(toMs)
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  /* Round rather than truncate: the two midnights can sit 23 or 25 hours
     apart across a DST boundary, and that is still one day. */
  return Math.round((bMid - aMid) / 86_400_000)
}

/**
 * Put an occurrence at `minutes` past midnight on its own date, running
 * for `durationMs`, optionally `dayShift` days later.
 */
export function moveToTimeOfDay(
  startMs: number,
  minutes: number,
  durationMs: number,
  dayShift = 0,
): { startMs: number; endMs: number } {
  const d = new Date(startMs)
  const moved = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + dayShift,
    Math.floor(minutes / 60),
    minutes % 60,
    0, 0,
  ).getTime()
  return { startMs: moved, endMs: moved + durationMs }
}

export interface SeriesTimePlanInput {
  /** Every row the chosen scope reaches. */
  rows: OccurrenceRow[]
  /** The row being edited, by its table id. */
  clickedId: number
  /** What the form produced for the edited occurrence. */
  target: { startMs: number; endMs: number }
  /**
   * Instant before which an occurrence keeps its existing time.
   *
   * Set to the start of today for an "all events" edit: a repeat whose
   * time was wrong should be fixed going forward, but rewriting when
   * last week's occurrences happened turns the calendar's own history
   * into a guess. The edited occurrence is always moved regardless —
   * it is the one being looked at.
   */
  protectBeforeMs?: number
}

/**
 * Work out each row's new time.
 *
 * Returns only the rows that actually move, so a caller can both count
 * them for a preview and write exactly those.
 */
export function planSeriesTimes(
  mode: SeriesTimeMode,
  input: SeriesTimePlanInput,
): PlannedTime[] {
  const { rows, clickedId, target, protectBeforeMs } = input

  const clicked = rows.find(r => r.id === clickedId)
  const out: PlannedTime[] = []

  /* The edited occurrence always lands exactly where the form put it. */
  if (clicked?.id != null
      && (clicked.startMs !== target.startMs || clicked.endMs !== target.endMs)) {
    out.push({ id: clicked.id, startMs: target.startMs, endMs: target.endMs })
  }

  if (mode === 'occurrence-only') return out

  const minutes    = timeOfDayMinutes(target.startMs)
  const durationMs = target.endMs - target.startMs
  const dayShift   = mode === 'shift-days' && clicked
    ? wholeDayDelta(clicked.startMs, target.startMs)
    : 0

  for (const row of rows) {
    if (row.id == null || row.id === clickedId) continue
    if (protectBeforeMs !== undefined && row.startMs < protectBeforeMs) continue

    const next = moveToTimeOfDay(row.startMs, minutes, durationMs, dayShift)
    if (next.startMs === row.startMs && next.endMs === row.endMs) continue
    out.push({ id: row.id, ...next })
  }

  return out
}

/** Local midnight for the day containing `ms` — the usual protect-before. */
export function startOfLocalDay(ms: number = Date.now()): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export interface TimeChangeShape {
  /** The clock reading moved (3pm → 4pm), or the duration changed. */
  timeChanged: boolean
  /** The occurrence was put on a different calendar date. */
  dateChanged: boolean
  /** Whole days between the original date and the new one. */
  dayDelta:    number
}

/**
 * What the form actually changed about an occurrence's timing.
 *
 * The UI asks this to decide whether it has anything to explain, and
 * whether the date question needs asking at all — a plain "3pm → 4pm"
 * has one obvious meaning and should not interrupt anyone.
 */
export function describeTimeChange(
  original: { startMs: number; endMs: number },
  target:   { startMs: number; endMs: number },
): TimeChangeShape {
  const dayDelta = wholeDayDelta(original.startMs, target.startMs)
  return {
    timeChanged: timeOfDayMinutes(original.startMs) !== timeOfDayMinutes(target.startMs)
              || (original.endMs - original.startMs) !== (target.endMs - target.startMs),
    dateChanged: dayDelta !== 0,
    dayDelta,
  }
}
