/**
 * components/StudyWorkPanel.tsx — the assignments view that never existed.
 *
 * The `assignments` table has been fully modelled since v1 and wired into
 * the urgent-tasks widget, notifications, nav badges and the Co-Pilot's
 * `add_assignment` tool — and referenced by zero views. You could create
 * a task by asking the AI, get a badge and a notification for it, and
 * have nowhere in the app to open it.
 *
 * This is that place. Tasks and problem sets share one list behind a
 * filter rather than living in separate tabs, because two places to look
 * for "what's due" is the thing a single command center is meant to avoid.
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db, type Assignment, type AssignmentStatus, type Priority, type ProblemItem,
} from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import { todayISO, toLocalDateStr } from '@/utils/localDate'
import styles from './StudyWorkPanel.module.css'
import MathText from '@/components/MathText'

type Filter = 'all' | 'task' | 'problem_set'

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}

const OPEN_STATUSES: AssignmentStatus[] = ['pending', 'in_progress', 'overdue']

/** Days until due — negative is overdue. Local dates, never toISOString. */
function daysUntil(dueDate: string): number {
  const today = todayISO()
  if (dueDate === today) return 0
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = dueDate.split('-').map(Number)
  const a = new Date(ty, tm - 1, td).getTime()
  const b = new Date(dy, dm - 1, dd).getTime()
  return Math.round((b - a) / 86_400_000)
}

function dueLabel(dueDate: string): { text: string; tone: 'over' | 'soon' | 'ok' } {
  const d = daysUntil(dueDate)
  if (d < 0)  return { text: d === -1 ? '1 day overdue' : `${-d} days overdue`, tone: 'over' }
  if (d === 0) return { text: 'Due today',    tone: 'soon' }
  if (d === 1) return { text: 'Due tomorrow', tone: 'soon' }
  if (d <= 7)  return { text: `Due in ${d} days`, tone: 'soon' }
  return { text: `Due ${dueDate}`, tone: 'ok' }
}

function progressOf(a: Assignment): { done: number; total: number } | null {
  if (!a.problems?.length) return null
  return { done: a.problems.filter(p => p.done).length, total: a.problems.length }
}

/* ══════════════════════════════════════════════════════════════════ */

export default function StudyWorkPanel() {
  const { toast } = useToast()

  const [filter,   setFilter]   = useState<Filter>('all')
  const [showDone, setShowDone] = useState(false)
  const [composing, setComposing] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const rows = useLiveQuery(
    async () => (db ? db.assignments.toArray() : []),
    [],
  )
  const loaded = rows !== undefined
  const all: Assignment[] = useMemo(() => rows ?? [], [rows])

  const visible = useMemo(() => {
    return all
      .filter(a => {
        const kind = a.kind ?? 'task'
        if (filter !== 'all' && kind !== filter) return false
        return showDone ? true : OPEN_STATUSES.includes(a.status)
      })
      .sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        return p !== 0 ? p : a.dueDate.localeCompare(b.dueDate)
      })
  }, [all, filter, showDone])

  const counts = useMemo(() => ({
    tasks:       all.filter(a => (a.kind ?? 'task') === 'task' && OPEN_STATUSES.includes(a.status)).length,
    problemSets: all.filter(a => a.kind === 'problem_set' && OPEN_STATUSES.includes(a.status)).length,
    overdue:     all.filter(a => OPEN_STATUSES.includes(a.status) && daysUntil(a.dueDate) < 0).length,
  }), [all])

  /* ── Mutations ───────────────────────────────────────────────── */

  const setStatus = useCallback(async (a: Assignment, status: AssignmentStatus) => {
    if (!db) return
    await db.assignments.update(a.id, { status, updatedAt: Date.now() })
  }, [])

  const toggleProblem = useCallback(async (a: Assignment, problemId: string) => {
    if (!db || !a.problems) return
    const problems: ProblemItem[] = a.problems.map(p =>
      p.id === problemId ? { ...p, done: !p.done } : p)

    /* Completing the last problem completes the set. Doing this here
       rather than making the user tick twice is the whole reason
       per-problem progress is worth modelling. */
    const allDone = problems.every(p => p.done)
    await db.assignments.update(a.id, {
      problems,
      ...(allDone && a.status !== 'completed' ? { status: 'completed' as AssignmentStatus } : {}),
      updatedAt: Date.now(),
    })
    if (allDone && a.status !== 'completed') {
      toast(`"${a.title}" complete.`, 'success')
    }
  }, [toast])

  const create = useCallback(async (input: {
    title: string; dueDate: string; kind: 'task' | 'problem_set'
    priority: Priority; courseId: string; problemCount: number; body: string
  }) => {
    if (!db) return
    const now = Date.now()
    const problems: ProblemItem[] = input.kind === 'problem_set' && input.problemCount > 0
      ? Array.from({ length: input.problemCount }, (_, i) => ({
          id: crypto.randomUUID(), label: `${i + 1}`, done: false,
        }))
      : []

    await db.assignments.add({
      title:    input.title,
      dueDate:  input.dueDate,
      courseId: input.courseId,
      status:   'pending',
      priority: input.priority,
      category: 'scholastic',
      kind:     input.kind,
      ...(input.body ? { body: input.body } : {}),
      ...(problems.length ? { problems } : {}),
      createdAt: now,
      updatedAt: now,
    } as Assignment)

    setComposing(false)
    toast(input.kind === 'problem_set' ? 'Problem set added.' : 'Task added.', 'success')
  }, [toast])

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className={styles.root}>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Filter work">
          {([
            ['all',         'All'],
            ['task',        `Tasks${counts.tasks ? ` · ${counts.tasks}` : ''}`],
            ['problem_set', `Problem Sets${counts.problemSets ? ` · ${counts.problemSets}` : ''}`],
          ] as [Filter, string][]).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              className={`${styles.filter} ${filter === id ? styles.filterOn : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          {counts.overdue > 0 && (
            <span className={styles.overdueChip}>{counts.overdue} overdue</span>
          )}
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => setShowDone(s => !s)}
            aria-pressed={showDone}
          >
            {showDone ? 'Hide done' : 'Show done'}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setComposing(c => !c)}
          >
            {composing ? 'Cancel' : '+ New'}
          </button>
        </div>
      </div>

      {composing && <Composer onCreate={create} />}

      {!loaded && <p className={styles.empty}>Loading…</p>}

      {loaded && visible.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyGlyph} aria-hidden="true">◇</span>
          <p className={styles.emptyLabel}>
            {showDone ? 'Nothing here yet' : 'Nothing outstanding'}
          </p>
          <p className={styles.emptyHint}>
            {filter === 'problem_set'
              ? 'Add a problem set and track it problem by problem.'
              : 'Anything you add — or ask the Co-Pilot to add — shows up here.'}
          </p>
        </div>
      )}

      <ul className={styles.list}>
        {visible.map(a => {
          const kind = a.kind ?? 'task'
          const due  = dueLabel(a.dueDate)
          const prog = progressOf(a)
          const open = expanded === a.id
          const done = a.status === 'completed'

          return (
            <li
              key={a.id}
              className={`${styles.row} ${done ? styles.rowDone : ''}`}
              data-priority={a.priority}
            >
              <div className={styles.rowMain}>
                <button
                  type="button"
                  className={styles.check}
                  onClick={() => setStatus(a, done ? 'pending' : 'completed')}
                  aria-label={done ? `Reopen ${a.title}` : `Complete ${a.title}`}
                  aria-pressed={done}
                >
                  {done ? '✓' : ''}
                </button>

                <button
                  type="button"
                  className={styles.rowBody}
                  onClick={() => setExpanded(open ? null : (a.id ?? null))}
                  aria-expanded={open}
                >
                  <span className={styles.rowTitle}>{a.title}</span>
                  <span className={styles.rowMeta}>
                    {kind === 'problem_set' && <span className={styles.kindTag}>SET</span>}
                    {a.courseId && <span className={styles.course}>{a.courseId}</span>}
                    <span className={styles[`due_${due.tone}`]}>{due.text}</span>
                    {prog && (
                      <span className={styles.progress}>{prog.done}/{prog.total}</span>
                    )}
                  </span>
                </button>
              </div>

              {open && prog && (
                <ul className={styles.problems}>
                  {a.problems!.map(p => (
                    <li key={p.id}>
                      <label className={styles.problem}>
                        <input
                          type="checkbox"
                          checked={p.done}
                          onChange={() => toggleProblem(a, p.id)}
                        />
                        <span className={p.done ? styles.problemDone : ''}>
                          <MathText text={p.label} />
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {open && a.body && (
                <div className={styles.body}>
                  <MathText text={a.body} />
                </div>
              )}

              {open && !prog && a.notes && (
                <p className={styles.notes}>{a.notes}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Composer ──────────────────────────────────────────────────── */

function Composer({ onCreate }: {
  onCreate: (i: {
    title: string; dueDate: string; kind: 'task' | 'problem_set'
    priority: Priority; courseId: string; problemCount: number; body: string
  }) => void
}) {
  const [title, setTitle]   = useState('')
  const [kind,  setKind]    = useState<'task' | 'problem_set'>('task')
  const [due,   setDue]     = useState(toLocalDateStr(new Date()))
  const [prio,  setPrio]    = useState<Priority>('medium')
  const [course, setCourse] = useState('')
  const [count, setCount]   = useState(6)
  const [body,  setBody]    = useState('')

  const valid = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(due)

  return (
    <form
      className={styles.composer}
      onSubmit={e => {
        e.preventDefault()
        if (!valid) return
        onCreate({ title: title.trim(), dueDate: due, kind, priority: prio, courseId: course.trim(), problemCount: count, body: body.trim() })
      }}
    >
      <div className={styles.kindToggle} role="group" aria-label="Kind">
        {(['task', 'problem_set'] as const).map(k => (
          <button
            key={k} type="button"
            className={`${styles.kindBtn} ${kind === k ? styles.kindBtnOn : ''}`}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
          >
            {k === 'task' ? 'Task' : 'Problem set'}
          </button>
        ))}
      </div>

      <input
        className={styles.input}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={kind === 'problem_set' ? 'e.g. PSet 4 — Rigid bodies' : 'What needs doing?'}
        aria-label="Title"
        autoFocus
      />

      {kind === 'problem_set' && (
        <textarea
          className={styles.bodyInput}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={'Optional — the questions themselves.\nLaTeX works: $\\int_0^1 x^2 dx$ or $$F = ma$$'}
          aria-label="Problem set body"
          rows={3}
        />
      )}

      <div className={styles.composerRow}>
        <label className={styles.field}>
          <span>Due</span>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Priority</span>
          <select value={prio} onChange={e => setPrio(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Course</span>
          <input value={course} onChange={e => setCourse(e.target.value)} placeholder="optional" />
        </label>
        {kind === 'problem_set' && (
          <label className={styles.field}>
            <span>Problems</span>
            <input
              type="number" min={1} max={40} value={count}
              onChange={e => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            />
          </label>
        )}
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={!valid}>
        Add {kind === 'problem_set' ? 'problem set' : 'task'}
      </button>
    </form>
  )
}
