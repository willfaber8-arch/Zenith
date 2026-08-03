-- ════════════════════════════════════════════════════════════════════════════
-- Zenith OS — Cloud Snapshot (whole-database account sync)
--
-- Migration : 20260803000001_cloud_snapshot
-- Target DB : Supabase project (PostgreSQL 15+)
-- Run in    : Supabase Dashboard → SQL Editor, or `supabase db push`
--
-- ── WHY THIS TABLE EXISTS ──────────────────────────────────────────────────
--
-- Every browser profile gets its own isolated IndexedDB. A user running two
-- Edge profiles (school / personal) on the same laptop therefore ends up with
-- two divergent copies of ZenithOS. The per-table sync broker
-- (services/syncBroker.ts) only mirrors 4 of the ~44 local tables, which is
-- nowhere near enough to make a profile switch feel seamless.
--
-- Rather than write 40 more per-table adapters, this table stores ONE row per
-- Supabase user containing the ENTIRE local database, serialised with the same
-- MasterBackupPayload envelope used by the "Eject Button" JSON backup
-- (utils/dbExporter.ts → buildBackupPayload()).
--
-- Conflict policy: LAST-WRITE-WINS. The user works in one browser profile at a
-- time on a single machine, so the newest snapshot is authoritative. The client
-- (services/cloudSnapshot.ts) refuses to auto-pull over unpushed local edits
-- and surfaces an explicit conflict choice instead.
--
-- ── SETUP ─────────────────────────────────────────────────────────────────
--
-- Run this migration once in your Supabase project (SQL Editor → paste → Run).
-- Cloud Snapshot also requires signing in with a REAL Supabase account —
-- the "Continue offline" local-only session has no auth.uid() and therefore
-- cannot read or write this table.
--
-- ── SIZE NOTE ─────────────────────────────────────────────────────────────
--
-- `payload` is jsonb. Postgres TOAST-compresses it transparently, and a
-- typical Zenith workspace serialises to well under 1 MB. The client logs a
-- warning past ~4 MB so runaway growth is visible before it becomes a problem.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zenith_snapshots (

  -- One snapshot row per account. PK = FK to auth.users so the row is
  -- removed automatically if the account is deleted.
  user_id        uuid        PRIMARY KEY
                             REFERENCES auth.users (id)
                             ON DELETE CASCADE,

  -- Full MasterBackupPayload: { version, exportedAt, schemaVersion, tables }.
  payload        jsonb       NOT NULL,

  -- Mirror of payload->>'schemaVersion' (Dexie db.verno) so the snapshot's
  -- schema generation can be inspected without deserialising the payload.
  schema_version int,

  -- Free-text hint about which browser/profile last wrote the snapshot,
  -- e.g. "Edge · Windows". Display-only; never used for access control.
  device_label   text,

  -- LWW ordering key. Maintained by the trigger in SECTION 2 — the client
  -- reads this value back and stores it as its local sync watermark.
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.zenith_snapshots                IS 'Whole-database Cloud Snapshot — one row per user holding the complete serialised IndexedDB (MasterBackupPayload). Last-write-wins.';
COMMENT ON COLUMN public.zenith_snapshots.user_id        IS 'UUID FK to auth.users — always auth.uid() of the writing client.';
COMMENT ON COLUMN public.zenith_snapshots.payload        IS 'Serialised MasterBackupPayload: { version, exportedAt, schemaVersion, tables: { tableName: rows[] } }.';
COMMENT ON COLUMN public.zenith_snapshots.schema_version IS 'Dexie db.verno at capture time — informational; the importer is schema-tolerant.';
COMMENT ON COLUMN public.zenith_snapshots.device_label   IS 'Human-readable origin hint for the most recent push (browser · platform).';
COMMENT ON COLUMN public.zenith_snapshots.updated_at     IS 'Last-write-wins watermark. Stamped by trigger on every INSERT and UPDATE.';


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — updated_at TRIGGER
--
-- The repo already ships a reusable stamping function from Phase 2.1:
--   public.handle_profile_updated_at()  (SECURITY DEFINER, sets NEW.updated_at)
-- It is table-agnostic, so it is reused here rather than duplicated. The
-- CREATE OR REPLACE below makes this migration standalone-runnable even if
-- 20260529000001_phase2_cloud_schema.sql has not been applied yet.
--
-- BEFORE INSERT OR UPDATE: the client upserts the same row repeatedly, so the
-- INSERT path must stamp the timestamp too (the DEFAULT covers plain inserts,
-- but the trigger keeps behaviour identical across both paths).
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_zenith_snapshot_written
  ON public.zenith_snapshots;

CREATE TRIGGER on_zenith_snapshot_written
  BEFORE INSERT OR UPDATE ON public.zenith_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();

COMMENT ON TRIGGER on_zenith_snapshot_written ON public.zenith_snapshots IS
  'Stamps updated_at = now() on every snapshot write so the last-write-wins watermark is server-authoritative.';


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — ROW LEVEL SECURITY
--
-- A snapshot is an entire personal workspace, so isolation is absolute:
-- every policy is scoped to user_id = auth.uid(). Anonymous clients have no
-- policy at all and therefore see and write nothing.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.zenith_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snapshots_select_own ON public.zenith_snapshots;
CREATE POLICY snapshots_select_own
  ON public.zenith_snapshots
  FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS snapshots_insert_own ON public.zenith_snapshots;
CREATE POLICY snapshots_insert_own
  ON public.zenith_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS snapshots_update_own ON public.zenith_snapshots;
CREATE POLICY snapshots_update_own
  ON public.zenith_snapshots
  FOR UPDATE
  TO authenticated
  USING      ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

DROP POLICY IF EXISTS snapshots_delete_own ON public.zenith_snapshots;
CREATE POLICY snapshots_delete_own
  ON public.zenith_snapshots
  FOR DELETE
  TO authenticated
  USING ( user_id = auth.uid() );


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — INDEX
--
-- The PK already covers the only lookup path (user_id). A temporal index is
-- added for operational queries (e.g. "which accounts have stale snapshots").
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS zenith_snapshots_updated_idx
  ON public.zenith_snapshots (updated_at DESC);
