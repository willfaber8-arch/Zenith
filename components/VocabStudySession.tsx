'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { db }                                        from '@/lib/db'
import type { VocabCard }                            from '@/types/vocabulary'
import styles                                        from './VocabStudySession.module.css'

/* ════════════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════════════ */

const MASTERED_THRESHOLD = 5
const REVIEW_SET_SIZE    = 10

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

/** Phases for study mode:  learn → mc → type → complete
 *  Phases for review mode:         mc → type → complete  */
type Phase = 'loading' | 'empty' | 'learn' | 'mc' | 'type' | 'complete'

interface DailySet {
  date:    string    // YYYY-MM-DD
  cardIds: string[]
}

/** Per-card outcome accumulated during a session. */
interface CardOutcome {
  cardId:        string
  mcCorrectFirst: boolean   // got MC right on first attempt
  typeResult:    'exact' | 'close' | 'wrong' | null
}

interface Props {
  deckId:      string
  languageName: string
  dailyGoal:   number
  mode:        'study' | 'review'
  sessionKey?: number
  onComplete?: () => void
  onRestart?:  () => void
}

/* ════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════ */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDailySetKey(deckId: string, mode: 'study' | 'review'): string {
  return `zenith_daily_${mode}_v2_${deckId.slice(0, 8)}`
}

function loadDailySet(key: string): DailySet | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailySet
    return parsed.date === todayISO() ? parsed : null
  } catch { return null }
}

function saveDailySet(key: string, set: DailySet): void {
  try { localStorage.setItem(key, JSON.stringify(set)) } catch { /* noop */ }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Levenshtein distance for close-enough type matching. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Normalize for loose comparison (lowercase, collapse whitespace). */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True if the typed answer is close enough (within 2 edits or within 20% of length). */
function isCloseEnough(typed: string, target: string): boolean {
  const t = normalize(typed)
  const g = normalize(target)
  if (t === g) return true
  const maxDist = Math.max(2, Math.floor(g.length * 0.2))
  return levenshtein(t, g) <= maxDist
}

/* ════════════════════════════════════════════════════════════════
   VocabStudySession
   ════════════════════════════════════════════════════════════════ */

export default function VocabStudySession({
  deckId,
  languageName,
  dailyGoal,
  mode,
  onComplete,
  onRestart,
}: Props) {

  /* ── Core session state ──────────────────────────────────────── */
  const [phase,    setPhase]    = useState<Phase>('loading')
  const [queue,    setQueue]    = useState<VocabCard[]>([])
  const [idx,      setIdx]      = useState(0)

  /* ── Learn phase ─────────────────────────────────────────────── */
  const [learnFlipped, setLearnFlipped] = useState(false)

  /* ── MC phase ────────────────────────────────────────────────── */
  const [mcOptions,    setMcOptions]    = useState<string[]>([])
  const [mcSelected,   setMcSelected]   = useState<number | null>(null)
  const [mcCorrect,    setMcCorrect]    = useState<boolean | null>(null)
  const [mcFirstTry,   setMcFirstTry]   = useState(true)   // reset per card

  /* ── Type phase ──────────────────────────────────────────────── */
  const [typeInput,    setTypeInput]    = useState('')
  const [typeResult,   setTypeResult]   = useState<'exact' | 'close' | 'wrong' | null>(null)
  const [wrongWord,    setWrongWord]    = useState('')
  const typeRef = useRef<HTMLInputElement>(null)

  /* ── Re-queue tracking (wrong MC cards go back) ──────────────── */
  const requeuedRef = useRef<Set<string>>(new Set())

  /* ── Outcomes for mastery update at session end ──────────────── */
  const outcomesRef = useRef<Map<string, CardOutcome>>(new Map())

  /* ── All cards in this deck (used for MC distractors) ───────── */
  const allCardsRef = useRef<VocabCard[]>([])

  /* ─────────────────────────────────────────────────────────────
     Load daily set on mount / when deckId or mode changes
     ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    outcomesRef.current = new Map()
    requeuedRef.current = new Set()

    const run = async () => {
      const allDeckCards = await db.vocab_cards
        .where('deckId').equals(deckId)
        .toArray()
      if (cancelled) return

      allCardsRef.current = allDeckCards

      if (allDeckCards.length === 0) { setPhase('empty'); return }

      const key = getDailySetKey(deckId, mode)
      let savedSet = loadDailySet(key)

      /* Validate that saved card IDs still exist */
      if (savedSet) {
        const existingIds = new Set(allDeckCards.map(c => c.id!))
        savedSet = {
          ...savedSet,
          cardIds: savedSet.cardIds.filter(id => existingIds.has(id)),
        }
        if (savedSet.cardIds.length === 0) savedSet = null
      }

      let cardIds: string[]

      if (savedSet) {
        cardIds = savedSet.cardIds
      } else {
        /* Build today's fresh set */
        if (mode === 'review') {
          /* Review: mastered cards only, random shuffle, cap at REVIEW_SET_SIZE */
          const mastered = allDeckCards.filter(c => c.consecutiveSuccesses >= MASTERED_THRESHOLD)
          if (mastered.length === 0) {
            setPhase('empty'); return
          }
          cardIds = shuffle(mastered).slice(0, REVIEW_SET_SIZE).map(c => c.id!)
        } else {
          /* Study: non-mastered cards sorted weakest-first */
          const nonMastered = allDeckCards
            .filter(c => c.consecutiveSuccesses < MASTERED_THRESHOLD)
            .sort((a, b) => {
              const scoreA = a.easeFactor * 10 + a.consecutiveSuccesses
              const scoreB = b.easeFactor * 10 + b.consecutiveSuccesses
              return scoreA - scoreB
            })
          if (nonMastered.length === 0) {
            setPhase('empty'); return
          }
          cardIds = nonMastered.slice(0, dailyGoal).map(c => c.id!)
        }
        saveDailySet(key, { date: todayISO(), cardIds })
      }

      /* Build ordered queue from IDs */
      const cardMap = new Map(allDeckCards.map(c => [c.id!, c]))
      const orderedCards = cardIds.map(id => cardMap.get(id)).filter((c): c is VocabCard => c != null)

      if (orderedCards.length === 0) { setPhase('empty'); return }

      setQueue(orderedCards)
      setIdx(0)
      setLearnFlipped(false)
      setMcOptions([])
      setMcSelected(null)
      setMcCorrect(null)
      setMcFirstTry(true)
      setTypeInput('')
      setTypeResult(null)
      setWrongWord('')
      setPhase(mode === 'review' ? 'mc' : 'learn')
    }

    void run()
    return () => { cancelled = true }
  }, [deckId, mode, dailyGoal])

  /* ─────────────────────────────────────────────────────────────
     Rebuild MC options whenever card or phase changes to 'mc'
     ──────────────────────────────────────────────────────────── */
  const currentCard = queue[idx] ?? null

  useEffect(() => {
    if (phase !== 'mc' || !currentCard) return

    const allWords = allCardsRef.current
      .map(c => c.foreignWord)
      .filter(w => w !== currentCard.foreignWord)

    const distractors = shuffle(allWords).slice(0, 3)
    const options     = shuffle([currentCard.foreignWord, ...distractors])

    setMcOptions(options)
    setMcSelected(null)
    setMcCorrect(null)
    setMcFirstTry(true)
  }, [phase, currentCard])

  /* ─────────────────────────────────────────────────────────────
     Auto-focus type input when entering type phase
     ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase === 'type') {
      setTypeInput('')
      setTypeResult(null)
      setWrongWord('')
      // slight delay so input is mounted
      setTimeout(() => typeRef.current?.focus(), 50)
    }
  }, [phase, idx])

  /* ─────────────────────────────────────────────────────────────
     Session complete — write mastery updates to IDB
     ──────────────────────────────────────────────────────────── */
  const completeSessionRef = useRef<(() => Promise<void>) | null>(null)

  completeSessionRef.current = async () => {
    /* Write mastery updates */
    for (const [cardId, outcome] of outcomesRef.current.entries()) {
      const card = await db.vocab_cards.get(cardId)
      if (!card) continue

      let cs = card.consecutiveSuccesses
      let ef = card.easeFactor

      const mcOk   = outcome.mcCorrectFirst
      const typeOk = outcome.typeResult === 'exact' || outcome.typeResult === 'close'

      if (mcOk && typeOk) {
        if (outcome.typeResult === 'exact') {
          cs = cs + 1
          ef = Math.min(4.0, ef + 0.1)
        } else {
          cs = cs + 1
          // ef unchanged for close-enough
        }
      } else if (mcOk && !typeOk) {
        cs = Math.max(0, cs - 1)
        ef = Math.max(1.3, ef - 0.1)
      } else if (!mcOk && typeOk) {
        cs = Math.max(0, cs - 1)
        ef = Math.max(1.3, ef - 0.1)
      } else {
        cs = Math.max(0, cs - 2)
        ef = Math.max(1.3, ef - 0.2)
      }

      /* Review mode demotion: ensure failed mastered card drops below threshold */
      if (mode === 'review' && !typeOk && cs >= MASTERED_THRESHOLD) {
        cs = MASTERED_THRESHOLD - 1
      }

      await db.vocab_cards.update(cardId, {
        consecutiveSuccesses: cs,
        easeFactor:           ef,
        stabilityFactor:      Math.min(1, cs / MASTERED_THRESHOLD),
      })
    }

    setPhase('complete')
    onComplete?.()
  }

  /* ─────────────────────────────────────────────────────────────
     Learn phase handlers
     ──────────────────────────────────────────────────────────── */
  const handleLearnFlip = useCallback(() => {
    if (phase === 'learn') setLearnFlipped(f => !f)
  }, [phase])

  const handleLearnNext = useCallback(() => {
    if (phase !== 'learn' || !currentCard) return
    setLearnFlipped(false)
    const nextIdx = idx + 1
    if (nextIdx >= queue.length) {
      /* All cards seen in learn — start MC from the top */
      setIdx(0)
      setPhase('mc')
    } else {
      setIdx(nextIdx)
    }
  }, [phase, currentCard, idx, queue.length])

  const handleLearnPrev = useCallback(() => {
    if (phase !== 'learn' || idx === 0) return
    setLearnFlipped(false)
    setIdx(i => i - 1)
  }, [phase, idx])

  const handleStartQuiz = useCallback(() => {
    if (phase !== 'learn') return
    setIdx(0)
    setPhase('mc')
  }, [phase])

  /* ─────────────────────────────────────────────────────────────
     MC phase handlers
     ──────────────────────────────────────────────────────────── */

  /* Store in ref so keyboard handler doesn't get stale closures */
  const handleMCSelectRef = useRef<((optionIdx: number) => void) | null>(null)

  handleMCSelectRef.current = (optionIdx: number) => {
    if (phase !== 'mc' || mcSelected !== null || !currentCard) return

    const chosen    = mcOptions[optionIdx]
    const isCorrect = chosen === currentCard.foreignWord

    setMcSelected(optionIdx)
    setMcCorrect(isCorrect)

    if (isCorrect) {
      /* Record MC outcome */
      const prev = outcomesRef.current.get(currentCard.id!) ?? {
        cardId:         currentCard.id!,
        mcCorrectFirst: false,
        typeResult:     null,
      }
      outcomesRef.current.set(currentCard.id!, {
        ...prev,
        mcCorrectFirst: mcFirstTry,
      })

      /* Advance to type phase after short delay */
      setTimeout(() => {
        setPhase('type')
      }, 520)
    } else {
      /* Wrong — mark firstTry false, allow retry */
      setMcFirstTry(false)
      if (!outcomesRef.current.has(currentCard.id!)) {
        outcomesRef.current.set(currentCard.id!, {
          cardId:         currentCard.id!,
          mcCorrectFirst: false,
          typeResult:     null,
        })
      } else {
        const prev = outcomesRef.current.get(currentCard.id!)!
        outcomesRef.current.set(currentCard.id!, { ...prev, mcCorrectFirst: false })
      }

      /* Allow retry after showing wrong feedback */
      setTimeout(() => {
        setMcSelected(null)
        setMcCorrect(null)
      }, 900)
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Type phase handlers
     ──────────────────────────────────────────────────────────── */
  const handleTypeSubmit = useCallback(() => {
    if (phase !== 'type' || !currentCard || typeResult !== null) return

    const answer = normalize(typeInput)
    const target = normalize(currentCard.foreignWord)

    let result: 'exact' | 'close' | 'wrong'
    if (answer === target) {
      result = 'exact'
    } else if (isCloseEnough(typeInput, currentCard.foreignWord)) {
      result = 'close'
    } else {
      result = 'wrong'
      setWrongWord(currentCard.foreignWord)
    }

    setTypeResult(result)

    /* Update outcome map */
    const prev = outcomesRef.current.get(currentCard.id!) ?? {
      cardId:         currentCard.id!,
      mcCorrectFirst: false,
      typeResult:     null,
    }
    outcomesRef.current.set(currentCard.id!, { ...prev, typeResult: result })
  }, [phase, currentCard, typeInput, typeResult])

  const advanceFromType = useCallback(() => {
    if (phase !== 'type' || !currentCard) return

    const nextIdx = idx + 1
    if (nextIdx >= queue.length) {
      void completeSessionRef.current?.()
    } else {
      setIdx(nextIdx)
      setPhase('mc')
    }
  }, [phase, currentCard, idx, queue.length])

  const handleTypeGotIt = useCallback(() => {
    if (phase !== 'type' || !currentCard) return

    /* Override typeResult to 'close' (user says "close enough") */
    const prev = outcomesRef.current.get(currentCard.id!) ?? {
      cardId:         currentCard.id!,
      mcCorrectFirst: false,
      typeResult:     null,
    }
    outcomesRef.current.set(currentCard.id!, { ...prev, typeResult: 'close' })

    advanceFromType()
  }, [phase, currentCard, advanceFromType])

  const handleTypeTryAgain = useCallback(() => {
    setTypeResult(null)
    setTypeInput('')
    setWrongWord('')
    setTimeout(() => typeRef.current?.focus(), 30)
  }, [])

  /* ─────────────────────────────────────────────────────────────
     Keyboard shortcuts
     ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (phase === 'learn') {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleLearnFlip() }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleLearnNext() }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); handleLearnPrev() }
      }

      if (phase === 'mc') {
        if (['1','2','3','4'].includes(e.key)) {
          e.preventDefault()
          handleMCSelectRef.current?.(Number(e.key) - 1)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handleLearnFlip, handleLearnNext, handleLearnPrev])

  /* ─────────────────────────────────────────────────────────────
     Derived values
     ──────────────────────────────────────────────────────────── */
  const total    = queue.length
  const progress = total > 0 ? (idx / total) * 100 : 0

  /* Phase breadcrumb steps */
  const breadcrumbSteps: Array<{ key: Phase; label: string }> =
    mode === 'review'
      ? [{ key: 'mc', label: 'Quiz' }, { key: 'type', label: 'Type' }]
      : [{ key: 'learn', label: 'Learn' }, { key: 'mc', label: 'Quiz' }, { key: 'type', label: 'Type' }]

  /* ════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════ */

  if (phase === 'loading') {
    return <div className={styles.loading}>[ LOADING SESSION… ]</div>
  }

  if (phase === 'empty') {
    const emptyMsg = mode === 'review'
      ? 'No mastered cards yet. Keep studying to unlock review mode.'
      : 'No cards to study today. Add more cards or come back tomorrow.'

    return (
      <div className={styles.emptySession}>
        <span className={styles.emptyGlyph}>◇</span>
        <p className={styles.emptyText}>{emptyMsg}</p>
        {onRestart && (
          <button className={styles.restartBtn} onClick={onRestart}>↺ Try Again</button>
        )}
      </div>
    )
  }

  if (phase === 'complete') {
    const outcomes    = Array.from(outcomesRef.current.values())
    const perfectCount = outcomes.filter(o => o.mcCorrectFirst && o.typeResult === 'exact').length
    const totalCount   = outcomes.length

    return (
      <div className={styles.completeCard}>
        <span className={styles.completeGlyph}>◇</span>
        <p className={styles.completeTitle}>[ SESSION COMPLETE ]</p>
        <p className={styles.completeSubtitle}>
          {perfectCount} / {totalCount} cards mastered this round
        </p>
        <div className={styles.completeActions}>
          {onRestart && (
            <button className={styles.restartBtn} onClick={onRestart}>↺ New Session</button>
          )}
        </div>
      </div>
    )
  }

  if (!currentCard) return null

  return (
    <div className={styles.session}>

      {/* ── Breadcrumb ────────────────────────────────────────── */}
      <div className={styles.breadcrumb}>
        {breadcrumbSteps.map((step, i) => (
          <span
            key={step.key}
            className={`${styles.breadcrumbStep} ${phase === step.key ? styles.breadcrumbActive : ''}`}
          >
            {i > 0 && <span className={styles.breadcrumbSep}>›</span>}
            {step.label}
          </span>
        ))}
      </div>

      {/* ── Progress strip ────────────────────────────────────── */}
      <div className={styles.progressStrip}>
        <span className={styles.cardCounter}>
          {idx + 1} <span className={styles.counterOf}>of</span> {total}
        </span>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.langBadge}>{languageName}</span>
      </div>

      {/* ════════════════════════════════════════════════════════
          LEARN PHASE
          ════════════════════════════════════════════════════════ */}
      {phase === 'learn' && (
        <div className={styles.learnWrap}>
          <div
            className={`${styles.flipContainer} ${learnFlipped ? styles.flipContainerFlipped : ''}`}
            onClick={handleLearnFlip}
            role="button"
            tabIndex={0}
            aria-label={learnFlipped ? `Answer: ${currentCard.nativeTranslation}` : 'Click to reveal translation'}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLearnFlip() } }}
          >
            <div className={styles.flipInner}>
              {/* Front — definition */}
              <div className={`${styles.flipFace} ${styles.flipFront}`}>
                <p className={styles.tapHint}>tap to reveal</p>
                <p className={styles.foreignWord}>{currentCard.foreignWord}</p>
              </div>
              {/* Back — translation */}
              <div className={`${styles.flipFace} ${styles.flipBack}`}>
                <p className={styles.translation}>{currentCard.nativeTranslation}</p>
                {currentCard.phoneticSpelling && (
                  <p className={styles.phonetic}>/{currentCard.phoneticSpelling}/</p>
                )}
                <hr className={styles.cardDivider} />
                <p className={styles.tapHint}>{currentCard.foreignWord}</p>
              </div>
            </div>
          </div>

          {/* Navigation row */}
          <div className={styles.learnNav}>
            <button
              className={styles.learnNavBtn}
              onClick={handleLearnPrev}
              disabled={idx === 0}
              aria-label="Previous card"
            >
              ← Prev
            </button>

            <button
              className={`${styles.startQuizBtn}`}
              onClick={handleStartQuiz}
            >
              Start Quiz →
            </button>

            <button
              className={styles.learnNavBtn}
              onClick={handleLearnNext}
              aria-label="Next card"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MC PHASE
          ════════════════════════════════════════════════════════ */}
      {phase === 'mc' && (
        <div className={styles.mcWrap}>
          {/* Definition prompt */}
          <div className={styles.mcPromptCard}>
            <p className={styles.mcPromptHint}>Which word matches this definition?</p>
            <p className={styles.mcDefinition}>{currentCard.nativeTranslation}</p>
            {currentCard.phoneticSpelling && (
              <p className={styles.mcPhonetic}>/{currentCard.phoneticSpelling}/</p>
            )}
          </div>

          {/* MC options */}
          <div className={styles.mcOptions}>
            {mcOptions.map((option, i) => {
              let optClass = styles.mcOption
              if (mcSelected === i) {
                optClass += mcCorrect ? ` ${styles.mcOptionCorrect}` : ` ${styles.mcOptionWrong}`
              }
              return (
                <button
                  key={option}
                  className={optClass}
                  onClick={() => handleMCSelectRef.current?.(i)}
                  disabled={mcSelected !== null}
                  aria-label={`Option ${i + 1}: ${option}`}
                >
                  <span className={styles.mcOptionNum}>{i + 1}</span>
                  <span className={styles.mcOptionText}>{option}</span>
                </button>
              )
            })}
          </div>

          <p className={styles.mcKeyHint}>Press 1–4 to select</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TYPE PHASE
          ════════════════════════════════════════════════════════ */}
      {phase === 'type' && (
        <div className={styles.typeWrap}>
          {/* Definition prompt */}
          <div className={styles.typePromptCard}>
            <p className={styles.mcPromptHint}>Type the word from memory</p>
            <p className={styles.mcDefinition}>{currentCard.nativeTranslation}</p>
            {currentCard.phoneticSpelling && (
              <p className={styles.mcPhonetic}>/{currentCard.phoneticSpelling}/</p>
            )}
          </div>

          {/* Input area (hidden when result is shown) */}
          {typeResult === null && (
            <div className={styles.typeInputWrap}>
              <input
                ref={typeRef}
                className={styles.typeInput}
                type="text"
                value={typeInput}
                onChange={e => setTypeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleTypeSubmit() } }}
                placeholder="Type the word…"
                autoComplete="off"
                spellCheck={false}
                aria-label="Type your answer"
              />
              <button
                className={styles.typeSubmitBtn}
                onClick={handleTypeSubmit}
                disabled={typeInput.trim().length === 0}
              >
                Submit →
              </button>
            </div>
          )}

          {/* Result — exact or close */}
          {(typeResult === 'exact' || typeResult === 'close') && (
            <div className={`${styles.typeResultPanel} ${styles.typeResultCorrect}`}>
              <span className={styles.typeResultIcon}>✓</span>
              <span className={styles.typeResultText}>
                {typeResult === 'exact' ? 'Correct!' : 'Close enough!'}
              </span>
              <button className={styles.typeNextBtn} onClick={advanceFromType}>
                Next →
              </button>
            </div>
          )}

          {/* Result — wrong */}
          {typeResult === 'wrong' && (
            <div className={`${styles.typeResultPanel} ${styles.typeResultWrong}`}>
              <p className={styles.typeWrongLabel}>✗ The word was: <strong>{wrongWord}</strong></p>
              <div className={styles.typeWrongActions}>
                <button className={styles.typeGotItBtn} onClick={handleTypeGotIt}>
                  Got it (close enough)
                </button>
                <button className={styles.typeTryAgainBtn} onClick={handleTypeTryAgain}>
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
