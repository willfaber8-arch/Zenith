'use client'

import { useState, useMemo, useRef, useEffect, useCallback, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type KindleClipping } from '@/lib/db'
import {
  type LibraryBook,
  type ReadingStatus,
  type BookFormat,
  type SortKey,
  type GoodreadsImportResult,
  STATUS_LABELS,
  STATUS_GLYPHS,
  SPINE_COLORS,
  BOOK_GENRES,
  BOOK_FORMATS,
  SORT_LABELS,
  sortBooks,
  spineColorFor,
  computeBookStats,
  type ReadingSession,
} from '@/types/bookTracker'
import ReadingTimer from '@/components/ReadingTimer'
import { resolveCoverUrl } from '@/utils/bookCovers'
import { importGoodreadsCSV } from '@/utils/goodreadsParser'
import { importKindleClippings, type KindleImportResult } from '@/utils/kindleClippings'
import { syncHabitSource } from '@/lib/habitSync'
import { useToast } from '@/lib/ToastContext'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import { ACTION_MARKER, type CopilotAction } from '@/lib/copilotTools'
import { executeCopilotAction } from '@/lib/copilotActions'
import styles from './BookTrackerDashboard.module.css'

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Renders children into document.body via a portal. ViewRouter wraps each view
 * in a `transform: scale(...)` element, which makes `position: fixed` resolve
 * against that wrapper instead of the viewport — pushing modals partly under
 * the tab bar. The portal escapes the transformed ancestor.
 */
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

function fmtDate(ms: number | undefined): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** Deterministic spine height (px) — pages drive thickness; falls back
 *  to a stable id-hash so the shelf has natural height variation.
 *  Range 206–272px; the spine's contents flex to fit whatever it returns. */
function spineHeight(book: LibraryBook): number {
  if (book.totalPages) {
    return Math.round(Math.max(206, Math.min(272, 178 + book.totalPages / 5.5)))
  }
  let h = 0
  for (let i = 0; i < book.id.length; i++) h = (h * 17 + book.id.charCodeAt(i)) >>> 0
  return 208 + (h % 62)
}

/** Deterministic spine width (px) for subtle book-to-book variation. */
function spineWidth(book: LibraryBook): number {
  let h = 0
  for (let i = 0; i < book.id.length; i++) h = (h * 13 + book.id.charCodeAt(i)) >>> 0
  return 58 + (h % 4) * 4   // 58, 62, 66, 70
}

/* ── Spine label helpers (display-only — stored data is never mutated) ──── */

/** Generational / academic tails that follow a surname rather than being one. */
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq'])

/** Lowercase particles that belong to the surname ("Le Guin", "van Gogh"). */
const NAME_PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'della', 'der', 'den', 'da', 'di', 'du',
  'dos', 'das', 'la', 'le', 'lo', 'ter', 'ten', 'bin', 'ibn', 'saint', 'st',
])

const normWord = (w: string): string => w.toLowerCase().replace(/[.,]/g, '')

/** "J." / "R" — a single letter, optionally dotted. */
const isInitialToken = (w: string): boolean => /^[\p{L}]\.?$/u.test(w)

/**
 * Reduce a full author name to the surname, which is the only part that
 * reliably fits a 58–70px spine. "Brandon Sanderson" → "Sanderson",
 * "Herbert, Frank" → "Herbert", "R. J. Potter" → "Potter",
 * "Ursula K. Le Guin" → "Le Guin", "Homer" → "Homer".
 */
function surnameOf(fullName: string): string {
  const cleaned = fullName.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  // "Last, First" (Goodreads / Kindle export order): the surname leads.
  const comma = cleaned.indexOf(',')
  const head  = comma > 0 ? cleaned.slice(0, comma).trim() : ''
  const words = (head || cleaned).split(/[\s,]+/).filter(Boolean)

  if (words.length === 0) return cleaned
  if (words.length === 1) return words[0]

  // Peel generational suffixes off the tail so they don't masquerade as names.
  const suffixes: string[] = []
  while (words.length > 1 && NAME_SUFFIXES.has(normWord(words[words.length - 1]))) {
    suffixes.unshift(words.pop() as string)
  }
  const withSuffix = (base: string): string =>
    // A short surname can carry its suffix ("King Jr."); a long one drops it.
    suffixes.length > 0 && base.length + suffixes[0].length + 1 <= 11
      ? `${base} ${suffixes[0]}`
      : base

  if (words.length === 1) return withSuffix(words[0])

  // Walk back off any trailing initials, then absorb surname particles.
  let end = words.length - 1
  while (end > 0 && isInitialToken(words[end])) end--
  let start = end
  while (start > 0 && NAME_PARTICLES.has(normWord(words[start - 1]))) start--

  const surname = words.slice(start, end + 1).join(' ')
  if (!surname || isInitialToken(surname)) return withSuffix(words.join(' '))
  return withSuffix(surname)
}

/** Spine-sized author label. Falls back to the raw name if nothing survives. */
function shortAuthor(fullName: string): string {
  const name = fullName.trim()
  if (!name) return ''
  return surnameOf(name) || name
}

/** Trailing "(…)", "[…]" or "{…}" group — series/edition noise on a spine. */
const TRAILING_GROUP_RE = /\s*[([{][^()[\]{}]*[)\]}]\s*$/
/** Trailing volume marker: "Mistborn, #3" → "Mistborn". */
const TRAILING_NUMBER_RE = /[\s,;:–—-]+#\s*\d+$/

/**
 * Spine-only title. Strips trailing series/edition parentheticals and bracket
 * groups so a spine reads "Oathbringer" rather than "Oathbringer (The S…".
 * Display-only: the modal, table and database keep the full stored title.
 */
function displayTitle(rawTitle: string): string {
  const original = rawTitle.replace(/\s+/g, ' ').trim()
  let t = original
  for (let i = 0; i < 3; i++) {
    const next = t.replace(TRAILING_GROUP_RE, '').trim()
    if (next === t || next.length === 0) break
    t = next
  }
  const trimmed = t.replace(TRAILING_NUMBER_RE, '').trim()
  return trimmed || t || original
}

/* ── Kindle clipping helpers ─────────────────────────────── */

/** In-book ordering key — Kindle location start, else printed page, else time. */
function clippingOrder(c: KindleClipping): number {
  if (c.location) {
    const n = parseInt(c.location.split('-')[0], 10)
    if (Number.isFinite(n)) return n
  }
  if (c.page !== undefined) return c.page
  return c.addedAt ?? 0
}

/** Sorted in reading order, bookmarks stripped out (counted separately). */
function readableClippings(list: KindleClipping[]): KindleClipping[] {
  return list
    .filter(c => c.type !== 'BOOKMARK')
    .sort((a, b) => clippingOrder(a) - clippingOrder(b))
}

/**
 * Per-book highlights & notes panel. Notes carry their own accent so they
 * read as the user's voice; bookmarks collapse into a single footer line.
 */
function ClippingsPanel({ clippings }: { clippings: KindleClipping[] }) {
  const rows      = readableClippings(clippings)
  const bookmarks = clippings.length - rows.length

  if (rows.length === 0 && bookmarks === 0) return null

  return (
    <div className={styles.clipPanel}>
      {rows.length === 0 ? (
        <p className={styles.logEmpty}>Only bookmarks were imported for this book.</p>
      ) : (
        <ul className={styles.clipList}>
          {rows.map(c => (
            <li
              key={c.id}
              className={`${styles.clipRow} ${c.type === 'NOTE' ? styles.clipRowNote : ''}`}
            >
              <div className={styles.clipTopLine}>
                <span className={c.type === 'NOTE' ? styles.clipTagNote : styles.clipTag}>
                  {c.type === 'NOTE' ? '✎ Note' : '❝ Highlight'}
                </span>
                <span className={styles.clipLoc}>
                  {c.page !== undefined ? `p. ${c.page}` : ''}
                  {c.page !== undefined && c.location ? ' · ' : ''}
                  {c.location ? `loc ${c.location}` : ''}
                </span>
              </div>
              <p className={styles.clipText}>{c.text}</p>
              {c.addedAt !== undefined && (
                <span className={styles.clipDate}>{fmtDate(c.addedAt)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {bookmarks > 0 && (
        <div className={styles.clipBookmarks}>
          ◷ {bookmarks} bookmark{bookmarks !== 1 ? 's' : ''} imported
        </div>
      )}
    </div>
  )
}

const SPINES_PER_SHELF = 7
const BOOKS_PER_PAGE    = 21

/* ── Cover-sweep budget ──────────────────────────────────────
   Open Library and Google Books are free, un-keyed and rate-limited, and a
   Goodreads export can be many hundreds of books. Two dials keep the
   *automatic* sweep a good citizen:

     · concurrency — the automatic pass runs half as wide as a deliberate
       button press. The reader did not ask for it, so it should never be the
       loudest thing on the network while the page is still settling.
     · batch cap   — one automatic pass answers at most this many books. The
       remainder is left for the next visit or the (now clearly labelled)
       manual button, so importing 600 books never turns into 600+ background
       requests in a single page load.

   48 covers is roughly the first two-and-a-bit pages of the shelf, i.e. more
   than the reader can see before they have scrolled — the library looks fully
   illustrated straight away, and the backlog drains a page-load at a time. */
const MANUAL_COVER_CONCURRENCY = 4
const AUTO_COVER_CONCURRENCY   = 2
const AUTO_COVER_BATCH         = 48

type ViewTab = 'LIBRARY' | 'TBR' | 'READING' | 'ALL'

const TABS: { id: ViewTab; label: string; glyph: string }[] = [
  { id: 'LIBRARY', label: 'Library',   glyph: '📚' },
  { id: 'TBR',     label: 'TBR',       glyph: '◈'  },
  { id: 'READING', label: 'Reading',   glyph: '◎'  },
  { id: 'ALL',     label: 'All Books', glyph: '≡'  },
]

/* ── Star Rating Row ─────────────────────────────────────── */
function StarRow({
  value, onRate, readonly = false,
}: {
  value: number
  onRate?: (n: number) => void
  readonly?: boolean
}) {
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={[
            styles.starBtn,
            n <= value ? styles.starFilled : '',
            readonly ? styles.starReadonly : '',
          ].join(' ')}
          onClick={() => !readonly && onRate?.(n)}
          title={readonly ? undefined : `Rate ${n} star${n !== 1 ? 's' : ''}`}
          tabIndex={readonly ? -1 : 0}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

/** Front-cover proportions (width ÷ height) — a standard trade paperback. */
const COVER_ASPECT = 0.66

/* ── A single book spine on the shelf ────────────────────── */
/**
 * A book on the shelf. At rest it is purely a spine; the front cover is folded
 * 90° back into the page along the spine's left edge (see `.coverFace`), so it
 * is edge-on and invisible. Hovering — or focusing, since the spine is a real
 * button — swings the whole book out of the row and turns the cover to face
 * the reader. Books without artwork just get the plain lift instead.
 */
function Spine({ book, onOpen }: { book: LibraryBook; onOpen: () => void }) {
  const color  = spineColorFor(book)
  const label  = displayTitle(book.title)
  const byline = book.author ? shortAuthor(book.author) : ''
  const height = spineHeight(book)

  // `coverUrl` points at an arbitrary remote host, so the <img> itself is the
  // only reliable validator. A 404 / blocked host flips this to 'error' and the
  // cover face is dropped entirely — never an empty white rectangle.
  const src = book.coverUrl || null
  const [imgState, setImgState] = useState<'loading' | 'ok' | 'error'>('loading')
  useEffect(() => { setImgState('loading') }, [src])
  const showCover = src !== null && imgState !== 'error'

  return (
    <button
      className={`${styles.spine} ${showCover ? styles.spineWithCover : ''}`}
      style={{
        // The colour drives layered gradients in CSS (sheen, rounded-spine
        // shading, page edge) rather than a flat inline background.
        '--spine-color': color,
        // Cover width is derived from this book's height so every jacket keeps
        // real book proportions regardless of how thick the spine is.
        '--cover-w': `${Math.round(height * COVER_ASPECT)}px`,
        height,
        width:  spineWidth(book),
      } as React.CSSProperties}
      onClick={onOpen}
      title={`${book.title}${book.author ? ' — ' + book.author : ''}${showCover ? ' — hover to see the cover' : ''}`}
    >
      <span className={styles.spineFace}>
        <span className={styles.spineBandTop} />
        <span className={styles.spineTitle}>{label}</span>
        {book.userRating > 0 && (
          <span className={styles.spineRating}>{'★'.repeat(Math.min(book.userRating, 5))}</span>
        )}
        <span className={styles.spineBandBottom} />
        {byline && <span className={styles.spineAuthor}>{byline}</span>}
        {showCover && <span className={styles.coverPip} aria-hidden="true" />}
      </span>

      {showCover && (
        <span
          className={`${styles.coverFace} ${imgState === 'loading' ? styles.coverFaceLoading : ''}`}
          aria-hidden="true"
        >
          <img
            className={styles.coverImg}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgState('ok')}
            onError={() => setImgState('error')}
          />
        </span>
      )}
    </button>
  )
}

/**
 * Detail-modal cover art. Falls back to the large spine preview whenever the
 * book has no resolved cover or the image fails to load.
 */
function DetailCoverArt({ book, color }: { book: LibraryBook; color: string }) {
  const [failed, setFailed] = useState(false)
  const src = book.coverUrl || null

  if (src !== null && !failed) {
    return (
      <div className={styles.detailCoverWrap}>
        <img
          className={styles.detailCoverImg}
          src={src}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={styles.detailSpine}
      style={{ '--spine-color': color } as React.CSSProperties}
    >
      <span className={styles.spineBandTop} />
      <span className={styles.detailSpineTitle}>{book.title}</span>
      <span className={styles.spineBandBottom} />
    </div>
  )
}

/* ── Bookshelf — chunks books into shelves + ledges ──────── */
function Bookshelf({
  books, onOpenBook, emptyGlyph, emptyLabel, emptyHint,
}: {
  books: LibraryBook[]
  onOpenBook: (id: string) => void
  emptyGlyph: string
  emptyLabel: string
  emptyHint: string
}) {
  if (books.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyGlyph}>{emptyGlyph}</div>
        <div className={styles.emptyLabel}>{emptyLabel}</div>
        <div className={styles.emptyHint}>{emptyHint}</div>
      </div>
    )
  }

  // group the page's books into shelves of SPINES_PER_SHELF
  const shelves: LibraryBook[][] = []
  for (let i = 0; i < books.length; i += SPINES_PER_SHELF) {
    shelves.push(books.slice(i, i + SPINES_PER_SHELF))
  }

  return (
    <div className={styles.shelfStack}>
      {shelves.map((shelf, si) => (
        <div key={si} className={styles.shelf}>
          <div className={styles.shelfBooks}>
            {shelf.map(b => (
              <Spine key={b.id} book={b} onOpen={() => onOpenBook(b.id)} />
            ))}
          </div>
          <div className={styles.shelfLedge} />
        </div>
      ))}
    </div>
  )
}

/* ── Full-context table (no visuals) ─────────────────────── */
function FullContextTable({ books }: { books: LibraryBook[] }) {
  if (books.length === 0) {
    return <div className={styles.emptyHint}>No completed books to list yet.</div>
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.ctxTable}>
        <thead>
          <tr>
            <th className={styles.ctxNum}>#</th>
            <th>Title</th>
            <th>Author</th>
            <th>Date Read</th>
            <th className={styles.ctxRating}>Rating</th>
            <th className={styles.ctxPages}>Pages</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b, i) => (
            <tr key={b.id}>
              <td className={styles.ctxNum}>{i + 1}</td>
              <td className={styles.ctxTitle}>{b.title}</td>
              <td className={styles.ctxAuthor}>{b.author || '—'}</td>
              <td className={styles.ctxDate}>{fmtDate(b.dateCompleted) || '—'}</td>
              <td className={styles.ctxRating}>
                {b.userRating > 0 ? (
                  <span className={styles.ctxStars}>{'★'.repeat(b.userRating)}</span>
                ) : (
                  <span className={styles.ctxMuted}>unrated</span>
                )}
              </td>
              <td className={styles.ctxPages}>{b.totalPages ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Book detail modal (opened from a spine) ─────────────── */
function BookDetailModal({
  book, reviewDraft, onReviewChange, onSaveReview,
  onRate, onSetColor, onStatusChange, onDelete, onClose,
  editMode, onEditDetails, onStartReading,
}: {
  book: LibraryBook
  reviewDraft: string | undefined
  onReviewChange: (t: string) => void
  onSaveReview: () => void
  onRate: (n: number) => void
  onSetColor: (hex: string) => void
  onStatusChange: (s: ReadingStatus) => void
  onDelete: () => void
  onClose: () => void
  editMode: boolean
  onEditDetails: () => void
  onStartReading: () => void
}) {
  const color = spineColorFor(book)
  const currentText = reviewDraft !== undefined ? reviewDraft : (book.customReviewText ?? '')
  const isDirty = reviewDraft !== undefined && reviewDraft !== (book.customReviewText ?? '')

  const sessions = useLiveQuery(
    () => db.reading_sessions.where('bookId').equals(book.id).toArray(),
    [book.id],
  ) ?? []
  const sortedSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt)
  const stats = computeBookStats(sessions)

  const clippings = useLiveQuery(
    () => db.kindle_clippings.where('bookId').equals(book.id).toArray(),
    [book.id],
  ) ?? []
  const [showClips, setShowClips] = useState(false)

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.detailModal} role="dialog" aria-modal="true" aria-label={book.title}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.detailTop}>
          {/* Real cover art when we have it; large spine preview otherwise */}
          <DetailCoverArt book={book} color={color} />

          <div className={styles.detailInfo}>
            <span className={`${styles.statusBadge} ${
              book.readingStatus === 'COMPLETED' ? styles.statusCompleted
              : book.readingStatus === 'CURRENTLY_READING' ? styles.statusReading
              : styles.statusToRead}`}>
              {STATUS_GLYPHS[book.readingStatus]}&nbsp;{STATUS_LABELS[book.readingStatus]}
            </span>
            <div className={styles.detailTitle}>{book.title}</div>
            <div className={styles.detailAuthor}>by {book.author || 'Unknown Author'}</div>

            <div className={styles.detailMeta}>
              {book.genre && <span className={styles.metaPill}>{book.genre}</span>}
              {book.series && <span className={styles.metaPill}>{book.series}</span>}
              {book.publicationYear && <span className={styles.metaPill}>{book.publicationYear}</span>}
              {book.format && <span className={styles.metaPill}>{book.format}</span>}
              {book.dateCompleted && <span className={styles.datePill}>Read {fmtDate(book.dateCompleted)}</span>}
              {book.totalPages ? <span className={styles.metaPill}>{book.totalPages.toLocaleString()} pp</span> : null}
              {book.readCount > 1 && <span className={styles.metaPill}>Read ×{book.readCount}</span>}
              {book.readingMinutes ? <span className={styles.metaPill}>⏱ {Math.round(book.readingMinutes)} min read</span> : null}
            </div>

            <div className={styles.ratingRow}>
              <StarRow value={book.userRating} onRate={onRate} />
              {book.globalRating !== undefined && (
                <span className={styles.globalRating}>{book.globalRating.toFixed(2)} avg</span>
              )}
            </div>
          </div>
        </div>

        {/* Spine colour picker */}
        <div className={styles.colorSection}>
          <span className={styles.fieldLabel}>Spine Colour</span>
          <div className={styles.swatchRow}>
            {SPINE_COLORS.map(hex => (
              <button
                key={hex}
                className={`${styles.swatch} ${color.toLowerCase() === hex.toLowerCase() ? styles.swatchActive : ''}`}
                style={{ background: hex }}
                onClick={() => onSetColor(hex)}
                aria-label={`Set spine colour ${hex}`}
              />
            ))}
            <label className={styles.swatchCustom} title="Custom colour">
              <input
                type="color"
                value={color}
                onChange={e => onSetColor(e.target.value)}
                className={styles.colorInput}
              />
              <span>+</span>
            </label>
          </div>
        </div>

        {/* Review */}
        <div className={styles.reviewSection}>
          <span className={styles.reviewLabel}>My Notes</span>
          <textarea
            className={styles.reviewTextarea}
            value={currentText}
            onChange={e => onReviewChange(e.target.value)}
            onBlur={() => isDirty && onSaveReview()}
            placeholder="Add personal notes or a review…"
            rows={3}
          />
          {isDirty && (
            <button className={styles.saveReviewBtn} onClick={onSaveReview}>Save Note</button>
          )}
        </div>

        {/* Kindle highlights */}
        {clippings.length > 0 && (
          <div className={styles.clipSection}>
            <button
              className={styles.clipToggle}
              onClick={() => setShowClips(v => !v)}
              aria-expanded={showClips}
            >
              <span className={styles.clipBadge}>❝ {clippings.length}</span>
              Kindle highlights &amp; notes
              <span className={styles.clipChevron}>{showClips ? '▾' : '▸'}</span>
            </button>
            {showClips && <ClippingsPanel clippings={clippings} />}
          </div>
        )}

        {/* Shelf-move actions */}
        {/* Reading log + stats */}
        <div className={styles.logSection}>
          <div className={styles.logHead}>
            <span className={styles.fieldLabel}>Reading Log</span>
            {stats.sessions > 0 && (
              <div className={styles.logStats}>
                <span>⏱ {stats.totalMinutes} min</span>
                {stats.totalPages > 0 && <span>· {stats.totalPages} pp</span>}
                {stats.pagesPerMin != null && <span>· {stats.pagesPerMin} ppm</span>}
              </div>
            )}
          </div>
          {sortedSessions.length === 0 ? (
            <p className={styles.logEmpty}>No sessions yet — hit ⏱ Read to start a timed reading session.</p>
          ) : (
            <ul className={styles.logList}>
              {sortedSessions.slice(0, 8).map(s => (
                <li key={s.id} className={styles.logRow}>
                  <span className={styles.logDate}>{fmtDate(s.createdAt)}</span>
                  <span className={styles.logMeta}>
                    {s.minutes} min{s.pagesRead ? ` · ${s.pagesRead} pp` : ''}
                    {s.pagesRead && s.minutes > 0 ? ` · ${Math.round((s.pagesRead / s.minutes) * 10) / 10} ppm` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.detailActions}>
          {book.readingStatus !== 'COMPLETED' && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnGreen}`}
              onClick={() => onStatusChange('COMPLETED')}
            >
              ✦ Mark Read → Library
            </button>
          )}
          {book.readingStatus !== 'CURRENTLY_READING' && (
            <button className={styles.actionBtn} onClick={() => onStatusChange('CURRENTLY_READING')}>
              ◎ {book.readingStatus === 'COMPLETED' ? 'Read Again' : 'Start Reading'}
            </button>
          )}
          {book.readingStatus !== 'TO_READ' && (
            <button className={styles.actionBtn} onClick={() => onStatusChange('TO_READ')}>
              ◈ Move to TBR
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.actionBtnTimer}`} onClick={onStartReading}>
            ⏱ Read
          </button>
          {editMode && (
            <>
              <button className={styles.actionBtn} onClick={onEditDetails}>✎ Edit details</button>
              <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onDelete}>
                ✕ Remove
              </button>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

/* ── Book card (Reading + All Books list) ────────────────── */
function BookCard({
  book, reviewDraft, onReviewChange, onSaveReview, onRate, onStatusChange, onDelete, index,
  editMode, onStartReading, clippings,
}: {
  book: LibraryBook
  reviewDraft: string | undefined
  onReviewChange: (text: string) => void
  onSaveReview: () => void
  onRate: (rating: number) => void
  onStatusChange: (status: ReadingStatus) => void
  onDelete: () => void
  index: number
  editMode: boolean
  onStartReading: () => void
  clippings: KindleClipping[]
}) {
  const [showClips, setShowClips] = useState(false)
  const currentText = reviewDraft !== undefined ? reviewDraft : (book.customReviewText ?? '')
  const isDirty = reviewDraft !== undefined && reviewDraft !== (book.customReviewText ?? '')
  const statusCls =
    book.readingStatus === 'COMPLETED' ? styles.statusCompleted
    : book.readingStatus === 'CURRENTLY_READING' ? styles.statusReading
    : styles.statusToRead

  return (
    <div className={styles.card} style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}>
      <div className={styles.cardHeader}>
        <span className={`${styles.statusBadge} ${statusCls}`}>
          {STATUS_GLYPHS[book.readingStatus]}&nbsp;{STATUS_LABELS[book.readingStatus]}
        </span>
        <span className={styles.cardHeaderRight}>
          {clippings.length > 0 && (
            <button
              className={styles.clipBadgeBtn}
              onClick={() => setShowClips(v => !v)}
              aria-expanded={showClips}
              title={`${clippings.length} Kindle clipping${clippings.length !== 1 ? 's' : ''}`}
            >
              ❝ {clippings.length}
            </button>
          )}
          {book.totalPages ? (
            <span className={styles.metaPill}>{book.totalPages.toLocaleString()} pp</span>
          ) : null}
        </span>
      </div>

      {showClips && clippings.length > 0 && <ClippingsPanel clippings={clippings} />}

      <div className={styles.cardBodyRow}>
        <div className={styles.cardMiniSpine} style={{ background: spineColorFor(book) }} />
        <div>
          <div className={styles.bookTitle}>{book.title}</div>
          <div className={styles.bookAuthor}>by {book.author || 'Unknown Author'}</div>
        </div>
      </div>

      {(book.dateCompleted || book.readCount > 1 || book.isbn13) && (
        <div className={styles.metaRow}>
          {book.dateCompleted && <span className={styles.datePill}>Completed {fmtDate(book.dateCompleted)}</span>}
          {book.readCount > 1 && <span className={styles.metaPill}>Read ×{book.readCount}</span>}
          {book.isbn13 && <span className={styles.metaPill}>ISBN {book.isbn13}</span>}
        </div>
      )}

      <div className={styles.ratingRow}>
        <StarRow value={book.userRating} onRate={onRate} />
        {book.globalRating !== undefined ? (
          <span className={styles.globalRating}>{book.globalRating.toFixed(2)} avg</span>
        ) : book.userRating === 0 ? (
          <span className={styles.globalRating}>tap to rate</span>
        ) : null}
      </div>

      <div className={styles.reviewSection}>
        <span className={styles.reviewLabel}>My Notes</span>
        <textarea
          className={styles.reviewTextarea}
          value={currentText}
          onChange={e => onReviewChange(e.target.value)}
          onBlur={() => isDirty && onSaveReview()}
          placeholder="Add personal notes or a review…"
          rows={3}
        />
        {isDirty && <button className={styles.saveReviewBtn} onClick={onSaveReview}>Save Note</button>}
      </div>

      <div className={styles.cardActions}>
        <button className={`${styles.actionBtn} ${styles.actionBtnTimer}`} onClick={onStartReading}>⏱ Read</button>
        {book.readingStatus === 'TO_READ' && (
          <button className={styles.actionBtn} onClick={() => onStatusChange('CURRENTLY_READING')}>◎ Start Reading</button>
        )}
        {book.readingStatus === 'CURRENTLY_READING' && (
          <>
            <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={() => onStatusChange('COMPLETED')}>✦ Mark Complete</button>
            <button className={styles.actionBtn} onClick={() => onStatusChange('TO_READ')}>◈ Move to TBR</button>
          </>
        )}
        {book.readingStatus === 'COMPLETED' && (
          <>
            <button className={styles.actionBtn} onClick={() => onStatusChange('CURRENTLY_READING')}>↺ Read Again</button>
            <button className={styles.actionBtn} onClick={() => onStatusChange('TO_READ')}>◈ Move to TBR</button>
          </>
        )}
        {editMode && (
          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onDelete}>✕ Remove</button>
        )}
      </div>
    </div>
  )
}

/* ── Main Dashboard ──────────────────────────────────────── */
export default function BookTrackerDashboard() {
  const { toast } = useToast()
  const { authHeaders, config } = useAiConfig()

  const [activeTab,    setActiveTab]    = useState<ViewTab>('LIBRARY')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [importPhase,  setImportPhase]  = useState<'idle' | 'loading' | 'done'>('idle')
  const [kindlePhase,  setKindlePhase]  = useState<'idle' | 'loading'>('idle')
  /*
   * Librarian progress.
   *
   * The two stages report progress differently, and the UI is honest about
   * which is which. `/api/chat` buffers the model's tool calls and flushes
   * them in a single enqueue after the stream ends (see emitActions), so
   * while the model is thinking there is genuinely nothing to count — that
   * stage gets an indeterminate bar plus an elapsed clock, not a fake
   * percentage that crawls to 90% and stalls. Once the calls land, writing
   * them to IndexedDB is real countable work and the bar becomes determinate.
   */
  const [enrichPhase, setEnrichPhase] = useState<{
    stage: 'idle' | 'researching' | 'applying'
    done:  number
    total: number
  }>({ stage: 'idle', done: 0, total: 0 })
  const [enrichElapsed, setEnrichElapsed] = useState(0)
  const [coverPhase,   setCoverPhase]   = useState<{ running: boolean; done: number; total: number }>(
    { running: false, done: 0, total: 0 },
  )
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)  // book being edited (add modal reused)
  const [addTitle,     setAddTitle]     = useState('')
  const [addAuthor,    setAddAuthor]    = useState('')
  const [addPages,     setAddPages]     = useState('')
  const [addStatus,    setAddStatus]    = useState<ReadingStatus>('COMPLETED')
  const [addColor,     setAddColor]     = useState<string>(SPINE_COLORS[0])
  const [addGenre,     setAddGenre]     = useState('')
  const [addYear,      setAddYear]      = useState('')
  const [addSeries,    setAddSeries]    = useState('')
  const [addFormat,    setAddFormat]    = useState<BookFormat | ''>('')
  const [reviewEdits,  setReviewEdits]  = useState<Record<string, string>>({})
  const [fullContext,  setFullContext]  = useState(false)
  const [sortKey,      setSortKey]      = useState<SortKey>('recent')
  const [editMode,     setEditMode]     = useState(false)
  const [libraryPage,  setLibraryPage]  = useState(0)
  const [tbrPage,      setTbrPage]      = useState(0)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [timerBookId,  setTimerBookId]  = useState<string | null>(null)  // reading-timer target

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const kindleInputRef = useRef<HTMLInputElement>(null)
  const coverAbortRef  = useRef<AbortController | null>(null)
  // One shared busy latch for both sweep paths (automatic + button). A ref,
  // not state, so it flips synchronously and two callers in the same tick
  // cannot both read "idle" and start overlapping network passes.
  const coverSweepBusyRef = useRef(false)
  const coverMountedRef   = useRef(true)

  // Cover lookups are network work owned by this view — tear them down if the
  // user navigates away mid-sweep rather than leaving requests in flight.
  useEffect(() => {
    coverMountedRef.current = true
    return () => {
      coverMountedRef.current = false
      coverAbortRef.current?.abort()
    }
  }, [])

  /* ── Live data ────────────────────────── */
  // `useLiveQuery` yields `undefined` for the boot frame before IndexedDB has
  // answered. `booksLoaded` distinguishes "still loading" from "genuinely
  // empty library" — the automatic cover sweep must not fire on the former.
  // The `?? []` fallback is memoised so an empty library doesn't hand every
  // downstream `useMemo` a brand-new array identity on every render.
  const allBooksRaw = useLiveQuery(() => db.library_books.toArray(), [])
  const booksLoaded = allBooksRaw !== undefined
  const allBooks = useMemo(() => allBooksRaw ?? [], [allBooksRaw])

  /* Kindle clippings, bucketed by bookId for O(1) per-card lookup. */
  const allClippings = useLiveQuery(() => db.kindle_clippings.toArray(), []) ?? []
  const clippingsByBook = useMemo(() => {
    const map = new Map<string, KindleClipping[]>()
    for (const c of allClippings) {
      if (!c.bookId) continue
      const list = map.get(c.bookId)
      if (list) list.push(c)
      else map.set(c.bookId, [c])
    }
    return map
  }, [allClippings])
  const clippingsFor = (bookId: string): KindleClipping[] => clippingsByBook.get(bookId) ?? []

  const counts = useMemo(() => ({
    total:     allBooks.length,
    completed: allBooks.filter(b => b.readingStatus === 'COMPLETED').length,
    reading:   allBooks.filter(b => b.readingStatus === 'CURRENTLY_READING').length,
    toRead:    allBooks.filter(b => b.readingStatus === 'TO_READ').length,
  }), [allBooks])

  const matchesSearch = (b: LibraryBook) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
  }

  const libraryBooks = useMemo(() =>
    sortBooks(allBooks.filter(b => b.readingStatus === 'COMPLETED' && matchesSearch(b)), sortKey),
  [allBooks, searchQuery, sortKey])

  const tbrBooks = useMemo(() =>
    sortBooks(allBooks.filter(b => b.readingStatus === 'TO_READ' && matchesSearch(b)), sortKey),
  [allBooks, searchQuery, sortKey])

  const readingBooks = useMemo(() =>
    sortBooks(allBooks.filter(b => b.readingStatus === 'CURRENTLY_READING' && matchesSearch(b)), sortKey),
  [allBooks, searchQuery, sortKey])

  const allFiltered = useMemo(() =>
    sortBooks(allBooks.filter(matchesSearch), sortKey),
  [allBooks, searchQuery, sortKey])

  const selectedBook = selectedId ? allBooks.find(b => b.id === selectedId) ?? null : null

  /* ── Pagination slices ─────────────────── */
  const libraryPageCount = Math.max(1, Math.ceil(libraryBooks.length / BOOKS_PER_PAGE))
  const tbrPageCount     = Math.max(1, Math.ceil(tbrBooks.length / BOOKS_PER_PAGE))
  const safeLibPage      = Math.min(libraryPage, libraryPageCount - 1)
  const safeTbrPage      = Math.min(tbrPage, tbrPageCount - 1)
  const libraryPaged     = libraryBooks.slice(safeLibPage * BOOKS_PER_PAGE, safeLibPage * BOOKS_PER_PAGE + BOOKS_PER_PAGE)
  const tbrPaged         = tbrBooks.slice(safeTbrPage * BOOKS_PER_PAGE, safeTbrPage * BOOKS_PER_PAGE + BOOKS_PER_PAGE)

  /* ── Handlers ────────────────────────── */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportPhase('loading')
    try {
      const text = await file.text()
      const result: GoodreadsImportResult = await importGoodreadsCSV(text)
      if (result.imported > 0) {
        setImportPhase('done')
        const dupNote = result.skipped > 0 ? ` (${result.skipped} already in your library)` : ''
        toast(`Imported ${result.imported} book${result.imported !== 1 ? 's' : ''} from Goodreads${dupNote}.`, 'success')
      } else if (result.skipped > 0) {
        setImportPhase('idle')
        toast(`All ${result.skipped} book${result.skipped !== 1 ? 's are' : ' is'} already in your library — nothing new to import.`, 'info')
      } else {
        setImportPhase('idle')
        toast(result.errors[0] ?? 'No books found in CSV.', 'error')
      }
    } catch {
      setImportPhase('idle')
      toast('CSV import failed. Check that this is a Goodreads export file.', 'error')
    }
    e.target.value = ''
  }

  /**
   * Kindle `My Clippings.txt` import. Fully local: the file is read in the
   * browser, parsed, de-duplicated by clipping hash and folded into the
   * library. Re-importing the same file imports nothing.
   */
  const handleKindleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setKindlePhase('loading')
    try {
      const text = await file.text()
      const r: KindleImportResult = await importKindleClippings(text)

      if (r.errors.length > 0) {
        toast(r.errors[0], 'error')
      } else if (r.clippingsImported > 0) {
        const clip  = `${r.clippingsImported} highlight${r.clippingsImported !== 1 ? 's' : ''}`
        const books = `${r.booksTouched} book${r.booksTouched !== 1 ? 's' : ''}`
        const fresh = r.booksCreated > 0 ? ` (${r.booksCreated} new)` : ''
        toast(`Imported ${clip} across ${books}${fresh}.`, 'success')
      } else if (r.clippingsSkipped > 0) {
        toast(
          `All ${r.clippingsSkipped} clipping${r.clippingsSkipped !== 1 ? 's are' : ' is'} already imported — nothing new in this file.`,
          'info',
        )
      } else {
        toast('No clippings found in that file.', 'info')
      }
    } catch {
      toast('Kindle import failed. Select the "My Clippings.txt" file from your Kindle.', 'error')
    }
    setKindlePhase('idle')
    e.target.value = ''
  }

  /* Books the AI Librarian can enrich — missing a page count OR a genre. */
  const booksNeedingDetails = useMemo(
    () => allBooks.filter(b => !b.totalPages || !b.genre),
    [allBooks],
  )

  /**
   * AI "Librarian" enrichment pass. Sends up to 20 under-described books to
   * /api/chat and relies on the model calling the `update_book` tool for each.
   * Streams the response exactly like AiCopilotSidebar, then parses the
   * ACTION_MARKER payload and executes each update against IndexedDB.
   */
  const handleAiFill = async () => {
    if (enrichPhase.stage !== 'idle') return
    const candidates = booksNeedingDetails.slice(0, 20)
    if (candidates.length === 0) {
      toast('Every book already has a page count and genre.', 'info')
      return
    }
    if (!config.userApiKey) {
      toast('Add an AI key in Settings → AI Provider to use the Librarian.', 'error')
      return
    }

    setEnrichPhase({ stage: 'researching', done: 0, total: candidates.length })
    try {
      const list = candidates
        .map((b, i) => `${i + 1}. "${b.title}"${b.author ? ` by ${b.author}` : ''}`)
        .join('\n')

      const userMessage =
        'You are a librarian. Fill in the details for each of these books I own. ' +
        'For EVERY book, call the update_book tool once, passing its title (and author) plus ' +
        'any details you know: genre, pages, publicationYear, series, review (a 1–2 sentence synopsis), ' +
        'and rating (the typical community average, 0–5). Research each title from your own knowledge and ' +
        'be accurate. Do not ask questions — just emit the update_book tool calls.\n\n' + list

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ messages: [{ role: 'user', content: userMessage }] }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errBody.error ?? 'Request failed')
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
      }

      let actions: CopilotAction[] = []
      const markerIdx = full.indexOf(ACTION_MARKER)
      if (markerIdx >= 0) {
        try {
          const parsed = JSON.parse(full.slice(markerIdx + ACTION_MARKER.length))
          if (Array.isArray(parsed)) actions = parsed as CopilotAction[]
        } catch { /* malformed action payload — ignore */ }
      }

      const updates = actions.filter(a => a.name === 'update_book')
      if (updates.length === 0) {
        toast('The Librarian could not find details for those books. Try again.', 'info')
        return
      }

      // Writing the results is real, countable work — switch the bar from
      // indeterminate to a true done/total readout for this stage.
      setEnrichPhase({ stage: 'applying', done: 0, total: updates.length })

      let filled = 0
      let written = 0
      for (const a of updates) {
        try { await executeCopilotAction(a); filled++ } catch { /* skip failed row */ }
        written++
        setEnrichPhase({ stage: 'applying', done: written, total: updates.length })
      }

      toast(
        filled > 0
          ? `Filled in details for ${filled} book${filled !== 1 ? 's' : ''}.`
          : 'No new details could be added.',
        filled > 0 ? 'success' : 'info',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The Librarian is unavailable.'
      toast(msg.length < 120 ? msg : 'The Librarian is unavailable. Check your AI key in Settings.', 'error')
    } finally {
      setEnrichPhase({ stage: 'idle', done: 0, total: 0 })
    }
  }

  /* Elapsed clock for the Librarian. Only ticks while a pass is live, so an
     idle dashboard schedules no timers at all. */
  useEffect(() => {
    if (enrichPhase.stage === 'idle') { setEnrichElapsed(0); return }
    const startedAt = Date.now()
    setEnrichElapsed(0)
    const id = setInterval(() => setEnrichElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [enrichPhase.stage])

  /* ── Cover art ─────────────────────────────────────────────
     `coverUrl` is a three-state cache written straight onto the book row:
       undefined → never looked up      null → looked up, no artwork exists
       string    → resolved cover URL
     so a sweep only ever touches books it has not already answered, and
     re-running fills the gaps left by a previous (or interrupted) run. */
  const booksNeedingCovers = useMemo(
    () => allBooks.filter(b => b.coverUrl === undefined),
    [allBooks],
  )
  const booksWithCoverMisses = useMemo(
    () => allBooks.filter(b => b.coverUrl === null),
    [allBooks],
  )

  /** Once every fresh book is resolved the button turns into a misses retry. */
  const coverIsRetry   = booksNeedingCovers.length === 0 && booksWithCoverMisses.length > 0
  const coverQueue     = coverIsRetry ? booksWithCoverMisses : booksNeedingCovers

  /**
   * Resolve cover art for a batch of books, a few at a time.
   *
   * Open Library and Google Books are free and un-keyed, so the sweep runs a
   * fixed pool of workers pulling from one shared cursor — steady, bounded
   * pressure on both services instead of a burst of hundreds of parallel
   * requests. Every answer (hit *or* miss) is written back immediately, so an
   * interrupted run keeps everything it already resolved.
   *
   * `silent` suppresses the closing toast: the automatic background sweep uses
   * it so opening the Library never announces itself. The button still shows
   * live progress either way — a disabled, counting button is honest feedback,
   * and it is what stops a manual click landing on top of an automatic pass.
   *
   * The busy guard is a ref, not `coverPhase.running`: state is a render-time
   * snapshot, so two callers in the same tick would both read `false` and start
   * duplicate sweeps. The ref flips synchronously on entry.
   */
  const runCoverSweep = useCallback(async (
    queue: LibraryBook[],
    opts: { silent?: boolean; concurrency?: number } = {},
  ) => {
    const { silent = false, concurrency = MANUAL_COVER_CONCURRENCY } = opts
    if (coverSweepBusyRef.current || queue.length === 0) return
    coverSweepBusyRef.current = true

    const controller = new AbortController()
    coverAbortRef.current = controller
    setCoverPhase({ running: true, done: 0, total: queue.length })

    let cursor = 0
    let done   = 0
    let found  = 0

    const worker = async () => {
      while (cursor < queue.length && !controller.signal.aborted) {
        const book = queue[cursor++]
        let url: string | null = null
        try {
          url = await resolveCoverUrl(book, { verify: true, signal: controller.signal })
        } catch {
          url = null   // treat any failure as "no cover found this pass"
        }
        // An aborted request resolves as a miss — don't cache that as an answer.
        if (controller.signal.aborted) return
        try {
          await db.library_books.update(book.id, { coverUrl: url, coverCheckedAt: Date.now() })
        } catch {
          /* book removed mid-sweep — nothing to write */
        }
        if (url) found++
        done++
        if (coverMountedRef.current) setCoverPhase(p => (p.running ? { ...p, done } : p))
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
      )
    } finally {
      coverSweepBusyRef.current = false
      coverAbortRef.current = null
    }

    // Aborted → the component is gone (or navigating): touch no state.
    if (controller.signal.aborted || !coverMountedRef.current) return

    setCoverPhase({ running: false, done: 0, total: 0 })
    if (silent) return
    toast(
      found > 0
        ? `Found covers for ${found} of ${done} book${done !== 1 ? 's' : ''}.`
        : `No cover art found for ${done} book${done !== 1 ? 's' : ''}. Adding an ISBN or exact title helps.`,
      found > 0 ? 'success' : 'info',
    )
  }, [toast])

  /**
   * Automatic background sweep — the reason a freshly imported library shows
   * cover art without the reader ever discovering the button.
   *
   * Scope: only books that have *never* been looked up (`coverUrl === undefined`).
   * Confirmed misses (`null`) are deliberately excluded, otherwise every visit
   * would re-hammer both APIs for books that genuinely have no artwork; those
   * stay behind the manual "Retry cover misses" button.
   *
   * Loop safety: the sweep writes to `library_books`, which re-fires
   * `useLiveQuery`, which gives `booksNeedingCovers` a new identity, which
   * re-runs this effect — every write. `autoAttemptedRef` is the fence: the
   * whole current backlog is marked the instant a pass starts, so a re-entry
   * sees an empty `pending` and returns immediately. Books imported *later*
   * are not in the set, so an import still gets an automatic pass.
   */
  const autoAttemptedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!booksLoaded) return                    // IndexedDB has not answered yet
    if (coverSweepBusyRef.current) return       // a sweep already owns the network

    const seen = autoAttemptedRef.current
    const pending = booksNeedingCovers.filter(b => !seen.has(b.id))
    if (pending.length === 0) return

    // Fence the entire backlog, then work only the head of it. The remainder is
    // picked up on the next visit or by the manual button — an automatic pass
    // stays a polite, finite amount of traffic no matter how big the import.
    for (const b of pending) seen.add(b.id)

    void runCoverSweep(pending.slice(0, AUTO_COVER_BATCH), {
      silent: true,
      concurrency: AUTO_COVER_CONCURRENCY,
    })
  }, [booksLoaded, booksNeedingCovers, runCoverSweep])

  const handleRate = async (bookId: string, rating: number) => {
    await db.library_books.update(bookId, { userRating: rating })
  }

  const handleSetColor = async (bookId: string, hex: string) => {
    await db.library_books.update(bookId, { spineColor: hex })
  }

  const handleStatusChange = async (book: LibraryBook, newStatus: ReadingStatus) => {
    const updates: Partial<LibraryBook> = { readingStatus: newStatus }
    if (newStatus === 'CURRENTLY_READING' && !book.dateStarted) updates.dateStarted = Date.now()
    if (newStatus === 'COMPLETED') {
      updates.dateCompleted = Date.now()
      updates.readCount = (book.readCount ?? 0) + 1
    }
    await db.library_books.update(book.id, updates)

    // Cross-tab habit auto-sync: starting or finishing a book counts as a
    // reading session, advancing any habit linked to the 'reading' source.
    // Only fire on a real transition INTO an active-reading state (not when
    // re-saving the same status) so it never double-counts.
    if (
      newStatus !== book.readingStatus &&
      (newStatus === 'CURRENTLY_READING' || newStatus === 'COMPLETED')
    ) {
      void syncHabitSource('reading', 1)
    }
  }

  const handleSaveReview = async (bookId: string) => {
    const draft = reviewEdits[bookId]
    if (draft === undefined) return
    await db.library_books.update(bookId, { customReviewText: draft })
    setReviewEdits(prev => { const next = { ...prev }; delete next[bookId]; return next })
  }

  const handleDelete = async (bookId: string) => {
    // Cascade: remove the book's logged reading sessions + Kindle clippings too.
    const keys = await db.reading_sessions.where('bookId').equals(bookId).primaryKeys().catch(() => [] as number[])
    const clipKeys = await db.kindle_clippings.where('bookId').equals(bookId).primaryKeys().catch(() => [] as string[])
    await Promise.all([
      db.library_books.delete(bookId),
      keys.length ? db.reading_sessions.bulkDelete(keys) : Promise.resolve(),
      clipKeys.length ? db.kindle_clippings.bulkDelete(clipKeys) : Promise.resolve(),
    ])
    if (selectedId === bookId) setSelectedId(null)
  }

  const resetAddForm = () => {
    setAddTitle(''); setAddAuthor(''); setAddPages('')
    setAddStatus('COMPLETED'); setAddColor(SPINE_COLORS[0])
    setAddGenre(''); setAddYear(''); setAddSeries(''); setAddFormat('')
    setEditingId(null)
  }

  const closeAddModal = () => { setShowAddModal(false); resetAddForm() }

  const openEditBook = (b: LibraryBook) => {
    setEditingId(b.id)
    setAddTitle(b.title); setAddAuthor(b.author)
    setAddPages(b.totalPages ? String(b.totalPages) : '')
    setAddStatus(b.readingStatus); setAddColor(spineColorFor(b))
    setAddGenre(b.genre ?? ''); setAddYear(b.publicationYear ? String(b.publicationYear) : '')
    setAddSeries(b.series ?? ''); setAddFormat(b.format ?? '')
    setSelectedId(null)
    setShowAddModal(true)
  }

  const handleAddBook = async () => {
    if (!addTitle.trim()) return
    const now = Date.now()
    const pages = parseInt(addPages, 10) || undefined
    const year  = parseInt(addYear, 10) || undefined
    const common = {
      title:  addTitle.trim(),
      author: addAuthor.trim(),
      totalPages: pages,
      readingStatus: addStatus,
      spineColor: addColor,
      genre:           addGenre.trim() || undefined,
      publicationYear: year,
      series:          addSeries.trim() || undefined,
      format:          addFormat || undefined,
    }

    if (editingId) {
      await db.library_books.update(editingId, common)
      closeAddModal()
      toast(`"${common.title}" updated.`, 'success')
      return
    }

    const book: LibraryBook = {
      id: crypto.randomUUID(),
      userRating: 0,
      readCount: addStatus === 'COMPLETED' ? 1 : 0,
      dateCompleted:  addStatus === 'COMPLETED'         ? now : undefined,
      dateStarted:    addStatus === 'CURRENTLY_READING' ? now : undefined,
      addedAt: now,
      ...common,
    }
    await db.library_books.put(book)
    closeAddModal()
    toast(`"${book.title}" added to your ${addStatus === 'TO_READ' ? 'TBR list' : 'library'}.`, 'success')
  }

  /** Log a finished reading session (time + optional pages) against a book,
   *  and advance the reading habit. */
  const handleLogReading = async (bookId: string, minutes: number, pagesRead?: number) => {
    if (minutes <= 0 && !pagesRead) { setTimerBookId(null); return }
    const b = allBooks.find(x => x.id === bookId)
    if (b) {
      const now = Date.now()
      await db.reading_sessions.add({
        bookId,
        date: new Date().toISOString().slice(0, 10),
        minutes,
        pagesRead,
        createdAt: now,
      })
      await db.library_books.update(bookId, {
        readingMinutes: (b.readingMinutes ?? 0) + minutes,
        lastReadAt: now,
      })
      // Auto-sync: a logged reading session advances any habit on the
      // 'reading' source (same bridge used when starting/finishing a book).
      void syncHabitSource('reading', 1)
      const pp = pagesRead ? ` · ${pagesRead} pages` : ''
      toast(`Logged ${minutes} min${pp} reading "${b.title}".`, 'success')
    }
    setTimerBookId(null)
  }

  /* ── Render ──────────────────────────── */
  return (
    <div className={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={kindleInputRef}
        type="file"
        accept=".txt,text/plain"
        style={{ display: 'none' }}
        onChange={handleKindleFile}
      />

      {/* Metrics bar */}
      <div className={styles.metricsBar}>
        <span className={`${styles.metricChip} ${styles.metricGreen}`}>Library · {counts.completed}</span>
        <span className={styles.metricChip}>To read · {counts.toRead}</span>
        <span className={`${styles.metricChip} ${styles.metricPurple}`}>Reading · {counts.reading}</span>

        <div className={styles.metricsActions}>
          <button
            className={styles.importBtn}
            onClick={() => importPhase !== 'loading' && fileInputRef.current?.click()}
            disabled={importPhase === 'loading'}
          >
            {importPhase === 'loading' ? 'Importing…' : 'Import Goodreads CSV'}
          </button>
          <button
            className={styles.kindleBtn}
            onClick={() => kindlePhase !== 'loading' && kindleInputRef.current?.click()}
            disabled={kindlePhase === 'loading'}
            title='Plug your Kindle in by USB, open the "documents" folder and select My Clippings.txt'
          >
            {kindlePhase === 'loading'
              ? <><span className={styles.kindleSpinner} aria-hidden="true" />Reading clippings…</>
              : '❝ Import from Kindle'}
          </button>
          <button
            className={`${styles.coverBtn} ${coverPhase.running ? styles.coverBtnRunning : ''}`}
            onClick={() => void runCoverSweep(coverQueue)}
            disabled={coverPhase.running || coverQueue.length === 0}
            title={
              coverPhase.running
                ? 'Looking up cover art — you can keep using the library'
                : coverQueue.length === 0
                  ? 'Every book already has cover art or has been checked'
                  : coverIsRetry
                    ? `Try Open Library and Google Books again for ${coverQueue.length} book${coverQueue.length === 1 ? '' : 's'} with no cover`
                    : `Look up cover art for ${coverQueue.length} book${coverQueue.length === 1 ? '' : 's'}`
            }
          >
            {coverPhase.running
              ? <><span className={styles.coverSpinner} aria-hidden="true" />Fetching covers… {coverPhase.done}/{coverPhase.total}</>
              : coverQueue.length === 0
                ? '◲ Covers up to date'
                : coverIsRetry
                  ? `◲ Retry cover misses (${coverQueue.length})`
                  : `◲ Fetch covers (${coverQueue.length})`}
          </button>
          <button className={styles.addBtn} onClick={() => { resetAddForm(); setShowAddModal(true) }}>+ Add Book</button>
          <button
            className={styles.librarianBtn}
            onClick={handleAiFill}
            disabled={enrichPhase.stage !== 'idle' || booksNeedingDetails.length === 0}
            title={booksNeedingDetails.length === 0
              ? 'Every book already has a page count and genre'
              : `Ask the AI Librarian to research ${Math.min(booksNeedingDetails.length, 20)} book${booksNeedingDetails.length === 1 ? '' : 's'} missing details`}
          >
            {enrichPhase.stage !== 'idle'
              ? <><span className={styles.librarianSpinner} aria-hidden="true" />
                  {enrichPhase.stage === 'researching' ? 'Researching…' : 'Saving…'}</>
              : `✨ Ask AI to Fill Details${booksNeedingDetails.length > 0 ? ` (${Math.min(booksNeedingDetails.length, 20)})` : ''}`}
          </button>
          <button
            className={`${styles.editModeBtn} ${editMode ? styles.editModeBtnOn : ''}`}
            onClick={() => setEditMode(v => !v)}
            title={editMode ? 'Done editing — books are locked' : 'Edit library (enables editing & removing books)'}
            aria-pressed={editMode}
          >
            {editMode ? '✓ Done' : '✎ Edit'}
          </button>
        </div>
      </div>

      {/* ── Librarian progress ──────────────────────────────────────
          A multi-second network round trip with no other on-screen sign
          of life. `aria-valuenow` is deliberately omitted while
          researching: the ARIA spec treats a progressbar without it as
          indeterminate, which is exactly what that stage is. */}
      {enrichPhase.stage !== 'idle' && (() => {
        const determinate = enrichPhase.stage === 'applying' && enrichPhase.total > 0
        const pct = determinate
          ? Math.round((enrichPhase.done / enrichPhase.total) * 100)
          : 0
        const mins = Math.floor(enrichElapsed / 60)
        const secs = enrichElapsed % 60
        return (
          <div className={styles.librarianProgress} role="status" aria-live="polite">
            <div className={styles.librarianProgressHead}>
              <span className={styles.librarianProgressLabel}>
                {enrichPhase.stage === 'researching'
                  ? `Researching ${enrichPhase.total} book${enrichPhase.total !== 1 ? 's' : ''}…`
                  : `Saving details — ${enrichPhase.done} / ${enrichPhase.total}`}
              </span>
              <span className={styles.librarianProgressClock}>
                {mins}:{String(secs).padStart(2, '0')}
              </span>
            </div>

            <div
              className={styles.librarianTrack}
              role="progressbar"
              aria-label={enrichPhase.stage === 'researching'
                ? 'Researching book details'
                : 'Saving book details'}
              aria-valuemin={0}
              aria-valuemax={100}
              {...(determinate ? { 'aria-valuenow': pct } : {})}
            >
              <div
                className={determinate ? styles.librarianFill : styles.librarianFillIndet}
                style={determinate ? ({ '--fill-pct': `${pct}%` } as React.CSSProperties) : undefined}
              />
            </div>

            <p className={styles.librarianProgressHint}>
              {enrichPhase.stage === 'researching'
                ? 'The model answers in one pass, so this step has no per-book milestones — the clock is the honest signal that it is still working.'
                : 'Writing to your library.'}
            </p>
          </div>
        )
      })()}

      {/* Kindle import hint */}
      <p className={styles.kindleHint}>
        <span className={styles.kindleHintGlyph}>❝</span>
        Kindle: plug your device in by USB, open the <code className={styles.kindleHintCode}>documents</code> folder
        and select <code className={styles.kindleHintCode}>My Clippings.txt</code> — every highlight and note
        lands on its book. Nothing leaves this device.
      </p>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className={styles.tabGlyph}>{t.glyph}</span>
            {t.label}
            {t.id === 'LIBRARY' && counts.completed > 0 && <span className={styles.tabCount}>{counts.completed}</span>}
            {t.id === 'TBR'     && counts.toRead    > 0 && <span className={styles.tabCount}>{counts.toRead}</span>}
            {t.id === 'READING' && counts.reading   > 0 && <span className={styles.tabCount}>{counts.reading}</span>}
          </button>
        ))}
      </div>

      {/* Search + sort + (library) view toggle */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search titles, authors…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <label className={styles.sortWrap}>
          <span className={styles.sortLabel}>Sort</span>
          <select
            className={styles.sortSelect}
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        {activeTab === 'LIBRARY' && (
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${!fullContext ? styles.viewToggleActive : ''}`}
              onClick={() => setFullContext(false)}
            >
              ▦ Shelf
            </button>
            <button
              className={`${styles.viewToggleBtn} ${fullContext ? styles.viewToggleActive : ''}`}
              onClick={() => setFullContext(true)}
            >
              ≡ Full Context
            </button>
          </div>
        )}
      </div>

      {/* ── LIBRARY tab ── */}
      {activeTab === 'LIBRARY' && (
        fullContext ? (
          <FullContextTable books={libraryBooks} />
        ) : (
          <>
            <Bookshelf
              books={libraryPaged}
              onOpenBook={setSelectedId}
              emptyGlyph="📚"
              emptyLabel={counts.completed === 0 ? 'Your library is empty' : 'No matches on this shelf'}
              emptyHint={counts.completed === 0
                ? 'Mark a book complete or import your Goodreads CSV to start stacking your shelf.'
                : 'Try a different search query.'}
            />
            {libraryPageCount > 1 && (
              <Pager page={safeLibPage} pageCount={libraryPageCount} onChange={setLibraryPage} />
            )}
          </>
        )
      )}

      {/* ── TBR tab ── */}
      {activeTab === 'TBR' && (
        <>
          <Bookshelf
            books={tbrPaged}
            onOpenBook={setSelectedId}
            emptyGlyph="◈"
            emptyLabel={counts.toRead === 0 ? 'No books on your TBR shelf' : 'No matches on this shelf'}
            emptyHint={counts.toRead === 0
              ? 'Add books you want to read — they\'ll line up here until you start them.'
              : 'Try a different search query.'}
          />
          {tbrPageCount > 1 && (
            <Pager page={safeTbrPage} pageCount={tbrPageCount} onChange={setTbrPage} />
          )}
        </>
      )}

      {/* ── READING tab ── */}
      {activeTab === 'READING' && (
        readingBooks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyGlyph}>◎</div>
            <div className={styles.emptyLabel}>Nothing in progress</div>
            <div className={styles.emptyHint}>Open a book from your TBR shelf and hit “Start Reading”.</div>
          </div>
        ) : (
          <div className={styles.grid}>
            {readingBooks.map((book, i) => (
              <BookCard
                key={book.id} book={book} index={i}
                reviewDraft={reviewEdits[book.id]}
                onReviewChange={t => setReviewEdits(p => ({ ...p, [book.id]: t }))}
                onSaveReview={() => handleSaveReview(book.id)}
                onRate={r => handleRate(book.id, r)}
                onStatusChange={s => handleStatusChange(book, s)}
                onDelete={() => handleDelete(book.id)}
                editMode={editMode}
                onStartReading={() => setTimerBookId(book.id)}
                clippings={clippingsFor(book.id)}
              />
            ))}
          </div>
        )
      )}

      {/* ── ALL BOOKS tab ── */}
      {activeTab === 'ALL' && (
        allFiltered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyGlyph}>◈</div>
            <div className={styles.emptyLabel}>{counts.total === 0 ? 'Your library is empty' : 'No matches'}</div>
            <div className={styles.emptyHint}>
              {counts.total === 0
                ? 'Import your Goodreads library CSV or add books manually to begin.'
                : 'Try adjusting your search query.'}
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {allFiltered.map((book, i) => (
              <BookCard
                key={book.id} book={book} index={i}
                reviewDraft={reviewEdits[book.id]}
                onReviewChange={t => setReviewEdits(p => ({ ...p, [book.id]: t }))}
                onSaveReview={() => handleSaveReview(book.id)}
                onRate={r => handleRate(book.id, r)}
                onStatusChange={s => handleStatusChange(book, s)}
                onDelete={() => handleDelete(book.id)}
                editMode={editMode}
                onStartReading={() => setTimerBookId(book.id)}
                clippings={clippingsFor(book.id)}
              />
            ))}
          </div>
        )
      )}

      {/* Detail modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          reviewDraft={reviewEdits[selectedBook.id]}
          onReviewChange={t => setReviewEdits(p => ({ ...p, [selectedBook.id]: t }))}
          onSaveReview={() => handleSaveReview(selectedBook.id)}
          onRate={r => handleRate(selectedBook.id, r)}
          onSetColor={hex => handleSetColor(selectedBook.id, hex)}
          onStatusChange={s => handleStatusChange(selectedBook, s)}
          onDelete={() => handleDelete(selectedBook.id)}
          onClose={() => setSelectedId(null)}
          editMode={editMode}
          onEditDetails={() => openEditBook(selectedBook)}
          onStartReading={() => setTimerBookId(selectedBook.id)}
        />
      )}

      {/* Add Book Modal */}
      {showAddModal && (
        <ModalPortal>
          <div className={styles.modalBackdrop} onClick={closeAddModal} />
          <div className={styles.modal} role="dialog" aria-modal={true} aria-label={editingId ? 'Edit book' : 'Add book'}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{editingId ? 'Edit Book' : 'Add Book'}</span>
              <button className={styles.modalClose} onClick={closeAddModal} aria-label="Close">✕</button>
            </div>

            <div className={styles.modalForm}>
              <span className={styles.formLabel}>Title *</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Book title"
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBook()}
                autoFocus
              />

              <span className={styles.formLabel}>Author</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Author name"
                value={addAuthor}
                onChange={e => setAddAuthor(e.target.value)}
              />

              <span className={styles.formLabel}>Genre</span>
              <input
                className={styles.formInput}
                type="text"
                list="lib-genre-list"
                placeholder="e.g. Fantasy (pick or type your own)"
                value={addGenre}
                onChange={e => setAddGenre(e.target.value)}
              />
              <datalist id="lib-genre-list">
                {BOOK_GENRES.map(g => <option key={g} value={g} />)}
              </datalist>

              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <span className={styles.formLabel}>Pages</span>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="Total pages"
                    value={addPages}
                    onChange={e => setAddPages(e.target.value)}
                    min={1}
                  />
                </div>
                <div className={styles.formCol}>
                  <span className={styles.formLabel}>Published</span>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="Year"
                    value={addYear}
                    onChange={e => setAddYear(e.target.value)}
                    min={0}
                    max={2100}
                  />
                </div>
              </div>

              <span className={styles.formLabel}>Series</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder="e.g. Mistborn #1 (optional)"
                value={addSeries}
                onChange={e => setAddSeries(e.target.value)}
              />

              <span className={styles.formLabel}>Format</span>
              <select
                className={styles.formSelect}
                value={addFormat}
                onChange={e => setAddFormat(e.target.value as BookFormat | '')}
              >
                <option value="">— Not set —</option>
                {BOOK_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>

              <span className={styles.formLabel}>Shelf</span>
              <select
                className={styles.formSelect}
                value={addStatus}
                onChange={e => setAddStatus(e.target.value as ReadingStatus)}
              >
                <option value="COMPLETED">Library (already read)</option>
                <option value="TO_READ">TBR (to be read)</option>
                <option value="CURRENTLY_READING">Currently Reading</option>
              </select>

              <span className={styles.formLabel}>Spine Colour</span>
              <div className={styles.swatchRow}>
                {SPINE_COLORS.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    className={`${styles.swatch} ${addColor.toLowerCase() === hex.toLowerCase() ? styles.swatchActive : ''}`}
                    style={{ background: hex }}
                    onClick={() => setAddColor(hex)}
                    aria-label={`Spine colour ${hex}`}
                  />
                ))}
                <label className={styles.swatchCustom} title="Custom colour">
                  <input type="color" value={addColor} onChange={e => setAddColor(e.target.value)} className={styles.colorInput} />
                  <span>+</span>
                </label>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={closeAddModal}>Cancel</button>
              <button className={styles.modalSubmitBtn} onClick={handleAddBook} disabled={!addTitle.trim()}>
                {editingId ? 'Save Changes' : 'Add Book'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Reading timer (full-screen) */}
      {timerBookId && (() => {
        const tb = allBooks.find(b => b.id === timerBookId)
        if (!tb) return null
        return (
          <ModalPortal>
            <ReadingTimer
              bookTitle={tb.title}
              bookAuthor={tb.author}
              onFinish={(mins, pagesRead) => handleLogReading(timerBookId, mins, pagesRead)}
              onClose={() => setTimerBookId(null)}
            />
          </ModalPortal>
        )
      })()}
    </div>
  )
}

/* ── Pager ───────────────────────────────────────────────── */
function Pager({
  page, pageCount, onChange,
}: { page: number; pageCount: number; onChange: (p: number) => void }) {
  return (
    <div className={styles.pager}>
      <button
        className={styles.pagerBtn}
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
      >
        ‹ Prev
      </button>
      <div className={styles.pagerDots}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            className={`${styles.pagerDot} ${i === page ? styles.pagerDotActive : ''}`}
            onClick={() => onChange(i)}
            aria-label={`Shelf page ${i + 1}`}
          />
        ))}
      </div>
      <span className={styles.pagerLabel}>Page {page + 1} / {pageCount}</span>
      <button
        className={styles.pagerBtn}
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
      >
        Next ›
      </button>
    </div>
  )
}
