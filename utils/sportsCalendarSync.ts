/**
 * Zenith OS — Sports → Calendar bridge
 *
 * Self-contained helper that writes a followed team's upcoming fixtures into
 * the shared `personalEvents` table so they surface in the Universal Calendar
 * (rendered there via the synthetic Personal feed). CalendarView is NOT
 * modified — this simply inserts rows it already knows how to display.
 *
 * Dedup: `personalEvents` has no unique index for a TheSportsDB event id, so
 * we guard writes with a localStorage Set of already-synced event ids
 * (zenith_sports_synced_v1). An event is only inserted if its id is not in
 * the set.
 */

import { db } from '@/lib/db'
import type { PersonalEvent } from '@/lib/db'
import type { TeamFixture } from '@/types/sports'

const SYNCED_KEY = 'zenith_sports_synced_v1'

/** Upcoming fixtures keyed by the followed team id. */
export type FixturesByTeam = Record<string, TeamFixture[]>

function readSyncedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SYNCED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeSyncedSet(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...set]))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Compose the epoch-ms start for a fixture (local wall-clock). */
function fixtureStartMs(f: TeamFixture): number {
  const [y, m, d] = f.date.split('-').map(Number)
  if (!y || !m || !d) return NaN
  if (f.time) {
    const [hh, mm] = f.time.split(':').map(Number)
    return new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
  }
  return new Date(y, m - 1, d).getTime()
}

/** Human title, e.g. "Lakers vs Celtics" (team of interest first when home). */
function fixtureTitle(f: TeamFixture): string {
  return f.isHome ? `${f.homeTeam} vs ${f.awayTeam}` : `${f.awayTeam} @ ${f.homeTeam}`
}

export interface SyncResult {
  added:   number
  skipped: number
}

/**
 * Insert any not-yet-synced upcoming fixtures into `personalEvents`.
 * Colour is taken from the per-team accent map when supplied, else a sane
 * green default (Sports lives under Creator's Choice).
 */
export async function syncFollowedGamesToCalendar(
  fixturesByTeam: FixturesByTeam,
  accentByTeam:   Record<string, string> = {},
): Promise<SyncResult> {
  if (typeof window === 'undefined' || !db) return { added: 0, skipped: 0 }

  const synced = readSyncedSet()
  const now    = Date.now()
  const rows: PersonalEvent[] = []
  let skipped  = 0

  for (const [teamId, fixtures] of Object.entries(fixturesByTeam)) {
    const accent = accentByTeam[teamId] ?? '#52cca3'
    for (const f of fixtures) {
      if (!f.eventId || synced.has(f.eventId)) { skipped++; continue }
      const startMs = fixtureStartMs(f)
      if (!Number.isFinite(startMs) || startMs < now - 12 * 3_600_000) { skipped++; continue }

      const allDay = f.time ? 0 : 1
      const endMs  = allDay ? startMs : startMs + 2 * 3_600_000   // 2h default duration

      rows.push({
        // id is auto-increment — omit; cast satisfies the Dexie insert type
        title:       fixtureTitle(f),
        startMs,
        endMs,
        allDay,
        color:       accent,
        category:    'life',
        description: `Sports · ${f.league || 'Fixture'} · sdb:${f.eventId}`,
        createdAt:   now,
      } as PersonalEvent)
      synced.add(f.eventId)
    }
  }

  if (rows.length > 0) {
    await db.personalEvents.bulkAdd(rows as PersonalEvent[])
    writeSyncedSet(synced)
  }

  return { added: rows.length, skipped }
}
