/**
 * lib/coverRepair.ts — heal covers that were stored but never render.
 *
 * For a while the Google Books path handed back thumbnail URLs nobody had
 * loaded. A URL that answers the API but refuses to render got written
 * onto the book as a successful cover, and the result was invisible *and*
 * unrecoverable: the shelf silently drops an image that errors, so the
 * book showed nothing, while the row held a string `coverUrl` — neither
 * `undefined` (never looked up) nor `null` (looked up, none found). Both
 * retry queues skip it. Forever.
 *
 * The <img> error handler on the shelf demotes these on sight, but only
 * for books that actually get rendered, and the shelf paginates. This
 * sweeps the whole table once instead.
 *
 * It costs no API quota at all: verifying a cover is an image load, not
 * an API call. The providers' rate limits are irrelevant here, which is
 * why this can afford to check every book in one go.
 */

'use client'

import { db } from '@/lib/db'
import { probeCoverUrl } from '@/utils/bookCovers'

/** Bumped if a future defect needs the same sweep to run again. */
const DONE_KEY = 'zenith_cover_repair_v1'

/** Enough at once to finish quickly, few enough to stay polite. */
const CONCURRENCY = 4

export interface RepairResult {
  checked:  number
  demoted:  number
  /** True when the pass was skipped because it had already run. */
  skipped:  boolean
}

const NOTHING: RepairResult = { checked: 0, demoted: 0, skipped: true }

/**
 * Verify every stored cover URL, and record the ones that do not load.
 *
 * Demoted rows become `coverUrl: null` — a recorded miss, which is
 * precisely the state the retry button already knows how to pick up. The
 * repair does not fetch replacements itself: that would spend quota
 * without being asked, and the user may well be mid-cooldown.
 */
export async function repairBrokenCovers(
  opts: { force?: boolean } = {},
): Promise<RepairResult> {
  if (!db || typeof window === 'undefined') return NOTHING

  if (!opts.force) {
    try {
      if (localStorage.getItem(DONE_KEY)) return NOTHING
    } catch { /* storage disabled — just run it */ }
  }

  // Offline, every probe fails and we would wipe the whole shelf.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return NOTHING

  let rows: Array<{ id: string; coverUrl?: string | null }>
  try {
    rows = await db.library_books.toArray()
  } catch {
    return NOTHING
  }

  const suspects = rows.filter(b => typeof b.coverUrl === 'string' && b.coverUrl)
  let checked = 0
  let demoted = 0
  let cursor  = 0

  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= suspects.length) return
      const book = suspects[i]
      const url  = book.coverUrl as string

      const ok = await probeCoverUrl(url)
      checked++
      if (ok) continue

      try {
        // Re-read: a sweep may have replaced this URL since we started.
        const fresh = await db.library_books.get(book.id)
        if (!fresh || fresh.coverUrl !== url) continue
        await db.library_books.update(book.id, {
          coverUrl: null, coverCheckedAt: Date.now(),
        })
        demoted++
      } catch { /* row removed mid-pass */ }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, suspects.length) }, worker),
  )

  try { localStorage.setItem(DONE_KEY, String(Date.now())) } catch { /* noop */ }
  return { checked, demoted, skipped: false }
}

/** Let the user run it again from Settings after a provider outage. */
export function resetCoverRepairFlag(): void {
  try { localStorage.removeItem(DONE_KEY) } catch { /* noop */ }
}
