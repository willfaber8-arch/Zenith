/**
 * Reading an event against a clock that is not yours.
 *
 * The stored instant never moves — the moment a class starts does not
 * change when you fly. What changes is which wall clock you want to
 * read it against, so everything here is display, and the one thing
 * that must not break is the offset across daylight saving: a call five
 * hours apart in January can be four in July, and a fixed offset would
 * be quietly wrong for half the year.
 */

import {
  formatInZone, offsetMinutes, describeInZone, isValidZone,
  zoneAbbreviation, localZone, COMMON_ZONES,
} from '@/utils/eventTimezone'

/* 2026-01-15 12:00 UTC — winter in the northern hemisphere. */
const WINTER = Date.UTC(2026, 0, 15, 12, 0)
/* 2026-07-15 12:00 UTC — summer, when several zones have shifted. */
const SUMMER = Date.UTC(2026, 6, 15, 12, 0)

describe('isValidZone', () => {
  it('accepts real zones and rejects nonsense', () => {
    expect(isValidZone('Europe/Madrid')).toBe(true)
    expect(isValidZone('America/New_York')).toBe(true)
    expect(isValidZone('Not/AZone')).toBe(false)
    expect(isValidZone('')).toBe(false)
  })

  it('accepts every zone offered in the picker', () => {
    // A list the UI shows must not contain something the browser refuses.
    for (const z of COMMON_ZONES) expect(isValidZone(z.id)).toBe(true)
  })
})

describe('formatInZone', () => {
  it('reads the same instant differently in different zones', () => {
    const utc    = formatInZone(WINTER, 'UTC')
    const tokyo  = formatInZone(WINTER, 'Asia/Tokyo')
    expect(utc).not.toBe(tokyo)
  })

  it('falls back to a local reading for an unknown zone', () => {
    // An event tagged with a zone an older browser lacks must still be
    // legible rather than throwing inside a render.
    expect(() => formatInZone(WINTER, 'Mars/Olympus')).not.toThrow()
    expect(formatInZone(WINTER, 'Mars/Olympus')).toBeTruthy()
  })
})

describe('offsetMinutes', () => {
  it('is zero between a zone and itself', () => {
    expect(offsetMinutes(WINTER, 'UTC', 'UTC')).toBe(0)
  })

  it('reports whole-hour differences', () => {
    expect(offsetMinutes(WINTER, 'Asia/Tokyo', 'UTC')).toBe(540)      // +9
    expect(offsetMinutes(WINTER, 'America/New_York', 'UTC')).toBe(-300) // −5
  })

  it('handles a zone offset by half an hour', () => {
    // Fixed-hour arithmetic quietly loses these.
    expect(offsetMinutes(WINTER, 'Asia/Kolkata', 'UTC')).toBe(330)    // +5:30
  })

  it('changes across daylight saving rather than staying fixed', () => {
    // New York is −5 in January and −4 in July. A cached offset would be
    // wrong for half the year.
    expect(offsetMinutes(WINTER, 'America/New_York', 'UTC')).toBe(-300)
    expect(offsetMinutes(SUMMER, 'America/New_York', 'UTC')).toBe(-240)
  })

  it('handles zones that do not observe daylight saving', () => {
    expect(offsetMinutes(WINTER, 'Asia/Tokyo', 'UTC'))
      .toBe(offsetMinutes(SUMMER, 'Asia/Tokyo', 'UTC'))
  })

  it('never returns NaN for an unknown zone', () => {
    expect(Number.isFinite(offsetMinutes(WINTER, 'Nowhere/Real', 'UTC'))).toBe(true)
  })
})

describe('describeInZone', () => {
  it('says the time and how far off it is', () => {
    const s = describeInZone(WINTER, 'Asia/Tokyo', 'UTC')
    expect(s).toMatch(/9 hours ahead/)
  })

  it('says "behind" going the other way', () => {
    expect(describeInZone(WINTER, 'America/New_York', 'UTC')).toMatch(/5 hours behind/)
  })

  it('spells out a half-hour offset', () => {
    expect(describeInZone(WINTER, 'Asia/Kolkata', 'UTC')).toMatch(/5h 30m ahead/)
  })

  it('says nothing when the zone is the one you are already in', () => {
    // "Zero hours from where you are" is noise on every event.
    expect(describeInZone(WINTER, 'UTC', 'UTC')).toBeNull()
    expect(describeInZone(WINTER, '', 'UTC')).toBeNull()
  })

  it('says nothing for a zone the browser does not know', () => {
    expect(describeInZone(WINTER, 'Fake/Zone', 'UTC')).toBeNull()
  })

  it('uses singular for a one-hour difference', () => {
    const s = describeInZone(WINTER, 'Europe/Berlin', 'UTC')
    expect(s).toMatch(/1 hour ahead/)
    expect(s).not.toMatch(/1 hours/)
  })
})

describe('zoneAbbreviation', () => {
  it('gives a short label for the zone at that instant', () => {
    expect(zoneAbbreviation(WINTER, 'UTC')).toBeTruthy()
    expect(zoneAbbreviation(WINTER, 'Bad/Zone')).toBe('Bad/Zone')
  })
})

describe('localZone', () => {
  it('returns something usable', () => {
    expect(isValidZone(localZone())).toBe(true)
  })
})
