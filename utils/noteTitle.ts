/**
 * utils/noteTitle.ts — the title a note gets when nobody wrote one.
 *
 * Shared by the Notes editor and the checklist↔task sync, which both
 * write a note's body and must name it the same way when they do.
 */

import { parseLine } from '@/lib/engines/markdownEditing'

/**
 * First non-empty line, used when the user never writes a title.
 *
 * Uses the line parser rather than stripping a character class, which
 * left the checkbox behind and titled a shopping list "[ ] buy milk".
 * Barely noticeable while checklists needed hand-typed Markdown; not
 * once there is a button for them.
 */
export function deriveTitle(body: string): string {
  const first = body
    .split('\n')
    .map(l => parseLine(l).content.trim())
    .find(Boolean)
  return (first ?? '').slice(0, 80) || 'Untitled note'
}
