'use client'

import { useCallback }    from 'react'
import { useLiveQuery }   from 'dexie-react-hooks'
import { db, type Habit, type HabitCompletion } from '@/lib/db'

/* ── Helpers ──────────────────────────────────────────────── */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isoForDayOffset(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function dayOfWeekForISO(iso: string): number {
  return new Date(iso + 'T12:00:00').getDay()
}

export function isHabitScheduledOn(habit: Habit, iso: string): boolean {
  if (habit.activeDays.length === 0) return true
  const dow = dayOfWeekForISO(iso)
  return habit.activeDays.includes(dow)
}

/* ── Types ────────────────────────────────────────────────── */

export interface HabitWithCompletion extends Habit {
  todayCount: number
  todayDone:  boolean
  weekData:   DayStatus[]
}

export interface DayStatus {
  iso:       string
  scheduled: boolean
  count:     number
  target:    number
  done:      boolean
}

export interface NewHabitInput {
  name:              string
  category:          string    // e.g. 'Life', 'Scholastic', 'Health', 'General'
  color?:            string    // hex accent colour for the habit row
  activeDays:        number[]
  targetCompletions: number    // the goal value (e.g. 20 oz)
  stepAmount?:       number    // how much each click adds (e.g. 5 oz)
  stepLabel?:        string    // unit label for display (e.g. "oz")
  goalDescription?:  string    // optional text descriptor
}

/* ── Week dates helper ────────────────────────────────────── */

export function getWeekDates(): string[] {
  return Array.from({ length: 7 }, (_, i) => isoForDayOffset(i - 6))
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useHabits() {
  const today     = todayISO()
  const weekDates = getWeekDates()
  const yesterday = isoForDayOffset(-1)

  const habits = useLiveQuery(
    () => db?.habits.toArray() ?? Promise.resolve([]),
    [],
    [] as Habit[],
  )

  const completions = useLiveQuery(
    () => db?.habitCompletions
      .where('date').between(weekDates[0], today, true, true)
      .toArray() ?? Promise.resolve([]),
    [weekDates[0], today],
    [] as HabitCompletion[],
  )

  const habitsWithData: HabitWithCompletion[] = (habits ?? []).map(habit => {
    const completionMap = new Map<string, number>()
    ;(completions ?? [])
      .filter(c => c.habitId === habit.id)
      .forEach(c => completionMap.set(c.date, c.count))

    const todayCount = completionMap.get(today) ?? 0
    const todayDone  = todayCount >= habit.targetCompletions

    const weekData: DayStatus[] = weekDates.map(iso => ({
      iso,
      scheduled: isHabitScheduledOn(habit, iso),
      count:     completionMap.get(iso) ?? 0,
      target:    habit.targetCompletions,
      done:      (completionMap.get(iso) ?? 0) >= habit.targetCompletions,
    }))

    return { ...habit, todayCount, todayDone, weekData }
  })

  const scheduledToday = habitsWithData.filter(h => isHabitScheduledOn(h, today))
  const doneToday      = scheduledToday.filter(h => h.todayDone).length
  const dailyPct       = scheduledToday.length
    ? Math.round((doneToday / scheduledToday.length) * 100)
    : 0

  /* ── Mutations ─────────────────────────────────────────── */

  const increment = useCallback(async (habitId: number) => {
    if (!db) return
    const habit = await db.habits.get(habitId)
    if (!habit) return
    if (!isHabitScheduledOn(habit, today)) return

    const step = habit.stepAmount ?? 1

    const existing = await db.habitCompletions
      .where('[habitId+date]').equals([habitId, today])
      .first()

    const prevCount = existing?.count ?? 0
    // Don't exceed the goal
    if (prevCount >= habit.targetCompletions) return
    const newCount = Math.min(prevCount + step, habit.targetCompletions)

    if (existing?.id != null) {
      await db.habitCompletions.update(existing.id, { count: newCount })
    } else {
      await db.habitCompletions.add({ habitId, date: today, count: newCount })
    }

    /* Update streak on first full completion today */
    if (newCount >= habit.targetCompletions && prevCount < habit.targetCompletions) {
      const consecutive = habit.lastCompletedDate === yesterday ||
        habit.lastCompletedDate === today
      const newStreak = consecutive ? habit.streakCount + 1 : 1
      const newAllTime = Math.max(newStreak, habit.allTimeHighStreak ?? 0)
      await db.habits.update(habitId, {
        streakCount:       newStreak,
        lastCompletedDate: today,
        allTimeHighStreak: newAllTime,
      })
    }
  }, [today, yesterday])

  const createHabit = useCallback(async (input: NewHabitInput) => {
    if (!db) return
    await db.habits.add({
      name:              input.name.trim(),
      frequency:         input.activeDays.length === 0 ? 'daily' : 'specific_days',
      activeDays:        input.activeDays,
      targetCompletions: input.targetCompletions,
      stepAmount:        input.stepAmount ?? 1,
      stepLabel:         input.stepLabel?.trim() || undefined,
      goalDescription:   input.goalDescription?.trim() || undefined,
      streakCount:       0,
      lastCompletedDate: null,
      streakSaveUsed:    false,
      category:          input.category || 'General',
      color:             input.color || '#7c95ff',
      createdAt:         Date.now(),
    })
  }, [])

  const deleteHabit = useCallback(async (habitId: number) => {
    if (!db) return
    await db.habits.delete(habitId)
    await db.habitCompletions.where('habitId').equals(habitId).delete()
  }, [])

  const updateHabit = useCallback(async (habitId: number, changes: Partial<Habit>) => {
    if (!db) return
    await db.habits.update(habitId, changes)
  }, [])

  return {
    habits: habitsWithData,
    weekDates,
    today,
    dailyPct,
    scheduledCount: scheduledToday.length,
    doneCount: doneToday,
    increment,
    createHabit,
    deleteHabit,
    updateHabit,
  }
}
