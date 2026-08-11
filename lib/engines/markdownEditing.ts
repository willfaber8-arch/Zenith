/**
 * lib/engines/markdownEditing.ts — text transforms for the note editor.
 *
 * Pure, and deliberately so. Everything here is (text, selection) in,
 * (text, selection) out, with no DOM and no React, because the awkward
 * parts of a formatting toolbar are all edge cases — toggling a mark off
 * again, applying one across a multi-line selection, renumbering a list
 * after an insert — and those are miserable to pin down through a
 * component and trivial to pin down in a unit test.
 *
 * The note body stays plain Markdown. It is what the checklist detector
 * already reads, what the Co-Pilot already receives, and what survives
 * being exported to literally anything else. A rich-text model would buy
 * nothing here and would cost all three.
 */

/** A textarea's contents and cursor, which is all a transform needs. */
export interface EditState {
  text:     string
  selStart: number
  selEnd:   number
}

/** Marks that wrap a span of characters. */
export type InlineMark = 'bold' | 'italic' | 'strike' | 'code'

/** Marks that own a whole line. */
export type LineMark =
  | 'h1' | 'h2' | 'h3'
  | 'bullet' | 'number' | 'checklist' | 'quote'

const INLINE_TOKEN: Record<InlineMark, string> = {
  bold:   '**',
  italic: '*',
  strike: '~~',
  code:   '`',
}

/* ── Line model ────────────────────────────────────────────────────────
 *
 * Rather than doing regex surgery for each of the seven line marks (and
 * every conversion between them), a line is parsed into a shape once,
 * the shape is changed, and the line is rendered back. Converting a
 * bullet to a checklist, or a checklist back to plain text, then costs
 * one field assignment instead of a bespoke pattern per pair.
 */

export type LineKind =
  | 'plain' | 'bullet' | 'number' | 'checklist' | 'quote' | 'heading'

export interface LineShape {
  indent:   string
  kind:     LineKind
  /** Heading depth, 1–6. Only meaningful when kind is `heading`. */
  level?:   number
  /** Ordered-list number. Preserved across a conversion to `checklist`. */
  num?:     number
  /** Which bullet character the user typed, so we hand it back unchanged. */
  bullet?:  string
  checked?: boolean
  content:  string
}

/* Checklist is tested before bullet/number: `- [ ] x` matches both, and
   the checkbox is the more specific reading. */
const RE_CHECKLIST = /^(\s*)(?:([-*+])|(\d+)[.)])\s+\[([ xX])\]\s?(.*)$/
const RE_BULLET    = /^(\s*)([-*+])\s+(.*)$/
const RE_NUMBER    = /^(\s*)(\d+)[.)]\s+(.*)$/
const RE_QUOTE     = /^(\s*)>\s?(.*)$/
const RE_HEADING   = /^(\s*)(#{1,6})\s+(.*)$/

export function parseLine(line: string): LineShape {
  let m: RegExpExecArray | null

  if ((m = RE_CHECKLIST.exec(line))) {
    return {
      indent: m[1], kind: 'checklist',
      bullet: m[2] ?? undefined,
      num:    m[3] ? Number(m[3]) : undefined,
      checked: m[4].toLowerCase() === 'x',
      content: m[5],
    }
  }
  if ((m = RE_BULLET.exec(line)))
    return { indent: m[1], kind: 'bullet', bullet: m[2], content: m[3] }
  if ((m = RE_NUMBER.exec(line)))
    return { indent: m[1], kind: 'number', num: Number(m[2]), content: m[3] }
  if ((m = RE_QUOTE.exec(line)))
    return { indent: m[1], kind: 'quote', content: m[2] }
  if ((m = RE_HEADING.exec(line)))
    return { indent: m[1], kind: 'heading', level: m[2].length, content: m[3] }

  const lead = /^(\s*)(.*)$/.exec(line)!
  return { indent: lead[1], kind: 'plain', content: lead[2] }
}

export function renderLine(s: LineShape): string {
  switch (s.kind) {
    case 'bullet':
      return `${s.indent}${s.bullet ?? '-'} ${s.content}`
    case 'number':
      return `${s.indent}${s.num ?? 1}. ${s.content}`
    case 'checklist': {
      // An ordered checklist keeps its number; everything else gets a dash.
      const marker = s.num != null ? `${s.num}.` : (s.bullet ?? '-')
      return `${s.indent}${marker} [${s.checked ? 'x' : ' '}] ${s.content}`
    }
    case 'quote':
      return `${s.indent}> ${s.content}`
    case 'heading':
      return `${s.indent}${'#'.repeat(s.level ?? 1)} ${s.content}`
    default:
      return `${s.indent}${s.content}`
  }
}

/** The line kind a toolbar button maps to. */
function targetKind(mark: LineMark): LineKind {
  if (mark === 'h1' || mark === 'h2' || mark === 'h3') return 'heading'
  return mark as LineKind
}

function targetLevel(mark: LineMark): number | undefined {
  return mark === 'h1' ? 1 : mark === 'h2' ? 2 : mark === 'h3' ? 3 : undefined
}

/** True when this line already carries exactly this mark. */
export function lineHasMark(line: string, mark: LineMark): boolean {
  const s = parseLine(line)
  const kind = targetKind(mark)
  if (s.kind !== kind) return false
  return kind !== 'heading' || s.level === targetLevel(mark)
}

/* ── Line-mark toggling ────────────────────────────────────────────── */

/** Index range of the lines any part of the selection touches. */
function touchedLines(text: string, selStart: number, selEnd: number) {
  const lines = text.split('\n')
  let pos = 0
  let first = 0
  let last  = 0
  for (let i = 0; i < lines.length; i++) {
    const start = pos
    const end   = pos + lines[i].length      // excludes the '\n'
    if (start <= selStart && selStart <= end) first = i
    if (start <= selEnd   && selEnd   <= end) last  = i
    pos = end + 1
  }
  if (last < first) last = first
  return { lines, first, last }
}

/**
 * Apply or remove a line mark across every line the selection touches.
 *
 * Toggling is all-or-nothing on purpose: the mark is removed only when
 * every touched line already has it. Selecting a half-marked block and
 * pressing the button therefore finishes the job rather than inverting
 * each line, which is what people actually expect from a toolbar.
 */
export function toggleLineMark(state: EditState, mark: LineMark): EditState {
  const { lines, first, last } = touchedLines(state.text, state.selStart, state.selEnd)
  const kind  = targetKind(mark)
  const level = targetLevel(mark)

  const slice = lines.slice(first, last + 1)
  const allHave = slice.every(l => lineHasMark(l, mark))

  // Ordered lists restart their count at the top of the affected block.
  let n = 1
  for (let i = first; i <= last; i++) {
    const s = parseLine(lines[i])

    if (allHave) {
      lines[i] = renderLine({ indent: s.indent, kind: 'plain', content: s.content })
      continue
    }

    if (kind === 'heading') {
      lines[i] = renderLine({ ...s, kind: 'heading', level, checked: undefined })
    } else if (kind === 'number') {
      lines[i] = renderLine({ indent: s.indent, kind: 'number', num: n++, content: s.content })
    } else if (kind === 'checklist') {
      lines[i] = renderLine({
        indent: s.indent, kind: 'checklist',
        // Preserve an existing tick so marking a done item as a checklist
        // again does not silently un-complete it.
        checked: s.kind === 'checklist' ? s.checked : false,
        bullet:  s.bullet, num: s.num,
        content: s.content,
      })
    } else {
      lines[i] = renderLine({
        indent: s.indent, kind, bullet: s.bullet, content: s.content,
      })
    }
  }

  const text = lines.join('\n')

  /* Keep the selection over the same logical text. Line marks change the
     prefix length, so character offsets have to be recomputed from the
     line boundaries rather than nudged by a delta. */
  const startOfFirst = lines.slice(0, first).reduce((a, l) => a + l.length + 1, 0)
  const endOfLast    = lines.slice(0, last + 1).reduce((a, l) => a + l.length + 1, 0) - 1

  return state.selStart === state.selEnd
    ? { text, selStart: endOfLast, selEnd: endOfLast }
    : { text, selStart: startOfFirst, selEnd: endOfLast }
}

/* ── Inline marks ──────────────────────────────────────────────────── */

/** True when the selection is already wrapped in this mark's token. */
export function hasInlineMark(state: EditState, mark: InlineMark): boolean {
  const tok = INLINE_TOKEN[mark]
  const { text, selStart, selEnd } = state

  // Wrapped inside the selection: **foo**
  const inner = text.slice(selStart, selEnd)
  if (inner.length >= tok.length * 2
      && inner.startsWith(tok) && inner.endsWith(tok)) return true

  // Wrapped just outside it: **[foo]**
  return text.slice(selStart - tok.length, selStart) === tok
      && text.slice(selEnd, selEnd + tok.length) === tok
}

/**
 * Wrap or unwrap the selection.
 *
 * With no selection this inserts the pair and parks the caret between
 * them, so pressing bold and typing does what it does in every other
 * editor.
 *
 * Trailing whitespace is pushed outside the markers: `**foo **` is not
 * bold in any Markdown parser, and selecting a word by double-click
 * frequently includes the space after it.
 */
export function toggleInline(state: EditState, mark: InlineMark): EditState {
  const tok = INLINE_TOKEN[mark]
  const { text } = state
  let { selStart, selEnd } = state

  if (hasInlineMark(state, mark)) {
    const inner = text.slice(selStart, selEnd)
    if (inner.startsWith(tok) && inner.endsWith(tok) && inner.length >= tok.length * 2) {
      const stripped = inner.slice(tok.length, inner.length - tok.length)
      return {
        text: text.slice(0, selStart) + stripped + text.slice(selEnd),
        selStart,
        selEnd: selStart + stripped.length,
      }
    }
    // Markers sit outside the selection — remove them from around it.
    return {
      text: text.slice(0, selStart - tok.length)
          + text.slice(selStart, selEnd)
          + text.slice(selEnd + tok.length),
      selStart: selStart - tok.length,
      selEnd:   selEnd   - tok.length,
    }
  }

  if (selStart === selEnd) {
    const at = selStart + tok.length
    return {
      text: text.slice(0, selStart) + tok + tok + text.slice(selEnd),
      selStart: at, selEnd: at,
    }
  }

  // Shrink the selection off any whitespace at its edges.
  while (selStart < selEnd && /\s/.test(text[selStart]))   selStart++
  while (selEnd > selStart && /\s/.test(text[selEnd - 1])) selEnd--
  if (selStart === selEnd) return state   // whitespace only — nothing to mark

  const inner = text.slice(selStart, selEnd)
  return {
    text: text.slice(0, selStart) + tok + inner + tok + text.slice(selEnd),
    selStart: selStart + tok.length,
    selEnd:   selEnd   + tok.length,
  }
}

/* ── Insertions ────────────────────────────────────────────────────── */

const URL_RE = /^(https?:\/\/|www\.|mailto:)\S+$/i

/**
 * Insert a Markdown link, selecting whichever half still needs typing.
 *
 * A selection that already looks like a URL becomes the target and the
 * caret lands on the label; anything else becomes the label and the
 * caret lands on the target.
 */
export function insertLink(state: EditState): EditState {
  const { text, selStart, selEnd } = state
  const sel = text.slice(selStart, selEnd)

  if (sel && URL_RE.test(sel.trim())) {
    const out = `[](${sel.trim()})`
    return {
      text: text.slice(0, selStart) + out + text.slice(selEnd),
      selStart: selStart + 1, selEnd: selStart + 1,
    }
  }

  const label = sel || 'text'
  const out   = `[${label}](url)`
  const urlAt = selStart + label.length + 3
  return {
    text: text.slice(0, selStart) + out + text.slice(selEnd),
    selStart: sel ? urlAt : selStart + 1,
    selEnd:   sel ? urlAt + 3 : selStart + 1 + label.length,
  }
}

/** Drop a block in on its own lines, with the caret after it. */
export function insertBlock(state: EditState, block: string): EditState {
  const { text, selStart, selEnd } = state
  const before = text.slice(0, selStart)
  const after  = text.slice(selEnd)
  const lead   = before === '' || before.endsWith('\n') ? '' : '\n'
  const tail   = after.startsWith('\n') || after === '' ? '\n' : '\n\n'
  const out    = `${lead}${block}${tail}`
  const at     = selStart + out.length
  return { text: before + out + after, selStart: at, selEnd: at }
}

/* ── Enter continuation ────────────────────────────────────────────── */

/**
 * What Enter should do inside a list.
 *
 * Returns null when Enter should just be Enter, so the caller can leave
 * the browser's own newline handling (and its undo stack) alone in the
 * common case.
 *
 * Two behaviours:
 *   · on a list item with content → open the next item, carrying the
 *     marker over and resetting any checkbox
 *   · on an empty list item → strip the marker instead, which is how you
 *     get out of a list without reaching for the mouse
 */
export function continueList(state: EditState): EditState | null {
  if (state.selStart !== state.selEnd) return null

  const { text, selStart } = state
  const lineStart = text.lastIndexOf('\n', selStart - 1) + 1
  const lineEndIdx = text.indexOf('\n', selStart)
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx
  const line = text.slice(lineStart, lineEnd)

  const s = parseLine(line)
  if (s.kind === 'plain' || s.kind === 'heading') return null

  // Only act from the end of the line; splitting an item mid-word should
  // behave normally rather than duplicating half of it behind a marker.
  if (selStart !== lineEnd) return null

  if (s.content.trim() === '') {
    // Empty item — leave the list.
    const cleared = `${s.indent}`
    return {
      text: text.slice(0, lineStart) + cleared + text.slice(lineEnd),
      selStart: lineStart + cleared.length,
      selEnd:   lineStart + cleared.length,
    }
  }

  const next = renderLine({
    ...s,
    num:     s.num != null ? s.num + 1 : undefined,
    checked: s.kind === 'checklist' ? false : undefined,
    content: '',
  })
  // renderLine leaves a trailing space after the marker, which is exactly
  // where the caret wants to be.
  const insert = `\n${next}`
  const at = selStart + insert.length
  return {
    text: text.slice(0, selStart) + insert + text.slice(selStart),
    selStart: at, selEnd: at,
  }
}

/* ── Readout ───────────────────────────────────────────────────────── */

export interface NoteStats { words: number; chars: number; lines: number }

export function noteStats(text: string): NoteStats {
  const trimmed = text.trim()
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    chars: text.length,
    lines: text === '' ? 0 : text.split('\n').length,
  }
}
