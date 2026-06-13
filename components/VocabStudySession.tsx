'use client'

import { useState, useEffect, useCallback } from 'react'
import { db }                               from '@/lib/db'
import type { VocabCard, RecallGrade }      from '@/types/vocabulary'
import { calculateNextReviewCardState }     from '@/utils/spacedRepetition'
import styles                               from './VocabStudySession.module.css'

/* ── Grade metadata ──────────────────────────────────────────── */

const GRADE_META: { label: string; desc: string; correct: boolean }[] = [
  { label: '0', desc: 'Blackout',  correct: false },
  { label: '1', desc: 'Forgot',    correct: false },
  { label: '2', desc: 'Hard hint', correct: false },
  { label: '3', desc: 'Difficult', correct: true  },
  { label: '4', desc: 'Hesitated', correct: true  },
  { label: '5', desc: 'Perfect',   correct: true  },
]

/* ── Helpers ─────────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Types ───────────────────────────────────────────────────── */

type SessionPhase = 'loading' | 'ready' | 'exiting' | 'complete' | 'empty'

interface Props {
  deckId:       string
  languageName: string
  /** Called when the user finishes a session and requests a restart. */
  onRestart?:   () => void
}

/* ════════════════════════════════════════════════════════════════
   VocabStudySession
   ════════════════════════════════════════════════════════════════ */

export default function VocabStudySession({ deckId, languageName, onRestart }: Props) {
  const [phase,   setPhase]   = useState<SessionPhase>('loading')
  const [queue,   setQueue]   = useState<VocabCard[]>([])
  const [idx,     setIdx]     = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [cardKey, setCardKey] = useState(0)   // remount key drives anim replay

  /* ── Load due cards once on session start ─────────────────── */
  useEffect(() => {
    let cancelled = false
    const now = Date.now()

    db.vocab_cards
      .where('deckId').equals(deckId)
      .toArray()
      .then(allDeckCards => {
        if (cancelled) return

        // Cards with 0 timestamp (newly created) are also immediately due
        const due = allDeckCards.filter(c => c.nextReviewTimestamp <= now)

        if (allDeckCards.length === 0) {
          setPhase('empty')
          return
        }
        if (due.length === 0) {
          setPhase('complete')
          return
        }

        setQueue(shuffle(due))
        setIdx(0)
        setFlipped(false)
        setCardKey(0)
        setPhase('ready')
      })

    return () => { cancelled = true }
  }, [deckId])

  const currentCard = queue[idx] ?? null
  const dueTotal    = queue.length

  /* ── Flip ─────────────────────────────────────────────────── */
  const handleFlip = useCallback(() => {
    if (phase === 'ready' && !flipped) setFlipped(true)
  }, [phase, flipped])

  /* ── Grade submission ─────────────────────────────────────── */
  const handleGrade = useCallback(async (grade: RecallGrade) => {
    if (!currentCard || !flipped || phase !== 'ready') return

    const updated = calculateNextReviewCardState(currentCard, grade)

    // Atomic IDB save — nextReviewTimestamp and SM-2 state
    await db.vocab_cards.put(updated)

    // Animate exit, then advance to the next card
    setPhase('exiting')
    setTimeout(() => {
      const nextIdx = idx + 1
      setIdx(nextIdx)
      setFlipped(false)
      setCardKey(k => k + 1)
      setPhase(nextIdx >= dueTotal ? 'complete' : 'ready')
    }, 220)
  }, [currentCard, flipped, phase, idx, dueTotal])

  /* ── Keyboard shortcut: Space / Enter flips, 0–5 grades ───── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleFlip()
      }
      if (flipped && !['0','1','2','3','4','5'].includes(e.key) === false) {
        void handleGrade(Number(e.key) as RecallGrade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleFlip, handleGrade, flipped])

  /* ── Render states ────────────────────────────────────────── */

  if (phase === 'loading') {
    return <div className={styles.loading}>Initialising session…</div>
  }

  if (phase === 'empty') {
    return (
      <div className={styles.emptySession}>
        <span className={styles.emptySessionGlyph}>◇</span>
        <p className={styles.emptySessionText}>
          This deck has no cards yet. Switch to the Cards tab to add your first vocabulary entry.
        </p>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className={styles.allDone}>
        <span className={styles.allDoneGlyph}>◇</span>
        <p className={styles.allDoneTitle}>
          [ ALL CARDS FOR TODAY CAREFULLY REVIEWED ]
        </p>
        <p className={styles.allDoneSubtext}>
          // REST YOUR COGNITIVE CHANNELS
        </p>
        {onRestart && (
          <div className={styles.allDoneActions}>
            <button className={styles.allDoneBtn} onClick={onRestart}>
              ↺ Restart Session
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!currentCard) return null

  return (
    <div className={styles.session}>

      {/* ── Progress strip ────────────────────────────────── */}
      <div className={styles.progressStrip}>
        <span className={styles.cardCounter}>
          {idx + 1} <span className={styles.counterOf}>of</span> {dueTotal}
        </span>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${(idx / dueTotal) * 100}%` }}
          />
        </div>
        <span className={styles.langBadge}>{languageName}</span>
      </div>

      {/* ── Flip card ─────────────────────────────────────── */}
      <div
        key={cardKey}
        className={`${styles.flipContainer} ${
          phase === 'exiting' ? styles.exiting : 'anim-scale-in'
        }`}
      >
        <div
          className={`${styles.flipInner} ${flipped ? styles.isFlipped : ''}`}
          onClick={handleFlip}
          role="button"
          tabIndex={flipped ? -1 : 0}
          aria-label={flipped ? `Answer: ${currentCard.nativeTranslation}` : 'Tap to reveal translation'}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFlip()
            }
          }}
        >
          {/* Front — foreign word */}
          <div className={`${styles.flipFace} ${styles.flipFront}`}>
            <p className={styles.tapHint}>tap to reveal</p>
            <p className={styles.foreignWord}>{currentCard.foreignWord}</p>
          </div>

          {/* Back — translation + phonetic */}
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

      {/* ── Grade buttons (slide down after flip) ─────────── */}
      <div className={`${styles.gradeSection} ${flipped ? styles.visible : ''}`}>
        <div className={styles.gradeSectionInner}>
          <p className={styles.gradeLabel}>How well did you recall this?</p>
          <div className={styles.gradeRow}>
            {GRADE_META.map(({ label, desc, correct }, g) => (
              <button
                key={g}
                className={`${styles.gradeBtn} ${correct ? styles.correct : styles.incorrect}`}
                onClick={() => void handleGrade(g as RecallGrade)}
                aria-label={`Grade ${g}: ${desc}`}
              >
                <span className={styles.gradeNum}>{label}</span>
                <span className={styles.gradeDesc}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
