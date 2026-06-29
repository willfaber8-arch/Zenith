'use client'

/**
 * Zenith OS — AI Task Roadmap Architect HUD
 * Phase 8 · Step 8.2 — Interactive Goal Decomposition Controller
 *
 * Micro-action interface that accepts a high-level objective, calls
 * POST /api/roadmap to generate 4–7 structured sub-tasks, then
 * atomically injects them into the assignments IDB table.
 *
 * Phase state machine:
 *   idle      — goal input + generate button enabled
 *   loading   — pulsing "[ ARCHITECTING STEPS... ]", textarea locked
 *   success   — staggered task preview list + "Generate Another" reset
 *   error     — inline error banner + button re-enabled
 */

import { useState, useCallback, useRef }      from 'react'
import { injectAIGeneratedRoadmap }            from '@/utils/roadmapInjector'
import type { RoadmapTask }                    from '@/utils/roadmapInjector'
import { useToast }    from '@/lib/ToastContext'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import { priorityFromDays }                    from '@/utils/roadmapInjector'
import styles                                  from './RoadmapGeneratorButton.module.css'

/* ── Constants ────────────────────────────────────────────────── */

const MAX_CHARS       = 500
const WARN_THRESHOLD  = 400

const PLACEHOLDERS = [
  'Write a 20-page research paper on quantum computing…',
  'Prepare and pass the Linear Algebra final exam…',
  'Build a full-stack side project and deploy it…',
  'Complete the 12-week strength training program…',
  'Read and summarize five academic papers this semester…',
]

/* ── Helpers ──────────────────────────────────────────────────── */

type Phase = 'idle' | 'loading' | 'success' | 'error'

function formatDaysLabel(days: number): string {
  if (days === 1) return '+1d'
  if (days <= 6)  return `+${days}d`
  const weeks = (days / 7).toFixed(1).replace(/\.0$/, '')
  return `+${weeks}w`
}

function PriorityDot({ days }: { days: number }) {
  const p = priorityFromDays(days)
  const cls =
    p === 'high'   ? styles.priorityHigh   :
    p === 'medium' ? styles.priorityMedium :
                     styles.priorityLow
  return <span className={`${styles.priorityDot} ${cls}`} aria-hidden="true" />
}

/* ════════════════════════════════════════════════════════════════
   RoadmapGeneratorButton
   ════════════════════════════════════════════════════════════════ */

export default function RoadmapGeneratorButton() {
  const { toast }       = useToast()
  const { authHeaders } = useAiConfig()

  const [goal,    setGoal]    = useState('')
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [tasks,   setTasks]   = useState<RoadmapTask[]>([])
  const [errMsg,  setErrMsg]  = useState('')

  // Rotate placeholder on each fresh 'idle' reset
  const phIdx   = useRef(Math.floor(Math.random() * PLACEHOLDERS.length))
  const placeholder = PLACEHOLDERS[phIdx.current]

  const charCount = goal.length
  const canSubmit = charCount >= 3 && charCount <= MAX_CHARS && phase === 'idle'

  /* ── Generate roadmap ─────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return

    setPhase('loading')
    setErrMsg('')

    try {
      const res = await fetch('/api/roadmap', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ goal: goal.trim() }),
      })

      const data = await res.json() as { tasks?: RoadmapTask[]; error?: string }

      if (!res.ok || !data.tasks) {
        const msg = data.error ?? `Server error (${res.status})`
        setErrMsg(msg)
        setPhase('error')
        return
      }

      /* Atomic IDB injection — all tasks or none */
      const { injectedCount } = await injectAIGeneratedRoadmap(data.tasks)

      setTasks(data.tasks)
      setPhase('success')

      // useLiveQuery in sibling/parent components auto-re-renders — 0ms lag
      toast(`${injectedCount} roadmap steps added to assignments.`, 'success')

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setErrMsg(msg)
      setPhase('error')
    }
  }, [goal, canSubmit, toast])

  /* ── Reset to idle ────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    phIdx.current = (phIdx.current + 1) % PLACEHOLDERS.length
    setGoal('')
    setTasks([])
    setErrMsg('')
    setPhase('idle')
  }, [])

  /* ── Keyboard shortcut: Cmd/Ctrl + Enter ─────────────────── */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleGenerate()
    }
  }

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className={styles.container}>

      {/* ── Section header ────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <span className={styles.headerGlyph} aria-hidden="true">◈</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerEyebrow}>AI · Task Decomposition</span>
          <span className={styles.headerTitle}>Roadmap Architect</span>
        </div>
      </div>

      {/* ── Input body ────────────────────────────────────── */}
      <div className={styles.body}>
        <label className={styles.goalLabel} htmlFor="roadmap-goal">
          Objective
        </label>

        <textarea
          id="roadmap-goal"
          className={styles.goalTextarea}
          placeholder={placeholder}
          value={goal}
          onChange={e => setGoal(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={onKeyDown}
          disabled={phase === 'loading' || phase === 'success'}
          aria-label="Enter your high-level goal or objective"
          rows={3}
        />

        {/* Not-configured banner — shown when API key is missing */}
        {phase === 'error' && errMsg.toLowerCase().includes('not configured') && (
          <div className={styles.notConfigured} role="alert">
            <span className={styles.notConfiguredIcon}>⚠</span>
            <p className={styles.notConfiguredText}>
              AI service unavailable. Add <code>LLM_API_KEY</code> to{' '}
              <code>.env.local</code> and restart the dev server.
            </p>
          </div>
        )}

        {/* Generic error banner */}
        {phase === 'error' && !errMsg.toLowerCase().includes('not configured') && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon}>⊗</span>
            <p className={styles.errorText}>{errMsg}</p>
            <button
              className={styles.errorDismiss}
              onClick={() => { setPhase('idle'); setErrMsg('') }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Footer: char count + generate button */}
        <div className={styles.footer}>
          <span className={`${styles.charCount} ${charCount > WARN_THRESHOLD ? styles.charCountWarn : ''}`}>
            {charCount}/{MAX_CHARS}
          </span>

          <button
            className={`${styles.generateBtn} ${phase === 'loading' ? styles.generateBtnLoading : ''}`}
            onClick={() => void handleGenerate()}
            disabled={!canSubmit && phase !== 'loading'}
            aria-busy={phase === 'loading'}
            aria-label={
              phase === 'loading'
                ? 'Architecting roadmap steps…'
                : 'Generate AI task roadmap'
            }
          >
            {phase === 'loading'
              ? 'Generating…'
              : 'Generate Roadmap'}
          </button>
        </div>
      </div>

      {/* ── Success pane — staggered task preview ─────────── */}
      {phase === 'success' && tasks.length > 0 && (
        <div className={styles.successPane}>

          <div className={styles.successHeader}>
            <span className={styles.successTitle}>
              <span className={styles.successCheckmark}>✓</span>
              Roadmap added
            </span>
            <span className={styles.successCount}>
              {tasks.length} step{tasks.length !== 1 ? 's' : ''} → assignments
            </span>
          </div>

          <div className={styles.taskList} role="list">
            {tasks.map((task, i) => (
              <div
                key={i}
                className={styles.taskRow}
                role="listitem"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <span className={styles.taskIndex} aria-hidden="true">
                  {i + 1}
                </span>

                <span className={styles.taskTitle}>{task.title}</span>

                <div className={styles.taskMeta}>
                  <span
                    className={`${styles.categoryBadge} ${
                      task.category === 'Life'
                        ? styles.categoryLife
                        : styles.categoryAcademic
                    }`}
                  >
                    {task.category}
                  </span>

                  <span className={styles.daysBadge} aria-label={`Due in ${task.daysFromNow} days`}>
                    {formatDaysLabel(task.daysFromNow)}
                  </span>

                  <PriorityDot days={task.daysFromNow} />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.successActions}>
            <button
              className={styles.resetBtn}
              onClick={handleReset}
              aria-label="Generate another roadmap"
            >
              ↺ Generate Another Roadmap
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
