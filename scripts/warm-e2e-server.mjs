/**
 * scripts/warm-e2e-server.mjs — compile the app before the suite runs.
 *
 * `next dev` builds routes on demand. Playwright's webServer readiness
 * check only waits for the server to *answer*, which happens well before
 * the client bundle exists, so the first spec was racing a cold compile,
 * timing out, and taking its whole file down through `mode: 'serial'`.
 *
 * A curl warms the server route and nothing else — it never fetches or
 * executes the client chunks. Only a browser does that, which is why the
 * warm-up is a real page load.
 *
 * It also asserts the test bridge is present. `window.__zenith` needs
 * NEXT_PUBLIC_E2E=1 at compile time; if that has not reached the bundle,
 * every bridge-using test fails one at a time with a twelve-second
 * timeout apiece. Failing here instead says why, once.
 */

import { chromium } from '@playwright/test'

const URL = process.env.E2E_WARM_URL ?? 'http://localhost:3000'
const NEED_BRIDGE = process.env.E2E_EXPECT_BRIDGE !== '0'

/* CI installs the browser Playwright expects. A local sandbox may carry a
   different build, so allow an explicit path rather than failing on a
   download prompt that will never be answered here. */
const executablePath = process.env.E2E_WARM_BROWSER_PATH || undefined
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await (await browser.newContext()).newPage()

const failures = []
page.on('pageerror', e => failures.push(String(e).slice(0, 300)))

const started = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240_000 })

/* The sidebar is the app, not the shell — waiting for it means the
   client bundle has been fetched, parsed and hydrated. */
await page.locator('[aria-label="Main navigation"], [class*="AuthGate"]')
  .first().waitFor({ state: 'attached', timeout: 240_000 })

const seconds = ((Date.now() - started) / 1000).toFixed(1)
console.log(`app compiled and hydrated in ${seconds}s`)

if (NEED_BRIDGE) {
  const bridge = await page.evaluate(() => typeof window.__zenith)
  if (bridge === 'undefined') {
    console.error(
      'FATAL: window.__zenith is missing.\n' +
      '  The test bridge is compiled in only when NEXT_PUBLIC_E2E=1 is set\n' +
      '  for the process running `next dev`. Every bridge-using test would\n' +
      '  now fail on a 12s timeout each, which hides this cause behind a\n' +
      '  wall of unrelated-looking timeouts.',
    )
    await browser.close()
    process.exit(1)
  }
  console.log('test bridge present')
}

if (failures.length > 0) {
  console.log(`page errors during warm-up (not fatal):\n  ${failures.join('\n  ')}`)
}

await browser.close()
