/**
 * lib/noteTaskSync.ts — a note's checklist as one task, kept in step.
 *
 * Adding a note's to-dos to the task list makes ONE task: named after
 * the note, with no due date, and each checklist line one of its steps
 * (ticked lines arrive ticked). To-do lines without a checkbox ("Call
 * mom") are written into the note as checkboxes first, so the note and
 * the task show the same list.
 *
 * From then on the two follow each other. Ticking, adding, removing or
 * renaming on either side reaches the other the next time either is
 * saved: the note calls `syncNoteTask` after every save, and the task
 * writes in lib/taskMutations call `syncTaskNote` after theirs. What
 * changes is decided by the pure three-way merge in
 * utils/noteChecklistSync; this file only reads, writes, and keeps the
 * task's status honest — all steps ticked closes it, unticking one
 * reopens it, exactly as toggleProblem does for a tap in the Tasks tab.
 *
 * Both rows are read and written in one transaction, so a tap in the
 * Tasks tab and an autosave in the note cannot interleave and each undo
 * the other's half.
 */

import { db, type Assignment, type AssignmentStatus, type ProblemItem, type QuickNote } from '@/lib/db'
import {
  initialLink, mergeChecklist, sameBase, noteChecklist, type StepLike,
} from '@/utils/noteChecklistSync'
import { deriveTitle } from '@/utils/noteTitle'

function newStepId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** "Groceries" — or "Checklist" for a note with nothing to be called. */
function taskTitleFor(note: QuickNote): string {
  const t = note.title?.trim()
  return t && t !== 'Untitled note' ? t : 'Checklist'
}

/** Status fields for a task whose steps just became `steps`. */
function statusFor(task: Assignment, steps: StepLike[]): Partial<Assignment> {
  if (steps.length === 0) return {}
  const allDone = steps.every(s => s.done)
  if (allDone && task.status !== 'completed') {
    return { status: 'completed' as AssignmentStatus, completedAt: Date.now() }
  }
  if (!allDone && task.status === 'completed') {
    return { status: 'pending' as AssignmentStatus, completedAt: undefined }
  }
  return {}
}

/** A note body changed by sync, renamed the way the editor would name it. */
function bodyPatch(note: QuickNote, body: string): Partial<QuickNote> {
  return {
    body,
    ...(note.titleManual ? {} : { title: deriveTitle(body) }),
    updatedAt: Date.now(),
  }
}

/* ── Linking ──────────────────────────────────────────────────── */

export interface LinkResult {
  taskId: number
  steps:  number
  title:  string
}

/**
 * Files the note's checklist as one task and links the two. A note that
 * is already linked to a task that still exists just syncs instead —
 * never a second task for the same list.
 */
export async function linkNoteToTask(noteId: number): Promise<LinkResult | null> {
  if (!db) return null
  return db.transaction('rw', db.quickNotes, db.assignments, async () => {
    const note = await db.quickNotes.get(noteId)
    if (!note) return null

    if (note.taskLink) {
      const existing = await db.assignments.get(note.taskLink.taskId)
      if (existing) return { taskId: existing.id!, steps: existing.problems?.length ?? 0, title: existing.title }
    }

    const { body, steps, base } = initialLink(note.body, newStepId)
    if (steps.length === 0) return null

    const title = taskTitleFor(note)
    const now = Date.now()
    const allDone = steps.every(s => s.done)
    const taskId = await db.assignments.add({
      title,
      dueDate:      '',
      courseId:     '',
      status:       allDone ? 'completed' : 'pending',
      ...(allDone ? { completedAt: now } : {}),
      priority:     'medium',
      category:     'notes',
      kind:         'task',
      problems:     steps as ProblemItem[],
      sourceNoteId: noteId,
      notes:        `From note: ${note.title}`,
      createdAt:    now,
      updatedAt:    now,
    } as Assignment) as number

    await db.quickNotes.update(noteId, {
      ...(body !== note.body ? bodyPatch(note, body) : {}),
      taskLink: { taskId, title, items: base },
    })
    return { taskId, steps: steps.length, title }
  })
}

/**
 * Stops the note and its task following each other. Both stay as they
 * are; the checklist's lines are remembered as filed, so the note does
 * not immediately offer to add them again.
 */
export async function unlinkNote(noteId: number): Promise<void> {
  if (!db) return
  await db.transaction('rw', db.quickNotes, async () => {
    const note = await db.quickNotes.get(noteId)
    if (note) await db.quickNotes.update(noteId, forgetLink(note))
  })
}

function forgetLink(note: QuickNote): Partial<QuickNote> {
  const labels = noteChecklist(note.body).map(i => i.label)
  return {
    taskLink: undefined,
    createdTasks: [...new Set([...(note.createdTasks ?? []), ...labels])],
  }
}

/* ── Keeping in step ──────────────────────────────────────────── */

export interface SyncResult {
  /** The note's body, when the sync rewrote it. */
  body?:     string
  /** The task was gone, so the link was dropped. */
  unlinked?: boolean
}

/**
 * Brings a linked note and its task level. Call after anything wrote
 * either one; a note with no link, or with nothing to change, costs two
 * reads and writes nothing.
 */
export async function syncNoteTask(noteId: number): Promise<SyncResult | null> {
  if (!db) return null
  return db.transaction('rw', db.quickNotes, db.assignments, async () => {
    const note = await db.quickNotes.get(noteId)
    const link = note?.taskLink
    if (!note || !link) return null

    const task = await db.assignments.get(link.taskId)
    if (!task) {
      await db.quickNotes.update(noteId, forgetLink(note))
      return { unlinked: true }
    }

    const r = mergeChecklist({
      body:  note.body,
      base:  link.items,
      steps: (task.problems ?? []) as StepLike[],
      newId: newStepId,
    })

    /* The task follows the note's name until someone renames the task. */
    const noteTitle = taskTitleFor(note)
    const retitle = noteTitle !== link.title && task.title === link.title

    if (r.stepsChanged || retitle) {
      await db.assignments.update(task.id!, {
        ...(r.stepsChanged ? { problems: r.steps as ProblemItem[], ...statusFor(task, r.steps) } : {}),
        ...(retitle ? { title: noteTitle } : {}),
        updatedAt: Date.now(),
      })
    }

    const nextTitle = retitle ? noteTitle : link.title
    if (r.noteChanged || !sameBase(link.items, r.base) || nextTitle !== link.title) {
      await db.quickNotes.update(noteId, {
        ...(r.noteChanged ? bodyPatch(note, r.body) : {}),
        taskLink: { taskId: link.taskId, title: nextTitle, items: r.base },
      })
    }
    return r.noteChanged ? { body: r.body } : {}
  })
}

/**
 * The task side's entry point: after a write to a task that came from a
 * note, bring that note level — but only if the note still links to
 * this task (an unlinked note's old task keeps its `sourceNoteId`).
 */
export async function syncTaskNote(task: Pick<Assignment, 'id' | 'sourceNoteId'>): Promise<void> {
  if (!db || task.id == null || task.sourceNoteId == null) return
  const note = await db.quickNotes.get(task.sourceNoteId)
  if (note?.taskLink?.taskId !== task.id) return
  await syncNoteTask(task.sourceNoteId)
}
