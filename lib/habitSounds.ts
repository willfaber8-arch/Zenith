/**
 * lib/habitSounds.ts — the sound a habit makes.
 *
 * Two sounds, synthesised rather than loaded: a soft "ploop" for each
 * step of progress, and a chime when the day's goal is reached. Nothing
 * is fetched and no audio files ship — the whole thing is a handful of
 * oscillators, so it is instant on the first tap and works offline.
 *
 * Design notes, since they are the difference between satisfying and
 * irritating:
 *
 *   · The step tone rises with progress. Tapping toward a goal walks up
 *     a scale, so you can hear how close you are without looking. The
 *     chime lands above the last step and resolves it.
 *   · Both are quiet. A habit is tapped many times a day and anything
 *     attention-grabbing would wear out within a week.
 *   · Failure is silent. Audio is decoration; a browser that refuses to
 *     make noise must never stop a habit being recorded.
 */

import { remainingFraction } from '@/utils/habitLimit'

/* ── Preference ─────────────────────────────────────────────────── */

const PREF_KEY = 'zenith_habit_sound_v1'

/** Sound is on unless the user has turned it off. */
export function isHabitSoundEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setHabitSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch { /* private mode — the setting just won't persist */ }
}

/* ── Pitch (pure) ───────────────────────────────────────────────── */

/** Where the step tone starts, in Hz, at zero progress. */
export const STEP_BASE_HZ = 396
/** How far it climbs across a full goal. */
export const STEP_RANGE_HZ = 288

/**
 * The pitch for a step tap, given how far through the goal it lands.
 *
 * Rising pitch is what makes repeated taps feel like progress rather
 * than repetition. Clamped at both ends so a habit tapped past its goal
 * keeps its top note instead of climbing away into a whistle, and so
 * nonsense input — a goal of zero, a missing count — still produces a
 * sound rather than an exception inside an event handler.
 */
export function stepFrequency(progress: number): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  return STEP_BASE_HZ + p * STEP_RANGE_HZ
}

/**
 * Progress as a fraction, safe for any goal.
 *
 * A target of zero has no meaningful fraction; treating it as complete
 * is the reading that does not divide by zero.
 */
export function progressFraction(count: number, target: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(target) || target <= 0) return 1
  return Math.min(1, Math.max(0, count / target))
}

/** C6–E6–G6. A major triad read as resolution in most ears. */
export const CHIME_HZ: readonly number[] = [1046.5, 1318.51, 1567.98]

/* ── Playback ───────────────────────────────────────────────────── */

let ctx: AudioContext | null = null
let unavailable = false

/**
 * The shared context, created on first use.
 *
 * Browsers only allow audio to start from a user gesture, which a habit
 * tap is — so building it lazily on first play is both allowed and
 * avoids an idle context for anyone who never taps. A context suspended
 * by the autoplay policy is resumed on the way past.
 */
function audioContext(): AudioContext | null {
  if (unavailable) return null
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  }
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) { unavailable = true; return null }
    ctx = new Ctor()
    return ctx
  } catch {
    unavailable = true
    return null
  }
}

/**
 * One shaped sine tone.
 *
 * The envelope is the whole character: a few milliseconds of attack so
 * it does not click, then an exponential fall. exponentialRampToValue
 * cannot reach zero, hence the tiny floor before the stop.
 */
function tone(
  c: AudioContext,
  freq: number,
  opts: {
    at?: number; peak?: number; decay?: number; glideTo?: number
    type?: OscillatorType; muffleHz?: number
  },
): void {
  const at    = c.currentTime + (opts.at ?? 0)
  const peak  = opts.peak  ?? 0.1
  const decay = opts.decay ?? 0.18

  const osc  = c.createOscillator()
  const gain = c.createGain()

  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, at)
  if (opts.glideTo !== undefined) {
    /* A short upward bend is what turns a beep into a droplet. */
    osc.frequency.exponentialRampToValueAtTime(opts.glideTo, at + decay * 0.55)
  }

  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)

  /*
   * An optional lowpass is what makes a sound "dull" rather than merely
   * quiet. Rolling the top off a tone removes its sparkle, which is the
   * difference between a sound that reads as a reward and one that
   * reads as a cost.
   */
  if (opts.muffleHz !== undefined) {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(opts.muffleHz, at)
    osc.connect(gain).connect(lp).connect(c.destination)
  } else {
    osc.connect(gain).connect(c.destination)
  }

  osc.start(at)
  osc.stop(at + decay + 0.02)
}

/**
 * The step sound: one soft droplet, pitched by progress.
 *
 * `progress` is 0–1 through the day's goal.
 */
export function playHabitStep(progress: number): void {
  if (!isHabitSoundEnabled()) return
  const c = audioContext()
  if (!c) return
  try {
    const f = stepFrequency(progress)
    tone(c, f, { peak: 0.085, decay: 0.16, glideTo: f * 1.5 })
  } catch { /* never let a decoration break the tap that triggered it */ }
}

/**
 * The completion sound: a rising major triad, struck like a small bell.
 *
 * Deliberately longer and brighter than a step so the day's last tap is
 * unmistakably different from the ones before it.
 */
export function playHabitComplete(): void {
  if (!isHabitSoundEnabled()) return
  const c = audioContext()
  if (!c) return
  try {
    CHIME_HZ.forEach((f, i) => {
      tone(c, f, { at: i * 0.07, peak: 0.11, decay: 0.55 })
      /* A quiet octave above gives it some sparkle without raising the level. */
      tone(c, f * 2, { at: i * 0.07, peak: 0.025, decay: 0.4 })
    })
  } catch { /* silence beats an exception here */ }
}

/**
 * Play whichever sound the press earned.
 *
 * Habits are tapped from more than one screen — the tracker and the
 * Daily Outlook — and they should sound identical from each. Passing
 * the engine's own result keeps that decision in one place: a press is
 * a chime if the engine says it completed the habit, a step otherwise,
 * and nothing at all when the write was a no-op.
 */
export function playHabitProgress(
  result:   { completedNow: boolean; newCount: number; crossedLimit?: boolean } | null,
  target:   number,
  goalType: 'at_least' | 'at_most' = 'at_least',
): void {
  if (!result) return

  if (goalType === 'at_most') {
    /* Never the chime. Logging against a limit is a cost, not an
       achievement, and the sound has to say so. */
    if (result.crossedLimit) playHabitOverLimit()
    else                     playHabitSpend(remainingFraction(result.newCount, target))
    return
  }

  if (result.completedNow) playHabitComplete()
  else                     playHabitStep(progressFraction(result.newCount, target))
}

/* ── Limit habits ───────────────────────────────────────────────── */

/*
 * A limit habit sounds like the opposite of a goal habit.
 *
 * Where a goal step rises and rings, spending an allowance falls and is
 * damped: a triangle wave bent downward, run through a lowpass so it
 * has no sparkle at all, and cut short. The intent is a sound you would
 * not press a button to hear again — noticeable as a cost, without
 * being an error noise for something that is not an error.
 */

/** Where the spend tone lands with the allowance untouched. */
export const SPEND_TOP_HZ = 330
/** How far it sinks as the allowance runs out. */
export const SPEND_DROP_HZ = 150

/**
 * Pitch for a spend tap, given the fraction of allowance *left*.
 *
 * Falls as the allowance drains, so the fourth of four coffees is
 * audibly lower than the first, and the sound gets heavier as the
 * headroom disappears.
 */
export function spendFrequency(remaining: number): number {
  const r = Number.isFinite(remaining) ? Math.min(1, Math.max(0, remaining)) : 0
  return SPEND_TOP_HZ - (1 - r) * SPEND_DROP_HZ
}

/** One damped, descending tone: an allowance being spent. */
export function playHabitSpend(remaining: number): void {
  if (!isHabitSoundEnabled()) return
  const c = audioContext()
  if (!c) return
  try {
    const f = spendFrequency(remaining)
    tone(c, f, {
      type: 'triangle',
      peak: 0.075,
      decay: 0.22,
      glideTo: f * 0.72,   // bends down, the inverse of the step droplet
      muffleHz: 900,
    })
  } catch { /* a decoration must never break the tap that triggered it */ }
}

/**
 * Crossing the limit: two low tones a semitone apart, overlapping.
 *
 * Deliberately unresolved. A minor second is the interval ears read as
 * wrong, and heard through the same lowpass it lands as a dull knock
 * rather than an alarm — this is a habit going over, not a system
 * failure, and it should not sound like one.
 */
export function playHabitOverLimit(): void {
  if (!isHabitSoundEnabled()) return
  const c = audioContext()
  if (!c) return
  try {
    tone(c, 165,    { type: 'triangle', peak: 0.10, decay: 0.42, muffleHz: 700 })
    tone(c, 155.6,  { type: 'triangle', peak: 0.09, decay: 0.46, muffleHz: 700, at: 0.05 })
  } catch { /* silence beats an exception here */ }
}
