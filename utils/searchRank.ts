/**
 * utils/searchRank.ts — how a query matches a piece of writing.
 *
 * Pure: no React, no Dexie, no knowledge of what a "task" or a "note" is.
 * That separation is what lets the ranking be tested against strings
 * rather than against a database, and it is where the judgement calls
 * live — which of two matches a person meant.
 */

/* ── Scores ──────────────────────────────────────────────────────
   The gaps between these are deliberate and large. Ranking is only
   useful if a better kind of match always outranks a worse one, no
   matter how many weak matches pile up underneath. */

export const SCORE_TITLE_EXACT  = 1000
export const SCORE_TITLE_PREFIX = 600
export const SCORE_TITLE_WORD   = 400
export const SCORE_TITLE_SUB    = 250
export const SCORE_BODY_WORD    = 120
export const SCORE_BODY_SUB     = 60
export const SCORE_ALL_TERMS    = 200   // bonus when every term appears

/** Longest snippet returned, and how much context sits around the hit. */
export const SNIPPET_WIDTH = 90

export function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Splits a query into terms. Quoted phrases are not supported —
 *  a search box in a topbar is not a query language. */
export function terms(query: string): string[] {
  return normalise(query).split(' ').filter(Boolean)
}

/**
 * True when `hay` contains `needle` at the start of a word.
 *
 * Substring matching alone is too generous: searching "act" would rank
 * "abstract" alongside "action". Word-start matching is what makes a
 * short query behave the way people expect it to.
 */
export function hasWordStart(hay: string, needle: string): boolean {
  if (!needle) return false
  let from = 0
  for (;;) {
    const i = hay.indexOf(needle, from)
    if (i === -1) return false
    if (i === 0 || !/[a-z0-9]/i.test(hay[i - 1])) return true
    from = i + 1
  }
}

/**
 * How well one record matches a query. Zero means no match at all, and
 * callers should drop it rather than show it far down a list.
 *
 * A record matching every term outranks one matching more terms *more
 * strongly* but missing one — searching "chapter 3" should prefer the
 * thing about chapter 3 over the thing that says "chapter" four times.
 */
export function scoreMatch(query: string, title: string, body = ''): number {
  const q  = normalise(query)
  if (!q) return 0
  const t  = normalise(title)
  const b  = normalise(body)
  const ts = terms(q)
  if (ts.length === 0) return 0

  let score = 0

  if (t === q)                 score += SCORE_TITLE_EXACT
  else if (t.startsWith(q))    score += SCORE_TITLE_PREFIX

  let inTitle = 0, inBody = 0
  for (const term of ts) {
    if (hasWordStart(t, term))      { score += SCORE_TITLE_WORD; inTitle++ }
    else if (t.includes(term))      { score += SCORE_TITLE_SUB;  inTitle++ }
    else if (hasWordStart(b, term)) { score += SCORE_BODY_WORD;  inBody++ }
    else if (b.includes(term))      { score += SCORE_BODY_SUB;   inBody++ }
  }

  if (score === 0) return 0
  if (inTitle + inBody === ts.length) score += SCORE_ALL_TERMS
  return score
}

/**
 * A window of `text` around the first matching term, so a result shows
 * *why* it matched rather than just its opening words.
 *
 * Returns an empty string when nothing matches — a snippet that does not
 * contain the query is worse than none, because it reads like the match
 * was somewhere the reader cannot see.
 */
export function makeSnippet(text: string, query: string, width = SNIPPET_WIDTH): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const lower = flat.toLowerCase()

  let at = -1
  for (const term of terms(query)) {
    const i = lower.indexOf(term)
    if (i !== -1 && (at === -1 || i < at)) at = i
  }
  if (at === -1) return ''

  const start = Math.max(0, at - Math.floor(width / 3))
  const end   = Math.min(flat.length, start + width)
  return (start > 0 ? '…' : '') + flat.slice(start, end).trim() + (end < flat.length ? '…' : '')
}
