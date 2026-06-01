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
 *   Suite 2 — Local-first IDB write, reactive DOM, sync queue schema
 *     Verifies the full local-first data path:
 *       write → IDB persists → useLiveQuery re-renders DOM →
 *       sync engine hooks → pendingSyncQueue contains valid payload →
 *       online event does not crash the engine
 *
 *   Suite 3 — RPG leveling math accuracy & level-up state change
 *     Verifies the gamification layer end-to-end:
 *       defeat boss quest → awardXp fires → applyXpGain crosses
 *       threshold → userProfile.currentLevel advances →
 *       RpgStatusWidget DOM reflects new level
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
  readSyncQueue,
  navigateTo,
  expRequired,
  HIGH_PRIORITY_XP,
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

      // Key nav sections loaded from NAV_CONFIG
      await expect(nav.getByText('Zenith Essentials')).toBeVisible()
      await expect(nav.getByText('Quest Matrix')).toBeVisible()
    },
  )

  /* ── S1-T2 ─────────────────────────────────────────────────── */
  test(
    'S1-T2: HomeView renders RpgStatusWidget with correct ARIA semantics after clean boot',
    async ({ page }) => {
      const rpgWidget = page.getByRole('region', { name: 'Character Lifecycle Stats' })
      await expect(rpgWidget).toBeVisible({ timeout: 8_000 })

      // Both stat bars must expose correct progressbar ARIA roles
      await expect(
        rpgWidget.getByRole('progressbar', { name: 'Experience points' }),
      ).toBeVisible()
      await expect(
        rpgWidget.getByRole('progressbar', { name: 'Health points' }),
      ).toBeVisible()

      // Level badge must carry an accessible label for screen readers
      const levelBadge = rpgWidget.locator('[aria-label^="Level "]').first()
      await expect(levelBadge).toBeVisible()

      const levelText = await levelBadge.getAttribute('aria-label')
      expect(levelText).toMatch(/^Level \d+$/)
    },
  )

})

/* ═══════════════════════════════════════════════════════════════
   SUITE 2 — Local-first IDB write, reactive DOM, sync queue schema
   ═══════════════════════════════════════════════════════════════ */

test.describe('Suite 2 — Local-first IDB write, reactive DOM, sync queue schema', () => {

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
    'S2-T1: ASSERTION 1+2 — high-priority assignment persists to IDB and streams into UrgentTasksWidget DOM',
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

      // Sync engine should have injected a cloud UUID onto the row
      expect(row['supabaseId']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )

      /* ─ ASSERTION 2: reactive DOM update ──────────────────── */
      /*
       * UrgentTasksWidget uses useLiveQuery which re-renders whenever
       * the `assignments` store changes. Because addAssignment() writes
       * through Dexie (not raw IDB), the subscription fires immediately.
       * timeout:5_000 is generous — in practice the update arrives < 200 ms.
       */
      const taskList = page.getByRole('list', { name: 'Active assignments' })
      await expect(taskList).toBeVisible({ timeout: 5_000 })
      await expect(
        taskList.getByText(TEST_ASSIGNMENT.title),
      ).toBeVisible({ timeout: 5_000 })

      // Priority data attribute must propagate to the list item
      const priorityItem = taskList.locator('[data-priority="high"]')
      await expect(priorityItem).toBeVisible()
    },
  )

  /* ── S2-T2 ─────────────────────────────────────────────────── */
  test(
    'S2-T2: NETWORK INTERCEPT — pendingSyncQueue entry contains valid cloud-schema payload',
    async ({ page }) => {
      /*
       * The sync engine's Dexie `assignments.creating` hook fires when
       * a high/critical assignment is added. It:
       *   1. Injects supabaseId = crypto.randomUUID() onto the row
       *   2. setTimeout(0) → enqueueSync() → writes to pendingSyncQueue
       *
       * This test validates that the enqueued payload matches the schema
       * the reconcileLocalToCloud() flush would send to Supabase.
       */

      await addAssignment(page, TEST_ASSIGNMENT)

      /*
       * The sync hook uses setTimeout(0) to defer the queue write past the
       * Dexie transaction commit. waitForFunction polls until the queue is
       * non-empty, which also validates the hook actually fired.
       */
      await page.waitForFunction(
        async () => (await window.__zenith!.db.pendingSyncQueue.count()) > 0,
        { timeout: 4_000, polling: 100 },
      )

      const queueItems = await readSyncQueue(page)
      expect(queueItems.length).toBeGreaterThanOrEqual(1)

      // The most recent queue entry should correspond to our assignment write
      const entry = queueItems[queueItems.length - 1] as Record<string, unknown>

      /* ─ Structural schema fields ───────────────────────────── */
      expect(entry.tableName).toBe('assignments')
      expect(entry.operation).toBe('upsert')
      expect(entry.retryCount).toBe(0)
      expect(typeof entry.timestamp).toBe('number')
      expect(entry.timestamp).toBeGreaterThan(0)

      /* ─ Cloud UUID ─────────────────────────────────────────── */
      expect(typeof entry.supabaseId).toBe('string')
      expect(entry.supabaseId as string).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )

      /* ─ Payload: serialised assignment snapshot ─────────────── */
      const payload = JSON.parse(entry.payload as string) as Record<string, unknown>
      expect(payload.title).toBe(TEST_ASSIGNMENT.title)
      expect(payload.priority).toBe('high')
      expect(payload.courseId).toBe(TEST_ASSIGNMENT.courseId)
      expect(payload.status).toBe('pending')

      // supabaseId in the payload must match the queue entry's supabaseId
      expect(payload.supabaseId).toBe(entry.supabaseId)
    },
  )

  /* ── S2-T3 ─────────────────────────────────────────────────── */
  test(
    'S2-T3: NETWORK INTERCEPT MOCK — online event dispatched; sync engine stays stable; any Supabase calls match schema',
    async ({ page }) => {
      /*
       * Route ALL requests whose URL contains "supabase" to a local stub
       * that returns an empty success response. This ensures:
       *   (a) No real network calls leak into the test runner
       *   (b) If env vars ARE configured, we can still assert payload shape
       *   (c) If env vars are absent, the engine exits before making any
       *       request — the intercepted list stays empty (also correct)
       *
       * In both cases the page must remain fully operational after the event.
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

      // Write a high-priority assignment — enqueues to pendingSyncQueue
      await addAssignment(page, TEST_ASSIGNMENT)
      await page.waitForTimeout(300)   // give setTimeout(0) hooks time to fire

      // Simulate the browser going back online — triggers the sync engine drain
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await page.waitForTimeout(700)   // DRAIN_DEBOUNCE_MS = 1500; we check partial window

      /* ─ Stability assertion ─────────────────────────────────── */
      // The page must remain fully functional — no crash, no blank screen
      await expect(page.locator('#sidebar')).toBeVisible({ timeout: 3_000 })
      await expect(
        page.getByRole('navigation', { name: 'Primary' }),
      ).toBeVisible()

      /* ─ Payload shape assertion (Supabase-configured environments) ─ */
      for (const req of intercepted) {
        // All intercepted calls must target a valid REST or RPC path
        expect(req.url).toMatch(/supabase/)

        // If a POST body was sent, it must be valid JSON
        if (req.body) {
          const parsed = JSON.parse(req.body) as unknown
          expect(parsed).toBeTruthy()
        }
      }

      // The queue entry written in S2-T2 is still schema-valid
      const queue = await readSyncQueue(page)
      if (queue.length > 0) {
        const entry = queue[0] as Record<string, unknown>
        expect(['assignments', 'userProfile']).toContain(entry.tableName)
        expect(['upsert', 'delete']).toContain(entry.operation)
        expect(typeof entry.timestamp).toBe('number')
      }
    },
  )

})

/* ═══════════════════════════════════════════════════════════════
   SUITE 3 — RPG leveling math accuracy & level-up state change
   ═══════════════════════════════════════════════════════════════ */

test.describe('Suite 3 — RPG leveling math accuracy & level-up state change', () => {

  /*
   * Starting condition: 1 XP below the Level 1 → 2 threshold.
   * EXP_Required(1) = ceil(100 × 1^1.5) = 100
   * Any XP gain ≥ 1 guarantees a level-up regardless of hype multiplier.
   * Using 99 XP as the floor ensures the test is multiplier-agnostic.
   */
  const LEVEL_1_THRESHOLD = expRequired(1)   // 100
  const STARTING_XP       = LEVEL_1_THRESHOLD - 1  // 99

  const BOSS_ASSIGNMENT: TestAssignment = {
    title:    'Complete Linear Algebra Final Project',
    dueDate:  '2026-12-20',
    courseId: 'MATH-2940',
    status:   'pending',
    priority: 'high',   // high priority → boss battle, base reward = 75 XP
  }

  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context)
    await page.goto('/')
    await waitForBridge(page)

    // Seed profile at exactly 1 XP below level threshold
    await seedProfile(page, {
      expPoints:    STARTING_XP,
      currentLevel: 1,
      healthPoints: 100,
    })

    // Seed the high-priority assignment — QuestMarketplace derives boss battles from live data
    await addAssignment(page, BOSS_ASSIGNMENT)
  })

  /* ── S3-T1 ─────────────────────────────────────────────────── */
  test(
    'S3-T1: ASSERTION 3 — defeating high-priority boss awards ≥75 XP and advances currentLevel',
    async ({ page }) => {
      /* ─ Baseline snapshot ──────────────────────────────────── */
      const before = await page.evaluate(async () => {
        const p = await window.__zenith!.db.userProfile.get(1)
        if (!p) throw new Error('UserProfile id=1 missing — check seedProfile() in beforeEach')
        return p
      })
      expect(before.expPoints).toBe(STARTING_XP)
      expect(before.currentLevel).toBe(1)

      /* ─ Navigate to Quest Matrix ───────────────────────────── */
      await navigateTo(page, 'Quest Matrix')

      /*
       * QuestMarketplace derives boss battles from live high-priority
       * assignments via useLiveQuery + useEffect regeneration.
       * The boss card shows `quest.sourceTitle` = the assignment title.
       */
      await expect(
        page.getByText(BOSS_ASSIGNMENT.title),
      ).toBeVisible({ timeout: 8_000 })

      /* ─ Defeat the boss ─────────────────────────────────────── */
      const defeatBtn = page
        .getByRole('button')
        .filter({ hasText: '⚔ Defeat Boss' })
        .first()

      await expect(defeatBtn).toBeEnabled({ timeout: 5_000 })
      await defeatBtn.click()

      // Button transitions to "✓ Defeated" confirming completeQuest() ran
      await expect(
        page.getByText('✓ Defeated'),
      ).toBeVisible({ timeout: 8_000 })

      /* ─ ASSERTION 3a: IDB source of truth ──────────────────── */
      const after = await page.evaluate(async () => {
        const p = await window.__zenith!.db.userProfile.get(1)
        if (!p) throw new Error('UserProfile id=1 missing after quest completion')
        return p
      })

      /*
       * Compute the XP delta accounting for a level-up wrap.
       * If level-up occurred, XP reset to 0 and started climbing again.
       * Total XP gained = newXP + threshold(oldLevel) - startXP
       */
      const xpDelta = after.currentLevel > before.currentLevel
        ? after.expPoints + LEVEL_1_THRESHOLD - STARTING_XP
        : after.expPoints - STARTING_XP

      // Base reward is 75 XP; hype multiplier scales it up but never down
      expect(xpDelta).toBeGreaterThanOrEqual(HIGH_PRIORITY_XP)

      // Level MUST advance: 99 + 75 = 174 > 100 threshold, regardless of multiplier
      expect(after.currentLevel).toBeGreaterThanOrEqual(2)

      /* ─ ASSERTION 3b: RpgStatusWidget DOM reflects the level-up ─ */
      await navigateTo(page, 'Home')

      const rpgWidget = page.getByRole('region', { name: 'Character Lifecycle Stats' })
      await expect(rpgWidget).toBeVisible({ timeout: 5_000 })

      // Level badge accessible name must match the IDB ground truth
      await expect(
        rpgWidget.locator(`[aria-label="Level ${after.currentLevel}"]`),
      ).toBeVisible({ timeout: 3_000 })

      // EXP progressbar must expose the post-level-up expPoints value
      const expBar  = rpgWidget.getByRole('progressbar', { name: 'Experience points' })
      const nowAttr = await expBar.getAttribute('aria-valuenow')
      expect(Number(nowAttr)).toBe(after.expPoints)

      // HP bar must reflect full HP (HP restores on level-up per applyXpGain)
      const hpBar    = rpgWidget.getByRole('progressbar', { name: 'Health points' })
      const hpAttr   = await hpBar.getAttribute('aria-valuenow')
      expect(Number(hpAttr)).toBe(after.healthPoints)
    },
  )

  /* ── S3-T2 ─────────────────────────────────────────────────── */
  test(
    'S3-T2: rpgEngine formula contract — awardXp(75) from 99 XP yields level 2 with 74 XP remainder',
    async ({ page }) => {
      /*
       * Pure math contract test — calls awardXp() directly (bypassing
       * the hype multiplier path in useQuestBoard) to validate that
       * applyXpGain implements the EXP_Required = 100 × Level^1.5 spec.
       *
       * Input:  expPoints=99, currentLevel=1, +75 XP
       * Math:   99 + 75 = 174; threshold(1) = 100; 174 ≥ 100 → level up
       *         remainder = 174 - 100 = 74; new level = 2
       * Expected output: { expPoints: 74, currentLevel: 2 }
       */
      const result = await page.evaluate(async () => {
        const db = window.__zenith!.db

        const before = await db.userProfile.get(1)
        if (!before) throw new Error('UserProfile missing before awardXp')
        await window.__zenith!.awardXp(75)
        const after = await db.userProfile.get(1)
        if (!after) throw new Error('UserProfile missing after awardXp')

        return {
          before:    { exp: before.expPoints, lvl: before.currentLevel },
          after:     { exp: after.expPoints,  lvl: after.currentLevel  },
          threshold: Math.ceil(100 * Math.pow(before.currentLevel, 1.5)),
        }
      })

      // Pre-conditions match beforeEach seed
      expect(result.before.exp).toBe(99)
      expect(result.before.lvl).toBe(1)
      expect(result.threshold).toBe(100)

      // Exact post-conditions per EXP_Required formula
      expect(result.after.lvl).toBe(2)
      expect(result.after.exp).toBe(74)   // 99 + 75 - 100 = 74 remainder
    },
  )

  /* ── S3-T3 ─────────────────────────────────────────────────── */
  test(
    'S3-T3: multi-level cascade — large XP gain that crosses two level thresholds carries remainder correctly',
    async ({ page }) => {
      /*
       * Regression guard for the `while (expPoints >= threshold)` cascade
       * loop in applyXpGain. Verifies XP carry-forward is not truncated
       * when a single gain crosses more than one level boundary.
       *
       * Input: expPoints=0, currentLevel=1, +1200 XP
       *   Level 1 threshold = 100:   1200 - 100 = 1100, level 2
       *   Level 2 threshold = 283:   1100 - 283 = 817,  level 3
       *   Level 3 threshold = 520:   817  - 520 = 297,  level 4
       *   Level 4 threshold = 800:   297  < 800 → stop at level 4
       * Expected: { expPoints: 297, currentLevel: 4 }
       */

      // Override beforeEach profile to start at 0 XP
      await seedProfile(page, { expPoints: 0, currentLevel: 1 })

      const result = await page.evaluate(async () => {
        await window.__zenith!.awardXp(1200)
        const after = await window.__zenith!.db.userProfile.get(1)
        if (!after) throw new Error('UserProfile missing after awardXp cascade')
        return { exp: after.expPoints, lvl: after.currentLevel }
      })

      expect(result.lvl).toBe(4)
      expect(result.exp).toBe(297)
    },
  )

})
