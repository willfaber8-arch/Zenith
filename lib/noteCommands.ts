/**
 * lib/noteCommands.ts — what the note editor can do, in one table.
 *
 * The toolbar buttons, the keyboard shortcuts and the shortcut help list
 * are all generated from `NOTE_COMMANDS`. They were three separate lists
 * in the obvious first draft, which is three chances for a button and its
 * shortcut to disagree about what they do — and no way to notice.
 */

import type { InlineMark, LineMark } from '@/lib/engines/markdownEditing'

export type NoteCommand =
  | { kind: 'inline';  mark: InlineMark }
  | { kind: 'line';    mark: LineMark }
  | { kind: 'link' }
  | { kind: 'divider' }

/**
 * A chord, held against the platform's modifier (⌘ on Apple, Ctrl elsewhere).
 *
 * Digits and punctuation are matched on `code` rather than `key`: with
 * Shift held, `key` for the 9 key is "(" on a US layout and something
 * else again on others, so `key` would silently stop matching for anyone
 * not on the layout it was written on.
 */
export interface Chord {
  key?:   string    // letter keys — matched case-insensitively on e.key
  code?:  string    // physical keys — matched on e.code
  shift?: boolean
}

export interface CommandSpec {
  id:       string
  /** Spoken name. Also the accessible name of the button. */
  label:    string
  /** What the button shows. Text for letterforms, `icon` for the rest. */
  glyph?:   string
  icon?:    'bullet' | 'number' | 'checklist' | 'quote' | 'link' | 'rule'
  command:  NoteCommand
  chord?:   Chord
  /** Rendered form of the chord, e.g. "⌘⇧9". Filled by `chordLabel`. */
  group:    number
  /** Emphasised in the toolbar — see the checklist note below. */
  primary?: boolean
}

export const NOTE_COMMANDS: readonly CommandSpec[] = [
  { id: 'bold',   label: 'Bold',          glyph: 'B',  group: 0,
    command: { kind: 'inline', mark: 'bold' },   chord: { key: 'b' } },
  { id: 'italic', label: 'Italic',        glyph: 'I',  group: 0,
    command: { kind: 'inline', mark: 'italic' }, chord: { key: 'i' } },
  { id: 'strike', label: 'Strikethrough', glyph: 'S',  group: 0,
    command: { kind: 'inline', mark: 'strike' }, chord: { key: 'x', shift: true } },
  { id: 'code',   label: 'Code',          glyph: '‹›', group: 0,
    command: { kind: 'inline', mark: 'code' },   chord: { key: 'e' } },

  { id: 'h1', label: 'Heading 1', glyph: 'H1', group: 1,
    command: { kind: 'line', mark: 'h1' }, chord: { code: 'Digit1', shift: true } },
  { id: 'h2', label: 'Heading 2', glyph: 'H2', group: 1,
    command: { kind: 'line', mark: 'h2' }, chord: { code: 'Digit2', shift: true } },

  /*
   * The checklist button is the one the module is actually for.
   *
   * Notes has always supported `- [ ] `, and the placeholder text said so,
   * which is a documentation fix for a discoverability problem: you have
   * to already know Markdown to find the feature. So this one carries a
   * word as well as a mark, and is the only emphasised control here.
   */
  { id: 'checklist', label: 'Checklist', icon: 'checklist', group: 2, primary: true,
    command: { kind: 'line', mark: 'checklist' }, chord: { code: 'Digit9', shift: true } },
  { id: 'bullet', label: 'Bullet list', icon: 'bullet', group: 2,
    command: { kind: 'line', mark: 'bullet' }, chord: { code: 'Digit8', shift: true } },
  { id: 'number', label: 'Numbered list', icon: 'number', group: 2,
    command: { kind: 'line', mark: 'number' }, chord: { code: 'Digit7', shift: true } },

  { id: 'quote', label: 'Quote', icon: 'quote', group: 3,
    command: { kind: 'line', mark: 'quote' }, chord: { code: 'Period', shift: true } },
  { id: 'link', label: 'Link', icon: 'link', group: 3,
    command: { kind: 'link' }, chord: { key: 'k' } },
  { id: 'rule', label: 'Divider', icon: 'rule', group: 3,
    command: { kind: 'divider' } },
]

/** True on Apple platforms, where the modifier is ⌘ rather than Ctrl. */
export function isApple(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

/** "⌘⇧9" / "Ctrl+Shift+9" — for tooltips and the shortcut list. */
export function chordLabel(chord: Chord | undefined, apple: boolean): string {
  if (!chord) return ''
  const mod   = apple ? '⌘' : 'Ctrl+'
  const shift = chord.shift ? (apple ? '⇧' : 'Shift+') : ''
  const key   = chord.key
    ? chord.key.toUpperCase()
    : (chord.code ?? '').replace('Digit', '').replace('Period', '.')
  return `${mod}${shift}${key}`
}

/** Find the command a keydown maps to, or null. */
export function matchChord(e: {
  key: string; code: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean
}): CommandSpec | null {
  if (!(e.metaKey || e.ctrlKey)) return null
  for (const spec of NOTE_COMMANDS) {
    const c = spec.chord
    if (!c) continue
    if (!!c.shift !== e.shiftKey) continue
    if (c.key  && e.key.toLowerCase() === c.key) return spec
    if (c.code && e.code === c.code) return spec
  }
  return null
}
