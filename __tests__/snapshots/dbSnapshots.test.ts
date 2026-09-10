/**
 * The copy of yesterday nobody asked for.
 *
 * Three rules here are the whole feature, and each of them fails
 * silently if it is wrong: a snapshot must not contain other snapshots
 * (or the size compounds until writes start failing), restoring one
 * must not destroy the others (or the way back disappears at the moment
 * it is being used), and taking one must not happen more than once a
 * day unless asked.
 */

import 'fake-indexeddb/auto'
import { db } from '@/lib/db'
import {
  takeSnapshot, listSnapshots, restoreSnapshot, pruneSnapshots, deleteSnapshot,
  KEEP_SNAPSHOTS, SNAPSHOT_INTERVAL_MS,
} from '@/utils/dbSnapshots'

beforeEach(async () => {
  await db.db_snapshots.clear()
  await db.quickNotes.clear()
  await db.assignments.clear()
})

const note = (title: string) => db.quickNotes.add({
  title, body: 'x', category: 'idea', updatedAt: Date.now(), createdAt: Date.now(),
} as never)

describe('taking one', () => {
  it('captures the data that is there', async () => {
    await note('Lecture 9')
    const r = await takeSnapshot({ force: true })
    expect(r.taken).toBe(true)
    if (r.taken) expect(r.info.rowCount).toBeGreaterThan(0)
  })

  /*
   * Without this, the third snapshot holds the second, which holds the
   * first — the size compounds until the browser runs out of quota, and
   * the failure mode there is writes silently starting to fail.
   */
  it('does not put snapshots inside snapshots', async () => {
    await note('One')
    await takeSnapshot({ force: true })
    await takeSnapshot({ force: true })

    const rows = await db.db_snapshots.toArray()
    for (const r of rows) {
      const parsed = JSON.parse(r.payload)
      expect(parsed.tables.db_snapshots).toBeUndefined()
    }
  })

  it('refuses a second one the same day unless forced', async () => {
    await takeSnapshot({ force: true })
    const again = await takeSnapshot()
    expect(again.taken).toBe(false)
    if (!again.taken) expect(again.reason).toBe('too-soon')
  })

  it('takes one when the last is old enough', async () => {
    const first = await takeSnapshot({ force: true })
    if (first.taken) {
      await db.db_snapshots.update(first.info.id,
        { takenAt: Date.now() - SNAPSHOT_INTERVAL_MS - 1000 })
    }
    expect((await takeSnapshot()).taken).toBe(true)
  })
})

describe('keeping only a few', () => {
  it('drops the oldest past the limit', async () => {
    for (let i = 0; i < KEEP_SNAPSHOTS + 2; i++) {
      await takeSnapshot({ force: true })
      /* Space them out so "newest" is unambiguous. */
      const all = await db.db_snapshots.orderBy('takenAt').toArray()
      await db.db_snapshots.update(all[all.length - 1].id, { takenAt: Date.now() + i * 1000 })
    }
    expect(await db.db_snapshots.count()).toBe(KEEP_SNAPSHOTS)
  })

  it('lists them newest first', async () => {
    const a = await takeSnapshot({ force: true })
    if (a.taken) await db.db_snapshots.update(a.info.id, { takenAt: 1000 })
    const b = await takeSnapshot({ force: true })
    if (b.taken) await db.db_snapshots.update(b.info.id, { takenAt: 9000 })

    const list = await listSnapshots()
    expect(list[0].takenAt).toBeGreaterThan(list[1].takenAt)
  })

  it('prunes on demand too', async () => {
    for (let i = 0; i < 4; i++) await takeSnapshot({ force: true })
    await pruneSnapshots(1)
    expect(await db.db_snapshots.count()).toBe(1)
  })
})

describe('putting one back', () => {
  it('restores the data as it was', async () => {
    await note('Before')
    const snap = await takeSnapshot({ force: true })
    expect(snap.taken).toBe(true)

    await db.quickNotes.clear()
    await note('After the mistake')
    expect((await db.quickNotes.toArray()).map(n => n.title)).toEqual(['After the mistake'])

    if (snap.taken) await restoreSnapshot(snap.info.id)
    expect((await db.quickNotes.toArray()).map(n => n.title)).toEqual(['Before'])
  })

  /*
   * The way back must survive being used. Restoring clears every table;
   * if that included this one, restoring the wrong snapshot would take
   * every other snapshot with it — including the safety copy taken
   * seconds earlier.
   */
  it('does not destroy the other snapshots', async () => {
    await note('One')
    const a = await takeSnapshot({ force: true })
    await takeSnapshot({ force: true })
    const countBefore = await db.db_snapshots.count()

    if (a.taken) await restoreSnapshot(a.info.id)

    /* Still there, plus the safety copy taken on the way in. */
    expect(await db.db_snapshots.count()).toBeGreaterThanOrEqual(Math.min(countBefore, KEEP_SNAPSHOTS))
    expect(await db.db_snapshots.count()).toBeGreaterThan(0)
  })

  it('takes a safety copy of what it is about to replace', async () => {
    await note('Current state')
    const snap = await takeSnapshot({ force: true })
    await db.quickNotes.clear()
    await note('About to be replaced')

    const before = await db.db_snapshots.count()
    if (snap.taken) await restoreSnapshot(snap.info.id)
    expect(await db.db_snapshots.count()).toBeGreaterThanOrEqual(before)
  })

  it('says so plainly when the snapshot is gone', async () => {
    await expect(restoreSnapshot('snap_nope')).rejects.toThrow(/no longer here/)
  })
})

describe('removing one', () => {
  it('deletes just that one', async () => {
    const a = await takeSnapshot({ force: true })
    await takeSnapshot({ force: true })
    if (a.taken) await deleteSnapshot(a.info.id)
    expect((await listSnapshots()).some(s => a.taken && s.id === a.info.id)).toBe(false)
  })
})
