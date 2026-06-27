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

import { db, type Habit } from '@/lib/db'
import { pushNotification } from '@/lib/notificationCenter'
import { isHabitScheduledOn, previousScheduledDate } from '@/utils/habitSchedule'

/* ── Source registry ──────────────────────────────────────────── */

export type HabitAutoSource = 'cardio' | 'study' | 'vocab' | 'mood' | 'reading'

export interface HabitSourceMeta {
  id:    HabitAutoSource
  label: string   // picker label
  icon:  string   // emoji
  unit:  string   // what one unit of `amount` represents
  hint:  string   // explanation shown under the picker
}

export const HABIT_SOURCES: readonly HabitSourceMeta[] = [
  { id: 'cardio', label: 'Cardio workout',     icon: '🏃', unit: 'minutes',
    hint: 'Fills automatically when you log a session in Workouts.' },
  { id: 'study',  label: 'Focus session',      icon: '🧠', unit: 'minutes',
    hint: 'Fills automatically when you finish a Pomodoro focus block.' },
  { id: 'vocab',  label: 'Vocabulary review',  icon: '📚', unit: 'words',
    hint: 'Fills automatically when you review words in the Polyglot Vault.' },
  { id: 'mood',   label: 'Mood check-in',      icon: '🌤️', unit: 'check-ins',
    hint: 'Fills automatically when you log your mood in Mental Wellness.' },
  { id: 'reading', label: 'Reading session',   icon: '📖', unit: 'sessions',
    hint: 'Fills automatically when you start or finish a book in the Library.' },
] as const

const SOURCE_IDS = new Set<string>(HABIT_SOURCES.map(s => s.id))

export function isHabitAutoSource(v: unknown): v is HabitAutoSource {
  return typeof v === 'string' && SOURCE_IDS.has(v)
}

export function habitSourceMeta(id?: string | null): HabitSourceMeta | undefined {
  return id ? HABIT_SOURCES.find(s => s.id === id) : undefined
}

/* ── Date helpers (local, ISO YYYY-MM-DD) ─────────────────────── */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ── Core progress primitive ──────────────────────────────────── */

export interface ProgressResult {
  /** true only on the press/sync that first reaches the daily goal */
  completedNow: boolean
  newCount:     number
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
  dateISO: string = todayISO(),
): Promise<ProgressResult | null> {
  if (!db || !Number.isFinite(amount) || amount <= 0) return null

  const habit = await db.habits.get(habitId)
  if (!habit) return null
  if (!isHabitScheduledOn(habit, dateISO)) return null

  const existing = await db.habitCompletions
    .where('[habitId+date]').equals([habitId, dateISO])
    .first()

  const prevCount = existing?.count ?? 0
  const newCount  = prevCount + amount   // no cap — user can tap past goal

  if (existing?.id != null) {
    await db.habitCompletions.update(existing.id, { count: newCount })
  } else {
    await db.habitCompletions.add({ habitId, date: dateISO, count: newCount })
  }

  const goalType = habit.goalType ?? 'at_least'
  const target   = habit.targetCompletions

  // completedNow: first press that crosses the "done" threshold for this goal type.
  const completedNow = goalType === 'at_most'
    ? newCount > 0 && prevCount === 0 && newCount <= target   // first tracked tap while under limit
    : newCount >= target && prevCount < target                 // first press reaching minimum

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
        icon:  '📈',
        title: `${habit.name} — time to raise your goal?`,
        body:  `You've exceeded your target ${newOverStreak} days in a row. Consider increasing it.`,
        view:  'habits',
      })
    }
  }

  return { completedNow, newCount }
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
