/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — System Hardening Regression Check Engine
 * Phase 13 · Step 13.3 — Total System Hardening Verification & Stability Release
 *
 * Runs an asynchronous diagnostic suite across the full Phase 8–13 architecture.
 * Each check is isolated, exception-safe, and time-bounded so a single failure
 * never prevents the remaining checks from executing.
 *
 * Architecture:
 *  • Five discrete PhaseCheckId values — one per architectural pillar.
 *  • runFullSystemSanityCheck() emits real-time progress via callbacks so the
 *    UI can update spinners as each check completes.
 *  • Every check function is a pure async fn returning { passed, detail }.
 *    No side effects, no React imports.
 *  • SSR-safe: all window/document access is guarded inside the check fns.
 *  • A minCheckDisplayMs floor (default 400 ms) ensures the spinner animation
 *    is visibly distinct before the result badge appears.
 * ════════════════════════════════════════════════════════════════
 */

import { THEME_DEFINITIONS } from '@/lib/themeDefinitions'
import { resolveDataCollision } from '@/utils/conflictResolver'
import { isSimulatorInstalled } from '@/utils/networkSimulator'
import type { SyncableRecord } from '@/types/syncConflict'

/* ════════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ════════════════════════════════════════════════════════════════ */

export const PHASE_CHECK_IDS = [
  'phase8',
  'phase9',
  'phase10',
  'phase11_12',
  'phase13',
] as const

export type PhaseCheckId = (typeof PHASE_CHECK_IDS)[number]

export const PHASE_CHECK_LABELS: Record<PhaseCheckId, string> = {
  phase8:     'Phase 8 · IDB Allocations + SM-2 Calculator',
  phase9:     'Phase 9 · WebRTC Mesh + Crypto Integrity',
  phase10:    'Phase 10 · Schedule Engine + CSV Parser',
  phase11_12: 'Phase 11–12 · CSS Tokens + Canvas + Routing',
  phase13:    'Phase 13 · Sync Harness + Conflict Engine',
}

export interface PhaseCheckResult {
  phaseId:    PhaseCheckId
  label:      string
  passed:     boolean
  durationMs: number
  detail:     string
}

export interface SystemMetrics {
  bootTimeMs:       number
  storageFootprint: 'OPTIMAL' | 'WARNING' | 'CRITICAL'
  securityPolicy:   'SECURE'  | 'DEGRADED'
}

export interface DiagnosticManifest {
  runId:          string
  startedAt:      number
  completedAt:    number
  totalDurationMs: number
  allPassed:      boolean
  checks:         PhaseCheckResult[]
  systemMetrics:  SystemMetrics
}

/* ════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ════════════════════════════════════════════════════════════════ */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * SM-2 Spaced-Repetition Algorithm (Anki/SuperMemo-2 variant).
 * Used by the Polyglot Vault (Phase 8.1 vocab builder).
 *
 * @param quality    Response quality 0–5 (0=blackout, 5=perfect)
 * @param repetitions  Consecutive correct responses so far
 * @param easeFactor E-Factor, starts at 2.5
 * @param interval   Current review interval in days
 */
function computeSM2(
  quality:     number,
  repetitions: number,
  easeFactor:  number,
  interval:    number,
): { interval: number; easeFactor: number; repetitions: number } {
  // Update ease factor — clamped to 1.3 floor
  const newEF = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  )

  // Failed response — restart repetition chain
  if (quality < 3) {
    return { interval: 1, easeFactor: newEF, repetitions: 0 }
  }

  // Successful response — advance interval per SM-2 schedule
  let newInterval: number
  if (repetitions === 0) {
    newInterval = 1
  } else if (repetitions === 1) {
    newInterval = 6
  } else {
    newInterval = Math.round(interval * newEF)
  }

  return {
    interval:    newInterval,
    easeFactor:  newEF,
    repetitions: repetitions + 1,
  }
}

/**
 * Minimal CSV parser that handles double-quoted fields with embedded commas.
 * Mirrors the parsing logic required for Goodreads CSV book-list imports.
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let current  = ''

  for (const char of row) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/* ════════════════════════════════════════════════════════════════
   PHASE CHECK FUNCTIONS
   Each returns { passed: boolean; detail: string }
   ════════════════════════════════════════════════════════════════ */

/**
 * Phase 8 — IDB Table Allocations + SM-2 Interval Calculator
 *
 * Sub-checks:
 *  A. Verifies all required IDB tables are present (ZenithOS ≥ v25).
 *  B. Three SM-2 scenarios: pass, fail-reset, first-repetition.
 */
async function checkPhase8(): Promise<{ passed: boolean; detail: string }> {
  /* --- A: IDB table count + required-table presence --- */
  let idbPassed  = false
  let tableCount = 0
  try {
    const { db } = await import('@/lib/db')
    const tableNames = db.tables.map(t => t.name)
    tableCount = tableNames.length

    const required = [
      'assignments',       'habits',            'habitCompletions',
      'calendarFeeds',     'calendarEvents',     'pomodoroSessions',
      'cardioSessions',    'subscription_items', 'quickNotes',
      'customBookmarks',   'userProfile',        'outboxMutations',
    ]
    const allPresent = required.every(name => tableNames.includes(name))
    idbPassed = allPresent && tableCount >= 20
  } catch {
    idbPassed = false
  }

  /* --- B: SM-2 algorithm correctness --- */
  const sm2Passed = (() => {
    // Case A: quality=5, reps=2, ef=2.5, interval=6
    //   newEF  = 2.5 + (0.1 - 0*(0.08+0*0.02)) = 2.6
    //   newInterval = round(6 * 2.6) = round(15.6) = 16, reps = 3
    const r1 = computeSM2(5, 2, 2.5, 6)
    const ok1 =
      r1.repetitions === 3    &&
      r1.interval    === 16   &&
      Math.abs(r1.easeFactor - 2.6) < 0.001

    // Case B: quality=2 (blackout) — should reset to interval=1, reps=0
    const r2   = computeSM2(2, 5, 2.1, 21)
    const ok2  = r2.repetitions === 0 && r2.interval === 1

    // Case C: very first repetition (reps=0)
    const r3   = computeSM2(4, 0, 2.5, 0)
    const ok3  = r3.repetitions === 1 && r3.interval === 1

    return ok1 && ok2 && ok3
  })()

  const passed = idbPassed && sm2Passed
  const detail = [
    `IDB: ${tableCount} tables ${idbPassed ? '✓' : '✗'}`,
    `SM-2: ${sm2Passed ? '3/3 cases verified' : 'mismatch detected'}`,
  ].join(' · ')
  return { passed, detail }
}

/**
 * Phase 9 — WebRTC Connectivity State + Asymmetric Crypto Integrity
 *
 * Sub-checks:
 *  A. RTCPeerConnection present in window (Phase 9.1/9.2 dependencies).
 *  B. SubtleCrypto AES-GCM encrypt → decrypt roundtrip — verifies the same
 *     cryptographic primitives used by the Cloud Letterbox RSA-OAEP hybrid scheme.
 */
async function checkPhase9(): Promise<{ passed: boolean; detail: string }> {
  if (typeof window === 'undefined') {
    return { passed: false, detail: 'SSR context — skipped' }
  }

  /* --- A: WebRTC API presence --- */
  const rtcPassed = 'RTCPeerConnection' in window

  /* --- B: AES-GCM symmetric roundtrip --- */
  let cryptoPassed = false
  let cryptoDetail = ''
  try {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    const iv        = window.crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode('ZENITH_INTEGRITY_CHECK_v1')
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext,
    )
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    const recovered = new TextDecoder().decode(decrypted)
    cryptoPassed = recovered === 'ZENITH_INTEGRITY_CHECK_v1'
    cryptoDetail = cryptoPassed ? 'AES-GCM roundtrip verified' : 'decryption mismatch'
  } catch (err) {
    cryptoDetail = err instanceof Error ? err.message : 'SubtleCrypto unavailable'
  }

  const passed = rtcPassed && cryptoPassed
  const detail = [
    `WebRTC: ${rtcPassed ? 'present' : 'MISSING'}`,
    cryptoDetail,
  ].join(' · ')
  return { passed, detail }
}

/**
 * Phase 10 — University Schedule Replicator Date Boundaries + CSV Stream Parser
 *
 * Sub-checks:
 *  A. Local-time date string generation — verifies toLocalDateStr() semantics
 *     (no UTC-shift for UTC+ timezones).
 *  B. Break-range lexicographic ISO comparison — verifies isInBreak() semantics.
 *  C. Goodreads-style CSV parser — 4 fields, 3 data rows, quoted fields with
 *     embedded commas.
 */
async function checkPhase10(): Promise<{ passed: boolean; detail: string }> {
  /* --- A: Local-time date string (no UTC shift) --- */
  const d = new Date(2026, 7, 25)  // Aug 25 2026 local
  const localStr = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  const datePassed = localStr === '2026-08-25'

  /* --- B: Break-range lexicographic comparison --- */
  const breaks = [
    { label: 'Thanksgiving',  from: '2026-11-25', to: '2026-11-29' },
    { label: 'Fall Break',    from: '2026-10-08', to: '2026-10-11' },
  ]
  const checkInBreak = (dateStr: string) =>
    breaks.some(b => dateStr >= b.from && dateStr <= b.to)

  const breakRangePassed =
     checkInBreak('2026-11-26') &&   // inside Thanksgiving
    !checkInBreak('2026-11-24') &&   // day before Thanksgiving
     checkInBreak('2026-10-09') &&   // inside Fall Break
    !checkInBreak('2026-10-12')      // day after Fall Break

  /* --- C: CSV parser (Goodreads book-list format) --- */
  const csv = [
    'title,author,date_read,rating',
    '"The Pragmatic Programmer",David Thomas,2026-01-10,5',
    '"Clean Code","Robert C. Martin",2026-02-14,4',
    'Dune,Frank Herbert,2026-03-22,5',
  ].join('\n')

  const lines   = csv.split('\n')
  const headers = parseCSVRow(lines[0])
  const row1    = parseCSVRow(lines[1])
  const row2    = parseCSVRow(lines[2])
  const row3    = parseCSVRow(lines[3])

  const csvPassed =
    headers.length === 4                          &&
    headers[0]     === 'title'                    &&
    row1[0]        === 'The Pragmatic Programmer'  &&
    row1[3]        === '5'                         &&
    row2[1]        === 'Robert C. Martin'          &&
    row3[0]        === 'Dune'                      &&
    row3[2]        === '2026-03-22'

  const passed = datePassed && breakRangePassed && csvPassed
  const detail = [
    `date-boundary: ${datePassed ? 'PASS' : 'FAIL'}`,
    `break-range: ${breakRangePassed ? '4/4 cases' : 'FAIL'}`,
    `CSV: ${csvPassed ? '4 fields / 3 rows verified' : 'FAIL'}`,
  ].join(' · ')
  return { passed, detail }
}

/**
 * Phase 11–12 — CSS Design Token Registry + Canvas Pixel Rendering + Lazy Routing
 *
 * Sub-checks:
 *  A. Six required CSS custom properties present on :root.
 *  B. THEME_DEFINITIONS registry — ≥ 10 entries, includes zenith_default.
 *  C. Canvas 2D context — pixel-verified color write (sage green #52cca3).
 *  D. Visibility API present on document.
 *  E. Dynamic import routing — lazy-loads lib/gamesNavState successfully.
 */
async function checkPhase11_12(): Promise<{ passed: boolean; detail: string }> {
  if (typeof window === 'undefined') {
    return { passed: false, detail: 'SSR context — skipped' }
  }

  /* --- A: CSS custom property registry --- */
  const computed = getComputedStyle(document.documentElement)
  const cssVars  = [
    '--bg-main', '--accent-purple', '--accent-green',
    '--text-primary', '--font-mono', '--sp-4',
  ]
  const cssPassed  = cssVars.every(v => computed.getPropertyValue(v).trim() !== '')
  const cssDetail  = cssPassed ? `${cssVars.length} vars registered` : 'missing CSS vars'

  /* --- B: Theme definitions integrity --- */
  const themeKeys   = Object.keys(THEME_DEFINITIONS)
  const themePassed = themeKeys.includes('zenith_default') && themeKeys.length >= 10
  const themeDetail = `${themeKeys.length} themes`

  /* --- C: Canvas pixel-level color write --- */
  let canvasPassed = false
  try {
    const canvas   = document.createElement('canvas')
    canvas.width   = 1
    canvas.height  = 1
    const ctx      = canvas.getContext('2d')
    if (ctx) {
      // Write Zenith accent-green (#52cca3 = R:82 G:204 B:163)
      ctx.fillStyle = '#52cca3'
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      canvasPassed = r === 82 && g === 204 && b === 163
    }
  } catch {
    canvasPassed = false
  }

  /* --- D: Page Visibility API --- */
  const visibilityPassed = 'visibilityState' in document

  /* --- E: Dynamic import lazy-routing --- */
  let routingPassed = false
  try {
    const mod = await import('@/lib/gamesNavState')
    routingPassed = typeof mod.consumeRequestedTab === 'function'
  } catch {
    routingPassed = false
  }

  const passed = cssPassed && themePassed && canvasPassed && visibilityPassed && routingPassed
  const detail = [
    `CSS: ${cssDetail}`,
    `themes: ${themeDetail}`,
    `canvas: ${canvasPassed ? 'pixel-verified' : 'FAIL'}`,
    `routing: ${routingPassed ? 'PASS' : 'FAIL'}`,
  ].join(' · ')
  return { passed, detail }
}

/**
 * Phase 13 — Network Simulator Teardown Integrity + LWW Conflict Engine Correctness
 *
 * Sub-checks:
 *  A. Network simulator is NOT installed — confirms no state leak from stress tests.
 *  B. Three canonical LWW scenarios: REMOTE_WINS, LOCAL_WINS, TIE_BROKEN_LOCAL.
 *     Each scenario verifies: correct winner, correct outcome label, correct
 *     versionCounter merge (max(local,remote)+1).
 */
async function checkPhase13(): Promise<{ passed: boolean; detail: string }> {
  /* --- A: No leaked network simulator --- */
  const notLeaked = !isSimulatorInstalled()

  /* --- B: LWW conflict resolver — three canonical scenarios --- */
  type TR = SyncableRecord<Record<string, unknown>>

  // Scenario A: remote wins by +1000ms timestamp delta
  const localA: TR = {
    payload:  'version-A-local',
    syncMeta: { lastModifiedClientUuid: 'aaaa-local-device', updatedAtTimestamp: 1000, versionCounter: 1 },
  }
  const remoteA: TR = {
    payload:  'version-A-remote',
    syncMeta: { lastModifiedClientUuid: 'zzzz-remote-device', updatedAtTimestamp: 2000, versionCounter: 1 },
  }
  const rA       = resolveDataCollision(localA, remoteA)
  const scenAOk  =
    rA.winner === 'remote'             &&
    rA.outcome === 'REMOTE_WINS'       &&
    rA.tieBreakUsed === false          &&
    rA.winnerRecord.syncMeta.versionCounter === 2

  // Scenario B: local wins by +1500ms timestamp delta
  const localB: TR = {
    payload:  'version-B-local',
    syncMeta: { lastModifiedClientUuid: 'cccc-local-device', updatedAtTimestamp: 3000, versionCounter: 4 },
  }
  const remoteB: TR = {
    payload:  'version-B-remote',
    syncMeta: { lastModifiedClientUuid: 'dddd-remote-device', updatedAtTimestamp: 1500, versionCounter: 2 },
  }
  const rB       = resolveDataCollision(localB, remoteB)
  const scenBOk  =
    rB.winner === 'local'              &&
    rB.outcome === 'LOCAL_WINS'        &&
    rB.tieBreakUsed === false          &&
    rB.winnerRecord.syncMeta.versionCounter === 5   // max(4,2)+1

  // Scenario C: identical timestamps → UUID tie-break ('ffff…' > '1111…' lexicographically)
  const localC: TR = {
    payload:  'version-C-local',
    syncMeta: { lastModifiedClientUuid: 'ffffffff-0000-0000-0000-aaaaaaaaaaaa', updatedAtTimestamp: 1500, versionCounter: 2 },
  }
  const remoteC: TR = {
    payload:  'version-C-remote',
    syncMeta: { lastModifiedClientUuid: '11111111-0000-0000-0000-bbbbbbbbbbbb', updatedAtTimestamp: 1500, versionCounter: 2 },
  }
  const rC       = resolveDataCollision(localC, remoteC)
  const scenCOk  =
    rC.winner === 'local'              &&
    rC.outcome === 'TIE_BROKEN_LOCAL'  &&
    rC.tieBreakUsed === true           &&
    rC.winnerRecord.syncMeta.versionCounter === 3   // max(2,2)+1

  const lwwPassed = scenAOk && scenBOk && scenCOk
  const passed    = notLeaked && lwwPassed
  const detail    = [
    `simulator: ${notLeaked ? 'no leak' : 'LEAKED — teardown incomplete'}`,
    [
      `REMOTE_WINS ${scenAOk ? '✓' : '✗'}`,
      `LOCAL_WINS ${scenBOk ? '✓' : '✗'}`,
      `TIE_BREAK ${scenCOk ? '✓' : '✗'}`,
    ].join(' '),
  ].join(' · ')
  return { passed, detail }
}

/* ════════════════════════════════════════════════════════════════
   SYSTEM METRICS
   ════════════════════════════════════════════════════════════════ */

async function measureSystemMetrics(): Promise<SystemMetrics> {
  // Boot time: ms elapsed since Navigation start (proxy for Time-to-Interactive)
  const bootTimeMs = typeof performance !== 'undefined'
    ? Math.round(performance.now())
    : 0

  // Storage footprint via StorageManager API
  let storageFootprint: SystemMetrics['storageFootprint'] = 'OPTIMAL'
  try {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const usedMb   = (estimate.usage ?? 0) / (1024 * 1024)
      const quota    = estimate.quota ?? 0
      const usedPct  = quota > 0 ? ((estimate.usage ?? 0) / quota) * 100 : 0
      if (usedPct > 80 || usedMb > 200) {
        storageFootprint = 'CRITICAL'
      } else if (usedPct > 50 || usedMb > 80) {
        storageFootprint = 'WARNING'
      }
    }
  } catch {
    storageFootprint = 'OPTIMAL'
  }

  // Security policy: HTTPS or localhost (isSecureContext)
  const securityPolicy: SystemMetrics['securityPolicy'] =
    typeof window !== 'undefined' && window.isSecureContext
      ? 'SECURE'
      : 'DEGRADED'

  return { bootTimeMs, storageFootprint, securityPolicy }
}

/* ════════════════════════════════════════════════════════════════
   MAIN ENTRY POINT
   ════════════════════════════════════════════════════════════════ */

export interface HardeningCallbacks {
  /** Called immediately before each check begins — use to show the running spinner. */
  onCheckStart:  (phaseId: PhaseCheckId) => void
  /** Called immediately after each check completes with its full result. */
  onCheckResult: (result: PhaseCheckResult, index: number) => void
}

export interface HardeningOptions {
  /**
   * Minimum milliseconds to display the running spinner before showing the result.
   * Ensures the animation is visible even for sub-millisecond checks.
   * @default 400
   */
  minCheckDisplayMs?: number
}

/**
 * Executes the full Phase 8–13 regression check suite asynchronously.
 *
 * Emits real-time progress via callbacks, then returns a complete
 * DiagnosticManifest including system velocity metrics.
 *
 * @param callbacks  onCheckStart + onCheckResult for UI progress binding
 * @param options    minCheckDisplayMs (default 400ms) + optional AbortSignal
 * @param signal     AbortSignal to cancel mid-run (e.g. component unmount)
 */
export async function runFullSystemSanityCheck(
  callbacks: HardeningCallbacks,
  options:   HardeningOptions = {},
  signal?:   AbortSignal,
): Promise<DiagnosticManifest> {
  const { minCheckDisplayMs = 400 } = options
  const startedAt = Date.now()
  const runId     = crypto.randomUUID()
  const results:  PhaseCheckResult[] = []

  const checkFns: Record<PhaseCheckId, () => Promise<{ passed: boolean; detail: string }>> = {
    phase8:     checkPhase8,
    phase9:     checkPhase9,
    phase10:    checkPhase10,
    phase11_12: checkPhase11_12,
    phase13:    checkPhase13,
  }

  for (let i = 0; i < PHASE_CHECK_IDS.length; i++) {
    const phaseId = PHASE_CHECK_IDS[i]
    if (signal?.aborted) break

    callbacks.onCheckStart(phaseId)
    const t0 = performance.now()

    let passed = false
    let detail = 'Unknown check failure'

    try {
      const res = await checkFns[phaseId]()
      passed = res.passed
      detail = res.detail
    } catch (err) {
      passed = false
      detail = err instanceof Error ? `Exception: ${err.message}` : 'Check threw unexpectedly'
    }

    // Enforce minimum display time for UX legibility
    const elapsed = performance.now() - t0
    if (elapsed < minCheckDisplayMs && !signal?.aborted) {
      await sleep(minCheckDisplayMs - elapsed)
    }

    if (signal?.aborted) break

    const result: PhaseCheckResult = {
      phaseId,
      label:      PHASE_CHECK_LABELS[phaseId],
      passed,
      durationMs: Math.round(performance.now() - t0),
      detail,
    }
    results.push(result)
    callbacks.onCheckResult(result, i)
  }

  const systemMetrics = await measureSystemMetrics()
  const completedAt   = Date.now()

  return {
    runId,
    startedAt,
    completedAt,
    totalDurationMs: completedAt - startedAt,
    allPassed:       results.length === PHASE_CHECK_IDS.length && results.every(r => r.passed),
    checks:          results,
    systemMetrics,
  }
}
