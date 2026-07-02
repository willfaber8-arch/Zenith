'use client'

import { useState, useMemo, useRef, useEffect, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
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
import { importGoodreadsCSV } from '@/utils/goodreadsParser'
import { syncHabitSource } from '@/lib/habitSync'
import { useToast } from '@/lib/ToastContext'
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
 *  to a stable id-hash so the shelf has natural height variation. */
function spineHeight(book: LibraryBook): number {
  if (book.totalPages) {
    return Math.max(210, Math.min(264, 184 + book.totalPages / 6))
  }
  let h = 0
  for (let i = 0; i < book.id.length; i++) h = (h * 17 + book.id.charCodeAt(i)) >>> 0
  return 214 + (h % 40)
}

/** Deterministic spine width (px) for subtle book-to-book variation. */
function spineWidth(book: LibraryBook): number {
  let h = 0
  for (let i = 0; i < book.id.length; i++) h = (h * 13 + book.id.charCodeAt(i)) >>> 0
  return 54 + (h % 4) * 4   // 54, 58, 62, 66
}

const SPINES_PER_SHELF = 7
const BOOKS_PER_PAGE    = 21

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

/* ── A single book spine on the shelf ────────────────────── */
function Spine({ book, onOpen }: { book: LibraryBook; onOpen: () => void }) {
  const color = spineColorFor(book)
  return (
    <button
      className={styles.spine}
      style={{ background: color, height: spineHeight(book), width: spineWidth(book) }}
      onClick={onOpen}
      title={`${book.title}${book.author ? ' — ' + book.author : ''}`}
    >
      <span className={styles.spineBandTop} />
      <span className={styles.spineTitle}>{book.title}</span>
      {book.userRating > 0 && (
        <span className={styles.spineRating}>{'★'.repeat(Math.min(book.userRating, 5))}</span>
      )}
      <span className={styles.spineBandBottom} />
      {book.author && <span className={styles.spineAuthor}>{book.author}</span>}
    </button>
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

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.detailModal} role="dialog" aria-modal="true" aria-label={book.title}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.detailTop}>
          {/* Large spine preview */}
          <div
            className={styles.detailSpine}
            style={{ background: color }}
          >
            <span className={styles.spineBandTop} />
            <span className={styles.detailSpineTitle}>{book.title}</span>
            <span className={styles.spineBandBottom} />
          </div>

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
  editMode, onStartReading,
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
}) {
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
        {book.totalPages ? (
          <span className={styles.metaPill}>{book.totalPages.toLocaleString()} pp</span>
        ) : null}
      </div>

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

  const [activeTab,    setActiveTab]    = useState<ViewTab>('LIBRARY')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [importPhase,  setImportPhase]  = useState<'idle' | 'loading' | 'done'>('idle')
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

  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Live data ────────────────────────── */
  const allBooks = useLiveQuery(() => db.library_books.toArray(), []) ?? []

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
        toast(`Imported ${result.imported} books from Goodreads.`, 'success')
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
    // Cascade: remove the book's logged reading sessions too.
    const keys = await db.reading_sessions.where('bookId').equals(bookId).primaryKeys().catch(() => [] as number[])
    await Promise.all([
      db.library_books.delete(bookId),
      keys.length ? db.reading_sessions.bulkDelete(keys) : Promise.resolve(),
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
          <button className={styles.addBtn} onClick={() => { resetAddForm(); setShowAddModal(true) }}>+ Add Book</button>
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
