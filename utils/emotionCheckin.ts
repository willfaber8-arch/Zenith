/**
 * utils/emotionCheckin.ts — Emotion check-in questionnaire & scorer
 *
 * Pure module — zero React, zero Dexie imports.
 *
 * The mood grid answers "how is the day going" in one tap, and its eight
 * options lean on school and workload (Busy, Focused, Drained). This is the
 * other half: how you actually feel — happy, sad, angry, anxious, unfocused —
 * asked a few at a time, then averaged into one wellbeing score with the
 * lowest areas called out.
 *
 * Every answer is an intensity 0–4 ("Not at all" … "Extremely"). Half the
 * questions are about feelings you want more of and half about feelings you
 * want less of, so each is turned into a wellbeing value 0–100 that points
 * the same way before anything is averaged: a 4 on "happy" and a 0 on "sad"
 * are both 100.
 */

/* ════════════════════════════════════════════════════════════════
   QUESTIONS
   ════════════════════════════════════════════════════════════════ */

export type EmotionKey =
  | 'happy' | 'sad' | 'angry'
  | 'anxious' | 'overwhelmed' | 'focused'
  | 'energy' | 'rested' | 'calm'
  | 'motivated' | 'connected' | 'lonely'

/** Answers as stored on the log row — intensity 0–4 per emotion asked. */
export type EmotionAnswers = Partial<Record<EmotionKey, number>>

export interface EmotionQuestion {
  key:      EmotionKey
  /** Short name used in results ("Sadness", "Focus") */
  label:    string
  /** The question as asked */
  prompt:   string
  /** true when more of it is better (happy); false when less is (sad) */
  positive: boolean
  /** Shown when this area comes out among the lowest */
  tip:      string
}

export interface EmotionPhase {
  id:       string
  title:    string
  subtitle: string
  questions: EmotionQuestion[]
}

export const INTENSITY_LABELS = ['Not at all', 'A little', 'Somewhat', 'Very', 'Extremely'] as const
export const MAX_INTENSITY = INTENSITY_LABELS.length - 1

export const EMOTION_PHASES: EmotionPhase[] = [
  {
    id: 'mood', title: 'Mood', subtitle: 'How you feel right now',
    questions: [
      { key: 'happy', label: 'Happiness', positive: true,
        prompt: 'How happy or content do you feel?',
        tip: 'Plan one small thing to look forward to today — a walk, a song, a call with someone you like.' },
      { key: 'sad', label: 'Sadness', positive: false,
        prompt: 'How sad or down do you feel?',
        tip: 'Low days pass faster when they are shared. Tell someone you trust how you are doing, even briefly.' },
      { key: 'angry', label: 'Anger', positive: false,
        prompt: 'How angry, irritated or frustrated do you feel?',
        tip: 'Name what is frustrating you in the journal, then step away from it for ten minutes before deciding anything.' },
    ],
  },
  {
    id: 'mind', title: 'Mind', subtitle: 'Your head space',
    questions: [
      { key: 'anxious', label: 'Anxiety', positive: false,
        prompt: 'How anxious or worried do you feel?',
        tip: 'Try slow breathing — in for 4, hold for 4, out for 6 — and write the worry down so it is out of your head.' },
      { key: 'overwhelmed', label: 'Overwhelm', positive: false,
        prompt: 'How overwhelmed do you feel by everything on your plate?',
        tip: 'Pick the single next step on the biggest thing and do only that. Everything else can wait in your task list.' },
      { key: 'focused', label: 'Focus', positive: true,
        prompt: 'How focused and clear-headed do you feel?',
        tip: 'Unfocused days respond well to short blocks — one 25-minute Pomodoro with your phone in another room.' },
    ],
  },
  {
    id: 'body', title: 'Body', subtitle: 'Energy and rest',
    questions: [
      { key: 'energy', label: 'Energy', positive: true,
        prompt: 'How much energy do you have?',
        tip: 'Get outside or move for 10 minutes, drink some water, and eat something real before pushing on.' },
      { key: 'rested', label: 'Rest', positive: true,
        prompt: 'How well rested do you feel?',
        tip: 'Protect tonight: a fixed bedtime and screens away 30 minutes before it do more than catching up later.' },
      { key: 'calm', label: 'Calm', positive: true,
        prompt: 'How calm and relaxed does your body feel?',
        tip: 'Notice where you are holding tension — jaw, shoulders, hands — and let it go. A warm shower or stretch helps.' },
    ],
  },
  {
    id: 'drive', title: 'Drive & connection', subtitle: 'Motivation and people',
    questions: [
      { key: 'motivated', label: 'Motivation', positive: true,
        prompt: 'How motivated do you feel to get things done?',
        tip: 'Motivation tends to follow action, not the other way round. Start with something that takes under five minutes.' },
      { key: 'connected', label: 'Connection', positive: true,
        prompt: 'How connected do you feel to the people around you?',
        tip: 'Reach out to one person today — a message is enough. Connection is built in small, regular moments.' },
      { key: 'lonely', label: 'Loneliness', positive: false,
        prompt: 'How lonely or isolated do you feel?',
        tip: 'Spend some time around other people today, even quietly — a library, a café, a class you would normally skip.' },
    ],
  },
]

export const EMOTION_QUESTIONS: EmotionQuestion[] = EMOTION_PHASES.flatMap(p => p.questions)

export const EMOTION_MAP: Record<EmotionKey, EmotionQuestion> = Object.fromEntries(
  EMOTION_QUESTIONS.map(q => [q.key, q]),
) as Record<EmotionKey, EmotionQuestion>

/* ════════════════════════════════════════════════════════════════
   SCORING
   ════════════════════════════════════════════════════════════════ */

/** A stored answer we can trust — a finite 0–4 intensity, rounded. */
function cleanAnswer(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(MAX_INTENSITY, Math.max(0, Math.round(v)))
}

/** Turns one intensity into wellbeing 0–100, where higher is always better. */
export function wellbeingFor(key: EmotionKey, intensity: number): number {
  const q = EMOTION_MAP[key]
  const v = cleanAnswer(intensity) ?? 0
  const share = q.positive ? v / MAX_INTENSITY : (MAX_INTENSITY - v) / MAX_INTENSITY
  return Math.round(share * 100)
}

export interface EmotionAreaScore {
  key:       EmotionKey
  label:     string
  /** 0–100, higher is better */
  wellbeing: number
  tip:       string
}

export interface CheckinResult {
  /** Mean wellbeing over the questions answered, 0–100; null when none were */
  overall:     number | null
  /** One entry per answered question, in questionnaire order */
  areas:       EmotionAreaScore[]
  /** Lowest areas below NEEDS_WORK, worst first, at most MAX_FOCUS_AREAS */
  focusAreas:  EmotionAreaScore[]
  /** Areas at or above STRENGTH, best first */
  strengths:   EmotionAreaScore[]
}

/** An area scoring under this is worth working on. */
export const NEEDS_WORK = 50
/** An area scoring at or above this is going well. */
export const STRENGTH = 75
export const MAX_FOCUS_AREAS = 3

export function scoreCheckin(answers: EmotionAnswers | undefined | null): CheckinResult {
  const areas: EmotionAreaScore[] = []
  for (const q of EMOTION_QUESTIONS) {
    const v = cleanAnswer(answers?.[q.key])
    if (v == null) continue
    areas.push({ key: q.key, label: q.label, wellbeing: wellbeingFor(q.key, v), tip: q.tip })
  }

  const overall = areas.length
    ? Math.round(areas.reduce((s, a) => s + a.wellbeing, 0) / areas.length)
    : null

  // Stable sort keeps questionnaire order between ties, so the same answers
  // always surface the same focus areas.
  const focusAreas = areas
    .filter(a => a.wellbeing < NEEDS_WORK)
    .sort((a, b) => a.wellbeing - b.wellbeing)
    .slice(0, MAX_FOCUS_AREAS)

  const strengths = areas
    .filter(a => a.wellbeing >= STRENGTH)
    .sort((a, b) => b.wellbeing - a.wellbeing)

  return { overall, areas, focusAreas, strengths }
}

/** Words for an overall score, so a number is never shown on its own. */
export function overallLabel(score: number): string {
  if (score >= 80) return 'Doing well'
  if (score >= 60) return 'Mostly okay'
  if (score >= 40) return 'Mixed'
  if (score >= 20) return 'Struggling'
  return 'Having a hard time'
}

/* ════════════════════════════════════════════════════════════════
   AVERAGES ACROSS DAYS
   ════════════════════════════════════════════════════════════════ */

export interface CheckinTrend {
  /** Days in the window that have a check-in */
  days:     number
  /** Mean of each day's overall score; null with no check-ins */
  overall:  number | null
  /** Per-area mean wellbeing over the days that answered it, lowest first */
  areas:    EmotionAreaScore[]
}

/**
 * Averages check-ins across days — what is low *usually*, not just today.
 * Each day counts once; an area is averaged only over days that answered it.
 */
export function averageCheckins(
  days: Array<{ emotions?: EmotionAnswers }>,
): CheckinTrend {
  const scored = days
    .map(d => scoreCheckin(d.emotions))
    .filter(r => r.overall != null)

  const sums = new Map<EmotionKey, { total: number; n: number }>()
  for (const r of scored) {
    for (const a of r.areas) {
      const s = sums.get(a.key) ?? { total: 0, n: 0 }
      s.total += a.wellbeing; s.n += 1
      sums.set(a.key, s)
    }
  }

  const areas: EmotionAreaScore[] = EMOTION_QUESTIONS
    .filter(q => sums.has(q.key))
    .map(q => {
      const s = sums.get(q.key)!
      return { key: q.key, label: q.label, wellbeing: Math.round(s.total / s.n), tip: q.tip }
    })
    .sort((a, b) => a.wellbeing - b.wellbeing)

  return {
    days:    scored.length,
    overall: scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.overall ?? 0), 0) / scored.length)
      : null,
    areas,
  }
}

/* ════════════════════════════════════════════════════════════════
   STRESS / ENERGY FROM A CHECK-IN
   ════════════════════════════════════════════════════════════════ */

/**
 * Stress and energy (1–10) implied by a check-in, for a day that has a
 * check-in but no mood picked. Every other reader of the log — the burnout
 * banner, the 3-day trend, the calendar colour, the Co-Pilot's averages —
 * works on these two numbers, so a check-in-only day has to supply them.
 */
export function stressEnergyFromCheckin(answers: EmotionAnswers): { stressLevel: number; energyLevel: number } {
  const mean = (keys: EmotionKey[], invert: EmotionKey[] = []): number | null => {
    const vals: number[] = []
    for (const k of keys) { const v = cleanAnswer(answers[k]); if (v != null) vals.push(v) }
    for (const k of invert) { const v = cleanAnswer(answers[k]); if (v != null) vals.push(MAX_INTENSITY - v) }
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  const toTen = (v: number | null) => v == null ? 5 : Math.min(10, Math.max(1, Math.round(1 + (v / MAX_INTENSITY) * 9)))
  return {
    stressLevel: toTen(mean(['anxious', 'overwhelmed', 'angry'], ['calm'])),
    energyLevel: toTen(mean(['energy', 'rested', 'motivated'])),
  }
}
