'use client'

/**
 * lib/contentSearch.ts — searching what you wrote, not just where it lives.
 *
 * The topbar finder matched module *names*: typing "chapter 3" found
 * nothing, because no module is called that. Everything Zenith holds is
 * in one Dexie database, so the thing you are actually looking for — the
 * task, the note, the event — is one pass away.
 *
 * Reads are deliberately plain `toArray()` scans. Dexie can only index
 * whole values, so a substring search over titles and bodies cannot use
 * an index whatever we do; at the scale of one person's notes a scan is
 * a few milliseconds, and pretending otherwise would mean maintaining a
 * second index that can fall out of step with the writing it describes.
 */

import { db } from '@/lib/db'
import type { ViewId, CategoryId } from '@/lib/nav-config'
import { scoreMatch, makeSnippet } from '@/utils/searchRank'
import { kindOf } from '@/utils/taskUnify'

/* ── Result shape ────────────────────────────────────────────── */

export type ResultKind = 'task' | 'note' | 'event' | 'book' | 'link' | 'word'

export const KIND_LABEL: Record<ResultKind, string> = {
  task: 'Task', note: 'Note', event: 'Event',
  book: 'Book', link: 'Link', word: 'Word',
}

export interface ContentResult {
  /** Stable across renders, and unique across tables. */
  key:      string
  kind:     ResultKind
  title:    string
  /** The text around the match, when the match was in a body. */
  snippet:  string
  /** A date, a course, a folder — whatever identifies this one. */
  meta:     string
  view:     ViewId
  category: CategoryId | null
  score:    number
}

/** Nothing shorter than this searches: one letter matches everything,
 *  which is the same as matching nothing but slower. */
export const MIN_QUERY = 2

/** Per-kind cap, so one prolific table cannot crowd out the others. */
export const PER_KIND_LIMIT = 4
export const TOTAL_LIMIT    = 12

/* ── Helpers ─────────────────────────────────────────────────── */

function dateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Keeps the best few of each kind, then the best overall.
 *
 * Without the per-kind cap a single long note collection buries every
 * task and event under it, and the search stops being a way to find
 * things and becomes a way to find notes.
 */
function collate(all: ContentResult[]): ContentResult[] {
  const perKind = new Map<ResultKind, number>()
  return all
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      const n = perKind.get(r.kind) ?? 0
      if (n >= PER_KIND_LIMIT) return false
      perKind.set(r.kind, n + 1)
      return true
    })
    .slice(0, TOTAL_LIMIT)
}

/* ── The search ──────────────────────────────────────────────── */

/**
 * Searches every table worth searching and returns the best matches.
 *
 * A failing table never fails the search: each read is guarded on its
 * own, so a table that does not exist yet on an older install (or one
 * that throws for any other reason) costs its own results and nothing
 * else. A search box that returns nothing because one table is unhappy
 * looks exactly like a search box that found nothing.
 */
export async function searchContent(query: string): Promise<ContentResult[]> {
  if (!db) return []
  const q = query.trim()
  if (q.length < MIN_QUERY) return []

  const out: ContentResult[] = []
  const safe = async (fn: () => Promise<void>) => { try { await fn() } catch { /* see above */ } }

  await Promise.all([

    /* Tasks, reminders and problem sets — one table since db v46. */
    safe(async () => {
      for (const a of await db.assignments.toArray()) {
        const score = scoreMatch(q, a.title, `${a.notes ?? ''} ${a.body ?? ''} ${a.courseId ?? ''}`)
        if (!score) continue
        const kind = kindOf(a)
        out.push({
          key: `task:${a.id}`, kind: 'task', title: a.title,
          snippet: makeSnippet(`${a.notes ?? ''} ${a.body ?? ''}`, q),
          meta: [
            a.status === 'completed' ? 'Done' : null,
            kind === 'problem_set' ? 'Problem set' : kind === 'reminder' ? 'Reminder' : null,
            a.courseId || null,
            a.dueDate || null,
          ].filter(Boolean).join(' · '),
          view: 'calendar', category: 'essentials', score,
        })
      }
    }),

    /* Notes — archived ones included: something you filed away is
       exactly the sort of thing you come back looking for. */
    safe(async () => {
      for (const n of await db.quickNotes.toArray()) {
        const score = scoreMatch(q, n.title, n.body ?? '')
        if (!score) continue
        out.push({
          key: `note:${n.id}`, kind: 'note', title: n.title || 'Untitled note',
          snippet: makeSnippet(n.body ?? '', q),
          meta: [n.archived === 1 ? 'Archived' : null, dateLabel(n.updatedAt)]
            .filter(Boolean).join(' · '),
          view: 'notes', category: 'vault', score,
        })
      }
    }),

    /* Personal events. */
    safe(async () => {
      for (const e of await db.personalEvents.toArray()) {
        const score = scoreMatch(q, e.title, e.description ?? '')
        if (!score) continue
        out.push({
          key: `pevent:${e.id}`, kind: 'event', title: e.title,
          snippet: makeSnippet(e.description ?? '', q),
          meta: dateLabel(e.startMs),
          view: 'calendar', category: 'essentials', score,
        })
      }
    }),

    /* Subscribed and generated calendar events. */
    safe(async () => {
      for (const e of await db.calendarEvents.toArray()) {
        const score = scoreMatch(q, e.title, `${e.description ?? ''} ${e.location ?? ''}`)
        if (!score) continue
        out.push({
          key: `cevent:${e.id}`, kind: 'event', title: e.title,
          snippet: makeSnippet(`${e.location ?? ''} ${e.description ?? ''}`, q),
          meta: dateLabel(e.startMs),
          view: 'calendar', category: 'essentials', score,
        })
      }
    }),

    /* Books. */
    safe(async () => {
      for (const b of await db.library_books.toArray()) {
        const score = scoreMatch(q, b.title, b.author ?? '')
        if (!score) continue
        out.push({
          key: `book:${b.id}`, kind: 'book', title: b.title,
          snippet: '', meta: b.author ?? '',
          view: 'book-tracker', category: 'vault', score,
        })
      }
    }),

    /* Saved links. */
    safe(async () => {
      for (const l of await db.customBookmarks.toArray()) {
        const score = scoreMatch(q, l.label, `${l.description ?? ''} ${l.url}`)
        if (!score) continue
        out.push({
          key: `link:${l.id}`, kind: 'link', title: l.label,
          snippet: makeSnippet(l.description ?? '', q),
          meta: l.folderName ?? '',
          view: 'custom-links', category: 'vault', score,
        })
      }
    }),

    /* Vocabulary. */
    safe(async () => {
      for (const c of await db.vocab_cards.toArray()) {
        const score = scoreMatch(q, c.foreignWord, c.nativeTranslation ?? '')
        if (!score) continue
        out.push({
          key: `word:${c.id}`, kind: 'word', title: c.foreignWord,
          snippet: makeSnippet(c.nativeTranslation ?? '', q),
          meta: c.nativeTranslation ?? '',
          view: 'vocab-builder', category: 'essentials', score,
        })
      }
    }),
  ])

  return collate(out)
}
