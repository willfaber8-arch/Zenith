/**
 * The sweep deletes, permanently, on a timer. These pin the rules that
 * keep that from being a way to lose work.
 */

import { db, type Assignment } from '@/lib/db'
import { setDone } from '@/lib/taskMutations'
import {
  sweepCompletedTasks, readRetention, writeRetention,
  DEFAULT_RETENTION, describeRetention, RETENTION_KEY,
} from '@/utils/taskRetention'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 10, 12, 0, 0)

beforeEach(async () => {
  await db.assignments.clear()
  localStorage.clear()
})

async function add(over: Partial<Assignment> = {}): Promise<number> {
  return db.assignments.add({
    title: 'a task', dueDate: '', courseId: '', status: 'pending',
    priority: 'medium', category: 'life', kind: 'reminder',
    createdAt: NOW, updatedAt: NOW, ...over,
  } as Assignment) as Promise<number>
}

describe('the retention setting', () => {
  it('defaults to a week', () => {
    expect(readRetention()).toBe(DEFAULT_RETENTION)
    expect(DEFAULT_RETENTION).toBe(7)
  })

  it('round-trips every choice, including never', () => {
    for (const v of [7, 14, 30, null] as const) {
      writeRetention(v)
      expect(readRetention()).toBe(v)
    }
  })

  it('falls back to the default rather than a window nobody chose', () => {
    localStorage.setItem(RETENTION_KEY, '3')       // not an offered value
    expect(readRetention()).toBe(DEFAULT_RETENTION)
    localStorage.setItem(RETENTION_KEY, 'banana')
    expect(readRetention()).toBe(DEFAULT_RETENTION)
  })

  it('says what it does in words', () => {
    expect(describeRetention(7)).toMatch(/a week/)
    expect(describeRetention(null)).toMatch(/kept until you delete them/)
  })
})

describe('what the sweep removes', () => {
  it('removes a task finished longer ago than the window', async () => {
    await add({ status: 'completed', completedAt: NOW - 8 * DAY })
    const r = await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(r.removed).toBe(1)
    expect(await db.assignments.count()).toBe(0)
  })

  it('keeps one finished inside the window', async () => {
    await add({ status: 'completed', completedAt: NOW - 6 * DAY })
    const r = await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(r.removed).toBe(0)
    expect(await db.assignments.count()).toBe(1)
  })

  it('treats the boundary as inclusive, and one second short of it as safe', async () => {
    const onIt   = await add({ status: 'completed', completedAt: NOW - 7 * DAY })
    const justIn = await add({ status: 'completed', completedAt: NOW - 7 * DAY + 1_000 })
    await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(await db.assignments.get(onIt)).toBeUndefined()
    expect(await db.assignments.get(justIn)).toBeDefined()
  })

  it('never touches an open task, however old', async () => {
    await add({ status: 'pending',     createdAt: NOW - 400 * DAY })
    await add({ status: 'in_progress', createdAt: NOW - 400 * DAY })
    await add({ status: 'overdue',     dueDate: '2019-01-01' })
    const r = await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(r.removed).toBe(0)
    expect(await db.assignments.count()).toBe(3)
  })

  it('removes nothing at all when the setting is never', async () => {
    await add({ status: 'completed', completedAt: NOW - 900 * DAY })
    const r = await sweepCompletedTasks({ now: NOW, retention: null })
    expect(r.removed).toBe(0)
    expect(await db.assignments.count()).toBe(1)
  })
})

describe('tasks finished before any of this existed', () => {
  /*
   * The dangerous reading of a missing timestamp is "very old". A year
   * of finished work would go on the first load after an update.
   */
  it('are given a clock rather than deleted', async () => {
    const id = await add({ status: 'completed', updatedAt: NOW - 900 * DAY })
    const r  = await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(r.removed).toBe(0)
    expect(r.stamped).toBe(1)
    expect((await db.assignments.get(id))?.completedAt).toBe(NOW)
  })

  it('then expire a week after the stamp, not a week after they were edited', async () => {
    const id = await add({ status: 'completed', updatedAt: NOW - 900 * DAY })
    await sweepCompletedTasks({ now: NOW, retention: 7 })
    await sweepCompletedTasks({ now: NOW + 6 * DAY, retention: 7 })
    expect(await db.assignments.get(id)).toBeDefined()
    await sweepCompletedTasks({ now: NOW + 8 * DAY, retention: 7 })
    expect(await db.assignments.get(id)).toBeUndefined()
  })

  it('are stamped even while retention is off, so switching it on is not retroactive', async () => {
    const id = await add({ status: 'completed', updatedAt: NOW - 900 * DAY })
    await sweepCompletedTasks({ now: NOW, retention: null })
    expect((await db.assignments.get(id))?.completedAt).toBe(NOW)
  })
})

describe('the clock starts when you tick it', () => {
  it('setDone stamps the completion time', async () => {
    const id  = await add()
    const row = await db.assignments.get(id) as Assignment
    await setDone(row, true)
    const after = await db.assignments.get(id) as Assignment
    expect(after.status).toBe('completed')
    expect(after.completedAt).toBeGreaterThan(0)
  })

  it('unticking clears it, so a task back on the list stops counting down', async () => {
    const id = await add({ status: 'completed', completedAt: NOW - 900 * DAY })
    await setDone(await db.assignments.get(id) as Assignment, false)
    const after = await db.assignments.get(id) as Assignment
    expect(after.status).toBe('pending')
    expect(after.completedAt).toBeUndefined()

    /* And the proof that matters: the sweep now leaves it alone. */
    await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(await db.assignments.get(id)).toBeDefined()
  })

  it('a repeating task is never swept, because ticking it never completes it', async () => {
    const id  = await add({ repeat: 'weekly', dueDate: '2026-09-01' })
    const row = await db.assignments.get(id) as Assignment
    const res = await setDone(row, true)
    expect(res?.repeatedTo).toBeTruthy()

    const after = await db.assignments.get(id) as Assignment
    expect(after.status).toBe('pending')
    expect(after.completedAt).toBeUndefined()
    await sweepCompletedTasks({ now: NOW, retention: 7 })
    expect(await db.assignments.get(id)).toBeDefined()
  })
})

/*
 * The unit tests above prove the sweep does the right thing when it is
 * called. Nothing there notices if it stops being called, or if it runs
 * before the daily snapshot instead of after — and that ordering is the
 * whole reason an auto-deleted task is recoverable for a few days. Both
 * are one careless edit away, so they are checked directly.
 */
describe('the sweep is wired in, and runs after the snapshot', () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'components', 'BadgeSyncEffect.tsx'),
    'utf8',
  ) as string

  it('is called from the workspace effect', () => {
    expect(source).toMatch(/sweepCompletedTasks\s*\(/)
  })

  it('is chained after takeSnapshot, not before or alongside it', () => {
    const snapshot = source.indexOf('takeSnapshot(')
    const sweep    = source.indexOf('sweepCompletedTasks(')
    expect(snapshot).toBeGreaterThan(-1)
    expect(sweep).toBeGreaterThan(snapshot)
    /* Chained, so the snapshot has finished before anything is deleted —
       firing both at once would race the copy against the delete. */
    expect(source).toMatch(/takeSnapshot\(\)[\s\S]{0,400}\.then\([\s\S]{0,200}sweepCompletedTasks/)
  })
})
