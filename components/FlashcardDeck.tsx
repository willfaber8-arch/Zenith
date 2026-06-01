'use client'

/**
 * Zenith OS — FlashcardDeck
 * Phase 3 · Step 3.5 — Two-Sided 3D Flip Flashcard System
 *
 * CSS 3D flip technique:
 *   • Parent (.scene) sets perspective so depth is visible
 *   • Inner (.cardInner) has transform-style: preserve-3d and the flip transition
 *   • Front face (.front) is default-visible
 *   • Back face (.back) is pre-rotated rotateY(180deg) and backface-visibility: hidden
 *   • Adding .flipped to .cardInner rotates the whole inner 180deg, hiding front / showing back
 *
 * Navigation waits 320ms before changing index if the card is flipped, so the
 * user sees the flip-back animation complete before the content changes.
 */

import { useState, useRef, useCallback } from 'react'
import type { Flashcard } from '@/types/studyAi'
import styles from './FlashcardDeck.module.css'

/* ── Props ───────────────────────────────────────────────────── */

interface FlashcardDeckProps {
  flashcards: Flashcard[]
}

/* ── Component ───────────────────────────────────────────────── */

export default function FlashcardDeck({ flashcards }: FlashcardDeckProps) {
  const [index,      setIndex]      = useState(0)
  const [flipped,    setFlipped]    = useState(false)
  const [reviewedSet, setReviewedSet] = useState<Set<string>>(() => new Set())

  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const card  = flashcards[index]
  const total = flashcards.length

  /* Navigate — if currently showing answer, flip back first (320ms) */
  const goTo = useCallback((nextIndex: number) => {
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current)
    if (flipped) {
      setFlipped(false)
      navTimeoutRef.current = setTimeout(() => setIndex(nextIndex), 320)
    } else {
      setIndex(nextIndex)
    }
  }, [flipped])

  const goPrev = () => { if (index > 0)          goTo(index - 1) }
  const goNext = () => { if (index < total - 1)   goTo(index + 1) }

  /* Flip — mark as reviewed on first reveal */
  const handleFlip = () => {
    const next = !flipped
    setFlipped(next)
    if (next) setReviewedSet(s => new Set(s).add(card.id))
  }

  const resetDeck = () => {
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current)
    setFlipped(false)
    setIndex(0)
    setReviewedSet(new Set())
  }

  const reviewedCount = reviewedSet.size
  const progressPct   = total > 0 ? (reviewedCount / total) * 100 : 0

  /* Keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
  }

  return (
    <div className={styles.deck}>

      {/* ── Header row ─────────────────────────────────────── */}
      <div className={styles.headerRow}>
        <span className={styles.counter}>Card {index + 1} of {total}</span>
        <div className={styles.progressWrap}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPct}%` }}
            title={`${reviewedCount} of ${total} reviewed`}
          />
        </div>
        <button className={styles.resetBtn} onClick={resetDeck} title="Reset deck">
          Reset
        </button>
      </div>

      {/* ── 3D Card Scene ──────────────────────────────────── */}
      <div
        className={styles.scene}
        onClick={handleFlip}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={flipped ? `Answer: ${card.answer}` : `Question: ${card.question}. Press Space to flip.`}
        aria-pressed={flipped}
      >
        <div className={`${styles.cardInner} ${flipped ? styles.flipped : ''}`}>

          {/* Front — Question */}
          <div className={`${styles.face} ${styles.front}`}>
            <span className={styles.faceTag}>Q</span>
            <p className={styles.cardText}>{card.question}</p>
          </div>

          {/* Back — Answer */}
          <div className={`${styles.face} ${styles.back}`}>
            <span className={styles.faceTag}>A</span>
            <p className={styles.cardText}>{card.answer}</p>
          </div>

        </div>
      </div>

      {/* ── Hint ───────────────────────────────────────────── */}
      <p className={styles.hint} aria-live="polite">
        {flipped ? 'Click card to see question' : 'Click card to reveal answer · ← → to navigate'}
      </p>

      {/* ── Navigation ─────────────────────────────────────── */}
      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={goPrev}
          disabled={index === 0}
          aria-label="Previous card"
        >
          ← Prev
        </button>

        {/* Dot progress row — caps at 20 dots to stay compact */}
        <div className={styles.dotRow} role="group" aria-label="Card progress">
          {flashcards.slice(0, 20).map((fc, i) => (
            <button
              key={fc.id}
              className={[
                styles.dot,
                i === index          ? styles.dotCurrent  : '',
                reviewedSet.has(fc.id) ? styles.dotReviewed : '',
              ].filter(Boolean).join(' ')}
              onClick={() => goTo(i)}
              aria-label={`Go to card ${i + 1}${reviewedSet.has(fc.id) ? ' (reviewed)' : ''}`}
              aria-current={i === index ? 'true' : undefined}
            />
          ))}
          {total > 20 && <span className={styles.dotOverflow}>+{total - 20}</span>}
        </div>

        <button
          className={styles.navBtn}
          onClick={goNext}
          disabled={index === total - 1}
          aria-label="Next card"
        >
          Next →
        </button>
      </div>

      {/* ── Completion banner ──────────────────────────────── */}
      {reviewedCount === total && (
        <div className={styles.completeBanner}>
          <span className={styles.completeIcon}>✓</span>
          All {total} cards reviewed — great session.
          <button className={styles.completeReset} onClick={resetDeck}>Study again</button>
        </div>
      )}

    </div>
  )
}
