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
import { kindOf, hasDueDate, isOpen, KIND_BADGE, type TaskKind } from '@/utils/taskUnify'
import {
  setDone, isDone, updateTask, toggleProblem as commitProblem,
} from '@/lib/taskMutations'
import { useUndoableDelete } from '@/lib/hooks/useUndoableDelete'
import styles from './StudyWorkPanel.module.css'
import MathText from '@/components/MathText'

/**
 * The kinds this panel can narrow to.
 *
 * `reminder` is here because the Calendar's to-do list and this panel
 * are now two windows onto one table (db v46). Leaving reminders out
 * would recreate the exact problem the merge removed: work that exists
 * but is invisible from whichever screen you happen to be on.
 */
type Filter = 'all' | TaskKind

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

/**
 * Undated work is unscheduled, not overdue.
 *
 * `dueDate` is a required column, so "no deadline" is the empty string —
 * and `'' < '2026-09-09'` is true, which would render every dateless
 * reminder as decades overdue. The caller checks `hasDueDate` first.
 */
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
  const undoableDelete = useUndoableDelete()

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
        if (filter !== 'all' && kindOf(a) !== filter) return false
        return showDone ? true : OPEN_STATUSES.includes(a.status)
      })
      .sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (p !== 0) return p
        /* Dated work first. An undated reminder is unscheduled rather
           than ancient, and sorting on '' would float it to the top. */
        const dA = hasDueDate(a), dB = hasDueDate(b)
        if (dA !== dB) return dA ? -1 : 1
        return a.dueDate.localeCompare(b.dueDate)
      })
  }, [all, filter, showDone])

  const counts = useMemo(() => ({
    reminders:   all.filter(a => kindOf(a) === 'reminder'    && isOpen(a)).length,
    tasks:       all.filter(a => kindOf(a) === 'task'        && isOpen(a)).length,
    problemSets: all.filter(a => kindOf(a) === 'problem_set' && isOpen(a)).length,
    overdue:     all.filter(a => isOpen(a) && hasDueDate(a) && daysUntil(a.dueDate) < 0).length,
  }), [all])

  /* ── Mutations ───────────────────────────────────────────────── */

  /*
   * The writes live in lib/taskMutations, shared with the Calendar's
   * Tasks tab. Two screens onto one table have to agree about what
   * completing something does; implementing it twice is how they stop
   * agreeing.
   */
  const setStatus = useCallback(async (a: Assignment, status: AssignmentStatus) => {
    await setDone(a, status === 'completed')
  }, [])

  const toggleProblem = useCallback(async (a: Assignment, problemId: string) => {
    const { justCompleted } = await commitProblem(a, problemId)
    if (justCompleted) toast(`"${a.title}" complete.`, 'success')
  }, [toast])

  /* ── Editing and deleting ────────────────────────────────────
     Work could be created and ticked off but never corrected, and
     never removed at all — and it arrives here from the Co-Pilot and
     from filed notes as well as by hand, which makes a wrong title
     more likely rather than less. */
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ title: '', dueDate: '', priority: 'medium' as Priority, courseId: '' })
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const beginEdit = useCallback((a: Assignment) => {
    setEditingId(a.id ?? null)
    setEditError(null)
    setConfirmDelete(null)
    setExpanded(null)
    setDraft({
      title:    a.title,
      dueDate:  hasDueDate(a) ? a.dueDate : '',
      priority: a.priority,
      courseId: a.courseId ?? '',
    })
  }, [])

  const saveEdit = useCallback(async (a: Assignment) => {
    const title = draft.title.trim()
    /* A blank title renders as a line you can neither read nor find,
       so an emptied one is refused rather than saved. */
    if (!title) { setEditError('A title is needed.'); return }
    if (a.id == null) return
    await updateTask(a.id, {
      title,
      dueDate:  draft.dueDate,
      priority: draft.priority,
      courseId: draft.courseId.trim(),
    })
    setEditingId(null)
    setEditError(null)
  }, [draft])

  const removeTask = useCallback(async (a: Assignment) => {
    if (a.id == null) return
    /* The toast carries the way back — see useUndoableDelete. */
    await undoableDelete({
      table:   'assignments',
      keys:    [a.id],
      message: `“${a.title}” deleted.`,
    })
    setConfirmDelete(null)
  }, [undoableDelete])

  const create = useCallback(async (input: {
    title: string; dueDate: string; kind: TaskKind
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
      category: input.kind === 'reminder' ? 'life' : 'scholastic',
      kind:     input.kind,
      ...(input.body ? { body: input.body } : {}),
      ...(problems.length ? { problems } : {}),
      createdAt: now,
      updatedAt: now,
    } as Assignment)

    setComposing(false)
    toast(
      input.kind === 'problem_set' ? 'Problem set added.'
        : input.kind === 'reminder' ? 'Reminder added.'
        : 'Task added.',
      'success',
    )
  }, [toast])

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className={styles.root}>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Filter work">
          {([
            ['all',         'All'],
            ['reminder',    `Reminders${counts.reminders ? ` · ${counts.reminders}` : ''}`],
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
              : filter === 'reminder'
                ? 'Reminders you add here or in the Calendar\u2019s Tasks tab both land in this one list.'
                : 'Anything you add \u2014 or ask the Co-Pilot to add \u2014 shows up here.'}
          </p>
        </div>
      )}

      <ul className={styles.list}>
        {visible.map(a => {
          const kind  = kindOf(a)
          const dated = hasDueDate(a)
          const due   = dated ? dueLabel(a.dueDate) : null
          const prog  = progressOf(a)
          const open  = expanded === a.id
          const done  = isDone(a)
          const editing = editingId === a.id

          return (
            <li
              key={a.id}
              className={`${styles.row} ${done ? styles.rowDone : ''}`}
              data-priority={a.priority}
            >
              {editing ? (
                /* The row becomes the form. Correcting a title should
                   not cost a dialog. */
                <div
                  className={styles.editRow}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setEditingId(null); setEditError(null) }
                  }}
                >
                  <input
                    className={styles.editTitle}
                    value={draft.title}
                    onChange={e => { setDraft(d => ({ ...d, title: e.target.value })); setEditError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') void saveEdit(a) }}
                    aria-label="Title"
                    maxLength={200}
                    autoFocus
                  />
                  <input
                    type="date"
                    className={styles.editField}
                    value={draft.dueDate}
                    onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))}
                    aria-label="Due date — clear it to remove the deadline"
                  />
                  <select
                    className={styles.editField}
                    value={draft.priority}
                    onChange={e => setDraft(d => ({ ...d, priority: e.target.value as Priority }))}
                    aria-label="Priority"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input
                    className={styles.editField}
                    value={draft.courseId}
                    onChange={e => setDraft(d => ({ ...d, courseId: e.target.value }))}
                    placeholder="Course"
                    aria-label="Course"
                  />
                  <button type="button" className={styles.editSave} onClick={() => void saveEdit(a)}>
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.editCancel}
                    onClick={() => { setEditingId(null); setEditError(null) }}
                  >
                    Cancel
                  </button>
                  {editError && <span className={styles.editError} role="alert">{editError}</span>}
                </div>
              ) : (
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
                    {KIND_BADGE[kind] && <span className={styles.kindTag}>{KIND_BADGE[kind]}</span>}
                    {a.courseId && <span className={styles.course}>{a.courseId}</span>}
                    {due
                      ? <span className={styles[`due_${due.tone}`]}>{due.text}</span>
                      : <span className={styles.due_ok}>No deadline</span>}
                    {prog && (
                      <span className={styles.progress}>{prog.done}/{prog.total}</span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={() => beginEdit(a)}
                  aria-label={`Edit ${a.title}`}
                  title="Edit"
                >
                  ✎
                </button>

                {confirmDelete === a.id ? (
                  /* Delete asks first, in place — an explicit second
                     press you can see, keyed to this row so a primed
                     delete can never land on a different one. */
                  <span className={styles.confirmRow} role="alert">
                    <button type="button" className={styles.confirmYes} onClick={() => void removeTask(a)}>
                      Delete
                    </button>
                    <button type="button" className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.rowAction}
                    onClick={() => { setConfirmDelete(a.id ?? null); setEditingId(null) }}
                    aria-label={`Delete ${a.title}`}
                    title="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
              )}

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
    title: string; dueDate: string; kind: TaskKind
    priority: Priority; courseId: string; problemCount: number; body: string
  }) => void
}) {
  const [title, setTitle]   = useState('')
  const [kind,  setKind]    = useState<TaskKind>('task')
  const [due,   setDue]     = useState(toLocalDateStr(new Date()))
  const [prio,  setPrio]    = useState<Priority>('medium')
  const [course, setCourse] = useState('')
  const [count, setCount]   = useState(6)
  const [body,  setBody]    = useState('')

  /*
   * A deadline is optional.
   *
   * It used to be required, which made "remember to email the registrar"
   * unrepresentable — you had to invent a date for it. An undated item
   * is unscheduled, and the list is built to show that plainly rather
   * than to refuse it.
   */
  const valid = title.trim().length > 0 && (due === '' || /^\d{4}-\d{2}-\d{2}$/.test(due))

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
        {(['reminder', 'task', 'problem_set'] as const).map(k => (
          <button
            key={k} type="button"
            className={`${styles.kindBtn} ${kind === k ? styles.kindBtnOn : ''}`}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
          >
            {k === 'reminder' ? 'Reminder' : k === 'task' ? 'Task' : 'Problem set'}
          </button>
        ))}
      </div>

      <input
        className={styles.input}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={
          kind === 'problem_set' ? 'e.g. PSet 4 — Rigid bodies'
            : kind === 'reminder' ? 'e.g. Email the registrar'
            : 'What needs doing?'
        }
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
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            title="Optional — clear it for something with no deadline"
          />
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
        Add {kind === 'problem_set' ? 'problem set' : kind === 'reminder' ? 'reminder' : 'task'}
      </button>
    </form>
  )
}
