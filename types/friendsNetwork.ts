/* ════════════════════════════════════════════════════════════
   Phase 9 · Step 9.1 — Serverless WebRTC Friend Ledger
   Type system, IDB row interfaces, WebRTC payload protocol,
   and temporal evaluation constants.
   ════════════════════════════════════════════════════════════ */

/* ── IDB row: peer_friends ────────────────────────────────── */

/** One row per connected peer friend. `id` is a client UUID string PK. */
export interface PeerFriend {
  id:                string   // UUID — explicit string PK
  peerIdString:      string   // WebRTC PeerJS handshake key (secondary index)
  friendDisplayName: string
  avatarAssetId:     string
  connectedAt:       number   // Unix ms
}

/* ── IDB row: peer_leaderboard_snapshots ──────────────────── */

/**
 * One snapshot per peer — `peerIdString` is the PK.
 * The local user's own snapshot uses the reserved value `'self'`.
 * Rolling-window fields (weekly / monthly) are zeroed out by
 * `evaluateTemporalSnapshot()` when the snapshot age exceeds the window.
 */
export interface PeerLeaderboardSnapshot {
  peerIdString:        string  // PK — 'self' or a PeerJS peer ID
  weeklyStudyMinutes:  number  // Pomodoro work minutes in the last 7 days
  monthlyStudyMinutes: number  // Pomodoro work minutes in the last 30 days
  allTimeStudyMinutes: number  // Total Pomodoro work minutes ever
  activeHabitStreak:   number  // Highest current streak across all habits
  totalBooksCompleted: number  // QuickNotes with category containing 'book'
  totalCardioMiles:    number  // Sum of cardio distances (km converted → mi)
  totalCosmeticPoints: number  // Current ✦ balance in gamesDb
  totalVocabMastered:  number  // English vocab cards with reviewIntervalDays ≥ 21
  snapshotTimestamp:   number  // Unix ms — when snapshot was compiled
}

/* ── Enumerated controls ──────────────────────────────────── */

export type TimeHorizon   = 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'
export type ScoringMetric =
  | 'STUDY_MINUTES'
  | 'HABIT_STREAK'
  | 'CARDIO_MILES'
  | 'BOOKS_COMPLETED'
  | 'COSMETIC_POINTS'
  | 'VOCAB_MASTERED'

/* ── Privacy broadcast settings ───────────────────────────── */

export interface PrivacySettings {
  shareStudyMinutes:   boolean
  shareHabitStreak:    boolean
  shareCardioMiles:    boolean
  shareBooksCompleted: boolean
  shareCosmeticPoints: boolean
}

/* ── WebRTC DataChannel payload protocol ─────────────────── */

/**
 * Canonical message exchanged over the P2P DataChannel.
 * Both sides send this on connection open; both sides save what they receive.
 * `type` is the protocol discriminator — unknown types are silently dropped.
 *
 * Phase 9.4 additions (both optional — backward-compatible):
 *   locationLat / locationLon carry the sender's current coordinates for
 *   the distance-tracker widget. They travel exclusively over the DTLS-
 *   encrypted WebRTC DataChannel and are NEVER written to Supabase or
 *   any other remote storage. Receivers store them only in local IDB
 *   (peer_locations table) for Haversine calculation.
 */
export interface SyncPayload {
  type:          'ZENITH_FRIEND_SYNC'
  senderId:      string                 // Sender's PeerJS ID
  displayName:   string
  avatarAssetId: string
  snapshot:      PeerLeaderboardSnapshot
  /** @private Sender's latitude — INTERNAL CALCULATION USE ONLY, never render */
  locationLat?:  number
  /** @private Sender's longitude — INTERNAL CALCULATION USE ONLY, never render */
  locationLon?:  number
}

/* ── Display-oriented constants ───────────────────────────── */

export const HORIZON_LABELS: Record<TimeHorizon, string> = {
  WEEKLY:   'Weekly',
  MONTHLY:  'Monthly',
  ALL_TIME: 'All-Time',
}

export const METRIC_META: Record<ScoringMetric, { label: string; unit: string }> = {
  STUDY_MINUTES:   { label: 'Study Mins',   unit: 'min'   },
  HABIT_STREAK:    { label: 'Streak',       unit: 'days'  },
  CARDIO_MILES:    { label: 'Cardio',       unit: 'mi'    },
  BOOKS_COMPLETED: { label: 'Books',        unit: 'books' },
  COSMETIC_POINTS: { label: '✦ Credits',   unit: 'pts'   },
  VOCAB_MASTERED:  { label: 'Vocab Words',  unit: 'words' },
}

/* ── Temporal evaluation engine ───────────────────────────── */

const WEEK_MS  = 7  * 86_400_000
const MONTH_MS = 30 * 86_400_000

/**
 * Multi-temporal evaluation: parse `snapshotTimestamp` against the current
 * client time to zero out rolling-window fields that exceed their window.
 *
 * Rules:
 *   - snapshot age > 7 days  → weeklyStudyMinutes   = 0  (window has elapsed)
 *   - snapshot age > 30 days → monthlyStudyMinutes  = 0  (window has elapsed)
 *   - allTimeStudyMinutes is never invalidated
 *
 * This prevents stale snapshots from inflating rolling leaderboard ranks.
 */
export function evaluateTemporalSnapshot(
  snap: PeerLeaderboardSnapshot
): PeerLeaderboardSnapshot {
  const age = Date.now() - snap.snapshotTimestamp
  return {
    ...snap,
    weeklyStudyMinutes:  age > WEEK_MS  ? 0 : snap.weeklyStudyMinutes,
    monthlyStudyMinutes: age > MONTH_MS ? 0 : snap.monthlyStudyMinutes,
  }
}

/** Extract the score for a given metric + horizon from any snapshot. */
export function extractScore(
  snap: PeerLeaderboardSnapshot,
  metric: ScoringMetric,
  horizon: TimeHorizon
): number {
  switch (metric) {
    case 'STUDY_MINUTES':
      return horizon === 'WEEKLY'  ? snap.weeklyStudyMinutes
           : horizon === 'MONTHLY' ? snap.monthlyStudyMinutes
           : snap.allTimeStudyMinutes
    case 'HABIT_STREAK':    return snap.activeHabitStreak
    case 'CARDIO_MILES':    return snap.totalCardioMiles
    case 'BOOKS_COMPLETED': return snap.totalBooksCompleted
    case 'COSMETIC_POINTS': return snap.totalCosmeticPoints
    case 'VOCAB_MASTERED':  return snap.totalVocabMastered ?? 0
  }
}

/** Format a raw score value for display. */
export function fmtScore(score: number, metric: ScoringMetric): string {
  if (score === 0) return '—'
  switch (metric) {
    case 'STUDY_MINUTES': {
      const h = Math.floor(score / 60)
      const m = score % 60
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }
    case 'CARDIO_MILES':    return `${score.toFixed(1)} mi`
    case 'COSMETIC_POINTS': return `${score.toLocaleString()} ✦`
    default:                return String(score)
  }
}

/** Determine whether a snapshot is stale (> 48 h old). */
export const STALE_MS = 48 * 60 * 60 * 1_000
export function isSnapshotStale(snap: PeerLeaderboardSnapshot): boolean {
  return Date.now() - snap.snapshotTimestamp > STALE_MS
}
