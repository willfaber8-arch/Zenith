/**
 * utils/peerPayload.ts — what to believe from another machine.
 *
 * Friend sync accepts a WebRTC DataChannel payload and writes it
 * straight into IndexedDB. Everything else in this app is local-first
 * and therefore self-authored; this is the one place data arrives from
 * somewhere you do not control, which makes it the one place that has
 * to distrust its input.
 *
 * It previously checked a single field — `payload.type` — and trusted
 * the rest, which left three real problems:
 *
 *   · **Impersonation.** Every row was keyed on `payload.senderId`, a
 *     value the sender chooses, never compared against the peer the
 *     connection is actually with. Anyone you sync with could claim to
 *     be one of your other friends and overwrite that friend's row,
 *     leaderboard score and shared calendar.
 *   · **Unbounded writes.** `calendarEvents` was length-checked only by
 *     `Array.isArray`, then `bulkPut` straight in. A hostile peer could
 *     fill the browser's storage quota, and a non-string `uid` produced
 *     `"[object Object]"` primary keys.
 *   · **A crash on a missing field.** A payload with no `snapshot` threw
 *     inside an async handler with no catch — an unhandled rejection.
 *
 * Pure, so the rules can be tested directly against hostile input
 * without a browser or a peer on the other end.
 */

import type {
  PeerLeaderboardSnapshot, SharedCalendarEvent, SyncPayload,
} from '@/types/friendsNetwork'

/**
 * Most events anyone needs to see of a friend's week. Well above a busy
 * calendar and well below anything that threatens the storage quota.
 */
export const MAX_SHARED_EVENTS = 500

/** Display strings are rendered in lists; long ones are always a mistake. */
export const MAX_NAME_LEN  = 80
export const MAX_TITLE_LEN = 200
export const MAX_UID_LEN   = 200

function cleanString(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  /* Control characters would corrupt a composite key and render as
     nothing, so they go before the length clamp. */
  const stripped = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return stripped.length > max ? stripped.slice(0, max) : stripped
}

/** A finite, non-negative count. Anything else is not a score. */
function cleanCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0
}

function cleanSnapshot(raw: unknown, peerId: string): PeerLeaderboardSnapshot {
  const s = (raw ?? {}) as Record<string, unknown>
  const ts = s.snapshotTimestamp
  return {
    peerIdString:        peerId,
    weeklyStudyMinutes:  cleanCount(s.weeklyStudyMinutes),
    monthlyStudyMinutes: cleanCount(s.monthlyStudyMinutes),
    allTimeStudyMinutes: cleanCount(s.allTimeStudyMinutes),
    activeHabitStreak:   cleanCount(s.activeHabitStreak),
    totalBooksCompleted: cleanCount(s.totalBooksCompleted),
    totalCardioMiles:    cleanCount(s.totalCardioMiles),
    totalCosmeticPoints: cleanCount(s.totalCosmeticPoints),
    totalVocabMastered:  cleanCount(s.totalVocabMastered),
    /* A missing or nonsense timestamp is treated as "just now" rather
       than 1970, which would zero every rolling window on arrival. */
    snapshotTimestamp:   typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now(),
  }
}

function cleanEvents(raw: unknown): SharedCalendarEvent[] | undefined {
  /* Absent means "didn't share a calendar"; an empty array means
     "cleared it". The two are different and both are honoured. */
  if (!Array.isArray(raw)) return undefined

  const out: SharedCalendarEvent[] = []
  for (const item of raw.slice(0, MAX_SHARED_EVENTS)) {
    const e = (item ?? {}) as Record<string, unknown>
    const uid = cleanString(e.uid, MAX_UID_LEN)
    const startMs = e.startMs
    const endMs   = e.endMs
    if (!uid) continue
    if (typeof startMs !== 'number' || !Number.isFinite(startMs)) continue
    if (typeof endMs   !== 'number' || !Number.isFinite(endMs))   continue

    out.push({
      uid,
      title:   cleanString(e.title, MAX_TITLE_LEN, 'Untitled'),
      startMs,
      endMs,
      allDay:  e.allDay === 1 ? 1 : 0,
    })
  }
  return out
}

/**
 * Validate a payload against the peer it actually arrived from.
 *
 * `fromPeerId` is `conn.peer` — the id the signalling layer assigns,
 * not one the sender writes into the body. Requiring the two to match
 * is what stops a peer claiming to be somebody else; it is the only
 * check here that cannot be replaced by clamping a value.
 *
 * Returns null when the payload is not a sync message at all, or is
 * claiming to be from a different peer.
 */
export function sanitiseSyncPayload(
  raw: unknown,
  fromPeerId: string,
): SyncPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (p.type !== 'ZENITH_FRIEND_SYNC') return null

  const claimed = cleanString(p.senderId, MAX_UID_LEN)
  if (!claimed || !fromPeerId || claimed !== fromPeerId) return null

  return {
    type:          'ZENITH_FRIEND_SYNC',
    senderId:      claimed,
    displayName:   cleanString(p.displayName, MAX_NAME_LEN, 'Friend') || 'Friend',
    avatarAssetId: cleanString(p.avatarAssetId, MAX_UID_LEN),
    snapshot:      cleanSnapshot(p.snapshot, claimed),
    calendarEvents: cleanEvents(p.calendarEvents),
  }
}
