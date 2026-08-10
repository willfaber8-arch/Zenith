/**
 * lib/notePolicy.ts — consent for turning note to-dos into tasks.
 *
 * The ladder the user asked for:
 *
 *   Approve                     → create, ask again next time
 *   Deny                        → don't create, don't ask about THIS note
 *   Approve and don't ask again → create, don't ask about THIS note
 *   Always approve              → create, and stop asking EVERYWHERE
 *
 * Two scopes, because "don't ask again" and "always approve" are different
 * promises: one is about a single note, the other is a standing decision.
 */

'use client'

export type NotePolicy   = 'ask' | 'never' | 'auto'
export type GlobalPolicy = 'ask' | 'always' | 'never'

const GLOBAL_KEY = 'zenith_note_task_policy_v1'

/** Fired on change so open views re-read without a reload. */
export const POLICY_EVENT = 'zenith:note-policy-change'

export function getGlobalPolicy(): GlobalPolicy {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY)
    return raw === 'always' || raw === 'never' ? raw : 'ask'
  } catch { return 'ask' }
}

export function setGlobalPolicy(p: GlobalPolicy): void {
  try {
    localStorage.setItem(GLOBAL_KEY, p)
    window.dispatchEvent(new CustomEvent(POLICY_EVENT))
  } catch { /* private mode */ }
}

/* ── Resolution ────────────────────────────────────────────────────── */

export type PolicyOutcome =
  /** Show the strip and wait for a decision. */
  | 'prompt'
  /** Create silently — the user opted into that globally. */
  | 'auto'
  /** Say nothing. */
  | 'silent'

/**
 * Combine the global and per-note settings.
 *
 * The rule is that the more restrictive setting wins, with one deliberate
 * exception: a global `always` overrides a per-note `ask`, because that
 * is exactly what the user asked for when they chose it. A per-note
 * `never` still wins over a global `always` — turning something off for
 * one note has to mean something, or the control is a lie.
 */
export function resolvePolicy(
  notePolicy: NotePolicy | undefined,
  global: GlobalPolicy = getGlobalPolicy(),
): PolicyOutcome {
  if (notePolicy === 'never') return 'silent'
  if (global === 'never')     return 'silent'
  if (notePolicy === 'auto')  return 'auto'
  if (global === 'always')    return 'auto'
  return 'prompt'
}

/** Human label for the current global setting, for Settings. */
export function describeGlobalPolicy(p: GlobalPolicy = getGlobalPolicy()): string {
  switch (p) {
    case 'always': return 'To-dos found in notes are added automatically.'
    case 'never':  return 'Zenith never offers to add to-dos from notes.'
    default:       return 'Zenith asks before adding to-dos found in notes.'
  }
}
