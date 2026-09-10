/**
 * Guards two mistakes this repository has actually made.
 *
 * 1. Something deleted the user's IndexedDB on load. Zenith is
 *    local-first, so that database is not a cache — it is the only copy
 *    of every note, task, habit and calendar entry. Deleting one is a
 *    thing a person asks for, in front of a confirmation, never
 *    something a component decides during an effect.
 *
 * 2. Playwright wrote its artifacts into tests/, which `next dev`
 *    watches. Every trace and screenshot triggered a rebuild, and a page
 *    load landing mid-rewrite got a half-written chunk, so the app never
 *    hydrated. One real failure then cascaded into every test after it,
 *    and the symptom — a missing test bridge — pointed nowhere near the
 *    cause. Keeping the output directories outside the watched tree is
 *    what stops that, and it is easy to undo by accident.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { globSync } from 'glob'

const ROOT = join(__dirname, '..', '..')

describe('no component deletes local data on its own', () => {

  /*
   * ErrorBoundary is the one allowed caller: it is reachable only after
   * two crashes, offers a backup first, and needs a second press on a
   * button that says what it deletes.
   */
  const ALLOWED = new Set(['components/ErrorBoundary.tsx'])

  const sources = globSync('{app,components,lib,hooks,services,utils}/**/*.{ts,tsx}', {
    cwd: ROOT, nodir: true,
  })

  it('finds sources to check', () => {
    expect(sources.length).toBeGreaterThan(50)
  })

  /*
   * Matched on the method, not the receiver. The wipe that made this
   * necessary read `const idb = window.indexedDB` first, so a pattern
   * anchored to `indexedDB.` walked straight past it.
   */
  it.each([
    ['deleteDatabase',       /\.\s*deleteDatabase\s*\(/],
    ['localStorage.clear',   /localStorage\s*\.\s*clear\s*\(/],
    ['sessionStorage.clear', /sessionStorage\s*\.\s*clear\s*\(/],
  ])('%s appears only where a person asked for it', (label, pattern) => {
    const offenders = sources.filter(rel => {
      if (ALLOWED.has(rel.split(/[\\/]/).join('/'))) return false
      return pattern.test(readFileSync(join(ROOT, rel), 'utf8'))
    })

    expect(
      offenders.length === 0
        ? []
        : offenders.map(f => `${f} calls ${label} — wiping local data must be `
            + 'user-initiated and confirmed, never automatic'),
    ).toEqual([])
  })
})

describe('the dev server is not watching the test output', () => {
  const config = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8')

  const paths = [
    ...config.matchAll(/outputDir:\s*'([^']+)'/g),
    ...config.matchAll(/outputFolder:\s*'([^']+)'/g),
    ...config.matchAll(/outputFile:\s*'([^']+)'/g),
  ].map(m => m[1])

  it('declares all three output paths', () => {
    expect(paths).toHaveLength(3)
  })

  it.each(paths.map(p => [p]))('%s is outside tests/', (p: string) => {
    expect(p.startsWith('tests/')).toBe(false)
  })
})
