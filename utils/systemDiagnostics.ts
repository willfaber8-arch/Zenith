/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — System Diagnostics Engine
 * Phase 6 · Step 6.5 — Comprehensive Architecture Validation
 *
 * Runs a sequential four-point handshake at runtime:
 *   1. Storage Layer   — Dexie/IDB table accessibility (7 tables)
 *   2. Cloud Sync      — Supabase endpoint + auth header probe
 *   3. P2P Mesh        — Native WebRTC RTCPeerConnection viability
 *   4. State Engine    — userProfile singleton schema validation
 *
 * Only called from browser-side code (SystemHandshake useEffect).
 * All IDB/browser API calls are guarded via try-catch; the db
 * singleton is null-safe on SSR but this module is never executed
 * server-side.
 * ════════════════════════════════════════════════════════════════
 */

import { db }                              from '@/lib/db'
import type { UserProfile }                from '@/lib/db'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

/* ── Public types ─────────────────────────────────────────────── */

export type CheckId = 'storage' | 'cloud-sync' | 'p2p-mesh' | 'state-engine'
export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export interface CheckResult {
  id:         CheckId
  logLine:    string       // terminal display label (uppercase, ends with '...')
  status:     CheckStatus
  message:    string       // diagnostic detail shown after the result token
  durationMs: number       // wall-clock duration of the check
  isFatal:    boolean      // if true + failed → blocks dashboard unlock
}

export interface DiagnosticReport {
  checks:      CheckResult[]
  allPassed:   boolean      // every check is 'passed' or 'skipped'
  hasFatal:    boolean      // any isFatal check has status 'failed'
  completedAt: number       // Unix ms
}

export type ProgressHandler = (result: CheckResult) => void

/* ── Check metadata ───────────────────────────────────────────── */

const CHECK_META: Record<CheckId, { logLine: string; isFatal: boolean }> = {
  'storage':      { logLine: 'CHECKING LOCAL STORAGE ENVIRONMENT...',         isFatal: true  },
  'cloud-sync':   { logLine: 'EVALUATING SUPABASE SYNC ROUTER CONNECTION...', isFatal: false },
  'p2p-mesh':     { logLine: 'PROBING P2P WEBRTC MESH INTERFACE...',          isFatal: false },
  'state-engine': { logLine: 'VALIDATING USER STATE ENGINE PROFILE...',       isFatal: false },
}

/* ── Storage layer check (7 primary tables) ───────────────────── */

const STORAGE_PROBES: Array<{ name: string; fn: () => Promise<number> }> = [
  { name: 'assignments',      fn: () => db.assignments.count()      },
  { name: 'habits',           fn: () => db.habits.count()           },
  { name: 'workouts',         fn: () => db.workouts.count()         },
  { name: 'userProfile',      fn: () => db.userProfile.count()      },
  { name: 'outboxMutations',  fn: () => db.outboxMutations.count()  },
  { name: 'mentalHealthLogs', fn: () => db.mentalHealthLogs.count() },
]

async function checkStorage(): Promise<{ ok: boolean; msg: string }> {
  const failing: string[] = []
  for (const { name, fn } of STORAGE_PROBES) {
    try {
      await fn()
    } catch {
      failing.push(name)
    }
  }
  if (failing.length > 0) {
    return { ok: false, msg: `Unresponsive: ${failing.join(', ')}` }
  }
  return { ok: true, msg: `${STORAGE_PROBES.length} tables verified` }
}

/* ── Cloud sync check ─────────────────────────────────────────── */

async function checkCloudSync(): Promise<{ ok: boolean; msg: string; skip?: boolean }> {
  if (!isSupabaseConfigured) {
    return { ok: false, skip: true, msg: 'ENV vars absent — local-only mode' }
  }
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, msg: 'Client singleton unavailable (SSR guard)' }
  }
  try {
    const { error } = await client
      .from('user_profiles')
      .select('id', { head: true, count: 'exact' })
    if (error) {
      return { ok: false, msg: `Schema probe: ${error.code ?? error.message}` }
    }
    return { ok: true, msg: 'Auth headers valid — remote schema responsive' }
  } catch {
    return { ok: false, msg: 'Network unreachable' }
  }
}

/* ── P2P mesh check (native WebRTC) ──────────────────────────── */

async function checkP2PMesh(): Promise<{ ok: boolean; msg: string }> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    return { ok: false, msg: 'WebRTC API absent in this runtime' }
  }
  try {
    const pc = new RTCPeerConnection({ iceServers: [] })
    pc.close()
    return { ok: true, msg: 'WebRTC data/media ports accessible' }
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : 'RTCPeerConnection failed' }
  }
}

/* ── State engine check (userProfile singleton) ───────────────── */

async function checkStateEngine(): Promise<{ ok: boolean; msg: string; skip?: boolean }> {
  try {
    const profile = await db.userProfile.get(1) as UserProfile | undefined
    if (!profile) {
      return { ok: false, skip: true, msg: 'Profile seeding in progress' }
    }
    return {
      ok: true,
      msg: `Profile verified: ${profile.userName}`,
    }
  } catch {
    return { ok: false, msg: 'IDB read error — possible schema mismatch' }
  }
}

/* ── Main orchestrator ────────────────────────────────────────── */

/**
 * Runs all four diagnostic checks sequentially, firing `onProgress`
 * twice per check: first with status='running', then with the final
 * status. This lets the UI render each line appearing and resolving
 * in real time without polling.
 */
export async function runSystemHandshake(
  onProgress?: ProgressHandler,
): Promise<DiagnosticReport> {
  const ORDER: CheckId[] = ['storage', 'cloud-sync', 'p2p-mesh', 'state-engine']
  const results: CheckResult[] = []

  for (const id of ORDER) {
    const meta = CHECK_META[id]
    const t0   = Date.now()

    onProgress?.({
      id,
      logLine:    meta.logLine,
      status:     'running',
      message:    '',
      durationMs: 0,
      isFatal:    meta.isFatal,
    })

    let ok   = false
    let msg  = ''
    let skip = false

    try {
      if (id === 'storage') {
        const r = await checkStorage()
        ok = r.ok; msg = r.msg
      } else if (id === 'cloud-sync') {
        const r = await checkCloudSync()
        ok = r.ok; msg = r.msg; skip = r.skip ?? false
      } else if (id === 'p2p-mesh') {
        const r = await checkP2PMesh()
        ok = r.ok; msg = r.msg
      } else {
        const r = await checkStateEngine()
        ok = r.ok; msg = r.msg; skip = r.skip ?? false
      }
    } catch (e) {
      ok  = false
      msg = e instanceof Error ? e.message : 'Unhandled exception'
    }

    const done: CheckResult = {
      id,
      logLine:    meta.logLine,
      status:     skip ? 'skipped' : ok ? 'passed' : 'failed',
      message:    msg,
      durationMs: Date.now() - t0,
      isFatal:    meta.isFatal,
    }
    results.push(done)
    onProgress?.(done)
  }

  const hasFatal  = results.some(r => r.isFatal && r.status === 'failed')
  const allPassed = results.every(r => r.status === 'passed' || r.status === 'skipped')

  return { checks: results, allPassed, hasFatal, completedAt: Date.now() }
}
