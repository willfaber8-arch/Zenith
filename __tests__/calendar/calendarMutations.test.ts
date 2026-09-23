/**
 * Editing an event that repeats.
 *
 * A repeating event is stored as one row per occurrence sharing a
 * seriesUid, so "this one" and "all of them" are the same operation over
 * a different set of rows. The rules worth pinning down are the ones
 * that would quietly destroy work: a series edit must not drag every
 * occurrence to the same time, and touching an imported event must mark
 * it so the next feed refresh does not revert it.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import {
  applyEventPatch, removeEvent, commitDrag, seriesSize, isPersonal,
  PERSONAL_FEED_ID,
} from '@/lib/calendarMutations'
import type { CalendarEvent } from '@/lib/db'

const H = 3_600_000
const base = new Date(2026, 8, 7, 14, 0).getTime()

async function seedSeries(count = 4): Promise<CalendarEvent[]> {
  await db.calendarEvents.clear()
  const rows = Array.from({ length: count }, (_, i) => ({
    feedId: 1,
    uid: `cls::${i}`,
    seriesUid: 'cls',
    locallyEdited: 0,
    title: 'CHEM 2090',
    startMs: base + i * 7 * 24 * H,
    endMs:   base + i * 7 * 24 * H + H,
    allDay: 0, is1159: 0, category: 'scholastic',
    location: 'Baker 200',
  }))
  await db.calendarEvents.bulkAdd(rows as CalendarEvent[])
  return db.calendarEvents.toArray()
}

beforeEach(async () => {
  await db.calendarEvents.clear()
  await db.personalEvents.clear()
})

describe('seriesSize', () => {
  it('counts the occurrences of a repeat', async () => {
    const rows = await seedSeries(5)
    expect(await seriesSize(rows[0])).toBe(5)
  })

  it('reports a one-off as 1, so the UI does not ask a pointless question', async () => {
    await db.calendarEvents.add({
      feedId: 1, uid: 'solo', seriesUid: 'solo', title: 'One off',
      startMs: base, endMs: base + H, allDay: 0, is1159: 0, category: 'general',
    } as CalendarEvent)
    const row = (await db.calendarEvents.toArray())[0]
    expect(await seriesSize(row)).toBe(1)
  })
})

describe('applyEventPatch', () => {
  it('changes only the occurrence you clicked by default', async () => {
    const rows = await seedSeries()
    await applyEventPatch(rows[1], { title: 'Renamed' }, 'this')
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(after.map(r => r.title)).toEqual(['CHEM 2090', 'Renamed', 'CHEM 2090', 'CHEM 2090'])
  })

  it('changes every occurrence when the scope is the series', async () => {
    const rows = await seedSeries()
    await applyEventPatch(rows[0], { title: 'CHEM 2090 — Lecture' }, 'series')
    const after = await db.calendarEvents.toArray()
    expect(after.every(r => r.title === 'CHEM 2090 — Lecture')).toBe(true)
  })

  it('never applies a time to the whole series', async () => {
    // Editing one Monday must not stack every week onto the same date —
    // the times are what make each occurrence distinct.
    const rows = await db.calendarEvents.orderBy('startMs').toArray().then(() => seedSeries())
    const sorted = await db.calendarEvents.orderBy('startMs').toArray()
    await applyEventPatch(sorted[0], { startMs: base + H, endMs: base + 2 * H }, 'series')
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(new Set(after.map(r => r.startMs)).size).toBe(after.length)
    expect(rows.length).toBe(4)
  })

  it('marks an edited imported event so a refresh will not revert it', async () => {
    const rows = await seedSeries()
    await applyEventPatch(rows[0], { title: 'Changed' }, 'this')
    const row = await db.calendarEvents.get(rows[0].id!)
    expect(row?.locallyEdited).toBe(1)
  })

  it('routes a personal event to its own table', async () => {
    const id = await db.personalEvents.add({
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      color: '#7c95ff', category: 'personal', createdAt: Date.now(),
    } as never)
    const asEvent = {
      id: id as number, feedId: PERSONAL_FEED_ID, uid: 'p', title: 'Dentist',
      startMs: base, endMs: base + H, allDay: 0, is1159: 0, category: 'personal',
    } as CalendarEvent

    expect(isPersonal(asEvent)).toBe(true)
    await applyEventPatch(asEvent, { title: 'Dentist — moved' })
    expect((await db.personalEvents.get(id as number))?.title).toBe('Dentist — moved')
    expect(await db.calendarEvents.count()).toBe(0)
  })
})

describe('removeEvent', () => {
  it('deletes one occurrence and leaves the rest', async () => {
    const rows = await seedSeries(4)
    expect(await removeEvent(rows[2], 'this')).toBe(1)
    expect(await db.calendarEvents.count()).toBe(3)
  })

  it('deletes the whole series when asked', async () => {
    const rows = await seedSeries(6)
    expect(await removeEvent(rows[0], 'series')).toBe(6)
    expect(await db.calendarEvents.count()).toBe(0)
  })

  it('a series delete never reaches another series', async () => {
    await seedSeries(3)
    await db.calendarEvents.add({
      feedId: 1, uid: 'other', seriesUid: 'other', title: 'Different',
      startMs: base, endMs: base + H, allDay: 0, is1159: 0, category: 'general',
    } as CalendarEvent)
    const mine = (await db.calendarEvents.where('seriesUid').equals('cls').toArray())[0]
    await removeEvent(mine, 'series')
    const left = await db.calendarEvents.toArray()
    expect(left).toHaveLength(1)
    expect(left[0].title).toBe('Different')
  })
})

describe('commitDrag', () => {
  it('moves only the occurrence dragged, whatever the series does', async () => {
    // A drag is a gesture on one block of time; reading it as "shift the
    // whole term" is never what the hand meant.
    const rows = await seedSeries(4)
    const target = rows[1]
    await commitDrag(target, { startMs: target.startMs + 2 * H, endMs: target.endMs + 2 * H })
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    const moved = after.find(r => r.id === target.id)!
    expect(moved.startMs).toBe(target.startMs + 2 * H)
    expect(after.filter(r => r.id !== target.id)
      .every(r => r.startMs % (7 * 24 * H) === base % (7 * 24 * H))).toBe(true)
  })

  it('preserves duration exactly', async () => {
    const rows = await seedSeries(2)
    const t = rows[0]
    await commitDrag(t, { startMs: t.startMs + 90 * 60_000, endMs: t.endMs + 90 * 60_000 })
    const after = await db.calendarEvents.get(t.id!)
    expect(after!.endMs - after!.startMs).toBe(H)
  })
})

describe('the "future" scope', () => {
  it('reaches the occurrence you clicked and every later one, not earlier ones', async () => {
    const rows = await seedSeries(5)   // 5 weekly occurrences, base .. base+4*7d
    await applyEventPatch(rows[2], { title: 'Moved to a bigger room' }, 'future')
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(after.map(r => r.title)).toEqual([
      'CHEM 2090', 'CHEM 2090',                                       // before — untouched
      'Moved to a bigger room', 'Moved to a bigger room', 'Moved to a bigger room', // this + after
    ])
  })

  it('still never carries a time onto the occurrences after it', async () => {
    const rows = await seedSeries(4)
    await applyEventPatch(rows[1], { startMs: base + H, endMs: base + 2 * H }, 'future')
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(new Set(after.map(r => r.startMs)).size).toBe(4)
  })

  it('deletes the occurrence and everything after it, leaving the past alone', async () => {
    const rows = await seedSeries(5)
    const removed = await removeEvent(rows[3], 'future')
    expect(removed).toBe(2)   // rows[3] and rows[4]
    const left = await db.calendarEvents.toArray()
    expect(left).toHaveLength(3)
    expect(left.every(r => r.startMs < rows[3].startMs)).toBe(true)
  })

  it('behaves exactly like "this" for the very last occurrence', async () => {
    const rows = await seedSeries(3)
    expect(await removeEvent(rows[2], 'future')).toBe(1)
    expect(await db.calendarEvents.count()).toBe(2)
  })

  it('behaves exactly like "series" for the very first occurrence', async () => {
    const rows = await seedSeries(3)
    expect(await removeEvent(rows[0], 'future')).toBe(3)
    expect(await db.calendarEvents.count()).toBe(0)
  })

  it('routes a personal event series through its own table too', async () => {
    const seriesUid = 'personal-series'
    const ids: number[] = []
    for (let i = 0; i < 4; i++) {
      ids.push(await db.personalEvents.add({
        title: 'Study group', startMs: base + i * 7 * 24 * H, endMs: base + i * 7 * 24 * H + H,
        allDay: 0, color: '#7c95ff', category: 'personal', seriesUid, createdAt: Date.now(),
      } as never) as number)
    }
    const middle = (await db.personalEvents.get(ids[1]))!
    const asEvent = {
      id: -ids[1], feedId: PERSONAL_FEED_ID, uid: `personal-${ids[1]}`,
      title: middle.title, startMs: middle.startMs, endMs: middle.endMs,
      allDay: 0, is1159: 0, category: 'personal', seriesUid,
    } as CalendarEvent

    const touched = await applyEventPatch(asEvent, { title: 'Study group — moved' }, 'future')
    expect(touched).toBe(3)   // ids[1], ids[2], ids[3]
    const rows = await db.personalEvents.toArray()
    expect(rows.filter(r => r.title === 'Study group — moved')).toHaveLength(3)
    expect(rows.filter(r => r.title === 'Study group')).toHaveLength(1)
  })
})

/* ── Time changes that reach the rest of the series ───────────────── */

describe('a time change on a repeat', () => {
  const day = 24 * H

  /** A daily 3–4pm repeat, five days running from `from`. */
  async function seedDaily(from: Date, count = 5): Promise<CalendarEvent[]> {
    await db.calendarEvents.clear()
    const rows = Array.from({ length: count }, (_, i) => {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 15, 0)
      return {
        feedId: 1, uid: `free::${i}`, seriesUid: 'free', locallyEdited: 0,
        title: 'Free time',
        startMs: d.getTime(), endMs: d.getTime() + H,
        allDay: 0, is1159: 0, category: 'life',
      }
    })
    await db.calendarEvents.bulkAdd(rows as CalendarEvent[])
    return db.calendarEvents.orderBy('startMs').toArray()
  }

  const hoursOf = async () =>
    (await db.calendarEvents.orderBy('startMs').toArray())
      .map(r => new Date(r.startMs).getHours())

  const datesOf = async () =>
    (await db.calendarEvents.orderBy('startMs').toArray())
      .map(r => new Date(r.startMs).getDate())

  /*
   * The reported bug, in one test: set a daily repeat to the wrong hour
   * and fixing it should be one edit, not one edit per day.
   */
  it('moves every occurrence to the new hour, each keeping its own date', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await seedDaily(today)
    const before = await datesOf()

    const target = new Date(rows[0].startMs)
    target.setHours(16, 0, 0, 0)

    await applyEventPatch(
      rows[0],
      { startMs: target.getTime(), endMs: target.getTime() + H },
      'series',
      'time-of-day',
    )

    expect(await hoursOf()).toEqual([16, 16, 16, 16, 16])
    expect(await datesOf()).toEqual(before)
  })

  it('still touches only the clicked occurrence when the mode says so', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await seedDaily(today)

    const target = new Date(rows[2].startMs)
    target.setHours(16, 0, 0, 0)

    await applyEventPatch(
      rows[2],
      { startMs: target.getTime(), endMs: target.getTime() + H },
      'series',
      'occurrence-only',
    )

    expect(await hoursOf()).toEqual([15, 15, 16, 15, 15])
  })

  /* What a drag does, and must keep doing. */
  it('commitDrag never reaches the series', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await seedDaily(today)

    await commitDrag(rows[1], {
      startMs: rows[1].startMs + 2 * H,
      endMs:   rows[1].endMs   + 2 * H,
    })

    expect(await hoursOf()).toEqual([15, 17, 15, 15, 15])
  })

  it('leaves occurrences that already happened at their original time', async () => {
    /* Two days behind, three ahead, all at 3pm. */
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 2)
    const rows = await seedDaily(start)

    const clicked = rows[2]                    // today
    const target = new Date(clicked.startMs)
    target.setHours(16, 0, 0, 0)

    await applyEventPatch(
      clicked,
      { startMs: target.getTime(), endMs: target.getTime() + H },
      'series',
      'time-of-day',
    )

    /* The two behind keep 3pm; today and the two ahead move to 4pm. */
    expect(await hoursOf()).toEqual([15, 15, 16, 16, 16])
  })

  it('under "this and following" every occurrence it reaches moves', async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 2)
    const rows = await seedDaily(start)

    const clicked = rows[1]                    // yesterday
    const target = new Date(clicked.startMs)
    target.setHours(16, 0, 0, 0)

    await applyEventPatch(
      clicked,
      { startMs: target.getTime(), endMs: target.getTime() + H },
      'future',
      'time-of-day',
    )

    /* 'future' means from the one you picked — it does not second-guess
       that choice with the past guard. */
    expect(await hoursOf()).toEqual([15, 16, 16, 16, 16])
  })

  it('shifts every occurrence by the same days when asked to', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await seedDaily(today)
    const before = await datesOf()

    const target = new Date(rows[0].startMs + day)
    target.setHours(15, 0, 0, 0)

    await applyEventPatch(
      rows[0],
      { startMs: target.getTime(), endMs: target.getTime() + H },
      'series',
      'shift-days',
    )

    expect(await datesOf()).toEqual(before.map(d => d + 1))
  })

  it('carries a non-time field to the past as well — a rename is not a record of when', async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 2)
    const rows = await seedDaily(start)

    await applyEventPatch(rows[2], { title: 'Quiet hours' }, 'series', 'time-of-day')

    const titles = (await db.calendarEvents.toArray()).map(r => r.title)
    expect(titles.every(t => t === 'Quiet hours')).toBe(true)
  })
})
