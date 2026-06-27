/**
 * utils/habitSchedule.ts — single source of truth for habit recurrence.
 *
 * Every "is this habit due on date X?" decision flows through
 * `isHabitScheduledOn`, and every streak-continuity decision through
 * `previousScheduledDate`. Centralising it here keeps the Habits view,
 * the auto-sync engine, the analytics chart, and the Outlook agenda all
 * agreeing on the same calendar — no drift between copies.
 *
 * Supported frequencies
 * ─────────────────────────────────────────────────────────────────────
 *   daily          every scheduled day (or every day if no activeDays)
 *   specific_days  on the weekdays listed in `activeDays` (0=Sun … 6=Sat)
 *   biweekly       every 14 days, counting from `startDate`
 *   monthly        once a month, anchored to `startDate`:
 *                    · monthlyMode='date'    → same day-of-month, clamped to
 *                                              the last day for short months
 *                                              (e.g. the 31st falls to Feb 28)
 *                    · monthlyMode='weekday' → same weekday slot, e.g. the
 *                                              "3rd Friday", clamped to the
 *                                              last occurrence when a month
 *                                              has no 5th of that weekday
 *
 * Pure module — no React / Dexie imports.
 */

import type { Habit } from '@/lib/db'

/* ── ISO date helpers (local time, "YYYY-MM-DD") ──────────────── */

export function parseLocalISO(iso: string): Date {
  // noon anchor avoids DST midnight edge cases
  return new Date(iso + 'T12:00:00')
}

export function toLocalISO(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayOfWeek(iso: string): number {
  return parseLocalISO(iso).getDay()
}

function wholeDaysBetween(aISO: string, bISO: string): number {
  const a = parseLocalISO(aISO); a.setHours(0, 0, 0, 0)
  const b = parseLocalISO(bISO); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/* ── Monthly anchor resolution ────────────────────────────────── */

/** Day-of-month for a "date" monthly habit in the given month, clamped. */
function monthlyDateDay(startDayOfMonth: number, year: number, month0: number): number {
  return Math.min(startDayOfMonth, daysInMonth(year, month0))
}

/**
 * Day-of-month for a "weekday" monthly habit (e.g. "3rd Friday") in the
 * given month. When the month has no Nth occurrence of that weekday, the
 * last available occurrence is used (clamp-down by one week).
 */
function monthlyWeekdayDay(weekday: number, occurrence: number, year: number, month0: number): number {
  const firstDow   = new Date(year, month0, 1).getDay()
  const firstOfWd  = 1 + ((weekday - firstDow + 7) % 7)   // date of the 1st such weekday
  let chosen       = firstOfWd + (occurrence - 1) * 7
  if (chosen > daysInMonth(year, month0)) chosen -= 7      // clamp to last occurrence
  return chosen
}

/** The scheduled day-of-month for a monthly habit in (year, month0), or null. */
function monthlyScheduledDay(habit: Habit, year: number, month0: number): number | null {
  if (!habit.startDate) return null
  const start = parseLocalISO(habit.startDate)
  if (habit.monthlyMode === 'weekday') {
    const weekday    = start.getDay()
    const occurrence = Math.ceil(start.getDate() / 7)   // 1-based week-of-month of the anchor
    return monthlyWeekdayDay(weekday, occurrence, year, month0)
  }
  return monthlyDateDay(start.getDate(), year, month0)
}

/* ── Public API ───────────────────────────────────────────────── */

export function isHabitScheduledOn(habit: Habit, iso: string): boolean {
  switch (habit.frequency) {
    case 'biweekly': {
      if (!habit.startDate || iso < habit.startDate) return false
      const diff = wholeDaysBetween(habit.startDate, iso)
      return diff >= 0 && diff % 14 === 0
    }
    case 'monthly': {
      if (!habit.startDate || iso < habit.startDate) return false
      const d        = parseLocalISO(iso)
      const schedDay = monthlyScheduledDay(habit, d.getFullYear(), d.getMonth())
      return schedDay != null && d.getDate() === schedDay
    }
    // 'daily' / 'specific_days' / legacy — driven entirely by activeDays.
    default:
      if (!habit.activeDays || habit.activeDays.length === 0) return true
      return habit.activeDays.includes(dayOfWeek(iso))
  }
}

/**
 * The scheduled date strictly before `iso` for this habit, or null if there
 * is none (e.g. before the start date). Used for streak continuity so that
 * a biweekly/monthly/specific-day habit counts "consecutive occurrences",
 * not consecutive calendar days.
 */
export function previousScheduledDate(habit: Habit, iso: string): string | null {
  switch (habit.frequency) {
    case 'biweekly': {
      if (!habit.startDate) return null
      const prev = parseLocalISO(iso)
      prev.setDate(prev.getDate() - 14)
      const prevISO = toLocalISO(prev)
      return prevISO >= habit.startDate ? prevISO : null
    }
    case 'monthly': {
      if (!habit.startDate) return null
      const cur      = parseLocalISO(iso)
      const pm       = new Date(cur.getFullYear(), cur.getMonth() - 1, 1)
      const schedDay = monthlyScheduledDay(habit, pm.getFullYear(), pm.getMonth())
      if (schedDay == null) return null
      const prevISO = toLocalISO(new Date(pm.getFullYear(), pm.getMonth(), schedDay))
      return prevISO >= habit.startDate ? prevISO : null
    }
    // daily / specific_days — walk back up to 7 days to the prior scheduled day.
    default: {
      const d = parseLocalISO(iso)
      for (let i = 1; i <= 7; i++) {
        d.setDate(d.getDate() - 1)
        const prevISO = toLocalISO(d)
        if (isHabitScheduledOn(habit, prevISO)) return prevISO
      }
      return null
    }
  }
}
