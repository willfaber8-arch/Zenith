/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Outbox Mutation Types
 * Phase 6 · Step 6.4 — Database Synchronisation Broker
 *
 * Defines the schema for the `outboxMutations` IndexedDB table used
 * by the syncBroker. Distinct from `pendingSyncQueue` (Phase 2.2):
 *
 *   pendingSyncQueue  — legacy per-item queue, assignments + userProfile only.
 *                       Drained by ZenithSyncEngine.reconcileLocalToCloud().
 *
 *   outboxMutations   — broker outbox, all four syncable tables, structured
 *                       CREATE / UPDATE / DELETE semantics, bulk-batched flush,
 *                       full LWW using an ISO updatedAt timestamp per record.
 *
 * Both systems run in parallel and are individually idempotent.
 * ════════════════════════════════════════════════════════════════
 */

/* ── Table / action unions ──────────────────────────────────── */

/**
 * Tables the sync broker monitors.
 *   assignments — academic tasks (cloud: supabase_urgent_tasks)
 *   habits      — daily recurring behaviours (cloud: supabase_habits)
 *   userProfile — singleton RPG state vector (cloud: supabase_user_profiles)
 *   workouts    — exercise log entries (cloud: supabase_workouts)
 */
export type OutboxTable  = 'assignments' | 'habits' | 'userProfile' | 'workouts'

/** Mutation category — richer than the legacy 'upsert'|'delete' split. */
export type OutboxAction = 'CREATE' | 'UPDATE' | 'DELETE'

/* ── Core record ────────────────────────────────────────────── */

/**
 * A single pending mutation written to the outbox before the
 * background flush occurs. The full row `payload` is snapshotted
 * at write time so the broker can build the Supabase upsert body
 * without a second IDB read.
 *
 * Field notes:
 *   id        — client-generated UUID; also used as the cloud PK
 *               for habits and workouts (injected back into IDB
 *               on the `creating` hook).
 *   updatedAt — ISO-8601 wall-clock timestamp; compared against
 *               the remote `updated_at` column for LWW arbitration.
 *               If the remote row is newer, the upload is skipped.
 */
export interface OutboxMutation {
  id:        string                    // UUID — stable across retries
  tableName: OutboxTable
  action:    OutboxAction
  payload:   Record<string, unknown>   // full row snapshot, not stringified
  timestamp: number                    // Unix ms — chronological queue order
  updatedAt: string                    // ISO-8601 — LWW comparison key
}

/* ── Cloud table routing ────────────────────────────────────── */

/**
 * Maps each local IDB table name to its Supabase counterpart.
 * Centralised so the broker, migrations, and any future tooling
 * always agree on the mapping.
 */
export const OUTBOX_CLOUD_TABLE: Record<OutboxTable, string> = {
  assignments: 'supabase_urgent_tasks',
  habits:      'supabase_habits',
  userProfile: 'supabase_user_profiles',
  workouts:    'supabase_workouts',
}
