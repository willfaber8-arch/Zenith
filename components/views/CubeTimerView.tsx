'use client'

/**
 * Zenith OS — Cube Timer
 * Creator's Choice · speedsolving timer (modeled on cstimer.net)
 *
 * Features:
 *   • Random-move scrambles for 2x2 / 3x3 / 4x4 / Pyraminx
 *   • Spacebar hold-to-arm / release-to-start / press-to-stop timing
 *   • Optional WCA 15-second inspection (default off; +2 / DNF thresholds)
 *   • Touch / pointer press-hold-release for mobile
 *   • Penalty controls (OK / +2 / DNF) + delete, per solve and for the last
 *   • Full penalty-aware stats: ao5/12/50/100 (current & best), mean, mo3,
 *     best single, worst, solve count
 *   • Named sessions (create / rename / delete / switch), persisted locally
 *   • All solves stored reactively in Dexie (cube_solves, v34)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CubeSolve } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import ZenHeading from '@/components/ui/ZenHeading'
import {
  generateScramble,
  PUZZLE_IDS,
  PUZZLE_LABELS,
  type PuzzleId,
} from '@/utils/cubeScramble'
import {
  effectiveMs,
  formatTime,
  average,
  bestAverage,
  mean as meanFn,
  best as bestFn,
  worst as worstFn,
  type StatSolve,
} from '@/utils/cubeStats'
import styles from './CubeTimerView.module.css'

/* ── constants ───────────────────────────────────────────────────── */

const SESSIONS_KEY = 'zenith_cube_sessions_v1'
const ACTIVE_KEY   = 'zenith_cube_session_v1'
const HOLD_MS      = 300          // hold duration before timer is "ready"

type Phase = 'idle' | 'inspection' | 'arming' | 'ready' | 'running'
type Penalty = CubeSolve['penalty']

interface SessionMeta { id: string; name: string }

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

/** Format a solve for compact display (respects penalty). */
function solveLabel(s: CubeSolve): string {
  if (s.penalty === 'DNF') return 'DNF'
  return formatTime(s.timeMs, s.penalty)
}

/* ══════════════════════════════════════════════════════════════════ */

export default function CubeTimerView() {
  const { toast } = useToast()

  /* ── session state ─────────────────────────────────────────────── */
  const [sessions, setSessions]           = useState<SessionMeta[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [renamingId, setRenamingId]       = useState<string | null>(null)
  const [renameValue, setRenameValue]     = useState('')

  /* ── puzzle + scramble ─────────────────────────────────────────── */
  const [puzzle, setPuzzle]     = useState<PuzzleId>('333')
  const [scramble, setScramble] = useState<string>('')

  /* ── timer state ───────────────────────────────────────────────── */
  const [phase, setPhase]                 = useState<Phase>('idle')
  const [elapsedMs, setElapsedMs]         = useState(0)
  const [inspectionMs, setInspectionMs]   = useState(0)
  const [inspectionEnabled, setInspectionEnabled] = useState(false)

  /* ── solve list expansion ──────────────────────────────────────── */
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /* ── refs (kept in sync for event handlers / RAF) ──────────────── */
  const phaseRef             = useRef<Phase>('idle')
  const activeSessionRef     = useRef<string>('')
  const puzzleRef            = useRef<PuzzleId>('333')
  const scrambleRef          = useRef<string>('')
  const inspectionEnabledRef = useRef(false)
  const inspectionStartRef   = useRef(0)     // performance.now() or 0 when not inspecting
  const startTimeRef         = useRef(0)     // solve start performance.now()
  const holdTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingInsPenaltyRef = useRef<Penalty>('OK')

  phaseRef.current             = phase
  activeSessionRef.current     = activeSession
  puzzleRef.current            = puzzle
  scrambleRef.current          = scramble
  inspectionEnabledRef.current = inspectionEnabled

  /* ── live solves for the active session ────────────────────────── */
  const rawSolves = useLiveQuery(
    () =>
      activeSession
        ? db.cube_solves.where('sessionId').equals(activeSession).toArray()
        : Promise.resolve([] as CubeSolve[]),
    [activeSession],
  )

  // newest-first for the list; chronological (oldest-first) for rolling stats
  const solves = useMemo(
    () => [...(rawSolves ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [rawSolves],
  )
  const chrono: StatSolve[] = useMemo(
    () => [...solves].reverse().map(s => ({ timeMs: s.timeMs, penalty: s.penalty })),
    [solves],
  )

  /* ══════════════ bootstrap sessions + first scramble ════════════ */

  useEffect(() => {
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

  const persistSessions = useCallback((list: SessionMeta[]) => {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
  }, [])

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
    }, HOLD_MS)
  }, [])

  const startSolve = useCallback(() => {
    // resolve inspection penalty from elapsed inspection time (if used)
    let pen: Penalty = 'OK'
    if (inspectionStartRef.current > 0) {
      const ins = performance.now() - inspectionStartRef.current
      if (ins > 17000)      pen = 'DNF'
      else if (ins > 15000) pen = 'PLUS2'
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
      if (inspectionEnabledRef.current) {
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
        setElapsedMs(performance.now() - startTimeRef.current)
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
    if (!window.confirm('Delete this session and all its solves? This cannot be undone.')) return
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
  }, [sessions, activeSession, persistSessions, toast])

  /* ══════════════ solve actions ═════════════════════════════════ */

  const setPenalty = useCallback(async (id: string, penalty: Penalty) => {
    if (db) await db.cube_solves.update(id, { penalty })
  }, [])

  const deleteSolve = useCallback(async (id: string) => {
    if (db) await db.cube_solves.delete(id)
    setExpandedId(prev => (prev === id ? null : prev))
    toast('Solve deleted.', 'info')
  }, [toast])

  const clearSession = useCallback(async () => {
    if (!activeSession) return
    if (!window.confirm('Clear ALL solves in this session? This cannot be undone.')) return
    if (db) await db.cube_solves.where('sessionId').equals(activeSession).delete()
    setExpandedId(null)
    toast('Session cleared.', 'success')
  }, [activeSession, toast])

  /* ══════════════ derived stats ═════════════════════════════════ */

  const stats = useMemo(() => {
    const fmt = (v: number | null) => (v === null ? 'DNF' : formatTime(v))
    const count = chrono.length
    // Averages need at least N solves; below that show "—" (not enough data)
    // rather than "DNF" (which means the average failed on penalties).
    const fmtAo = (n: number, best = false) => {
      if (count < n) return '—'
      return fmt(best ? bestAverage(chrono, n) : average(chrono, n))
    }
    return {
      count,
      bestSingle:  fmt(bestFn(chrono)),
      worst:       count ? fmt(worstFn(chrono)) : '—',
      mean:        count ? fmt(meanFn(chrono))  : '—',
      mo3Cur:      fmtAo(3),
      ao5Cur:      fmtAo(5),
      ao12Cur:     fmtAo(12),
      ao50Cur:     fmtAo(50),
      ao100Cur:    fmtAo(100),
      ao5Best:     fmtAo(5, true),
      ao12Best:    fmtAo(12, true),
      ao50Best:    fmtAo(50, true),
      ao100Best:   fmtAo(100, true),
    }
  }, [chrono])

  /* ══════════════ display value + timer class ═══════════════════ */

  const showingInspection =
    phase === 'inspection' ||
    ((phase === 'arming' || phase === 'ready') && inspectionStartRef.current > 0)

  let displayText: string
  if (showingInspection) {
    const remaining = 15 - inspectionMs / 1000
    if (remaining > 0)       displayText = String(Math.ceil(remaining))
    else if (remaining > -2) displayText = '+2'
    else                     displayText = 'DNF'
  } else if (phase === 'running') {
    displayText = formatTime(elapsedMs)
  } else if (solves.length) {
    displayText = solveLabel(solves[0])
  } else {
    displayText = formatTime(elapsedMs || 0)
  }

  const timerClass = [
    styles.timerDigits,
    phase === 'arming'  ? styles.timerArming  : '',
    phase === 'ready'   ? styles.timerReady   : '',
    phase === 'running' ? styles.timerRunning : '',
    showingInspection   ? styles.timerInspect : '',
  ].filter(Boolean).join(' ')

  const hintText =
    phase === 'running'    ? 'Solving — press any key to stop'
    : phase === 'arming'   ? 'Keep holding…'
    : phase === 'ready'    ? 'Release to start!'
    : phase === 'inspection' ? 'Inspecting — hold Space, release to start'
    : 'Hold Space, release to start'

  const lastSolve = solves[0]

  /* ══════════════ render ════════════════════════════════════════ */

  return (
    <div className={`${styles.root} anim-fade-in`}>
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
          </>
        )}
      </div>

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
        <div className={styles.scrambleText}>{scramble || '…'}</div>
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
              checked={inspectionEnabled}
              onChange={e => setInspectionEnabled(e.target.checked)}
            />
            <span>WCA 15s inspection</span>
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

          {/* stats table */}
          <div className={styles.statsCard}>
            <div className={styles.statsHead}>
              <span>STATISTIC</span><span>CURRENT</span><span>BEST</span>
            </div>
            <StatRow label="time"  current={stats.count ? solveLabel(solves[0]) : '—'} best={stats.bestSingle} />
            <StatRow label="mo3"   current={stats.mo3Cur}   best="—" />
            <StatRow label="ao5"   current={stats.ao5Cur}   best={stats.ao5Best} />
            <StatRow label="ao12"  current={stats.ao12Cur}  best={stats.ao12Best} />
            <StatRow label="ao50"  current={stats.ao50Cur}  best={stats.ao50Best} />
            <StatRow label="ao100" current={stats.ao100Cur} best={stats.ao100Best} />
            <div className={styles.statsFooter}>
              <div className={styles.footStat}><span className={styles.footVal}>{stats.mean}</span><span className={styles.footKey}>mean</span></div>
              <div className={styles.footStat}><span className={styles.footVal}>{stats.worst}</span><span className={styles.footKey}>worst</span></div>
              <div className={styles.footStat}><span className={styles.footVal}>{stats.count}</span><span className={styles.footKey}>solves</span></div>
            </div>
          </div>

          {/* solve list */}
          <div className={styles.listCard}>
            <div className={styles.listHead}>
              <span className={styles.listTitle}>SOLVES</span>
              <button className={styles.clearBtn} onClick={clearSession} disabled={!solves.length}>Clear session</button>
            </div>
            {solves.length === 0 ? (
              <div className={styles.listEmpty}>No solves yet. Hold Space to begin.</div>
            ) : (
              <ol className={styles.solveList}>
                {solves.map((s, i) => {
                  const idx = solves.length - i
                  const expanded = expandedId === s.id
                  return (
                    <li key={s.id} className={styles.solveItem}>
                      <button
                        className={styles.solveRow}
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                      >
                        <span className={styles.solveIndex}>{idx}.</span>
                        <span className={`${styles.solveTime} ${s.penalty === 'DNF' ? styles.solveDnf : ''}`}>
                          {solveLabel(s)}
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
