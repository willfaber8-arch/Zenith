/**
 * utils/emotionCheckin.ts — the daily check-in: five sliders, and what they add up to
 *
 * Pure module — zero React, zero Dexie imports.
 *
 * Five questions on one screen, each a 1–10 slider: mood, stress, energy,
 * focus and connection. From those it works out three things:
 *
 *   1. Category scores — each answer as a 0–100 score with a word for it,
 *      and one overall wellbeing number.
 *   2. Your usual — today against your own 7- and 30-day averages, so
 *      "stress 70" reads as "18 above your usual" rather than as a number
 *      with nothing to compare it to.
 *   3. Links — how you tend to feel on days you worked out, focused, kept
 *      your habits, read, or had a pile of tasks due, from data Zenith
 *      already has. Days are compared, nothing is guessed: a link needs
 *      enough days on both sides before it is shown at all.
 *
 * Stress is the one question where more is worse. It is *shown* as a
 * stress score (high = stressed, because that is what the question asked)
 * but counted into wellbeing inverted, so a calm day lifts the overall
 * score and a stressed one lowers it.
 */

import { addDaysISO, toLocalDateStr } from '@/utils/localDate'
import { isHabitScheduledOn } from '@/utils/habitSchedule'
import type { Habit, HabitCompletion } from '@/lib/db'

/* ════════════════════════════════════════════════════════════════
   QUESTIONS
   ════════════════════════════════════════════════════════════════ */

export type CheckinKey = 'mood' | 'stress' | 'energy' | 'focus' | 'connection'

/** Answers as stored on the log row — 1–10 per slider. */
export type CheckinAnswers = Partial<Record<CheckinKey, number>>

export interface CheckinQuestion {
  key:      CheckinKey
  /** Category name shown in results */
  label:    string
  prompt:   string
  /** Slider end labels */
  low:      string
  high:     string
  /** true when a higher answer is better; stress is the exception */
  positive: boolean
}

export const MIN_ANSWER = 1
export const MAX_ANSWER = 10
export const DEFAULT_ANSWER = 5

export const CHECKIN_QUESTIONS: CheckinQuestion[] = [
  { key: 'mood',       label: 'Mood',       prompt: 'How is your mood?',                      low: 'Very low',  high: 'Great',         positive: true  },
  { key: 'stress',     label: 'Stress',     prompt: 'How stressed or anxious do you feel?',   low: 'Calm',      high: 'Very stressed', positive: false },
  { key: 'energy',     label: 'Energy',     prompt: 'How much energy do you have?',           low: 'Drained',   high: 'Full',          positive: true  },
  { key: 'focus',      label: 'Focus',      prompt: 'How focused and clear-headed are you?',  low: 'Scattered', high: 'Sharp',         positive: true  },
  { key: 'connection', label: 'Connection', prompt: 'How connected do you feel to people?',   low: 'Alone',     high: 'Close',         positive: true  },
]

export const CHECKIN_KEYS: CheckinKey[] = CHECKIN_QUESTIONS.map(q => q.key)

const QUESTION: Record<CheckinKey, CheckinQuestion> = Object.fromEntries(
  CHECKIN_QUESTIONS.map(q => [q.key, q]),
) as Record<CheckinKey, CheckinQuestion>

/** A stored answer we can trust — a finite 1–10, else null. */
export function cleanAnswer(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(MAX_ANSWER, Math.max(MIN_ANSWER, Math.round(v)))
}

/** Only the keys we know, with values we trust. */
export function cleanAnswers(raw: unknown): CheckinAnswers {
  const out: CheckinAnswers = {}
  if (!raw || typeof raw !== 'object') return out
  for (const k of CHECKIN_KEYS) {
    const v = cleanAnswer((raw as Record<string, unknown>)[k])
    if (v != null) out[k] = v
  }
  return out
}

/* ════════════════════════════════════════════════════════════════
   FROM A LOG ROW
   ════════════════════════════════════════════════════════════════ */

/** The shape of a log this module reads — a subset of MentalHealthLog. */
export interface CheckinSource {
  logDate:      string
  stressLevel?: number
  energyLevel?: number
  checkin?:     CheckinAnswers
  /** The earlier twelve-question check-in: intensity 0–4 per feeling. */
  emotions?:    Record<string, number>
}

/** 0–4 intensity → 1–10, so old answers sit on the same scale. */
function fromIntensity(v: unknown, invert = false): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const x = Math.min(4, Math.max(0, v))
  return Math.round(1 + ((invert ? 4 - x : x) / 4) * 9)
}

function meanOf(vals: Array<number | null>): number | null {
  const ok = vals.filter((v): v is number => v != null)
  return ok.length ? Math.round(ok.reduce((s, v) => s + v, 0) / ok.length) : null
}

/**
 * What a day's log says on each slider.
 *
 * A check-in made with the sliders is read as it is. Older days still
 * count rather than vanishing from your history:
 *   · a day from the twelve-question check-in maps its feelings onto the
 *     five categories (sad counts against mood, lonely against connection);
 *   · a day with only a mood picked still has the stress and energy that
 *     mood carried, which are real 1–10 readings.
 * Nothing is written back — the row stays exactly as it was saved.
 */
export function answersFromLog(log: CheckinSource): CheckinAnswers {
  const direct = cleanAnswers(log.checkin)
  if (Object.keys(direct).length > 0) return direct

  const e = log.emotions
  if (e && typeof e === 'object' && Object.keys(e).length > 0) {
    return cleanAnswers({
      mood:       meanOf([fromIntensity(e.happy), fromIntensity(e.sad, true)]),
      stress:     meanOf([fromIntensity(e.anxious), fromIntensity(e.overwhelmed), fromIntensity(e.angry)]),
      energy:     meanOf([fromIntensity(e.energy), fromIntensity(e.rested)]),
      focus:      fromIntensity(e.focused),
      connection: meanOf([fromIntensity(e.connected), fromIntensity(e.lonely, true)]),
    })
  }

  return cleanAnswers({ stress: log.stressLevel, energy: log.energyLevel })
}

/** True when the day was answered with the sliders, not inferred. */
export function hasFullCheckin(log: CheckinSource): boolean {
  return Object.keys(cleanAnswers(log.checkin)).length > 0
}

/* ════════════════════════════════════════════════════════════════
   CATEGORY SCORES
   ════════════════════════════════════════════════════════════════ */

/** 1–10 → 0–100 on the slider's own direction. */
export function toScore(v: number): number {
  const c = cleanAnswer(v) ?? DEFAULT_ANSWER
  return Math.round(((c - MIN_ANSWER) / (MAX_ANSWER - MIN_ANSWER)) * 100)
}

/** 0–100 where higher is always better (stress inverted). */
export function wellbeingOf(key: CheckinKey, v: number): number {
  const s = toScore(v)
  return QUESTION[key].positive ? s : 100 - s
}

export type Tone = 'good' | 'ok' | 'low' | 'bad'

export function toneOf(wellbeing: number): Tone {
  if (wellbeing >= 75) return 'good'
  if (wellbeing >= 50) return 'ok'
  if (wellbeing >= 25) return 'low'
  return 'bad'
}

/** The word beside a score, in the category's own terms. */
export function bandLabel(key: CheckinKey, score: number): string {
  if (key === 'stress') {
    if (score >= 75) return 'High'
    if (score >= 50) return 'Elevated'
    if (score >= 25) return 'Moderate'
    return 'Low'
  }
  if (score >= 75) return 'Good'
  if (score >= 50) return 'Okay'
  if (score >= 25) return 'Low'
  return 'Very low'
}

export interface CategoryScore {
  key:       CheckinKey
  label:     string
  /** 0–100 as the question reads it (stress: high = stressed) */
  score:     number
  /** 0–100, higher always better */
  wellbeing: number
  band:      string
  tone:      Tone
}

export function categoryScores(answers: CheckinAnswers): CategoryScore[] {
  const out: CategoryScore[] = []
  for (const q of CHECKIN_QUESTIONS) {
    const v = cleanAnswer(answers[q.key])
    if (v == null) continue
    const score = toScore(v)
    const wellbeing = wellbeingOf(q.key, v)
    out.push({ key: q.key, label: q.label, score, wellbeing, band: bandLabel(q.key, score), tone: toneOf(wellbeing) })
  }
  return out
}

/**
 * One wellbeing number for the day, or null when too little was answered
 * to stand for the whole day. A mood-only day from before the sliders has
 * just stress and energy — enough for those two trends, not for an overall.
 */
export const MIN_FOR_OVERALL = 3

export function overallScore(answers: CheckinAnswers): number | null {
  const cats = categoryScores(answers)
  if (cats.length < MIN_FOR_OVERALL) return null
  return Math.round(cats.reduce((s, c) => s + c.wellbeing, 0) / cats.length)
}

export function overallLabel(score: number): string {
  if (score >= 80) return 'Doing well'
  if (score >= 60) return 'Mostly okay'
  if (score >= 40) return 'Mixed'
  if (score >= 20) return 'Struggling'
  return 'Having a hard time'
}

/* ════════════════════════════════════════════════════════════════
   COMPARED WITH YOUR USUAL
   ════════════════════════════════════════════════════════════════ */

/** Fewer days than this and an average is not "your usual" yet. */
export const MIN_DAYS_FOR_USUAL = 3
/** A difference smaller than this is noise, not news. */
export const NOTABLE_POINTS = 10

export interface UsualComparison {
  key:      CheckinKey
  label:    string
  /** Today's score, as shown (stress: high = stressed) */
  today:    number
  avg7:     number | null
  avg30:    number | null
  /** today − the baseline used, in shown points; null without a baseline */
  delta:    number | null
  /** Which average the delta is against */
  basis:    '30-day' | '7-day' | null
  /** delta pointing the good way (less stress, more of the rest) */
  better:   boolean | null
  notable:  boolean
}

function avg(vals: number[]): number | null {
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
}

/**
 * Each category today against the days before it. Only days *before*
 * `date` count — today is what is being compared, not part of the norm.
 */
export function compareToUsual(
  date: string,
  answers: CheckinAnswers,
  history: CheckinSource[],
): UsualComparison[] {
  const from7  = addDaysISO(date, -7)
  const from30 = addDaysISO(date, -30)
  const prior  = history.filter(l => l.logDate < date && l.logDate >= from30)

  return categoryScores(answers).map(c => {
    const s7: number[] = [], s30: number[] = []
    for (const l of prior) {
      const v = cleanAnswer(answersFromLog(l)[c.key])
      if (v == null) continue
      s30.push(toScore(v))
      if (l.logDate >= from7) s7.push(toScore(v))
    }
    const avg7  = s7.length  >= MIN_DAYS_FOR_USUAL ? avg(s7)  : null
    const avg30 = s30.length >= MIN_DAYS_FOR_USUAL ? avg(s30) : null
    const base  = avg30 ?? avg7
    const delta = base == null ? null : c.score - base
    const positive = QUESTION[c.key].positive
    return {
      key: c.key, label: c.label, today: c.score, avg7, avg30, delta,
      basis: avg30 != null ? '30-day' : avg7 != null ? '7-day' : null,
      better: delta == null || delta === 0 ? null : (delta > 0) === positive,
      notable: delta != null && Math.abs(delta) >= NOTABLE_POINTS,
    }
  })
}

/** "18 above your usual" / "about your usual" — for a comparison chip. */
export function describeDelta(c: UsualComparison): string | null {
  if (c.delta == null) return null
  if (!c.notable) return 'About your usual'
  return `${Math.abs(c.delta)} ${c.delta > 0 ? 'above' : 'below'} your usual`
}

/** Overall wellbeing per day for the chart, oldest first. */
export function wellbeingSeries(
  history: CheckinSource[],
  endDate: string,
  days = 30,
): Array<{ date: string; value: number }> {
  const from = addDaysISO(endDate, -(days - 1))
  return history
    .filter(l => l.logDate >= from && l.logDate <= endDate)
    .map(l => ({ date: l.logDate, value: overallScore(answersFromLog(l)) }))
    .filter((p): p is { date: string; value: number } => p.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ════════════════════════════════════════════════════════════════
   LINKS TO YOUR OTHER DATA
   ════════════════════════════════════════════════════════════════ */

export type FactorId = 'workout' | 'focus' | 'habits' | 'reading' | 'busy'

export interface Factor {
  id:    FactorId
  /** Lead-in for the sentence: "On days you work out" */
  when:  string
}

export const FACTORS: Factor[] = [
  { id: 'workout', when: 'On days you work out' },
  { id: 'focus',   when: 'On days you do a focus session' },
  { id: 'habits',  when: 'On days you keep most of your habits' },
  { id: 'reading', when: 'On days you read' },
  { id: 'busy',    when: 'On days with 3+ tasks due' },
]

/** Each factor's days, as ISO dates. Built by the hook from the database. */
export type FactorDays = Partial<Record<FactorId, ReadonlySet<string>>>

/** Both sides need at least this many check-in days before a link shows. */
export const MIN_DAYS_PER_SIDE = 3
/** Differences smaller than this are not called a link. */
export const MIN_LINK_POINTS = 8
export const MAX_LINKS = 3

export interface Link {
  factor:  FactorId
  metric:  CheckinKey | 'overall'
  /** Points, in the metric's shown direction (stress: high = stressed) */
  diff:    number
  /** True when the factor's days are the better ones */
  better:  boolean
  withDays:    number
  withoutDays: number
  sentence: string
}

const METRIC_NAME: Record<CheckinKey | 'overall', string> = {
  overall: 'overall wellbeing', mood: 'mood', stress: 'stress',
  energy: 'energy', focus: 'focus', connection: 'sense of connection',
}

/**
 * How you feel on days a thing happened, against days it did not.
 *
 * For each factor, every metric is compared — overall and each category —
 * and the one that differs most is reported, so a workout that mostly
 * moves your energy says so rather than being averaged away into
 * "overall". Days are counted only where there is a check-in: a day you
 * did not check in tells us nothing about how you felt on it.
 *
 * It says "on days you X, Y averages N higher" and no more. That is what
 * the numbers show; whether the one causes the other they cannot say.
 */
export function findLinks(
  history: CheckinSource[],
  factorDays: FactorDays,
  opts: { from?: string; to?: string } = {},
): Link[] {
  const days = history
    .filter(l => (!opts.from || l.logDate >= opts.from) && (!opts.to || l.logDate <= opts.to))
    .map(l => {
      const a = answersFromLog(l)
      const scores: Partial<Record<CheckinKey | 'overall', number>> = {}
      for (const c of categoryScores(a)) scores[c.key] = c.score
      const o = overallScore(a)
      if (o != null) scores.overall = o
      return { date: l.logDate, scores }
    })

  const links: Link[] = []
  for (const f of FACTORS) {
    const set = factorDays[f.id]
    if (!set) continue
    let best: Link | null = null
    for (const metric of ['overall', ...CHECKIN_KEYS] as Array<CheckinKey | 'overall'>) {
      const yes: number[] = [], no: number[] = []
      for (const d of days) {
        const v = d.scores[metric]
        if (v == null) continue
        ;(set.has(d.date) ? yes : no).push(v)
      }
      if (yes.length < MIN_DAYS_PER_SIDE || no.length < MIN_DAYS_PER_SIDE) continue
      const diff = Math.round(avg(yes)! - avg(no)!)
      if (Math.abs(diff) < MIN_LINK_POINTS) continue
      if (best && Math.abs(diff) <= Math.abs(best.diff)) continue
      const positive = metric === 'overall' || QUESTION[metric].positive
      best = {
        factor: f.id, metric, diff,
        better: (diff > 0) === positive,
        withDays: yes.length, withoutDays: no.length,
        sentence: `${f.when}, your ${METRIC_NAME[metric]} averages ${Math.abs(diff)} points ${diff > 0 ? 'higher' : 'lower'}.`,
      }
    }
    if (best) links.push(best)
  }
  return links.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, MAX_LINKS)
}

/* ════════════════════════════════════════════════════════════════
   BUILDING FACTOR DAYS
   ════════════════════════════════════════════════════════════════ */

export interface FactorInputs {
  workoutDates:   Iterable<string>
  focusDates:     Iterable<string>
  readingDates:   Iterable<string>
  /** ISO due date (or a longer string starting with one) per open or done task */
  taskDueDates:   Iterable<string>
  /** For each day: habits scheduled that day, and how many were finished */
  habitDays:      Iterable<{ date: string; scheduled: number; done: number }>
}

/** Share of the day's scheduled habits that counts as "most". */
export const MOST_HABITS = 0.75
export const BUSY_TASKS = 3

export function buildFactorDays(i: FactorInputs): FactorDays {
  const due = new Map<string, number>()
  for (const d of i.taskDueDates) {
    const day = d.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) due.set(day, (due.get(day) ?? 0) + 1)
  }
  const habits = new Set<string>()
  for (const h of i.habitDays) {
    if (h.scheduled > 0 && h.done / h.scheduled >= MOST_HABITS) habits.add(h.date)
  }
  return {
    workout: new Set(i.workoutDates),
    focus:   new Set(i.focusDates),
    reading: new Set(i.readingDates),
    busy:    new Set([...due].filter(([, n]) => n >= BUSY_TASKS).map(([d]) => d)),
    habits,
  }
}

/**
 * For each day from `from` to `to`: how many habits were due, and how many
 * were kept. Due follows the same schedule the Habits page uses (skipped
 * days are not due, rule 94), and a habit only counts from the day it was
 * made. "Kept" is reaching the goal — or, for a stay-under habit, staying
 * at or under it.
 */
export function habitDayStats(
  habits: Habit[],
  completions: HabitCompletion[],
  from: string,
  to: string,
): Array<{ date: string; scheduled: number; done: number }> {
  const counts = new Map<string, number>()
  for (const c of completions) counts.set(`${c.habitId}|${c.date}`, c.count)
  const out: Array<{ date: string; scheduled: number; done: number }> = []
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    let scheduled = 0, done = 0
    for (const h of habits) {
      if (toLocalDateStr(new Date(h.createdAt)) > d) continue
      if (!isHabitScheduledOn(h, d)) continue
      scheduled++
      const n = counts.get(`${h.id}|${d}`) ?? 0
      if (h.goalType === 'at_most' ? n <= h.targetCompletions : n >= h.targetCompletions) done++
    }
    out.push({ date: d, scheduled, done })
  }
  return out
}
