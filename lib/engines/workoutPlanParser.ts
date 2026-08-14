/**
 * lib/engines/workoutPlanParser.ts — turn a model's answer into sessions.
 *
 * Pure, and separated from the fetch on purpose. The network call is
 * trivial; the parsing is where this breaks, because a model asked for
 * JSON will sometimes wrap it in prose, sometimes in a fenced block,
 * sometimes both, and will cheerfully return "3-4" where a number was
 * asked for. All of that is testable without a provider or a key.
 *
 * The rule throughout: never invent a number that ends up under a
 * barbell. Anything missing or unparseable is dropped or defaulted to
 * something conservative and visible, never guessed at plausibly.
 */

import type {
  StrengthSession, PlannedExercise, WorkSet, MuscleGroup, WeightUnit,
} from '@/types/weightroom'
import { MUSCLE_GROUPS } from '@/types/weightroom'

/** Shape the model is asked to produce. */
export interface RawPlan {
  name?:    string
  days?:    RawDay[]
}
interface RawDay {
  title?:     string
  splitDay?:  string
  exercises?: RawExercise[]
}
interface RawExercise {
  name?:        string
  muscleGroup?: string
  sets?:        number | string
  reps?:        number | string
  cue?:         string
  restSeconds?: number | string
}

export interface ParsedPlan {
  name:     string
  sessions: Array<Omit<StrengthSession, 'id' | 'createdAt' | 'updatedAt' | 'scheduledFor'>>
  /** Anything dropped, so the UI can say so rather than silently thinning. */
  warnings: string[]
}

/* ── Extraction ────────────────────────────────────────────────────── */

/**
 * Pull a JSON object out of whatever the model actually sent.
 *
 * Handles a bare object, a ```json fence, and prose wrapped around
 * either. Scans for the outermost balanced braces rather than regexing,
 * because a nested object inside a greedy match is how this usually goes
 * wrong.
 */
export function extractJson(raw: string): unknown | null {
  if (!raw) return null

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  const body  = fence ? fence[1] : raw

  const start = body.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inStr = false
  let esc   = false
  for (let i = start; i < body.length; i++) {
    const c = body[i]
    if (inStr) {
      if (esc)            esc = false
      else if (c === '\\') esc = true
      else if (c === '"')  inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

/**
 * First whole number in a value.
 *
 * Models answer "3-4 sets" and "8-12" constantly. Taking the lower bound
 * is deliberate: it is the number you can definitely do, and a plan that
 * asks for slightly too little is recoverable in a way that one asking
 * for too much is not.
 */
export function firstInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(1, Math.round(v))
  if (typeof v === 'string') {
    const m = /\d+/.exec(v)
    if (m) return Math.max(1, parseInt(m[0], 10))
  }
  return fallback
}

function toMuscleGroup(v: unknown): MuscleGroup {
  const s = String(v ?? '').toLowerCase().trim()
  const hit = MUSCLE_GROUPS.find(g => g === s)
  if (hit) return hit
  // Common synonyms, because a model will say "legs" or "lats".
  if (/quad|leg/.test(s))          return 'quads'
  if (/ham/.test(s))               return 'hamstrings'
  if (/glute|butt/.test(s))        return 'glutes'
  if (/calf|calves/.test(s))       return 'calves'
  if (/lat|row|back/.test(s))      return 'back'
  if (/pec|chest|press/.test(s))   return 'chest'
  if (/delt|shoulder/.test(s))     return 'shoulders'
  if (/bicep|curl/.test(s))        return 'biceps'
  if (/tricep|extension/.test(s))  return 'triceps'
  if (/ab|core|plank/.test(s))     return 'core'
  return 'other'
}

/* Guards against a model that decides to write a training textbook. */
const MAX_SETS_PER_EXERCISE = 10
const MAX_EXERCISES_PER_DAY = 15
const MAX_DAYS              = 7

let seq = 0
/** Ids only have to be unique within a session, and must be stable in tests. */
function localId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

/** Reset between parses so ids stay predictable. */
export function _resetIdSeq(): void { seq = 0 }

/* ── Parsing ───────────────────────────────────────────────────────── */

export function parseWorkoutPlan(raw: string, unit: WeightUnit = 'kg'): ParsedPlan | null {
  const json = extractJson(raw)
  if (!json || typeof json !== 'object') return null

  const plan = json as RawPlan
  const warnings: string[] = []
  const days = Array.isArray(plan.days) ? plan.days.slice(0, MAX_DAYS) : []

  if (Array.isArray(plan.days) && plan.days.length > MAX_DAYS) {
    warnings.push(`Kept the first ${MAX_DAYS} days of ${plan.days.length}.`)
  }
  if (days.length === 0) return null

  const sessions: ParsedPlan['sessions'] = []

  for (const day of days) {
    const rawExercises = Array.isArray(day.exercises) ? day.exercises : []
    const exercises: PlannedExercise[] = []

    for (const ex of rawExercises.slice(0, MAX_EXERCISES_PER_DAY)) {
      const name = String(ex?.name ?? '').trim()
      // No name, no exercise. A blank row under a barbell helps nobody.
      if (!name) { warnings.push('Dropped an exercise with no name.'); continue }

      const setCount = Math.min(firstInt(ex.sets, 3), MAX_SETS_PER_EXERCISE)
      const reps     = firstInt(ex.reps, 8)
      const rest     = ex.restSeconds != null ? firstInt(ex.restSeconds, 90) : undefined

      const sets: WorkSet[] = Array.from({ length: setCount }, () => ({
        id: localId('set'),
        targetReps: reps,
        // Weight is deliberately absent. The model does not know what the
        // user can lift, and a number here would be a guess with a barbell
        // on the end of it.
        reps: null, weight: null, unit,
        completed: false,
        ...(rest ? { restSeconds: rest } : {}),
      }))

      exercises.push({
        id: localId('ex'),
        name,
        muscleGroup: toMuscleGroup(ex.muscleGroup),
        sets,
        ...(ex.cue ? { cue: String(ex.cue).slice(0, 200) } : {}),
      })
    }

    if (exercises.length === 0) {
      warnings.push(`Dropped "${day.title ?? day.splitDay ?? 'a day'}" — no usable exercises.`)
      continue
    }

    const splitDay = String(day.splitDay ?? day.title ?? 'Session').trim().slice(0, 40)
    sessions.push({
      title: String(day.title ?? splitDay).trim().slice(0, 60),
      splitDay,
      exercises,
    })
  }

  if (sessions.length === 0) return null

  return {
    name: String(plan.name ?? 'Training plan').trim().slice(0, 60) || 'Training plan',
    sessions,
    warnings,
  }
}

/* ── Prompt ────────────────────────────────────────────────────────── */

/**
 * What the model is asked for.
 *
 * Explicit about omitting weights. Left to itself a model will happily
 * prescribe "60kg bench press" to someone it has never met, and that
 * number would arrive in the UI looking exactly as authoritative as one
 * the user set themselves.
 */
export function buildPlanPrompt(opts: {
  brief: string
  daysPerWeek: number
  splits?: string[]
}): string {
  return [
    'Design a strength training plan. Reply with JSON only — no prose, no',
    'commentary, no markdown fence.',
    '',
    'Shape:',
    '{ "name": string,',
    '  "days": [ { "title": string, "splitDay": string,',
    '              "exercises": [ { "name": string, "muscleGroup": string,',
    '                               "sets": number, "reps": number,',
    '                               "restSeconds": number, "cue": string } ] } ] }',
    '',
    `Days per week: ${opts.daysPerWeek}.`,
    opts.splits?.length ? `Preferred split: ${opts.splits.join(', ')}.` : '',
    '',
    'Rules:',
    '- muscleGroup must be one of: ' + MUSCLE_GROUPS.join(', ') + '.',
    '- sets and reps must be single whole numbers, not ranges.',
    '- DO NOT suggest any weights or loads. You do not know what this',
    '  person can lift, and the app fills weights in from their own',
    '  history. A number from you would look exactly as trustworthy as',
    '  one they set themselves.',
    '- cue is one short coaching note, under 15 words.',
    '',
    `What they asked for: ${opts.brief}`,
  ].filter(Boolean).join('\n')
}
