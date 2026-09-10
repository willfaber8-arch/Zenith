/**
 * tests/localDataSurvives.spec.ts — nothing deletes your data on its own.
 *
 * Zenith is local-first: IndexedDB is not a cache, it is the only copy.
 * Anything that clears it without being asked is not a bug in a feature,
 * it is the loss of everything the person has put in.
 *
 * This existed because something did exactly that. A one-time "clean
 * slate" wipe was gated on a sentinel kept in localStorage while the
 * data it guarded lived in IndexedDB. Those two are cleared under
 * different conditions — a privacy setting, an eviction under storage
 * pressure, or a browser that treats "cookies and site data" as one
 * switch can take the sentinel and leave the database. When that
 * happened the app read a missing sentinel as a brand-new device and
 * deleted both databases on load, silently, with no backup.
 *
 * The check is deliberately behavioural rather than a search for the
 * old component: write something, come back, and it is still there.
 * That holds whatever a future version does internally.
 */

import { test, expect } from '@playwright/test'

const BRIDGE = () => typeof (window as never as { __zenith?: unknown }).__zenith !== 'undefined'

/*
 * page.evaluate serialises its callback and runs it in the browser, so
 * everything it touches has to be reachable from inside the page. A
 * tidy `bridge()` helper defined out here is a Node binding and is not
 * there when the callback runs.
 */

test.describe('local data is not deleted without being asked', () => {

  test('a note written on a fresh install is still there after a reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })

    await page.evaluate(async () => {
      const notes = (window as never as { __zenith: { db: { quickNotes: {
        add: (v: unknown) => Promise<unknown> } } } }).__zenith.db.quickNotes
      await notes.add({
        title: 'Dissertation outline', body: 'chapter 3 rewrite',
        category: 'personal', updatedAt: Date.now(),
      })
    })
    expect(await page.evaluate(() => (window as never as { __zenith: { db: { quickNotes: {
      count: () => Promise<number> } } } }).__zenith.db.quickNotes.count())).toBe(1)

    await page.reload()
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })
    /* A wipe-on-load runs in an effect and then reloads, so give it the
       chance to happen rather than reading before it would have. */
    await page.waitForTimeout(4_000)
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })

    const titles = await page.evaluate(async () => {
      const notes = (window as never as { __zenith: { db: { quickNotes: {
        toArray: () => Promise<{ title?: string }[]> } } } }).__zenith.db.quickNotes
      return (await notes.toArray()).map(n => n.title)
    })
    expect(titles).toEqual(['Dissertation outline'])
  })

  test('losing localStorage does not take IndexedDB with it', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })

    await page.evaluate(async () => {
      const notes = (window as never as { __zenith: { db: { quickNotes: {
        add: (v: unknown) => Promise<unknown> } } } }).__zenith.db.quickNotes
      await notes.add({
        title: 'Rent due Friday', body: '', category: 'personal', updatedAt: Date.now(),
      })
    })

    /*
     * What a privacy setting, an eviction, or "clear cookies and site
     * data" does on the browsers where those are one switch: key/value
     * storage goes, the database stays. The app must read that as a
     * returning person who lost their settings, never as a new device
     * whose database is safe to delete.
     */
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })

    await page.reload()
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })
    await page.waitForTimeout(4_000)
    await page.waitForFunction(BRIDGE, { timeout: 60_000 })

    const titles = await page.evaluate(async () => {
      const notes = (window as never as { __zenith: { db: { quickNotes: {
        toArray: () => Promise<{ title?: string }[]> } } } }).__zenith.db.quickNotes
      return (await notes.toArray()).map(n => n.title)
    })
    expect(titles).toEqual(['Rent due Friday'])
  })
})
