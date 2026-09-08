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
