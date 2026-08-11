/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Notes editor E2E
 *
 * The text transforms themselves are covered by unit tests against
 * `lib/engines/markdownEditing.ts`, which is where the selection edge
 * cases belong. What can only be checked in a real browser is the wiring
 * around them:
 *
 *   Suite 1 — the toolbar actually edits the note
 *     Buttons and shortcuts reach the engine, the result lands in the
 *     textarea, and native undo still works afterwards. That last one
 *     is the reason the editor goes through `execCommand('insertText')`
 *     rather than assigning to `value`: assigning wipes the browser's
 *     undo stack, so ⌘Z after pressing Bold would eat the paragraph.
 *
 *   Suite 2 — the title is editable and stays edited
 *     It used to be derived from the first line with no override, so a
 *     note opening "ok so" was called "ok so" forever.
 *
 *   Suite 3 — keyboard reachability
 *     The toolbar is one tab stop with arrow-key navigation, not twelve
 *     stops between the note list and the writing area.
 *
 * CI usage:
 *   npx playwright test notesEditor
 * ════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page } from '@playwright/test'
import { AUTH_STORAGE_KEY, MOCK_SESSION } from './helpers/bridge'

/*
 * Serial, with one page shared across the file.
 *
 * The first draft booted the whole app per test: sixteen cold loads of a
 * route that pulls in the provider chain and Dexie before a sidebar
 * exists to click. That took seventeen minutes and failed a different
 * arbitrary third of the suite each run — hardware speed, not behaviour.
 *
 * Each test still starts from a brand-new note, which is the isolation
 * that actually matters here; what it no longer does is re-download the
 * application to get one.
 */
test.describe.configure({ mode: 'serial', timeout: 60_000 })

/*
 * Deliberately does not use waitForBridge().
 *
 * These tests only drive the UI, so requiring window.__zenith would tie
 * them to NEXT_PUBLIC_E2E for no benefit — and its fixed 12s ceiling is
 * shorter than a cold `next dev` compile of this route, which made every
 * test here fail on an empty page before the app had rendered at all.
 * Waiting for the sidebar instead waits for the thing the tests need.
 */
async function bootWorkspace(page: Page) {
  const seed = JSON.stringify({
    [AUTH_STORAGE_KEY]: JSON.stringify(MOCK_SESSION),
    // First-run overlays would otherwise sit on top of the workspace.
    zenith_onboarding_completed_v1: 'true',
    zenith_data_wiped_v1: 'done',
    zenith_tour_v2: JSON.stringify({ seenAt: Date.now() }),
  })

  /*
   * Passed as a JSON string rather than as a structured argument.
   *
   * Playwright serialises the init function with `toString()`, and this
   * file is TypeScript: the version that reached the browser still had
   * the parameter's type annotation in it, so the page threw
   * "SyntaxError: Invalid or unexpected token" before rendering anything
   * and every test sat waiting for a sidebar that never mounted.
   */
  await page.addInitScript((raw) => {
    const entries = JSON.parse(raw)
    for (const k of Object.keys(entries)) localStorage.setItem(k, entries[k])
  }, seed)
}

let page: Page

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  page = await context.newPage()

  /*
   * Registered on the page before its first navigation.
   *
   * The `page` fixture is already constructed by the time a beforeEach
   * hook runs, and context.addInitScript only affects pages created
   * afterwards — so an earlier version's script never ran, the app booted
   * with no session, and every test sat behind the first-run cinematic
   * waiting for a sidebar that was never going to appear.
   */
  await bootWorkspace(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const nav = page.locator('[aria-label="Main navigation"]')
  await expect(nav).toBeVisible({ timeout: 120_000 })   // cold dev compile
  await nav.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByRole('button', { name: '+ New' })).toBeVisible({ timeout: 30_000 })
})

test.afterAll(async () => { await page?.close() })

/** A fresh, empty note — the starting point for every test below. */
async function openBlankNote() {
  await page.getByRole('button', { name: '+ New' }).click()

  const body = page.getByRole('textbox', { name: 'Note body' })
  await expect(body).toBeVisible()
  await expect(body).toHaveValue('')
  return {
    body,
    title:   page.getByRole('textbox', { name: 'Note title' }),
    toolbar: page.getByRole('toolbar', { name: 'Formatting' }),
  }
}

/* ════════════════════════════════════════════════════════════════
   Suite 1 — the toolbar edits the note
   ════════════════════════════════════════════════════════════════ */

test.describe('Suite 1 — formatting controls', () => {

  test('S1-T1 the checklist button converts the current line', async () => {
    const { body, toolbar } = await openBlankNote()

    await body.click()
    await body.fill('buy milk')
    await toolbar.getByRole('button', { name: 'Checklist' }).click()

    await expect(body).toHaveValue('- [ ] buy milk')

    // And the tappable mirror picks it up, which is what makes a note
    // usable as a list rather than as text that looks like one.
    await expect(page.getByRole('checkbox')).toHaveCount(1)
  })

  test('S1-T2 the checklist button is a toggle, not a stamp', async () => {
    const { body, toolbar } = await openBlankNote()
    const btn = toolbar.getByRole('button', { name: 'Checklist' })

    await body.click()
    await body.fill('buy milk')
    await btn.click()
    await expect(body).toHaveValue('- [ ] buy milk')
    await btn.click()
    await expect(body).toHaveValue('buy milk')
  })

  test('S1-T3 bold wraps and unwraps a selection', async () => {
    const { body, toolbar } = await openBlankNote()
    const bold = toolbar.getByRole('button', { name: 'Bold' })

    await body.click()
    await body.fill('make this bold')
    await page.keyboard.press('ControlOrMeta+a')
    await bold.click()
    await expect(body).toHaveValue('**make this bold**')

    await bold.click()
    await expect(body).toHaveValue('make this bold')
  })

  test('S1-T4 keyboard shortcuts reach the same commands', async () => {
    const { body } = await openBlankNote()

    await body.click()
    await body.fill('emphasis')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+i')
    await expect(body).toHaveValue('*emphasis*')
  })

  test('S1-T5 native undo survives a toolbar press', async () => {
    // The whole reason applyWithUndo exists. Assigning to `value` would
    // clear the undo stack and this would come back empty.
    const { body } = await openBlankNote()

    await body.click()
    await body.fill('keep me')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+b')
    await expect(body).toHaveValue('**keep me**')

    await page.keyboard.press('ControlOrMeta+z')
    await expect(body).toHaveValue('keep me')
  })

  test('S1-T6 Enter continues a list, and leaves it when empty', async () => {
    const { body, toolbar } = await openBlankNote()

    await body.click()
    await body.fill('milk')
    await toolbar.getByRole('button', { name: 'Checklist' }).click()
    await body.click()
    await page.keyboard.press('End')

    await page.keyboard.press('Enter')
    await page.keyboard.type('eggs')
    await expect(body).toHaveValue('- [ ] milk\n- [ ] eggs')

    // Enter twice: once to open an item, once on the empty item to exit.
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(body).toHaveValue('- [ ] milk\n- [ ] eggs\n')
  })

  test('S1-T7 a button reports whether its mark is at the cursor', async () => {
    const { body, toolbar } = await openBlankNote()
    const btn = toolbar.getByRole('button', { name: 'Checklist' })

    await body.click()
    await body.fill('- [ ] a task')
    await page.keyboard.press('End')
    await expect(btn).toHaveAttribute('aria-pressed', 'true')

    await body.fill('plain text')
    await body.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
  })
})

/* ════════════════════════════════════════════════════════════════
   Suite 2 — the title
   ════════════════════════════════════════════════════════════════ */

test.describe('Suite 2 — editable title', () => {

  test('S2-T1 a typed title reaches the note list', async () => {
    const { title } = await openBlankNote()
    await title.fill('Groceries')
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('Groceries')
  })

  test('S2-T2 a typed title is not overwritten by editing the body', async () => {
    const { body, title } = await openBlankNote()

    await title.fill('Groceries')
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('Groceries')

    await body.click()
    await body.fill('milk, eggs, bread')
    // The derived title would be "milk, eggs, bread"; the typed one wins.
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('Groceries')
  })

  test('S2-T3 clearing the title hands naming back to the first line', async () => {
    const { body, title } = await openBlankNote()

    await body.click()
    await body.fill('a thought')
    await title.fill('Named')
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('Named')

    await title.fill('')
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('a thought')
  })

  test('S2-T4 a checklist note is titled by its text, not its checkbox', async () => {
    // The old derivation stripped "- " and left "[ ]", so a shopping list
    // was called "[ ] buy milk".
    const { body, toolbar } = await openBlankNote()

    await body.click()
    await body.fill('buy milk')
    await toolbar.getByRole('button', { name: 'Checklist' }).click()
    await expect(page.locator('[class*="rowTitleText"]').first()).toHaveText('buy milk')
  })
})

/* ════════════════════════════════════════════════════════════════
   Suite 3 — keyboard reachability
   ════════════════════════════════════════════════════════════════ */

test.describe('Suite 3 — keyboard access', () => {

  test('S3-T1 the toolbar is a single tab stop', async () => {
    await openBlankNote()

    const stops = await page.evaluate(() => {
      const bar = document.querySelector('[role="toolbar"]')!
      const btns = [...bar.querySelectorAll('button')]
      return { total: btns.length, tabbable: btns.filter(b => b.tabIndex === 0).length }
    })
    expect(stops.total).toBeGreaterThan(1)
    expect(stops.tabbable).toBe(1)
  })

  test('S3-T2 arrow keys move along the toolbar', async () => {
    const { toolbar } = await openBlankNote()

    await toolbar.getByRole('button').first().focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Strikethrough')

    await page.keyboard.press('Home')
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Bold')
  })

  test('S3-T3 every control has a unique, non-empty name', async () => {
    await openBlankNote()

    const names = await page.evaluate(() =>
      [...document.querySelectorAll('[role="toolbar"] button')]
        .map(b => b.getAttribute('aria-label') ?? ''))

    expect(names.every(n => n.length > 1)).toBe(true)
    // "Checklist Checklist" was the first version: a visible word plus a
    // visually-hidden label, both announced.
    expect(new Set(names).size).toBe(names.length)
  })

  test('S3-T4 a focused button can be activated from the keyboard', async () => {
    const { body, toolbar } = await openBlankNote()

    await body.click()
    await body.fill('word')
    await page.keyboard.press('ControlOrMeta+a')

    await toolbar.getByRole('button', { name: 'Bold' }).focus()
    await page.keyboard.press('Enter')
    await expect(body).toHaveValue('**word**')
  })

  test('S3-T5 no WCAG A/AA violations in the Notes view', async () => {
    /*
     * A broad automated sweep alongside the specific assertions above.
     * It cannot judge whether a label is a *good* name, but it does catch
     * the whole class of regressions the targeted tests would miss —
     * a control that loses its name, a contrast change, a broken
     * label/control association.
     */
    await openBlankNote()
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })

    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: {
        run: (ctx: Element | Document, opts: object) => Promise<{
          violations: Array<{ id: string; impact: string; nodes: unknown[] }>
        }>
      } }).axe
      const root = document.querySelector('[class*="NotesView_root"]') ?? document
      const res  = await axe.run(root, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      })
      return res.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length }))
    })

    expect(violations).toEqual([])
  })

  test('S3-T6 the save state is announced, not only shown', async () => {
    const { body } = await openBlankNote()

    const live = page.locator('[class*="saveState"]')
    await expect(live).toHaveAttribute('role', 'status')
    await expect(live).toHaveAttribute('aria-live', 'polite')

    await body.click()
    await body.type('x')
    await expect(live).toHaveText(/Saving|Saved/)
  })
})
