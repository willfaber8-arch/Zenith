/**
 * The feelings check-in, and editing a day after it has ended.
 *
 * The mood grid only asked about the school day (Busy, Focused, Drained).
 * The check-in asks how you actually feel — happy, sad, angry, anxious,
 * unfocused — and averages it. Half the questions are about feelings you
 * want more of and half about feelings you want less of, so the thing most
 * worth pinning down is that both point the same way before averaging:
 * "very sad" must never count as a good answer.
 */

import {
  EMOTION_QUESTIONS, EMOTION_PHASES, MAX_INTENSITY,
  wellbeingFor, scoreCheckin, averageCheckins, stressEnergyFromCheckin,
  overallLabel, NEEDS_WORK, MAX_FOCUS_AREAS,
  type EmotionAnswers,
} from '@/utils/emotionCheckin'
import { isLoggableDate, nearestMood, MOOD_MAP } from '@/utils/mentalHealthLog'

/** Every question answered with the best possible answer */
function best(): EmotionAnswers {
  return Object.fromEntries(EMOTION_QUESTIONS.map(q => [q.key, q.positive ? MAX_INTENSITY : 0]))
}
/** Every question answered with the worst possible answer */
function worst(): EmotionAnswers {
  return Object.fromEntries(EMOTION_QUESTIONS.map(q => [q.key, q.positive ? 0 : MAX_INTENSITY]))
}

describe('questionnaire shape', () => {
  it('asks about real feelings, not just school', () => {
    const keys = EMOTION_QUESTIONS.map(q => q.key)
    for (const k of ['happy', 'sad', 'angry', 'anxious', 'focused'] as const) expect(keys).toContain(k)
  })

  it('has several phases and no duplicate questions', () => {
    expect(EMOTION_PHASES.length).toBeGreaterThan(1)
    const keys = EMOTION_QUESTIONS.map(q => q.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('wellbeingFor', () => {
  it('scores positive feelings up and negative feelings down', () => {
    expect(wellbeingFor('happy', 4)).toBe(100)
    expect(wellbeingFor('happy', 0)).toBe(0)
    expect(wellbeingFor('sad', 0)).toBe(100)
    expect(wellbeingFor('sad', 4)).toBe(0)
    expect(wellbeingFor('angry', 2)).toBe(50)
  })

  it('clamps out-of-range intensities', () => {
    expect(wellbeingFor('happy', 9)).toBe(100)
    expect(wellbeingFor('sad', -3)).toBe(100)
  })
})

describe('scoreCheckin', () => {
  it('averages to 100 for the best answers and 0 for the worst', () => {
    expect(scoreCheckin(best()).overall).toBe(100)
    expect(scoreCheckin(worst()).overall).toBe(0)
  })

  it('returns null overall with nothing answered', () => {
    expect(scoreCheckin({}).overall).toBeNull()
    expect(scoreCheckin(undefined).overall).toBeNull()
  })

  it('averages only the questions answered', () => {
    const r = scoreCheckin({ happy: 4, sad: 4 })
    expect(r.areas).toHaveLength(2)
    expect(r.overall).toBe(50)
  })

  it('ignores garbage values instead of counting them as zero', () => {
    const r = scoreCheckin({ happy: 4, sad: NaN as number, angry: 'x' as unknown as number })
    expect(r.areas.map(a => a.key)).toEqual(['happy'])
    expect(r.overall).toBe(100)
  })

  it('names the lowest areas, worst first, capped', () => {
    const a = best()
    a.sad = 4        // 0
    a.anxious = 3    // 25
    a.focused = 1    // 25
    a.lonely = 3     // 25
    a.energy = 2     // 50 — not below NEEDS_WORK
    const r = scoreCheckin(a)
    expect(r.focusAreas.length).toBe(MAX_FOCUS_AREAS)
    expect(r.focusAreas[0].key).toBe('sad')
    expect(r.focusAreas.every(f => f.wellbeing < NEEDS_WORK)).toBe(true)
    expect(r.focusAreas.map(f => f.key)).not.toContain('energy')
    // Ties keep questionnaire order, so the same answers always give the same list.
    expect(r.focusAreas.map(f => f.key)).toEqual(['sad', 'anxious', 'focused'])
  })

  it('has no focus areas on a good day, and lists strengths', () => {
    const r = scoreCheckin(best())
    expect(r.focusAreas).toEqual([])
    expect(r.strengths.length).toBe(EMOTION_QUESTIONS.length)
  })
})

describe('averageCheckins', () => {
  it('averages across days and skips days without a check-in', () => {
    const t = averageCheckins([{ emotions: best() }, { emotions: worst() }, {}])
    expect(t.days).toBe(2)
    expect(t.overall).toBe(50)
  })

  it('lists areas lowest first', () => {
    const low = { ...best(), sad: 4 }
    const t = averageCheckins([{ emotions: low }, { emotions: low }])
    expect(t.areas[0].key).toBe('sad')
    expect(t.areas[0].wellbeing).toBe(0)
  })

  it('averages an area only over days that answered it', () => {
    const t = averageCheckins([{ emotions: { happy: 4 } }, { emotions: { sad: 0 } }])
    expect(t.areas.find(a => a.key === 'happy')!.wellbeing).toBe(100)
    expect(t.areas.find(a => a.key === 'sad')!.wellbeing).toBe(100)
  })
})

describe('stress and energy for a check-in-only day', () => {
  it('maps a bad day to high stress, low energy — and a burnout-looking mood', () => {
    const { stressLevel, energyLevel } = stressEnergyFromCheckin(worst())
    expect(stressLevel).toBe(10)
    expect(energyLevel).toBe(1)
    expect(nearestMood(stressLevel, energyLevel).key).toBe('drained')
  })

  it('maps a good day to low stress, high energy', () => {
    const { stressLevel, energyLevel } = stressEnergyFromCheckin(best())
    expect(stressLevel).toBe(1)
    expect(energyLevel).toBe(10)
    expect(['thriving', 'energized']).toContain(nearestMood(stressLevel, energyLevel).key)
  })

  it('falls back to the middle when nothing relevant was answered', () => {
    expect(stressEnergyFromCheckin({})).toEqual({ stressLevel: 5, energyLevel: 5 })
  })

  it('always produces a mood the rest of the page can show', () => {
    for (let s = 1; s <= 10; s++) for (let e = 1; e <= 10; e++) {
      expect(MOOD_MAP[nearestMood(s, e).key]).toBeDefined()
    }
  })
})

describe('overallLabel', () => {
  it('puts words to every score', () => {
    for (const v of [0, 19, 20, 40, 60, 80, 100]) expect(overallLabel(v).length).toBeGreaterThan(0)
    expect(overallLabel(90)).toBe('Doing well')
    expect(overallLabel(5)).toBe('Having a hard time')
  })
})

describe('isLoggableDate — past days stay editable after midnight', () => {
  const today = '2026-10-20'
  it('accepts today, yesterday and any earlier day', () => {
    expect(isLoggableDate('2026-10-20', today)).toBe(true)
    expect(isLoggableDate('2026-10-19', today)).toBe(true)
    expect(isLoggableDate('2025-01-01', today)).toBe(true)
  })
  it('refuses the future and malformed dates', () => {
    expect(isLoggableDate('2026-10-21', today)).toBe(false)
    expect(isLoggableDate('', today)).toBe(false)
    expect(isLoggableDate('yesterday', today)).toBe(false)
  })
})
