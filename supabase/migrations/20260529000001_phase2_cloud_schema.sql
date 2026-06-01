-- ════════════════════════════════════════════════════════════════════════════
-- Zenith OS — Phase 2 · Step 2.1
-- Cloud Database Provisioning — Supabase / PostgreSQL
--
-- Migration   : 20260529000001_phase2_cloud_schema
-- Target DB   : Supabase project (PostgreSQL 15+)
-- Run in      : Supabase Dashboard → SQL Editor, or `supabase db push`
--
-- Purpose:
--   Provisions the cloud-sync tier for data layers requiring cross-device
--   persistence (desktop ↔ mobile). The three tables below mirror a subset
--   of the local IndexedDB schema defined in lib/db.ts — only the tables
--   that benefit from cloud replication are included. Pure-local tables
--   (habits, workouts, quickNotes, customBookmarks) stay IndexedDB-only.
--
-- Conventions:
--   • All table names are prefixed with `supabase_` to clearly distinguish
--     cloud-synced rows from their local IndexedDB counterparts in any
--     cross-context code that imports both layers.
--   • Column names use snake_case to match PostgreSQL idioms; application
--     code maps them to camelCase via a thin adapter layer (Phase 2.2).
--   • uuid primary keys are used throughout — they are safe to generate
--     client-side (crypto.randomUUID()) before the INSERT, enabling
--     optimistic writes with no round-trip for the PK.
--   • timestamptz (timestamp with time zone) is always UTC-stored; the
--     client is responsible for localising display values.
--
-- TypeScript interface cross-reference (lib/db.ts):
--   supabase_user_profiles  → UserProfile
--   supabase_urgent_tasks   → Assignment  (cloud subset — urgent/active only)
--   supabase_calendar_feeds → (new in Phase 2 — no local analogue yet)
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 0 — GUARD EXTENSIONS
-- Ensures the pgcrypto extension is available for gen_random_uuid().
-- Supabase projects enable this by default; included here for portability.
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — TABLE DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1a. supabase_user_profiles
--
-- Cloud mirror of the UserProfile singleton stored in IndexedDB (id = 1).
--
-- Key differences from the local schema:
--   • id is a UUID linked to auth.users — one cloud row per Supabase account.
--   • updated_at replaces lastActiveAt; it is managed by the trigger in
--     Section 2 and must never be set manually by application code.
--   • avatarUrl is intentionally omitted — avatars are served from Supabase
--     Storage and referenced via a signed URL constructed at query time.
--
-- TypeScript mirror (lib/db.ts → UserProfile):
--   userName         → user_name
--   universityName   → university_name
--   majorIdentifier  → major_identifier
--   currentLevel     → current_level
--   expPoints        → exp_points
--   healthPoints     → health_points
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supabase_user_profiles (

  -- Primary key — references the Supabase auth user directly.
  -- ON DELETE CASCADE means the profile row is removed if the auth
  -- account is deleted, keeping orphaned rows impossible.
  id                uuid        PRIMARY KEY
                                REFERENCES auth.users (id)
                                ON DELETE CASCADE,

  -- Display name; mirrors AuthContext → userHandle and local UserProfile.userName.
  -- Defaults to an empty string so INSERT can omit it during onboarding flow.
  user_name         text        NOT NULL DEFAULT '',

  -- Academic context shown in the University Hub header.
  university_name   text        NOT NULL DEFAULT '',

  -- Course/field of study label, e.g. "Computer Science", "Biology".
  major_identifier  text        NOT NULL DEFAULT '',

  -- RPG progression fields — level is derived from exp_points client-side
  -- (level = floor(sqrt(exp_points / 100)) + 1) but cached here for
  -- leaderboard queries without client-side recalculation.
  current_level     integer     NOT NULL DEFAULT 1
                                CHECK (current_level >= 1),

  exp_points        integer     NOT NULL DEFAULT 0
                                CHECK (exp_points >= 0),

  -- HP pool — decremented on task-failure penalties (Phase 3 gamification).
  health_points     integer     NOT NULL DEFAULT 100
                                CHECK (health_points >= 0 AND health_points <= 100),

  -- Managed by the trigger in Section 2. Never write to this column directly.
  updated_at        timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE  public.supabase_user_profiles              IS 'Cloud-synced user profile. One row per Supabase auth user. Mirrors lib/db.ts → UserProfile.';
COMMENT ON COLUMN public.supabase_user_profiles.id           IS 'UUID FK to auth.users — set to auth.uid() on INSERT.';
COMMENT ON COLUMN public.supabase_user_profiles.current_level IS 'Cached: level = floor(sqrt(exp_points / 100)) + 1. Recalculate on every exp_points UPDATE.';
COMMENT ON COLUMN public.supabase_user_profiles.updated_at   IS 'Auto-managed by handle_profile_updated_at trigger. Do not write manually.';


-- ────────────────────────────────────────────────────────────────────────────
-- 1b. supabase_urgent_tasks
--
-- Cloud subset of the local `assignments` IndexedDB table.  Only rows where
-- priority ∈ {high, critical} and status ∈ {pending, in_progress} are
-- expected to be synced here — filtering is enforced by application code,
-- not a DB constraint, so the client can relax the rule without a migration.
--
-- TypeScript mirror (lib/db.ts → Assignment):
--   title      → title
--   dueDate    → due_date   (string "YYYY-MM-DD" → timestamptz)
--   courseId   → course_id
--   status     → status     (CHECK enforces AssignmentStatus union)
--   priority   → priority   (CHECK enforces Priority union)
--   createdAt  → created_at (Unix ms → timestamptz)
--
-- Note: `notes` and `updatedAt` are omitted from the cloud schema — notes
-- are a local-only scratchpad, and row-level recency is tracked by the
-- global sync timestamp in supabase_user_profiles.updated_at.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supabase_urgent_tasks (

  -- Stable UUID — safe to generate client-side with crypto.randomUUID()
  -- before the INSERT to enable optimistic local writes.
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owning user — references the profile table (not auth.users directly)
  -- so the FK cascade also removes tasks when the profile is removed.
  user_id     uuid        NOT NULL
                          REFERENCES public.supabase_user_profiles (id)
                          ON DELETE CASCADE,

  -- Human-readable task label; matches Assignment.title.
  title       text        NOT NULL,

  -- ISO-8601 stored as timestamptz; application layer converts from the
  -- "YYYY-MM-DD" string format used in the local IndexedDB schema.
  due_date    timestamptz,

  -- Course/module identifier; free-text to match the local schema.
  -- "general" is the fallback value used by the legacy addTask() helper.
  course_id   text        NOT NULL DEFAULT 'general',

  -- Pipeline stage — mirrors AssignmentStatus union in lib/db.ts.
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),

  -- Urgency tier — mirrors Priority union in lib/db.ts.
  priority    text        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Creation timestamp; set once on INSERT, never updated.
  created_at  timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE  public.supabase_urgent_tasks           IS 'Cloud-synced subset of urgent/active assignments. Mirrors lib/db.ts → Assignment (priority: high | critical).';
COMMENT ON COLUMN public.supabase_urgent_tasks.id        IS 'Client-generated UUID — use crypto.randomUUID() before INSERT for optimistic writes.';
COMMENT ON COLUMN public.supabase_urgent_tasks.status    IS 'AssignmentStatus union: pending | in_progress | completed | overdue.';
COMMENT ON COLUMN public.supabase_urgent_tasks.priority  IS 'Priority union: low | medium | high | critical.';


-- ────────────────────────────────────────────────────────────────────────────
-- 1c. supabase_calendar_feeds
--
-- New in Phase 2 — no local IndexedDB analogue yet.
-- Stores iCal / CalDAV feed URLs that the Universal Calendar view fetches
-- and merges with locally-authored events. Kept cloud-only because the feed
-- list must roam to mobile.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supabase_calendar_feeds (

  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     uuid        NOT NULL
                          REFERENCES public.supabase_user_profiles (id)
                          ON DELETE CASCADE,

  -- Display label shown in the calendar sidebar, e.g. "Uni Timetable".
  feed_name   text        NOT NULL,

  -- Full iCal/CalDAV URL. Application layer must validate URL format.
  feed_url    text        NOT NULL,

  -- Soft dedup guard — prevent the same URL appearing twice per user.
  UNIQUE (user_id, feed_url),

  created_at  timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE  public.supabase_calendar_feeds          IS 'Cloud-only iCal/CalDAV feed registry for the Universal Calendar view. Roams to all devices.';
COMMENT ON COLUMN public.supabase_calendar_feeds.feed_url IS 'Full iCal URL. Combined unique constraint with user_id prevents duplicates per user.';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — TRIGGER: AUTOMATIC updated_at MAINTENANCE
--
-- PostgreSQL does not have an ON UPDATE CURRENT_TIMESTAMP shorthand (that is
-- a MySQL-ism). Instead, we wire up a BEFORE UPDATE trigger on the profiles
-- table so that `updated_at` reflects the wall-clock time of the most recent
-- write without requiring the application layer to remember to set it.
--
-- The trigger function is defined once and can be reused by additional tables
-- that grow an `updated_at` column in future migrations.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 2a. Trigger function — sets NEW.updated_at to the current transaction time.
--
-- RETURNS TRIGGER  : required return type for row-level trigger functions.
-- LANGUAGE plpgsql : PL/pgSQL procedural language; always available in
--                    Supabase / standard PostgreSQL.
-- SECURITY DEFINER : executes with the permissions of the function owner
--                    (postgres role) rather than the calling user, ensuring
--                    the update succeeds even if the row-level security
--                    policy would otherwise block a direct column write.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Overwrite the updated_at value in the incoming row with the current
  -- transaction timestamp.  Using `now()` (= CURRENT_TIMESTAMP) is
  -- intentional — all rows updated in the same transaction share one
  -- timestamp, which is correct and avoids spurious diff noise in sync logs.
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_profile_updated_at() IS
  'Trigger function: stamps updated_at = now() on every UPDATE to supabase_user_profiles. SECURITY DEFINER so RLS cannot block the internal write.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2b. Attach the trigger to the profiles table.
--
-- FOR EACH ROW   : fires once per modified row (as opposed to statement-level).
-- BEFORE UPDATE  : runs before the write lands, so NEW.updated_at is set
--                  inside the same atomic operation — no separate UPDATE needed.
-- ────────────────────────────────────────────────────────────────────────────

-- Drop first so the migration is safely re-runnable (idempotent).
DROP TRIGGER IF EXISTS on_profile_updated
  ON public.supabase_user_profiles;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.supabase_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();

COMMENT ON TRIGGER on_profile_updated ON public.supabase_user_profiles IS
  'Fires handle_profile_updated_at() before every row update to maintain the updated_at timestamp automatically.';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — ROW-LEVEL SECURITY (RLS)
--
-- RLS ensures that authenticated users can only ever read or write their own
-- rows — even if application code contains a bug that omits a WHERE clause.
-- The Supabase client library automatically injects the JWT of the currently
-- signed-in user; `auth.uid()` resolves to that user's UUID at query time.
--
-- Policy naming convention:
--   <table_short>_<operation>_own
--   e.g. "profiles_select_own", "tasks_insert_own"
--
-- We create four policies per table (SELECT / INSERT / UPDATE / DELETE) for
-- explicit, auditable access control — one permissive policy covering all
-- operations would be harder to reason about and harder to narrow later.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 3a. supabase_user_profiles — RLS
--
-- The owning-user column IS the primary key (id), so policies compare
-- id = auth.uid() rather than user_id = auth.uid().
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.supabase_user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow a user to read their own profile row.
DROP POLICY IF EXISTS profiles_select_own ON public.supabase_user_profiles;
CREATE POLICY profiles_select_own
  ON  public.supabase_user_profiles
  FOR SELECT
  TO  authenticated
  USING ( id = auth.uid() );

-- Allow a user to create their own profile row (onboarding INSERT).
-- WITH CHECK ensures the inserted id always equals the caller's uid,
-- preventing a malicious client from creating a row for another user.
DROP POLICY IF EXISTS profiles_insert_own ON public.supabase_user_profiles;
CREATE POLICY profiles_insert_own
  ON  public.supabase_user_profiles
  FOR INSERT
  TO  authenticated
  WITH CHECK ( id = auth.uid() );

-- Allow a user to update only their own profile row.
-- Both USING (row filter) and WITH CHECK (write filter) are set to be
-- consistent and defensive — USING alone would be sufficient for UPDATE,
-- but explicit WITH CHECK blocks privilege escalation attempts.
DROP POLICY IF EXISTS profiles_update_own ON public.supabase_user_profiles;
CREATE POLICY profiles_update_own
  ON  public.supabase_user_profiles
  FOR UPDATE
  TO  authenticated
  USING      ( id = auth.uid() )
  WITH CHECK ( id = auth.uid() );

-- Allow a user to delete their own profile (account wipe flow).
DROP POLICY IF EXISTS profiles_delete_own ON public.supabase_user_profiles;
CREATE POLICY profiles_delete_own
  ON  public.supabase_user_profiles
  FOR DELETE
  TO  authenticated
  USING ( id = auth.uid() );


-- ────────────────────────────────────────────────────────────────────────────
-- 3b. supabase_urgent_tasks — RLS
--
-- The owning-user column is `user_id`; policies compare user_id = auth.uid().
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.supabase_urgent_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select_own ON public.supabase_urgent_tasks;
CREATE POLICY tasks_select_own
  ON  public.supabase_urgent_tasks
  FOR SELECT
  TO  authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS tasks_insert_own ON public.supabase_urgent_tasks;
CREATE POLICY tasks_insert_own
  ON  public.supabase_urgent_tasks
  FOR INSERT
  TO  authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS tasks_update_own ON public.supabase_urgent_tasks;
CREATE POLICY tasks_update_own
  ON  public.supabase_urgent_tasks
  FOR UPDATE
  TO  authenticated
  USING      ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS tasks_delete_own ON public.supabase_urgent_tasks;
CREATE POLICY tasks_delete_own
  ON  public.supabase_urgent_tasks
  FOR DELETE
  TO  authenticated
  USING ( user_id = auth.uid() );


-- ────────────────────────────────────────────────────────────────────────────
-- 3c. supabase_calendar_feeds — RLS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.supabase_calendar_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feeds_select_own ON public.supabase_calendar_feeds;
CREATE POLICY feeds_select_own
  ON  public.supabase_calendar_feeds
  FOR SELECT
  TO  authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS feeds_insert_own ON public.supabase_calendar_feeds;
CREATE POLICY feeds_insert_own
  ON  public.supabase_calendar_feeds
  FOR INSERT
  TO  authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS feeds_update_own ON public.supabase_calendar_feeds;
CREATE POLICY feeds_update_own
  ON  public.supabase_calendar_feeds
  FOR UPDATE
  TO  authenticated
  USING      ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS feeds_delete_own ON public.supabase_calendar_feeds;
CREATE POLICY feeds_delete_own
  ON  public.supabase_calendar_feeds
  FOR DELETE
  TO  authenticated
  USING ( user_id = auth.uid() );


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — PERFORMANCE INDICES
--
-- Primary keys are automatically indexed. The indices below cover the query
-- patterns expected from the Zenith client (Phase 2.2 adapter layer):
--   • Fetch all tasks for the current user, ordered by due date.
--   • Fetch all calendar feeds for the current user.
-- ════════════════════════════════════════════════════════════════════════════

-- Tasks — composite index for the primary list query:
--   WHERE user_id = $1 AND status IN ('pending','in_progress') ORDER BY due_date
CREATE INDEX IF NOT EXISTS idx_urgent_tasks_user_due
  ON public.supabase_urgent_tasks (user_id, due_date ASC NULLS LAST);

-- Tasks — secondary index to support filtering by priority tier alone.
CREATE INDEX IF NOT EXISTS idx_urgent_tasks_user_priority
  ON public.supabase_urgent_tasks (user_id, priority);

-- Calendar feeds — fetch all feeds for a user in O(log n).
CREATE INDEX IF NOT EXISTS idx_calendar_feeds_user
  ON public.supabase_calendar_feeds (user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
--
-- Summary of objects created:
--
--   Tables    (3):
--     public.supabase_user_profiles
--     public.supabase_urgent_tasks
--     public.supabase_calendar_feeds
--
--   Trigger function (1):
--     public.handle_profile_updated_at()
--
--   Triggers  (1):
--     on_profile_updated → supabase_user_profiles BEFORE UPDATE
--
--   RLS enabled on (3):
--     supabase_user_profiles, supabase_urgent_tasks, supabase_calendar_feeds
--
--   RLS policies (12 total — 4 per table):
--     profiles_select_own   profiles_insert_own   profiles_update_own   profiles_delete_own
--     tasks_select_own      tasks_insert_own      tasks_update_own      tasks_delete_own
--     feeds_select_own      feeds_insert_own      feeds_update_own      feeds_delete_own
--
--   Indices (3):
--     idx_urgent_tasks_user_due
--     idx_urgent_tasks_user_priority
--     idx_calendar_feeds_user
--
-- Next step: Phase 2 · Step 2.2 — Supabase client adapter layer
--   lib/supabase.ts        — typed Supabase client singleton
--   lib/sync/profiles.ts   — upsert / fetch helpers for supabase_user_profiles
--   lib/sync/tasks.ts      — CRUD + real-time subscription for urgent tasks
-- ════════════════════════════════════════════════════════════════════════════
