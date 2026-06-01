'use client'

/**
 * TestBridge — Phase 6 · Step 6.2 — E2E Test Accessor
 *
 * Zero-render component that mounts a `window.__zenith` accessor object
 * for Playwright E2E test suites. Rendered ONLY when NEXT_PUBLIC_E2E=1
 * (set via playwright.config.ts → webServer.env). Never reaches a
 * production bundle.
 *
 * Why a component, not a module-level side effect?
 *   • `useEffect` guarantees we only run in the browser (SSR-safe).
 *   • The `db` import needs to resolve AFTER the module graph is hydrated,
 *     which only happens client-side. A module-level call would import the
 *     null SSR sentinel and freeze `window.__zenith.db` as null.
 *
 * window.__zenith surface:
 *   db              — live Dexie instance; writes through it trigger
 *                     useLiveQuery reactivity AND the sync engine hooks
 *   awardXp         — grants XP via applyXpGain + Dexie modify()
 *   awardGold       — grants Zenith Gold; Dexie modify()
 *   seedUserProfile — idempotent profile bootstrap (only creates if absent)
 *
 * Playwright usage (inside page.evaluate):
 *   const id = await window.__zenith.db.assignments.add({ ... })
 *   const profile = await window.__zenith.db.userProfile.get(1)
 *   await window.__zenith.awardXp(75)
 */

import { useEffect } from 'react'
import { db, awardXp, awardGold, seedUserProfile } from '@/lib/db'

export default function TestBridge() {
  useEffect(() => {
    window.__zenith = { db, awardXp, awardGold, seedUserProfile }

    /*
     * Signal that the bridge is ready — page.waitForEvent('zenith:bridge-ready')
     * in test fixtures guarantees all helpers are available before assertions run.
     */
    window.dispatchEvent(new CustomEvent('zenith:bridge-ready'))
  }, [])

  return null
}
