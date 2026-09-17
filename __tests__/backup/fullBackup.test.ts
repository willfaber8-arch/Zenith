/**
 * A backup that leaves things out is worse than none, because it is
 * trusted. Two whole categories were missing from it:
 *
 *   · the Arcade's database — a second Dexie instance entirely, holding
 *     credits, resources, the biosphere, crucible jobs and the skill tree
 *   · every customisation — the theme, widget positions and sizes,
 *     dashboard presets, hidden nav items, calendar hours, cube options:
 *     around a hundred keys, all of them in localStorage, none of them
 *     in the payload
 *
 * So "restore" gave your data back with someone else's settings and an
 * empty Arcade.
 */

import { db } from '@/lib/db'
import { gamesDb } from '@/lib/gamesDb'
import {
  buildBackupPayload, collectSettings,
  SETTINGS_EXCLUDED, SETTINGS_PREFIX,
} from '@/utils/dbExporter'
import { importJsonToLocalDatabase, inspectBackup } from '@/utils/dbImporter'

beforeEach(async () => {
  localStorage.clear()
  await db.quickNotes.clear()
  await gamesDb.resource_inventory.clear()
})

describe('what the backup contains', () => {
  it('carries the customisations, not just the database', async () => {
    localStorage.setItem('zenith_custom_theme_v1', '{"accent":"#ff0000"}')
    localStorage.setItem('zenith_widget_order_v1', '["a","b"]')

    const payload = await buildBackupPayload()
    expect(payload.settings?.['zenith_custom_theme_v1']).toBe('{"accent":"#ff0000"}')
    expect(payload.settings?.['zenith_widget_order_v1']).toBe('["a","b"]')
  })

  it('carries the Arcade database, which is a separate Dexie instance', async () => {
    await gamesDb.resource_inventory.put({
      id: 'cosmetic_points', amount: 4200, capacity: 99_999,
    } as never)

    const payload = await buildBackupPayload()
    expect(payload.gamesTables?.resource_inventory).toHaveLength(1)
    expect(payload.gamesSchemaVersion).toBeGreaterThan(0)
  })

  it('leaves other software on the same origin alone', () => {
    localStorage.setItem('some_other_app_token', 'secret')
    localStorage.setItem('zenith_color_scheme_v1', 'dark')
    const s = collectSettings()
    expect(s['zenith_color_scheme_v1']).toBe('dark')
    expect(s['some_other_app_token']).toBeUndefined()
    expect(Object.keys(s).every(k => k.startsWith(SETTINGS_PREFIX))).toBe(true)
  })

  /*
   * These two describe *this* browser rather than a preference, and
   * carrying them across profiles breaks the thing they describe.
   */
  it('excludes the sync watermark and the signed-in session', () => {
    localStorage.setItem('zenith_snapshot_meta_v1', '{"lastSyncedAt":"x"}')
    localStorage.setItem('zenith_session_active', '{"userHandle":"Someone"}')
    localStorage.setItem('zenith_color_scheme_v1', 'dark')

    const s = collectSettings()
    expect(s['zenith_snapshot_meta_v1']).toBeUndefined()
    expect(s['zenith_session_active']).toBeUndefined()
    expect(s['zenith_color_scheme_v1']).toBe('dark')
    expect(SETTINGS_EXCLUDED.size).toBe(2)
  })
})

describe('restoring it all back', () => {
  it('puts the customisations back', async () => {
    localStorage.setItem('zenith_custom_theme_v1', '{"accent":"#00ff00"}')
    const json = JSON.stringify(await buildBackupPayload())

    localStorage.setItem('zenith_custom_theme_v1', '{"accent":"#000000"}')
    const res = await importJsonToLocalDatabase(json)

    expect(localStorage.getItem('zenith_custom_theme_v1')).toBe('{"accent":"#00ff00"}')
    expect(res.settingsRestored).toBeGreaterThan(0)
  })

  it('puts the Arcade back', async () => {
    await gamesDb.resource_inventory.put({
      id: 'cosmetic_points', amount: 4200, capacity: 99_999,
    } as never)
    const json = JSON.stringify(await buildBackupPayload())

    await gamesDb.resource_inventory.clear()
    const res = await importJsonToLocalDatabase(json)

    const row = await gamesDb.resource_inventory.get('cosmetic_points')
    expect((row as { amount: number } | undefined)?.amount).toBe(4200)
    expect(res.gamesRowsWritten).toBeGreaterThan(0)
  })

  it('still restores the main database', async () => {
    await db.quickNotes.add({
      title: 'Keep me', body: 'x', category: 'personal', updatedAt: Date.now(),
    } as never)
    const json = JSON.stringify(await buildBackupPayload())
    await db.quickNotes.clear()

    await importJsonToLocalDatabase(json)
    expect((await db.quickNotes.toArray())[0]?.title).toBe('Keep me')
  })

  /*
   * A setting added after the backup was taken is left alone rather than
   * swept away. localStorage is exactly where enthusiastic clearing has
   * bitten this app before.
   */
  it('does not delete a setting the backup never knew about', async () => {
    const json = JSON.stringify(await buildBackupPayload())
    localStorage.setItem('zenith_brand_new_setting_v1', 'keep')

    await importJsonToLocalDatabase(json)
    expect(localStorage.getItem('zenith_brand_new_setting_v1')).toBe('keep')
  })

  it('never restores the watermark or the session over this browser\'s own', async () => {
    const payload = await buildBackupPayload()
    const tampered = JSON.stringify({
      ...payload,
      settings: {
        ...payload.settings,
        zenith_snapshot_meta_v1: '{"lastSyncedAt":"from-another-profile"}',
        zenith_session_active:   '{"userHandle":"Someone Else"}',
      },
    })
    localStorage.setItem('zenith_snapshot_meta_v1', '{"lastSyncedAt":"mine"}')

    await importJsonToLocalDatabase(tampered)
    expect(localStorage.getItem('zenith_snapshot_meta_v1')).toBe('{"lastSyncedAt":"mine"}')
    expect(localStorage.getItem('zenith_session_active')).toBeNull()
  })
})

describe('a backup taken before any of this still imports', () => {
  const v1 = JSON.stringify({
    version: 1, exportedAt: Date.now(), schemaVersion: 40,
    tables: { quickNotes: [{ id: 1, title: 'Old note', body: '', category: 'personal', updatedAt: 1 }] },
  })

  it('restores what it has', async () => {
    const res = await importJsonToLocalDatabase(v1)
    expect((await db.quickNotes.toArray())[0]?.title).toBe('Old note')
    expect(res.settingsRestored).toBe(0)
  })

  it('leaves the Arcade alone rather than clearing it', async () => {
    await gamesDb.resource_inventory.put({
      id: 'cosmetic_points', amount: 99, capacity: 99_999,
    } as never)

    await importJsonToLocalDatabase(v1)

    /* The file never held an Arcade, so it has no business emptying one. */
    const row = await gamesDb.resource_inventory.get('cosmetic_points')
    expect((row as { amount: number } | undefined)?.amount).toBe(99)
  })

  it('reads as a valid backup, reporting nothing where there is nothing', () => {
    const summary = inspectBackup(v1)
    expect(summary.rowCount).toBe(1)
    expect(summary.gamesRowCount).toBe(0)
    expect(summary.settingsCount).toBe(0)
  })
})

describe('what the confirmation can say before replacing anything', () => {
  it('counts the Arcade rows and the customisations', async () => {
    localStorage.setItem('zenith_color_scheme_v1', 'dark')
    await gamesDb.resource_inventory.put({
      id: 'cosmetic_points', amount: 7, capacity: 99_999,
    } as never)

    const summary = inspectBackup(JSON.stringify(await buildBackupPayload()))
    expect(summary.gamesRowCount).toBeGreaterThan(0)
    expect(summary.settingsCount).toBeGreaterThan(0)
  })
})

/* ── Knowing there is something to push ──────────────────────────── */

/*
 * Dexie hooks catch database edits. Nearly every customisation lives in
 * localStorage, which has no hook to fire — so changing only a setting
 * left the profile looking clean and the push never ran, however many
 * times you changed it. The payload containing settings is worthless if
 * nothing ever notices they changed.
 */
describe('a changed setting counts as something to push', () => {
  it('is clean right after a sync', async () => {
    const { settingsFingerprint, hasUnpushedLocalChanges } = await import('@/services/cloudSnapshot')
    localStorage.setItem('zenith_color_scheme_v1', 'dark')
    const meta = {
      lastSyncedAt: new Date().toISOString(),
      lastLocalChangeAt: null,
      settingsFingerprint: settingsFingerprint(),
    }
    expect(hasUnpushedLocalChanges(meta)).toBe(false)
  })

  it('goes dirty when a setting changes, with no database write at all', async () => {
    const { settingsFingerprint, hasUnpushedLocalChanges } = await import('@/services/cloudSnapshot')
    localStorage.setItem('zenith_color_scheme_v1', 'dark')
    const meta = {
      lastSyncedAt: new Date().toISOString(),
      lastLocalChangeAt: null,
      settingsFingerprint: settingsFingerprint(),
    }
    localStorage.setItem('zenith_color_scheme_v1', 'light')
    expect(hasUnpushedLocalChanges(meta)).toBe(true)
  })

  it('goes dirty when a new customisation appears', async () => {
    const { settingsFingerprint, hasUnpushedLocalChanges } = await import('@/services/cloudSnapshot')
    const meta = {
      lastSyncedAt: new Date().toISOString(),
      lastLocalChangeAt: null,
      settingsFingerprint: settingsFingerprint(),
    }
    localStorage.setItem('zenith_widget_order_v1', '["a"]')
    expect(hasUnpushedLocalChanges(meta)).toBe(true)
  })

  it('ignores the keys that never travel', async () => {
    const { settingsFingerprint, hasUnpushedLocalChanges } = await import('@/services/cloudSnapshot')
    const meta = {
      lastSyncedAt: new Date().toISOString(),
      lastLocalChangeAt: null,
      settingsFingerprint: settingsFingerprint(),
    }
    /* Syncing itself rewrites the watermark; that must not look like a
       new local change, or the profile would never be clean again. */
    localStorage.setItem('zenith_snapshot_meta_v1', '{"lastSyncedAt":"later"}')
    localStorage.setItem('zenith_session_active', '{"userHandle":"Will"}')
    expect(hasUnpushedLocalChanges(meta)).toBe(false)
  })

  it('does not call a never-synced profile dirty on settings alone', async () => {
    const { hasUnpushedLocalChanges } = await import('@/services/cloudSnapshot')
    localStorage.setItem('zenith_color_scheme_v1', 'dark')
    expect(hasUnpushedLocalChanges({
      lastSyncedAt: null, lastLocalChangeAt: null, settingsFingerprint: null,
    })).toBe(false)
  })
})

/*
 * The reported symptom, named: switching browsers on the same PC meant
 * rearranging the sidebar by hand every time. A browser profile has its
 * own localStorage, so the arrangement never travelled — it was not in
 * the backup for the cloud snapshot to carry.
 */
describe('the sidebar arrangement travels', () => {
  const LAYOUT = {
    zenith_nav_layout_v1:        '["habits","calendar","notes"]',
    zenith_hidden_nav_items_v1:  '["games","trail-hunter"]',
    zenith_nav_collapsed_v1:     '["creator"]',
    zenith_sidebar_hidden_v1:    'false',
    zenith_widget_order_v1:      '["weather","habits"]',
    zenith_widget_positions_v2:  '{"weather":{"x":0,"y":0}}',
    zenith_widget_sizes_v1:      '{"weather":"wide"}',
  }

  it('survives a round-trip into another browser profile', async () => {
    for (const [k, v] of Object.entries(LAYOUT)) localStorage.setItem(k, v)
    const json = JSON.stringify(await buildBackupPayload())

    /* The other browser: none of it has ever been set here. */
    localStorage.clear()
    for (const k of Object.keys(LAYOUT)) expect(localStorage.getItem(k)).toBeNull()

    await importJsonToLocalDatabase(json)

    for (const [k, v] of Object.entries(LAYOUT)) {
      expect(localStorage.getItem(k)).toBe(v)
    }
  })
})
