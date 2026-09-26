/**
 * utils/deviceSecrets.ts — what never leaves this device.
 *
 * Everything that goes into a backup — the cloud copy and a downloaded
 * file alike — is built by `buildBackupPayload`, and everything that comes
 * back goes through `importJsonToLocalDatabase`. This file is the single
 * list both of them consult, so "does this travel?" has exactly one answer.
 *
 * Two kinds of thing stay put:
 *
 *   Secrets. The AI provider key and the Google Books key are credentials
 *   that can spend money on someone else's account; the letterbox key
 *   pair is what makes friend messages end-to-end encrypted. All three
 *   were going up to the cloud in every snapshot — the AI key's own
 *   module promises it is "never sent to our server", and the private
 *   key's field is commented "never leaves the device". Neither was true.
 *
 *   Facts about this device. The cached location is where this laptop or
 *   phone was, and the client id is how the sync broker tells devices
 *   apart; copying either onto another device makes it wrong there.
 *
 * Both rules run in both directions. A copy made before this existed
 * still contains them, so loading one must not overwrite this device's
 * own — the incoming values are dropped and the local ones kept.
 */

/** localStorage keys that are never exported and never imported. */
export const DEVICE_ONLY_SETTINGS: ReadonlySet<string> = new Set([
  'zenith_ai_config_v1',          // user's AI provider API key
  'zenith_google_books_key_v1',   // user's Google Books API key
  'zenith_geo_cache_v1',          // this device's last known location
  'zenith_client_uuid_v1',        // this device's identity for the sync broker
])

/*
 * A net under the list. A setting added later that holds a credential
 * will not be in the set above on the day it is written — so anything
 * whose name says it is one is treated as one too. A false positive
 * costs a preference that has to be set again on another device; a false
 * negative uploads a key. That asymmetry is the whole reason for this.
 */
const SECRET_NAME = /(^|_)(api|secret|token|password|passwd|credential|credentials|private|auth)(_|$)|_key(_v\d+)?$/i

/** True when a localStorage key must stay on this device. */
export function isDeviceOnlySetting(key: string): boolean {
  return DEVICE_ONLY_SETTINGS.has(key) || SECRET_NAME.test(key)
}

/** Fields on the `userProfile` row that belong to this device alone. */
export const DEVICE_ONLY_PROFILE_FIELDS = [
  'letterboxPublicKeyJwk',
  'letterboxPrivateKeyJwk',
] as const

type ProfileLike = Record<string, unknown>

/** A copy of a profile row with this device's secrets removed. */
export function stripProfileSecrets<T extends ProfileLike>(row: T): T {
  const out: ProfileLike = { ...row }
  for (const f of DEVICE_ONLY_PROFILE_FIELDS) delete out[f]
  return out as T
}

/** Just the device-only fields of a profile row, for carrying across a load. */
export function pickProfileSecrets(row: ProfileLike | undefined | null): ProfileLike {
  const out: ProfileLike = {}
  if (!row) return out
  for (const f of DEVICE_ONLY_PROFILE_FIELDS) {
    if (row[f] !== undefined) out[f] = row[f]
  }
  return out
}
