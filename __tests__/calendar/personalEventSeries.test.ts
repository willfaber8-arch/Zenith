/**
 * An event that happens more than once.
 *
 * Your own events were a single row on a single day, so a standing
 * Tuesday seminar had to be retyped every week — which nobody does, so
 * it ends up not being in the calendar at all.
 */

import { db, type PersonalEvent, type CalendarEvent } from '@/lib/db'
import { createPersonalEvent, repeatExistingEvent, MAX_EVENT_OCCURRENCES } from '@/lib/personalEventSeries'
import { removeEvent, applyEventPatch, seriesSize, PERSONAL_FEED_ID } from '@/lib/calendarMutations'

const at = (y: number, m: number, d: number, h: number) => new Date(y, m, d, h).getTime()

beforeEach(async () => { await db.personalEvents.clear() })

const base = (over: Partial<PersonalEvent> = {}): Omit<PersonalEvent, 'id'> => ({
  title: 'Seminar',
  startMs: at(2026, 8, 15, 10),
  endMs:   at(2026, 8, 15, 11),
  allDay: 0, color: '#7c95ff', category: 'personal', createdAt: Date.now(),
  ...over,
} as Omit<PersonalEvent, 'id'>)

/** The shape the grid hands the mutation layer — note the negated id. */
async function asGridEvent(title: string): Promise<CalendarEvent> {
  const row = (await db.personalEvents.toArray()).find(r => r.title === title)!
  return {
    id: row.id * -1, feedId: PERSONAL_FEED_ID, uid: `personal-${row.id}`,
    title: row.title, startMs: row.startMs, endMs: row.endMs,
    allDay: row.allDay, is1159: 0, category: row.category,
    seriesUid: row.seriesUid,
  } as CalendarEvent
}

describe('creating', () => {
  it('writes one row when it does not repeat', async () => {
    const res = await createPersonalEvent(base(), 'none')
    expect(res.count).toBe(1)
    expect(res.seriesUid).toBeUndefined()
    expect(await db.personalEvents.count()).toBe(1)
  })

  it('treats a missing repeat as once', async () => {
    expect((await createPersonalEvent(base())).count).toBe(1)
  })

  it('writes a row per occurrence, sharing a series', async () => {
    const res = await createPersonalEvent(base(), 'weekly')
    expect(res.count).toBeGreaterThan(50)          // two years of Tuesdays
    const rows = await db.personalEvents.toArray()
    expect(new Set(rows.map(r => r.seriesUid)).size).toBe(1)
    expect(rows.every(r => r.repeat === 'weekly')).toBe(true)
  })

  it('keeps the time of day and the duration on every occurrence', async () => {
    await createPersonalEvent(base(), 'weekly')
    const rows = await db.personalEvents.orderBy('startMs').toArray()
    for (const r of rows.slice(0, 8)) {
      expect(new Date(r.startMs).getHours()).toBe(10)
      expect(r.endMs - r.startMs).toBe(60 * 60 * 1000)
    }
  })

  it('puts the first occurrence on the date you chose', async () => {
    await createPersonalEvent(base(), 'weekly')
    const first = (await db.personalEvents.orderBy('startMs').first())!
    expect(new Date(first.startMs).getDate()).toBe(15)
  })

  it('steps a daily repeat by one day', async () => {
    await createPersonalEvent(base(), 'daily')
    const rows = await db.personalEvents.orderBy('startMs').toArray()
    const gap = rows[1].startMs - rows[0].startMs
    expect(gap).toBe(24 * 60 * 60 * 1000)
  })

  it('does not write an unbounded number of rows', async () => {
    const res = await createPersonalEvent(base(), 'daily')
    expect(res.count).toBeLessThanOrEqual(MAX_EVENT_OCCURRENCES)
  })

  it('stops at an end date when one is given', async () => {
    const res = await createPersonalEvent(base(), 'weekly', { until: at(2026, 9, 15, 23) })
    expect(res.count).toBeLessThanOrEqual(5)
    expect(res.count).toBeGreaterThan(1)
  })
})

describe('editing and deleting an occurrence', () => {
  /*
   * The grid negates personal ids so they cannot collide with imported
   * ones. That sign was never coming off, so deleting your own event
   * called personalEvents.delete(-3), matched nothing, and reported
   * success — the popover said "Event deleted" and it stayed put.
   */
  it('deletes the one you clicked, through the grid id', async () => {
    await createPersonalEvent(base(), 'none')
    const ev = await asGridEvent('Seminar')
    expect(await removeEvent(ev, 'this')).toBe(1)
    expect(await db.personalEvents.count()).toBe(0)
  })

  it('deletes one occurrence without touching the rest', async () => {
    await createPersonalEvent(base(), 'weekly')
    const total = await db.personalEvents.count()
    const ev = await asGridEvent('Seminar')
    await removeEvent(ev, 'this')
    expect(await db.personalEvents.count()).toBe(total - 1)
  })

  it('deletes the whole series when asked', async () => {
    await createPersonalEvent(base(), 'weekly')
    const ev = await asGridEvent('Seminar')
    const n = await removeEvent(ev, 'series')
    expect(n).toBeGreaterThan(1)
    expect(await db.personalEvents.count()).toBe(0)
  })

  it('knows how many occurrences there are, so the UI can ask', async () => {
    await createPersonalEvent(base(), 'weekly')
    expect(await seriesSize(await asGridEvent('Seminar'))).toBeGreaterThan(1)

    await db.personalEvents.clear()
    await createPersonalEvent(base({ title: 'One off' }), 'none')
    expect(await seriesSize(await asGridEvent('One off'))).toBe(1)
  })

  it('renames the whole series but moves only the one you touched', async () => {
    await createPersonalEvent(base(), 'weekly')
    const ev = await asGridEvent('Seminar')
    const movedTo = ev.startMs + 2 * 60 * 60 * 1000
    await applyEventPatch(ev, { title: 'Renamed', startMs: movedTo }, 'series')

    const rows = await db.personalEvents.orderBy('startMs').toArray()
    expect(rows.every(r => r.title === 'Renamed')).toBe(true)
    /* Exactly one row moved: a title belongs to the series, a time to
       the occurrence. Shifting every Tuesday by editing one of them is
       not what editing one of them means. */
    expect(rows.filter(r => new Date(r.startMs).getHours() === 12)).toHaveLength(1)
    expect(rows.filter(r => new Date(r.startMs).getHours() === 10).length).toBeGreaterThan(1)
  })
})

/*
 * The picker used to appear only while creating, so an event made
 * yesterday could never be made to repeat — you had to delete it and
 * type it again. That is the shape of a missing feature, and it is what
 * someone means when they say there is no repeat option on their events.
 */
describe('making an event you already have repeat', () => {
  it('keeps the original row as the first occurrence', async () => {
    await createPersonalEvent(base(), 'none')
    const original = (await db.personalEvents.toArray())[0]

    const res = await repeatExistingEvent(original.id, base(), 'weekly')
    expect(res.count).toBeGreaterThan(1)

    /* Its id survives, so undo snapshots still point at something real. */
    const kept = await db.personalEvents.get(original.id)
    expect(kept).toBeDefined()
    expect(kept?.seriesUid).toBe(res.seriesUid)
    expect(kept?.startMs).toBe(original.startMs)
  })

  it('puts every occurrence in one series', async () => {
    await createPersonalEvent(base(), 'none')
    const original = (await db.personalEvents.toArray())[0]
    await repeatExistingEvent(original.id, base(), 'weekly')

    const rows = await db.personalEvents.toArray()
    expect(new Set(rows.map(r => r.seriesUid)).size).toBe(1)
    expect(rows.every(r => r.repeat === 'weekly')).toBe(true)
  })

  it('carries an edit made in the same save across the whole series', async () => {
    await createPersonalEvent(base(), 'none')
    const original = (await db.personalEvents.toArray())[0]
    await repeatExistingEvent(original.id, base({ title: 'Renamed' }), 'weekly')

    const rows = await db.personalEvents.toArray()
    expect(rows.every(r => r.title === 'Renamed')).toBe(true)
  })

  it('just updates the row when no repeat is asked for', async () => {
    await createPersonalEvent(base(), 'none')
    const original = (await db.personalEvents.toArray())[0]

    const res = await repeatExistingEvent(original.id, base({ title: 'Still one' }), 'none')
    expect(res.count).toBe(1)
    expect(await db.personalEvents.count()).toBe(1)
    expect((await db.personalEvents.get(original.id))?.title).toBe('Still one')
    expect((await db.personalEvents.get(original.id))?.seriesUid).toBeUndefined()
  })
})
