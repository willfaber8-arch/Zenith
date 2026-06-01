/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Supabase Client Singleton
 * Phase 2 · Step 2.2 — Cloud Synchronization Pipeline
 *
 * Provides a lazily-initialised, SSR-safe Supabase client instance
 * for all cloud-sync operations in the browser.
 *
 * Environment variables required (add to .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL       — from Supabase project Settings → API
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — from Supabase project Settings → API
 *
 * When these vars are absent the module still imports safely; all
 * callers receive `null` and degrade to local-only behaviour.
 * ════════════════════════════════════════════════════════════════
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * True when both environment variables are present.
 * Use this flag to conditionally render cloud-feature UI.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/* ── Lazy singleton — one client instance per browser session ─ */
let _client: SupabaseClient | null = null

/**
 * Returns the Supabase client, or `null` when:
 *   • Called during SSR (no `window`)
 *   • `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset
 *
 * Always call inside `useEffect`, event handlers, or async route handlers —
 * never at module scope or in Server Components.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (!isSupabaseConfigured)         return null

  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        /*
         * detectSessionInUrl: false — Zenith uses its own auth gate (mock
         * JWT) rather than Supabase OAuth redirects. When Supabase Auth is
         * wired up in Phase 2.3, switch to `true` if using PKCE flow.
         */
        detectSessionInUrl: false,
      },
    })
  }

  return _client
}
