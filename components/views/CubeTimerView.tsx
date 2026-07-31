'use client'

/**
 * Zenith OS — Cube Timer
 * Creator's Choice · speedsolving timer (power-user tool modeled on cstimer.net)
 *
 * Features:
 *   • Random-move scrambles for 2x2 / 3x3 / 4x4 / Pyraminx
 *   • Spacebar hold-to-arm / release-to-start / press-to-stop timing
 *   • Configurable WCA inspection (Off / 8s / 15s / custom; +2 / DNF thresholds)
 *   • Touch / pointer press-hold-release for mobile
 *   • Penalty controls (OK / +2 / DNF) + delete, per solve and for the last
 *   • Dominant, oversized timer readout (the centrepiece)
 *   • Two stat scopes — This Session vs. All Sessions (lifetime, per puzzle)
 *   • Deep penalty-aware stats: single/mo3/ao5/12/50/100/1000 (current & best),
 *     mean, σ (std-dev), worst, success rate, +2 & DNF counts, longest streak
 *   • Lifetime totals — solve count, total solving time, PB, best ao5/ao12,
 *     mean, success rate
 *   • Pure-SVG solve-time trend chart (single + ao5/ao12 overlays)
 *   • Options panel (inspection, precision, hold duration, focus mode, delete
 *     confirmation, best/worst highlight, show-scramble, start cue) persisted
 *     to localStorage
 *   • CSV / JSON export of the active scope's solves (persistence beyond sessions)
 *   • Named sessions (create / rename / delete / switch), persisted locally
 *   • All solves stored reactively in Dexie (cube_solves)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CubeSolve } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import ZenHeading from '@/components/ui/ZenHeading'
import CubeStatsChart from '@/components/CubeStatsChart'
import {
  generateScramble,
  PUZZLE_IDS,
  PUZZLE_LABELS,
  type PuzzleId,
} from '@/utils/cubeScramble'
import {
  effectiveMs,
  formatTime,
  formatLongDuration,
  average,
  bestAverage,
  mean as meanFn,
  best as bestFn,
  worst as worstFn,
  stdev,
  successRate,
  penaltyCount,
  longestStreak,
  sumEffective,
  type StatSolve,
} from '@/utils/cubeStats'
import styles from './CubeTimerView.module.css'

/* ── constants ───────────────────────────────────────────────────── */

const SESSIONS_KEY = 'zenith_cube_sessions_v1'
const ACTIVE_KEY   = 'zenith_cube_session_v1'
const OPTIONS_KEY  = 'zenith_cube_options_v1'
const CHART_LIMIT  = 100

type Phase = 'idle' | 'inspection' | 'arming' | 'ready' | 'running'
type Penalty = CubeSolve['penalty']
type Scope = 'session' | 'lifetime'

interface SessionMeta { id: string; name: string }

interface CubeOptions {
  inspection:         'off' | '8' | '15' | 'custom'
  customInspection:   number   // seconds
  precision:          2 | 3
  holdMode:           '300' | '500' | 'custom'
  customHold:         number   // ms
  updateWhileRunning: boolean  // false → focus/blind mode (hide running time)
  confirmDelete:      boolean
  highlightBestWorst: boolean
  showScramble:       boolean
  startCue:           'green' | 'blue' | 'amber'
}

const DEFAULT_OPTIONS: CubeOptions = {
  inspection:         'off',
  customInspection:   15,
  precision:          2,
  holdMode:           '300',
  customHold:         300,
  updateWhileRunning: true,
  confirmDelete:      true,
  highlightBestWorst: true,
  showScramble:       true,
  startCue:           'green',
}

const CUE_COLORS: Record<CubeOptions['startCue'], string> = {
  green: 'var(--v-accent)',
  blue:  '#7c95ff',
  amber: '#fbbf24',
}

/* ── helpers ─────────────────────────────────────────────────────── */

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function loadSessions(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch { /* ignore */ }
  return []
}

function loadOptions(): CubeOptions {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_OPTIONS, ...parsed }
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_OPTIONS }
}

function triggerDownload(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ══════════════════════════════════════════════════════════════════ */

export default function CubeTimerView() {
  const { toast } = useToast()

  /* ── options ───────────────────────────────────────────────────── */
  const [opts, setOpts]           = useState<CubeOptions>(DEFAULT_OPTIONS)
  const [optionsOpen, setOptionsOpen] = useState(false)

  const inspectionSecs = opts.inspection === 'off'
    ? 0
    : opts.inspection === 'custom'
      ? Math.max(1, Math.floor(opts.customInspection || 15))
      : Number(opts.inspection)
  const holdMs = opts.holdMode === 'custom'
    ? Math.max(50, Math.floor(opts.customHold || 300))
    : Number(opts.holdMode)
  const precision = opts.precision

  /* ── session state ─────────────────────────────────────────────── */
  const [sessions, setSessions]           = useState<SessionMeta[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [renamingId, setRenamingId]       = useState<string | null>(null)
  const [renameValue, setRenameValue]     = useState('')

  /* ── puzzle + scramble + scope ─────────────────────────────────── */
  const [puzzle, setPuzzle]     = useState<PuzzleId>('333')
  const [scramble, setScramble] = useState<string>('')
  const [scope, setScope]       = useState<Scope>('session')

  /* ── timer state ───────────────────────────────────────────────── */
  const [phase, setPhase]                 = useState<Phase>('idle')
  const [elapsedMs, setElapsedMs]         = useState(0)
  const [inspectionMs, setInspectionMs]   = useState(0)

  /* ── solve list expansion ──────────────────────────────────────── */
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /* ── refs (kept in sync for event handlers / RAF) ──────────────── */
  const phaseRef             = useRef<Phase>('idle')
  const activeSessionRef     = useRef<string>('')
  const puzzleRef            = useRef<PuzzleId>('333')
  const scrambleRef          = useRef<string>('')
  const insSecsRef           = useRef(0)
  const holdMsRef            = useRef(300)
  const updateRunningRef     = useRef(true)
  const inspectionStartRef   = useRef(0)     // performance.now() or 0 when not inspecting
  const startTimeRef         = useRef(0)     // solve start performance.now()
  const holdTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingInsPenaltyRef = useRef<Penalty>('OK')

  phaseRef.current         = phase
  activeSessionRef.current = activeSession
  puzzleRef.current        = puzzle
  scrambleRef.current      = scramble
  insSecsRef.current       = inspectionSecs
  holdMsRef.current        = holdMs
  updateRunningRef.current = opts.updateWhileRunning

  /* ── live solves for the active session ────────────────────────── */
  const rawSolves = useLiveQuery(
    () =>
      activeSession
        ? db.cube_solves.where('sessionId').equals(activeSession).toArray()
        : Promise.resolve([] as CubeSolve[]),
    [activeSession],
  )

  /* ── live solves across ALL sessions (lifetime, filtered by puzzle) ─ */
  const rawLifetime = useLiveQuery(
    () => (db ? db.cube_solves.toArray() : Promise.resolve([] as CubeSolve[])),
    [],
  )

  // Session scope — newest-first for list; chronological for rolling stats.
  const solves = useMemo(
    () => [...(rawSolves ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [rawSolves],
  )
  const chrono: StatSolve[] = useMemo(
    () => [...solves].reverse().map(s => ({ timeMs: s.timeMs, penalty: s.penalty })),
    [solves],
  )

  // Lifetime scope — all solves for the current puzzle.
  const lifetimeSolves = useMemo(
    () =>
      [...(rawLifetime ?? [])]
        .filter(s => s.puzzle === puzzle)
        .sort((a, b) => b.createdAt - a.createdAt),
    [rawLifetime, puzzle],
  )
  const lifetimeChrono: StatSolve[] = useMemo(
    () => [...lifetimeSolves].reverse().map(s => ({ timeMs: s.timeMs, penalty: s.penalty })),
    [lifetimeSolves],
  )

  // Active scope selection.
  const activeSolves = scope === 'session' ? solves : lifetimeSolves
  const activeChrono = scope === 'session' ? chrono : lifetimeChrono

  /* ══════════════ bootstrap sessions + options + first scramble ═══ */

  useEffect(() => {
    setOpts(loadOptions())

    let list = loadSessions()
    let active = ''
    try { active = localStorage.getItem(ACTIVE_KEY) ?? '' } catch { /* ignore */ }

    if (list.length === 0) {
      const id = crypto.randomUUID()
      list = [{ id, name: 'Session 1' }]
      active = id
      try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
      try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* ignore */ }
    }
    if (!active || !list.some(s => s.id === active)) {
      active = list[0].id
      try { localStorage.setItem(ACTIVE_KEY, active) } catch { /* ignore */ }
    }

    setSessions(list)
    setActiveSession(active)

    const first = generateScramble('333')
    scrambleRef.current = first
    setScramble(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* persist options whenever they change (after first load) */
  const optionsHydrated = useRef(false)
  useEffect(() => {
    if (!optionsHydrated.current) { optionsHydrated.current = true; return }
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts)) } catch { /* ignore */ }
  }, [opts])

  const persistSessions = useCallback((list: SessionMeta[]) => {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
  }, [])

  const patchOptions = useCallback((patch: Partial<CubeOptions>) => {
    setOpts(prev => ({ ...prev, ...patch }))
  }, [])

  const confirmIf = useCallback(
    (msg: string) => !opts.confirmDelete || window.confirm(msg),
    [opts.confirmDelete],
  )

  /* ══════════════ scramble control ══════════════════════════════ */

  const newScramble = useCallback((p: PuzzleId = puzzleRef.current) => {
    const ns = generateScramble(p)
    scrambleRef.current = ns
    setScramble(ns)
  }, [])

  const changePuzzle = useCallback((p: PuzzleId) => {
    setPuzzle(p)
    puzzleRef.current = p
    newScramble(p)
  }, [newScramble])

  /* ══════════════ solve persistence ═════════════════════════════ */

  const saveSolve = useCallback(async (timeMs: number, penalty: Penalty) => {
    const sid = activeSessionRef.current
    if (!sid || !db) return
    await db.cube_solves.add({
      id:        crypto.randomUUID(),
      sessionId: sid,
      puzzle:    puzzleRef.current,
      timeMs,
      penalty,
      scramble:  scrambleRef.current,
      createdAt: Date.now(),
    })
    newScramble()
  }, [newScramble])

  /* ══════════════ timer state machine ═══════════════════════════ */

  const beginArming = useCallback(() => {
    startTimeRef.current = 0
    setPhase('arming')
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
    holdTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === 'arming') setPhase('ready')
    }, holdMsRef.current)
  }, [])

  const startSolve = useCallback(() => {
    // resolve inspection penalty from elapsed inspection time (if used)
    let pen: Penalty = 'OK'
    if (inspectionStartRef.current > 0 && insSecsRef.current > 0) {
      const ins   = performance.now() - inspectionStartRef.current
      const limit = insSecsRef.current * 1000
      if (ins > limit + 2000)      pen = 'DNF'
      else if (ins > limit)        pen = 'PLUS2'
    }
    pendingInsPenaltyRef.current = pen
    inspectionStartRef.current = 0
    startTimeRef.current = performance.now()
    setElapsedMs(0)
    setPhase('running')
  }, [])

  const stopSolve = useCallback(() => {
    const finalMs = Math.round(performance.now() - startTimeRef.current)
    setElapsedMs(finalMs)
    setPhase('idle')
    void saveSolve(finalMs, pendingInsPenaltyRef.current)
    pendingInsPenaltyRef.current = 'OK'
  }, [saveSolve])

  const handlePressStart = useCallback(() => {
    const p = phaseRef.current
    if (p === 'running') { stopSolve(); return }
    if (p === 'idle') {
      if (insSecsRef.current > 0) {
        inspectionStartRef.current = performance.now()
        setInspectionMs(0)
        setPhase('inspection')
      } else {
        beginArming()
      }
      return
    }
    if (p === 'inspection') {
      beginArming()
    }
  }, [beginArming, stopSolve])

  const handlePressEnd = useCallback(() => {
    const p = phaseRef.current
    if (p === 'arming') {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
      // released before ready → cancel; back to inspection or idle
      setPhase(inspectionStartRef.current > 0 ? 'inspection' : 'idle')
      return
    }
    if (p === 'ready') {
      startSolve()
    }
  }, [startSolve])

  /* ── keyboard bindings ─────────────────────────────────────────── */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (e.repeat) return
        handlePressStart()
      } else if (phaseRef.current === 'running') {
        // any non-space key stops a running solve
        stopSolve()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        handlePressEnd()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [handlePressStart, handlePressEnd, stopSolve])

  /* ── RAF display loop ──────────────────────────────────────────── */

  useEffect(() => {
    if (phase !== 'running' && phase !== 'inspection' &&
        phase !== 'arming'  && phase !== 'ready') return
    let raf = 0
    const loop = () => {
      if (phaseRef.current === 'running') {
        // focus mode hides the running time → skip re-render churn
        if (updateRunningRef.current) {
          setElapsedMs(performance.now() - startTimeRef.current)
        }
      } else if (inspectionStartRef.current > 0) {
        setInspectionMs(performance.now() - inspectionStartRef.current)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  /* ── cleanup on unmount ────────────────────────────────────────── */
  useEffect(() => () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
  }, [])

  /* ══════════════ session actions ═══════════════════════════════ */

  const createSession = useCallback(() => {
    const id = crypto.randomUUID()
    const meta: SessionMeta = { id, name: `Session ${sessions.length + 1}` }
    const next = [...sessions, meta]
    setSessions(next)
    persistSessions(next)
    setActiveSession(id)
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* ignore */ }
    setExpandedId(null)
    setScope('session')
  }, [sessions, persistSessions])

  const switchSession = useCallback((id: string) => {
    setActiveSession(id)
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* ignore */ }
    setExpandedId(null)
    setPhase('idle')
    setElapsedMs(0)
  }, [])

  const startRename = useCallback((id: string, current: string) => {
    setRenamingId(id)
    setRenameValue(current)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const name = renameValue.trim() || 'Session'
    const next = sessions.map(s => s.id === renamingId ? { ...s, name } : s)
    setSessions(next)
    persistSessions(next)
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, sessions, persistSessions])

  const deleteSession = useCallback(async (id: string) => {
    if (!confirmIf('Delete this session and all its solves? This cannot be undone.')) return
    if (db) await db.cube_solves.where('sessionId').equals(id).delete()

    let next = sessions.filter(s => s.id !== id)
    if (next.length === 0) {
      const nid = crypto.randomUUID()
      next = [{ id: nid, name: 'Session 1' }]
    }
    setSessions(next)
    persistSessions(next)

    if (activeSession === id) {
      const na = next[0].id
      setActiveSession(na)
      try { localStorage.setItem(ACTIVE_KEY, na) } catch { /* ignore */ }
    }
    toast('Session deleted.', 'success')
  }, [sessions, activeSession, persistSessions, toast, confirmIf])

  /* ══════════════ solve actions ═════════════════════════════════ */

  const setPenalty = useCallback(async (id: string, penalty: Penalty) => {
    if (db) await db.cube_solves.update(id, { penalty })
  }, [])

  const deleteSolve = useCallback(async (id: string) => {
    if (!confirmIf('Delete this solve?')) return
    if (db) await db.cube_solves.delete(id)
    setExpandedId(prev => (prev === id ? null : prev))
    toast('Solve deleted.', 'info')
  }, [toast, confirmIf])

  const clearSession = useCallback(async () => {
    if (!activeSession) return
    if (!confirmIf('Clear ALL solves in this session? This cannot be undone.')) return
    if (db) await db.cube_solves.where('sessionId').equals(activeSession).delete()
    setExpandedId(null)
    toast('Session cleared.', 'success')
  }, [activeSession, toast, confirmIf])

  /* ══════════════ export ════════════════════════════════════════ */

  const sessionNameOf = useCallback(
    (sid: string) => sessions.find(s => s.id === sid)?.name ?? sid,
    [sessions],
  )

  const exportRows = useMemo(
    () => [...activeSolves].sort((a, b) => a.createdAt - b.createdAt),
    [activeSolves],
  )

  const exportCsv = useCallback(() => {
    if (!exportRows.length) { toast('Nothing to export.', 'info'); return }
    const header = ['#', 'time', 'raw_ms', 'penalty', 'puzzle', 'scramble', 'date', 'session']
    const lines = exportRows.map((s, i) => {
      const eff = effectiveMs(s)
      const time = s.penalty === 'DNF' ? 'DNF' : formatTime(s.timeMs, s.penalty, precision)
      const cells = [
        String(i + 1),
        time,
        String(eff ?? ''),
        s.penalty,
        s.puzzle,
        s.scramble,
        new Date(s.createdAt).toISOString(),
        sessionNameOf(s.sessionId),
      ]
      return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [header.join(','), ...lines].join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    triggerDownload(`zenith-cube-${scope}-${puzzle}-${stamp}.csv`, csv, 'text/csv;charset=utf-8')
    toast(`Exported ${exportRows.length} solves (CSV).`, 'success')
  }, [exportRows, precision, sessionNameOf, scope, puzzle, toast])

  const exportJson = useCallback(() => {
    if (!exportRows.length) { toast('Nothing to export.', 'info'); return }
    const payload = {
      exportedAt: new Date().toISOString(),
      scope,
      puzzle,
      count: exportRows.length,
      solves: exportRows.map((s, i) => ({
        index:     i + 1,
        timeMs:    s.timeMs,
        effectiveMs: effectiveMs(s),
        penalty:   s.penalty,
        puzzle:    s.puzzle,
        scramble:  s.scramble,
        createdAt: s.createdAt,
        date:      new Date(s.createdAt).toISOString(),
        session:   sessionNameOf(s.sessionId),
      })),
    }
    const stamp = new Date().toISOString().slice(0, 10)
    triggerDownload(
      `zenith-cube-${scope}-${puzzle}-${stamp}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    )
    toast(`Exported ${exportRows.length} solves (JSON).`, 'success')
  }, [exportRows, scope, puzzle, sessionNameOf, toast])

  /* ══════════════ formatting helpers ════════════════════════════ */

  const fmtMs = useCallback(
    (v: number | null) => (v === null ? 'DNF' : formatTime(v, 'OK', precision)),
    [precision],
  )
  const solveLabel = useCallback(
    (s: { timeMs: number; penalty: Penalty }) =>
      s.penalty === 'DNF' ? 'DNF' : formatTime(s.timeMs, s.penalty, precision),
    [precision],
  )

  /* ══════════════ derived stats (active scope) ══════════════════ */

  const stats = useMemo(() => {
    const c = activeChrono
    const count = c.length
    const fmtAo = (n: number, best = false) => {
      if (count < n) return '—'
      return fmtMs(best ? bestAverage(c, n) : average(c, n))
    }
    const sd = stdev(c)
    return {
      count,
      curSingle:  count ? fmtMs(effectiveMs(c[c.length - 1])) : '—',
      bestSingle: fmtMs(bestFn(c)),
      worst:      count ? fmtMs(worstFn(c)) : '—',
      mean:       count ? fmtMs(meanFn(c)) : '—',
      stdev:      sd === null ? '—' : formatTime(sd, 'OK', precision),
      success:    count ? `${successRate(c).toFixed(1)}%` : '—',
      dnf:        penaltyCount(c, 'DNF'),
      plus2:      penaltyCount(c, 'PLUS2'),
      streak:     longestStreak(c),
      mo3Cur:     fmtAo(3),
      ao5Cur:     fmtAo(5),
      ao12Cur:    fmtAo(12),
      ao50Cur:    fmtAo(50),
      ao100Cur:   fmtAo(100),
      ao1000Cur:  fmtAo(1000),
      ao5Best:    fmtAo(5, true),
      ao12Best:   fmtAo(12, true),
      ao50Best:   fmtAo(50, true),
      ao100Best:  fmtAo(100, true),
      ao1000Best: fmtAo(1000, true),
    }
  }, [activeChrono, fmtMs, precision])

  /* ══════════════ lifetime totals ═══════════════════════════════ */

  const lifetimeTotals = useMemo(() => {
    const c = lifetimeChrono
    return {
      solves:    c.length,
      totalTime: formatLongDuration(sumEffective(c)),
      pb:        fmtMs(bestFn(c)),
      bestAo5:   c.length < 5  ? '—' : fmtMs(bestAverage(c, 5)),
      bestAo12:  c.length < 12 ? '—' : fmtMs(bestAverage(c, 12)),
      mean:      c.length ? fmtMs(meanFn(c)) : '—',
      success:   c.length ? `${successRate(c).toFixed(1)}%` : '—',
    }
  }, [lifetimeChrono, fmtMs])

  /* ══════════════ best/worst highlight ids (active scope) ═══════ */

  const { bestId, worstId } = useMemo(() => {
    if (!opts.highlightBestWorst) return { bestId: null as string | null, worstId: null as string | null }
    let bId: string | null = null, wId: string | null = null
    let bV = Infinity, wV = -Infinity
    for (const s of activeSolves) {
      const e = effectiveMs(s)
      if (e === null) continue
      if (e < bV) { bV = e; bId = s.id }
      if (e > wV) { wV = e; wId = s.id }
    }
    return { bestId: bId, worstId: wId }
  }, [activeSolves, opts.highlightBestWorst])

  /* ══════════════ display value + timer class ═══════════════════ */

  const showingInspection =
    phase === 'inspection' ||
    ((phase === 'arming' || phase === 'ready') && inspectionStartRef.current > 0)

  let displayText: string
  if (showingInspection) {
    const remaining = inspectionSecs - inspectionMs / 1000
    if (remaining > 0)       displayText = String(Math.ceil(remaining))
    else if (remaining > -2) displayText = '+2'
    else                     displayText = 'DNF'
  } else if (phase === 'running') {
    displayText = opts.updateWhileRunning ? formatTime(elapsedMs, 'OK', precision) : '•'
  } else if (solves.length) {
    displayText = solveLabel(solves[0])
  } else {
    displayText = formatTime(elapsedMs || 0, 'OK', precision)
  }

  const timerClass = [
    styles.timerDigits,
    phase === 'arming'  ? styles.timerArming  : '',
    phase === 'ready'   ? styles.timerReady   : '',
    phase === 'running' ? styles.timerRunning : '',
    showingInspection   ? styles.timerInspect : '',
  ].filter(Boolean).join(' ')

  const hintText =
    phase === 'running'      ? 'Solving — press any key to stop'
    : phase === 'arming'     ? 'Keep holding…'
    : phase === 'ready'      ? 'Release to start!'
    : phase === 'inspection' ? 'Inspecting — hold Space, release to start'
    : 'Hold Space, release to start'

  const lastSolve = solves[0]

  /* ══════════════ render ════════════════════════════════════════ */

  return (
    <div className={`${styles.root} anim-fade-in`} style={{ '--cue-color': CUE_COLORS[opts.startCue] } as React.CSSProperties}>
      <ZenHeading eyebrow="Creator's Choice · Speedcubing" title="Cube Timer" size="lg" />

      {/* ── session bar ─────────────────────────────────────────── */}
      <div className={styles.sessionBar}>
        <span className={styles.sessionLabel}>SESSION</span>
        {renamingId === activeSession ? (
          <div className={styles.renameRow}>
            <input
              className={styles.renameInput}
              value={renameValue}
              autoFocus
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
              }}
            />
            <button className={styles.miniBtn} onClick={commitRename}>Save</button>
            <button className={styles.miniBtn} onClick={() => { setRenamingId(null); setRenameValue('') }}>Cancel</button>
          </div>
        ) : (
          <>
            <select
              className={styles.sessionSelect}
              value={activeSession}
              onChange={e => switchSession(e.target.value)}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button className={styles.miniBtn} onClick={createSession}>+ New</button>
            <button
              className={styles.miniBtn}
              onClick={() => {
                const cur = sessions.find(s => s.id === activeSession)
                if (cur) startRename(cur.id, cur.name)
              }}
            >✎ Rename</button>
            <button
              className={styles.miniBtn}
              onClick={() => deleteSession(activeSession)}
            >✕ Delete</button>
            <button
              className={`${styles.miniBtn} ${optionsOpen ? styles.miniBtnActive : ''}`}
              onClick={() => setOptionsOpen(o => !o)}
              aria-expanded={optionsOpen}
            >⚙ Options</button>
          </>
        )}
      </div>

      {/* ── options panel ───────────────────────────────────────── */}
      {optionsOpen && (
        <div className={styles.optionsPanel}>

          <div className={styles.optRow}>
            <div className={styles.optLabel}>
              <span className={styles.optName}>Inspection</span>
              <span className={styles.optHint}>WCA preview; +2 over the limit, DNF at limit + 2s</span>
            </div>
            <div className={styles.optControl}>
              <Seg
                value={opts.inspection}
                onChange={v => patchOptions({ inspection: v as CubeOptions['inspection'] })}
                options={[
                  { v: 'off', label: 'Off' },
                  { v: '8', label: '8s' },
                  { v: '15', label: '15s' },
                  { v: 'custom', label: 'Custom' },
                ]}
              />
              {opts.inspection === 'custom' && (
                <input
                  type="number" min={1} max={60}
                  className={styles.optNum}
                  value={opts.customInspection}
                  onChange={e => patchOptions({ customInspection: Number(e.target.value) })}
                  aria-label="Custom inspection seconds"
                />
              )}
            </div>
          </div>

          <div className={styles.optRow}>
            <div className={styles.optLabel}>
              <span className={styles.optName}>Timer precision</span>
              <span className={styles.optHint}>Decimal places on every time</span>
            </div>
            <div className={styles.optControl}>
              <Seg
                value={String(opts.precision)}
                onChange={v => patchOptions({ precision: Number(v) === 3 ? 3 : 2 })}
                options={[
                  { v: '2', label: '2 dp' },
                  { v: '3', label: '3 dp' },
                ]}
              />
            </div>
          </div>

          <div className={styles.optRow}>
            <div className={styles.optLabel}>
              <span className={styles.optName}>Hold-to-start</span>
              <span className={styles.optHint}>Delay before the timer turns ready</span>
            </div>
            <div className={styles.optControl}>
              <Seg
                value={opts.holdMode}
                onChange={v => patchOptions({ holdMode: v as CubeOptions['holdMode'] })}
                options={[
                  { v: '300', label: '300ms' },
                  { v: '500', label: '500ms' },
                  { v: 'custom', label: 'Custom' },
                ]}
              />
              {opts.holdMode === 'custom' && (
                <input
                  type="number" min={50} max={2000} step={50}
                  className={styles.optNum}
                  value={opts.customHold}
                  onChange={e => patchOptions({ customHold: Number(e.target.value) })}
                  aria-label="Custom hold milliseconds"
                />
              )}
            </div>
          </div>

          <div className={styles.optRow}>
            <div className={styles.optLabel}>
              <span className={styles.optName}>Start cue colour</span>
              <span className={styles.optHint}>Colour when the timer is ready</span>
            </div>
            <div className={styles.optControl}>
              <Seg
                value={opts.startCue}
                onChange={v => patchOptions({ startCue: v as CubeOptions['startCue'] })}
                options={[
                  { v: 'green', label: 'Green' },
                  { v: 'blue', label: 'Blue' },
                  { v: 'amber', label: 'Amber' },
                ]}
              />
            </div>
          </div>

          <div className={styles.optToggles}>
            <ToggleRow
              label="Show running time"
              hint="Off = focus mode (hide the time until you stop)"
              checked={opts.updateWhileRunning}
              onChange={v => patchOptions({ updateWhileRunning: v })}
            />
            <ToggleRow
              label="Confirm before delete"
              checked={opts.confirmDelete}
              onChange={v => patchOptions({ confirmDelete: v })}
            />
            <ToggleRow
              label="Highlight best / worst"
              checked={opts.highlightBestWorst}
              onChange={v => patchOptions({ highlightBestWorst: v })}
            />
            <ToggleRow
              label="Show scramble"
              checked={opts.showScramble}
              onChange={v => patchOptions({ showScramble: v })}
            />
          </div>
        </div>
      )}

      {/* ── scramble bar ────────────────────────────────────────── */}
      <div className={styles.scrambleBar}>
        <div className={styles.puzzleTabs}>
          {PUZZLE_IDS.map(p => (
            <button
              key={p}
              className={`${styles.puzzleTab} ${puzzle === p ? styles.puzzleTabActive : ''}`}
              onClick={() => changePuzzle(p)}
            >
              {PUZZLE_LABELS[p]}
            </button>
          ))}
        </div>
        {opts.showScramble && (
          <div className={styles.scrambleText}>{scramble || '…'}</div>
        )}
        <button className={styles.newScrambleBtn} onClick={() => newScramble()}>↻ New</button>
      </div>

      {/* ── main grid ───────────────────────────────────────────── */}
      <div className={styles.mainGrid}>

        {/* timer zone */}
        <div className={styles.timerColumn}>
          <div
            className={styles.timerZone}
            onPointerDown={e => { e.preventDefault(); handlePressStart() }}
            onPointerUp={e => { e.preventDefault(); handlePressEnd() }}
            onPointerLeave={() => { if (phaseRef.current === 'arming') handlePressEnd() }}
            role="button"
            tabIndex={0}
            aria-label="Timer — hold to arm, release to start"
          >
            <div className={timerClass}>{displayText}</div>
            <div className={styles.hint}>{hintText}</div>
          </div>

          <label className={styles.inspectionToggle}>
            <input
              type="checkbox"
              checked={inspectionSecs > 0}
              onChange={e => patchOptions({ inspection: e.target.checked ? '15' : 'off' })}
            />
            <span>WCA inspection{inspectionSecs > 0 ? ` (${inspectionSecs}s)` : ''}</span>
          </label>

          {/* last-solve penalty controls */}
          {lastSolve && (
            <div className={styles.lastSolveRow}>
              <span className={styles.lastSolveLabel}>Last: {solveLabel(lastSolve)}</span>
              <div className={styles.penaltyBtns}>
                <button
                  className={`${styles.penBtn} ${lastSolve.penalty === 'OK' ? styles.penBtnActive : ''}`}
                  onClick={() => setPenalty(lastSolve.id, 'OK')}
                >OK</button>
                <button
                  className={`${styles.penBtn} ${lastSolve.penalty === 'PLUS2' ? styles.penBtnActive : ''}`}
                  onClick={() => setPenalty(lastSolve.id, 'PLUS2')}
                >+2</button>
                <button
                  className={`${styles.penBtn} ${lastSolve.penalty === 'DNF' ? styles.penBtnActive : ''}`}
                  onClick={() => setPenalty(lastSolve.id, 'DNF')}
                >DNF</button>
                <button className={styles.penBtnDelete} onClick={() => deleteSolve(lastSolve.id)}>Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* stats + list */}
        <div className={styles.sideColumn}>

          {/* scope + export toolbar */}
          <div className={styles.scopeBar}>
            <div className={styles.scopeTabs} role="tablist" aria-label="Statistics scope">
              <button
                role="tab"
                aria-selected={scope === 'session'}
                className={`${styles.scopeTab} ${scope === 'session' ? styles.scopeTabActive : ''}`}
                onClick={() => { setScope('session'); setExpandedId(null) }}
              >This Session</button>
              <button
                role="tab"
                aria-selected={scope === 'lifetime'}
                className={`${styles.scopeTab} ${scope === 'lifetime' ? styles.scopeTabActive : ''}`}
                onClick={() => { setScope('lifetime'); setExpandedId(null) }}
              >All Sessions</button>
            </div>
            <div className={styles.exportBtns}>
              <button className={styles.exportBtn} onClick={exportCsv}>⤓ CSV</button>
              <button className={styles.exportBtn} onClick={exportJson}>⤓ JSON</button>
            </div>
          </div>
          {scope === 'lifetime' && (
            <p className={styles.scopeNote}>Lifetime · {PUZZLE_LABELS[puzzle]} across all sessions</p>
          )}

          {/* stats table */}
          <div className={styles.statsCard}>
            <div className={styles.statsHead}>
              <span>STATISTIC</span><span>CURRENT</span><span>BEST</span>
            </div>
            <StatRow label="single" current={stats.curSingle} best={stats.bestSingle} />
            <StatRow label="mo3"    current={stats.mo3Cur}    best="—" />
            <StatRow label="ao5"    current={stats.ao5Cur}    best={stats.ao5Best} />
            <StatRow label="ao12"   current={stats.ao12Cur}   best={stats.ao12Best} />
            <StatRow label="ao50"   current={stats.ao50Cur}   best={stats.ao50Best} />
            <StatRow label="ao100"  current={stats.ao100Cur}  best={stats.ao100Best} />
            {scope === 'lifetime' && (
              <StatRow label="ao1000" current={stats.ao1000Cur} best={stats.ao1000Best} />
            )}
            <div className={styles.statsFooter}>
              <FootStat value={stats.mean}    label="mean" />
              <FootStat value={stats.stdev}   label="σ" />
              <FootStat value={stats.worst}   label="worst" />
              <FootStat value={stats.success} label="success" />
              <FootStat value={String(stats.plus2)}  label="+2" />
              <FootStat value={String(stats.dnf)}    label="dnf" />
              <FootStat value={String(stats.streak)} label="streak" />
              <FootStat value={String(stats.count)}  label="solves" />
            </div>
          </div>

          {/* solve list */}
          <div className={styles.listCard}>
            <div className={styles.listHead}>
              <span className={styles.listTitle}>SOLVES</span>
              <button
                className={styles.clearBtn}
                onClick={clearSession}
                disabled={!solves.length || scope === 'lifetime'}
                title={scope === 'lifetime' ? 'Switch to This Session to clear' : undefined}
              >Clear session</button>
            </div>
            {activeSolves.length === 0 ? (
              <div className={styles.listEmpty}>
                {scope === 'lifetime'
                  ? `No ${PUZZLE_LABELS[puzzle]} solves recorded yet.`
                  : 'No solves yet. Hold Space to begin.'}
              </div>
            ) : (
              <ol className={styles.solveList}>
                {activeSolves.map((s, i) => {
                  const idx = activeSolves.length - i
                  const expanded = expandedId === s.id
                  const hl = s.id === bestId ? styles.solveBest
                    : s.id === worstId ? styles.solveWorst : ''
                  return (
                    <li key={s.id} className={styles.solveItem}>
                      <button
                        className={styles.solveRow}
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                      >
                        <span className={styles.solveIndex}>{idx}.</span>
                        <span className={`${styles.solveTime} ${s.penalty === 'DNF' ? styles.solveDnf : ''} ${hl}`}>
                          {solveLabel(s)}
                          {s.id === bestId && <span className={styles.hlTag}>PB</span>}
                        </span>
                        <span className={styles.solveChevron}>{expanded ? '▾' : '▸'}</span>
                      </button>
                      {expanded && (
                        <div className={styles.solveDetail}>
                          <div className={styles.solveScramble}>
                            <span className={styles.detailKey}>{PUZZLE_LABELS[s.puzzle as PuzzleId] ?? s.puzzle}</span>
                            {s.scramble}
                          </div>
                          <div className={styles.penaltyBtns}>
                            <button
                              className={`${styles.penBtn} ${s.penalty === 'OK' ? styles.penBtnActive : ''}`}
                              onClick={() => setPenalty(s.id, 'OK')}
                            >OK</button>
                            <button
                              className={`${styles.penBtn} ${s.penalty === 'PLUS2' ? styles.penBtnActive : ''}`}
                              onClick={() => setPenalty(s.id, 'PLUS2')}
                            >+2</button>
                            <button
                              className={`${styles.penBtn} ${s.penalty === 'DNF' ? styles.penBtnActive : ''}`}
                              onClick={() => setPenalty(s.id, 'DNF')}
                            >DNF</button>
                            <button className={styles.penBtnDelete} onClick={() => deleteSolve(s.id)}>Delete</button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* ── analytics section (full width) ──────────────────────── */}
      <div className={styles.analytics}>
        {scope === 'lifetime' && (
          <div className={styles.lifetimeCard}>
            <div className={styles.lifetimeHead}>
              <span className={styles.lifetimeTitle}>LIFETIME · {PUZZLE_LABELS[puzzle]}</span>
            </div>
            <div className={styles.lifetimeGrid}>
              <FootStat value={String(lifetimeTotals.solves)} label="total solves" />
              <FootStat value={lifetimeTotals.totalTime}      label="time solving" />
              <FootStat value={lifetimeTotals.pb}             label="PB single" />
              <FootStat value={lifetimeTotals.bestAo5}        label="best ao5" />
              <FootStat value={lifetimeTotals.bestAo12}       label="best ao12" />
              <FootStat value={lifetimeTotals.mean}           label="mean" />
              <FootStat value={lifetimeTotals.success}        label="success" />
            </div>
          </div>
        )}

        <CubeStatsChart
          solves={activeChrono}
          limit={CHART_LIMIT}
          title={`${scope === 'lifetime' ? 'Lifetime' : 'Session'} · Solve Times (last ${Math.min(activeChrono.length, CHART_LIMIT)})`}
        />
      </div>
    </div>
  )
}

/* ── stat row sub-component ──────────────────────────────────────── */

function StatRow({ label, current, best }: { label: string; current: string; best: string }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statKey}>{label}</span>
      <span className={styles.statCur}>{current}</span>
      <span className={styles.statBest}>{best}</span>
    </div>
  )
}

function FootStat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.footStat}>
      <span className={styles.footVal}>{value}</span>
      <span className={styles.footKey}>{label}</span>
    </div>
  )
}

/* ── options sub-components ──────────────────────────────────────── */

function Seg({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <div className={styles.seg} role="group">
      {options.map(o => (
        <button
          key={o.v}
          className={`${styles.segBtn} ${value === o.v ? styles.segBtnActive : ''}`}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({
  label, hint, checked, onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggleRow}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className={styles.toggleText}>
        <span className={styles.optName}>{label}</span>
        {hint && <span className={styles.optHint}>{hint}</span>}
      </span>
    </label>
  )
}
