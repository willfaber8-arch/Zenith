-- ════════════════════════════════════════════════════════════════
-- Zenith OS — Cloud Letterbox Abuse Hardening
-- ════════════════════════════════════════════════════════════════
--
-- The cloud_letterbox INSERT policy intentionally allows anonymous
-- delivery (E2E encryption protects confidentiality). Without bounds,
-- however, an anonymous client holding the public anon key could flood
-- the table with oversized rows — a storage-exhaustion / abuse vector.
--
-- This migration adds hard size ceilings on every writable column so a
-- single row can never exceed a sane envelope, and enables the 7-day
-- orphan-purge schedule the security model already assumes exists.
-- ════════════════════════════════════════════════════════════════

-- ── Per-row size ceilings (idempotent) ─────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cloud_letterbox_size_limits'
      and conrelid = 'public.cloud_letterbox'::regclass
  ) then
    alter table public.cloud_letterbox
      add constraint cloud_letterbox_size_limits
      check (
        length(encrypted_payload)   <= 100000   -- ~100 KB ciphertext envelope
        and length(recipient_peer_id)   <= 256
        and length(sender_display_name) <= 200
      );
  end if;
end $$;

-- ── Orphan-purge schedule (best-effort; requires pg_cron) ───────────────
-- Bounds table growth even if a recipient never drains their mailbox.
-- Wrapped so the migration still succeeds where pg_cron is unavailable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'zenith_letterbox_purge',
      '0 * * * *',  -- hourly
      $purge$
        delete from public.cloud_letterbox
        where created_at < now() - interval '7 days';
      $purge$
    );
  end if;
exception when others then
  -- never fail the migration on scheduling issues
  null;
end $$;
