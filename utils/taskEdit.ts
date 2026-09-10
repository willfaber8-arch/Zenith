/**
 * utils/taskEdit.ts — checking a task edit before it is written.
 *
 * A to-do list could be added to, ticked off and deleted, but never
 * corrected — a typo in a task meant deleting it and typing it again,
 * and losing whatever it was tied to.
 *
 * The rules are small but each one exists because getting it wrong
 * destroys something: an emptied title must not silently blank a task,
 * and clearing a due date must actually clear it rather than quietly
 * leaving yesterday's deadline in place.
 *
 * Pure — no Dexie, no DOM.
 */

export interface TaskDraft {
  title:      string
  /** ISO "YYYY-MM-DD", or empty to mean "no due date". */
  dueDate:    string
  categoryId: number
}

export interface TaskPatch {
  title:      string
  /**
   * `undefined` is a real value here: it means the task should stop
   * having a due date, which is different from not mentioning one.
   */
  dueDate:    string | undefined
  categoryId: number
}

export type TaskEditResult =
  | { ok: true;  patch: TaskPatch }
  | { ok: false; reason: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Longest a task title may be, so a paste cannot wreck the layout. */
export const MAX_TITLE = 200

/**
 * Turn what is in the form into something safe to write.
 *
 * Refuses rather than guesses: an empty title would leave a row that
 * renders as a blank line you can neither read nor find, which is worse
 * than being told to type something.
 */
export function normaliseTaskEdit(draft: TaskDraft): TaskEditResult {
  const title = draft.title.trim().replace(/\s+/g, ' ')
  if (!title) return { ok: false, reason: 'A task needs a title.' }

  const due = draft.dueDate.trim()
  if (due && !ISO_DATE.test(due)) {
    return { ok: false, reason: 'That due date is not a real date.' }
  }

  if (!Number.isFinite(draft.categoryId)) {
    return { ok: false, reason: 'Pick a list for this task.' }
  }

  return {
    ok: true,
    patch: {
      title:      title.slice(0, MAX_TITLE),
      /* Empty means "no due date", which has to reach the database as a
         removal rather than as a field nobody mentioned. */
      dueDate:    due || undefined,
      categoryId: Math.floor(draft.categoryId),
    },
  }
}

/** True when nothing about the task actually changed. */
export function isNoOpEdit(
  patch: TaskPatch,
  current: { title: string; dueDate?: string; categoryId: number },
): boolean {
  return patch.title === current.title
      && (patch.dueDate ?? '') === (current.dueDate ?? '')
      && patch.categoryId === current.categoryId
}
