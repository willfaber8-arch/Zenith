/**
 * lib/personalEventSeries.ts — an event that happens more than once.
 *
 * Your own events were a single row on a single day, so a standing
 * Tuesday seminar had to be typed in every week — which nobody does, so
 * it ends up not being in the calendar at all.
 *
 * A repeat is expanded into concrete rows here, sharing a `seriesUid`,
 * rather than stored as a rule evaluated when the grid draws. That is
 * the same shape imported iCal events already take (see utils/recurrence
 * and the note on expansion in CLAUDE.md), and it means every view,
 * drag, undo, export and search keeps working on rows. A second
 * representation is how a calendar starts disagreeing with itself about
 * what is on Tuesday.
 */

import { db, type PersonalEvent } from '@/lib/db'
import { expandOccurrences } from '@/utils/recurrence'
import { isRepeatPreset, ruleFor, type RepeatPreset } from '@/utils/taskRepeat'

/**
 * How far ahead a repeat is written out.
 *
 * Long enough that a term or a year of a standing commitment is really
 * there, short enough that "every day, forever" does not put tens of
 * thousands of rows in a local database to make one grid look right.
 */
export const MAX_EVENT_OCCURRENCES = 260

/** Two years, for a repeat with no end date. */
export const SERIES_HORIZON_YEARS = 2

function newSeriesUid(): string {
  return `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export interface CreateResult {
  /** Rows written — 1 for a one-off. */
  count: number
  seriesUid?: string
}

/**
 * Add an event, once or repeating.
 *
 * `repeat` is a RepeatPreset from utils/taskRepeat; anything else, including
 * 'none' and undefined, writes the single row it always did.
 */
export async function createPersonalEvent(
  data: Omit<PersonalEvent, 'id'>,
  repeat?: string,
  opts: { until?: number } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const preset: RepeatPreset | null =
    isRepeatPreset(repeat) && repeat !== 'none' ? repeat : null
  const rule = preset ? ruleFor(preset) : null

  if (!rule) {
    await db.personalEvents.add(data as PersonalEvent)
    return { count: 1 }
  }

  const start = new Date(data.startMs)
  const horizonMs = new Date(
    start.getFullYear() + SERIES_HORIZON_YEARS, start.getMonth(), start.getDate(),
  ).getTime()

  const occurrences = expandOccurrences(
    data.startMs,
    data.endMs,
    opts.until !== undefined ? { ...rule, until: opts.until } : rule,
    [],
    { maxOccurrences: MAX_EVENT_OCCURRENCES, horizonMs },
  )

  /* One row is not a series — it would make the UI ask "this or all?"
     about an event that has no siblings. */
  if (occurrences.length <= 1) {
    await db.personalEvents.add(data as PersonalEvent)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()
  const rows = occurrences.map(o => ({
    ...data,
    startMs: o.startMs,
    endMs:   o.endMs,
    seriesUid,
    repeat:  preset,
  })) as PersonalEvent[]

  await db.personalEvents.bulkAdd(rows)
  return { count: rows.length, seriesUid }
}

/**
 * Turn an event you already made into a repeating one.
 *
 * The picker used to appear only while creating, so an event made
 * yesterday could never be made to repeat — you had to delete it and
 * type it again. That is the shape of a missing feature, not a
 * decision, and it is what someone means when they say there is no
 * repeat option on their events.
 *
 * The original row is kept as the first occurrence rather than deleted
 * and rewritten, so its id survives: undo snapshots, and anything else
 * holding onto it, still point at something real.
 */
export async function repeatExistingEvent(
  rowId: number,
  data:  Omit<PersonalEvent, 'id'>,
  repeat: string,
  opts: { until?: number } = {},
): Promise<CreateResult> {
  if (!db) return { count: 0 }

  const preset: RepeatPreset | null =
    isRepeatPreset(repeat) && repeat !== 'none' ? repeat : null
  const rule = preset ? ruleFor(preset) : null

  if (!rule) {
    await db.personalEvents.update(rowId, data as Partial<PersonalEvent>)
    return { count: 1 }
  }

  const start = new Date(data.startMs)
  const horizonMs = new Date(
    start.getFullYear() + SERIES_HORIZON_YEARS, start.getMonth(), start.getDate(),
  ).getTime()

  const occurrences = expandOccurrences(
    data.startMs, data.endMs,
    opts.until !== undefined ? { ...rule, until: opts.until } : rule,
    [],
    { maxOccurrences: MAX_EVENT_OCCURRENCES, horizonMs },
  )

  if (occurrences.length <= 1) {
    await db.personalEvents.update(rowId, data as Partial<PersonalEvent>)
    return { count: 1 }
  }

  const seriesUid = newSeriesUid()

  /* The one you edited becomes occurrence one, keeping its id. */
  const [first, ...rest] = occurrences
  await db.personalEvents.update(rowId, {
    ...data, startMs: first.startMs, endMs: first.endMs, seriesUid, repeat: preset,
  } as Partial<PersonalEvent>)

  if (rest.length > 0) {
    await db.personalEvents.bulkAdd(rest.map(o => ({
      ...data, startMs: o.startMs, endMs: o.endMs, seriesUid, repeat: preset,
    })) as PersonalEvent[])
  }

  return { count: occurrences.length, seriesUid }
}
