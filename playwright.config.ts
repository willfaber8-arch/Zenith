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
  timeout: 45_000,    // generous ceiling for slow CI environments

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
    reuseExistingServer: !process.env.CI, // reuse in dev, fresh in CI
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
