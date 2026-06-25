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
import type { DeliveryItem, SubscriptionItem } from '@/types/finance'
export type { DeliveryItem, SubscriptionItem } from '@/types/finance'
import type { PeerFriend, PeerLeaderboardSnapshot } from '@/types/friendsNetwork'
export type { PeerFriend, PeerLeaderboardSnapshot } from '@/types/friendsNetwork'
import type { RelationshipNote } from '@/types/relationshipNotes'
export type { RelationshipNote } from '@/types/relationshipNotes'
import type { PeerLocation } from '@/types/distanceTracker'
export type { PeerLocation } from '@/types/distanceTracker'
import type { MentalHealthLog } from '@/utils/mentalHealthLog'
export type { MentalHealthLog } from '@/utils/mentalHealthLog'
import type { OutboxMutation } from '@/types/syncQueue'
export type { OutboxMutation } from '@/types/syncQueue'
import type { AquascapeLayout } from '@/types/hardscape'
export type { AquascapeLayout } from '@/types/hardscape'
import type { VocabDeck, VocabCard } from '@/types/vocabulary'
export type { VocabDeck, VocabCard } from '@/types/vocabulary'
import type { CardioRun, BaseInventory, BaseUpgrade } from '@/types/cardioGame'
export type { CardioRun, BaseInventory, BaseUpgrade } from '@/types/cardioGame'
import type { LibraryBook } from '@/types/bookTracker'
export type { LibraryBook } from '@/types/bookTracker'


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
  category?:   string           // * indexed — broad grouping label (e.g. "scholastic", "life")
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
  name:               string            // * indexed — display name
  frequency:          HabitFrequency    // * indexed — 'daily' | 'specific_days'
  streakCount:        number            // * indexed — current streak length
  lastCompletedDate:  string | null     // * indexed — ISO-8601 date of last full completion
  category:           string            // * indexed — e.g. "health", "study"
  activeDays:         number[]          //   0=Sun … 6=Sat; empty = every day
  targetCompletions:  number            //   the daily goal value (e.g. 20)
  stepAmount?:        number            //   how much each tap adds (e.g. 5)
  stepLabel?:         string            //   unit label for display, e.g. "oz"
  goalDescription?:   string            //   legacy text descriptor
  color?:             string            //   hex accent colour for the habit row
  allTimeHighStreak?: number            //   all-time highest streak
  streakSaveUsed?:    boolean           //   grace-period save used this streak
  autoSource?:        string            //   HabitAutoSource id — auto-fills from another tab
  goalType?:          'at_least' | 'at_most'  // default at_least; at_most = stay under target
  overGoalStreak?:    number            //   consecutive days exceeding target (at_least only)
  lastExceededDate?:  string            //   last ISO date when count > target (at_least only)
  notes?:             string
  createdAt:          number
  supabaseId?:        string
}

/** Daily completion log — one row per habit per day */
export interface HabitCompletion {
  id?:       number   // * PK
  habitId:   number   // * indexed — FK → Habit.id
  date:      string   // * indexed — ISO-8601 "YYYY-MM-DD"
  count:     number   //   how many times completed this day
}

export type HabitFrequency = 'daily' | 'specific_days'

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

/* ── Meal Planning (v17) ─────────────────────────────────────────── */

export type MealType  = 'breakfast' | 'lunch' | 'dinner'
export type PlanType  = 'home' | 'dining_hall' | 'dining_out' | 'takeout' | 'delivery'

export interface MealIngredient {
  name:           string
  quantity:       string   // e.g. "2 cups", "1 lb"
  estimatedPrice: number   // dollars, pre-filled from price DB
}

/** One meal slot in the weekly planner (one row per day×mealType). */
export interface MealPlanSlot {
  id?:            number     // * PK auto-increment
  weekStart:      string     // * indexed — ISO "YYYY-MM-DD" of that Monday
  dayIndex:       number     // * indexed — 0=Mon … 6=Sun
  mealType:       MealType   // * indexed
  mealName:       string
  planType:       PlanType
  ingredients:    MealIngredient[]   // JSON-stored array
  estimatedCost:     number   // dollars
  estimatedCalories: number   // kcal (0 = not set)
  cookMinutes:       number   // 0 for dining out
  recipeUrl?:        string
  notes?:            string
}

/** User-saved recipe / resource card. */
export interface SavedMealRecipe {
  id?:            number    // * PK auto-increment
  title:          string    // * indexed
  addedAt:        number    // * indexed
  category:       string    // * indexed — e.g. 'Breakfast', 'College Dorm', 'Quick & Easy'
  url?:           string
  description?:   string
  cookTime?:      number    // minutes
  equipment?:     string    // comma-separated equipment tags
  estimatedCost?: number
  notes?:         string
  // Macronutrients per serving (grams)
  protein?:       number
  carbs?:         number
  fat?:           number
  calories?:      number    // kcal per serving
  servings?:      number    // number of servings the recipe makes
}

/**
 * CustomBookmark — user-defined URL entry for the Vault.
 * Powers: Custom Link Manager in Personalized Vault.
 */
export interface CustomBookmark {
  id:           number  // * PK — auto-increment
  label:        string  // * indexed — display name / search
  url:          string  // * indexed — dedup check
  folderName:   string  // * indexed — folder/group filter
  description?: string  //   optional short description
  iconUrl?:     string  //   favicon or custom image URL
  addedAt:      number  //   Unix timestamp ms
  sortOrder?:   number  //   manual drag-reorder position
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

export interface RpgEventLog {
  id?:         number   // legacy — kept for IDB schema migration compatibility
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
  avatarUrl?:       string
  lastActiveAt:     number
  // Phase 9.2 — Letterbox keypair (JWK JSON strings, client-only, never synced)
  letterboxPublicKeyJwk?:  string  // RSA-OAEP 2048 public key; safe to share with peers
  letterboxPrivateKeyJwk?: string  // RSA-OAEP 2048 private key; never leaves the device
}

/**
 * PeerMessage — decrypted letterbox message retrieved from cloud_letterbox
 * and stored locally after the zero-retention cloud drain.
 * Powers: Phase 9.2 async encrypted messaging relay.
 */
export interface PeerMessage {
  id?:                number   // * PK — auto-increment
  senderDisplayName:  string   // * indexed — sender's display name
  decryptedContent:   string   //   fully decrypted message body
  encryptedPayload:   string   //   original ciphertext (kept for audit; never re-uploaded)
  receivedAt:         number   // * indexed — Unix ms; sort by arrival time
  isRead:             0 | 1   // * indexed — 0 = unread, 1 = read (Dexie-safe boolean)
}


/**
 * CardioSession — a single cardio workout log entry.
 * Powers: Workouts → Cardio section. Earns Vitality Points for the Cozy Biome.
 */
export interface CardioSession {
  id?:            number   // * PK — auto-increment
  activityType:   string   // * indexed — 'run'|'walk'|'bike'|'swim'|'row'|'hike'|'yoga'|'other'
  durationMinutes: number  // * indexed — session length in minutes
  distance?:      number   //   optional (miles or km)
  distanceUnit?:  'mi' | 'km'
  caloriesBurned?: number
  vitalityEarned: number   //   VP awarded for this session
  notes?:         string
  logDate:        string   // * indexed — ISO "YYYY-MM-DD"
  completedAt:    number   // * indexed — UTC ms
}

/**
 * PersonalEvent — user-created calendar event (not from an iCal feed).
 * Powers: Universal Calendar personal tab (Phase 8).
 */
export interface PersonalEvent {
  id:           number    // * PK — auto-increment
  title:        string    // * indexed — event display name
  startMs:      number    // * indexed — UTC ms
  endMs:        number    //   UTC ms (equals startMs for all-day point events)
  allDay:       number    // * indexed — 0 | 1
  color:        string    //   hex accent, e.g. '#7c95ff'
  category:     string    // * indexed — 'personal'|'scholastic'|'exam'|'life'|'general'
  description?: string
  createdAt:    number    //   Unix ms
}

/**
 * TodoCategory — a user-created list category for the Calendar To-Do panel.
 * Default categories are "Short Term" and "Long Term".
 */
export interface TodoCategory {
  id:        number   // * PK — auto-increment
  name:      string   // * indexed — category display name
  sortOrder: number   //   controls render order (lower = first)
  createdAt: number   //   Unix ms
}

/**
 * TodoItem — a single task entry belonging to a TodoCategory.
 * Powers: Universal Calendar → Tasks tab.
 */
export interface TodoItem {
  id:          number    // * PK — auto-increment
  categoryId:  number    // * indexed — FK to TodoCategory.id
  title:       string    //   task description
  completed:   0 | 1    // * indexed — 0 = open, 1 = done
  dueDate?:    string    // * indexed — optional ISO "YYYY-MM-DD"
  createdAt:   number    //   Unix ms
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
  habitCompletions!:        EntityTable<HabitCompletion,        'id'>
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
  mentalHealthLogs!:       EntityTable<MentalHealthLog,       'id'>
  outboxMutations!:        EntityTable<OutboxMutation,        'id'>
  aquascapeLayouts!:       EntityTable<AquascapeLayout,       'id'>
  personalEvents!:         EntityTable<PersonalEvent,         'id'>
  mealPlanSlots!:          EntityTable<MealPlanSlot,          'id'>
  savedMealRecipes!:       EntityTable<SavedMealRecipe,       'id'>
  cardioSessions!:         EntityTable<CardioSession,         'id'>
  vocab_decks!:            EntityTable<VocabDeck,             'id'>
  vocab_cards!:            EntityTable<VocabCard,             'id'>
  cardio_runs!:            EntityTable<CardioRun,             'id'>
  base_inventory!:         EntityTable<BaseInventory,         'resourceName'>
  base_upgrades!:          EntityTable<BaseUpgrade,           'id'>
  subscription_items!:          EntityTable<SubscriptionItem,         'id'>
  peer_friends!:                EntityTable<PeerFriend,               'id'>
  peer_leaderboard_snapshots!:  EntityTable<PeerLeaderboardSnapshot,  'peerIdString'>
  peer_messages!:               EntityTable<PeerMessage,              'id'>
  relationship_notes!:          EntityTable<RelationshipNote,         'id'>
  peer_locations!:              EntityTable<PeerLocation,             'peerIdString'>
  library_books!:               EntityTable<LibraryBook,              'id'>
  todo_categories!:             EntityTable<TodoCategory,             'id'>
  todo_items!:                  EntityTable<TodoItem,                 'id'>

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

      userProfile:
        'id, userName, universityName, majorIdentifier',
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

    /*
     * Version 14 — Phase 7 · Step 7.3 (Interactive Hardscape Simulator)
     *
     * New table:
     *   aquascapeLayouts — saved hardscape canvas configurations.
     *     name and savedAt indexed for list/sort queries.
     *     elements is a non-indexed array of HardscapeElement objects;
     *     stored as a structured clone (no serialisation needed).
     *     id=1 is reserved for the auto-save session slot.
     */
    this.version(14).stores({
      aquascapeLayouts: '++id, name, savedAt',
    })

    /*
     * Version 15 — Advanced Habit Tracker
     * New table: habitCompletions — one row per habit per day tracking
     * how many times the habit was completed. Enables multi-step habits
     * (e.g., drink water 4 times) separate from the streak logic.
     */
    this.version(15).stores({
      habitCompletions: '++id, habitId, date, [habitId+date]',
    })

    /*
     * Version 16 — Phase 8: Personal Calendar Events
     *
     * New table:
     *   personalEvents — user-created calendar events (not iCal-derived).
     *     title indexed for search queries.
     *     startMs indexed for timeline ordering.
     *     allDay indexed for grid vs. banner routing.
     *     category indexed for colour-coded filtering.
     */
    this.version(16).stores({
      personalEvents: '++id, title, startMs, allDay, category',
    })

    /*
     * Version 17 — Meal Planning System
     *
     * New tables:
     *   mealPlanSlots — one row per week×day×mealType slot.
     *     weekStart indexed for querying a full week at once.
     *     dayIndex + mealType indexed for individual slot lookup.
     *   savedMealRecipes — user-saved recipe cards and resource links.
     *     title + addedAt + category indexed for sorting and filtering.
     */
    this.version(17).stores({
      mealPlanSlots:    '++id, weekStart, dayIndex, mealType',
      savedMealRecipes: '++id, title, addedAt, category',
    })

    /*
     * Version 18 — Workouts Cardio Section
     *
     * New table:
     *   cardioSessions — one row per cardio workout.
     *     activityType indexed for filtering by activity.
     *     durationMinutes indexed for analytics queries.
     *     logDate indexed for timeline grouping.
     *     completedAt indexed for chronological ordering.
     */
    this.version(18).stores({
      cardioSessions: '++id, activityType, durationMinutes, logDate, completedAt',
    })

    /*
     * Version 19 — Phase 8 · Step 8.1 (Polyglot Vocab Builder)
     *
     * New tables:
     *   vocab_decks — one row per language learning deck.
     *     languageName indexed for grouping by language.
     *     createdAt indexed for chronological list ordering.
     *     Uses explicit string UUID PK (not auto-increment).
     *
     *   vocab_cards — individual flashcard entries with SM-2 state.
     *     deckId indexed for all-cards-in-deck queries.
     *     nextReviewTimestamp indexed for due-card filter queries
     *     (nextReviewTimestamp <= Date.now()).
     *     Uses explicit string UUID PK.
     */
    this.version(19).stores({
      vocab_decks: 'id, languageName, createdAt',
      vocab_cards: 'id, deckId, nextReviewTimestamp',
    })

    /*
     * Version 20 — Phase 8 · Step 8.3 (Retro Trail Explorer & Base Builder)
     *
     * New tables:
     *   cardio_runs    — one row per trail run session.
     *     String UUID PK (no auto-increment).
     *     status indexed for efficient active-run queries.
     *     createdAt indexed for history ordering.
     *
     *   base_inventory — 3-row key/value store for resource quantities.
     *     resourceName is the string PK ('Parchment Wood'|'River Stones'|'Iron Ore').
     *     No secondary indices — always accessed by PK.
     *
     *   base_upgrades  — singleton row (id=1) tracking camp tier + step progress.
     *     Explicit integer PK (not auto-increment). Always id=1.
     */
    this.version(20).stores({
      cardio_runs:    'id, status, createdAt',
      base_inventory: 'resourceName',
      base_upgrades:  'id',
    })

    /*
     * Version 21 — Phase 8 · Step 8.4 (Subscriptions Packager & Burn-Rate Analytics)
     *
     * New table:
     *   subscription_items — one row per recurring expense.
     *     id               string UUID — explicit PK (no auto-increment)
     *     categoryBundle   indexed — groups items into named bundles
     *     billingCycle     indexed — filter MONTHLY vs ANNUAL items
     *     renewalDateString indexed — sort/query by upcoming renewal date
     *
     *   monthlyCost stores the raw per-billing-period amount entered by the
     *   user. Call calculateTrueMonthlyCost(cost, cycle) to normalize to a
     *   true monthly value before displaying or summing across cycles.
     */
    this.version(21).stores({
      subscription_items: 'id, categoryBundle, billingCycle, renewalDateString',
    })

    /*
     * Version 22 — Phase 9 · Step 9.1 (Serverless WebRTC Friend Ledger)
     *
     * New tables:
     *   peer_friends — one row per known peer friend.
     *     id               string UUID — explicit PK (no auto-increment)
     *     peerIdString     indexed — WebRTC handshake key; dedup guard
     *     connectedAt      indexed — Unix ms; sort by most-recent
     *
     *   peer_leaderboard_snapshots — one row per peer + one for 'self'.
     *     peerIdString     string PK — 'self' for local user, PeerJS ID
     *                      for each peer; one upsert per sync exchange
     *     snapshotTimestamp indexed — temporal staleness evaluation
     *
     *   Rolling-window fields (weeklyStudyMinutes, monthlyStudyMinutes)
     *   are zeroed by evaluateTemporalSnapshot() when age exceeds the
     *   respective window. All-time fields never expire.
     */
    this.version(22).stores({
      peer_friends:               'id, peerIdString, connectedAt',
      peer_leaderboard_snapshots: 'peerIdString, snapshotTimestamp',
    })

    /*
     * Version 23 — Phase 9 · Step 9.2 (Encrypted Async Cloud Letterbox)
     *
     * New table:
     *   peer_messages — decrypted letterbox messages retrieved from Supabase
     *     cloud_letterbox and stored locally after zero-retention cloud drain.
     *
     *   senderDisplayName indexed — filter/sort by sender.
     *   receivedAt        indexed — chronological ordering (newest-first UI).
     *   isRead            indexed — efficient unread count query.
     *
     *   letterboxPublicKeyJwk + letterboxPrivateKeyJwk are added as
     *   non-indexed optional fields on userProfile (no schema change needed;
     *   Dexie stores non-indexed fields transparently).
     */
    this.version(23).stores({
      peer_messages: '++id, senderDisplayName, receivedAt, isRead',
    })

    /*
     * Version 24 — Phase 9 · Step 9.3 (Relationship Notes Dashboard Widget)
     *
     * New table:
     *   relationship_notes — unified social-message display store.
     *     id               explicit string UUID PK (not auto-increment)
     *     senderDisplayName indexed — filter / search by sender
     *     timestamp        indexed — primary sort axis (newest-first)
     *     isRead           indexed — unread indicator queries
     *
     *   Distinct from peer_messages (Phase 9.2) which retains the raw
     *   encrypted payload for auditing. This table stores only the
     *   decrypted, display-ready record.  Multiple intake sources can
     *   write here: the letterbox broker, future WebRTC channels, etc.
     *
     *   source? is a non-indexed optional tag ('letterbox'|'p2p'|'manual').
     */
    this.version(24).stores({
      relationship_notes: 'id, senderDisplayName, timestamp, isRead',
    })

    /*
     * Version 25 — Phase 9 · Step 9.4 (Privacy-Preserving Geo Distance Widget)
     *
     * New table:
     *   peer_locations — one row per peer + one for 'self'.
     *     peerIdString     string PK — 'self' for own location,
     *                      PeerJS peer ID for each remote peer.
     *                      Mirrors the peer_leaderboard_snapshots PK convention.
     *     lastUpdatedTimestamp indexed — staleness evaluation + sorting.
     *
     *   latitude / longitude are NON-INDEXED private calculation fields.
     *   They are NEVER written to Supabase or any remote store.
     *   They MUST NOT be rendered to the UI viewport.
     *   They exist exclusively for the Haversine distance computation.
     *
     *   Rows are upserted (put) — one row per peer, updated in-place.
     */
    this.version(25).stores({
      peer_locations: 'peerIdString, lastUpdatedTimestamp',
    })

    /*
     * Version 26 — Phase 10 · Step 10.4 (Literary Ledger & Goodreads CSV Sync Vault)
     *
     * New table:
     *   library_books — one row per book in the user's personal library.
     *     id               explicit string UUID PK (no auto-increment; set
     *                      client-side so Goodreads CSV bulk-import works atomically)
     *     title            indexed — search and display ordering
     *     author           indexed — search and grouping
     *     readingStatus    indexed — filter by TO_READ | CURRENTLY_READING | COMPLETED
     *     dateCompleted    indexed — sort Completed shelf newest-first
     *     addedAt          indexed — default sort axis for other shelves
     *
     *   Non-indexed fields: isbn13, globalRating, userRating, totalPages,
     *     readCount, dateStarted, customReviewText — accessed via full record read.
     *
     *   Uses bulkPut for batch Goodreads CSV import (idempotent — re-importing
     *   the same export replaces records rather than duplicating by id).
     */
    this.version(26).stores({
      library_books: 'id, title, author, readingStatus, dateCompleted, addedAt',
    })

    /*
     * Version 27 — Calendar To-Do List (Tasks tab)
     *
     * New tables:
     *   todo_categories — user-created named lists.
     *     name      indexed — display + dedup lookup.
     *     sortOrder non-indexed; controls render sequence.
     *     Seeded on first Tasks-tab open with "Short Term" + "Long Term".
     *
     *   todo_items — individual task entries.
     *     categoryId indexed — all-items-in-category query.
     *     completed  indexed — efficient open/done filter (0|1).
     *     dueDate    indexed — optional ISO date for sorting by deadline.
     */
    this.version(27).stores({
      todo_categories: '++id, name',
      todo_items:      '++id, categoryId, completed, dueDate',
    })

    /*
     * Version 28 — Phase 15 · Step 15.3 (Index Freeze)
     *
     * Index additions only — no new tables, no data loss.
     *
     *   assignments  — adds `category` secondary index.
     *     Enables `.where('category').equals(...)` filtering for task-type
     *     partitioning without a full-table scan.
     *
     *   vocab_cards  — adds `easeFactor` secondary index.
     *     Enables SM-2 analytics queries (e.g. find all cards with
     *     easeFactor < 1.5 for remedial review scheduling).
     *
     *   library_books (v26) already has `readingStatus` + `author` indexed.
     *   No change needed — those indices are already frozen.
     */
    this.version(28).stores({
      assignments: '++id, title, dueDate, courseId, status, priority, supabaseId, category',
      vocab_cards: 'id, deckId, nextReviewTimestamp, easeFactor',
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
 * Call once on first authenticated load. Safe to call multiple times.
 *
 * If a profile already exists but its userName differs from the name the
 * current session signed in with, the name is reconciled to the session
 * value. This prevents a stale name (e.g. a previous user's) from lingering
 * when a different account signs in on the same device.
 */
export async function seedUserProfile(
  userName: string,
  opts: Partial<Omit<UserProfile, 'id' | 'userName'>> = {},
): Promise<UserProfile> {
  const existing = await getDb().userProfile.get(1)
  if (existing) {
    const trimmed = userName.trim()
    if (trimmed && existing.userName !== trimmed) {
      await getDb().userProfile.update(1, { userName: trimmed, lastActiveAt: Date.now() })
      return { ...existing, userName: trimmed }
    }
    return existing
  }

  const profile: UserProfile = {
    id:              1,
    userName,
    universityName:  opts.universityName  ?? '',
    majorIdentifier: opts.majorIdentifier ?? '',
    avatarUrl:       opts.avatarUrl,
    lastActiveAt:    Date.now(),
  }
  await getDb().userProfile.add(profile)
  return profile
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

/* ════════════════════════════════════════════════════════════════
   5b.  RELATIONSHIP NOTES HELPERS  (Phase 9.3)
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns the single most recent RelationshipNote row, sorted by
 * timestamp descending.  Returns undefined when the table is empty.
 *
 * Used by RelationshipNotesWidget for its initial render; subsequent
 * updates are driven reactively via useLiveQuery (zero-polling).
 */
export async function getLatestRelationshipNote(): Promise<RelationshipNote | undefined> {
  return getDb().relationship_notes.orderBy('timestamp').reverse().first()
}

/**
 * Writes a new note to the relationship_notes table.
 * Accepts a partial record; fills in id and timestamp if omitted.
 */
export async function addRelationshipNote(
  note: Omit<RelationshipNote, 'id'> & { id?: string },
): Promise<string> {
  const id = note.id ?? crypto.randomUUID()
  await getDb().relationship_notes.put({
    ...note,
    id,
    isRead:    note.isRead    ?? false,
    timestamp: note.timestamp ?? Date.now(),
  })
  return id
}


/* ════════════════════════════════════════════════════════════════
   5c.  PEER LOCATION HELPERS  (Phase 9.4)
   ────────────────────────────────────────────────────────────────
   These helpers are the ONLY authorised write paths for the
   peer_locations table.  Call sites must never pass raw coordinates
   to any function that could log or transmit them remotely.
   ════════════════════════════════════════════════════════════════ */

/**
 * Upserts the local user's current position into peer_locations.
 * Called by useDistanceTracker on mount and on each manual sync.
 *
 * Privacy: the coordinates never leave the local device via this path.
 */
export async function storeSelfLocation(
  latitude:  number,
  longitude: number,
): Promise<void> {
  await getDb().peer_locations.put({
    peerIdString:         'self',
    latitude,
    longitude,
    lastUpdatedTimestamp: Date.now(),
  })
}

/**
 * Upserts a remote peer's shared coordinates received over the
 * DTLS-encrypted WebRTC DataChannel (SyncPayload.locationLat/Lon).
 *
 * Called from useFriendsNetwork when a SyncPayload is received that
 * includes locationLat + locationLon.  These coordinates are stored
 * ONLY in local IDB — they are never forwarded to Supabase.
 */
export async function storePeerLocation(
  peerIdString: string,
  latitude:     number,
  longitude:    number,
): Promise<void> {
  await getDb().peer_locations.put({
    peerIdString,
    latitude,
    longitude,
    lastUpdatedTimestamp: Date.now(),
  })
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
