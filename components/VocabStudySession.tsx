'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { db }                                        from '@/lib/db'
import type { VocabCard }                            from '@/types/vocabulary'
import styles                                        from './VocabStudySession.module.css'
import { todayISO, toLocalDateStr } from '@/utils/localDate'
import { scheduleNext, type RecallGrade } from '@/lib/engines/ReviewScheduler'

/* ════════════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════════════ */

const MASTERED_THRESHOLD = 5
const REVIEW_SET_SIZE    = 10

/*
 * How many times the batch is drilled before the session ends.
 *
 * Round 1 teaches (flip through, then quiz). Rounds 2 and 3 are the
 * same locked set of cards in a fresh random order — no new words are
 * pulled in partway through, because the point of a batch is that you
 * leave knowing all of it, not that you saw a lot of it once.
 */
const TOTAL_ROUNDS = 3

/**
 * Which way round the card is asked.
 *
 * `toWord`    — you are shown the meaning and produce the word. Recall.
 * `toMeaning` — you are shown the word and produce the meaning.
 *               Recognition, and much easier.
 *
 * They are not the same skill and a deck is not learnt until both work,
 * which is why this is a switch rather than a preference set once.
 */
export type StudyDirection = 'toWord' | 'toMeaning'

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

/** Phases for study mode:  learn → mc → type → complete
 *  Phases for review mode:         mc → type → complete  */
type Phase = 'loading' | 'empty' | 'learn' | 'mc' | 'type' | 'complete'

interface DailySet {
  date:    string    // YYYY-MM-DD
  cardIds: string[]
  /* The batch size this set was built for. Changing the size has to
     rebuild the set, or today's saved ten would outlive the choice. */
  size?:   number
}

/** Per-card outcome accumulated during a session. */
interface CardOutcome {
  cardId:        string
  mcCorrectFirst: boolean   // got MC right on first attempt
  typeResult:    'exact' | 'close' | 'wrong' | null
}

interface Props {
  deckId:           string
  languageName:     string
  dailyGoal:        number
  /**
   * How many cards this session locks in, if not the daily goal.
   *
   * Deliberately separate: the daily goal is a target for the day and
   * drives the "N due" counts elsewhere; this is how much you want to
   * chew at once. Wanting to sit down and drill 30 has nothing to do
   * with whether the day's target was 20.
   */
  batchSize?:       number
  /** Which way the cards are asked. Defaults to recall. */
  direction?:       StudyDirection
  mode:             'study' | 'review'
  sessionKey?:      number
  filterCardIds?:   string[]    // if set, study only these cards (MC distractors still use full deck)
  sessionNamespace?: string     // suffix for localStorage key — prevents cross-category collision
  onComplete?: () => void
  onRestart?:  () => void
}

/* ════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════ */


function getDailySetKey(deckId: string, mode: 'study' | 'review', namespace?: string): string {
  const ns = namespace ? `_${namespace}` : ''
  return `zenith_daily_${mode}_v2_${deckId.slice(0, 8)}${ns}`
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
  batchSize,
  direction = 'toWord',
  mode,
  filterCardIds,
  sessionNamespace,
  onComplete,
  onRestart,
}: Props) {

  /* ── Core session state ──────────────────────────────────────── */
  const [phase,    setPhase]    = useState<Phase>('loading')
  const [queue,    setQueue]    = useState<VocabCard[]>([])
  const [idx,      setIdx]      = useState(0)
  const [round,    setRound]    = useState(1)

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

      /* Filter to the requested category subset (MC distractors still use full deck via allCardsRef) */
      const filterSet = filterCardIds ? new Set(filterCardIds) : null
      const sessionCards = filterSet
        ? allDeckCards.filter(c => filterSet.has(c.id!))
        : allDeckCards

      if (sessionCards.length === 0) { setPhase('empty'); return }

      const key = getDailySetKey(deckId, mode, sessionNamespace)
      const wanted = Math.max(1, batchSize ?? dailyGoal)
      let savedSet = loadDailySet(key)

      /* A saved set built for a different batch size is stale. */
      if (savedSet && savedSet.size != null && savedSet.size !== wanted) savedSet = null

      /* Validate that saved card IDs still exist within the session subset */
      if (savedSet) {
        const sessionIds = new Set(sessionCards.map(c => c.id!))
        savedSet = {
          ...savedSet,
          cardIds: savedSet.cardIds.filter(id => sessionIds.has(id)),
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
          const mastered = sessionCards.filter(c => c.consecutiveSuccesses >= MASTERED_THRESHOLD)
          if (mastered.length === 0) {
            setPhase('empty'); return
          }
          cardIds = shuffle(mastered).slice(0, Math.min(wanted, REVIEW_SET_SIZE)).map(c => c.id!)
        } else {
          /* Study: non-mastered cards sorted weakest-first */
          const nonMastered = sessionCards
            .filter(c => c.consecutiveSuccesses < MASTERED_THRESHOLD)
            .sort((a, b) => {
              const scoreA = a.easeFactor * 10 + a.consecutiveSuccesses
              const scoreB = b.easeFactor * 10 + b.consecutiveSuccesses
              return scoreA - scoreB
            })
          if (nonMastered.length === 0) {
            setPhase('empty'); return
          }
          /*
           * Pick the weakest, then shuffle them.
           *
           * The sort decides *which* cards you get; it should not also
           * decide the order you meet them in. Left sorted, the batch
           * arrived weakest-first every single time, so the same word
           * was always first and position became a memory cue of its
           * own — you learn the sequence rather than the vocabulary.
           */
          cardIds = shuffle(nonMastered.slice(0, wanted)).map(c => c.id!)
        }
        saveDailySet(key, { date: todayISO(), cardIds, size: wanted })
      }

      /* Build ordered queue from IDs */
      const cardMap = new Map(allDeckCards.map(c => [c.id!, c]))
      const orderedCards = cardIds.map(id => cardMap.get(id)).filter((c): c is VocabCard => c != null)

      if (orderedCards.length === 0) { setPhase('empty'); return }

      setQueue(orderedCards)
      setIdx(0)
      setRound(1)
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
  }, [deckId, mode, dailyGoal, batchSize, filterCardIds, sessionNamespace])

  /* ─────────────────────────────────────────────────────────────
     Rebuild MC options whenever card or phase changes to 'mc'
     ──────────────────────────────────────────────────────────── */
  const currentCard = queue[idx] ?? null

  /*
   * Which side of the card is the question and which is the answer.
   *
   * Everything downstream — the flip card, the distractors, the typed
   * target — reads through these two, so reversing the deck is one
   * switch rather than a parallel set of branches in five places.
   */
  const promptOf = useCallback(
    (c: VocabCard) => (direction === 'toWord' ? c.nativeTranslation : c.foreignWord),
    [direction],
  )
  const answerOf = useCallback(
    (c: VocabCard) => (direction === 'toWord' ? c.foreignWord : c.nativeTranslation),
    [direction],
  )

  /*
   * Recognition rounds skip the typing phase.
   *
   * Asked word-to-meaning, the answer is a whole definition — "Having
   * an irritatingly strong and unpleasant taste or smell" — and nobody
   * is typing that forty times. Multiple choice is the honest test in
   * that direction, so it is graded a shade lower than a typed recall
   * can reach.
   */
  const usesTyping = direction === 'toWord'

  useEffect(() => {
    if (phase !== 'mc' || !currentCard) return

    const correct = answerOf(currentCard)
    const pool = allCardsRef.current
      .map(answerOf)
      .filter(w => w !== correct)

    const distractors = shuffle(pool).slice(0, 3)
    const options     = shuffle([correct, ...distractors])

    setMcOptions(options)
    setMcSelected(null)
    setMcCorrect(null)
    setMcFirstTry(true)
  }, [phase, currentCard, answerOf])

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
    /* One instant for the whole batch, so cards graded together are
       scheduled from the same origin rather than drifting apart. */
    const now = Date.now()

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

      /*
       * Schedule the next appearance.
       *
       * This is the line whose absence made every card permanently due:
       * the mastery numbers above were being written, but nothing ever
       * moved nextReviewTimestamp off its creation value, while three
       * separate surfaces read it to mean "due".
       *
       * The session's own outcome is mapped onto an SM-2 grade — both
       * halves right is a confident pass, one half is a struggle-pass,
       * neither is a failure — and ReviewScheduler owns the arithmetic
       * from there, so vocabulary and problem sets share one engine.
       */
      const grade: RecallGrade =
        mcOk && typeOk ? (outcome.typeResult === 'exact' ? 5 : 4)
        : mcOk || typeOk ? 2
        : 0

      const sched = scheduleNext(
        {
          easeFactor:           ef,
          reviewIntervalDays:   card.reviewIntervalDays ?? 0,
          consecutiveSuccesses: cs,
        },
        grade,
        now,
      )

      await db.vocab_cards.update(cardId, {
        // The mastery streak stays under this component's control — it
        // drives the "mastered" UI and the review-mode demotion above,
        // which are session concepts the scheduler has no opinion on.
        consecutiveSuccesses: cs,
        easeFactor:           sched.easeFactor,
        stabilityFactor:      Math.min(1, cs / MASTERED_THRESHOLD),
        reviewIntervalDays:   sched.reviewIntervalDays,
        nextReviewTimestamp:  sched.nextReviewAt,
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
    const isCorrect = chosen === answerOf(currentCard)

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
        /* Recognition has no typed half. Recording it as 'close' rather
           than 'exact' caps this direction at a grade 4 — right, but a
           weaker signal than having produced the word from nothing. */
        ...(usesTyping ? {} : { typeResult: 'close' as const }),
      })

      setTimeout(() => {
        if (usesTyping) { setPhase('type'); return }
        advanceCardRef.current?.()
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

    const expected = answerOf(currentCard)
    const answer = normalize(typeInput)
    const target = normalize(expected)

    let result: 'exact' | 'close' | 'wrong'
    if (answer === target) {
      result = 'exact'
    } else if (isCloseEnough(typeInput, expected)) {
      result = 'close'
    } else {
      result = 'wrong'
      setWrongWord(expected)
    }

    setTypeResult(result)

    /* Update outcome map */
    const prev = outcomesRef.current.get(currentCard.id!) ?? {
      cardId:         currentCard.id!,
      mcCorrectFirst: false,
      typeResult:     null,
    }
    outcomesRef.current.set(currentCard.id!, { ...prev, typeResult: result })
  }, [phase, currentCard, typeInput, typeResult, answerOf])

  /*
   * Move to the next card, or round, or finish.
   *
   * Held in a ref because two phases end a card: the typing phase in
   * recall, and the multiple-choice phase directly in recognition,
   * where there is no typing step to pass through.
   */
  const advanceCardRef = useRef<(() => void) | null>(null)

  const advanceCard = useCallback(() => {
    const nextIdx = idx + 1
    if (nextIdx < queue.length) {
      setIdx(nextIdx)
      setPhase('mc')
      return
    }

    /*
     * End of a pass over the batch.
     *
     * Rather than finishing here and handing back a fresh set of words,
     * the same cards go round again in a new order. Seeing ten words
     * once is recognition; seeing them three times in three different
     * orders is closer to recall, and it is the reshuffle that does the
     * work — a fixed order lets you ride the sequence instead of
     * knowing each word on its own.
     */
    if (round < TOTAL_ROUNDS) {
      setQueue(q => shuffle(q))
      setIdx(0)
      setRound(r => r + 1)
      /* Each round is graded on its own merits; the last one is what
         gets written, so a word you finally nailed counts as nailed. */
      outcomesRef.current = new Map()
      setMcSelected(null)
      setMcCorrect(null)
      setMcFirstTry(true)
      setTypeInput('')
      setTypeResult(null)
      setWrongWord('')
      setPhase('mc')
      return
    }

    void completeSessionRef.current?.()
  }, [idx, queue.length, round])

  advanceCardRef.current = advanceCard

  const advanceFromType = useCallback(() => {
    if (phase !== 'type' || !currentCard) return
    advanceCard()
  }, [phase, currentCard, advanceCard])

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
  /*
   * Every action in a session has a key, so a whole batch can be run
   * without reaching for the mouse. The only place the hands leave the
   * keyboard is typing the answer, which is the point of that phase.
   *
   * The typing input handles its own Enter and is skipped here. Once an
   * answer is submitted the input unmounts, focus returns to the body,
   * and the result panel's keys become live — which is why the guard
   * below only skips *while* a field is focused rather than for the
   * whole phase.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el  = e.target as HTMLElement
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const k = e.key.toLowerCase()

      if (phase === 'learn') {
        if (e.key === ' ')          { e.preventDefault(); handleLearnFlip() }
        if (e.key === 'Enter')      { e.preventDefault(); handleLearnNext() }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleLearnNext() }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); handleLearnPrev() }
        if (k === 's')              { e.preventDefault(); handleStartQuiz() }
        return
      }

      if (phase === 'mc') {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault()
          handleMCSelectRef.current?.(Number(e.key) - 1)
        }
        return
      }

      if (phase === 'type') {
        /* Only reachable once the input is gone, i.e. an answer is in. */
        if (typeResult === 'exact' || typeResult === 'close') {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceFromType() }
        } else if (typeResult === 'wrong') {
          if (e.key === 'Enter') { e.preventDefault(); handleTypeTryAgain() }
          if (k === 'g')         { e.preventDefault(); handleTypeGotIt() }
        }
        return
      }

      if (phase === 'complete' || phase === 'empty') {
        if (e.key === 'Enter' || k === 'r') { e.preventDefault(); onRestart?.() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, typeResult, handleLearnFlip, handleLearnNext, handleLearnPrev,
      handleStartQuiz, advanceFromType, handleTypeGotIt, handleTypeTryAgain, onRestart])

  /* ─────────────────────────────────────────────────────────────
     Derived values
     ──────────────────────────────────────────────────────────── */
  const total    = queue.length
  const progress = total > 0 ? (idx / total) * 100 : 0

  /* Phase breadcrumb steps */
  const typeStep: Array<{ key: Phase; label: string }> =
    usesTyping ? [{ key: 'type', label: 'Type' }] : []
  const breadcrumbSteps: Array<{ key: Phase; label: string }> =
    mode === 'review'
      ? [{ key: 'mc', label: 'Quiz' }, ...typeStep]
      : [{ key: 'learn', label: 'Learn' }, { key: 'mc', label: 'Quiz' }, ...typeStep]

  /* ════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════ */

  if (phase === 'loading') {
    return <div className={styles.loading}>Loading…</div>
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
        <p className={styles.completeTitle}>Session complete</p>
        <p className={styles.completeSubtitle}>
          {perfectCount} / {totalCount} clean on the final round
        </p>
        {mode === 'study' && (
          <p className={styles.completeNote}>
            Those {totalCount} were drilled {TOTAL_ROUNDS} times in a different
            order each round. Start a new session for the next batch.
          </p>
        )}
        <div className={styles.completeActions}>
          {onRestart && (
            <button className={styles.restartBtn} onClick={onRestart}>
              ↺ New Session <kbd className={styles.kbd}>↵</kbd>
            </button>
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
        {mode === 'study' && (
          <span className={styles.roundBadge} title="The same cards, reshuffled each round">
            Round {round}/{TOTAL_ROUNDS}
          </span>
        )}
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
            /*
             * Deliberately not a focusable control.
             *
             * It used to be a role="button" with its own Enter/Space
             * handler, while the window handler bound the same keys —
             * so Space flipped twice and looked dead, and Enter both
             * flipped and advanced. Clicking it also left the focus
             * ring parked on the card.
             *
             * The keys are global and shown under the card, so one
             * owner is enough: the window handler. This stays a plain
             * surface you can click.
             */
          >
            <div className={styles.flipInner}>
              {/* Front — definition */}
              <div className={`${styles.flipFace} ${styles.flipFront}`}>
                <p className={styles.tapHint}>tap to reveal</p>
                {/* The question side. Which half that is depends on the
                    direction, so learning rehearses the same mapping the
                    quiz will test rather than the reverse of it. */}
                <p className={direction === 'toWord' ? styles.translation : styles.foreignWord}>
                  {promptOf(currentCard)}
                </p>
              </div>
              {/* Back — the answer */}
              <div className={`${styles.flipFace} ${styles.flipBack}`}>
                <p className={direction === 'toWord' ? styles.foreignWord : styles.translation}>
                  {answerOf(currentCard)}
                </p>
                {currentCard.phoneticSpelling && (
                  <p className={styles.phonetic}>/{currentCard.phoneticSpelling}/</p>
                )}
                <hr className={styles.cardDivider} />
                <p className={styles.tapHint}>{promptOf(currentCard)}</p>
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
              Start Quiz <kbd className={styles.kbd}>S</kbd>
            </button>

            <button
              className={styles.learnNavBtn}
              onClick={handleLearnNext}
              aria-label="Next card"
            >
              Next →
            </button>
          </div>

          <p className={styles.keyHint}>
            <kbd className={styles.kbd}>Space</kbd> flip
            <kbd className={styles.kbd}>↵</kbd> next
            <kbd className={styles.kbd}>←</kbd> <kbd className={styles.kbd}>→</kbd> move
            <kbd className={styles.kbd}>S</kbd> start quiz
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MC PHASE
          ════════════════════════════════════════════════════════ */}
      {phase === 'mc' && (
        <div className={styles.mcWrap}>
          {/* Definition prompt */}
          <div className={styles.mcPromptCard}>
            <p className={styles.mcPromptHint}>
              {direction === 'toWord'
                ? 'Which word matches this meaning?'
                : 'What does this word mean?'}
            </p>
            <p className={styles.mcDefinition}>{promptOf(currentCard)}</p>
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

          <p className={styles.keyHint}>
            <kbd className={styles.kbd}>1</kbd><kbd className={styles.kbd}>2</kbd>
            <kbd className={styles.kbd}>3</kbd><kbd className={styles.kbd}>4</kbd> choose
          </p>
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
            <p className={styles.mcDefinition}>{promptOf(currentCard)}</p>
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
                Submit <kbd className={styles.kbd}>↵</kbd>
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
                Next <kbd className={styles.kbd}>↵</kbd>
              </button>
            </div>
          )}

          {/* Result — wrong */}
          {typeResult === 'wrong' && (
            <div className={`${styles.typeResultPanel} ${styles.typeResultWrong}`}>
              <p className={styles.typeWrongLabel}>✗ The word was: <strong>{wrongWord}</strong></p>
              <div className={styles.typeWrongActions}>
                <button className={styles.typeGotItBtn} onClick={handleTypeGotIt}>
                  Got it <kbd className={styles.kbd}>G</kbd>
                </button>
                <button className={styles.typeTryAgainBtn} onClick={handleTypeTryAgain}>
                  Try again <kbd className={styles.kbd}>↵</kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
