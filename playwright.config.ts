/**
 * Zenith OS — Playwright Configuration
 * Phase 6 · Step 6.2 — Automated E2E Test Suite
 *
 * Execution model:
 *   • workers: 1   — single worker prevents IDB state bleed across parallel
 *                    test workers sharing the same browser origin.
 *   • isolatedContext per test — Playwright creates a fresh BrowserContext
 *                    (separate localStorage + IDB) for every test function,
 *                    giving each run a fully clean storage partition.
 *   • webServer     — starts `next dev` with NEXT_PUBLIC_E2E=1 so the
 *                    TestBridge component mounts on window.__zenith, giving
 *                    tests direct access to the live Dexie instance.
 *
 * CI notes:
 *   • Set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if browsers are pre-installed.
 *   • Set CI=true to enable retries and forbid `test.only` leaks.
 *   • Artifacts (trace, screenshot, video) are written to tests/results/.
 */

import { defineConfig, devices } from '@playwright/test'

import { SENTINEL_KEY } from './lib/dataResetVersion'

export default defineConfig({

  /* ── Test discovery ─────────────────────────────────────────── */
  testDir:        './tests',
  testMatch:      '**/*.spec.ts',

  /* ── Execution model ────────────────────────────────────────── */
  fullyParallel:  false,            // keep tests sequential per worker
  workers:        1,                // one worker = one IDB origin = no state bleed
  forbidOnly:     !!process.env.CI, // fail if test.only slips into CI

  /* ── Retry policy ───────────────────────────────────────────── */
  retries: process.env.CI ? 1 : 0,  // one re-run on CI; instant feedback in dev

  /* ── Reporters ──────────────────────────────────────────────── */
  reporter: [
    ['list'],                         // concise pass/fail output in terminal
    ['html', {
      open:         'never',          // don't auto-open in CI
      outputFolder: 'playwright-report',
    }],
    ['junit', { outputFile: 'playwright-results/junit.xml' }],
  ],

  /* ── Shared browser settings ────────────────────────────────── */
  use: {
    baseURL:    'http://localhost:3000',

    /*
     * Every test gets a clean browser profile, which to Zenith looks like
     * a brand-new device — so DataResetGate fired on all of them, clearing
     * localStorage (including the session the test had just injected),
     * deleting both IndexedDB databases and reloading. Whatever
     * page.evaluate was mid-flight died with "Execution context was
     * destroyed", and the tests that survived were testing a wiped app.
     *
     * Seeding the sentinel says what is true of any device a real user has
     * already opened Zenith on: the one-time wipe has been done.
     */
    storageState: {
      cookies: [],
      origins: [{
        origin:       'http://localhost:3000',
        localStorage: [{ name: SENTINEL_KEY, value: 'done' }],
      }],
    },
    trace:      'retain-on-failure',    // trace.zip only on failure
    screenshot: 'only-on-failure',      // PNG only on failure
    video:      'retain-on-failure',    // video only on failure

    /* Increase default timeout for IDB + React hydration latency */
    actionTimeout:     12_000,
    navigationTimeout: 30_000,
  },

  /* ── Output directories ─────────────────────────────────────── */
  /*
   * At the repository root, deliberately — NOT under tests/.
   *
   * `next dev` watches tests/, so every trace, video and screenshot
   * Playwright wrote there triggered a rebuild. A page load that lands
   * while a chunk is being rewritten gets a half-written app/layout.js,
   * which throws `SyntaxError: Invalid or unexpected token` with no
   * stack, so React never hydrates and window.__zenith never appears.
   * The test then fails, writes its own artifacts, and starts the next
   * rebuild — one real failure cascaded into every test after it.
   *
   * Measured: a write under tests/ produces a recompile; the same write
   * at the repository root produces none.
   */
  outputDir: 'playwright-results',

  /* ── Test timeout ───────────────────────────────────────────── */
  /*
   * 180s, because the setup hooks wait up to 120s on their own.
   *
   * This was 45s, which is shorter than the `toBeVisible({ timeout:
   * 120_000 })` calls inside the beforeAll hooks that wait for a cold
   * `next dev` compile — so the hook was killed while its own wait was
   * still legitimately running, and every test in the file reported a
   * missing sidebar. The specs also try to raise it themselves via
   * `test.describe.configure({ timeout })`, which is not an option that
   * function accepts: it is ignored silently, and the project default
   * stays in force.
   */
  timeout: 180_000,

  /* ── Browser projects ───────────────────────────────────────── */
  projects: [
    {
      name: 'chromium',
      use:  {
        ...devices['Desktop Chrome'],
        /*
         * CI runs `playwright install chromium`, so the bundled build is
         * always there and this stays undefined. Some sandboxes ship a
         * different Chromium and no way to download one; pointing at it
         * is the difference between running the suite locally and not
         * being able to check anything before pushing.
         */
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],

  /* ── Dev server ─────────────────────────────────────────────── */
  webServer: {
    command:             'npm run dev',
    url:                 'http://localhost:3000',
    /*
     * Reuse whatever is already listening, in CI as well as locally.
     *
     * This was `!process.env.CI` — fresh server in CI — which is the
     * usual advice and is wrong here. `next dev` compiles on demand,
     * and Playwright's readiness check only waits for the server to
     * answer, not for the app to be built. The first spec was racing a
     * cold compile, timing out, and taking its whole file down with it
     * through `mode: 'serial'`.
     *
     * The workflow now starts the server and loads the page twice
     * before this runs, so by the time the suite starts the app is
     * compiled. Refusing to reuse it would start a second server on an
     * occupied port and throw all of that away.
     */
    reuseExistingServer: true,
    timeout:             120_000,

    /*
     * NEXT_PUBLIC_E2E=1 causes app/layout.tsx to render <TestBridge />,
     * which mounts window.__zenith with the live Dexie instance so
     * page.evaluate() can write through Dexie (triggering useLiveQuery
     * reactivity and sync hooks) rather than bypassing them via raw IDB.
     */
    env: {
      NEXT_PUBLIC_E2E: '1',
    },
  },
})
