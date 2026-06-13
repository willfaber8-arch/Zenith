/**
 * analyticsAggregator.ts — Phase 15.2 · Ecosystem Wrapped
 *
 * Asynchronous multi-table historical data synthesiser.
 *
 * Design contract:
 *   - Every table read is separated by a yield$() microtask break so the
 *     main thread stays responsive during large-dataset scans (thousands of
 *     rows of historical habits / sessions / vocab cards never freeze the UI).
 *   - All arithmetic is integer-safe; floating-point percentages are clamped
 *     to [0, 100] before inclusion in the result.
 *   - The persona assignment is purely data-driven — a normalised dominance
 *     score is computed across four career archetypes and the highest scorer
 *     with score > 0.2 wins; otherwise the neutral fallback is applied.
 *   - No IDB writes occur; this is a pure read aggregation pass.
 */

import { db } from '@/lib/db'

/* ══════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════ */

export type PersonaId =
  | 'ARCHITECT_OF_SYSTEM_FOCUS'
  | 'COGNITIVE_LINGUIST'
  | 'DISCIPLINE_ARCHITECT'
  | 'KNOWLEDGE_CURATOR'
  | 'ZENITH_OPERATIVE'

export type EcosystemMetrics = {
  /* Slide 1 — Operational Overview */
  totalCompletedTasks:    number
  completedAcademic:      number
  completedLife:          number
  academicPct:            number   // 0–100 integer
  mostProductiveDay:      string   // "YYYY-MM-DD" or "—"
  mostProductiveDayCount: number

  /* Slide 2 — Memory Vault */
  vocabCardsRetained:     number   // SM-2 reviewIntervalDays >= 21
  vocabCardsTotal:        number
  booksCompleted:         number
  totalPagesRead:         number

  /* Slide 3 — Habit Matrix */
  peakHabitStreak:        number
  totalHabitCompletions:  number
  focusHoursLogged:       number   // Pomodoro work sessions, rounded

  /* Slide 4 — System Persona */
  personaId:              PersonaId
  personaTitle:           string
  personaTagline:         string
  personaGlyph:           string

  /* Meta */
  generatedAt:            number   // UTC ms
}

/* ── Persona definitions ──────────────────────────────────────── */

const PERSONA_DATA: Record<PersonaId, {
  title:   string
  tagline: string
  glyph:   string
}> = {
  ARCHITECT_OF_SYSTEM_FOCUS: {
    title:   'ARCHITECT OF SYSTEM FOCUS',
    tagline: 'Your execution record is a testament to relentless, systematic discipline.',
    glyph:   '◈',
  },
  COGNITIVE_LINGUIST: {
    title:   'THE COGNITIVE LINGUIST',
    tagline: 'Language is your weapon. Memory is your forge.',
    glyph:   '⟡',
  },
  DISCIPLINE_ARCHITECT: {
    title:   'THE DISCIPLINE ARCHITECT',
    tagline: 'Consistency compounds. Your streak record proves it beyond doubt.',
    glyph:   '◎',
  },
  KNOWLEDGE_CURATOR: {
    title:   'THE KNOWLEDGE CURATOR',
    tagline: 'Books read. Patterns decoded. Wisdom quietly accumulated.',
    glyph:   '▣',
  },
  ZENITH_OPERATIVE: {
    title:   'ZENITH SYSTEM OPERATIVE',
    tagline: 'The system is calibrated. The mission is ongoing.',
    glyph:   '✦',
  },
}

/* ── Event-loop yield helper ──────────────────────────────────── */

/*
 * Yields control back to the browser event loop between processing chunks.
 * Each IDB toArray() call is already async (never blocks the main thread),
 * but the synchronous data-processing loops that follow can be slow on
 * large datasets.  Inserting a yield$() after each heavy pass ensures
 * the browser can flush paints and handle user input between chunks.
 */
const yield$ = (): Promise<void> => new Promise(r => setTimeout(r, 0))

/* ══════════════════════════════════════════════════════════════════
   generateEcosystemMetrics
   ══════════════════════════════════════════════════════════════════ */

export async function generateEcosystemMetrics(): Promise<EcosystemMetrics> {

  /* ── Chunk 1: Assignments ────────────────────────────────────── */
  const assignments = await db.assignments.toArray()
  await yield$()

  const completed        = assignments.filter(a => a.status === 'completed')
  const completedAcademic = completed.filter(a => !!a.courseId?.trim()).length
  const completedLife     = completed.length - completedAcademic
  const academicPct       = completed.length > 0
    ? Math.round((completedAcademic / completed.length) * 100)
    : 0

  /*
   * Most productive calendar day — proxy: group completed tasks by their
   * dueDate ISO prefix.  Not a perfect "completion timestamp" (that field
   * doesn't exist on the schema) but a meaningful structural proxy for
   * deadline-driven peak-execution days.
   */
  const dayMap = new Map<string, number>()
  for (const a of completed) {
    if (a.dueDate) {
      const day = String(a.dueDate).slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
    }
  }
  await yield$()

  let mostProductiveDay      = '—'
  let mostProductiveDayCount = 0
  for (const [day, count] of dayMap) {
    if (count > mostProductiveDayCount) {
      mostProductiveDayCount = count
      mostProductiveDay      = day
    }
  }

  /* ── Chunk 2: Habits ─────────────────────────────────────────── */
  const habits = await db.habits.toArray()
  await yield$()

  /*
   * Peak streak: prefer allTimeHighStreak (persisted by the tracker's
   * increment() handler) then fall back to the current live streakCount
   * in case the record was created before the allTimeHigh field was added.
   */
  const peakHabitStreak = habits.reduce(
    (max, h) => Math.max(max, h.allTimeHighStreak ?? h.streakCount ?? 0),
    0,
  )

  const totalHabitCompletions = await db.habitCompletions.count()
  await yield$()

  /* ── Chunk 3: Pomodoro sessions ──────────────────────────────── */
  const sessions = await db.pomodoroSessions.toArray()
  await yield$()

  const focusMinutes = sessions
    .filter(s => s.sessionType === 'work')
    .reduce((sum, s) => sum + (s.durationMinutes ?? 25), 0)
  const focusHoursLogged = Math.round(focusMinutes / 60)

  /* ── Chunk 4: Vocabulary cards ───────────────────────────────── */
  const allCards = await db.vocab_cards.toArray()
  await yield$()

  /*
   * "Long-term retention" threshold: SM-2 reviewIntervalDays >= 21.
   * A card reviewed at a 3-week+ cadence has been successfully promoted
   * through multiple recall cycles and is considered consolidated in memory.
   */
  const vocabCardsTotal    = allCards.length
  const vocabCardsRetained = allCards.filter(c => c.reviewIntervalDays >= 21).length

  /* ── Chunk 5: Library books ──────────────────────────────────── */
  const allBooks = await db.library_books.toArray()
  await yield$()

  const completedBooks  = allBooks.filter(b => b.readingStatus === 'COMPLETED')
  const booksCompleted  = completedBooks.length
  const totalPagesRead  = completedBooks.reduce(
    (sum, b) => sum + (b.totalPages ?? 0), 0,
  )

  /* ── Persona assignment ──────────────────────────────────────── */
  /*
   * Normalise each metric against a "proficient" reference value.
   * Score 1.0 = reached the reference level; > 1.0 = exceeded it.
   * The persona with the highest normalised score (threshold > 0.20)
   * is selected; below threshold defaults to ZENITH_OPERATIVE.
   */
  const personaScores: Record<PersonaId, number> = {
    ARCHITECT_OF_SYSTEM_FOCUS: completed.length      / 20,
    COGNITIVE_LINGUIST:        vocabCardsRetained     / 15,
    DISCIPLINE_ARCHITECT:      peakHabitStreak        / 21,
    KNOWLEDGE_CURATOR:         booksCompleted         /  5,
    ZENITH_OPERATIVE:          0,   // never wins the comparison loop
  }

  const THRESHOLD = 0.20
  let winnerPersona: PersonaId = 'ZENITH_OPERATIVE'
  let winnerScore               = THRESHOLD

  for (const [id, score] of Object.entries(personaScores) as [PersonaId, number][]) {
    if (id === 'ZENITH_OPERATIVE') continue
    if (score > winnerScore) { winnerScore = score; winnerPersona = id }
  }

  const { title, tagline, glyph } = PERSONA_DATA[winnerPersona]

  return {
    totalCompletedTasks:    completed.length,
    completedAcademic,
    completedLife,
    academicPct,
    mostProductiveDay,
    mostProductiveDayCount,
    vocabCardsRetained,
    vocabCardsTotal,
    booksCompleted,
    totalPagesRead,
    peakHabitStreak,
    totalHabitCompletions,
    focusHoursLogged,
    personaId:      winnerPersona,
    personaTitle:   title,
    personaTagline: tagline,
    personaGlyph:   glyph,
    generatedAt:    Date.now(),
  }
}
