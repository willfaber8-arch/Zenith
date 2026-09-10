/**
 * lib/taskMutations.ts — every write to the one task list.
 *
 * Two screens show the same tasks now: the Calendar's Tasks tab and
 * Study Shield's work panel. Both can complete, edit, refile and delete,
 * and if each implemented that itself they would drift — one would learn
 * that finishing the last problem finishes the set and the other would
 * not, and which behaviour you got would depend on which screen you
 * happened to be looking at.
 *
 * So the writes live here once. The panels decide what to show; this
 * decides what happens.
 */

import { db, type Assignment, type ProblemItem, type Priority, type AssignmentStatus } from '@/lib/db'
import { advanceOnComplete } from '@/utils/taskRepeat'

/* ── Creating ────────────────────────────────────────────────── */

export interface NewReminder {
  title:   string
  dueDate?: string
  listId?:  number
}

/**
 * A plain to-do. No course, no priority to choose — a reminder should
 * cost one line of typing, or it does not get written down.
 */
export async function createReminder(input: NewReminder): Promise<number | null> {
  if (!db) return null
  const title = input.title.trim()
  if (!title) return null
  const now = Date.now()
  const id = await db.assignments.add({
    title,
    dueDate:  input.dueDate?.trim() || '',
    courseId: '',
    status:   'pending',
    priority: 'medium',
    category: 'life',
    kind:     'reminder',
    ...(input.listId != null ? { listId: input.listId } : {}),
    createdAt: now,
    updatedAt: now,
  } as Assignment)
  return id as number
}

/* ── Editing ─────────────────────────────────────────────────── */

export interface TaskPatch {
  title?:    string
  dueDate?:  string
  listId?:   number | undefined
  priority?: Priority
  courseId?: string
  notes?:    string
  /** A RepeatPreset, or undefined to stop it repeating — which Dexie
   *  writes as a removal, so the field goes rather than reading 'none'. */
  repeat?:   string | undefined
}

/**
 * `listId: undefined` genuinely unfiles a task — Dexie deletes a key set
 * to undefined rather than ignoring it, which is what makes "no list" a
 * removal instead of a field nobody mentioned. Verified against a real
 * database rather than assumed; there is a test pinning it.
 */
export async function updateTask(id: number, patch: TaskPatch): Promise<void> {
  if (!db) return
  await db.assignments.update(id, { ...patch, updatedAt: Date.now() })
}

/* ── Completing ──────────────────────────────────────────────── */

export function isDone(a: { status: string }): boolean {
  return a.status === 'completed'
}

/**
 * Tick or untick a task.
 *
 * A repeating task is not completed by ticking it — it moves to its
 * next date and stays open. Marking it done would take a standing
 * commitment off the list entirely, which is the opposite of what a
 * recurring chore is for.
 *
 * Returns the date it moved to, when it moved, so the caller can say so.
 */
export async function setDone(
  a: Assignment, done: boolean,
): Promise<{ repeatedTo: string } | null> {
  if (!db || a.id == null) return null

  if (done) {
    const advanced = advanceOnComplete(a)
    if (advanced) {
      await db.assignments.update(a.id, {
        dueDate: advanced.dueDate,
        status:  'pending' as AssignmentStatus,
        updatedAt: Date.now(),
      })
      return { repeatedTo: advanced.dueDate }
    }
  }

  const status: AssignmentStatus = done ? 'completed' : 'pending'
  await db.assignments.update(a.id, { status, updatedAt: Date.now() })
  return null
}

/**
 * Tick one problem. Returns whether that completed the whole set, so the
 * caller can say so — the set closing itself on the last problem is the
 * entire reason per-problem progress is worth modelling, and making you
 * tick the set separately afterwards would undo the point.
 */
export async function toggleProblem(
  a: Assignment, problemId: string,
): Promise<{ allDone: boolean; justCompleted: boolean }> {
  if (!db || !a.problems || a.id == null) return { allDone: false, justCompleted: false }

  const problems: ProblemItem[] = a.problems.map(p =>
    p.id === problemId ? { ...p, done: !p.done } : p)

  const allDone = problems.every(p => p.done)
  const justCompleted = allDone && a.status !== 'completed'

  await db.assignments.update(a.id, {
    problems,
    ...(justCompleted ? { status: 'completed' as AssignmentStatus } : {}),
    /* Un-ticking a problem in a finished set reopens it, or the set
       claims to be done while visibly holding an unfinished problem. */
    ...(!allDone && a.status === 'completed' ? { status: 'pending' as AssignmentStatus } : {}),
    updatedAt: Date.now(),
  })

  return { allDone, justCompleted }
}

/* ── Steps ───────────────────────────────────────────────────── */

/**
 * Replaces a task's list of steps.
 *
 * The same field problem sets use — see utils/subtasks on why this is
 * naming rather than a second structure. Adding the first step to a
 * finished task reopens it: a task cannot be both complete and holding
 * something unticked, and silently leaving it closed would hide the
 * step that was just added.
 */
export async function setSubtasks(
  a: Assignment, items: ProblemItem[],
): Promise<void> {
  if (!db || a.id == null) return
  const anyOpen = items.some(i => !i.done)
  await db.assignments.update(a.id, {
    problems: items,
    ...(anyOpen && a.status === 'completed'
      ? { status: 'pending' as AssignmentStatus }
      : {}),
    updatedAt: Date.now(),
  })
}

/* ── Deleting ────────────────────────────────────────────────── */

export async function deleteTask(id: number): Promise<void> {
  if (!db) return
  await db.assignments.delete(id)
}

/**
 * Deleting a list never deletes what is in it.
 *
 * The old to-do table cascaded: removing a list destroyed every task
 * inside it, with no warning and no way back. Losing a heading should
 * not cost you the work filed under it, so its tasks become unfiled —
 * somewhere you can still find them.
 */
export async function deleteList(listId: number): Promise<number> {
  if (!db) return 0
  const orphans = await db.assignments.where('listId').equals(listId).toArray()
  await db.transaction('rw', [db.assignments, db.todo_categories], async () => {
    for (const o of orphans) {
      if (o.id != null) await db.assignments.update(o.id, { listId: undefined })
    }
    await db.todo_categories.delete(listId)
  })
  return orphans.length
}
