/**
 * utils/aiContextBridge.ts — Semantic Context Window Aggregator
 * Phase 7 · Step 7.1 — AI-Powered Academic Co-Pilot
 *
 * Compiles a structured background context payload from the user's local
 * IndexedDB state.  The returned `systemPrompt` string is injected into the
 * Anthropic system message to give the co-pilot full situational awareness
 * without exposing raw database records to the model in a bloated or unsafe way.
 *
 * Token budget strategy:
 *   • Task/habit rows are capped at MAX_* constants to bound payload size.
 *   • Qualitative text fields (notes, journal entries) are truncated at
 *     MAX_NOTE_CHARS so free-form prose can't overflow the context window.
 *   • The compiled block targets ≈ 600–900 tokens — large enough for full
 *     situational awareness, well inside the 200 k claude-haiku context limit.
 */

import type { Assignment, Habit }  from '@/lib/db'
import type { MentalHealthLog }    from '@/utils/mentalHealthLog'

/* ── Token-safety constants ──────────────────────────────────── */

const LOOKBACK_DAYS          = 14
const MAX_NOTE_CHARS         = 110   // truncate free-text notes before injection
const MAX_OVERDUE_IN_PROMPT  = 6
const MAX_PENDING_IN_PROMPT  = 8
const MAX_HABITS_IN_PROMPT   = 6
const MAX_MOOD_LOGS_IN_PROMPT = 5

/* ── Return types ────────────────────────────────────────────── */

export interface ContextStats {
  assignmentsCompleted:  number
  assignmentsOverdue:    number
  assignmentsPending:    number
  avgHabitStreak:        number
  habitCount:            number
  avgStressLevel:        number
  avgEnergyLevel:        number
  burnoutRisk:           'none' | 'emerging' | 'critical'
  recentMoodKeys:        string[]
}

export interface UserContextPayload {
  compiledAt:   string
  systemPrompt: string
  stats:        ContextStats
}

/* ── Helpers ─────────────────────────────────────────────────── */

function isoDateDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ── Main compiler ───────────────────────────────────────────── */

/**
 * Reads assignments, habits, and mental health logs from IndexedDB and
 * compiles a structured plain-text block suitable for injection as an
 * Anthropic system message extension.
 *
 * MUST be called from browser context (useEffect / event handler) — not
 * from Server Components or API routes.
 */
export async function compileUserContextPayload(): Promise<UserContextPayload> {
  // Lazy import to enforce SSR-safety
  const { getDb } = await import('@/lib/db')
  const db = getDb()

  const cutoff  = isoDateDaysAgo(LOOKBACK_DAYS)
  const today   = todayISO()

  /* ── 1. Assignments ─────────────────────────────────────────── */
  const allAssignments: Assignment[] = await db.assignments.toArray()

  const completed = allAssignments.filter(
    a => a.status === 'completed' && a.dueDate >= cutoff,
  )
  const overdue = allAssignments.filter(
    a => a.status === 'overdue' ||
         (a.status !== 'completed' && a.dueDate < today),
  )
  const pending = allAssignments.filter(
    a => a.status === 'pending' || a.status === 'in_progress',
  ).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  /* ── 2. Habits ──────────────────────────────────────────────── */
  const habits: Habit[] = await db.habits.toArray()
  const avgStreak = habits.length > 0
    ? Math.round(
        habits.reduce((s, h) => s + h.streakCount, 0) / habits.length * 10,
      ) / 10
    : 0
  const topHabits = [...habits]
    .sort((a, b) => b.streakCount - a.streakCount)
    .slice(0, MAX_HABITS_IN_PROMPT)

  /* ── 3. Mental health logs ──────────────────────────────────── */
  const mentalLogs: MentalHealthLog[] = await db.mentalHealthLogs
    .where('logDate').aboveOrEqual(cutoff)
    .toArray()
  mentalLogs.sort((a, b) => b.logDate.localeCompare(a.logDate)) // newest first

  const avgStress = mentalLogs.length > 0
    ? Math.round(mentalLogs.reduce((s, l) => s + l.stressLevel, 0) / mentalLogs.length * 10) / 10
    : 5
  const avgEnergy = mentalLogs.length > 0
    ? Math.round(mentalLogs.reduce((s, l) => s + l.energyLevel, 0) / mentalLogs.length * 10) / 10
    : 5
  const burnoutDays = mentalLogs.filter(
    l => l.stressLevel >= 8 && l.energyLevel <= 3,
  ).length
  const burnoutRisk: ContextStats['burnoutRisk'] =
    burnoutDays >= 2 ? 'critical' :
    burnoutDays >= 1 ? 'emerging' :
    'none'

  /* ── 4. Compile text block ──────────────────────────────────── */
  const lines: string[] = []

  lines.push('════ ZENITH USER CONTEXT SNAPSHOT ════')
  lines.push(`Timestamp: ${new Date().toUTCString()}`)
  lines.push(`Lookback:  ${LOOKBACK_DAYS} days`)
  lines.push('')

  // — Task & milestone velocity —
  lines.push('── TASK & MILESTONE VELOCITY ──')
  lines.push(`Completed (${LOOKBACK_DAYS}d): ${completed.length}`)
  lines.push(`Overdue:                   ${overdue.length}`)
  lines.push(`Active (pending/in-flight): ${pending.length}`)

  if (overdue.length > 0) {
    lines.push('')
    lines.push('Overdue items (highest priority first):')
    overdue
      .sort((a, b) => {
        const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4)
      })
      .slice(0, MAX_OVERDUE_IN_PROMPT)
      .forEach(a => {
        const note = truncate(a.notes, MAX_NOTE_CHARS)
        lines.push(
          `  [${a.priority.toUpperCase()}] "${a.title}" | course: ${a.courseId} | due: ${a.dueDate}` +
          (note ? ` | note: "${note}"` : ''),
        )
      })
  }

  if (pending.length > 0) {
    lines.push('')
    lines.push('Upcoming tasks (chronological):')
    pending.slice(0, MAX_PENDING_IN_PROMPT).forEach(a => {
      lines.push(
        `  [${a.priority.toUpperCase()}] "${a.title}" | ${a.courseId} | due: ${a.dueDate} | status: ${a.status}`,
      )
    })
  }

  lines.push('')

  // — Behavioral vectors (habit streaks) —
  lines.push('── BEHAVIORAL VECTORS ──')
  lines.push(`Total habits tracked:    ${habits.length}`)
  lines.push(`Average streak:          ${avgStreak} days`)

  if (topHabits.length > 0) {
    lines.push('Top habit streaks:')
    topHabits.forEach(h => {
      const lastDone = h.lastCompletedDate ? `last: ${h.lastCompletedDate}` : 'never completed'
      lines.push(
        `  "${h.name}" [${h.category}] streak=${h.streakCount}d | freq=${h.frequency} | ${lastDone}`,
      )
    })
  }

  lines.push('')

  // — Qualitative self-monitoring —
  lines.push('── QUALITATIVE SELF-MONITORING ──')
  lines.push(`14-day avg stress:  ${avgStress}/10`)
  lines.push(`14-day avg energy:  ${avgEnergy}/10`)
  lines.push(`Burnout risk:       ${burnoutRisk.toUpperCase()}`)

  if (mentalLogs.length > 0) {
    lines.push(`Recent mood entries (newest first):`)
    mentalLogs.slice(0, MAX_MOOD_LOGS_IN_PROMPT).forEach(l => {
      const note = truncate(l.qualitativeNotes, MAX_NOTE_CHARS)
      lines.push(
        `  ${l.logDate}: mood=${capitalize(l.moodVector)} | stress=${l.stressLevel}/10 | energy=${l.energyLevel}/10` +
        (note ? ` | journal: "${note}"` : ''),
      )
    })
  } else {
    lines.push('  No mood logs recorded in the lookback window.')
  }

  // — Dashboard presets —
  try {
    const presetsRaw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('zenith_dashboard_presets_v1')
      : null
    if (presetsRaw) {
      const presets = JSON.parse(presetsRaw) as Array<{ name: string }>
      if (presets.length > 0) {
        lines.push('')
        lines.push('── SAVED DASHBOARD PRESETS ──')
        presets.forEach(p => lines.push(`  • "${p.name}"`))
        lines.push('(use load_dashboard_preset to apply one by name)')
      }
    }
  } catch { /* localStorage unavailable — skip */ }

  lines.push('')
  lines.push('════ END CONTEXT SNAPSHOT ════')

  const systemPrompt = lines.join('\n')

  return {
    compiledAt: new Date().toISOString(),
    systemPrompt,
    stats: {
      assignmentsCompleted: completed.length,
      assignmentsOverdue:   overdue.length,
      assignmentsPending:   pending.length,
      avgHabitStreak:       avgStreak,
      habitCount:           habits.length,
      avgStressLevel:       avgStress,
      avgEnergyLevel:       avgEnergy,
      burnoutRisk,
      recentMoodKeys:       mentalLogs.slice(0, 5).map(l => l.moodVector),
    },
  }
}
