/**
 * utils/subtasks.ts — breaking a task into steps.
 *
 * The data model for this already existed: `Assignment.problems` holds
 * a list of labelled, tickable items, built for problem sets. Nothing
 * about it is problem-set-shaped. "Book flights / book hotel / renew
 * passport" is the same structure with different words, and a task list
 * that cannot express it pushes people into making three tasks that
 * have no relationship to each other.
 *
 * So this is naming and rules rather than a new field. `ProblemItem`
 * stays the stored shape; whether its list is called "problems" or
 * "steps" is a question of what kind of task is showing it.
 *
 * Pure: no React, no Dexie.
 */

/** The stored shape — structurally `ProblemItem`, imported from nothing. */
export interface SubtaskLike {
  id:    string
  label: string
  done:  boolean
}

/** What to call the list, given what kind of thing it hangs off. */
export function listLabel(kind: string): string {
  return kind === 'problem_set' ? 'Problems' : 'Steps'
}

export function itemNoun(kind: string): string {
  return kind === 'problem_set' ? 'problem' : 'step'
}

/* ── Progress ────────────────────────────────────────────────── */

export interface Progress { done: number; total: number; pct: number }

/**
 * How far through a task is.
 *
 * `null` rather than a zero-progress object when there are no steps at
 * all: a task without steps is not a task that is 0% done, and showing
 * it an empty progress bar says something untrue about it.
 */
export function progressOf(items: readonly SubtaskLike[] | undefined | null): Progress | null {
  if (!items || items.length === 0) return null
  const done = items.filter(i => i.done).length
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
}

/* ── Editing the list ────────────────────────────────────────── */

export const MAX_LABEL = 200
export const MAX_STEPS = 60

export type AddResult =
  | { ok: true;  items: SubtaskLike[] }
  | { ok: false; reason: string }

function newId(): string {
  /* crypto.randomUUID is not available in every context this runs in
     (older Safari, some test environments), and a step id only has to
     be unique within one task. */
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Appends a step.
 *
 * A blank label is refused rather than added: an unreadable row in a
 * checklist is worse than a missing one, because it still has to be
 * ticked before the task can close.
 */
export function addSubtask(
  items: readonly SubtaskLike[] | undefined,
  label: string,
): AddResult {
  const current = items ?? []
  const text = label.trim().slice(0, MAX_LABEL)
  if (!text) return { ok: false, reason: 'A step needs some text.' }
  if (current.length >= MAX_STEPS) {
    return { ok: false, reason: `A task can hold ${MAX_STEPS} steps.` }
  }
  return { ok: true, items: [...current, { id: newId(), label: text, done: false }] }
}

export function removeSubtask(
  items: readonly SubtaskLike[] | undefined,
  id: string,
): SubtaskLike[] {
  return (items ?? []).filter(i => i.id !== id)
}

export function renameSubtask(
  items: readonly SubtaskLike[] | undefined,
  id: string,
  label: string,
): SubtaskLike[] {
  const text = label.trim().slice(0, MAX_LABEL)
  /* An emptied label is a no-op rather than a wipe — see addSubtask. */
  if (!text) return [...(items ?? [])]
  return (items ?? []).map(i => (i.id === id ? { ...i, label: text } : i))
}

/**
 * Turns lines of text into steps, so a list can be pasted in.
 *
 * Strips the bullet characters people paste along with their list —
 * "- ", "* ", "1. " — because a step labelled "- buy milk" is a step
 * someone has to go back and edit.
 */
export function parseSubtaskLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_STEPS)
}
