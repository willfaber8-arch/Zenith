/**
 * lib/dataResetVersion.ts — the one-time local wipe's version sentinel.
 *
 * Kept in its own module so the E2E suite can read the same value the
 * app writes. Playwright hands every test a clean browser profile, so
 * without the sentinel `DataResetGate` fires on every single test:
 * it clears localStorage — taking the injected session with it —
 * deletes both IndexedDB databases, and reloads. Any `page.evaluate`
 * still running at that moment dies with "Execution context was
 * destroyed", and anything the test had written is gone.
 *
 * Duplicating the string in the test helpers would work until someone
 * bumped WIPE_VERSION here, at which point the suite would start
 * failing for a reason with no visible connection to the change.
 */

/** Bump to trigger another wipe on every device in a future release. */
export const WIPE_VERSION = 'v1'

/** localStorage key holding `'done'` once this device has been wiped. */
export const SENTINEL_KEY = 'zenith_data_wiped_' + WIPE_VERSION
