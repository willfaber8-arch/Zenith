/**
 * components/BookRecommendationFeed.tsx — "Because you read…" for the TBR shelf.
 *
 * Reads the taste signal already sitting in the library — which books the
 * user finished and how they rated them — and asks the model for titles in
 * the same vein. Recommendations are NOT written anywhere until the reader
 * presses Add, so a bad suggestion costs nothing.
 *
 * Design notes:
 *   · Ratings are the whole point. A shelf of finished books says what you
 *     read; the 5-stars say what you'd want more of, and the 1-2 stars say
 *     what to steer away from. Both halves are sent.
 *   · Books already in the library (in ANY status) are filtered out of the
 *     results locally rather than trusted to the prompt — the model does
 *     not reliably honour an exclusion list, and recommending a book that
 *     is already on the shelf below is the fastest way to look broken.
 *   · Each suggestion carries an ISBN when the model is confident, which
 *     feeds straight into the existing cover pipeline on Add.
 */

'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { db } from '@/lib/db'
import type { LibraryBook } from '@/types/bookTracker'
import { useToast } from '@/lib/ToastContext'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import styles from './BookRecommendationFeed.module.css'

/* ── Shape the model is asked to return ───────────────────────── */

export interface BookSuggestion {
  title:   string
  author:  string
  why:     string           // one sentence, tied to a book they rated
  genre?:  string
  isbn13?: string
}

/** How many finished books to describe in the prompt. */
const TASTE_SAMPLE = 18
/** How many suggestions to ask for. Over-asks so local filtering has slack. */
const ASK_FOR = 8
/** How many to actually show. */
const SHOW = 6

/* ── Prompt ───────────────────────────────────────────────────── */

function buildPrompt(books: LibraryBook[]): string {
  const rated = books
    .filter(b => b.userRating > 0)
    .sort((a, b) => b.userRating - a.userRating)

  const loved   = rated.filter(b => b.userRating >= 4).slice(0, TASTE_SAMPLE)
  const disliked = rated.filter(b => b.userRating <= 2).slice(0, 6)
  // Unrated finished books still say something about range, just not about
  // preference — worth including, clearly separated, when ratings are thin.
  const unratedRead = books
    .filter(b => b.userRating === 0)
    .slice(0, Math.max(0, TASTE_SAMPLE - loved.length))

  const fmt = (b: LibraryBook) =>
    `- "${b.title}" by ${b.author || 'unknown'}`
    + (b.genre ? ` [${b.genre}]` : '')
    + (b.userRating > 0 ? ` — rated ${b.userRating}/5` : '')

  const parts: string[] = []
  if (loved.length)       parts.push(`Books they rated highly:\n${loved.map(fmt).join('\n')}`)
  if (unratedRead.length) parts.push(`Also finished (unrated):\n${unratedRead.map(fmt).join('\n')}`)
  if (disliked.length)    parts.push(`Books they rated poorly — avoid this sort of thing:\n${disliked.map(fmt).join('\n')}`)

  return [
    `Recommend exactly ${ASK_FOR} books for this reader, based on their history below.`,
    '',
    ...parts,
    '',
    'Rules:',
    '- Do NOT recommend any book already listed above, or another edition of one.',
    '- Prefer books that connect to something they rated 4 or 5. Range is good, but every pick should be justifiable from the list.',
    '- "why" must be ONE sentence and must name the specific book of theirs it follows from.',
    '- Include isbn13 (digits only) only when you are confident of a real, widely-printed edition; omit the field entirely otherwise. A wrong ISBN shows the wrong cover.',
    '',
    'Reply with ONLY a JSON array, no prose and no code fence:',
    '[{"title":"...","author":"...","genre":"...","why":"...","isbn13":"..."}]',
  ].join('\n')
}

/* ── Response parsing ─────────────────────────────────────────── */

/**
 * Pull the JSON array out of a model reply.
 *
 * Models wrap JSON in prose or a fence often enough that demanding clean
 * output and failing otherwise would make this feel broken at random. The
 * fence is stripped, then the outermost [ … ] is extracted.
 */
export function parseSuggestions(raw: string): BookSuggestion[] {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')

  const start = text.indexOf('[')
  const end   = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map(x => ({
        title:  String(x.title  ?? '').trim(),
        author: String(x.author ?? '').trim(),
        why:    String(x.why    ?? '').trim(),
        genre:  x.genre ? String(x.genre).trim() : undefined,
        isbn13: (() => {
          const d = String(x.isbn13 ?? '').replace(/[^0-9Xx]/g, '')
          return d.length === 10 || d.length === 13 ? d : undefined
        })(),
      }))
      .filter(s => s.title.length > 0)
  } catch {
    return []
  }
}

/** Loose identity for "is this already on the shelf". */
function bookKey(title: string, author: string): string {
  const t = title.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/[^a-z0-9]+/g, '')
  const a = author.toLowerCase().split(/[,;]/)[0].replace(/[^a-z0-9]+/g, '')
  return `${t}|${a}`
}

/* ── Component ────────────────────────────────────────────────── */

type Phase = 'idle' | 'thinking' | 'done' | 'error'

export default function BookRecommendationFeed({ allBooks }: { allBooks: LibraryBook[] }) {
  const { toast } = useToast()
  const { authHeaders, config, mounted } = useAiConfig()

  const [phase,       setPhase]       = useState<Phase>('idle')
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [added,       setAdded]       = useState<Set<string>>(new Set())
  const [errorMsg,    setErrorMsg]    = useState('')

  const abortRef   = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; abortRef.current?.abort() }
  }, [])

  /* Finished books are the taste signal. Currently-reading and TBR say
     nothing about whether the reader actually liked anything. */
  const readBooks = useMemo(
    () => allBooks.filter(b => b.readingStatus === 'COMPLETED'),
    [allBooks],
  )

  /* Every book already known to the library, in any status — the exclusion
     set. Computed from the live list rather than the prompt so a model that
     ignores the instruction still cannot surface a duplicate. */
  const ownedKeys = useMemo(
    () => new Set(allBooks.map(b => bookKey(b.title, b.author || ''))),
    [allBooks],
  )

  const ratedCount = useMemo(
    () => readBooks.filter(b => b.userRating > 0).length,
    [readBooks],
  )

  const run = useCallback(async () => {
    if (phase === 'thinking') return
    if (!config.userApiKey) {
      toast('Add an AI key in Settings → AI Provider to get recommendations.', 'error')
      return
    }
    if (readBooks.length === 0) {
      toast('Finish and rate a few books first — that is what these are based on.', 'info')
      return
    }

    setPhase('thinking')
    setErrorMsg('')
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({
          messages: [{ role: 'user', content: buildPrompt(readBooks) }],
        }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(e.error ?? 'Request failed')
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
      }
      if (!mountedRef.current) return

      // The chat route appends tool-call JSON after a marker; recommendations
      // use none, but trim at it defensively so a stray marker cannot end up
      // inside the parsed payload.
      const body = full.split('ZENITH_ACTIONS')[0]

      const fresh = parseSuggestions(body)
        .filter(s => !ownedKeys.has(bookKey(s.title, s.author)))
        .slice(0, SHOW)

      if (fresh.length === 0) {
        setPhase('error')
        setErrorMsg('No new suggestions came back — everything proposed is already on your shelves. Try again for a different angle.')
        return
      }
      setSuggestions(fresh)
      setAdded(new Set())
      setPhase('done')
    } catch (err) {
      if (!mountedRef.current) return
      if ((err as Error).name === 'AbortError') return
      setPhase('error')
      setErrorMsg((err as Error).message || 'Could not reach the AI provider.')
    } finally {
      abortRef.current = null
    }
  }, [phase, config.userApiKey, authHeaders, readBooks, ownedKeys, toast])

  const addToTbr = useCallback(async (s: BookSuggestion) => {
    const key = bookKey(s.title, s.author)
    if (added.has(key)) return
    try {
      await db.library_books.add({
        id:            crypto.randomUUID(),
        title:         s.title,
        author:        s.author,
        isbn13:        s.isbn13,
        userRating:    0,
        readCount:     0,
        readingStatus: 'TO_READ',
        genre:         s.genre,
        addedAt:       Date.now(),
        // coverUrl intentionally absent: undefined means "never looked up",
        // which is what the automatic cover sweep watches for.
      })
      setAdded(prev => new Set(prev).add(key))
      toast(`Added "${s.title}" to your TBR shelf.`, 'success')
    } catch {
      toast('Could not add that book.', 'error')
    }
  }, [added, toast])

  /* ── Render ─────────────────────────────────────────────────── */

  const noKey = mounted && !config.userApiKey

  return (
    <section className={styles.feed} aria-labelledby="rec-heading">
      <header className={styles.head}>
        <div>
          <h3 id="rec-heading" className={styles.title}>Because you read…</h3>
          <p className={styles.sub}>
            {readBooks.length === 0
              ? 'Finish a few books and rate them — suggestions are built from what you liked.'
              : ratedCount === 0
                ? `Based on ${readBooks.length} finished book${readBooks.length === 1 ? '' : 's'}. Rating them sharpens this a lot.`
                : `Based on ${readBooks.length} finished book${readBooks.length === 1 ? '' : 's'}, ${ratedCount} of them rated.`}
          </p>
        </div>
        <button
          type="button"
          className={styles.runBtn}
          onClick={run}
          disabled={phase === 'thinking' || readBooks.length === 0 || noKey}
          title={noKey
            ? 'Add an AI key in Settings → AI Provider'
            : readBooks.length === 0
              ? 'Finish and rate a book first'
              : 'Suggest books based on your ratings'}
        >
          {phase === 'thinking'
            ? <><span className={styles.spinner} aria-hidden="true" /> Thinking…</>
            : phase === 'done' ? '↻ Suggest more' : '✦ Suggest books'}
        </button>
      </header>

      {noKey && (
        <p className={styles.notice}>
          Recommendations need an AI key — add one in Settings → AI Provider.
        </p>
      )}

      {phase === 'error' && errorMsg && (
        <p className={styles.notice} role="alert">{errorMsg}</p>
      )}

      {phase === 'done' && suggestions.length > 0 && (
        <ul className={styles.cards}>
          {suggestions.map((s, i) => {
            const key    = bookKey(s.title, s.author)
            const isAdded = added.has(key)
            return (
              <li
                key={key}
                className={styles.card}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className={styles.cardMain}>
                  <p className={styles.cardTitle}>{s.title}</p>
                  <p className={styles.cardAuthor}>{s.author}</p>
                  {s.genre && <span className={styles.cardGenre}>{s.genre}</span>}
                  <p className={styles.cardWhy}>{s.why}</p>
                </div>
                <button
                  type="button"
                  className={`${styles.addBtn} ${isAdded ? styles.addBtnDone : ''}`}
                  onClick={() => addToTbr(s)}
                  disabled={isAdded}
                >
                  {isAdded ? '✓ On your TBR' : '+ Add to TBR'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
