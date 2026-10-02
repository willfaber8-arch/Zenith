/**
 * utils/noteChecklistSync.ts — a note's checklist and its task's steps,
 * kept as one list.
 *
 * Pure: no React, no Dexie. lib/noteTaskSync.ts does the reading and
 * writing; everything that decides *what* changes lives here, so it can
 * be tested line by line.
 *
 * A note's checklist becomes one task, and each checklist line one of
 * its steps. After that either side can change — a line ticked in the
 * note, a step ticked in the Tasks tab, a line added, a step removed —
 * and the other has to follow. Two copies with no memory of each other
 * cannot tell "you deleted this here" from "it was added over there",
 * so the link keeps a third: `base`, the list as both sides last agreed
 * on it. Each sync is then an ordinary three-way merge:
 *
 *   · changed on one side only  → that side's version wins
 *   · added on either side      → added to both
 *   · deleted on one side       → deleted from both, unless the other
 *                                 side changed it meanwhile (a step you
 *                                 just ticked is not silently thrown away)
 *   · ticked differently on both → the note wins; it is the one in front
 *                                 of you when it happens
 *
 * Lines have no ids, so a note line is matched to `base` by its text
 * (case and punctuation ignored, the nth "Milk" to the nth "Milk"). A
 * line whose text was edited then pairs with the base item that lost its
 * line, when exactly that many went missing — so a rename keeps the step,
 * its tick and its notes rather than becoming a delete and an add.
 *
 * The body is rewritten line by line: only lines whose tick or text
 * changed are touched, deleted ones are removed, and new ones go in after
 * the last checklist line. Nothing changed means the body comes back
 * identical, character for character.
 */

import { detectTasks, normalise } from '@/lib/engines/NoteTaskDetector'

/** Same bounds the Tasks tab enforces on steps (utils/subtasks). */
export const MAX_LINK_STEPS = 60
const MAX_LABEL = 200

/** One item as both sides last agreed on it. */
export interface LinkItem {
  stepId: string
  label:  string
  done:   boolean
}

/** A task step — structurally `ProblemItem`, extra fields carried through. */
export interface StepLike {
  id:    string
  label: string
  done:  boolean
  [extra: string]: unknown
}

/** A checklist line in the note. */
export interface NoteItem {
  line:  number
  label: string
  done:  boolean
}

/* ── Reading the note ─────────────────────────────────────────── */

/** The note's checkbox lines, in order. Imperative inference is not a checklist. */
export function noteChecklist(body: string): NoteItem[] {
  return detectTasks(body)
    .filter(t => t.via === 'checkbox')
    .map(t => ({ line: t.line, label: t.text, done: t.done }))
}

const CHECK_LINE_RE = /^(\s*(?:[-*+]|\d+[.)])\s*)\[([ xX])\](\s*)(.+?)(\s*)$/

/* ── Imperative lines → checklist ─────────────────────────────── */

const TODO_PREFIX_RE  = /^(?:todo|to-do|task)\b[:\s]+/i
const REMIND_PREFIX_RE = /^(?:remember to|need to|make sure to|don't forget to)\s+/i

/**
 * What a to-do line becomes as a step: the whole line, so "Call mom"
 * stays "Call mom" rather than the "mom" the detector captures after the
 * verb, minus a "todo:" label or a "remember to" that only says it is one.
 */
export function stepLabelFromLine(raw: string): string {
  let s = raw.trim().replace(TODO_PREFIX_RE, '').replace(REMIND_PREFIX_RE, '').trim()
  if (s) s = s[0].toUpperCase() + s.slice(1)
  return s.slice(0, MAX_LABEL)
}

/**
 * Turns the note's to-do lines ("Call mom", "todo: buy milk") into
 * checkbox lines, so the note shows the same list the task does and each
 * can be ticked in either place. A note that already has checkboxes is
 * returned unchanged — the detector only infers when there are none, and
 * so does this.
 */
export function imperativesToChecklist(body: string): string {
  const found = detectTasks(body)
  if (found.length === 0 || found.some(t => t.via === 'checkbox')) return body
  const lines = body.split('\n')
  for (const t of found) {
    const label = stepLabelFromLine(lines[t.line])
    if (label) lines[t.line] = `- [ ] ${label}`
  }
  return lines.join('\n')
}

/* ── The merge ────────────────────────────────────────────────── */

export interface MergeResult {
  /** The note body after the merge — identical when the note needs nothing. */
  body:  string
  /** The task's steps after the merge, in list order. */
  steps: StepLike[]
  /** What both sides now agree on — the next merge's base. */
  base:  LinkItem[]
  noteChanged:  boolean
  stepsChanged: boolean
}

/** Pairs note lines with base items. Returns noteIdx → baseIdx. */
function matchNoteToBase(note: NoteItem[], base: LinkItem[]): Map<number, number> {
  const out = new Map<number, number>()
  const byKey = new Map<string, number[]>()
  base.forEach((b, i) => {
    const k = normalise(b.label)
    byKey.set(k, [...(byKey.get(k) ?? []), i])
  })
  note.forEach((n, i) => {
    const q = byKey.get(normalise(n.label))
    if (q && q.length) out.set(i, q.shift()!)
  })
  /* Renames: when as many lines lost their match as base items lost
     their line, pair them in order. Anything less certain stays a
     delete-and-add, which loses a step's notes but never mislabels one. */
  const usedBase = new Set(out.values())
  const looseNote = note.map((_, i) => i).filter(i => !out.has(i))
  const looseBase = base.map((_, i) => i).filter(i => !usedBase.has(i))
  if (looseNote.length > 0 && looseNote.length === looseBase.length) {
    looseNote.forEach((n, k) => out.set(n, looseBase[k]))
  }
  return out
}

export interface MergeInput {
  body:  string
  base:  readonly LinkItem[]
  steps: readonly StepLike[]
  /** Id for a step that did not exist; injected so tests are deterministic. */
  newId: () => string
}

export function mergeChecklist({ body, base, steps, newId }: MergeInput): MergeResult {
  const note = noteChecklist(body)
  const baseList = [...base]
  const noteToBase = matchNoteToBase(note, baseList)
  const baseToNote = new Map<number, number>()
  noteToBase.forEach((b, n) => baseToNote.set(b, n))
  const stepById = new Map(steps.map(s => [s.id, s]))
  const baseIds = new Set(baseList.map(b => b.stepId))

  /* What each note line becomes (by note index), and lines to drop. */
  const lineEdits = new Map<number, { label: string; done: boolean }>()
  const dropLines = new Set<number>()
  /* Items the note must gain, in the order they will be appended. */
  const appendToNote: { stepId: string; label: string; done: boolean }[] = []
  /* Final step per note index, and per appended item. */
  const stepForNote = new Map<number, StepLike>()
  const stepsDeleted = new Set<string>()

  baseList.forEach((b, bi) => {
    const ni = baseToNote.get(bi)
    const n = ni != null ? note[ni] : undefined
    const s = stepById.get(b.stepId)

    if (n && s) {
      const noteRenamed = n.label !== b.label
      const taskRenamed = s.label !== b.label
      const label = noteRenamed ? n.label : taskRenamed ? s.label : b.label
      const noteTicked = n.done !== b.done
      const taskTicked = s.done !== b.done
      const done = noteTicked ? n.done : taskTicked ? s.done : b.done
      stepForNote.set(ni!, { ...s, label, done })
      if (label !== n.label || done !== n.done) lineEdits.set(ni!, { label, done })
      return
    }
    if (n && !s) {
      /* Removed from the task. Kept only if the note changed it since. */
      if (n.label !== b.label || n.done !== b.done) {
        stepForNote.set(ni!, { id: b.stepId, label: n.label, done: n.done })
      } else {
        dropLines.add(ni!)
      }
      return
    }
    if (!n && s) {
      /* Removed from the note. Kept only if the task changed it since. */
      if (s.label !== b.label || s.done !== b.done) {
        appendToNote.push({ stepId: s.id, label: s.label, done: s.done })
      } else {
        stepsDeleted.add(s.id)
      }
    }
    /* Gone from both: nothing to do. */
  })

  /* New lines in the note become new steps. */
  note.forEach((n, i) => {
    if (noteToBase.has(i)) return
    stepForNote.set(i, { id: newId(), label: n.label, done: n.done })
  })

  /* New steps in the task become new lines. */
  for (const s of steps) {
    if (!baseIds.has(s.id)) appendToNote.push({ stepId: s.id, label: s.label, done: s.done })
  }

  /* Final order: the note's order, then what the note gained. */
  const ordered: StepLike[] = []
  note.forEach((_, i) => {
    if (dropLines.has(i)) return
    const s = stepForNote.get(i)
    if (s) ordered.push(s)
  })
  for (const a of appendToNote) {
    const existing = stepById.get(a.stepId)
    ordered.push(existing ? { ...existing, label: a.label, done: a.done } : { id: a.stepId, label: a.label, done: a.done })
  }

  /* A task holds at most MAX_LINK_STEPS. Only lines new to the note are
     held back to keep under it — they stay in the note and are offered
     again next sync — never a step the task already has. */
  let finalSteps = ordered
  if (ordered.length > MAX_LINK_STEPS) {
    let over = ordered.length - MAX_LINK_STEPS
    const isNew = (s: StepLike) => !stepById.has(s.id) && !baseIds.has(s.id)
    const cut = new Set<StepLike>()
    for (let i = ordered.length - 1; i >= 0 && over > 0; i--) {
      if (isNew(ordered[i])) { cut.add(ordered[i]); over-- }
    }
    finalSteps = ordered.filter(s => !cut.has(s))
  }
  const keptIds = new Set(finalSteps.map(s => s.id))
  const appended = appendToNote.filter(a => keptIds.has(a.stepId))

  const newBody = rewriteBody(body, note, lineEdits, dropLines, appended)
  const nextBase: LinkItem[] = finalSteps.map(s => ({ stepId: s.id, label: s.label, done: s.done }))

  return {
    body:  newBody,
    steps: finalSteps,
    base:  nextBase,
    noteChanged:  newBody !== body,
    stepsChanged: !sameSteps(steps, finalSteps),
  }
}

function sameSteps(a: readonly StepLike[], b: readonly StepLike[]): boolean {
  return a.length === b.length
    && a.every((s, i) => s.id === b[i].id && s.label === b[i].label && s.done === b[i].done)
}

/** True when two snapshots say the same thing — saves a write when nothing moved. */
export function sameBase(a: readonly LinkItem[] | undefined, b: readonly LinkItem[]): boolean {
  return !!a && a.length === b.length
    && a.every((x, i) => x.stepId === b[i].stepId && x.label === b[i].label && x.done === b[i].done)
}

/* ── Rewriting the body ───────────────────────────────────────── */

function rewriteBody(
  body: string,
  note: NoteItem[],
  edits: Map<number, { label: string; done: boolean }>,
  drops: Set<number>,
  appended: { label: string; done: boolean }[],
): string {
  if (edits.size === 0 && drops.size === 0 && appended.length === 0) return body

  const lines = body.split('\n')
  const dropLine = new Set([...drops].map(i => note[i].line))
  edits.forEach((e, i) => {
    const ln = note[i].line
    const m = CHECK_LINE_RE.exec(lines[ln])
    if (!m) return
    const mark = e.done ? (m[2] === 'X' ? 'X' : 'x') : ' '
    lines[ln] = `${m[1]}[${mark}]${m[3] || ' '}${e.label}${m[5]}`
  })

  const newLines = appended.map(a => `- [${a.done ? 'x' : ' '}] ${a.label}`)
  /* After the last checklist line, so a new step joins the list it
     belongs to; at the end when the note has no checklist left. */
  const anchor = note.length > 0 ? note[note.length - 1].line : -1

  const out: string[] = []
  if (anchor < 0 && newLines.length > 0) {
    const trimmed = [...lines]
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') trimmed.pop()
    return [...trimmed, ...(trimmed.length > 0 ? [''] : []), ...newLines].join('\n')
  }
  lines.forEach((l, i) => {
    if (!dropLine.has(i)) out.push(l)
    if (i === anchor) out.push(...newLines)
  })
  return out.join('\n')
}

/* ── First link ───────────────────────────────────────────────── */

export interface InitialLink {
  /** The note body with its to-do lines written as checkboxes. */
  body:  string
  steps: StepLike[]
  base:  LinkItem[]
}

/**
 * The note's list as a task's steps, for the moment the link is made.
 * Ticked lines arrive ticked: they are part of the list, just finished.
 */
export function initialLink(body: string, newId: () => string): InitialLink {
  const converted = imperativesToChecklist(body)
  const steps = noteChecklist(converted)
    .slice(0, MAX_LINK_STEPS)
    .map(n => ({ id: newId(), label: n.label, done: n.done }))
  return {
    body: converted,
    steps,
    base: steps.map(s => ({ stepId: s.id, label: s.label, done: s.done })),
  }
}
