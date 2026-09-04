/**
 * lib/engines/studyPlan.ts — how a vocab session is put together.
 *
 * Pure: no React, no Dexie, no DOM. These are the decisions that shape
 * how hard a session is, and they are the ones worth testing without a
 * browser in the way.
 */

/** One kind of activity. A session is a sequence of these. */
export type StudyActivity = 'learn' | 'mc' | 'type'

/** Fixed order: look, recognise, produce. Difficulty only goes up. */
export const ACTIVITY_ORDER: StudyActivity[] = ['learn', 'mc', 'type']

export const ACTIVITY_LABEL: Record<StudyActivity, string> = {
  learn: 'Learn',
  mc:    'Choose',
  type:  'Type',
}

/**
 * Put the chosen activities into their canonical order.
 *
 * The session runs one activity per round over the whole batch, so this
 * list *is* the plan: three activities means three passes, and typing
 * alone means one pass of nothing but typing.
 */
export function buildPlan(enabled: Iterable<StudyActivity>): StudyActivity[] {
  const set = new Set(enabled)
  const plan = ACTIVITY_ORDER.filter(a => set.has(a))
  /* Never hand back an empty session. */
  return plan.length > 0 ? plan : ['type']
}

/* ── Distractors ─────────────────────────────────────────────────── */

/** Cheap similarity: shared character bigrams, 0..1 (Dice coefficient). */
export function similarity(a: string, b: string): number {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0

  const bigrams = (s: string) => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const ax = bigrams(x)
  const by = bigrams(y)
  let shared = 0
  for (const [g, n] of ax) shared += Math.min(n, by.get(g) ?? 0)
  return (2 * shared) / (x.length - 1 + y.length - 1)
}

/**
 * Choose wrong answers that are actually tempting.
 *
 * Drawn at random, three of the four options are usually obviously
 * wrong and the question collapses into process of elimination — you
 * can score well without knowing the word. Picking the nearest
 * candidates instead means every option is plausible and the only way
 * through is to know the answer.
 *
 * Not *purely* nearest: taking the top N every time makes the same
 * clusters appear together on every pass, which is its own kind of
 * memorisable. The near half is sampled from a slightly wider band.
 */
export function pickDistractors(
  answer: string,
  pool: string[],
  count: number,
  rand: () => number = Math.random,
): string[] {
  const candidates = pool.filter(p => p !== answer)
  if (candidates.length <= count) return [...candidates]

  const scored = candidates
    .map(text => ({ text, score: similarity(answer, text) }))
    .sort((a, b) => b.score - a.score)

  /* Draw from the nearest few times what we need, so the options are
     always close without always being the same close ones. */
  const bandSize = Math.min(scored.length, Math.max(count * 3, count + 4))
  const band = scored.slice(0, bandSize).map(s => s.text)

  /* Draw without replacement by removing what we take. Rejection
     sampling would loop forever the moment `rand` keeps returning the
     same index — which a seeded or stubbed generator does by design. */
  const remaining = [...band]
  const out: string[] = []
  while (out.length < count && remaining.length > 0) {
    const i = Math.min(remaining.length - 1, Math.floor(rand() * remaining.length))
    out.push(remaining.splice(i, 1)[0])
  }
  return out
}

/* ── Within-round repeats ────────────────────────────────────────── */

/** How many cards should pass before a missed one comes back. */
export const REQUEUE_GAP = 3

/**
 * Where to slot a card you just got wrong.
 *
 * Not immediately — answering the question you just saw the answer to
 * tests nothing. Not next round either, which is too long to rescue it.
 * A few cards later is the gap that does the work; the effect has a
 * name, expanding retrieval, and it is among the better evidenced
 * things in the literature.
 *
 * Returns an index in the *remaining* queue, clamped to the end when
 * the round is nearly over.
 */
export function requeueIndex(currentIdx: number, queueLength: number, gap = REQUEUE_GAP): number {
  const target = currentIdx + gap + 1
  return Math.min(target, queueLength)
}

/* ── Grading ─────────────────────────────────────────────────────── */

export interface SessionOutcome {
  /** Correct on the first attempt in the multiple-choice round. */
  mcCorrectFirst: boolean
  /** Result of the typing round, when there was one. */
  typeResult: 'exact' | 'close' | 'wrong' | null
}

/**
 * Map a session outcome onto an SM-2 grade, given what was tested.
 *
 * A session that only looked at cards grades nothing: no question was
 * asked, so there is no evidence to move a schedule with. Returning
 * null rather than a low grade keeps a browse from quietly damaging a
 * card's interval.
 *
 * Recognition alone tops out below a typed recall, because picking the
 * right option out of four is a weaker signal than producing the word
 * from nothing — even with hard distractors.
 */
export function gradeFor(
  outcome: SessionOutcome,
  plan: StudyActivity[],
): 0 | 2 | 4 | 5 | null {
  const testedMc   = plan.includes('mc')
  const testedType = plan.includes('type')

  if (!testedMc && !testedType) return null

  const typeOk = outcome.typeResult === 'exact' || outcome.typeResult === 'close'

  if (testedMc && testedType) {
    if (outcome.mcCorrectFirst && typeOk) return outcome.typeResult === 'exact' ? 5 : 4
    if (outcome.mcCorrectFirst || typeOk) return 2
    return 0
  }

  if (testedType) {
    if (outcome.typeResult === 'exact') return 5
    if (outcome.typeResult === 'close') return 4
    return 0
  }

  /* Multiple choice only. */
  return outcome.mcCorrectFirst ? 4 : 0
}

/* ── Shelving ────────────────────────────────────────────────────── */

/** A card you say you know steps out of rotation for this long. */
export const SHELF_DAYS = 7

export function shelfUntil(now = Date.now(), days = SHELF_DAYS): number {
  return now + days * 86_400_000
}

export function isShelved(card: { shelvedUntil?: number }, now = Date.now()): boolean {
  return typeof card.shelvedUntil === 'number' && card.shelvedUntil > now
}
