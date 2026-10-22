/**
 * "Changed here" means you changed something here.
 *
 * Reported as: opening Zenith on the laptop always said it had synced
 * "just now", so it always looked like the newest version. The cause was
 * the daily safety snapshot — written the first time Zenith opens each
 * day, into a table that never leaves the device, and stamped as a local
 * change like any other write. The weekly sweep of finished tasks did the
 * same. These pin that the app's own upkeep is not a change, and that
 * everything you write still is: a missed stamp is a change that never
 * reaches your other devices, which is far worse than a stray one.
 */

jest.mock('@/lib/supabase', () => require('./fakeCloud').supabaseModule)

import { db } from '@/lib/db'
import {
  startSnapshotChangeTracking, getSnapshotMeta, setSnapshotMeta, UNTRACKED_TABLES,
} from '@/services/cloudSnapshot'
import { markHousekeeping, isHousekeeping } from '@/lib/housekeepingWrites'
import { takeSnapshot } from '@/utils/dbSnapshots'
import { sweepCompletedTasks } from '@/utils/taskRetention'
import { newerSide } from '@/components/CloudSyncBanner'

const stamp = () => getSnapshotMeta().lastLocalChangeAt
const clean = () => setSnapshotMeta({ lastLocalChangeAt: null })

beforeAll(async () => {
  startSnapshotChangeTracking()
  // Tracking hooks register after a dynamic import resolves.
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0))
})

beforeEach(async () => {
  localStorage.clear()
  await db.quickNotes.clear()
  await db.assignments.clear()
  await db.db_snapshots.clear()
  clean()
})

describe('what counts as a change here', () => {
  it('your own writes are stamped', async () => {
    await db.quickNotes.add({ title: 'mine', body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
    expect(stamp()).not.toBeNull()
  })

  it('the daily safety snapshot is not — it never leaves the device', async () => {
    await db.quickNotes.add({ title: 'mine', body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
    clean()
    const r = await takeSnapshot()
    expect(r.taken).toBe(true)
    expect(stamp()).toBeNull()
    expect(UNTRACKED_TABLES.has('db_snapshots')).toBe(true)
  })

  it('the finished-task sweep is not — it is the app tidying up', async () => {
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000
    await db.assignments.add({
      title: 'done long ago', dueDate: '', status: 'completed', priority: 'low', completedAt: old,
    } as never)
    clean()
    const r = await sweepCompletedTasks({ retention: 7 })
    expect(r.removed).toBe(1)
    expect(await db.assignments.count()).toBe(0)
    expect(stamp()).toBeNull()
  })

  it('a write made while upkeep runs, in its own transaction, is still stamped', async () => {
    // Both in flight together: a tagged upkeep transaction and an ordinary edit.
    const upkeep = db.transaction('rw', db.assignments, async tx => {
      markHousekeeping(tx)
      await db.assignments.add({ title: 'upkeep', dueDate: '', status: 'pending', priority: 'low' } as never)
    })
    const edit = db.quickNotes.add({ title: 'typed meanwhile', body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
    await Promise.all([upkeep, edit])
    expect(stamp()).not.toBeNull()
  })

  it('a tagged transaction on its own leaves no stamp', async () => {
    await db.transaction('rw', db.assignments, async tx => {
      markHousekeeping(tx)
      await db.assignments.add({ title: 'upkeep', dueDate: '', status: 'pending', priority: 'low' } as never)
    })
    expect(stamp()).toBeNull()
  })

  it('isHousekeeping only answers yes for a tagged transaction', async () => {
    expect(isHousekeeping(undefined)).toBe(false)
    await db.transaction('rw', db.quickNotes, async tx => {
      expect(isHousekeeping(tx)).toBe(false)
      markHousekeeping(tx)
      expect(isHousekeeping(tx)).toBe(true)
    })
  })
})

describe('newerSide — which version the banner lists first', () => {
  const t = Date.parse('2026-10-22T12:00:00Z')

  it('picks this device when it changed after the cloud copy was saved', () => {
    expect(newerSide(t + 60_000, '2026-10-22T12:00:00Z')).toBe('device')
  })

  it('picks the cloud when it was saved after the last change here', () => {
    expect(newerSide(t - 60_000, '2026-10-22T12:00:00Z')).toBe('cloud')
  })

  it('picks the cloud when nothing changed here', () => {
    expect(newerSide(null, '2026-10-22T12:00:00Z')).toBe('cloud')
  })

  it('picks this device when there is no cloud time to compare', () => {
    expect(newerSide(t, null)).toBe('device')
    expect(newerSide(t, 'not a date')).toBe('device')
  })

  it('has no answer with nothing on either side', () => {
    expect(newerSide(null, null)).toBeNull()
  })
})
