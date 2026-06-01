-- ════════════════════════════════════════════════════════════════════════════
-- Zenith OS — Phase 6 · Step 6.4
-- Database Synchronisation Broker — Extended Cloud Schema
--
-- Migration   : 20260601000001_phase64_extended_sync_schema
-- Target DB   : Supabase project (PostgreSQL 15+)
-- Depends on  : 20260529000001_phase2_cloud_schema (profiles + urgent_tasks)
--
-- Purpose:
--   Adds cloud-sync tables for habits and workouts — the two local IDB
--   tables that the Phase 2 engine deliberately left local-only.
--   The syncBroker (services/syncBroker.ts) now pushes mutations for
--   all four syncable tables through the outboxMutations IDB queue and
--   flushes them here via bulk upsert.
--
-- Design conventions (matching Phase 2 migration):
--   • Table prefix: supabase_ — clearly marks cloud-synced rows.
--   • Column names: snake_case matching Postgres idioms.
--   • UUIDs as PKs — client-generated (crypto.randomUUID()), enabling
--     optimistic local writes with no PK round-trip.
--   • updated_at on both tables — managed by the updated_at trigger
--     defined in the Phase 2 migration (handle_profile_updated_at).
--     Re-used here via a second trigger instance per table.
--   • RLS on every table — four policies per table (SELECT/INSERT/UPDATE/DELETE).
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — TABLE DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1a. supabase_habits
--
-- Cloud mirror of the local `habits` IndexedDB table.
-- Synced from all devices when a Supabase session is active.
--
-- TypeScript mirror (lib/db.ts → Habit):
--   name               → name
--   frequency          → frequency
--   streakCount        → streak_count
--   lastCompletedDate  → last_completed_date
--   category           → category
--   difficulty         → difficulty         (Phase 5 RPG tier)
--   createdAt          → created_at
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supabase_habits (

  -- Client-generated UUID — matches OutboxMutation.id injected by syncBroker.
  id                  uuid        PRIMARY KEY,

  -- Owning user — cascades on profile deletion.
  user_id             uuid        NOT NULL
                                  REFERENCES public.supabase_user_profiles (id)
                                  ON DELETE CASCADE,

  -- Display name, e.g. "Morning run", "Read 30 minutes".
  name                text        NOT NULL,

  -- Cadence: daily | weekly | custom (mirrors HabitFrequency union in lib/db.ts).
  frequency           text        NOT NULL DEFAULT 'daily'
                                  CHECK (frequency IN ('daily', 'weekly', 'custom')),

  -- Current consecutive-day streak; incremented by the habit completion handler.
  streak_count        integer     NOT NULL DEFAULT 0
                                  CHECK (streak_count >= 0),

  -- ISO-8601 date of the most recent completion; NULL if the habit has never
  -- been completed. Stored as text to match the local IDB schema.
  last_completed_date text,

  -- Grouping label, e.g. "health", "study", "social".
  category            text        NOT NULL DEFAULT 'general',

  -- RPG difficulty tier (Phase 5) — determines XP yield.
  -- NULL-tolerant: habits created before Phase 5 default to 'medium' client-side.
  difficulty          text        CHECK (difficulty IN ('easy', 'medium', 'hard', 'epic')),

  -- ISO timestamp of the first local creation.  Set once on INSERT.
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Auto-maintained by the trigger below. Never write directly.
  updated_at          timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE  public.supabase_habits                 IS 'Cloud-synced habit tracker. Mirrors lib/db.ts → Habit. One row per recurring behaviour per user.';
COMMENT ON COLUMN public.supabase_habits.id              IS 'Client UUID = OutboxMutation.id from syncBroker, injected on the Dexie creating hook.';
COMMENT ON COLUMN public.supabase_habits.streak_count    IS 'Consecutive completion streak. Never goes negative.';
COMMENT ON COLUMN public.supabase_habits.updated_at      IS 'Auto-stamped by on_habit_updated trigger. Used for LWW conflict resolution in syncBroker.';


-- ────────────────────────────────────────────────────────────────────────────
-- 1b. supabase_workouts
--
-- Cloud mirror of the local `workouts` IndexedDB table.
--
-- TypeScript mirror (lib/db.ts → Workout):
--   exerciseName  → exercise_name
--   sets          → sets
--   reps          → reps
--   weight        → weight
--   logDate       → log_date       (ISO-8601 string → date)
--   type          → type
--   durationMins  → duration_mins
--   notes         → notes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supabase_workouts (

  -- Client-generated UUID from syncBroker.
  id            uuid        PRIMARY KEY,

  user_id       uuid        NOT NULL
                            REFERENCES public.supabase_user_profiles (id)
                            ON DELETE CASCADE,

  -- E.g. "Squat", "5K Run", "Yoga flow".
  exercise_name text        NOT NULL,

  -- Volume metrics; 0 = bodyweight or non-quantified.
  sets          integer     NOT NULL DEFAULT 0 CHECK (sets  >= 0),
  reps          integer     NOT NULL DEFAULT 0 CHECK (reps  >= 0),
  weight        numeric     NOT NULL DEFAULT 0 CHECK (weight >= 0),

  -- ISO-8601 calendar date of the session. Stored as text to match
  -- the local IDB schema (avoids timezone shift issues in date-only values).
  log_date      text        NOT NULL,

  -- Workout category (mirrors WorkoutType union in lib/db.ts).
  type          text        NOT NULL DEFAULT 'strength'
                            CHECK (type IN ('strength', 'cardio', 'mobility', 'sport', 'other')),

  -- Optional session duration for cardio / HIIT entries.
  duration_mins integer     CHECK (duration_mins > 0),

  -- Free-text notes: form cues, RPE, subjective feel.
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE  public.supabase_workouts           IS 'Cloud-synced exercise log. Mirrors lib/db.ts → Workout. One row per logged exercise set / session.';
COMMENT ON COLUMN public.supabase_workouts.log_date  IS 'ISO-8601 calendar date string (YYYY-MM-DD). Stored as text to match local IDB — avoids timezone shift on date-only values.';
COMMENT ON COLUMN public.supabase_workouts.updated_at IS 'Auto-stamped by on_workout_updated trigger. Used for LWW conflict resolution in syncBroker.';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — TRIGGERS (updated_at automation)
--
-- Reuses the handle_profile_updated_at() function from Phase 2 — it is a
-- generic SET NEW.updated_at = now() function with no table-specific logic.
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_habit_updated   ON public.supabase_habits;
CREATE TRIGGER on_habit_updated
  BEFORE UPDATE ON public.supabase_habits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();

COMMENT ON TRIGGER on_habit_updated ON public.supabase_habits IS
  'Stamps updated_at = now() before each row update. Used by syncBroker LWW check.';

DROP TRIGGER IF EXISTS on_workout_updated ON public.supabase_workouts;
CREATE TRIGGER on_workout_updated
  BEFORE UPDATE ON public.supabase_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();

COMMENT ON TRIGGER on_workout_updated ON public.supabase_workouts IS
  'Stamps updated_at = now() before each row update. Used by syncBroker LWW check.';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════


-- ── 3a. supabase_habits ──────────────────────────────────────────────────────

ALTER TABLE public.supabase_habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS habits_select_own ON public.supabase_habits;
CREATE POLICY habits_select_own
  ON  public.supabase_habits FOR SELECT
  TO  authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS habits_insert_own ON public.supabase_habits;
CREATE POLICY habits_insert_own
  ON  public.supabase_habits FOR INSERT
  TO  authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS habits_update_own ON public.supabase_habits;
CREATE POLICY habits_update_own
  ON  public.supabase_habits FOR UPDATE
  TO  authenticated
  USING      ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS habits_delete_own ON public.supabase_habits;
CREATE POLICY habits_delete_own
  ON  public.supabase_habits FOR DELETE
  TO  authenticated
  USING ( user_id = auth.uid() );


-- ── 3b. supabase_workouts ────────────────────────────────────────────────────

ALTER TABLE public.supabase_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workouts_select_own ON public.supabase_workouts;
CREATE POLICY workouts_select_own
  ON  public.supabase_workouts FOR SELECT
  TO  authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS workouts_insert_own ON public.supabase_workouts;
CREATE POLICY workouts_insert_own
  ON  public.supabase_workouts FOR INSERT
  TO  authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS workouts_update_own ON public.supabase_workouts;
CREATE POLICY workouts_update_own
  ON  public.supabase_workouts FOR UPDATE
  TO  authenticated
  USING      ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS workouts_delete_own ON public.supabase_workouts;
CREATE POLICY workouts_delete_own
  ON  public.supabase_workouts FOR DELETE
  TO  authenticated
  USING ( user_id = auth.uid() );


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — PERFORMANCE INDICES
-- ════════════════════════════════════════════════════════════════════════════

-- Habits — list all habits for a user ordered by creation time.
CREATE INDEX IF NOT EXISTS idx_habits_user_created
  ON public.supabase_habits (user_id, created_at DESC);

-- Habits — filter by category for dashboard grouping views.
CREATE INDEX IF NOT EXISTS idx_habits_user_category
  ON public.supabase_habits (user_id, category);

-- Workouts — timeline query: all sessions for a user ordered by log date.
CREATE INDEX IF NOT EXISTS idx_workouts_user_log_date
  ON public.supabase_workouts (user_id, log_date DESC);

-- Workouts — filter by exercise type for volume analytics.
CREATE INDEX IF NOT EXISTS idx_workouts_user_type
  ON public.supabase_workouts (user_id, type);


-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
--
-- Summary of objects created:
--
--   Tables    (2):
--     public.supabase_habits
--     public.supabase_workouts
--
--   Triggers  (2, reusing handle_profile_updated_at from Phase 2):
--     on_habit_updated   → supabase_habits   BEFORE UPDATE
--     on_workout_updated → supabase_workouts BEFORE UPDATE
--
--   RLS enabled on (2):
--     supabase_habits, supabase_workouts
--
--   RLS policies (8 total — 4 per table):
--     habits_select_own   habits_insert_own   habits_update_own   habits_delete_own
--     workouts_select_own workouts_insert_own workouts_update_own workouts_delete_own
--
--   Indices (4):
--     idx_habits_user_created
--     idx_habits_user_category
--     idx_workouts_user_log_date
--     idx_workouts_user_type
--
-- Run in Supabase Dashboard → SQL Editor, or:
--   supabase db push   (if using the Supabase CLI with linked project)
-- ════════════════════════════════════════════════════════════════════════════
