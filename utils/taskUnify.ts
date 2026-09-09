/**
 * utils/taskUnify.ts — one list, three kinds.
 *
 * Zenith had two separate task systems that never knew about each other:
 *
 *   `todo_items`  — the Calendar's Tasks tab. Local-only, grouped into
 *                   user-made lists, optional due date, no priority.
 *   `assignments` — "Work Due". Course work and problem sets, with a
 *                   priority, a status pipeline, notifications, a nav
 *                   badge and cloud sync.
 *
 * Two lists means two places to look for "what do I have to do", which
 * is the exact thing a single command center exists to prevent. This
 * module holds the pure logic for folding them together: `assignments`
 * absorbs to-do items as a third `kind`, and everything is one list.
 *
 * No React, no Dexie. The shapes below are structural, so `Assignment`
 * and `TodoItem` from `lib/db` satisfy them without an import — which
 * is what lets the database upgrade and its tests share one definition
 * of what a migrated row looks like, rather than two that can drift.
 */

/* ── Kinds ───────────────────────────────────────────────────── */

/**
 * `reminder` is a plain to-do: a line of text, maybe a date.
 * `task` is course work: it has a subject and a priority.
 * `problem_set` is a task broken into individually tickable problems.
 *
 * An absent kind means 'task' — that is what every row written before
 * kinds existed is.
 */
export type TaskKind = 'reminder' | 'task' | 'problem_set'

export const TASK_KINDS: readonly TaskKind[] = ['reminder', 'task', 'problem_set']

export const KIND_LABEL: Record<TaskKind, string> = {
  reminder:    'Reminder',
  task:        'Task',
  problem_set: 'Problem Set',
}

/** Short badge text. Reminders get none — they are the plain default. */
export const KIND_BADGE: Record<TaskKind, string> = {
  reminder:    '',
  task:        'TASK',
  problem_set: 'SET',
}

/* ── Structural shapes ───────────────────────────────────────── */

export interface TaskLike {
  id?:       number
  title:     string
  dueDate:   string
  status:    string
  priority:  string
  kind?:     string
  listId?:   number
  courseId?: string
  problems?: { done: boolean }[]
}

export interface TodoItemLike {
  id?:        number
  categoryId: number
  title:      string
  completed:  0 | 1
  dueDate?:   string
  createdAt:  number
}

/** The rows a migrated to-do becomes. Deliberately not `Assignment` —
 *  see the module header on why this file imports nothing. */
export interface MigratedReminder {
  title:     string
  dueDate:   string
  courseId:  string
  status:    'pending' | 'completed'
  priority:  'medium'
  category:  string
  kind:      'reminder'
  listId:    number
  createdAt: number
  updatedAt: number
}

export function kindOf(a: { kind?: string }): TaskKind {
  const k = a.kind
  return k === 'reminder' || k === 'problem_set' ? k : 'task'
}

/* ── Due dates ───────────────────────────────────────────────── */

/**
 * A reminder often has no deadline — "buy stamps" is not due on a date.
 * `assignments.dueDate` is a required string, so "no date" is the empty
 * string, and every comparison has to ask this first.
 *
 * It matters more than it looks: `'' < '2026-09-09'` is `true`, so an
 * undated reminder sorts and compares as if it were due in antiquity.
 * Without this guard every dateless task reads as overdue.
 */
export function hasDueDate(a: { dueDate?: string | null }): boolean {
  return typeof a.dueDate === 'string' && a.dueDate.length > 0
}

export function isOverdue(a: TaskLike, today: string): boolean {
  if (a.status === 'completed') return false
  if (!hasDueDate(a)) return false
  return a.dueDate < today
}

export function isOpen(a: { status: string }): boolean {
  return a.status !== 'completed' && a.status !== 'archived'
}

/* ── Ordering ────────────────────────────────────────────────── */

const PRIORITY_RANK: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}

/**
 * Within a list: unfinished before finished, then soonest deadline,
 * then priority, then creation order.
 *
 * Dated items come before undated ones. An undated reminder is not
 * urgent — it is unscheduled — so it belongs under the things that
 * actually have a date attached, not above them.
 */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  const doneA = a.status === 'completed' ? 1 : 0
  const doneB = b.status === 'completed' ? 1 : 0
  if (doneA !== doneB) return doneA - doneB

  const dA = hasDueDate(a), dB = hasDueDate(b)
  if (dA !== dB) return dA ? -1 : 1
  if (dA && dB && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1

  const pA = PRIORITY_RANK[a.priority] ?? 2
  const pB = PRIORITY_RANK[b.priority] ?? 2
  if (pA !== pB) return pA - pB

  return (a.id ?? 0) - (b.id ?? 0)
}

/* ── Grouping ────────────────────────────────────────────────── */

export interface ListLike { id?: number; name: string; sortOrder?: number }

export interface TaskGroup<T> {
  /** null is the unfiled group — see `groupByList`. */
  list:  ListLike | null
  items: T[]
}

/**
 * Groups tasks under their list, with everything else last.
 *
 * Unfiled is a real place, not an error state. Course work arrives from
 * the Co-Pilot, from a note, from the study panel — none of which asks
 * which list to file it in, and none of which should have to. Demanding
 * a filing decision before a task can exist is how tasks end up not
 * getting written down.
 *
 * A task whose list was deleted lands here too, rather than vanishing
 * into a group that no longer renders.
 */
export function groupByList<T extends TaskLike>(
  tasks: readonly T[],
  lists: readonly ListLike[],
): TaskGroup<T>[] {
  const known = new Set(lists.map(l => l.id))
  const groups: TaskGroup<T>[] = lists.map(l => ({ list: l, items: [] }))
  const unfiled: TaskGroup<T> = { list: null, items: [] }

  const byId = new Map<number, TaskGroup<T>>()
  for (const g of groups) if (g.list?.id != null) byId.set(g.list.id, g)

  for (const t of tasks) {
    const target = t.listId != null && known.has(t.listId)
      ? byId.get(t.listId)!
      : unfiled
    target.items.push(t)
  }

  for (const g of groups) g.items.sort(compareTasks)
  unfiled.items.sort(compareTasks)

  /* An empty unfiled group is noise — it only earns its heading when
     something is actually in it. */
  return unfiled.items.length > 0 ? [...groups, unfiled] : groups
}

/* ── Migration ───────────────────────────────────────────────── */

/**
 * One to-do item as an assignment row.
 *
 * `priority: 'medium'` is not arbitrary. The sync engine uploads
 * assignments at high or critical priority, so anything below that
 * stays on this machine — which is where to-do items already lived.
 * Folding two lists into one should not quietly start publishing a
 * private one to a server.
 */
export function toReminder(item: TodoItemLike): MigratedReminder {
  const now = Date.now()
  return {
    title:     item.title,
    dueDate:   item.dueDate ?? '',
    courseId:  '',
    status:    item.completed === 1 ? 'completed' : 'pending',
    priority:  'medium',
    category:  'life',
    kind:      'reminder',
    listId:    item.categoryId,
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  }
}

/* ── Deadlines as instants ───────────────────────────────────── */

/**
 * The moment a date-only deadline actually passes.
 *
 * `new Date('2026-09-09')` is parsed as **UTC** midnight — the one date
 * format the spec pins to UTC rather than local time. West of Greenwich
 * that instant falls on the previous evening, so a task due the 9th
 * went "overdue" at 7pm on the 8th for a reader in New York, and at 4pm
 * for one in Los Angeles. A notification that fires a day early is
 * worse than none: it trains you to ignore the ones that are right.
 *
 * A deadline given as a day means the end of that day where the person
 * is, which is what this returns. Undated work returns null — it has no
 * moment to pass.
 */
export function dueEndOfDayMs(dueDate: string | null | undefined): number | null {
  if (typeof dueDate !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate)
  if (!m) return null
  const [, y, mo, d] = m
  /* Local constructor, then the last millisecond of that local day. */
  return new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 59, 999).getTime()
}

/**
 * The moment a date-only deadline *starts* — local midnight. Used for
 * "due in N hours" style lead times, where counting from the start of
 * the day would claim a whole day of notice that has already passed.
 */
export function dueStartOfDayMs(dueDate: string | null | undefined): number | null {
  const end = dueEndOfDayMs(dueDate)
  return end === null ? null : end - 86_399_999
}
