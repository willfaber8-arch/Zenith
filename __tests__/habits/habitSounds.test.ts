/**
 * The pitch a habit tap plays.
 *
 * The audio itself is oscillators and cannot be asserted on, but the
 * numbers feeding them can — and they are what would break. A goal of
 * zero, a missing count, a habit tapped past its target: each one is a
 * division or a ramp that must not produce NaN, because an exception
 * inside a click handler would stop the habit being recorded.
 */

import {
  stepFrequency, progressFraction, isHabitSoundEnabled, setHabitSoundEnabled,
  STEP_BASE_HZ, STEP_RANGE_HZ, CHIME_HZ,
} from '@/lib/habitSounds'

describe('progressFraction', () => {
  it('reports how far through the goal a count is', () => {
    expect(progressFraction(0,  8)).toBe(0)
    expect(progressFraction(4,  8)).toBe(0.5)
    expect(progressFraction(8,  8)).toBe(1)
  })

  it('clamps a habit tapped past its goal', () => {
    // Tapping past the target should hold the top note, not climb away.
    expect(progressFraction(40, 8)).toBe(1)
  })

  it('treats a goal of zero as complete rather than dividing by it', () => {
    expect(progressFraction(0, 0)).toBe(1)
    expect(Number.isFinite(progressFraction(3, 0))).toBe(true)
  })

  it('survives nonsense without producing NaN', () => {
    for (const [c, t] of [[NaN, 8], [3, NaN], [Infinity, 8], [-5, 8]] as const) {
      const p = progressFraction(c, t)
      expect(Number.isFinite(p)).toBe(true)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })
})

describe('stepFrequency', () => {
  it('rises with progress, so tapping toward a goal walks up a scale', () => {
    expect(stepFrequency(1)).toBeGreaterThan(stepFrequency(0.5))
    expect(stepFrequency(0.5)).toBeGreaterThan(stepFrequency(0))
  })

  it('spans exactly the intended range', () => {
    expect(stepFrequency(0)).toBe(STEP_BASE_HZ)
    expect(stepFrequency(1)).toBe(STEP_BASE_HZ + STEP_RANGE_HZ)
  })

  it('clamps outside 0–1 instead of running off', () => {
    expect(stepFrequency(-3)).toBe(STEP_BASE_HZ)
    expect(stepFrequency(99)).toBe(STEP_BASE_HZ + STEP_RANGE_HZ)
  })

  it('always returns an audible, finite pitch', () => {
    for (const p of [0, 0.3, 1, NaN, Infinity, -Infinity]) {
      const f = stepFrequency(p)
      expect(Number.isFinite(f)).toBe(true)
      expect(f).toBeGreaterThan(20)      // above the floor of hearing
      expect(f).toBeLessThan(20_000)     // below the ceiling
    }
  })

  it('stays below the chime, so completion resolves upward', () => {
    // The last step should sit under the bell, or finishing sounds flat.
    expect(stepFrequency(1)).toBeLessThan(Math.min(...CHIME_HZ))
  })
})

describe('the chime', () => {
  it('is a rising triad', () => {
    for (let i = 1; i < CHIME_HZ.length; i++) {
      expect(CHIME_HZ[i]).toBeGreaterThan(CHIME_HZ[i - 1])
    }
  })
})

describe('the preference', () => {
  beforeEach(() => localStorage.clear())

  it('is on until turned off', () => {
    expect(isHabitSoundEnabled()).toBe(true)
  })

  it('remembers being turned off, and back on', () => {
    setHabitSoundEnabled(false)
    expect(isHabitSoundEnabled()).toBe(false)
    setHabitSoundEnabled(true)
    expect(isHabitSoundEnabled()).toBe(true)
  })
})
