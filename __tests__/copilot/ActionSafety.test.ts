/**
 * __tests__/copilot/ActionSafety.test.ts
 *
 * Guards the Co-Pilot's core safety invariant:
 *
 *     THE ASSISTANT CANNOT DESTROY USER DATA.
 *
 * Zenith is local-first. There is no server-side copy of a user's habits,
 * books or journal entries, so an assistant that deletes a row deletes it
 * for good. The product decision is therefore that removal is always a
 * deliberate act the user performs in the relevant module's own UI, with
 * the row in front of them — never something a language model can be
 * talked into by a confusing prompt or a bad completion.
 *
 * Today that holds by construction: the catalogue has no delete tool and
 * the executor makes no Dexie delete call. These tests exist because
 * "by construction" is exactly the kind of property that quietly stops
 * being true six months later when someone adds a convenient
 * `delete_habit`. Each assertion below is designed to FAIL LOUDLY at that
 * moment rather than after a user loses a year of data.
 *
 * If you are here because one of these failed: that is the test working.
 * Adding a destructive capability is a deliberate product decision, not a
 * refactor — take it to a human before deleting the assertion.
 */

import {
  COPILOT_TOOLS,
  TOOL_MUTATION_KIND,
  isDestructiveName,
  requiresExplicitConfirmation,
  isKnownAction,
} from '@/lib/copilotTools'

import { readFileSync } from 'fs'
import { join } from 'path'

const ACTIONS_SRC = readFileSync(
  join(process.cwd(), 'lib', 'copilotActions.ts'),
  'utf8',
)

describe('Co-Pilot safety — no destructive capability', () => {

  it('exposes no tool whose name implies deletion', () => {
    const offenders = COPILOT_TOOLS.map(t => t.name).filter(isDestructiveName)
    expect(offenders).toEqual([])
  })

  it('exposes no tool whose description promises deletion', () => {
    // A tool called `update_x` that quietly wipes rows is the same problem
    // wearing a friendlier name, so check the prose too.
    const offenders = COPILOT_TOOLS
      .filter(t => /\b(delete|remove|erase|wipe|clear out|purge)\b/i.test(t.description))
      .map(t => t.name)
    expect(offenders).toEqual([])
  })

  it('the executor makes no Dexie delete / clear / bulkDelete call', () => {
    // Strip comments first: the file documents this invariant in prose, and
    // the words appearing in a comment must not trip the check.
    const code = ACTIONS_SRC
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    // `db.<table>.delete(...)`, `.clear()`, `.bulkDelete(...)` — Dexie's
    // three row-removal APIs. A bare `.delete(` is allowed because
    // Set/Map#delete is used on local collections.
    const dexieDeletes = code.match(
      /\bdb\s*\.\s*[A-Za-z_$][\w$]*\s*\.\s*(delete|clear|bulkDelete)\s*\(/g,
    )
    expect(dexieDeletes).toBeNull()
  })

  it('refuses a destructive action name even if one reaches the executor', async () => {
    // Simulates the failure we actually care about: a model emitting a tool
    // call we never defined, or a future contributor wiring one up.
    const { executeCopilotAction } = await import('@/lib/copilotActions')
    await expect(
      executeCopilotAction({ name: 'delete_all_habits', args: {} }),
    ).rejects.toThrow(/cannot\s+delete/i)
  })

  it('the destructive-name guard covers the obvious synonyms', () => {
    for (const name of [
      'delete_habit', 'remove_book', 'clear_calendar', 'wipe_database',
      'drop_table', 'reset_profile', 'purge_notes', 'erase_everything',
      'destroy_library', 'truncate_logs',
    ]) {
      expect(isDestructiveName(name)).toBe(true)
    }
  })

  it('does not misclassify the legitimate additive tools', () => {
    for (const t of COPILOT_TOOLS) {
      expect(isDestructiveName(t.name)).toBe(false)
    }
  })
})

describe('Co-Pilot safety — mutation classification', () => {

  it('every tool declares a mutation kind', () => {
    const missing = COPILOT_TOOLS
      .map(t => t.name)
      .filter(n => TOOL_MUTATION_KIND[n] === undefined)
    // A new tool with no classification would silently inherit
    // auto-accept eligibility, which is the thing we are guarding.
    expect(missing).toEqual([])
  })

  it('declares no classification for a tool that does not exist', () => {
    const stale = Object.keys(TOOL_MUTATION_KIND).filter(n => !isKnownAction(n))
    expect(stale).toEqual([])
  })

  it('forces explicit confirmation for anything that overwrites', () => {
    const overwriting = Object.entries(TOOL_MUTATION_KIND)
      .filter(([, kind]) => kind === 'overwrite')
      .map(([name]) => name)

    // Non-empty by design: set_profile replaces a name/university/major
    // that may already be set. If this list ever empties, the assertion
    // below stops proving anything.
    expect(overwriting.length).toBeGreaterThan(0)
    for (const name of overwriting) {
      expect(requiresExplicitConfirmation(name)).toBe(true)
    }
  })

  it('allows additive and cosmetic tools to be auto-accepted', () => {
    // The flip side: auto-accept has to actually be useful, or users will
    // not turn it on and the confirmation card becomes noise they click
    // through without reading.
    const autoOk = Object.entries(TOOL_MUTATION_KIND)
      .filter(([, kind]) => kind === 'additive' || kind === 'cosmetic')
      .map(([name]) => name)

    expect(autoOk.length).toBeGreaterThan(0)
    for (const name of autoOk) {
      expect(requiresExplicitConfirmation(name)).toBe(false)
    }
  })

  it('treats a destructive name as confirmation-required regardless of classification', () => {
    expect(requiresExplicitConfirmation('delete_habit')).toBe(true)
  })
})

describe('Co-Pilot safety — update_book is fill-only', () => {

  it('never writes a field the user already filled in', () => {
    // update_book is the one tool that touches an existing row, so it is
    // the most likely place for silent data loss. Its contract is that
    // every write is guarded by a falsy check on the current value.
    const body = ACTIONS_SRC.slice(ACTIONS_SRC.indexOf("case 'update_book'"))
      .slice(0, ACTIONS_SRC.slice(ACTIONS_SRC.indexOf("case 'update_book'")).indexOf('\n    }'))

    // Each assignment into `updates` must be gated on the target field
    // being absent — `!target.x` or `target.x === undefined`.
    const assignments = body.match(/updates\.\w+\s*=/g) ?? []
    expect(assignments.length).toBeGreaterThan(0)

    for (const field of ['genre', 'series', 'customReviewText', 'totalPages', 'publicationYear', 'globalRating', 'isbn13']) {
      const guarded =
        new RegExp(`!\\s*target\\.${field}\\b`).test(body) ||
        new RegExp(`target\\.${field}\\s*===\\s*undefined`).test(body)
      expect(guarded).toBe(true)
    }
  })

  it('never touches the user\'s own rating or reading status', () => {
    const body = ACTIONS_SRC.slice(ACTIONS_SRC.indexOf("case 'update_book'"))
      .slice(0, ACTIONS_SRC.slice(ACTIONS_SRC.indexOf("case 'update_book'")).indexOf('\n    }'))

    expect(body).not.toMatch(/updates\.userRating\s*=/)
    expect(body).not.toMatch(/updates\.readingStatus\s*=/)
  })
})
