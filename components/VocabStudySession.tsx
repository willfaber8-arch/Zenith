'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { db }                                        from '@/lib/db'
import type { VocabCard }                            from '@/types/vocabulary'
import styles                                        from './VocabStudySession.module.css'
import { todayISO, toLocalDateStr } from '@/utils/localDate'
import { scheduleNext, type RecallGrade } from '@/lib/engines/ReviewScheduler'
import {
  buildPlan, pickDistractors, requeueIndex, gradeFor, isShelved, shelfUntil,
  ACTIVITY_LABEL, type StudyActivity,
} from '@/lib/engines/studyPlan'

/* ════════════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════════════ */

const MASTERED_THRESHOLD = 5
const REVIEW_SET_SIZE    = 10

/*
 * A session is one activity per round over the whole batch.
 *
 * Three activities means three passes at the same locked set of cards,
 * each reshuffled and each harder than the last: look at them,
 * recognise them, then produce them from nothing. Switching an activity
 * off removes its round, so "just typing" is a real option rather than
 * something to sit through two easier rounds to reach.
 */

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
export type { StudyActivity }

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
  /** Which activities to run, one per round. */
  activities?:      StudyActivity[]
  mode:             'study' | 'review'
  sessionKey?:      number
  filterCardIds?:   string[]    // if set, study only these cards (MC distractors still use full deck)
  sessionNamespace?: string     // suffix for localStorage key — prevents cross-category collision
  /**
   * True when this session is mounted but not on screen.
   *
   * Vocab Builder keeps both of its outer tabs mounted so switching
   * between them does not throw away where you were. That means two
   * sessions exist at once and only one of them is visible — and a
   * session that binds window-level shortcuts does not stop being
   * bound just because its pane is `display: none`. Left unguarded the
   * hidden one answers Space, Enter and the arrow keys alongside the
   * visible one, calling preventDefault on both, so the card you are
   * looking at flips twice or not at all.
   *
   * It also cannot take the caret: focus() is a no-op on an element
   * inside a hidden subtree, so the typing round's retry loop would
   * spin for twenty frames and land nowhere.
   */
  paused?:          boolean
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

/**
 * Throw away today's saved batch so the next session draws a new one.
 *
 * The batch is saved per day so that reloading mid-session resumes
 * where you were. That is right for a refresh and wrong for "New
 * Session", which used to remount the component and reload the very
 * same ten cards — the restart looked like it had done nothing.
 */
export function clearDailySet(
  deckId: string,
  mode: 'study' | 'review',
  namespace?: string,
): void {
  try { localStorage.removeItem(getDailySetKey(deckId, mode, namespace)) } catch { /* noop */ }
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
  activities,
  mode,
  filterCardIds,
  sessionNamespace,
  paused = false,
  onComplete,
  onRestart,
}: Props) {

  /* ── Core session state ──────────────────────────────────────── */
  const [phase,    setPhase]    = useState<Phase>('loading')
  const [queue,    setQueue]    = useState<VocabCard[]>([])
  const [idx,      setIdx]      = useState(0)
  const [round,    setRound]    = useState(1)
  const [shelvedCount, setShelvedCount] = useState(0)

  /* The ordered activities this session will run, one per round. */
  const plan = useMemo(
    () => buildPlan(activities ?? ['learn', 'mc', 'type']),
    [activities],
  )
  /*
   * The plan the session will actually run.
   *
   * Two things are removed rather than offered and then broken:
   * review mode is a re-test, so it has no first-look round; and asked
   * word-to-meaning the answer is a whole definition, which nobody
   * types forty times, so the typing round comes off in that direction.
   *
   * Memoised, and never empty. An unmemoised fallback array here was a
   * new object every render, which would have re-fired the loading
   * effect that depends on it — a reload loop for anyone who picked
   * review mode with only Learn switched on.
   */
  const roundPlan = useMemo<StudyActivity[]>(() => {
    let out = plan
    if (mode === 'review')          out = out.filter(a => a !== 'learn')
    if (direction === 'toMeaning')  out = out.filter(a => a !== 'type')
    if (out.length === 0)           out = direction === 'toMeaning' ? ['mc'] : ['type']
    return out
  }, [plan, mode, direction])
  const totalRounds = roundPlan.length

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
            /* Cards you said you know sit out until their shelf expires. */
            .filter(c => !isShelved(c))
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
      setPhase(roundPlan[0])
    }

    void run()
    return () => { cancelled = true }
  }, [deckId, mode, dailyGoal, batchSize, filterCardIds, sessionNamespace, roundPlan])

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
    const pool = allCardsRef.current.map(answerOf)

    /* Near-miss options, not random ones — see pickDistractors. Random
       fillers turn this into a process of elimination you can pass
       without knowing the word, which is the whole complaint. */
    const distractors = pickDistractors(correct, pool, 3)
    const options     = shuffle([correct, ...distractors])

    setMcOptions(options)
    setMcSelected(null)
    setMcCorrect(null)
    setMcFirstTry(true)
  }, [phase, currentCard, answerOf])

  /* ─────────────────────────────────────────────────────────────
     Auto-focus type input when entering type phase
     ──────────────────────────────────────────────────────────── */
  /*
   * Put the caret in the box when a typing card comes up.
   *
   * A single timeout was not enough. When typing is the *first* round
   * the input mounts while its tab pane is still hidden, and neither
   * `autoFocus` nor a one-shot focus() does anything to an element that
   * is not being rendered — so the first thing you typed went to the
   * button that opened the deck. Retrying over a few frames covers the
   * gap and stops as soon as the caret lands.
   */
  useEffect(() => {
    if (phase !== 'type' || paused) return
    setTypeInput('')
    setTypeResult(null)
    setWrongWord('')

    let frame = 0
    let raf = 0
    const tryFocus = () => {
      const el = typeRef.current
      if (el && document.activeElement === el) return
      el?.focus()
      if (frame++ < 20 && document.activeElement !== typeRef.current) {
        raf = requestAnimationFrame(tryFocus)
      }
    }
    raf = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(raf)
  }, [phase, idx, paused])

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

      /*
       * What was actually asked decides what can be concluded.
       *
       * A session that only flipped through cards asked no question, so
       * there is no evidence to move a schedule with — gradeFor returns
       * null and the card is left exactly as it was. Writing a low
       * grade for a browse would let looking at your cards quietly
       * damage them.
       */
      const grade = gradeFor(
        { mcCorrectFirst: outcome.mcCorrectFirst, typeResult: outcome.typeResult },
        roundPlan,
      )
      if (grade === null) continue

      let cs = card.consecutiveSuccesses
      let ef = card.easeFactor

      const mcOk   = outcome.mcCorrectFirst
      const typeOk = outcome.typeResult === 'exact' || outcome.typeResult === 'close'

      if (grade >= 4) {
        cs = cs + 1
        if (grade === 5) ef = Math.min(4.0, ef + 0.1)
      } else if (grade === 2) {
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
      const sched = scheduleNext(
        {
          easeFactor:           ef,
          reviewIntervalDays:   card.reviewIntervalDays ?? 0,
          consecutiveSuccesses: cs,
        },
        grade as RecallGrade,
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
      /* End of the look-through: whatever the plan says comes next.
         This used to hardcode the quiz, which skipped straight past a
         plan that had no quiz round in it. */
      advanceCardRef.current?.()
    } else {
      setIdx(nextIdx)
    }
  }, [phase, currentCard, idx, queue.length])

  const handleLearnPrev = useCallback(() => {
    if (phase !== 'learn' || idx === 0) return
    setLearnFlipped(false)
    setIdx(i => i - 1)
  }, [phase, idx])

  /*
   * "I know this one."
   *
   * Takes the card out of rotation for a week and out of this session
   * immediately. Distinct from being scheduled far ahead: this is a
   * deliberate set-aside, and it expires on its own so a word you were
   * over-confident about finds its way back.
   *
   * Available in every round that shows you a card, not just the
   * look-through. Recognising a word you have mastered is most likely
   * to happen the moment it is put to you as a question — and a
   * session built out of typing alone has no look-through to reach.
   */
  const handleKnowIt = useCallback(() => {
    if (!currentCard) return
    if (phase !== 'learn' && phase !== 'mc' && phase !== 'type') return
    const id = currentCard.id!
    void db.vocab_cards.update(id, { shelvedUntil: shelfUntil() })
    outcomesRef.current.delete(id)

    setQueue(q => {
      const next = q.filter(c => c.id !== id)
      if (next.length === 0) return q      // never empty the session
      setIdx(i => Math.min(i, next.length - 1))
      return next
    })
    setLearnFlipped(false)
    /* The next card slides into the same slot, so anything the old one
       left on screen has to go with it. */
    setTypeInput('')
    setTypeResult(null)
    setWrongWord('')
    setShelvedCount(n => n + 1)
  }, [phase, currentCard])

  /* Skip the rest of the look-through and go to the next round. */
  const handleStartQuiz = useCallback(() => {
    if (phase !== 'learn' || totalRounds < 2) return
    setQueue(q => shuffle(q))
    setIdx(0)
    setRound(r => r + 1)
    requeuedRef.current = new Set()
    setLearnFlipped(false)
    setPhase(roundPlan[round])
  }, [phase, totalRounds, round, roundPlan])

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

      /* It also comes back a few cards later in this same round. */
      requeueRef.current?.(currentCard)

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
      requeueRef.current?.(currentCard)
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
      setPhase(roundPlan[round - 1])
      return
    }

    /*
     * End of a pass over the batch.
     *
     * The next round is the next activity, over the same cards in a new
     * order. Nothing new is pulled in partway through: the point of a
     * batch is that you leave knowing all of it, not that you saw a lot
     * of it once. The reshuffle matters — a fixed order lets you ride
     * the sequence instead of knowing each word on its own.
     */
    if (round < totalRounds) {
      setQueue(q => shuffle(q))
      setIdx(0)
      setRound(r => r + 1)
      requeuedRef.current = new Set()
      setMcSelected(null)
      setMcCorrect(null)
      setMcFirstTry(true)
      setTypeInput('')
      setTypeResult(null)
      setWrongWord('')
      setLearnFlipped(false)
      setPhase(roundPlan[round])
      return
    }

    void completeSessionRef.current?.()
  }, [idx, queue.length, round, roundPlan, totalRounds])

  advanceCardRef.current = advanceCard

  const advanceFromType = useCallback(() => {
    if (phase !== 'type' || !currentCard) return
    advanceCard()
  }, [phase, currentCard, advanceCard])

  /*
   * Bring a missed card back a few later in this same round.
   *
   * Not immediately — answering the question you were just shown the
   * answer to tests nothing — and not next round, which is too long to
   * rescue it. See requeueIndex.
   */
  const requeueRef = useRef<((card: VocabCard) => void) | null>(null)
  requeueRef.current = (card: VocabCard) => {
    if (requeuedRef.current.has(card.id!)) return   // once per round
    requeuedRef.current.add(card.id!)
    setQueue(q => {
      const next = [...q]
      next.splice(requeueIndex(idx, next.length), 0, card)
      return next
    })
  }

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
    if (paused) return
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
        if (k === 'k')              { e.preventDefault(); handleKnowIt() }
        return
      }

      if (phase === 'mc') {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault()
          handleMCSelectRef.current?.(Number(e.key) - 1)
        }
        /* Only before an answer is locked in — afterwards the card has
           already been graded and setting it aside would discard that. */
        if (k === 'k' && mcSelected === null) { e.preventDefault(); handleKnowIt() }
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
  }, [paused, phase, typeResult, mcSelected, handleLearnFlip, handleLearnNext, handleLearnPrev,
      handleStartQuiz, handleKnowIt, advanceFromType, handleTypeGotIt,
      handleTypeTryAgain, onRestart])

  /* ─────────────────────────────────────────────────────────────
     Derived values
     ──────────────────────────────────────────────────────────── */
  const total    = queue.length
  const progress = total > 0 ? (idx / total) * 100 : 0

  /* Phase breadcrumb steps */
  /* The plan is the breadcrumb — what you switched on is what shows. */
  const breadcrumbSteps: Array<{ key: Phase; label: string }> = roundPlan
    .filter(a => a !== 'type' || usesTyping)
    .map(a => ({ key: a as Phase, label: ACTIVITY_LABEL[a] }))

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
        <p className={styles.completeNote}>
          {totalRounds > 1
            ? `Those ${totalCount} went through ${roundPlan.map(a => ACTIVITY_LABEL[a].toLowerCase()).join(', then ')}, reshuffled each time.`
            : `${totalCount} cards, one pass.`}
          {' '}Start a new session for the next batch.
        </p>
        {shelvedCount > 0 && (
          <p className={styles.completeNote}>
            {shelvedCount} set aside for a week. They come back on their own.
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
        {totalRounds > 1 && (
          <span className={styles.roundBadge}
                title="The same cards, reshuffled, one activity per round">
            {ACTIVITY_LABEL[roundPlan[round - 1]]} · {round}/{totalRounds}
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
              className={styles.knowItBtn}
              onClick={handleKnowIt}
              title="Set this one aside for a week"
            >
              Know it <kbd className={styles.kbd}>K</kbd>
            </button>

            <button
              className={`${styles.startQuizBtn}`}
              onClick={handleStartQuiz}
            >
              {totalRounds > 1 ? 'Start Quiz' : 'Start'} <kbd className={styles.kbd}>S</kbd>
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
            <kbd className={styles.kbd}>S</kbd> start
            <kbd className={styles.kbd}>K</kbd> know it
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

          <div className={styles.mcFooter}>
            <p className={styles.keyHint}>
              <kbd className={styles.kbd}>1</kbd><kbd className={styles.kbd}>2</kbd>
              <kbd className={styles.kbd}>3</kbd><kbd className={styles.kbd}>4</kbd> choose
            </p>
            {mcSelected === null && (
              <button
                className={styles.knowItBtn}
                onClick={handleKnowIt}
                title="Set this one aside for a week"
              >
                Know it <kbd className={styles.kbd}>K</kbd>
              </button>
            )}
          </div>
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
                /*
                 * Claims focus on mount, which is once per card.
                 *
                 * A timeout in an effect was doing this, and it lost the
                 * race whenever something else took focus in the same
                 * frame — in a typing-only session the caret ended up on
                 * the tab button that opened the deck, so the first
                 * thing you typed went nowhere at all.
                 */
                autoFocus
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
              {/* No shortcut here on purpose: the input owns the
                  keyboard while you are answering, and K is a letter. */}
              <button
                className={styles.knowItBtn}
                onClick={handleKnowIt}
                title="Set this one aside for a week"
              >
                Know it
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
