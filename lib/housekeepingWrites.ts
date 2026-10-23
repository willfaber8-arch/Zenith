/**
 * lib/housekeepingWrites.ts — writes the app makes by itself, not ones you make.
 *
 * Cloud sync stamps "changed here" on every database write (services/
 * cloudSnapshot.ts), because a write it misses is a change that never
 * reaches your other devices. But a few writes are the app tidying up after
 * itself on a timer — the weekly sweep of long-finished tasks — and stamping
 * those made a device that was only *opened* look like the one you had just
 * been working on: "Changed here just now", first in the sync banner, every
 * morning.
 *
 * A housekeeping write runs in its own transaction and tags it. Tagging the
 * transaction rather than flipping a module flag is the important part: a
 * flag would also silence any real edit you happened to make while the
 * sweep was running, and an edit that is never stamped is never synced.
 * Your writes run in their own transactions, so they are always stamped.
 */

import type { Transaction } from 'dexie'

const tagged = new WeakSet<Transaction>()

/** Marks a transaction as the app's own upkeep — call first thing inside it. */
export function markHousekeeping(tx: Transaction): void {
  tagged.add(tx)
}

/** True for a write made inside a tagged transaction (or one nested in it). */
export function isHousekeeping(tx: Transaction | null | undefined): boolean {
  for (let t = tx; t; t = t.parent) {
    if (tagged.has(t)) return true
  }
  return false
}
