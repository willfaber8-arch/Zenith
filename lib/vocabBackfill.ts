/**
 * lib/vocabBackfill.ts — one-time repair for cards that were always due.
 *
 * Before ReviewScheduler existed, `nextReviewTimestamp` was written only
 * when a card was created (as `Date.now()` or `0`) and never updated on
 * review — while VocabBuilderView, StatsView and VocabWidget all read it
 * to mean "due". So every card in every deck was permanently due and the
 * counts never fell.
 *
 * Fixing the write path (VocabStudySession) stops it happening to future
 * reviews, but does nothing for cards already in that state: they would
 * stay stuck-due until each one was individually studied. This backfill
 * gives them a plausible first due-date derived from the mastery they
 * already have.
 *
 * Runs once, guarded by a localStorage flag. It is deliberately not a
 * Dexie version upgrade: it is a data repair, not a schema change, and
 * keeping it out of the migration chain means a failure here cannot brick
 * database opening.
 */

'use client'

import { db } from '@/lib/db'
import { backfillState } from '@/lib/engines/ReviewScheduler'

const BACKFILL_KEY = 'zenith_vocab_schedule_backfill_v1'

export interface BackfillResult {
  /** Rows examined. */
  scanned: number
  /** Rows given a new due-date. */
  repaired: number
  /** How many are still due right now, after the repair. */
  dueNow: number
  /** True when the flag was already set and nothing was done. */
  skipped: boolean
}

export function hasRunBackfill(): boolean {
  try { return localStorage.getItem(BACKFILL_KEY) === 'done' }
  catch { return false }
}

/**
 * Repair scheduling state across every vocab card.
 *
 * Cards are sorted by mastery before being spread, so the spread index
 * fans out cards that share a mastery level rather than an arbitrary
 * insertion order — a deck of 200 evenly-known cards otherwise all
 * resurfaces on the same morning.
 *
 * Never-passed cards stay due now. They genuinely need studying, and
 * pushing them out to flatter the due count would be the wrong kind of
 * fix.
 */
export async function runVocabScheduleBackfill(
  opts: { force?: boolean } = {},
): Promise<BackfillResult> {
  const empty: BackfillResult = { scanned: 0, repaired: 0, dueNow: 0, skipped: true }

  if (!db) return empty
  if (!opts.force && hasRunBackfill()) return empty

  const cards = await db.vocab_cards.toArray()
  if (cards.length === 0) {
    markDone()
    return { scanned: 0, repaired: 0, dueNow: 0, skipped: false }
  }

  const now = Date.now()

  // Group by mastery so the spread index varies within a tier.
  const byMastery = [...cards].sort(
    (a, b) => (a.consecutiveSuccesses ?? 0) - (b.consecutiveSuccesses ?? 0),
  )

  let repaired = 0
  let dueNow   = 0

  await db.transaction('rw', db.vocab_cards, async () => {
    for (let i = 0; i < byMastery.length; i++) {
      const card  = byMastery[i]
      const state = backfillState(card, now, i)

      await db.vocab_cards.update(card.id, {
        easeFactor:          state.easeFactor,
        reviewIntervalDays:  state.reviewIntervalDays,
        nextReviewTimestamp: state.nextReviewAt,
      })

      repaired++
      if (state.nextReviewAt <= now) dueNow++
    }
  })

  markDone()
  return { scanned: cards.length, repaired, dueNow, skipped: false }
}

function markDone(): void {
  try { localStorage.setItem(BACKFILL_KEY, 'done') } catch { /* private mode */ }
}
