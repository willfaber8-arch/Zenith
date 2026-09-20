/**
 * Snapshotting a calendar row before it changes, so "Undo" has something
 * to put back.
 *
 * Two things worth pinning down: a personal event's id is negated by the
 * grid before it ever reaches this module (see the note in
 * lib/calendarMutations.ts), so a snapshot that forgets to take the
 * absolute value silently captures nothing — "Undo" would then just
 * never appear after editing or dragging your own event. And 'future'
 * scope has to capture the same rows applyEventPatch/removeEvent are
 * about to touch, for both tables, or an undo would restore a different
 * set of rows than the mutation it is meant to reverse.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import { PERSONAL_FEED_ID } from '@/lib/calendarMutations'
import { captureUndo, applyUndo } from '@/lib/calendarUndo'
import type { CalendarEvent } from '@/lib/db'

const H = 3_600_000
const base = new Date(2026, 8, 7, 14, 0).getTime()

beforeEach(async () => {
  await db.calendarEvents.clear()
  await db.personalEvents.clear()
})

describe('captureUndo on a personal event', () => {
  it('captures the row even though the grid hands it a negated id', async () => {
    const id = await db.personalEvents.add({
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      color: '#7c95ff', category: 'personal', createdAt: Date.now(),
    } as never) as number

    const gridEvent = {
      id: -id, feedId: PERSONAL_FEED_ID, uid: `personal-${id}`,
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      is1159: 0, category: 'personal',
    } as CalendarEvent

    const entry = await captureUndo(gridEvent, 'this', 'edit')
    expect(entry).not.toBeNull()
    expect(entry!.before).toHaveLength(1)
    expect(entry!.before[0]).toMatchObject({ id, title: 'Dentist' })
  })

  it('round-trips through applyUndo after the row is edited', async () => {
    const id = await db.personalEvents.add({
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      color: '#7c95ff', category: 'personal', createdAt: Date.now(),
    } as never) as number

    const gridEvent = {
      id: -id, feedId: PERSONAL_FEED_ID, uid: `personal-${id}`,
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      is1159: 0, category: 'personal',
    } as CalendarEvent

    const entry = await captureUndo(gridEvent, 'this', 'edit')
    expect(entry).not.toBeNull()

    await db.personalEvents.update(id, { title: 'Dentist — moved' })
    expect((await db.personalEvents.get(id))?.title).toBe('Dentist — moved')

    await applyUndo(entry!)
    expect((await db.personalEvents.get(id))?.title).toBe('Dentist')
  })
})

describe('captureUndo with "future" scope', () => {
  async function seedPersonalSeries(count = 4): Promise<{ ids: number[]; seriesUid: string }> {
    const seriesUid = 'study-group'
    const ids: number[] = []
    for (let i = 0; i < count; i++) {
      ids.push(await db.personalEvents.add({
        title: 'Study group', startMs: base + i * 7 * 24 * H, endMs: base + i * 7 * 24 * H + H,
        allDay: 0, color: '#7c95ff', category: 'personal', seriesUid, createdAt: Date.now(),
      } as never) as number)
    }
    return { ids, seriesUid }
  }

  async function seedImportedSeries(count = 4): Promise<CalendarEvent[]> {
    const rows = Array.from({ length: count }, (_, i) => ({
      feedId: 1, uid: `cls::${i}`, seriesUid: 'cls', locallyEdited: 0,
      title: 'CHEM 2090',
      startMs: base + i * 7 * 24 * H, endMs: base + i * 7 * 24 * H + H,
      allDay: 0, is1159: 0, category: 'scholastic',
    }))
    await db.calendarEvents.bulkAdd(rows as CalendarEvent[])
    return db.calendarEvents.orderBy('startMs').toArray()
  }

  it('captures the clicked occurrence and every later one for a personal series', async () => {
    const { ids, seriesUid } = await seedPersonalSeries(4)
    const middle = (await db.personalEvents.get(ids[1]))!
    const gridEvent = {
      id: -ids[1], feedId: PERSONAL_FEED_ID, uid: `personal-${ids[1]}`,
      title: middle.title, startMs: middle.startMs, endMs: middle.endMs,
      allDay: 0, is1159: 0, category: 'personal', seriesUid,
    } as CalendarEvent

    const entry = await captureUndo(gridEvent, 'future', 'edit of future occurrences')
    expect(entry!.before).toHaveLength(3)   // ids[1], ids[2], ids[3]
    expect((entry!.before as { id?: number }[]).map(r => r.id).sort())
      .toEqual([ids[1], ids[2], ids[3]].sort())
  })

  it('restores only the touched-and-later rows for a personal series', async () => {
    const { ids, seriesUid } = await seedPersonalSeries(4)
    const middle = (await db.personalEvents.get(ids[1]))!
    const gridEvent = {
      id: -ids[1], feedId: PERSONAL_FEED_ID, uid: `personal-${ids[1]}`,
      title: middle.title, startMs: middle.startMs, endMs: middle.endMs,
      allDay: 0, is1159: 0, category: 'personal', seriesUid,
    } as CalendarEvent

    const entry = await captureUndo(gridEvent, 'future', 'edit of future occurrences')!
    for (const id of [ids[1], ids[2], ids[3]]) {
      await db.personalEvents.update(id, { title: 'Study group — moved' })
    }
    await applyUndo(entry!)

    const rows = await db.personalEvents.toArray()
    expect(rows.filter(r => r.title === 'Study group')).toHaveLength(4)
  })

  it('captures the clicked occurrence and every later one for an imported series', async () => {
    const rows = await seedImportedSeries(5)
    const entry = await captureUndo(rows[2], 'future', 'edit of future occurrences')
    expect(entry!.before).toHaveLength(3)   // rows[2], rows[3], rows[4]
  })

  it('leaves earlier occurrences out of the snapshot', async () => {
    const rows = await seedImportedSeries(5)
    const entry = await captureUndo(rows[3], 'future', 'edit of future occurrences')
    const capturedIds = (entry!.before as CalendarEvent[]).map(r => r.id).sort()
    expect(capturedIds).toEqual([rows[3].id, rows[4].id].sort())
  })
})

describe('captureUndo with "this" scope on a series', () => {
  it('captures only the one row, not the whole series', async () => {
    const seriesUid = 'cls'
    await db.calendarEvents.bulkAdd(Array.from({ length: 3 }, (_, i) => ({
      feedId: 1, uid: `cls::${i}`, seriesUid, locallyEdited: 0, title: 'CHEM 2090',
      startMs: base + i * 7 * 24 * H, endMs: base + i * 7 * 24 * H + H,
      allDay: 0, is1159: 0, category: 'scholastic',
    })) as CalendarEvent[])
    const rows = await db.calendarEvents.orderBy('startMs').toArray()

    const entry = await captureUndo(rows[1], 'this', 'edit')
    expect(entry!.before).toHaveLength(1)
    expect((entry!.before[0] as CalendarEvent).id).toBe(rows[1].id)
  })
})
