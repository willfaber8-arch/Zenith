/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Browser Database Engine
 * Phase 1 · Step 1.3 — Dexie.js / IndexedDB Binding
 *
 * Architecture:
 *   Dexie.js v4 is a transactional wrapper over the browser's native
 *   IndexedDB API. It adds:
 *     • Promise-based async API (no callback hell)
 *     • TypeScript generics via EntityTable<T, PK>
 *     • Reactive live queries (via dexie-react-hooks in Phase 2)
 *     • Versioned schema migrations
 *     • Compound + multi-entry indices
 *
 * SSR Safety:
 *   Dexie defers all IndexedDB access until the first query executes,
 *   making `new ZenithDatabase()` safe at module scope in both the
 *   client bundle and the SSR evaluation pass.
 *   The exported `db` constant resolves to `null` (cast to the class
 *   type) on the server — queries are exclusively reached inside
 *   `useEffect` / event handlers which only run in the browser.
 *   `getDb()` provides an explicit runtime guard for any call site
 *   that wants a hard error on server-side misuse.
 *
 * Database name  : "ZenithOS"
 * Schema version : 1
 * ════════════════════════════════════════════════════════════════
 */

import Dexie, { type EntityTable } from 'dexie'
import type { CourseIntensityProfile } from '@/types/academics'
export type { CourseIntensityProfile } from '@/types/academics'
import type { WaterLog } from '@/utils/waterChemistry'
export type { WaterLog } from '@/utils/waterChemistry'
import type { Houseplant } from '@/types/botany'
export type { Houseplant } from '@/types/botany'
import type { DeliveryItem } from '@/types/finance'
export type { DeliveryItem } from '@/types/finance'
import type { MentalHealthLog } from '@/utils/mentalHealthLog'
export type { MentalHealthLog } from '@/utils/mentalHealthLog'
import { applyXpGain, type HabitDifficulty } from '@/utils/rpgEngine'
export type { HabitDifficulty } from '@/utils/rpgEngine'
import type { OutboxMutation } from '@/types/syncQueue'
export type { OutboxMutation } from '@/types/syncQueue'


/* ════════════════════════════════════════════════════════════════
   1.  TYPESCRIPT ROW INTERFACES
   ────────────────────────────────────────────────────────────────
   Each interface maps 1-to-1 with an IndexedDB object store.
   Fields marked with (* indexed) are registered in the Dexie
   schema string and can be used in `.where()` / `.orderBy()` calls.
   Non-indexed fields are stored but only retrievable via full-scan
   or by fetching the row by primary key.
   ════════════════════════════════════════════════════════════════ */

/**
 * Assignment — academic task or assessment entry.
 * Powers: Study Shield, GPA Calculator, University Hub.
 */
export interface Assignment {
  id:          number           // * PK — auto-increment
  title:       string           // * indexed — quick title lookup
  dueDate:     string           // * indexed — ISO-8601 date ("YYYY-MM-DD")
  courseId:    string           // * indexed — FK-style link to a course label
  status:      AssignmentStatus // * indexed — filter by pipeline stage
  priority:    Priority         // * indexed — sort/filter by urgency
  notes?:      string           //   free-text / Markdown body
  createdAt:   number           //   Unix timestamp ms
  updatedAt:   number           //   Unix timestamp ms — update on every save
  supabaseId?: string           // * indexed — cloud UUID assigned on first sync
}

/**
 * PendingSyncQueueItem — write-ahead log for offline-first cloud sync.
 * Phase 2 · Step 2.2 — sync engine queues mutations here; the reconciliation
 * pass drains them when the network is available.
 */
export interface PendingSyncQueueItem {
  id?:         number                        // * PK — auto-increment
  tableName:   'assignments' | 'userProfile' // * indexed — partition by entity
  operation:   'upsert' | 'delete'           // * indexed — distinguish write type
  recordId:    number                        //   local IndexedDB PK
  supabaseId:  string                        //   cloud UUID (pre-generated on enqueue)
  payload:     string                        //   JSON-serialised record snapshot
  timestamp:   number                        // * indexed — Unix ms; LWW comparison
  retryCount:  number                        // * indexed — exponential-backoff guard
}

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
export type Priority         = 'low' | 'medium' | 'high' | 'critical'

/**
 * Habit — recurring behaviour tracked with streak logic.
 * Powers: Grit-style habit stacking module.
 */
export interface Habit {
  id:                 number            // * PK — auto-increment
  name:               string            // * indexed — display + dedup lookup
  frequency:          HabitFrequency    // * indexed — filter by cadence
  streakCount:        number            // * indexed — sort leaderboard / gamification
  lastCompletedDate:  string | null     // * indexed — ISO-8601 date, null = never
  category:           string            // * indexed — e.g. "health", "study", "social"
  difficulty?:        HabitDifficulty   //   RPG tier; defaults to 'medium' when absent
  targetDays?:        number[]          //   0=Sun … 6=Sat (custom frequency only)
  notes?:             string            //   motivation memo / context
  createdAt:          number            //   Unix timestamp ms
  supabaseId?:        string            //   cloud UUID injected by syncBroker on first create
}

export type HabitFrequency = 'daily' | 'weekly' | 'custom'

/**
 * Workout — single exercise log entry.
 * Powers: Workouts module — physical metric history tracking.
 */
export interface Workout {
  id:            number       // * PK — auto-increment
  exerciseName:  string       // * indexed — e.g. "Squat", "Bench Press"
  sets:          number       // * indexed — volume queries (e.g. sets > 3)
  reps:          number       // * indexed — rep range filter
  weight:        number       // * indexed — kg; 0 = bodyweight exercise
  logDate:       string       // * indexed — ISO-8601 date; timeline queries
  type:          WorkoutType  // * indexed — category filter
  durationMins?: number       //   cardio / HIIT session length
  notes?:        string       //   form cues, RPE, mood
  supabaseId?:   string       //   cloud UUID injected by syncBroker on first create
}

export type WorkoutType = 'strength' | 'cardio' | 'mobility' | 'sport' | 'other'

/**
 * QuickNote — freeform text or Markdown entry.
 * Powers: note-stacking / knowledge base module.
 */
export interface QuickNote {
  id:         number   // * PK — auto-increment
  title:      string   // * indexed — search / list display
  updatedAt:  number   // * indexed — Unix timestamp ms; sort by recency
  category:   string   // * indexed — e.g. "lecture", "idea", "ref"
  body:        string   //   raw text or Markdown content
  pinned?:    boolean  //   float to top of list
  createdAt:  number   //   Unix timestamp ms
}

/**
 * CustomBookmark — user-defined URL entry for the Vault.
 * Powers: Custom Link Manager in Personalized Vault.
 */
export interface CustomBookmark {
  id:          number  // * PK — auto-increment
  label:       string  // * indexed — display name / search
  url:         string  // * indexed — dedup check
  folderName:  string  // * indexed — folder/group filter
  iconUrl?:    string  //   favicon or custom image URL
  addedAt:     number  //   Unix timestamp ms
  sortOrder?:  number  //   manual drag-reorder position
}

/**
 * CalendarFeed — an iCal / Canvas subscription URL.
 * Powers: Universal Calendar multi-feed engine (Phase 2 · Step 2.5).
 * One row per subscription; events are stored separately in calendarEvents.
 */
export interface CalendarFeed {
  id:            number   // * PK — auto-increment
  label:         string   // * indexed — user-supplied display name
  url:           string   //   full iCal URL (webcal:// or https://)
  color:         string   //   hex accent colour for event pills
  isActive:      number   // * indexed — 0 | 1 (Dexie can't index booleans)
  lastFetchedAt: number   // * indexed — Unix ms; stale-check guard
  createdAt:     number   //   Unix ms
}

/**
 * PomodoroSession — completed Pomodoro interval log.
 * Powers: Study Shield session analytics (Phase 3 · Step 3.2).
 */
export interface PomodoroSession {
  id?:              number   // * PK — auto-increment (omit on insert)
  sessionType:      'work' | 'short_break' | 'long_break'  // * indexed
  durationMinutes:  number   //   25 | 5 | 15
  completedAt:      number   // * indexed — Unix ms; sort/filter by date
  startedAt:        number   //   Unix ms; session duration audit
  distractionCount: number   //   interruptions logged during the session
}

/**
 * CalendarEvent — a single VEVENT parsed from a CalendarFeed.
 * Powers: Universal Calendar week grid + deadline banner system.
 *
 * All times are stored as Unix ms (UTC-anchored).
 * Display with `new Date(startMs)` — browser converts to local time.
 */
export interface CalendarEvent {
  id:           number   // * PK — auto-increment
  feedId:       number   // * indexed — FK → CalendarFeed.id
  uid:          string   // * indexed — iCal UID; dedup guard on re-fetch
  title:        string   // * indexed — event summary / assignment title
  startMs:      number   // * indexed — Unix ms (UTC)
  endMs:        number   //   Unix ms (UTC)
  allDay:       number   // * indexed — 0 | 1
  is1159:       number   // * indexed — 0 | 1; true = 23:59 deadline banner
  category:     string   // * indexed — 'scholastic'|'exam'|'life'|'general'
  location?:    string
  description?: string
}

/**
 * GpaSemester — a container for one semester's academic record.
 * Powers: GPA Calculator — historical locked record + what-if projections.
 */
export interface GpaSemester {
  id?:          number   // * PK — auto-increment (omit on insert)
  name:         string   //   "Fall 2023" — display label
  term:         'fall' | 'spring' | 'summer'  // * indexed
  year:         number   // * indexed
  displayOrder: number   // * indexed — year×10 + termIndex; chronological sort
  isProjected:  0 | 1   // * indexed — 0 = historical (locked), 1 = what-if
}

/**
 * GpaCourse — a single course entry within a GpaSemester.
 * Powers: GPA Calculator — grade-point weighting per course.
 */
export interface GpaCourse {
  id?:        number   // * PK — auto-increment (omit on insert)
  semesterId: number   // * indexed — FK → GpaSemester.id
  courseCode: string   //   "MATH 2220" — short code for display
  courseName: string   //   "Multivariable Calculus" — full name
  credits:    number   //   credit hours (1–6)
  grade:      string   // * indexed — GradeKey letter grade
}

/**
 * RpgEventLog — deduplication ledger for the RPG engine.
 * One row per processed event; the unique `eventKey` index prevents
 * the same XP award or HP penalty from firing more than once even
 * across tab reloads or concurrent sessions.
 *
 * Key format:
 *   Habit completion:        "h:<id>:<ISO-date>"
 *   Assignment completion:   "a:<id>:done"
 *   Overdue penalty (daily): "od:<id>:<ISO-date>"
 */
export interface RpgEventLog {
  id?:         number   // * PK — auto-increment (omit on insert)
  eventKey:    string   // * unique indexed — prevents double-processing
  processedAt: number   // * indexed — Unix ms; audit trail
}

/**
 * UserProfile — core RPG state vector. Single-row singleton (id = 1).
 * Powers: gamification layer, level display, XP progression.
 */
export interface UserProfile {
  id:               number   // * PK — always 1 (singleton pattern)
  userName:         string   // * indexed — display name sync with AuthContext
  universityName:   string   // * indexed — shown in University Hub header
  majorIdentifier:  string   // * indexed — e.g. "Computer Science", "Biology"
  expPoints:        number   // * indexed — total XP for level calculation
  currentLevel:     number   // * indexed — derived from expPoints but cached
  healthPoints:     number   // * indexed — HP pool for task-failure penalties
  goldPoints?:      number   //   Zenith Gold currency balance (Phase 5.4)
  avatarUrl?:       string                    //   external or data-URI avatar image
  lastActiveAt:     number                    //   Unix timestamp ms — streak guard
  /** Slot → itemId map for the avatar customizer (Phase 5.2). Non-indexed. */
  equippedItems?:   Record<string, string>    //   e.g. { head: 'scholar_crown', ... }
}


/* ════════════════════════════════════════════════════════════════
   2.  DATABASE CLASS
   ────────────────────────────────────────────────────────────────
   ZenithDatabase extends Dexie and declares every table with a
   strongly-typed EntityTable<RowType, PrimaryKeyField> handle.
   The `!` non-null assertions are required because TypeScript
   cannot see that version().stores() populates these handles at
   runtime — Dexie guarantees this internally.

   Schema string syntax (Dexie v4):
     ++id          auto-increment integer primary key
     id            explicit primary key (no auto-increment)
     &field        unique index
     [a+b]         compound index
     *field        multi-entry index (for array values)
     field         standard secondary index

   Only indexed fields appear in the schema string. Non-indexed
   fields are stored automatically — they just can't be used in
   .where() queries without a full-table scan.
   ════════════════════════════════════════════════════════════════ */

class ZenithDatabase extends Dexie {

  /* ── Table handles (typed via EntityTable) ───────────────── */
  assignments!:             EntityTable<Assignment,             'id'>
  habits!:                  EntityTable<Habit,                  'id'>
  workouts!:                EntityTable<Workout,                'id'>
  quickNotes!:              EntityTable<QuickNote,              'id'>
  customBookmarks!:         EntityTable<CustomBookmark,         'id'>
  userProfile!:             EntityTable<UserProfile,            'id'>
  pendingSyncQueue!:        EntityTable<PendingSyncQueueItem,   'id'>
  calendarFeeds!:           EntityTable<CalendarFeed,           'id'>
  calendarEvents!:          EntityTable<CalendarEvent,          'id'>
  pomodoroSessions!:        EntityTable<PomodoroSession,        'id'>
  gpaSemesters!:            EntityTable<GpaSemester,            'id'>
  gpaCourses!:              EntityTable<GpaCourse,              'id'>
  courseIntensityProfiles!: EntityTable<CourseIntensityProfile, 'id'>
  waterLogs!:              EntityTable<WaterLog,              'id'>
  houseplants!:            EntityTable<Houseplant,            'id'>
  deliveries!:             EntityTable<DeliveryItem,          'id'>
  rpgEventLog!:            EntityTable<RpgEventLog,           'id'>
  mentalHealthLogs!:       EntityTable<MentalHealthLog,       'id'>
  outboxMutations!:        EntityTable<OutboxMutation,        'id'>

  constructor() {
    super('ZenithOS')

    /*
     * Version 1 — initial schema.
     *
     * Migration note: increment this version number and add a new
     * version(2).stores({...}).upgrade(tx => { ... }) block when
     * adding tables or changing indices in future phases. Never
     * mutate an existing version() entry — IDB migrations are
     * append-only to preserve data integrity.
     */
    this.version(1).stores({
      // ── VERTICAL PILLAR 1: Zenith Essentials ───────────────
      assignments:
        '++id, title, dueDate, courseId, status, priority',

      habits:
        '++id, name, frequency, streakCount, lastCompletedDate, category',

      // ── VERTICAL PILLAR 1 (Life Sub-Tier) ──────────────────
      workouts:
        '++id, exerciseName, sets, reps, weight, logDate, type',

      // ── Cross-Pillar utility tables ─────────────────────────
      quickNotes:
        '++id, title, updatedAt, category',

      // ── VERTICAL PILLAR 3: Personalized Vault ──────────────
      customBookmarks:
        '++id, label, url, folderName',

      // ── Core RPG state (singleton row, id always = 1) ──────
      userProfile:
        'id, userName, universityName, majorIdentifier, expPoints, currentLevel, healthPoints',
    })

    /*
     * Version 2 — Phase 2 · Step 2.2 (Cloud Sync Pipeline)
     *
     * Changes:
     *   assignments    — adds `supabaseId` secondary index; existing rows
     *                    get undefined for this field (no data loss).
     *   pendingSyncQueue (new) — write-ahead log for offline-first cloud sync.
     *                    Each queued item represents one pending mutation that
     *                    the reconciliation pass will flush to Supabase.
     *
     * Migration note: Dexie upgrades the IndexedDB schema without destroying
     * existing data. Only changed / new stores need to be listed here — all
     * other stores carry over from version 1 unchanged.
     */
    this.version(2).stores({
      assignments:
        '++id, title, dueDate, courseId, status, priority, supabaseId',

      pendingSyncQueue:
        '++id, tableName, operation, timestamp, retryCount',
    })

    /*
     * Version 3 — Phase 2 · Step 2.5 (iCal / Canvas Calendar Engine)
     *
     * New tables:
     *   calendarFeeds  — one row per iCal subscription URL.
     *   calendarEvents — normalised VEVENT rows linked to a feed.
     *
     * All prior tables carry forward untouched.
     */
    this.version(3).stores({
      calendarFeeds:
        '++id, label, isActive, lastFetchedAt',

      calendarEvents:
        '++id, feedId, uid, title, startMs, allDay, is1159, category',
    })

    /*
     * Version 4 — adds `createdAt` index to calendarFeeds so
     * feed lists can be sorted without a JS fallback.
     */
    this.version(4).stores({
      calendarFeeds:
        '++id, label, isActive, lastFetchedAt, createdAt',
    })

    /*
     * Version 5 — Phase 3 · Step 3.2 (Pomodoro State Machine)
     *
     * New table:
     *   pomodoroSessions — one row per completed Pomodoro interval.
     *   sessionType and completedAt are indexed for analytics queries
     *   (e.g. "all work sessions today", "sessions by type this week").
     */
    this.version(5).stores({
      pomodoroSessions:
        '++id, sessionType, completedAt, startedAt',
    })

    /*
     * Version 6 — Phase 3 · Step 3.3 (Predictive GPA Simulator)
     *
     * New tables:
     *   gpaSemesters — one row per semester (historical or projected).
     *     displayOrder (year×10 + termIndex) enables chronological
     *     sorting without a JS sort pass.
     *   gpaCourses   — one row per course; FK to gpaSemesters.
     *     grade is indexed so future analytics can group by letter grade.
     */
    this.version(6).stores({
      gpaSemesters: '++id, year, term, displayOrder, isProjected',
      gpaCourses:   '++id, semesterId, grade',
    })

    /*
     * Version 7 — Phase 3 · Step 3.4 (Course Load Matrix & Cognitive Load Map)
     *
     * New table:
     *   courseIntensityProfiles — one row per course; stores mathIntensity,
     *     codingIntensity, and memorizationIntensity scalars (1–10 each).
     *     courseCode is indexed for fast lookup when matching calendar events.
     *     updatedAt is indexed so the UI can order by most-recently edited.
     */
    this.version(7).stores({
      courseIntensityProfiles: '++id, courseCode, updatedAt',
    })

    /*
     * Version 8 — Phase 4 · Step 4.3 (Hardscape Simulator & Water Parameter Logger)
     *
     * New table:
     *   waterLogs — one row per manual water chemistry test reading.
     *     logDate indexed for chronological timeline queries.
     *     createdAt indexed for insertion-order retrieval and de-duplication.
     *     Stores: pH, ammonia (NH3), nitrite (NO2−), nitrate (NO3−), notes.
     */
    this.version(8).stores({
      waterLogs: '++id, logDate, createdAt',
    })

    /*
     * Version 9 — Phase 4 · Step 4.6 (Botanist Node — Plant Care Monitor)
     *
     * New table:
     *   houseplants — one row per indoor plant in the user's collection.
     *     plantName indexed for display ordering.
     *     lastWateredDate indexed for overdue queries.
     *     wateringIntervalDays stored for dryness-delta calculations.
     */
    this.version(9).stores({
      houseplants: '++id, plantName, lastWateredDate',
    })

    /*
     * Version 10 — Phase 4 · Step 4.7 (BRB Burn Rate & Deliveries Logger)
     *
     * New table:
     *   deliveries — packages in transit + active software subscriptions.
     *     carrier indexed for grouping by shipping provider.
     *     status indexed for filtering (in_transit / arrived / active).
     *     estimatedArrival indexed for sorting by expected date.
     *     createdAt indexed for insertion-order display.
     */
    this.version(10).stores({
      deliveries: '++id, carrier, status, estimatedArrival, createdAt',
    })

    /*
     * Version 11 — Phase 5 · Step 5.1 (Grit-Style RPG Lifecycle Engine)
     *
     * New table:
     *   rpgEventLog — deduplication ledger for the RPG engine.
     *     &eventKey is a UNIQUE index — any duplicate insert throws,
     *     which the engine catches to prevent double XP/HP processing
     *     across tab reloads or concurrent sessions.
     *     processedAt indexed for audit queries and retention pruning.
     */
    this.version(11).stores({
      rpgEventLog: '++id, &eventKey, processedAt',
    })

    /*
     * Version 12 — Phase 5 · Step 5.7 (Mental Health Mapping)
     *
     * New table:
     *   mentalHealthLogs — one row per calendar day.
     *     logDate indexed for the rolling 3-day evaluator window query.
     *     createdAt indexed for insertion-order audit.
     *     Stores: stressLevel (1–10), energyLevel (1–10),
     *             qualitativeNotes, moodVector (MoodKey string).
     */
    this.version(12).stores({
      mentalHealthLogs: '++id, logDate, createdAt',
    })

    /*
     * Version 13 — Phase 6 · Step 6.4 (Database Synchronisation Broker)
     *
     * New table:
     *   outboxMutations — write-ahead outbox for the syncBroker. Complements
     *     the existing pendingSyncQueue (Phase 2.2) with wider table coverage
     *     (habits + workouts), structured CREATE/UPDATE/DELETE semantics, and
     *     bulk-batched LWW flush logic.
     *
     *   id         — explicit string PK (client UUID, no auto-increment)
     *   tableName  — indexed for per-table grouping during the flush pass
     *   action     — indexed for filtering CREATE/UPDATE/DELETE subsets
     *   timestamp  — indexed for chronological ordering (oldest-first drain)
     *
     *   payload and updatedAt are non-indexed — accessed via full-record read.
     */
    this.version(13).stores({
      outboxMutations: 'id, tableName, action, timestamp',
    })
  }
}


/* ════════════════════════════════════════════════════════════════
   3.  SINGLETON INITIALIZATION  ( SSR-Safe )
   ────────────────────────────────────────────────────────────────
   `db` is initialised once at module evaluation time.
   • Client bundle  → real ZenithDatabase instance
   • Server bundle  → null, cast to ZenithDatabase type
     (never reached because all queries live inside useEffect /
      event handlers which only execute in the browser)

   Use `getDb()` at any call site that wants an explicit runtime
   error if it somehow runs outside browser context.
   ════════════════════════════════════════════════════════════════ */

/**
 * The global ZenithOS database instance.
 *
 * Always access `db` inside `useEffect`, event handlers, or
 * server actions that explicitly target browser storage.
 * Never call `db.*` at the top level of a Server Component.
 */
export const db: ZenithDatabase =
  typeof window !== 'undefined'
    ? new ZenithDatabase()
    : (null as unknown as ZenithDatabase)

/**
 * SSR-guarded accessor — throws a clear error if somehow invoked
 * outside the browser context. Prefer this over raw `db` in
 * library-level helpers that might be accidentally server-imported.
 */
export function getDb(): ZenithDatabase {
  if (typeof window === 'undefined') {
    throw new Error(
      '[ZenithDB] Attempted to access the database outside a browser context.\n' +
      'Wrap all db calls in useEffect(), event handlers, or Route Handlers.\n' +
      'Server Components must never import reactive DB utilities.'
    )
  }
  return db
}


/* ════════════════════════════════════════════════════════════════
   4.  CONVENIENCE HELPERS
   ────────────────────────────────────────────────────────────────
   Thin wrappers over common Dexie patterns. Downstream hooks and
   components should prefer calling db.tableName.* directly for
   complex queries, and reserve these helpers for bootstrapping
   and cross-table operations.
   ════════════════════════════════════════════════════════════════ */

/**
 * Ensures a UserProfile singleton exists (id = 1).
 * Call once on first authenticated load. Safe to call multiple
 * times — will not overwrite an existing profile.
 */
export async function seedUserProfile(
  userName: string,
  opts: Partial<Omit<UserProfile, 'id' | 'userName'>> = {},
): Promise<UserProfile> {
  const existing = await getDb().userProfile.get(1)
  if (existing) return existing

  const profile: UserProfile = {
    id:              1,
    userName,
    universityName:  opts.universityName  ?? '',
    majorIdentifier: opts.majorIdentifier ?? '',
    expPoints:       opts.expPoints       ?? 0,
    currentLevel:    opts.currentLevel    ?? 1,
    healthPoints:    opts.healthPoints    ?? 100,
    goldPoints:      opts.goldPoints      ?? 0,
    avatarUrl:       opts.avatarUrl,
    lastActiveAt:    Date.now(),
  }
  await getDb().userProfile.add(profile)
  return profile
}

/**
 * Awards XP to the user profile using the Phase 5 RPG math engine.
 * Handles multi-level cascades and HP restoration on level-up.
 * Formula: EXP_Required = 100 × Level^1.5 (progressive quadratic curve).
 */
export async function awardXp(amount: number): Promise<void> {
  await getDb().userProfile.where('id').equals(1).modify(profile => {
    const result = applyXpGain(
      {
        expPoints:    profile.expPoints,
        currentLevel: profile.currentLevel,
        healthPoints: profile.healthPoints,
      },
      amount,
    )
    profile.expPoints    = result.expPoints
    profile.currentLevel = result.currentLevel
    profile.healthPoints = result.healthPoints
    profile.lastActiveAt = Date.now()
  })
}


/* ════════════════════════════════════════════════════════════════
   5.  BACKWARD-COMPATIBILITY SHIM
   ────────────────────────────────────────────────────────────────
   Keeps Phase 0 consumers (HomeScreen.tsx, etc.) compiling and
   running without modifications while the codebase migrates to
   the Dexie API. These will be removed in Phase 2 once every
   caller has been updated to query db.assignments directly.
   ════════════════════════════════════════════════════════════════ */

/**
 * @deprecated Use the `Assignment` interface instead.
 * Retained for HomeScreen.tsx backward compatibility.
 */
export type Task = {
  id:          string   // was crypto.randomUUID(); now stringified auto-id
  title:       string
  urgent:      boolean
  completed:   boolean
  dueDate?:    string   // ISO-8601 date string
  createdAt:   number   // Unix timestamp ms
}

/**
 * @deprecated Query `db.assignments` directly with Dexie filters.
 *
 * Returns assignments where priority is high/critical and status
 * is not completed — maps to the old "urgent + not done" concept.
 */
export async function getUrgentTasks(): Promise<Task[]> {
  const rows = await getDb()
    .assignments
    .where('status')
    .noneOf(['completed', 'overdue'])
    .filter(a => a.priority === 'high' || a.priority === 'critical')
    .toArray()

  return rows.map(a => ({
    id:        String(a.id),
    title:     a.title,
    urgent:    true,
    completed: false,
    dueDate:   a.dueDate,
    createdAt: a.createdAt,
  }))
}

/**
 * Restores HP to the user profile (Phase 5.6 Recovery Cycle reward).
 * Result is capped at `cap` (default 100) to prevent overflow.
 */
export async function awardHp(amount: number, cap = 100): Promise<void> {
  await getDb().userProfile.where('id').equals(1).modify(profile => {
    profile.healthPoints = Math.min(cap, (profile.healthPoints ?? 0) + amount)
    profile.lastActiveAt = Date.now()
  })
}

/**
 * Awards Zenith Gold to the user profile (Phase 5.4 Quest Economy).
 * Handles profiles created before goldPoints existed via the ?? 0 fallback.
 */
export async function awardGold(amount: number): Promise<void> {
  await getDb().userProfile.where('id').equals(1).modify(profile => {
    profile.goldPoints = (profile.goldPoints ?? 0) + amount
    profile.lastActiveAt = Date.now()
  })
}

/**
 * @deprecated Use `db.assignments.add()` with a full Assignment object.
 */
export async function addTask(
  task: Omit<Task, 'id' | 'createdAt'>,
): Promise<Task> {
  const now = Date.now()
  const id  = await getDb().assignments.add({
    title:     task.title,
    dueDate:   task.dueDate ?? new Date().toISOString().slice(0, 10),
    courseId:  'general',
    status:    task.completed ? 'completed' : 'pending',
    priority:  task.urgent   ? 'high'      : 'medium',
    createdAt: now,
    updatedAt: now,
  })
  return {
    id:        String(id),
    title:     task.title,
    urgent:    task.urgent,
    completed: task.completed,
    dueDate:   task.dueDate,
    createdAt: now,
  }
}

/**
 * @deprecated Use `db.assignments.update(id, { status: 'completed' })`.
 */
export async function completeTask(id: string): Promise<void> {
  const numId = parseInt(id, 10)
  if (!isNaN(numId)) {
    await getDb().assignments.update(numId, {
      status:    'completed',
      updatedAt: Date.now(),
    })
  }
}
