'use client'

/**
 * Zenith OS — StudyShieldView
 * Phase 3 · Step 3.5 — AI Lecture Summarizer & Flashcard Generator
 *
 * State machine:
 *   idle      — only the ingestion dock is shown
 *   loading   — handled inside AiIngestionDock (spinner overlay)
 *   results   — summary panel + flashcard deck rendered side by side;
 *               ingestion dock collapses to a single-line toggle
 *   (history) — past sessions from quickNotes IDB always visible below
 *
 * Persistence:
 *   Each successful response is written to db.quickNotes with
 *   category='ai-study'.  The body stores JSON so the session can be
 *   restored by clicking a history card.
 */

import { useState, useCallback }   from 'react'
import { useLiveQuery }             from 'dexie-react-hooks'
import { db, type QuickNote }       from '@/lib/db'
import ZenHeading                   from '@/components/ui/ZenHeading'
import AiIngestionDock              from '@/components/AiIngestionDock'
import FlashcardDeck                from '@/components/FlashcardDeck'
import { markdownToHtml }           from '@/utils/markdownToHtml'
import type { StudyAiResponse, StudySession } from '@/types/studyAi'
import styles from './StudyShieldView.module.css'

/* ── Helpers ─────────────────────────────────────────────────── */

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function noteToSession(note: QuickNote): StudySession | null {
  try {
    const parsed = JSON.parse(note.body)
    return {
      title:           note.title,
      markdownSummary: parsed.markdownSummary,
      flashcards:      parsed.flashcards,
      createdAt:       note.createdAt,
      noteId:          note.id,
    }
  } catch {
    return null
  }
}

/* ════════════════════════════════════════════════════════════════
   MAIN VIEW
   ════════════════════════════════════════════════════════════════ */

export default function StudyShieldView() {
  const [session, setSession] = useState<StudySession | null>(null)

  /* Past sessions — live query from quickNotes table */
  const historyNotes = useLiveQuery(
    () => db.quickNotes
      .where('category').equals('ai-study')
      .reverse()
      .limit(6)
      .sortBy('updatedAt'),
    [],
  )

  /* ── Handle API result ─────────────────────────────────────── */

  const handleResult = useCallback(async (
    result: StudyAiResponse,
    title:  string,
  ) => {
    const now  = Date.now()
    const body = JSON.stringify({
      markdownSummary: result.markdownSummary,
      flashcards:      result.flashcards,
    })

    const noteId = await db.quickNotes.add({
      title:     title || `Study Session — ${formatDate(now)}`,
      body,
      category:  'ai-study',
      updatedAt: now,
      createdAt: now,
    })

    setSession({
      title:           title || `Study Session — ${formatDate(now)}`,
      markdownSummary: result.markdownSummary,
      flashcards:      result.flashcards,
      createdAt:       now,
      noteId:          noteId as number,
    })
  }, [])

  /* ── Restore a past session ────────────────────────────────── */

  const restoreSession = useCallback((note: QuickNote) => {
    const s = noteToSession(note)
    if (s) setSession(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  /* ── Delete a session from IDB ─────────────────────────────── */

  const deleteSession = useCallback(async (note: QuickNote, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.quickNotes.delete(note.id)
    if (session?.noteId === note.id) setSession(null)
  }, [session])

  /* ── Rendered summary HTML ─────────────────────────────────── */

  const summaryHtml = session ? markdownToHtml(session.markdownSummary) : ''

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className={styles.view}>

      {/* ── Page heading ─────────────────────────────────────── */}
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Scholastic · Study Shield"
          title={`AI Study\nPackage.`}
          subtitle="Paste lecture notes or drop a text file — Zenith AI returns a structured summary and a full flashcard deck in seconds."
          size="lg"
        />
      </div>

      {/* ── Ingestion dock ───────────────────────────────────── */}
      <div className="anim-fade-in delay-1">
        <AiIngestionDock
          onResult={handleResult}
          isCompact={!!session}
        />
      </div>

      {/* ── Results area ─────────────────────────────────────── */}
      {session && (
        <div className={`${styles.results} anim-scale-in`} key={session.createdAt}>

          {/* Session header */}
          <div className={styles.sessionHeader}>
            <div className={styles.sessionMeta}>
              <h2 className={styles.sessionTitle}>{session.title}</h2>
              <span className={styles.sessionDate}>{formatDate(session.createdAt)}</span>
            </div>
            <button
              className={styles.clearBtn}
              onClick={() => setSession(null)}
              aria-label="Clear current session"
            >
              Clear
            </button>
          </div>

          {/* Two-column layout: summary + flashcards */}
          <div className={styles.columns}>

            {/* ── Markdown Summary panel ─────────────────────── */}
            <section className={styles.summaryPanel}>
              <header className={styles.panelHeader}>
                <span className={styles.panelEyebrow}>AI Summary</span>
                <span className={styles.wordCount}>
                  {session.markdownSummary.split(/\s+/).length} words
                </span>
              </header>
              <div
                className={styles.summaryBody}
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            </section>

            {/* ── Flashcard Deck panel ────────────────────────── */}
            <section className={styles.flashPanel}>
              <header className={styles.panelHeader}>
                <span className={styles.panelEyebrow}>Flashcard Deck</span>
                <span className={styles.wordCount}>{session.flashcards.length} cards</span>
              </header>
              <FlashcardDeck flashcards={session.flashcards} />
            </section>

          </div>
        </div>
      )}

      {/* ── Session history ───────────────────────────────────── */}
      {historyNotes && historyNotes.length > 0 && (
        <section className={`${styles.historySection} anim-fade-in delay-2`}>
          <h3 className={styles.historyTitle}>Past Sessions</h3>
          <div className={styles.historyGrid}>
            {historyNotes.map(note => (
              <button
                key={note.id}
                className={`${styles.historyCard} ${session?.noteId === note.id ? styles.historyCardActive : ''}`}
                onClick={() => restoreSession(note)}
                aria-label={`Restore session: ${note.title}`}
              >
                <div className={styles.historyCopy}>
                  <span className={styles.historyCardTitle}>{note.title}</span>
                  <span className={styles.historyCardDate}>{formatDate(note.updatedAt)}</span>
                </div>
                <button
                  className={styles.historyDelete}
                  onClick={(e) => deleteSession(note, e)}
                  aria-label={`Delete session: ${note.title}`}
                  title="Delete"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
