'use client'

import { useState, useCallback }   from 'react'
import { useLiveQuery }             from 'dexie-react-hooks'
import { db, type QuickNote }       from '@/lib/db'
import ZenHeading                   from '@/components/ui/ZenHeading'
import AiIngestionDock              from '@/components/AiIngestionDock'
import FlashcardDeck                from '@/components/FlashcardDeck'
import MultiplayerLobby             from '@/components/MultiplayerLobby'
import { useStudyMode }             from '@/lib/StudyModeContext'
import { markdownToHtml }           from '@/utils/markdownToHtml'
import type { StudyAiResponse, StudySession, PracticeQuestion } from '@/types/studyAi'
import RoadmapGeneratorButton       from '@/components/RoadmapGeneratorButton'
import styles from './StudyShieldView.module.css'

type Tab = 'ai-study' | 'focus-protocol' | 'focus-rooms' | 'roadmap'

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
      flashcards:      parsed.flashcards      ?? [],
      practiceTest:    parsed.practiceTest    ?? [],
      createdAt:       note.createdAt,
      noteId:          note.id,
    }
  } catch {
    return null
  }
}

/* ── Practice Test Panel ─────────────────────────────────────── */

function PracticeTestPanel({ questions }: { questions: PracticeQuestion[] }) {
  const [answers,   setAnswers]   = useState<Record<string, number>>({})
  const [revealed,  setRevealed]  = useState(false)

  const score = revealed
    ? questions.filter(q => answers[q.id] === q.correct).length
    : null

  const handleAnswer = (qId: string, idx: number) => {
    if (revealed) return
    setAnswers(prev => ({ ...prev, [qId]: idx }))
  }

  return (
    <section className={styles.practiceSection}>
      <header className={styles.panelHeader}>
        <span className={styles.panelEyebrow}>Practice Test</span>
        <span className={styles.wordCount}>{questions.length} questions</span>
      </header>

      <div className={styles.practiceList}>
        {questions.map((q, qi) => {
          const chosen   = answers[q.id] ?? -1
          const isRight  = revealed && chosen === q.correct
          const isWrong  = revealed && chosen !== q.correct && chosen !== -1
          return (
            <div key={q.id} className={styles.practiceQuestion}>
              <p className={styles.practiceQ}>
                <span className={styles.practiceQNum}>{qi + 1}.</span>
                {q.question}
              </p>
              <div className={styles.choiceList}>
                {q.choices.map((choice, ci) => {
                  const isChosen  = chosen === ci
                  const isCorrect = revealed && ci === q.correct
                  const isPickedWrong = revealed && isChosen && ci !== q.correct
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={`${styles.choiceBtn}
                        ${isChosen && !revealed ? styles.choiceSelected : ''}
                        ${isCorrect            ? styles.choiceCorrect  : ''}
                        ${isPickedWrong        ? styles.choiceWrong    : ''}`}
                      onClick={() => handleAnswer(q.id, ci)}
                      disabled={revealed}
                    >
                      <span className={styles.choiceLetter}>
                        {String.fromCharCode(65 + ci)}
                      </span>
                      {choice}
                    </button>
                  )
                })}
              </div>
              {revealed && (
                <p className={`${styles.practiceExplain} ${isRight ? styles.explainRight : isWrong ? styles.explainWrong : ''}`}>
                  {isRight ? '✓ ' : isWrong ? '✗ ' : ''}{q.explain}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.practiceFooter}>
        {score !== null && (
          <span className={styles.practiceScore}>
            Score: {score}/{questions.length}
            {score === questions.length ? ' — Perfect! 🎉' : ''}
          </span>
        )}
        {!revealed ? (
          <button
            type="button"
            className={styles.revealBtn}
            onClick={() => setRevealed(true)}
            disabled={Object.keys(answers).length < questions.length}
          >
            Submit &amp; Reveal
          </button>
        ) : (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => { setAnswers({}); setRevealed(false) }}
          >
            Retry
          </button>
        )}
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN VIEW
   ════════════════════════════════════════════════════════════════ */

export default function StudyShieldView() {
  const [activeTab, setActiveTab] = useState<Tab>('ai-study')
  const [session, setSession]     = useState<StudySession | null>(null)
  const { enterStudyWorkspace }   = useStudyMode()

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
      practiceTest:    result.practiceTest ?? [],
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
      practiceTest:    result.practiceTest ?? [],
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

  const TAB_LABELS: Record<Tab, string> = {
    'ai-study':       'AI Study',
    'focus-protocol': 'Focus Protocol',
    'focus-rooms':    'Focus Rooms',
    'roadmap':        'Task Roadmap',
  }

  const subtitles: Record<Tab, string> = {
    'ai-study':       'Paste lecture notes — Zenith AI returns a structured summary and flashcard deck.',
    'focus-protocol': 'Enter deep work mode with a full-screen Pomodoro cockpit.',
    'focus-rooms':    'Create a P2P focus room and sync Pomodoro timers with peers via WebRTC.',
    'roadmap':        'Describe a large goal — the AI decomposes it into sequential assignment milestones and injects them instantly.',
  }

  return (
    <div className={styles.view}>

      {/* ── Page heading ─────────────────────────────────────── */}
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Scholastic · Study Shield"
          title="Study Shield."
          subtitle={subtitles[activeTab]}
          size="lg"
        />
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className={styles.tabBar} role="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── AI Study tab ─────────────────────────────────────── */}
      <div className={activeTab === 'ai-study' ? styles.tabPane : styles.tabPaneHidden}>

      {/* Ingestion dock */}
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
          {(session.markdownSummary || session.flashcards.length > 0) && (
            <div className={styles.columns}>

              {/* ── Markdown Summary panel ─────────────────────── */}
              {session.markdownSummary && (
                <section className={styles.summaryPanel}>
                  <header className={styles.panelHeader}>
                    <span className={styles.panelEyebrow}>AI Summary</span>
                    <span className={styles.wordCount}>
                      {session.markdownSummary.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </header>
                  <div
                    className={styles.summaryBody}
                    dangerouslySetInnerHTML={{ __html: summaryHtml }}
                  />
                </section>
              )}

              {/* ── Flashcard Deck panel ────────────────────────── */}
              {session.flashcards.length > 0 && (
                <section className={styles.flashPanel}>
                  <header className={styles.panelHeader}>
                    <span className={styles.panelEyebrow}>Flashcard Deck</span>
                    <span className={styles.wordCount}>{session.flashcards.length} cards</span>
                  </header>
                  <FlashcardDeck flashcards={session.flashcards} />
                </section>
              )}

            </div>
          )}

          {/* ── Practice Test panel ─────────────────────────── */}
          {session.practiceTest && session.practiceTest.length > 0 && (
            <PracticeTestPanel questions={session.practiceTest} />
          )}
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

      </div>{/* end AI Study pane */}

      {/* ── Focus Protocol tab ───────────────────────────────── */}
      <div className={activeTab === 'focus-protocol' ? styles.tabPane : styles.tabPaneHidden}>
        <div className={styles.focusProtocolWrap}>
          <p className={styles.focusCta}>
            Enter a distraction-free cockpit with a full Pomodoro timer, session notes, and recall tools.
          </p>
          <button
            type="button"
            className={styles.enterStudyBtn}
            onClick={enterStudyWorkspace}
          >
            <span aria-hidden="true">[</span>
            Enter Focus Mode
            <span aria-hidden="true">]</span>
          </button>
        </div>
      </div>

      {/* ── Focus Rooms tab ──────────────────────────────────── */}
      <div className={activeTab === 'focus-rooms' ? styles.tabPane : styles.tabPaneHidden}>
        <MultiplayerLobby />
      </div>

      {/* ── Task Roadmap tab ─────────────────────────────────── */}
      <div className={activeTab === 'roadmap' ? styles.tabPane : styles.tabPaneHidden}>
        <div className="anim-fade-in">
          <RoadmapGeneratorButton />
        </div>
      </div>

    </div>
  )
}
