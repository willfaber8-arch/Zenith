/**
 * __tests__/privacy/AiContextPrivacy.test.ts
 *
 * Guards one invariant:
 *
 *     THE MENTAL WELLNESS JOURNAL NEVER LEAVES THE DEVICE.
 *
 * The Co-Pilot reads broadly across the workspace on purpose — tasks,
 * habits, library, calendar, meals, vocabulary — so it can learn how
 * someone actually works. `MentalHealthLog.qualitativeNotes` is the
 * deliberate exception. It is the one field in Zenith where a user
 * writes about their own mental state, and shipping it to a third-party
 * AI provider is not a trade anyone opted into by switching an assistant
 * on.
 *
 * Aggregates (average stress, average energy, burnout risk) and the mood
 * label ARE shared: enough for the assistant to notice someone is running
 * on empty and ease off, without any of the content.
 *
 * This regressed once already — the journal was compiled into the system
 * prompt, truncated to 110 characters and labelled `journal: "…"`, on
 * every single Co-Pilot open. These tests exist so it cannot happen again
 * quietly.
 *
 * If one of these fails: that is the test working. Widening what the
 * assistant can read is a product decision, not a refactor.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const BRIDGE_SRC = readFileSync(
  join(process.cwd(), 'utils', 'aiContextBridge.ts'),
  'utf8',
)

/** Source with comments stripped — the invariant is documented in prose,
 *  and those mentions must not count as usage. */
const CODE = BRIDGE_SRC
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

describe('AI context — the wellness journal is private', () => {

  it('never reads qualitativeNotes in executable code', () => {
    expect(CODE).not.toMatch(/qualitativeNotes/)
  })

  it('emits no journal-labelled line into the prompt', () => {
    // The exact shape of the old leak: `| journal: "${note}"`.
    expect(CODE).not.toMatch(/journal:/i)
  })

  it('still shares the aggregate wellbeing signals', () => {
    // The flip side of the invariant. If these disappear the assistant
    // stops being able to notice burnout at all, which is a different
    // kind of regression and worth catching too.
    expect(CODE).toMatch(/avgStress/)
    expect(CODE).toMatch(/avgEnergy/)
    expect(CODE).toMatch(/burnoutRisk/)
  })

  it('tells the model the journal exists but is withheld', () => {
    // Without this the model can hallucinate having read entries, or ask
    // the user to paste them in — which would route around the exclusion.
    expect(BRIDGE_SRC).toMatch(/private and are not shared/i)
    expect(BRIDGE_SRC).toMatch(/[Dd]o not ask the user to paste/)
  })

  it('declares the invariant explicitly for future readers', () => {
    expect(BRIDGE_SRC).toMatch(/WELLNESS_JOURNAL_IS_PRIVATE/)
  })
})

describe('AI context — compiled payload', () => {

  it('contains no journal text for a log that has some', async () => {
    // End-to-end check against the real compiler, so this catches a leak
    // arriving through some path the source scan above does not model.
    jest.resetModules()

    const SECRET = 'ZZ_PRIVATE_JOURNAL_SENTINEL_ZZ'

    jest.doMock('@/lib/db', () => {
      const table = (rows: unknown[]) => ({
        toArray:        async () => rows,
        where:          () => ({
          aboveOrEqual: () => ({ toArray: async () => rows }),
          above:        () => ({ toArray: async () => rows }),
          equals:       () => ({ toArray: async () => rows }),
        }),
        orderBy:        () => ({ reverse: () => ({ limit: () => ({ toArray: async () => rows }) }) }),
        get:            async () => undefined,
        count:          async () => rows.length,
      })
      const fakeDb = new Proxy({}, {
        get: (_t, prop: string) => {
          if (prop === 'mentalHealthLogs') {
            return table([{
              logDate: '2026-08-01', stressLevel: 9, energyLevel: 2,
              qualitativeNotes: SECRET, moodVector: 'drained', createdAt: Date.now(),
            }])
          }
          return table([])
        },
      })
      // The bridge resolves the handle through getDb(), not the bare export.
      return { db: fakeDb, getDb: () => fakeDb }
    })

    const { compileUserContextPayload } = await import('@/utils/aiContextBridge')
    const payload = await compileUserContextPayload()

    expect(payload.systemPrompt).not.toContain(SECRET)
    // …while the scalars derived from that same row still made it through.
    expect(payload.systemPrompt).toMatch(/avg stress/i)
  })
})
