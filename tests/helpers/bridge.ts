/**
 * tests/helpers/bridge.ts — Playwright TestBridge Utilities
 * Phase 6 · Step 6.2 — E2E Test Suite
 *
 * Typed wrappers around page.evaluate() that call window.__zenith.*
 * inside the browser context. All calls go through the live Dexie
 * instance, so writes trigger useLiveQuery reactivity and sync hooks
 * exactly as real user interactions would.
 *
 * Import these in test files instead of calling page.evaluate() directly
 * to keep test code readable and get TypeScript intellisense.
 */

import type { Page, BrowserContext } from '@playwright/test'

/* ── Auth constants (must match lib/AuthContext.tsx) ──────────── */

export const AUTH_STORAGE_KEY = 'zenith_session_active'
export const DB_NAME          = 'ZenithOS'

/** Mock session object identical to the shape produced by AuthContext.signIn() */
export const MOCK_SESSION = {
  userHandle:   'E2E Test Runner',
  sessionToken: 'mock_jwt_e2e_zenith_phase6_v1',
  timestamp:    Date.now(),
} as const

/* ── Auth injection ───────────────────────────────────────────── */

/**
 * Inject the mock auth session into localStorage BEFORE page code runs.
 * Call on the BrowserContext, not the Page, so the script fires on every
 * navigation inside the context (including redirects and reloads).
 */
export async function injectAuth(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ key, session }: { key: string; session: typeof MOCK_SESSION }) => {
      localStorage.setItem(key, JSON.stringify(session))
    },
    { key: AUTH_STORAGE_KEY, session: MOCK_SESSION },
  )
}

/* ── Bridge readiness ─────────────────────────────────────────── */

/**
 * Wait for TestBridge to mount window.__zenith.
 * Must be called after page.goto('/') before any bridge.* helper.
 */
export async function waitForBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__zenith !== 'undefined',
    { timeout: 12_000 },
  )
}

/* ── Profile management ───────────────────────────────────────── */

/**
 * Seed or overwrite the userProfile singleton (id=1) via Dexie's `put()`.
 *
 * Uses `put()` rather than `delete+add` to avoid race conditions with
 * BadgeSyncEffect which calls `seedUserProfile()` asynchronously on auth.
 * `put()` is an atomic upsert — safe to call at any time after bridge ready.
 *
 * Waits up to 2 s for BadgeSyncEffect to create the initial row before
 * overwriting it, so the IDB object store exists when we call `put()`.
 */
export async function seedProfile(
  page: Page,
): Promise<void> {
  await page.evaluate(async () => {
    const db = window.__zenith!.db

    for (let i = 0; i < 20; i++) {
      if (await db.userProfile.get(1)) break
      await new Promise(r => setTimeout(r, 100))
    }

    await db.userProfile.put({
      id:              1,
      userName:        'E2E Test Runner',
      universityName:  '',
      majorIdentifier: '',
      lastActiveAt:    Date.now(),
    })
  })
}

/* ── Assignment management ────────────────────────────────────── */

/** Assignment fields accepted by the add helper */
export interface TestAssignment {
  title:    string
  dueDate:  string
  courseId: string
  status:   'pending' | 'in_progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high' | 'critical'
  notes?:   string
}

/**
 * Write an assignment through the live Dexie instance.
 *
 * Because this goes through Dexie (not raw IndexedDB), it:
 *   • triggers the `assignments.creating` Dexie hook → enqueues to
 *     pendingSyncQueue for high/critical priorities
 *   • notifies useLiveQuery subscribers → UrgentTasksWidget re-renders
 *   • injects `supabaseId = crypto.randomUUID()` onto the row
 *
 * Returns the auto-incremented IDB primary key.
 */
export async function addAssignment(
  page: Page,
  assignment: TestAssignment,
): Promise<number> {
  /*
   * Playwright serialises the argument to JSON before sending it to
   * the browser context. We reconstruct the full assignment object
   * inside the evaluate callback so Dexie sees correct field types.
   * The `any` cast on the parameter avoids the serialisation type
   * mismatch — Playwright handles the JSON round-trip transparently.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(async (a: any) => {
    const now = Date.now()
    return await window.__zenith!.db.assignments.add({
      title:     a.title    as string,
      dueDate:   a.dueDate  as string,
      courseId:  a.courseId as string,
      status:    a.status   as 'pending' | 'in_progress' | 'completed' | 'overdue',
      priority:  a.priority as 'low' | 'medium' | 'high' | 'critical',
      notes:     a.notes    as string | undefined,
      createdAt: now,
      updatedAt: now,
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, assignment as unknown as any)
}

/* ── IDB read helpers ─────────────────────────────────────────── */

/** Count all rows in an IDB table via Dexie */
export async function countTable(page: Page, table: string): Promise<number> {
  return page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (t) => await (window.__zenith!.db as any)[t].count() as number,
    table,
  )
}

/** Read all rows from pendingSyncQueue */
export async function readSyncQueue(page: Page): Promise<unknown[]> {
  return page.evaluate(async () =>
    await window.__zenith!.db.pendingSyncQueue.toArray()
  )
}

/* ── Navigation ──────────────────────────────────────────────── */

/**
 * Click a sidebar nav button and wait for the ViewRouter transition.
 * Uses the sidebar's `aria-label="Main navigation"` scope to avoid
 * collisions with any same-label text appearing in the view content.
 *
 * The ViewRouter uses a 200 ms exit + 300 ms entrance transition.
 * A 600 ms wait is the safe ceiling; prefer explicit content assertions
 * in the calling test instead of chaining on this function's timeout.
 */
export async function navigateTo(page: Page, label: string): Promise<void> {
  await page
    .locator('[aria-label="Main navigation"]')
    .getByRole('button', { name: label })
    .click()
  await page.waitForTimeout(620)   // exit(200) + entrance(300) + render buffer(120)
}
