/**
 * Cloud sync must never lose data, and never hand one person's data to
 * another.
 *
 * These run the real sync service (services/cloudSnapshot.ts) against a
 * fake of the one Supabase table it uses, which behaves the way the real
 * one does where it matters: row-level security by account, `updated_at`
 * stamped by the server on every write, and a primary key that refuses a
 * second insert. Each test is one safeguard.
 */

import { cloud, type Row } from './fakeCloud'
jest.mock('@/lib/supabase', () => require('./fakeCloud').supabaseModule)

import { db } from '@/lib/db'
import {
  pushSnapshot, pullSnapshot, getSnapshotMeta, setSnapshotMeta, hasUnpushedLocalChanges,
  decideSync, looksLikeMassDeletion, SNAPSHOT_META_KEY, type SnapshotMeta,
} from '@/services/cloudSnapshot'

const notes = async () => (await db.quickNotes.toArray()).map(n => n.title).sort()
const addNote = (title: string) =>
  db.quickNotes.add({ title, body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
const cloudNotes = () =>
  ((cloud.row?.payload as { tables: { quickNotes: { title: string }[] } } | undefined)
    ?.tables.quickNotes ?? []).map(n => n.title).sort()
const markDirty = () => setSnapshotMeta({ lastLocalChangeAt: Date.now() })

/** Another device writing a copy of its own. */
function otherDeviceWrites(titles: string[], schema = db.verno) {
  cloud.row = {
    user_id: 'user-A',
    payload: { version: 2, exportedAt: 1, schemaVersion: schema,
      tables: { quickNotes: titles.map((t, i) => ({ id: 100 + i, title: t, body: '', category: 'idea', createdAt: 1, updatedAt: 1 })) } },
    schema_version: schema, device_label: 'Safari · iOS', updated_at: cloud.stamp(),
  }
}

beforeEach(async () => {
  localStorage.clear()
  await db.quickNotes.clear()
  await db.db_snapshots.clear()
  await db.userProfile.clear()
  cloud.row = null
  cloud.signedIn = 'user-A'
  cloud.beforeWrite = null
  jest.restoreAllMocks()
})

/* ═══ Never overwrite a newer cloud copy ═══════════════════════════ */

describe('saving to the cloud', () => {
  it('saves over the copy this device last saw', async () => {
    await addNote('one')
    expect((await pushSnapshot()).ok).toBe(true)
    await addNote('two'); markDirty()
    expect((await pushSnapshot()).ok).toBe(true)
    expect(cloudNotes()).toEqual(['one', 'two'])
    expect(hasUnpushedLocalChanges()).toBe(false)
  })

  it('refuses when another device saved since — and leaves its copy intact', async () => {
    await addNote('laptop'); await pushSnapshot()
    otherDeviceWrites(['laptop', 'from the phone'])

    await addNote('laptop again'); markDirty()
    const r = await pushSnapshot()

    expect(r).toMatchObject({ ok: false, blocked: 'conflict' })
    expect(cloudNotes()).toEqual(['from the phone', 'laptop'])
    expect(hasUnpushedLocalChanges()).toBe(true)          // this device's edit is still pending, not dropped
  })

  it('refuses when another device saves between the check and the write', async () => {
    await addNote('one'); await pushSnapshot()
    await addNote('two'); markDirty()
    cloud.beforeWrite = () => otherDeviceWrites(['written in the gap'])

    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'conflict' })
    expect(cloudNotes()).toEqual(['written in the gap'])
  })

  it('a device that has never synced cannot replace an existing cloud copy', async () => {
    otherDeviceWrites(['everything from the laptop'])
    await addNote('new phone'); markDirty()

    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'conflict' })
    expect(cloudNotes()).toEqual(['everything from the laptop'])
  })

  it('creating the first copy cannot replace one created in the same moment', async () => {
    await addNote('mine'); markDirty()
    cloud.beforeWrite = () => otherDeviceWrites(['theirs, a moment earlier'])

    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'conflict' })
    expect(cloudNotes()).toEqual(['theirs, a moment earlier'])
  })

  it('an older Zenith cannot save over a copy written by a newer one', async () => {
    await addNote('one'); await pushSnapshot()
    cloud.row!.schema_version = db.verno + 1
    await addNote('two'); markDirty()

    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'outdated-app' })
  })
})

/* ═══ Mass-deletion guard ══════════════════════════════════════════ */

describe('a save that would wipe most of the cloud copy', () => {
  it('is held until confirmed', async () => {
    for (let i = 0; i < 40; i++) await addNote(`note ${i}`)
    await pushSnapshot()
    await db.quickNotes.clear(); await addNote('the only one left'); markDirty()

    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'mass-deletion' })
    expect(cloudNotes()).toHaveLength(40)

    expect((await pushSnapshot({ allowShrink: true })).ok).toBe(true)
    expect(cloudNotes()).toEqual(['the only one left'])
  })

  it('does not get in the way of ordinary tidying', () => {
    expect(looksLikeMassDeletion(40, 35)).toBe(false)    // deleted five things
    expect(looksLikeMassDeletion(10, 0)).toBe(false)     // a small workspace emptied on purpose
    expect(looksLikeMassDeletion(40, 1)).toBe(true)
    expect(looksLikeMassDeletion(null, 0)).toBe(false)   // nothing to compare with yet
  })
})

/* ═══ Loading from the cloud ═══════════════════════════════════════ */

describe('loading the cloud copy', () => {
  it('keeps a safety copy of what it replaces, then loads', async () => {
    await addNote('on this device'); await pushSnapshot()
    otherDeviceWrites(['from the phone'])

    expect((await pullSnapshot()).ok).toBe(true)
    expect(await notes()).toEqual(['from the phone'])

    const kept = (await db.db_snapshots.toArray()).filter(s => s.kind === 'before-cloud-load')
    expect(kept).toHaveLength(1)
    expect(kept[0].payload).toContain('on this device')
  })

  it('will not load over unsaved work on this device', async () => {
    await addNote('synced'); await pushSnapshot()
    otherDeviceWrites(['from the phone'])
    await addNote('unsaved'); markDirty()

    expect(await pullSnapshot()).toMatchObject({ ok: false, blocked: 'conflict' })
    expect(await notes()).toEqual(['synced', 'unsaved'])
  })

  it('does not load at all if the safety copy cannot be made', async () => {
    await addNote('precious'); await pushSnapshot()
    otherDeviceWrites(['from the phone'])
    /* Storage refusing the write — what a full disk looks like. */
    jest.spyOn(db.db_snapshots, 'put').mockRejectedValue(new Error('QuotaExceededError'))

    expect(await pullSnapshot()).toMatchObject({ ok: false, blocked: 'no-backup' })
    expect(await notes()).toEqual(['precious'])
  })

  it('leaves alone a table the incoming copy does not know about', async () => {
    await db.userProfile.put({ id: 1, userName: 'Will', universityName: '', majorIdentifier: '', lastActiveAt: 0 } as never)
    await pushSnapshot()
    await addNote('only here')  // pretend quickNotes is newer than the other device's Zenith
    await pushSnapshot()
    cloud.row = { ...cloud.row!, payload: { version: 2, exportedAt: 1, schemaVersion: db.verno, tables: { userProfile: [] } }, updated_at: cloud.stamp() }

    expect((await pullSnapshot()).ok).toBe(true)
    expect(await notes()).toEqual(['only here'])
  })
})

/* ═══ Choosing a side in a conflict ════════════════════════════════ */

describe('resolving a conflict', () => {
  it('"keep this device": the cloud’s version is kept here before it is replaced', async () => {
    await addNote('laptop'); await pushSnapshot()
    otherDeviceWrites(['phone version'])
    await addNote('laptop edit'); markDirty()

    expect((await pushSnapshot({ overwriteCloud: true })).ok).toBe(true)
    expect(cloudNotes()).toEqual(['laptop', 'laptop edit'])
    const aside = (await db.db_snapshots.toArray()).filter(s => s.kind === 'cloud-copy')
    expect(aside).toHaveLength(1)
    expect(aside[0].payload).toContain('phone version')
  })

  it('"keep the cloud’s": this device’s unsaved version is kept before it is replaced', async () => {
    await addNote('laptop'); await pushSnapshot()
    otherDeviceWrites(['phone version'])
    await addNote('laptop edit'); markDirty()

    expect((await pullSnapshot({ discardLocal: true })).ok).toBe(true)
    expect(await notes()).toEqual(['phone version'])
    const kept = (await db.db_snapshots.toArray()).filter(s => s.kind === 'before-cloud-load')
    expect(kept[0].payload).toContain('laptop edit')
  })
})

/* ═══ Accounts ═════════════════════════════════════════════════════ */

describe('a different account on the same browser', () => {
  it('cannot have the previous person’s data pushed into it, or pulled over it', async () => {
    await addNote('A’s private note'); await pushSnapshot()   // device now belongs to user-A
    const aRow = cloud.row

    cloud.signedIn = 'user-B'; cloud.row = null
    markDirty()
    expect(await pushSnapshot()).toMatchObject({ ok: false, blocked: 'account-mismatch' })
    expect(cloud.row).toBeNull()                                // nothing of A's went to B

    cloud.row = { ...aRow!, user_id: 'user-B', payload: { version: 2, exportedAt: 1, schemaVersion: db.verno, tables: { quickNotes: [] } } }
    setSnapshotMeta({ lastLocalChangeAt: null })
    expect(await pullSnapshot()).toMatchObject({ ok: false, blocked: 'account-mismatch' })
    expect(await notes()).toEqual(['A’s private note'])
  })

  it('cannot read another account’s copy at all', async () => {
    otherDeviceWrites(['user A only'])
    cloud.signedIn = 'user-B'
    expect(await pullSnapshot()).toMatchObject({ ok: false })
    expect(await notes()).toEqual([])
  })
})

/* ═══ Nothing secret reaches the cloud ═════════════════════════════ */

describe('what the cloud receives', () => {
  it('holds no API keys, no encryption keys and no location', async () => {
    localStorage.setItem('zenith_ai_config_v1', '{"userApiKey":"sk-SECRET"}')
    localStorage.setItem('zenith_geo_cache_v1', '{"lat":42.44}')
    await db.userProfile.put({ id: 1, userName: 'Will', universityName: '', majorIdentifier: '', lastActiveAt: 0,
      letterboxPrivateKeyJwk: '{"d":"PRIVATE"}' } as never)
    await pushSnapshot()

    const sent = JSON.stringify(cloud.row)
    expect(sent).not.toContain('sk-SECRET')
    expect(sent).not.toContain('PRIVATE')
    expect(sent).not.toContain('42.44')
  })
})

describe('a copy already in the cloud from before secrets were stripped', () => {
  it('is replaced with a clean one even when nothing new needs saving', async () => {
    await addNote('one'); await pushSnapshot()
    /* What an older Zenith left there: a key in the settings, no marker. */
    const leaky = cloud.row!.payload as Record<string, unknown>
    delete leaky.secretsStripped
    leaky.settings = { 'zenith_ai_config_v1': '{"userApiKey":"sk-OLD-LEAK"}' }

    const { getRemoteMeta } = await import('@/services/cloudSnapshot')
    const remote = await getRemoteMeta()
    expect(remote?.secretsStripped).toBe(false)
    expect(decideSync({ meta: getSnapshotMeta(), userId: 'user-A', remote, localDirty: false,
      localHasData: true, localSchema: db.verno })).toEqual({ action: 'push' })

    expect((await pushSnapshot()).ok).toBe(true)
    expect(JSON.stringify(cloud.row)).not.toContain('sk-OLD-LEAK')
    expect((await getRemoteMeta())?.secretsStripped).toBe(true)
  })
})

/* ═══ Clocks ═══════════════════════════════════════════════════════ */

describe('a device whose clock runs slow', () => {
  it('still knows an edit made after a sync is unsaved', () => {
    const meta: SnapshotMeta = {
      lastSyncedAt: '2026-09-26T09:05:00.000Z',              // server time
      lastLocalChangeAt: Date.parse('2026-09-26T09:03:00.000Z'),  // phone two minutes behind
      settingsFingerprint: null,
    }
    expect(hasUnpushedLocalChanges(meta)).toBe(true)
  })
})

/* ═══ The decision ═════════════════════════════════════════════════ */

describe('what happens automatically', () => {
  const base = {
    userId: 'user-A', localSchema: 50, localHasData: true,
    meta: { lastSyncedAt: 'v1', lastLocalChangeAt: null, settingsFingerprint: null, ownerUserId: 'user-A' } as SnapshotMeta,
  }
  const remote = (updatedAt: string, schemaVersion = 50) => ({ updatedAt, deviceLabel: null, schemaVersion })

  it('saves when only this device changed', () => {
    expect(decideSync({ ...base, remote: remote('v1'), localDirty: true })).toEqual({ action: 'push' })
  })
  it('loads when only the cloud changed', () => {
    expect(decideSync({ ...base, remote: remote('v2'), localDirty: false })).toEqual({ action: 'pull' })
  })
  it('stops and asks when both changed', () => {
    expect(decideSync({ ...base, remote: remote('v2'), localDirty: true }))
      .toEqual({ action: 'blocked', reason: 'conflict' })
  })
  it('stops and asks on a first sync of a device that already has data', () => {
    expect(decideSync({ ...base, meta: { ...base.meta, lastSyncedAt: null }, remote: remote('v2'), localDirty: false }))
      .toEqual({ action: 'blocked', reason: 'conflict' })
  })
  it('stops for another account', () => {
    expect(decideSync({ ...base, userId: 'user-B', remote: remote('v1'), localDirty: true }))
      .toEqual({ action: 'blocked', reason: 'account-mismatch' })
  })
  it('stops an outdated Zenith from saving', () => {
    expect(decideSync({ ...base, remote: remote('v1', 51), localDirty: true }))
      .toEqual({ action: 'blocked', reason: 'outdated-app' })
  })
  it('does nothing when nothing changed', () => {
    expect(decideSync({ ...base, remote: remote('v1'), localDirty: false })).toEqual({ action: 'idle' })
  })
  it('creates the first cloud copy from a device with data', () => {
    expect(decideSync({ ...base, remote: null, localDirty: false })).toEqual({ action: 'push' })
  })
})

it('keeps its watermark only on this device', () => {
  expect(SNAPSHOT_META_KEY).toBe('zenith_snapshot_meta_v1')
  expect(getSnapshotMeta().ownerUserId).toBeNull()
})
