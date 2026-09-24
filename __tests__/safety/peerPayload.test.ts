/**
 * What arrives over the wire from a friend.
 *
 * Everything else in Zenith is data you wrote yourself. A P2P sync
 * payload is not, so it gets treated as hostile until proven otherwise:
 * a peer can only speak for itself, a score has to be a number, and a
 * shared calendar cannot be large enough to fill your disk.
 */

import {
  sanitiseSyncPayload, MAX_SHARED_EVENTS, MAX_NAME_LEN, MAX_TITLE_LEN,
} from '@/utils/peerPayload'

const PEER = 'peer-abc-123'

const valid = (over: Record<string, unknown> = {}) => ({
  type: 'ZENITH_FRIEND_SYNC',
  senderId: PEER,
  displayName: 'Sam',
  avatarAssetId: 'av1',
  snapshot: {
    peerIdString: PEER,
    weeklyStudyMinutes: 120, monthlyStudyMinutes: 400, allTimeStudyMinutes: 9000,
    activeHabitStreak: 12, totalBooksCompleted: 3, totalCardioMiles: 40,
    totalCosmeticPoints: 55, totalVocabMastered: 200,
    snapshotTimestamp: Date.now(),
  },
  ...over,
})

describe('a peer can only speak for itself', () => {
  it('accepts a payload whose senderId matches the connection', () => {
    expect(sanitiseSyncPayload(valid(), PEER)?.senderId).toBe(PEER)
  })

  /*
   * The impersonation fix. Every row is keyed on senderId, so without
   * this a peer you sync with could overwrite a different friend's
   * entry, score and calendar just by claiming their id.
   */
  it('refuses a payload claiming to be a different peer', () => {
    expect(sanitiseSyncPayload(valid({ senderId: 'someone-else' }), PEER)).toBeNull()
  })

  it('refuses a payload with no senderId at all', () => {
    expect(sanitiseSyncPayload(valid({ senderId: undefined }), PEER)).toBeNull()
    expect(sanitiseSyncPayload(valid({ senderId: 42 }), PEER)).toBeNull()
  })

  it('refuses anything that is not a sync message', () => {
    expect(sanitiseSyncPayload(valid({ type: 'SOMETHING_ELSE' }), PEER)).toBeNull()
    expect(sanitiseSyncPayload(null, PEER)).toBeNull()
    expect(sanitiseSyncPayload('a string', PEER)).toBeNull()
    expect(sanitiseSyncPayload(42, PEER)).toBeNull()
  })
})

describe('a missing or hostile snapshot', () => {
  /* This used to throw inside an async handler with no catch. */
  it('survives a payload with no snapshot', () => {
    const out = sanitiseSyncPayload(valid({ snapshot: undefined }), PEER)
    expect(out).not.toBeNull()
    expect(out!.snapshot.weeklyStudyMinutes).toBe(0)
    expect(Number.isFinite(out!.snapshot.snapshotTimestamp)).toBe(true)
  })

  it('zeroes scores that are not finite non-negative numbers', () => {
    const out = sanitiseSyncPayload(valid({
      snapshot: {
        weeklyStudyMinutes: Number.POSITIVE_INFINITY,
        monthlyStudyMinutes: NaN,
        allTimeStudyMinutes: -5,
        activeHabitStreak: '999',
        totalBooksCompleted: { evil: true },
        snapshotTimestamp: 'not a time',
      },
    }), PEER)!

    expect(out.snapshot.weeklyStudyMinutes).toBe(0)
    expect(out.snapshot.monthlyStudyMinutes).toBe(0)
    expect(out.snapshot.allTimeStudyMinutes).toBe(0)
    expect(out.snapshot.activeHabitStreak).toBe(0)
    expect(out.snapshot.totalBooksCompleted).toBe(0)
    expect(Number.isFinite(out.snapshot.snapshotTimestamp)).toBe(true)
  })

  it('keys the snapshot to the real peer, not to whatever it claims', () => {
    const out = sanitiseSyncPayload(valid({
      snapshot: { ...valid().snapshot, peerIdString: 'impersonated' },
    }), PEER)!
    expect(out.snapshot.peerIdString).toBe(PEER)
  })
})

describe('a shared calendar', () => {
  const event = (over: Record<string, unknown> = {}) => ({
    uid: 'e1', title: 'Lunch', startMs: 1_700_000_000_000, endMs: 1_700_003_600_000,
    allDay: 0, ...over,
  })

  it('tells "did not share" apart from "shared nothing"', () => {
    expect(sanitiseSyncPayload(valid(), PEER)!.calendarEvents).toBeUndefined()
    expect(sanitiseSyncPayload(valid({ calendarEvents: [] }), PEER)!.calendarEvents).toEqual([])
  })

  /* The storage-quota fix: bulkPut used to take whatever arrived. */
  it('caps how many events one peer can push', () => {
    const flood = Array.from({ length: 5_000 }, (_, i) => event({ uid: `e${i}` }))
    const out = sanitiseSyncPayload(valid({ calendarEvents: flood }), PEER)!
    expect(out.calendarEvents).toHaveLength(MAX_SHARED_EVENTS)
  })

  it('drops events that could not be keyed or placed in time', () => {
    const out = sanitiseSyncPayload(valid({
      calendarEvents: [
        event(),
        event({ uid: { nested: 'object' } }),   // would key as "[object Object]"
        event({ uid: '' }),
        event({ startMs: 'soon' }),
        event({ endMs: NaN }),
        event({ uid: 'ok2' }),
      ],
    }), PEER)!
    expect(out.calendarEvents!.map(e => e.uid)).toEqual(['e1', 'ok2'])
  })

  it('clamps long titles and normalises allDay to 0 or 1', () => {
    const out = sanitiseSyncPayload(valid({
      calendarEvents: [event({ title: 'x'.repeat(5_000), allDay: 'yes' })],
    }), PEER)!
    expect(out.calendarEvents![0].title).toHaveLength(MAX_TITLE_LEN)
    expect(out.calendarEvents![0].allDay).toBe(0)
  })

  it('gives an untitled event a name rather than rendering a blank row', () => {
    const out = sanitiseSyncPayload(valid({
      calendarEvents: [event({ title: undefined })],
    }), PEER)!
    expect(out.calendarEvents![0].title).toBe('Untitled')
  })

  it('strips control characters that would corrupt a composite key', () => {
    const out = sanitiseSyncPayload(valid({
      calendarEvents: [event({ uid: 'a\u0000b\u001fc' })],
    }), PEER)!
    expect(out.calendarEvents![0].uid).toBe('abc')
  })
})

describe('display fields', () => {
  it('clamps a long display name', () => {
    const out = sanitiseSyncPayload(valid({ displayName: 'n'.repeat(1_000) }), PEER)!
    expect(out.displayName).toHaveLength(MAX_NAME_LEN)
  })

  it('falls back to a usable name rather than an empty label', () => {
    for (const bad of [undefined, '', '   ', 123, null]) {
      expect(sanitiseSyncPayload(valid({ displayName: bad }), PEER)!.displayName).toBe('Friend')
    }
  })
})
