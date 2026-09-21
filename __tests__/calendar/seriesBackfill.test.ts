/**
 * Events that were never grouped.
 *
 * A repeat is rows sharing a `seriesUid`. Rows written before that
 * field existed — and every course schedule the replicator generated,
 * which wrote one independent row per class session — have none, so the
 * app treats a semester of one class as forty unrelated events: the
 * scope picker never appears, and "this and following" reaches exactly
 * one row. These tests pin down both halves: that the symptom is what
 * it looks like, and that the backfill reconstructs the grouping
 * without inventing one where there wasn't a series.
 */

import { db, type CalendarEvent, type PersonalEvent } from '@/lib/db'
import { seriesSize, applyEventPatch, PERSONAL_FEED_ID } from '@/lib/calendarMutations'
import {
  planSeriesBackfill, runSeriesBackfill, backfillFeedSeries,
} from '@/lib/calendarSeriesBackfill'

const H = 3_600_000
const base = new Date(2026, 8, 7, 10, 10).getTime()   // Monday 10:10

/** A class session exactly as generateUniversitySchedule wrote it. */
function classRow(i: number, title = 'CHEM 2090', feedId = 1): CalendarEvent {
  return {
    feedId,
    uid:      `sched-CORNELL-${title.replace(/\W+/g, '_')}-day${i}`,
    title,
    startMs:  base + i * 7 * 24 * H,
    endMs:    base + i * 7 * 24 * H + 50 * 60_000,
    allDay:   0,
    is1159:   0,
    category: 'scholastic',
  } as CalendarEvent
}

async function seedGeneratedSchedule(n = 5, title = 'CHEM 2090', feedId = 1) {
  await db.calendarEvents.bulkAdd(
    Array.from({ length: n }, (_, i) => classRow(i, title, feedId)),
  )
  return db.calendarEvents.where('title').equals(title).sortBy('startMs')
}

beforeEach(async () => {
  await db.calendarEvents.clear()
  await db.personalEvents.clear()
})

describe('the bug: a generated schedule is not a series', () => {
  it('reports a whole semester of one class as a one-off', async () => {
    const rows = await seedGeneratedSchedule(5)
    expect(rows).toHaveLength(5)
    /* This is what makes the scope picker never appear. */
    expect(await seriesSize(rows[0])).toBe(1)
  })

  it('reaches only the clicked row, whatever scope is asked for', async () => {
    const rows = await seedGeneratedSchedule(5)

    expect(await applyEventPatch(rows[1], { title: 'CHEM 2090 — Baker 200' }, 'future')).toBe(1)
    expect(await applyEventPatch(rows[1], { title: 'CHEM 2090 — Baker 200' }, 'series')).toBe(1)

    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(after.filter(r => r.title === 'CHEM 2090')).toHaveLength(4)
  })
})

describe('planSeriesBackfill', () => {
  it('groups a feed\'s identically-titled events', () => {
    const rows = Array.from({ length: 4 }, (_, i) => classRow(i))
      .map((r, i) => ({ ...r, id: i + 1 }))
    const plan = planSeriesBackfill(rows, 'feed')
    expect(plan).toHaveLength(1)
    expect(plan[0].ids).toEqual([1, 2, 3, 4])
  })

  it('keeps two courses in the same feed apart', () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => classRow(i, 'CHEM 2090')),
      ...Array.from({ length: 2 }, (_, i) => classRow(i, 'MATH 2210')),
    ].map((r, i) => ({ ...r, id: i + 1 }))

    const plan = planSeriesBackfill(rows, 'feed')
    expect(plan).toHaveLength(2)
    expect(plan.map(p => p.ids.length).sort()).toEqual([2, 3])
  })

  it('keeps the same title in two different feeds apart', () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => classRow(i, 'Lecture', 1)),
      ...Array.from({ length: 2 }, (_, i) => classRow(i, 'Lecture', 2)),
    ].map((r, i) => ({ ...r, id: i + 1 }))

    const plan = planSeriesBackfill(rows, 'feed')
    expect(plan).toHaveLength(2)
  })

  it('never turns a single event into a series', () => {
    const rows = [{ ...classRow(0), id: 1 }]
    expect(planSeriesBackfill(rows, 'feed')).toEqual([])
  })

  it('leaves rows that already have a seriesUid alone', () => {
    const rows = Array.from({ length: 3 }, (_, i) => classRow(i))
      .map((r, i) => ({ ...r, id: i + 1, seriesUid: 'already-grouped' }))
    expect(planSeriesBackfill(rows, 'feed')).toEqual([])
  })

  it('groups hand-made personal events only when they match exactly', () => {
    const at = (day: number, hour: number, mins: number) => ({
      title:   'Gym',
      startMs: new Date(2026, 8, day, hour, 0).getTime(),
      endMs:   new Date(2026, 8, day, hour, 0).getTime() + mins * 60_000,
      allDay:  0,
    })
    const rows = [
      { ...at(7,  7, 60), id: 1 },   // 07:00, 1h
      { ...at(9,  7, 60), id: 2 },   // 07:00, 1h — same thing, another day
      { ...at(11, 7, 90), id: 3 },   // 07:00 but 90 min — a different commitment
      { ...at(12, 18, 60), id: 4 },  // evening — likewise
    ]
    const plan = planSeriesBackfill(rows, 'personal')
    expect(plan).toHaveLength(1)
    expect(plan[0].ids).toEqual([1, 2])
  })
})

describe('runSeriesBackfill', () => {
  it('makes a generated schedule behave like the repeat it always was', async () => {
    const before = await seedGeneratedSchedule(5)
    expect(await seriesSize(before[0])).toBe(1)

    const result = await runSeriesBackfill()
    expect(result).toEqual({ series: 1, rows: 5 })

    const rows = await db.calendarEvents.orderBy('startMs').toArray()
    expect(await seriesSize(rows[0])).toBe(5)

    /* And the scope that prompted all this now reaches what it says. */
    const touched = await applyEventPatch(rows[2], { location: 'Baker 200' }, 'future')
    expect(touched).toBe(3)
    const after = await db.calendarEvents.orderBy('startMs').toArray()
    expect(after.map(r => r.location ?? null))
      .toEqual([null, null, 'Baker 200', 'Baker 200', 'Baker 200'])
  })

  it('is idempotent — a second run changes nothing', async () => {
    await seedGeneratedSchedule(4)
    const first = await runSeriesBackfill()
    const uids = (await db.calendarEvents.toArray()).map(r => r.seriesUid)

    const second = await runSeriesBackfill()
    expect(second).toEqual({ series: 0, rows: 0 })
    expect((await db.calendarEvents.toArray()).map(r => r.seriesUid)).toEqual(uids)
    expect(first.rows).toBe(4)
  })

  it('gives each reconstructed series its own uid', async () => {
    await seedGeneratedSchedule(3, 'CHEM 2090')
    await seedGeneratedSchedule(3, 'MATH 2210')
    await runSeriesBackfill()

    const rows = await db.calendarEvents.toArray()
    const chem = new Set(rows.filter(r => r.title === 'CHEM 2090').map(r => r.seriesUid))
    const math = new Set(rows.filter(r => r.title === 'MATH 2210').map(r => r.seriesUid))
    expect(chem.size).toBe(1)
    expect(math.size).toBe(1)
    expect([...chem][0]).not.toBe([...math][0])
  })

  it('groups hand-made personal repeats too, and they edit as a series', async () => {
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      ids.push(await db.personalEvents.add({
        title:   'Gym',
        startMs: new Date(2026, 8, 7 + i * 2, 7, 0).getTime(),
        endMs:   new Date(2026, 8, 7 + i * 2, 8, 0).getTime(),
        allDay:  0, color: '#7c95ff', category: 'personal', createdAt: Date.now(),
      } as PersonalEvent) as number)
    }

    await runSeriesBackfill()

    const middle = (await db.personalEvents.get(ids[1]))!
    const asGridEvent = {
      id: -ids[1], feedId: PERSONAL_FEED_ID, uid: `personal-${ids[1]}`,
      title: middle.title, startMs: middle.startMs, endMs: middle.endMs,
      allDay: 0, is1159: 0, category: 'personal', seriesUid: middle.seriesUid,
    } as CalendarEvent

    expect(await seriesSize(asGridEvent)).toBe(3)
    expect(await applyEventPatch(asGridEvent, { title: 'Gym — new place' }, 'future')).toBe(2)
  })

  /*
   * A refresh re-imports a feed's rows. If grouping only ever happened
   * in the once-per-install pass, refreshing would quietly undo it —
   * a worse bug than the original, because it comes back.
   */
  it('regroups a feed after a refresh re-imports it ungrouped', async () => {
    await seedGeneratedSchedule(4)
    await runSeriesBackfill()
    expect(new Set((await db.calendarEvents.toArray()).map(r => r.seriesUid)).size).toBe(1)

    /* What a refresh leaves behind: same rows, no grouping. */
    await db.calendarEvents.clear()
    await seedGeneratedSchedule(4)

    const result = await backfillFeedSeries(1)
    expect(result).toEqual({ series: 1, rows: 4 })
    expect(new Set((await db.calendarEvents.toArray()).map(r => r.seriesUid)).size).toBe(1)
  })

  it('only touches the feed it was given', async () => {
    await seedGeneratedSchedule(3, 'CHEM 2090', 1)
    await seedGeneratedSchedule(3, 'MATH 2210', 2)

    await backfillFeedSeries(1)

    const rows = await db.calendarEvents.toArray()
    expect(rows.filter(r => r.feedId === 1).every(r => r.seriesUid)).toBe(true)
    expect(rows.filter(r => r.feedId === 2).every(r => !r.seriesUid)).toBe(true)
  })

  it('leaves a genuine one-off alone', async () => {
    await db.personalEvents.add({
      title: 'Dentist', startMs: base, endMs: base + H, allDay: 0,
      color: '#7c95ff', category: 'personal', createdAt: Date.now(),
    } as PersonalEvent)

    expect(await runSeriesBackfill()).toEqual({ series: 0, rows: 0 })
    expect((await db.personalEvents.toArray())[0].seriesUid).toBeUndefined()
  })
})
