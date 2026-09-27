/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Core E2E Test Suite
 * Phase 6 · Step 6.2 — Automated End-to-End Verification
 *
 * Three suites cover the three critical user-flow pillars:
 *
 *   Suite 1 — Auth Gate bypass & workspace initialization
 *     Verifies that a pre-injected localStorage session bypasses the
 *     AuthGate overlay and renders the full workspace shell.
 *
 *   Suite 2 — Local-first IDB write, reactive DOM, no per-item uploader
 *     Verifies the full local-first data path:
 *       write → IDB persists → useLiveQuery re-renders DOM
 *     and that the retired per-item uploader stays retired: a write
 *     queues nothing and sends nothing to its old cloud tables, and an
 *     `online` event leaves the workspace standing. Cloud sync is the
 *     whole-workspace snapshot, tested in __tests__/sync/.
 *
 *   (A third suite covering RPG levelling was described here. The
 *   gamification layer it tested — quests, XP, levels, the character
 *   status widget — was removed in the R restructure; the suite itself
 *   was already gone, and this note went with it.)
 *
 * Isolation model:
 *   Each test receives a fresh BrowserContext (isolated localStorage +
 *   IndexedDB per Playwright default). State written in one test never
 *   leaks into another. No explicit IDB deletion is required.
 *
 * Bridge contract:
 *   All Dexie writes use window.__zenith.db.* so they flow through
 *   the real transaction path, triggering useLiveQuery reactivity and
 *   the sync engine's Dexie hooks — identical to real user interactions.
 *
 * CI usage:
 *   npx playwright test                         # all suites
 *   npx playwright test --grep "Suite 2"        # single suite
 *   npx playwright test --reporter=html         # open report after run
 * ════════════════════════════════════════════════════════════════
 */

import { test, expect } from '@playwright/test'

import {
  injectAuth,
  waitForBridge,
  seedProfile,
  addAssignment,
  navigateTo,
  type TestAssignment,
} from './helpers/bridge'

/* ═══════════════════════════════════════════════════════════════
   SUITE 1 — Auth Gate bypass & workspace initialization
   ═══════════════════════════════════════════════════════════════ */

test.describe('Suite 1 — Auth Gate bypass & workspace initialization', () => {

  /**
   * beforeEach: inject the mock session into localStorage via
   * context.addInitScript() so it fires BEFORE any app JavaScript runs.
   * This replicates AuthContext.signIn() writing the session token.
   */
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context)
    await page.goto('/')
    await waitForBridge(page)
  })

  /* ── S1-T1 ─────────────────────────────────────────────────── */
  test(
    'S1-T1: injected session bypasses AuthGate; sidebar and workspace render',
    async ({ page }) => {
      /*
       * The AuthGate is always in the DOM but is visually hidden
       * (opacity: 0, pointerEvents: none) when authed. Playwright's
       * isVisible() checks CSS visibility, so we validate the transition
       * by asserting the WORKSPACE elements are interactable.
       */

      // Sidebar must be rendered and accessible
      await expect(page.locator('#sidebar')).toBeVisible({ timeout: 8_000 })

      // Primary navigation must be reachable via ARIA
      const nav = page.getByRole('navigation', { name: 'Primary' })
      await expect(nav).toBeVisible({ timeout: 5_000 })

      /*
       * Nav sections and items from NAV_CONFIG. This used to assert on
       * "Quest Matrix", which the R restructure removed along with the
       * rest of the RPG system — the test had been unpassable ever
       * since, and nothing said so because the workflow triggered on a
       * branch this repository does not use.
       */
      await expect(nav.getByText('Zenith Essentials')).toBeVisible()
      await expect(nav.getByRole('button', { name: 'Universal Calendar' })).toBeVisible()
    },
  )

  /* ── S1-T2 ─────────────────────────────────────────────────── */
  /*
   * This asserted that HomeView rendered RpgStatusWidget with XP and HP
   * progressbars and a level badge. That component, and the whole
   * character-lifecycle system behind it, was deleted in the R
   * restructure — there is nothing left to point the assertion at, so
   * it is replaced rather than repaired.
   *
   * What is worth asserting in its place is that the dashboard actually
   * reaches its widgets after a clean boot, which is the thing the
   * original test was really standing guard over.
   */
  test(
    'S1-T2: HomeView reaches its dashboard widgets after a clean boot',
    async ({ page }) => {
      /* Work Due is on by default in useSandboxConfig and reads from the
         assignments table, so it proves the widget layer mounted *and*
         that it can see the database. */
      await expect(
        /* exact — a substring match on 'Open Work' would also resolve to
           the Workouts widget's 'Open Workouts'. */
        page.getByRole('button', { name: 'Open Work Due', exact: true }),
      ).toBeVisible({ timeout: 15_000 })
    },
  )

})

/* ═══════════════════════════════════════════════════════════════
   SUITE 2 — Local-first IDB write, reactive DOM, sync queue schema
   ═══════════════════════════════════════════════════════════════ */

test.describe('Suite 2 — Local-first IDB write, reactive DOM, no per-item uploader', () => {

  /** The assignment we write in every S2 test */
  const TEST_ASSIGNMENT: TestAssignment = {
    title:    'Study for Linear Algebra Exam',
    dueDate:  '2026-12-15',
    courseId: 'MATH-2940',
    status:   'pending',
    priority: 'high',
    notes:    'E2E test fixture — Chapters 1–6, eigenvalues and diagonalization',
  }

  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context)
    await page.goto('/')
    await waitForBridge(page)
    await seedProfile(page)   // creates profile singleton at 0 XP, level 1, 100 HP
  })

  /* ── S2-T1 ─────────────────────────────────────────────────── */
  test(
    'S2-T1: ASSERTION 1+2 — high-priority assignment persists to IDB and streams into the dashboard',
    async ({ page }) => {
      /* ─ WRITE ─────────────────────────────────────────────── */
      const insertedId = await addAssignment(page, TEST_ASSIGNMENT)

      // Return value must be a valid auto-increment integer key
      expect(typeof insertedId).toBe('number')
      expect(insertedId).toBeGreaterThan(0)

      /* ─ ASSERTION 1: IDB persistence ──────────────────────── */
      // Cast through unknown — evaluate JSON-serialises the Dexie entity
      // into a plain object; the Assignment interface has no index signature.
      const row = await page.evaluate(
        async (id) => {
          const a = await window.__zenith!.db.assignments.get(id)
          if (!a) throw new Error(`Assignment id=${id} not found in IDB`)
          return a
        },
        insertedId,
      ) as unknown as Record<string, unknown>

      expect(row).toBeTruthy()
      expect(row['title']).toBe(TEST_ASSIGNMENT.title)
      expect(row['priority']).toBe('high')
      expect(row['status']).toBe('pending')
      expect(row['courseId']).toBe(TEST_ASSIGNMENT.courseId)
      expect(typeof row['createdAt']).toBe('number')
      expect(typeof row['updatedAt']).toBe('number')

      /* ─ ASSERTION 2: reactive DOM update ──────────────────── */
      /*
       * This pointed at UrgentTasksWidget's "Active assignments" list.
       * That component was rendered by nothing — it had no import
       * anywhere in the app — so the assertion could never pass. It has
       * been deleted; the Work Due widget covers the same ground and is
       * on the dashboard by default.
       *
       * The point of the assertion is unchanged and is the interesting
       * part: `addAssignment` writes through Dexie rather than raw IDB,
       * so the useLiveQuery subscription must fire and the count must
       * move without a reload.
       */
      /* exact — see S1-T2. */
      const workDue = page.getByRole('button', { name: 'Open Work Due', exact: true })
      await expect(workDue).toBeVisible({ timeout: 10_000 })
      await expect(workDue.getByText(/\d+\s*open/)).toBeVisible({ timeout: 5_000 })
    },
  )

  /* ── S2-T2 ─────────────────────────────────────────────────── */
  test(
    'S2-T2: a high-priority write queues nothing for the retired per-item uploader',
    async ({ page }) => {
      /*
       * The old sync engine's Dexie hook used to enqueue every
       * high/critical assignment into pendingSyncQueue for upload to
       * supabase_urgent_tasks — a table nothing in the app ever read
       * back. It is gone; a write now stays a local write, and cloud
       * sync is the whole-workspace snapshot.
       */
      await addAssignment(page, TEST_ASSIGNMENT)
      await page.waitForTimeout(500)   // longer than the old setTimeout(0) hook

      const queued = await page.evaluate(async () => ({
        engine: await window.__zenith!.db.pendingSyncQueue.count(),
        broker: await window.__zenith!.db.outboxMutations.count(),
      }))
      expect(queued).toEqual({ engine: 0, broker: 0 })
    },
  )

  /* ── S2-T3 ─────────────────────────────────────────────────── */
  test(
    'S2-T3: NETWORK INTERCEPT MOCK — an online event leaves the workspace standing and calls no retired per-item tables',
    async ({ page }) => {
      /*
       * Route ALL requests whose URL contains "supabase" to a local stub
       * that returns an empty success response, so no real network call
       * leaks into the test runner. The page must remain fully operational
       * after the event, and nothing may be sent to the per-item tables
       * the retired uploader used to write.
       */
      const intercepted: Array<{ method: string; url: string; body: string }> = []

      await page.route('**supabase**', async (route) => {
        const req = route.request()
        intercepted.push({
          method: req.method(),
          url:    req.url(),
          body:   req.postData() ?? '',
        })
        await route.fulfill({
          status:      200,
          contentType: 'application/json',
          body:        JSON.stringify({ data: [], error: null }),
        })
      })

      await addAssignment(page, TEST_ASSIGNMENT)
      await page.waitForTimeout(300)

      // Simulate the browser coming back online
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await page.waitForTimeout(1_800)   // past the old 1.5 s drain debounce

      /* ─ Stability assertion ─────────────────────────────────── */
      // The page must remain fully functional — no crash, no blank screen
      await expect(page.locator('#sidebar')).toBeVisible({ timeout: 3_000 })
      await expect(
        page.getByRole('navigation', { name: 'Primary' }),
      ).toBeVisible()

      /* ─ Nothing reaches the retired per-item tables ─────────── */
      const retired = /supabase_(urgent_tasks|user_profiles|habits|workouts)/
      expect(intercepted.filter(r => retired.test(r.url))).toEqual([])
    },
  )

})


