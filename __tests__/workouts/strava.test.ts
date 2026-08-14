/**
 * Strava → cardio session.
 *
 * The pure half of the bridge, which is the half that can be wrong in
 * ways nobody notices: a run on the wrong day, a café stop counted as
 * exercise, or the same activity imported twice every sync.
 */

import {
  mapSportType, activityDate, toCardioSession, convertActivities,
  calcVP, tokensExpired, buildAuthorizeUrl, scopeGranted,
  STRAVA_SCOPE, type StravaActivity,
} from '@/lib/strava'

function activity(over: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1, name: 'Morning Run', sport_type: 'Run',
    moving_time: 1800, elapsed_time: 2400, distance: 5000,
    start_date_local: '2026-08-14T07:30:00Z',
    start_date: '2026-08-14T06:30:00Z',
    ...over,
  }
}

describe('mapSportType', () => {
  it.each([
    ['Run', 'run'], ['TrailRun', 'run'], ['VirtualRun', 'run'],
    ['Ride', 'bike'], ['EBikeRide', 'bike'], ['MountainBikeRide', 'bike'],
    ['Swim', 'swim'], ['Hike', 'hike'], ['Walk', 'walk'],
    ['Rowing', 'row'], ['Kayaking', 'row'],
    ['Yoga', 'yoga'], ['Elliptical', 'elliptical'],
    ['WeightTraining', 'other'],
  ])('maps %s to %s', (sport, expected) => {
    expect(mapSportType(activity({ sport_type: sport }))).toBe(expected)
  })

  it('falls back to the deprecated `type` field', () => {
    // Older activities and some integrations still only send `type`.
    expect(mapSportType({ id: 1, type: 'Ride' })).toBe('bike')
  })

  it('prefers sport_type when both are present', () => {
    expect(mapSportType({ id: 1, type: 'Run', sport_type: 'Swim' })).toBe('swim')
  })

  it('files an unknown sport as other rather than dropping it', () => {
    expect(mapSportType({ id: 1, sport_type: 'Kitesurf' })).toBe('other')
    expect(mapSportType({ id: 1 })).toBe('other')
  })
})

describe('activityDate', () => {
  it('takes the local date verbatim', () => {
    expect(activityDate(activity({ start_date_local: '2026-08-14T07:30:00Z' }))).toBe('2026-08-14')
  })

  it('does not re-interpret a late-evening activity in the browser zone', () => {
    // Strava gives start_date_local in the athlete's own time. Parsing it
    // into a Date and reformatting would shift a 23:30 run to the next or
    // previous day for anyone whose browser is in a different zone —
    // exactly what happens on holiday.
    expect(activityDate(activity({ start_date_local: '2026-08-14T23:30:00Z' }))).toBe('2026-08-14')
    expect(activityDate(activity({ start_date_local: '2026-08-14T00:15:00Z' }))).toBe('2026-08-14')
  })

  it('falls back to start_date when there is no local one', () => {
    expect(activityDate({ id: 1, start_date: '2026-01-02T10:00:00Z' })).toBe('2026-01-02')
  })

  it('returns null when there is no usable date', () => {
    expect(activityDate({ id: 1 })).toBeNull()
    expect(activityDate({ id: 1, start_date_local: 'nonsense' })).toBeNull()
  })
})

describe('toCardioSession', () => {
  it('uses moving time, not elapsed', () => {
    // Elapsed includes the twenty minutes spent at a café halfway round.
    // Counting that inflates both the log and the VP awarded for it.
    const s = toCardioSession(activity({ moving_time: 1800, elapsed_time: 3600 }))!
    expect(s.durationMinutes).toBe(30)
  })

  it('falls back to elapsed when moving time is absent', () => {
    const s = toCardioSession(activity({ moving_time: undefined, elapsed_time: 600 }))!
    expect(s.durationMinutes).toBe(10)
  })

  it('converts metres to miles', () => {
    const s = toCardioSession(activity({ distance: 5000 }))!
    expect(s.distance).toBeCloseTo(3.11, 1)
    expect(s.distanceUnit).toBe('mi')
  })

  it('omits distance entirely when there is none', () => {
    // A gym session has no distance, and 0 miles in the log is a lie
    // that reads as a measurement.
    const s = toCardioSession(activity({ distance: 0 }))!
    expect(s.distance).toBeUndefined()
    expect(s.distanceUnit).toBeUndefined()
  })

  it('awards the same VP as the manual form', () => {
    // An imported run and a hand-logged run of the same length must be
    // worth the same, or the currency stops meaning anything.
    expect(toCardioSession(activity({ moving_time: 1800 }))!.vitalityEarned).toBe(calcVP(30))
    expect(toCardioSession(activity({ moving_time: 600 }))!.vitalityEarned).toBe(calcVP(10))
  })

  it('keeps the activity name in the notes', () => {
    const s = toCardioSession(activity({ name: 'Hill repeats' }))!
    expect(s.notes).toMatch(/Hill repeats/)
    expect(s.notes).toMatch(/Strava/)
  })

  it('records the Strava id, for dedupe', () => {
    expect(toCardioSession(activity({ id: 987 }))!.stravaActivityId).toBe(987)
  })

  it('refuses an activity with no duration', () => {
    // A zero-minute session is a row in the log contributing nothing.
    expect(toCardioSession(activity({ moving_time: 0, elapsed_time: 0 }))).toBeNull()
    expect(toCardioSession(activity({ moving_time: 20, elapsed_time: 20 }))).toBeNull()
  })

  it('refuses an activity with no date or no id', () => {
    expect(toCardioSession({ id: 1, moving_time: 600 })).toBeNull()
    expect(toCardioSession({ moving_time: 600, start_date_local: '2026-08-14T07:00:00Z' } as StravaActivity)).toBeNull()
  })
})

describe('convertActivities', () => {
  it('skips activities already imported', () => {
    const out = convertActivities(
      [activity({ id: 1 }), activity({ id: 2 })],
      new Set([1]),
    )
    expect(out.sessions).toHaveLength(1)
    expect(out.sessions[0].stravaActivityId).toBe(2)
    expect(out.duplicates).toBe(1)
  })

  it('dedupes by id, not by shape', () => {
    // Two 30-minute runs on the same morning is a real thing. Matching on
    // date and duration would silently discard the second.
    const out = convertActivities(
      [activity({ id: 1 }), activity({ id: 2 })],
      new Set(),
    )
    expect(out.sessions).toHaveLength(2)
  })

  it('counts what it dropped rather than hiding it', () => {
    const out = convertActivities(
      [activity({ id: 1 }), activity({ id: 2, moving_time: 0, elapsed_time: 0 })],
      new Set(),
    )
    expect(out.sessions).toHaveLength(1)
    expect(out.skipped).toBe(1)
  })

  it('handles an empty response', () => {
    expect(convertActivities([], new Set())).toEqual({ sessions: [], skipped: 0, duplicates: 0 })
  })
})

describe('tokensExpired', () => {
  it('refreshes before expiry, not after', () => {
    // Refreshing on the exact second is a 401 waiting to happen.
    const expiresAt = 1_000_000
    expect(tokensExpired(expiresAt, expiresAt - 600)).toBe(false)
    expect(tokensExpired(expiresAt, expiresAt - 60)).toBe(true)
    expect(tokensExpired(expiresAt, expiresAt)).toBe(true)
  })
})

describe('buildAuthorizeUrl', () => {
  const url = () => new URL(buildAuthorizeUrl({
    clientId: '12345',
    redirectUri: 'https://zenith.example/api/strava/callback',
    state: 'abc-123',
  }))

  it('asks only for activity read access', () => {
    expect(url().searchParams.get('scope')).toBe(STRAVA_SCOPE)
    expect(STRAVA_SCOPE).not.toMatch(/write/)
  })

  it('carries the state through, for CSRF', () => {
    expect(url().searchParams.get('state')).toBe('abc-123')
  })

  it('encodes the redirect URI rather than pasting it raw', () => {
    // A raw `?` or `&` in the redirect would truncate the query string
    // and Strava would reject the whole request.
    expect(buildAuthorizeUrl({
      clientId: '1', redirectUri: 'https://x.test/cb?a=b', state: 's',
    })).toContain(encodeURIComponent('https://x.test/cb?a=b'))
  })

  it('points at Strava', () => {
    expect(url().origin).toBe('https://www.strava.com')
    expect(url().pathname).toBe('/oauth/authorize')
  })
})

describe('scopeGranted', () => {
  it('accepts the scope among others', () => {
    expect(scopeGranted('read,activity:read_all')).toBe(true)
    expect(scopeGranted('activity:read_all')).toBe(true)
    expect(scopeGranted('read, activity:read_all')).toBe(true)
  })

  it('rejects the approval where the activity box was left unticked', () => {
    // Strava lets you approve the connection without granting this. The
    // redirect then looks like a success and every request comes back
    // empty, which reads as a broken import rather than a missed box.
    expect(scopeGranted('read')).toBe(false)
    expect(scopeGranted('')).toBe(false)
    expect(scopeGranted(null)).toBe(false)
    expect(scopeGranted(undefined)).toBe(false)
  })

  it('does not accept a prefix match', () => {
    // `activity:read` is a real, narrower Strava scope — it excludes
    // private activities. A substring check would wave it through.
    expect(scopeGranted('activity:read')).toBe(false)
  })
})
