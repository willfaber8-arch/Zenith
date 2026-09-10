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
      outputFolder: 'tests/playwright-report',
    }],
    ['junit', { outputFile: 'tests/playwright-results/junit.xml' }],
  ],

  /* ── Shared browser settings ────────────────────────────────── */
  use: {
    baseURL:    'http://localhost:3000',
    trace:      'retain-on-failure',    // trace.zip only on failure
    screenshot: 'only-on-failure',      // PNG only on failure
    video:      'retain-on-failure',    // video only on failure

    /* Increase default timeout for IDB + React hydration latency */
    actionTimeout:     12_000,
    navigationTimeout: 30_000,
  },

  /* ── Output directories ─────────────────────────────────────── */
  outputDir: 'tests/playwright-results',

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
      use:  { ...devices['Desktop Chrome'] },
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
