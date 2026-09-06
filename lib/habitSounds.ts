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
  opts: { at?: number; peak?: number; decay?: number; glideTo?: number; type?: OscillatorType },
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

  osc.connect(gain).connect(c.destination)
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
  result: { completedNow: boolean; newCount: number } | null,
  target: number,
): void {
  if (!result) return
  if (result.completedNow) playHabitComplete()
  else                     playHabitStep(progressFraction(result.newCount, target))
}
