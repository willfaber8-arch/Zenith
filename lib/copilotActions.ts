/**
 * lib/copilotActions.ts — client-side execution of AI Co-Pilot actions.
 *
 * Runs ONLY in the browser (writes to IndexedDB via Dexie). The model proposes
 * a CopilotAction; after the user confirms in the sidebar, `executeCopilotAction`
 * performs the matching IDB write. Every write is validated here — the model's
 * arguments are treated as untrusted input.
 */

'use client'

import { db } from '@/lib/db'
import type { Priority } from '@/lib/db'
import { isKnownAction, type CopilotAction } from '@/lib/copilotTools'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** Validate a YYYY-MM-DD string and return [year, month, day] (month 1-12). */
function parseDate(v: unknown): [number, number, number] {
  const s = str(v)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`Invalid date "${s}" — expected YYYY-MM-DD`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Parse an optional HH:MM time; returns [h, m] or null. */
function parseTime(v: unknown): [number, number] | null {
  const s = str(v)
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

/* ── VP economy helper (localStorage, mirrors WorkoutsView) ───────────── */

function awardVitalityPoints(vp: number): void {
  try {
    const raw = localStorage.getItem('zenith_vitality_v1')
    const cur = raw ? JSON.parse(raw) as { balance?: number; lifetime?: number } : {}
    localStorage.setItem('zenith_vitality_v1', JSON.stringify({
      balance:  (cur.balance ?? 0) + vp,
      lifetime: (cur.lifetime ?? 0) + vp,
    }))
  } catch { /* localStorage unavailable — skip silently */ }
}

/* ── Executor ─────────────────────────────────────────────────────────── */

/**
 * Execute a single confirmed action. Returns a short success message for the
 * UI. Throws (with a user-readable message) on validation or write failure.
 */
export async function executeCopilotAction(action: CopilotAction): Promise<string> {
  if (!db) throw new Error('Local database is not available.')
  if (!isKnownAction(action.name)) throw new Error(`Unknown action: ${action.name}`)

  const a = action.args ?? {}

  switch (action.name) {
    /* ── Habit ──────────────────────────────────────────────────────── */
    case 'create_habit': {
      const name = str(a.name)
      if (!name) throw new Error('A habit needs a name.')
      const goalRaw = num(a.dailyGoal)
      const goal    = Number.isFinite(goalRaw) && goalRaw > 0 ? Math.floor(goalRaw) : 1
      const unit    = str(a.unit) || undefined
      const color   = /^#[0-9a-fA-F]{6}$/.test(str(a.color)) ? str(a.color) : '#7c95ff'

      await db.habits.add({
        name,
        frequency:         'daily',
        activeDays:        [],
        targetCompletions: goal,
        stepAmount:        1,
        stepLabel:         unit,
        streakCount:       0,
        lastCompletedDate: null,
        streakSaveUsed:    false,
        category:          'General',
        color,
        createdAt:         Date.now(),
      })
      return `Created habit "${name}".`
    }

    /* ── Calendar event ─────────────────────────────────────────────── */
    case 'add_calendar_event': {
      const title = str(a.title)
      if (!title) throw new Error('An event needs a title.')
      const [y, mo, d] = parseDate(a.date)
      const start = parseTime(a.startTime)
      const allDay = start === null

      let startMs: number
      let endMs:   number
      if (allDay) {
        startMs = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime()
        endMs   = startMs
      } else {
        startMs = new Date(y, mo - 1, d, start[0], start[1], 0, 0).getTime()
        const end = parseTime(a.endTime)
        endMs = end
          ? new Date(y, mo - 1, d, end[0], end[1], 0, 0).getTime()
          : startMs + 60 * 60 * 1000
      }

      const allowedCats = ['personal', 'scholastic', 'exam', 'life', 'general']
      const category = allowedCats.includes(str(a.category)) ? str(a.category) : 'personal'

      await db.personalEvents.add({
        title,
        startMs,
        endMs,
        allDay:    allDay ? 1 : 0,
        color:     '#7c95ff',
        category,
        createdAt: Date.now(),
      })
      return `Added "${title}" to your calendar.`
    }

    /* ── Cardio session ─────────────────────────────────────────────── */
    case 'log_cardio': {
      const activity = (str(a.activity) || 'other').toLowerCase()
      const mins     = num(a.durationMinutes)
      if (!Number.isFinite(mins) || mins <= 0) throw new Error('Cardio needs a positive duration.')
      const duration = Math.floor(mins)
      const distRaw  = num(a.distanceMiles)
      const distance = Number.isFinite(distRaw) && distRaw > 0 ? distRaw : undefined
      const vp       = duration + (duration >= 30 ? 5 : 0)

      await db.cardioSessions.add({
        activityType:    activity,
        durationMinutes: duration,
        distance,
        distanceUnit:    distance !== undefined ? 'mi' : undefined,
        vitalityEarned:  vp,
        logDate:         todayISO(),
        completedAt:     Date.now(),
      })
      awardVitalityPoints(vp)
      return `Logged ${duration} min of ${activity} (+${vp} VP).`
    }

    /* ── Quick note ─────────────────────────────────────────────────── */
    case 'create_note': {
      const title = str(a.title)
      if (!title) throw new Error('A note needs a title.')
      const body  = typeof a.body === 'string' ? a.body : ''
      await db.quickNotes.add({
        title,
        body,
        category:  'idea',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      })
      return `Saved note "${title}".`
    }

    /* ── Assignment ─────────────────────────────────────────────────── */
    case 'add_assignment': {
      const title = str(a.title)
      if (!title) throw new Error('An assignment needs a title.')
      const [y, mo, d] = parseDate(a.dueDate)
      const dueDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const priorities: Priority[] = ['low', 'medium', 'high', 'critical']
      const priority = priorities.includes(str(a.priority) as Priority)
        ? (str(a.priority) as Priority)
        : 'medium'

      await db.assignments.add({
        title,
        dueDate,
        courseId:  '',
        status:    'pending',
        priority,
        category:  'scholastic',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      return `Added assignment "${title}" (due ${dueDate}).`
    }

    default:
      throw new Error(`Unsupported action: ${action.name}`)
  }
}
