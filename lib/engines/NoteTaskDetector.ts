/**
 * lib/engines/NoteTaskDetector.ts — find to-dos inside a note.
 *
 * Pure and deterministic. No AI call, on purpose:
 *
 *   · it runs on every save, so it has to be instant and free
 *   · it must work with no API key configured
 *   · a regex that misfires is debuggable in a way a model is not
 *
 * The Co-Pilot can still be asked to extract tasks from a note as an
 * explicit action. That is a different thing from ambient detection and
 * should not be confused with it.
 */

export interface DetectedTask {
  /** The task text, cleaned of its marker. */
  text: string
  /** Zero-based line index in the note body — used to dedupe and to
   *  write a checkbox back once the task exists. */
  line: number
  /** How it was recognised. `checkbox` is explicit intent; `imperative`
   *  is inference and is held to a higher bar. */
  via: 'checkbox' | 'imperative'
  /** Already ticked — detected but not offered. */
  done: boolean
}

/* ── Patterns ──────────────────────────────────────────────────────── */

/** `- [ ] thing`, `* [x] thing`, `1. [ ] thing` */
const CHECKBOX_RE = /^\s*(?:[-*+]|\d+[.)])\s*\[([ xX])\]\s*(.+?)\s*$/

/**
 * Imperative openers. Deliberately a short, boring list.
 *
 * The failure mode that matters is a false positive: offering to create
 * "Remember that time in Prague" as a task is the kind of thing that
 * makes someone turn the feature off. So this only fires on verbs that
 * are almost always instructions to self, and only at the start of a
 * line.
 */
const IMPERATIVE_RE = new RegExp(
  '^\\s*(?:' +
  'todo|to-do|task' +
  '|call|email|text|message|ask|reply|respond|follow up' +
  '|buy|order|book|schedule|cancel|renew|pay|submit|send' +
  '|finish|start|review|read|write|draft|print|fix|check' +
  '|remember to|need to|make sure to|don\'t forget to' +
  ')\\b[:\\s]+(.+?)\\s*$',
  'i',
)

/** Lines that look like structure, not intent. */
const HEADING_RE = /^\s*#{1,6}\s/
const QUOTE_RE   = /^\s*>/
const FENCE_RE   = /^\s*```/

/**
 * Below this an *inferred* task is almost certainly a fragment.
 *
 * Applied only to imperative inference. An explicit checkbox is trusted
 * at any length: if someone typed `- [ ] a`, they meant a task, and
 * second-guessing them is exactly the behaviour this module avoids
 * everywhere else.
 */
const MIN_INFERRED_CHARS = 3
/** Above this, it is prose that happens to start with a verb. */
const MAX_TASK_CHARS = 200

/* ── Detection ─────────────────────────────────────────────────────── */

/**
 * Extract candidate tasks from a note body.
 *
 * Checkbox lines are taken at face value — the user typed a checkbox, so
 * they meant a task. Imperative lines are only considered when the note
 * contains no checkboxes at all: once someone is using checkbox syntax,
 * inferring extra tasks from their prose is second-guessing them.
 */
export function detectTasks(body: string): DetectedTask[] {
  if (!body?.trim()) return []

  const lines = body.split('\n')
  const found: DetectedTask[] = []
  let inFence = false

  // Pass 1 — explicit checkboxes.
  lines.forEach((raw, i) => {
    if (FENCE_RE.test(raw)) { inFence = !inFence; return }
    if (inFence) return

    const m = CHECKBOX_RE.exec(raw)
    if (!m) return
    const text = m[2].trim()
    // Explicit intent — only reject an empty or punctuation-only box.
    if (!hasContent(text)) return

    found.push({
      text,
      line: i,
      via:  'checkbox',
      done: m[1].toLowerCase() === 'x',
    })
  })

  if (found.length > 0) return found

  // Pass 2 — imperatives, only when the note used no checkboxes.
  inFence = false
  lines.forEach((raw, i) => {
    if (FENCE_RE.test(raw)) { inFence = !inFence; return }
    if (inFence || HEADING_RE.test(raw) || QUOTE_RE.test(raw)) return

    const m = IMPERATIVE_RE.exec(raw)
    if (!m) return
    const text = m[1].trim()
    if (!isPlausibleInferred(text)) return

    found.push({ text, line: i, via: 'imperative', done: false })
  })

  return found
}

/** Tasks worth offering: outstanding, and not already created. */
export function pendingTasks(
  body: string,
  alreadyCreated: readonly string[] = [],
): DetectedTask[] {
  const seen = new Set(alreadyCreated.map(normalise))
  return detectTasks(body).filter(t => !t.done && !seen.has(normalise(t.text)))
}

/**
 * Tick a task's checkbox in the body.
 *
 * Rewrites by line index rather than by text match: two identical lines
 * in one note would otherwise both flip when one is completed.
 */
export function markLineDone(body: string, line: number): string {
  const lines = body.split('\n')
  if (line < 0 || line >= lines.length) return body

  const m = CHECKBOX_RE.exec(lines[line])
  if (!m) return body

  lines[line] = lines[line].replace(/\[[ xX]\]/, '[x]')
  return lines.join('\n')
}

/** Toggle a checkbox either way — what the UI calls on a tap. */
export function toggleLine(body: string, line: number): string {
  const lines = body.split('\n')
  if (line < 0 || line >= lines.length) return body

  const m = CHECKBOX_RE.exec(lines[line])
  if (!m) return body

  const nowDone = m[1].toLowerCase() !== 'x'
  lines[line] = lines[line].replace(/\[[ xX]\]/, nowDone ? '[x]' : '[ ]')
  return lines.join('\n')
}

/** Checklist progress, for the list row and the dashboard widget. */
export function checklistProgress(body: string): { done: number; total: number } {
  const all = detectTasks(body).filter(t => t.via === 'checkbox')
  return { done: all.filter(t => t.done).length, total: all.length }
}

/* ── Utils ─────────────────────────────────────────────────────────── */

/** Has anything a person could act on — rejects "" and "...". */
function hasContent(text: string): boolean {
  return text.length > 0
    && text.length <= MAX_TASK_CHARS
    && /[a-z0-9]/i.test(text)
}

/** Stricter bar for inference, where a false positive costs trust. */
function isPlausibleInferred(text: string): boolean {
  return hasContent(text) && text.length >= MIN_INFERRED_CHARS
}

/** Loose identity so "Call mum." and "call mum" are the same task. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
