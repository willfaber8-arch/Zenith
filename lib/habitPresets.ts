'use client'

/**
 * lib/habitPresets.ts — Curated starter habit packs.
 *
 * The "General" preset is a ready-to-go set of everyday habits, fully
 * configured (category, colour, daily goal, unit) and — crucially —
 * pre-linked to the cross-tab auto-sync sources where it makes sense:
 *
 *   • Daily movement  → fills from logged cardio    (minutes)
 *   • Deep focus       → fills from Pomodoro blocks  (minutes)
 *   • Vocabulary       → fills from Polyglot reviews (words)
 *   • Mood check-in    → fills from Mental Wellness  (check-ins)
 *   • Read             → fills from the Library      (start/finish a book)
 *
 * so the auto-sync feature works the moment the pack is loaded, with no
 * manual setup. Two manual habits (water, meditate) round out the set.
 *
 * Loading model
 * ───────────────────────────────────────────────────────────────
 *   • ensureGeneralHabitPreset() auto-seeds the pack ONCE, on the first
 *     run where the user has zero habits. A localStorage latch then
 *     prevents it ever re-seeding (so deleting habits later won't
 *     repopulate them).
 *   • loadGeneralHabitPreset() is the explicit "Load starter pack"
 *     action — appends the pack on demand regardless of the latch.
 */

import { db, type Habit }            from '@/lib/db'
import type { HabitAutoSource }      from '@/lib/habitSync'

export interface HabitPresetItem {
  name:              string
  category:          string
  color:             string
  targetCompletions: number
  stepAmount:        number
  stepLabel?:        string
  autoSource?:       HabitAutoSource
}

/* ── The General pack ─────────────────────────────────────────── */

export const GENERAL_HABIT_PRESET: readonly HabitPresetItem[] = [
  { name: 'Drink water',       category: 'Health',      color: '#38bdf8',
    targetCompletions: 8,  stepAmount: 1, stepLabel: 'glasses' },

  { name: 'Daily movement',    category: 'Fitness',     color: '#34d399',
    targetCompletions: 30, stepAmount: 5, stepLabel: 'min', autoSource: 'cardio' },

  { name: 'Deep focus',        category: 'Scholastic',  color: '#7c95ff',
    targetCompletions: 25, stepAmount: 5, stepLabel: 'min', autoSource: 'study' },

  { name: 'Vocabulary review', category: 'Scholastic',  color: '#a78bfa',
    targetCompletions: 10, stepAmount: 1, stepLabel: 'words', autoSource: 'vocab' },

  { name: 'Mood check-in',     category: 'Mindfulness', color: '#f59e0b',
    targetCompletions: 1,  stepAmount: 1, stepLabel: 'check-in', autoSource: 'mood' },

  { name: 'Read',              category: 'Life',        color: '#fb923c',
    targetCompletions: 1, stepAmount: 1, stepLabel: 'session', autoSource: 'reading' },

  { name: 'Meditate',          category: 'Mindfulness', color: '#e879f9',
    targetCompletions: 10, stepAmount: 5, stepLabel: 'min' },
] as const

const SEED_FLAG = 'zenith_habits_general_seeded_v1'

/* ── Builders ─────────────────────────────────────────────────── */

function toHabitRows(now: number) {
  return GENERAL_HABIT_PRESET.map(p => ({
    name:              p.name,
    frequency:         'daily' as const,
    activeDays:        [] as number[],
    targetCompletions: p.targetCompletions,
    stepAmount:        p.stepAmount,
    stepLabel:         p.stepLabel,
    autoSource:        p.autoSource,
    streakCount:       0,
    lastCompletedDate: null,
    streakSaveUsed:    false,
    category:          p.category,
    color:             p.color,
    createdAt:         now,
  }))
}

/**
 * Append the General pack to the habit table. Returns the number added.
 * Used by the explicit "Load starter pack" button.
 */
export async function loadGeneralHabitPreset(): Promise<number> {
  if (!db) return 0
  const rows = toHabitRows(Date.now())
  await db.habits.bulkAdd(rows as Habit[])
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(SEED_FLAG, String(Date.now())) } catch { /* non-fatal */ }
  }
  return rows.length
}

/**
 * Auto-seed the General pack exactly once — only when the user has no
 * habits yet and we've never seeded before. Returns true if it seeded.
 */
export async function ensureGeneralHabitPreset(): Promise<boolean> {
  if (!db || typeof window === 'undefined') return false
  try {
    if (localStorage.getItem(SEED_FLAG)) return false
  } catch {
    return false
  }

  const count = await db.habits.count()
  // Latch regardless so we never auto-populate again, even if the user
  // later clears their habits.
  try { localStorage.setItem(SEED_FLAG, String(Date.now())) } catch { /* non-fatal */ }

  if (count > 0) return false   // user already has habits — leave them alone
  await db.habits.bulkAdd(toHabitRows(Date.now()) as Habit[])
  return true
}
