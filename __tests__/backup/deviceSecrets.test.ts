/**
 * What never leaves this device — and never arrives on it from a copy.
 *
 * Every backup, the cloud copy included, used to carry the user's AI
 * provider key, their Google Books key, this device's location, its sync
 * identity, and the private half of the key pair that makes friend
 * messages end-to-end encrypted. These tests are the specification for
 * utils/deviceSecrets.ts: stripped on the way out, ignored on the way in,
 * and this device's own values kept across a load.
 */

import { db } from '@/lib/db'
import { buildBackupPayload, collectSettings } from '@/utils/dbExporter'
import { importJsonToLocalDatabase } from '@/utils/dbImporter'
import { isDeviceOnlySetting } from '@/utils/deviceSecrets'

const AI_KEY    = '{"userApiKey":"sk-ant-api03-SECRET","provider":"anthropic"}'
const BOOKS_KEY = 'AIzaSy-BOOKS-SECRET'
const PRIVATE   = '{"kty":"RSA","d":"PRIVATE-EXPONENT"}'
const PUBLIC    = '{"kty":"RSA","n":"PUBLIC-MODULUS"}'

beforeEach(async () => {
  localStorage.clear()
  await db.userProfile.clear()
  await db.quickNotes.clear()
})

async function seedDevice() {
  localStorage.setItem('zenith_ai_config_v1', AI_KEY)
  localStorage.setItem('zenith_google_books_key_v1', BOOKS_KEY)
  localStorage.setItem('zenith_geo_cache_v1', '{"lat":42.44,"lon":-76.5}')
  localStorage.setItem('zenith_client_uuid_v1', 'device-A')
  localStorage.setItem('zenith_custom_theme_v1', '{"accent":"#ff0000"}')   // an ordinary preference
  await db.userProfile.put({
    id: 1, userName: 'Will', universityName: '', majorIdentifier: '', lastActiveAt: 0,
    letterboxPublicKeyJwk: PUBLIC, letterboxPrivateKeyJwk: PRIVATE,
  } as never)
}

describe('a backup leaving this device', () => {
  it('carries no keys, no location and no device identity', async () => {
    await seedDevice()
    const json = JSON.stringify(await buildBackupPayload())

    for (const secret of ['sk-ant-api03-SECRET', 'BOOKS-SECRET', 'PRIVATE-EXPONENT',
                          'PUBLIC-MODULUS', '42.44', 'device-A']) {
      expect(json).not.toContain(secret)
    }
  })

  it('still carries ordinary preferences and the profile itself', async () => {
    await seedDevice()
    const payload = await buildBackupPayload()
    expect(payload.settings?.['zenith_custom_theme_v1']).toBe('{"accent":"#ff0000"}')
    expect((payload.tables.userProfile as { userName: string }[])[0].userName).toBe('Will')
  })

  it('does not change what is stored on this device', async () => {
    await seedDevice()
    await buildBackupPayload()
    expect(localStorage.getItem('zenith_ai_config_v1')).toBe(AI_KEY)
    expect((await db.userProfile.get(1))?.letterboxPrivateKeyJwk).toBe(PRIVATE)
  })

  it('treats a later setting whose name says "key" or "token" as a secret too', () => {
    expect(isDeviceOnlySetting('zenith_openai_key_v1')).toBe(true)
    expect(isDeviceOnlySetting('zenith_calendar_token_v2')).toBe(true)
    expect(isDeviceOnlySetting('zenith_friend_privacy_v1')).toBe(false)
    expect(isDeviceOnlySetting('zenith_widget_order_v1')).toBe(false)
    expect(Object.keys(collectSettings())).toEqual([])   // nothing seeded yet
  })
})

describe('a copy arriving on this device', () => {
  /* A copy made before this fix — the kind already sitting in the cloud. */
  const OLD_COPY = JSON.stringify({
    version: 2, exportedAt: 1, schemaVersion: 1,
    tables: {
      userProfile: [{
        id: 1, userName: 'Will', universityName: 'Cornell', majorIdentifier: '', lastActiveAt: 5,
        letterboxPublicKeyJwk: '{"from":"device-B"}', letterboxPrivateKeyJwk: '{"from":"device-B-private"}',
      }],
      quickNotes: [{ id: 1, title: 'from the copy', body: '', category: 'idea', createdAt: 1, updatedAt: 1 }],
    },
    settings: {
      'zenith_ai_config_v1': '{"userApiKey":"someone-elses-key"}',
      'zenith_client_uuid_v1': 'device-B',
      'zenith_custom_theme_v1': '{"accent":"#00ff00"}',
    },
  })

  it('never takes a key from the copy, and keeps this device’s own', async () => {
    await seedDevice()
    await importJsonToLocalDatabase(OLD_COPY)

    expect(localStorage.getItem('zenith_ai_config_v1')).toBe(AI_KEY)
    expect(localStorage.getItem('zenith_client_uuid_v1')).toBe('device-A')
    const profile = await db.userProfile.get(1)
    expect(profile?.letterboxPrivateKeyJwk).toBe(PRIVATE)
    expect(profile?.letterboxPublicKeyJwk).toBe(PUBLIC)
  })

  it('still loads everything else from the copy', async () => {
    await seedDevice()
    await importJsonToLocalDatabase(OLD_COPY)

    expect(localStorage.getItem('zenith_custom_theme_v1')).toBe('{"accent":"#00ff00"}')
    expect((await db.userProfile.get(1))?.universityName).toBe('Cornell')
    expect((await db.quickNotes.toArray()).map(n => n.title)).toEqual(['from the copy'])
  })

  it('does not adopt another device’s key pair on a device that has none', async () => {
    await importJsonToLocalDatabase(OLD_COPY)
    const profile = await db.userProfile.get(1)
    expect(profile?.letterboxPrivateKeyJwk).toBeUndefined()
    expect(localStorage.getItem('zenith_ai_config_v1')).toBeNull()
  })

  it('keeps this device’s profile when the copy has none', async () => {
    await seedDevice()
    await importJsonToLocalDatabase(JSON.stringify({
      version: 2, exportedAt: 1, schemaVersion: 1, tables: { userProfile: [], quickNotes: [] },
    }))
    const profile = await db.userProfile.get(1)
    expect(profile?.userName).toBe('Will')
    expect(profile?.letterboxPrivateKeyJwk).toBe(PRIVATE)
  })
})

describe('loading a cloud copy from an older Zenith', () => {
  const NO_NOTES_TABLE = JSON.stringify({
    version: 2, exportedAt: 1, schemaVersion: 1, tables: { userProfile: [] },
  })

  it('leaves a table the copy does not mention alone', async () => {
    await db.quickNotes.add({ title: 'mine', body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
    await importJsonToLocalDatabase(NO_NOTES_TABLE, { preserveMissingTables: true })
    expect((await db.quickNotes.toArray()).map(n => n.title)).toEqual(['mine'])
  })

  it('a backup file still means "the whole database", as before', async () => {
    await db.quickNotes.add({ title: 'mine', body: '', category: 'idea', createdAt: 1, updatedAt: 1 } as never)
    await importJsonToLocalDatabase(NO_NOTES_TABLE)
    expect(await db.quickNotes.count()).toBe(0)
  })
})
