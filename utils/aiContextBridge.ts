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
import { todayISO, toLocalDateStr } from '@/utils/localDate'

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
  return toLocalDateStr(d)
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
  lines.push('This snapshot spans the user\'s ENTIRE Zenith workspace — tasks, habits, mood,')
  lines.push('library, calendar, workouts, meals, subscriptions, vocabulary, links and identity.')
  lines.push(`(Tasks & mood use a ${LOOKBACK_DAYS}-day window; other sections reflect current state.)`)
  lines.push('You can read all of it AND act on any of it using your tools.')
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

  /* ── 5. Whole-app snapshot — everything else the co-pilot can see & act on ── */
  const nowMs      = Date.now()
  const in14dMs    = nowMs + 14 * 86_400_000
  const weekAgoMs  = nowMs - 7 * 86_400_000
  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p } catch { return fallback }
  }

  // Pull the rest of the user's data in parallel (each guarded).
  const [
    books, personalEvents, feedEvents, cardio, recipes, mealSlots,
    subs, vocabCards, vocabDecks, bookmarks, plants, profile,
  ] = await Promise.all([
    safe(db.library_books.toArray(),    []),
    safe(db.personalEvents.toArray(),   []),
    safe(db.calendarEvents.toArray(),   []),
    safe(db.cardioSessions.toArray(),   []),
    safe(db.savedMealRecipes.toArray(), []),
    safe(db.mealPlanSlots.toArray(),    []),
    safe(db.subscription_items.toArray(), []),
    safe(db.vocab_cards.toArray(),      []),
    safe(db.vocab_decks.toArray(),      []),
    safe(db.customBookmarks.toArray(),  []),
    safe(db.houseplants.toArray(),      []),
    safe(db.userProfile.get(1),         undefined),
  ])

  // — Library —
  if (books.length > 0) {
    const reading   = books.filter(b => b.readingStatus === 'CURRENTLY_READING')
    const completed = books.filter(b => b.readingStatus === 'COMPLETED')
    const toRead    = books.filter(b => b.readingStatus === 'TO_READ')
    const missing   = books.filter(b => !b.totalPages || !b.genre).length
    lines.push('')
    lines.push('── LIBRARY (books) ──')
    lines.push(`Total: ${books.length} | reading: ${reading.length} | finished: ${completed.length} | to-read: ${toRead.length}`)
    if (missing > 0) lines.push(`${missing} book(s) missing details (pages/genre) — offer to research & autofill via update_book.`)
    reading.slice(0, 4).forEach(b => lines.push(`  READING: "${b.title}" by ${b.author}`))
    ;[...completed].sort((a, b) => (b.dateCompleted ?? 0) - (a.dateCompleted ?? 0)).slice(0, 6)
      .forEach(b => lines.push(`  FINISHED: "${b.title}" by ${b.author}${b.userRating ? ` (${b.userRating}★)` : ''}`))
  }

  // — Calendar (upcoming) —
  const upcomingPersonal = personalEvents
    .filter(e => e.startMs >= nowMs && e.startMs <= in14dMs)
    .sort((a, b) => a.startMs - b.startMs)
  const upcomingFeed = feedEvents.filter(e => e.startMs >= nowMs && e.startMs <= in14dMs).length
  if (upcomingPersonal.length > 0 || upcomingFeed > 0) {
    lines.push('')
    lines.push('── CALENDAR (next 14 days) ──')
    lines.push(`Personal events: ${upcomingPersonal.length} | subscribed-feed events: ${upcomingFeed}`)
    upcomingPersonal.slice(0, 6).forEach(e => {
      const d = new Date(e.startMs)
      lines.push(`  ${toLocalDateStr(d)} — "${e.title}" [${e.category}]`)
    })
  }

  // — Workouts —
  if (cardio.length > 0) {
    const week = cardio.filter(c => c.completedAt >= weekAgoMs)
    const weekMins = week.reduce((s, c) => s + (c.durationMinutes || 0), 0)
    lines.push('')
    lines.push('── WORKOUTS (cardio) ──')
    lines.push(`Logged sessions: ${cardio.length} | this week: ${week.length} session(s), ${weekMins} min`)
  }

  // — Meals —
  if (recipes.length > 0 || mealSlots.length > 0) {
    lines.push('')
    lines.push('── MEALS ──')
    lines.push(`Saved recipes: ${recipes.length} | planned meal slots: ${mealSlots.length}`)
    recipes.slice(0, 5).forEach(r => lines.push(`  recipe: "${r.title}"${r.category ? ` [${r.category}]` : ''}`))
  }

  // — Subscriptions —
  if (subs.length > 0) {
    const monthly = subs.reduce((s, x) =>
      s + (x.billingCycle === 'ANNUAL' ? (x.monthlyCost || 0) / 12 : (x.monthlyCost || 0)), 0)
    lines.push('')
    lines.push('── SUBSCRIPTIONS ──')
    lines.push(`Active: ${subs.length} | est. monthly outflow: $${monthly.toFixed(2)}`)
    subs.slice(0, 6).forEach(x => lines.push(`  "${x.name}" — $${x.monthlyCost}/${x.billingCycle === 'ANNUAL' ? 'yr' : 'mo'}`))
  }

  // — Vocabulary (spaced repetition) —
  if (vocabCards.length > 0) {
    const due = vocabCards.filter(c => (c.nextReviewTimestamp ?? 0) <= nowMs).length
    lines.push('')
    lines.push('── POLYGLOT VAULT (vocab) ──')
    lines.push(`Decks: ${vocabDecks.length} | cards: ${vocabCards.length} | due for review now: ${due}`)
  }

  // — Custom links —
  if (bookmarks.length > 0) {
    const folders = [...new Set(bookmarks.map(b => b.folderName).filter(Boolean))]
    lines.push('')
    lines.push('── SAVED LINKS ──')
    lines.push(`${bookmarks.length} link(s)${folders.length ? ` across: ${folders.slice(0, 8).join(', ')}` : ''}`)
  }

  // — Plants —
  if (plants.length > 0) {
    lines.push('')
    lines.push(`── BOTANIST ── ${plants.length} plant(s) tracked.`)
  }

  // — Identity —
  if (profile && (profile.universityName || profile.majorIdentifier || profile.userName)) {
    lines.push('')
    lines.push('── IDENTITY ──')
    if (profile.userName)        lines.push(`Name: ${profile.userName}`)
    if (profile.universityName)  lines.push(`University: ${profile.universityName}`)
    if (profile.majorIdentifier) lines.push(`Major: ${profile.majorIdentifier}`)
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
