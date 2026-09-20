'use client'

/**
 * lib/habitSync.ts — Cross-tab habit auto-sync engine.
 *
 * Lets a habit be "linked" to an activity logged elsewhere in Zenith.
 * When that activity happens — a cardio session, a finished focus block,
 * a vocab review, a mood check-in — every habit whose `autoSource`
 * matches is automatically advanced toward its daily goal (and its
 * streak updated) without the user touching the Habits tab.
 *
 * Design notes
 * ───────────────────────────────────────────────────────────────
 *   • `addHabitProgress()` is the SINGLE source of truth for advancing
 *     a habit's daily completion + streak. Both the manual "+" button
 *     (useHabits.increment) and every auto-source route through it, so
 *     the completion/streak rules never drift between paths.
 *   • Auto-sync writes to `db.habitCompletions`; because the Habits view
 *     reads that table through Dexie's `useLiveQuery`, linked habits
 *     update live — including in other open browser tabs.
 *   • When a habit crosses its goal via auto-sync, a
 *     `zenith:habit-complete` CustomEvent is dispatched so a single
 *     listener (HabitSyncToaster) can surface one celebratory toast,
 *     instead of wiring the Toast context into every logging surface.
 *
 * No React imports — callable from hooks, FSMs, and plain handlers.
 */

import type { IconName } from '@/components/ui/Icon'
import { db, type Habit, type HabitCompletion } from '@/lib/db'
import { pushNotification } from '@/lib/notificationCenter'
import { isHabitScheduledOn, previousScheduledDate } from '@/utils/habitSchedule'
import { toLocalDateStr } from '@/utils/localDate'
import { roundAmount } from '@/utils/habitAmount'
import { effectiveDateISO, loadCutoffHour } from '@/utils/dayBoundary'

/* ── Source registry ──────────────────────────────────────────── */

export type HabitAutoSource = 'cardio' | 'study' | 'vocab' | 'mood' | 'reading' | 'plant'

export interface HabitSourceMeta {
  id:    HabitAutoSource
  label: string   // picker label
  icon:  IconName
  unit:  string   // what one unit of `amount` represents
  hint:  string   // explanation shown under the picker
}

export const HABIT_SOURCES: readonly HabitSourceMeta[] = [
  { id: 'cardio', label: 'Cardio workout',     icon: 'run', unit: 'minutes',
    hint: 'Fills automatically when you log a session in Workouts.' },
  { id: 'study',  label: 'Focus session',      icon: 'brain', unit: 'minutes',
    hint: 'Fills automatically when you finish a Pomodoro focus block.' },
  { id: 'vocab',  label: 'Vocabulary review',  icon: 'book', unit: 'words',
    hint: 'Fills automatically when you review words in the Polyglot Vault.' },
  { id: 'mood',   label: 'Mood check-in',      icon: 'moodNeutral', unit: 'check-ins',
    hint: 'Fills automatically when you log your mood in Mental Wellness.' },
  { id: 'reading', label: 'Reading session',   icon: 'bookOpen', unit: 'sessions',
    hint: 'Fills automatically when you start or finish a book in the Library.' },
  { id: 'plant',  label: 'Plant watered',      icon: 'droplet', unit: 'plants',
    hint: 'Fills automatically when you water a plant in the Botanist Guide.' },
] as const

const SOURCE_IDS = new Set<string>(HABIT_SOURCES.map(s => s.id))

export function isHabitAutoSource(v: unknown): v is HabitAutoSource {
  return typeof v === 'string' && SOURCE_IDS.has(v)
}

export function habitSourceMeta(id?: string | null): HabitSourceMeta | undefined {
  return id ? HABIT_SOURCES.find(s => s.id === id) : undefined
}

/* ── Date helpers (local, ISO YYYY-MM-DD) ─────────────────────── */


/* ── Core progress primitive ──────────────────────────────────── */

export interface ProgressResult {
  /** true only on the press/sync that first reaches the daily goal */
  completedNow: boolean
  newCount:     number
  /**
   * True on the press that first takes a limit habit past its cap.
   *
   * Only ever true for `at_most`, and only once per day — the tap that
   * crossed, not every tap after it.
   */
  crossedLimit: boolean
}

/**
 * Advance a habit's completion for `dateISO` by `amount`, capped at the
 * habit's daily goal. Updates streak + all-time-high on first completion.
 * Returns null when the write was a no-op (habit missing / not scheduled /
 * already complete / invalid amount).
 *
 * This is the shared completion engine — do not duplicate this logic.
 */
export async function addHabitProgress(
  habitId: number,
  amount:  number,
  /* Defaults to the habit day, so progress synced from a workout or a
     study session at 2am lands on the same day a manual tap would. */
  dateISO: string = effectiveDateISO(new Date(),
    typeof window !== 'undefined' ? loadCutoffHour() : 0),
): Promise<ProgressResult | null> {
  if (!db || !Number.isFinite(amount) || amount <= 0) return null

  const habit = await db.habits.get(habitId)
  if (!habit) return null
  if (!isHabitScheduledOn(habit, dateISO)) return null

  const existing = await db.habitCompletions
    .where('[habitId+date]').equals([habitId, dateISO])
    .first()

  const prevCount = existing?.count ?? 0
  /*
   * Rounded, because steps can be fractional.
   *
   * A step of 0.1 taken ten times sums to 0.9999999999999999 in binary
   * floating point, which is less than a goal of 1 — the habit would
   * read as finished and refuse to complete, and the streak would never
   * increment. Snapping to the stored precision on every write keeps
   * ten tenths worth exactly one. No cap: tapping past the goal is
   * allowed and is how the over-goal streak is earned.
   */
  const newCount  = roundAmount(prevCount + amount)

  if (existing?.id != null) {
    await db.habitCompletions.update(existing.id, { count: newCount })
  } else {
    await db.habitCompletions.add({ habitId, date: dateISO, count: newCount })
  }

  const goalType = habit.goalType ?? 'at_least'
  const target   = habit.targetCompletions

  /*
   * A press can complete a goal habit. It can never complete a limit one.
   *
   * This used to treat the first tap under the cap as completion, which
   * awarded a streak for having one coffee — success at "no more than
   * two" is not knowable until the day is over. Limit habits settle
   * from history instead (see utils/habitLimit), so no press writes a
   * streak for them and none is celebrated.
   */
  const completedNow = goalType === 'at_most'
    ? false
    : newCount >= target && prevCount < target   // first press reaching minimum

  /* The single tap that takes a limit habit over its cap. */
  const crossedLimit = goalType === 'at_most' && newCount > target && prevCount <= target

  if (completedNow) {
    // "Consecutive" = the previous scheduled occurrence was completed —
    // works for daily, specific-day, biweekly, and monthly cadences alike.
    const prevScheduled = previousScheduledDate(habit, dateISO)
    const consecutive =
      habit.lastCompletedDate === prevScheduled || habit.lastCompletedDate === dateISO
    const newStreak  = consecutive ? habit.streakCount + 1 : 1
    const newAllTime = Math.max(newStreak, habit.allTimeHighStreak ?? 0)
    await db.habits.update(habitId, {
      streakCount:       newStreak,
      lastCompletedDate: dateISO,
      allTimeHighStreak: newAllTime,
    })
  }

  // Over-goal streak tracking — only for at_least habits.
  // Fires once per day: when the count first crosses above the target.
  if (goalType === 'at_least' && newCount > target && prevCount <= target) {
    const prevScheduled   = previousScheduledDate(habit, dateISO)
    const lastExc         = habit.lastExceededDate
    const overConsecutive = lastExc === prevScheduled || lastExc === dateISO
    const newOverStreak   = overConsecutive ? (habit.overGoalStreak ?? 0) + 1 : 1
    await db.habits.update(habitId, {
      overGoalStreak:   newOverStreak,
      lastExceededDate: dateISO,
    })
    // Suggest raising the goal after every 5-day consecutive over-goal run.
    if (newOverStreak >= 5 && newOverStreak % 5 === 0) {
      pushNotification({
        id:    `habit-goal-raise-${habitId}-${newOverStreak}`,
        type:  'habit-milestone',
        icon:  'trendingUp',
        title: `${habit.name} — time to raise your goal?`,
        body:  `You've exceeded your target ${newOverStreak} days in a row. Consider increasing it.`,
        view:  'habits',
      })
    }
  }

  return { completedNow, newCount, crossedLimit }
}

/* ── Undoing an accidental tap ────────────────────────────────── */

export interface HabitTapUndo {
  habitId: number
  dateISO: string
  /** The whole habit row exactly as it was before the tap. */
  habitBefore: Habit
  /** Today's completion row before the tap, or null if the tap created it. */
  completionBefore: HabitCompletion | null
}

/**
 * Snapshot a habit and its completion row for `dateISO`, immediately
 * before a tap is about to change them.
 *
 * A tap can't be undone by running its arithmetic backwards: whether it
 * continued a streak or started a new one after a break decides what
 * `lastCompletedDate` and `streakCount` should revert to, and that
 * decision was already thrown away by the time an "undo" button is
 * pressed — a broken-then-restarted streak looks identical to a
 * continued one once the count has moved. So this works the way
 * calendar undo does instead: capture the exact prior state and put it
 * back, rather than reasoning about what the prior state must have
 * been.
 */
export async function captureHabitTap(
  habitId: number,
  dateISO: string,
): Promise<HabitTapUndo | null> {
  if (!db) return null
  const habit = await db.habits.get(habitId)
  if (!habit) return null
  const completion = await db.habitCompletions
    .where('[habitId+date]').equals([habitId, dateISO])
    .first()
  return { habitId, dateISO, habitBefore: habit, completionBefore: completion ?? null }
}

/**
 * Put a habit's row and its completion for that day back exactly the
 * way captureHabitTap found them, undoing one tap.
 *
 * `put`, not `update`: an edited row has to lose every field the tap
 * touched, not just the ones this function happens to know about, and a
 * completion row the tap created has to disappear entirely rather than
 * being left behind with a stale count.
 */
export async function revertHabitTap(snap: HabitTapUndo): Promise<void> {
  if (!db) return
  await db.habits.put(snap.habitBefore)

  if (snap.completionBefore) {
    await db.habitCompletions.put(snap.completionBefore)
    return
  }
  const row = await db.habitCompletions
    .where('[habitId+date]').equals([snap.habitId, snap.dateISO])
    .first()
  if (row?.id != null) await db.habitCompletions.delete(row.id)
}

/* ── Skipping a day ──────────────────────────────────────────── */

/**
 * Toggle whether `habitId` is skipped for `dateISO` (default: the habit
 * day). A skipped day is stored on the habit itself in `skippedDates`,
 * the same non-indexed-field pattern as `color` or `notes` — no schema
 * migration for something a habit either has or doesn't.
 *
 * That's the whole write. Nothing else — streakCount, lastCompletedDate,
 * allTimeHighStreak — is touched, because nothing else needs to be:
 * `isHabitScheduledOn` already checks `skippedDates` first, so every
 * reader that decides whether a day was due (the streak walk, the
 * weekly ratio, the grit average, this same file's own gate above)
 * starts treating the day as never scheduled the moment this list
 * changes, without a separate recalculation step.
 *
 * Refuses to skip a day that already has something logged — a skip is
 * a decision made instead of doing the habit, not a way to make logged
 * progress stop counting. Unskipping has no such guard; it only ever
 * puts a day back the way an untouched day already looks.
 *
 * Returns which way it went, or null on a no-op (habit missing, or a
 * skip refused because the day isn't empty) so the caller can decide
 * whether to say anything.
 */
export async function toggleHabitSkip(
  habitId: number,
  dateISO: string = effectiveDateISO(new Date(),
    typeof window !== 'undefined' ? loadCutoffHour() : 0),
): Promise<'skipped' | 'unskipped' | null> {
  if (!db) return null
  const habit = await db.habits.get(habitId)
  if (!habit) return null

  const skippedDates = habit.skippedDates ?? []

  if (skippedDates.includes(dateISO)) {
    await db.habits.update(habitId, {
      skippedDates: skippedDates.filter(d => d !== dateISO),
    })
    return 'unskipped'
  }

  const existing = await db.habitCompletions
    .where('[habitId+date]').equals([habitId, dateISO])
    .first()
  if (existing && existing.count > 0) return null

  await db.habits.update(habitId, { skippedDates: [...skippedDates, dateISO] })
  return 'skipped'
}

/* ── Auto-sync dispatch ───────────────────────────────────────── */

/**
 * Advance every habit linked to `source` by `amount`. Fires a
 * `zenith:habit-complete` CustomEvent listing the names of habits that
 * crossed their goal so a single toast listener can celebrate them.
 *
 * Safe to fire-and-forget from any logging surface.
 */
export async function syncHabitSource(
  source: HabitAutoSource,
  amount: number,
): Promise<string[]> {
  if (!db || !Number.isFinite(amount) || amount <= 0) return []

  const linked = await db.habits.filter(h => h.autoSource === source).toArray()
  const completed: string[] = []

  for (const habit of linked) {
    if (habit.id == null) continue
    const res = await addHabitProgress(habit.id, amount)
    if (res?.completedNow) completed.push(habit.name)
  }

  if (completed.length > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('zenith:habit-complete', { detail: { names: completed, source } }),
    )
  }

  return completed
}
