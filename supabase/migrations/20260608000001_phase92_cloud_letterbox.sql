-- ════════════════════════════════════════════════════════════════
-- Zenith OS — Phase 9 · Step 9.2: Encrypted Async Cloud Letterbox
-- ════════════════════════════════════════════════════════════════
--
-- Security model:
--   • Confidentiality  — AES-GCM 256 + RSA-OAEP hybrid E2E encryption.
--                        Even a full-table dump yields only ciphertext.
--   • Routing access   — RLS blocks all direct SELECT / DELETE via REST.
--                        The SECURITY DEFINER RPC is the sole read path.
--   • Zero-retention   — claim_letterbox_messages() atomically retrieves
--                        AND hard-deletes in a single transaction, leaving
--                        no durable cloud copy after consumption.
--   • Orphan guard     — messages older than 7 days are auto-purged by the
--                        scheduled cron (or the client broker on next drain).
-- ════════════════════════════════════════════════════════════════

-- ── Table ──────────────────────────────────────────────────────────────

create table if not exists public.cloud_letterbox (
  id                  uuid        primary key default gen_random_uuid(),
  recipient_peer_id   text        not null,
  sender_display_name text        not null default '',
  encrypted_payload   text        not null,
  created_at          timestamptz not null default now()
);

comment on table  public.cloud_letterbox                    is 'Zero-retention E2E encrypted async message relay (Phase 9.2). Rows are consumed and hard-deleted on first read via claim_letterbox_messages().';
comment on column public.cloud_letterbox.recipient_peer_id  is 'Target recipient WebRTC peer ID (PeerJS). Used for routing, not as a security principal.';
comment on column public.cloud_letterbox.encrypted_payload  is 'Base64-encoded JSON bundle: { wrappedKey, iv, ciphertext } — RSA-OAEP wrapped AES-GCM 256 payload.';

-- Routing index — primary query path in the RPC
create index if not exists cloud_letterbox_recipient_idx
  on public.cloud_letterbox (recipient_peer_id);

-- Temporal index — orphan-purge cron and TTL queries
create index if not exists cloud_letterbox_created_idx
  on public.cloud_letterbox (created_at);

-- ── Row Level Security ─────────────────────────────────────────────────

alter table public.cloud_letterbox enable row level security;

-- INSERT: any authenticated or anonymous client may deliver a message.
-- Delivery does not require identity — the E2E encryption ensures only
-- the holder of the correct private key can read the payload.
create policy "letterbox_deliver" on public.cloud_letterbox
  for insert
  to anon, authenticated
  with check (true);

-- SELECT: NO policy → REST API returns zero rows for all callers.
-- All retrieval is exclusively through claim_letterbox_messages() RPC.

-- DELETE: NO policy → REST API blocks all direct row deletion.
-- Deletion is exclusively atomic-with-retrieval inside the RPC.

-- ── Atomic Claim-and-Consume RPC ───────────────────────────────────────
--
-- SECURITY DEFINER runs with table-owner privileges, bypassing the RLS
-- policies defined above. The function itself enforces recipient scoping
-- via the WHERE clause before any data is returned or deleted.
--
-- FOR UPDATE SKIP LOCKED prevents duplicate consumption when two browser
-- tabs of the same user simultaneously trigger a mailbox drain.

create or replace function public.claim_letterbox_messages(p_peer_id text)
returns table (
  id                  uuid,
  sender_display_name text,
  encrypted_payload   text,
  created_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_ids uuid[];
begin
  -- Phase 1: Lock all rows destined for this peer, skipping any already
  -- locked by a concurrent drain in another tab.
  select array_agg(cl.id)
  into   v_claimed_ids
  from   cloud_letterbox cl
  where  cl.recipient_peer_id = p_peer_id
  for update skip locked;

  -- Short-circuit: nothing to consume
  if v_claimed_ids is null or cardinality(v_claimed_ids) = 0 then
    return;
  end if;

  -- Phase 2: Return the claimed rows to the caller for local decryption
  return query
    select cl.id,
           cl.sender_display_name,
           cl.encrypted_payload,
           cl.created_at
    from   cloud_letterbox cl
    where  cl.id = any(v_claimed_ids);

  -- Phase 3: Hard-delete the claimed rows — zero-retention guarantee.
  -- Runs in the same transaction as the SELECT, ensuring atomicity.
  delete from cloud_letterbox
  where  id = any(v_claimed_ids);
end;
$$;

-- Grant execution to both anonymous and authenticated Supabase roles
grant execute on function public.claim_letterbox_messages(text)
  to anon, authenticated;

comment on function public.claim_letterbox_messages(text) is
  'Atomically retrieves and hard-deletes all letterbox messages for the given peer ID. SECURITY DEFINER — bypasses RLS. Caller receives plaintext row data; decryption happens client-side.';

-- ── Orphan Purge (pg_cron — optional) ─────────────────────────────────
-- Messages older than 7 days that were never consumed (e.g. recipient
-- never came online) are deleted nightly. Requires pg_cron extension.
-- If pg_cron is unavailable, the client broker handles stale cleanup.
--
-- Uncomment and run if pg_cron is enabled on your Supabase project:
--
-- select cron.schedule(
--   'zenith-letterbox-orphan-purge',
--   '0 3 * * *',
--   $$delete from public.cloud_letterbox
--     where created_at < now() - interval '7 days'$$
-- );
