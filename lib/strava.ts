/**
 * lib/strava.ts — mapping Strava's activity model onto ours.
 *
 * Pure. No fetch, no tokens, no environment — all of that lives in the
 * API routes, because the client must never hold the secret and this
 * file is the half worth testing.
 *
 * Your Garmin syncs to Strava automatically, so this is the bridge:
 * Garmin's own Connect API is behind a company-approval developer
 * programme with OAuth 1.0a, and there is no consumer key to get. Strava
 * has a public API you can register for in minutes, and the watch
 * already pushes to it.
 */

import type { CardioSession } from '@/lib/db'

/** The subset of Strava's activity we use. Their payload is much larger. */
export interface StravaActivity {
  id:                 number
  name?:              string
  type?:              string
  sport_type?:        string
  /** Seconds actually moving — not elapsed, which includes standing still. */
  moving_time?:       number
  elapsed_time?:      number
  /** Metres. */
  distance?:          number
  /** ISO 8601 with an offset, in the athlete's local time. */
  start_date_local?:  string
  start_date?:        string
  calories?:          number
  trainer?:           boolean
  manual?:            boolean
}

/**
 * Strava's sport types onto our nine.
 *
 * `sport_type` is the current field and `type` the deprecated one; both
 * arrive depending on how the activity was created, so both are tried.
 */
const SPORT_MAP: Record<string, string> = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run', Treadmill: 'run',
  Walk: 'walk',
  Hike: 'hike',
  Ride: 'bike', VirtualRide: 'bike', EBikeRide: 'bike', MountainBikeRide: 'bike',
  GravelRide: 'bike', Handcycle: 'bike', Velomobile: 'bike',
  Swim: 'swim',
  Rowing: 'row', VirtualRow: 'row', Kayaking: 'row', Canoeing: 'row',
  StandUpPaddling: 'row',
  Yoga: 'yoga',
  Elliptical: 'elliptical', StairStepper: 'elliptical',
  WeightTraining: 'other', Workout: 'other', Crossfit: 'other',
}

export function mapSportType(a: StravaActivity): string {
  const raw = a.sport_type ?? a.type ?? ''
  return SPORT_MAP[raw] ?? 'other'
}

const METRES_PER_MILE = 1609.344

/**
 * Vitality Points, matching what the manual cardio form awards.
 *
 * Deliberately the same formula rather than a Strava-specific one: an
 * imported run and a hand-logged run of the same length must be worth
 * the same, or the currency stops meaning anything.
 */
export function calcVP(minutes: number): number {
  return minutes + (minutes >= 30 ? 5 : 0)
}

/**
 * The local calendar date an activity happened on.
 *
 * Uses `start_date_local`, which Strava gives in the athlete's own time
 * with an offset, and takes the date part verbatim. Parsing it into a
 * Date and formatting would re-interpret it in the *browser's* zone —
 * so a 9pm run uploaded on holiday would land on the wrong day. The
 * string already says which day it was where you were.
 */
export function activityDate(a: StravaActivity): string | null {
  const raw = a.start_date_local ?? a.start_date
  if (!raw || typeof raw !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  return m ? m[1] : null
}

export interface ConvertResult {
  session: Omit<CardioSession, 'id'> & { stravaActivityId: number }
}

/**
 * One Strava activity as one cardio session.
 *
 * Returns null for anything we cannot honestly record: no date, or no
 * duration. A zero-minute session would sit in the log contributing
 * nothing but a row.
 */
export function toCardioSession(a: StravaActivity): ConvertResult['session'] | null {
  if (!a || typeof a.id !== 'number') return null

  const logDate = activityDate(a)
  if (!logDate) return null

  /*
   * Moving time, not elapsed. Elapsed includes the twenty minutes spent
   * at a café halfway round, and counting that as exercise would inflate
   * both the log and the VP awarded for it.
   */
  const seconds = a.moving_time ?? a.elapsed_time ?? 0
  const durationMinutes = Math.round(seconds / 60)
  if (durationMinutes <= 0) return null

  const metres = typeof a.distance === 'number' && a.distance > 0 ? a.distance : undefined

  return {
    activityType: mapSportType(a),
    durationMinutes,
    ...(metres ? {
      distance: Math.round((metres / METRES_PER_MILE) * 100) / 100,
      distanceUnit: 'mi' as const,
    } : {}),
    ...(typeof a.calories === 'number' && a.calories > 0
      ? { caloriesBurned: Math.round(a.calories) } : {}),
    vitalityEarned: calcVP(durationMinutes),
    notes: a.name?.trim() ? `${a.name.trim()} · imported from Strava` : 'Imported from Strava',
    logDate,
    completedAt: Date.parse(a.start_date ?? `${logDate}T12:00:00Z`) || Date.now(),
    stravaActivityId: a.id,
  }
}

/**
 * Convert a batch, dropping what cannot be used and what is already in.
 *
 * Dedupe is by Strava's activity id rather than by date and duration:
 * two 30-minute runs on the same morning are a real thing, and matching
 * on shape would silently discard the second one.
 */
export function convertActivities(
  activities: StravaActivity[],
  existingIds: ReadonlySet<number>,
): { sessions: ConvertResult['session'][]; skipped: number; duplicates: number } {
  const sessions: ConvertResult['session'][] = []
  let skipped = 0
  let duplicates = 0

  for (const a of activities) {
    if (a && typeof a.id === 'number' && existingIds.has(a.id)) { duplicates++; continue }
    const s = toCardioSession(a)
    if (!s) { skipped++; continue }
    sessions.push(s)
  }
  return { sessions, skipped, duplicates }
}

/* ── OAuth shapes, shared between the routes ───────────────────────── */

export interface StravaTokens {
  access_token:  string
  refresh_token: string
  /** Unix seconds. */
  expires_at:    number
  /**
   * The athlete's first name, kept only so the UI can say who is
   * connected. Strava returns it on the initial exchange but not on a
   * refresh, so it has to be carried forward deliberately.
   */
  athlete_name?: string
}

/** Read-only, and only what is needed: activities, including private ones. */
export const STRAVA_SCOPE = 'activity:read_all'

/** Refresh this far before expiry rather than after, to avoid a 401 race. */
export const REFRESH_MARGIN_SECONDS = 300

export function tokensExpired(expiresAt: number, nowSeconds: number): boolean {
  return nowSeconds >= expiresAt - REFRESH_MARGIN_SECONDS
}

/**
 * Where to send someone to grant access.
 *
 * `approval_prompt=auto` rather than `force`: someone who has already
 * connected and is reconnecting after clearing cookies should not have
 * to re-read a consent screen they have already agreed to.
 */
export function buildAuthorizeUrl(opts: {
  clientId: string; redirectUri: string; state: string
}): string {
  const q = new URLSearchParams({
    client_id:        opts.clientId,
    redirect_uri:     opts.redirectUri,
    response_type:    'code',
    approval_prompt:  'auto',
    scope:            STRAVA_SCOPE,
    state:            opts.state,
  })
  return `https://www.strava.com/oauth/authorize?${q}`
}

/**
 * Did the athlete actually grant the scope we asked for?
 *
 * Strava's consent screen has a checkbox, and it is legal to approve the
 * connection with the box unticked. The redirect then looks like a
 * success and every activity request comes back empty, which reads as
 * "the import is broken" rather than "you missed a checkbox".
 */
export function scopeGranted(granted: string | null | undefined): boolean {
  if (!granted) return false
  return granted.split(',').map(s => s.trim()).includes(STRAVA_SCOPE)
}
