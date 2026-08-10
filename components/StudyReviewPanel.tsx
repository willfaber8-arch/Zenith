/**
 * components/StudyReviewPanel.tsx — the problem-set review queue.
 *
 * The second caller of `ReviewScheduler`, which is the point: vocabulary
 * and problem sets share one scheduling engine rather than each growing a
 * private half-implementation. That is exactly how the vocab scheduler
 * ended up never scheduling anything.
 *
 * Reviewing a set means working it again from memory and rating how it
 * went. There is no auto-grading — self-rated difficulty is the input,
 * same as vocabulary.
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Assignment, type StudyReviewCard } from '@/lib/db'
import { useToast } from '@/lib/ToastContext'
import {
  scheduleNext, initialState, isDue, formatDue,
  type RecallGrade,
} from '@/lib/engines/ReviewScheduler'
import MathText from '@/components/MathText'
import styles from './StudyReviewPanel.module.css'

/** The five ratings offered. 1 and 2 are failures; 3–5 are passes. */
const GRADES: { grade: RecallGrade; label: string; hint: string }[] = [
  { grade: 1, label: 'Blank',   hint: 'Could not start it' },
  { grade: 2, label: 'Hard',    hint: 'Needed the solution' },
  { grade: 3, label: 'Shaky',   hint: 'Got there, slowly' },
  { grade: 4, label: 'Solid',   hint: 'Some hesitation' },
  { grade: 5, label: 'Easy',    hint: 'Straight through' },
]

export default function StudyReviewPanel() {
  const { toast } = useToast()
  const [working, setWorking] = useState<string | null>(null)

  const cards = useLiveQuery(
    async () => (db ? db.study_review_cards.where('subjectType').equals('problem_set').toArray() : []),
    [],
  )
  const sets = useLiveQuery(
    async () => (db ? db.assignments.toArray() : []),
    [],
  )

  const loaded = cards !== undefined && sets !== undefined

  /** Problem sets eligible to enter the rotation — completed, not yet enrolled. */
  const enrollable = useMemo(() => {
    if (!sets || !cards) return []
    const enrolled = new Set(cards.map(c => c.subjectId))
    return sets.filter(a =>
      a.kind === 'problem_set'
      && a.status === 'completed'
      && !enrolled.has(String(a.id)),
    )
  }, [sets, cards])

  /** Cards due now, paired with their set. */
  const due = useMemo(() => {
    if (!sets || !cards) return []
    const now = Date.now()
    const byId = new Map(sets.map(a => [String(a.id), a]))
    return cards
      .filter(c => isDue(c.nextReviewAt, now))
      .map(c => ({ card: c, set: byId.get(c.subjectId) }))
      .filter((x): x is { card: StudyReviewCard; set: Assignment } => !!x.set)
      .sort((a, b) => a.card.nextReviewAt - b.card.nextReviewAt)
  }, [cards, sets])

  const upcoming = useMemo(() => {
    if (!sets || !cards) return []
    const now = Date.now()
    const byId = new Map(sets.map(a => [String(a.id), a]))
    return cards
      .filter(c => !isDue(c.nextReviewAt, now))
      .map(c => ({ card: c, set: byId.get(c.subjectId) }))
      .filter((x): x is { card: StudyReviewCard; set: Assignment } => !!x.set)
      .sort((a, b) => a.card.nextReviewAt - b.card.nextReviewAt)
  }, [cards, sets])

  /* ── Mutations ───────────────────────────────────────────────── */

  const enroll = useCallback(async (a: Assignment) => {
    if (!db) return
    const now = Date.now()
    const state = initialState(now)
    const id = crypto.randomUUID()
    await db.study_review_cards.add({
      id,
      subjectType: 'problem_set',
      subjectId:   String(a.id),
      easeFactor:           state.easeFactor,
      reviewIntervalDays:   state.reviewIntervalDays,
      consecutiveSuccesses: state.consecutiveSuccesses,
      nextReviewAt:         state.nextReviewAt,
      reviewCount:          0,
    })
    await db.assignments.update(a.id, { reviewCardId: id })
    toast(`"${a.title}" added to review.`, 'success')
  }, [toast])

  const grade = useCallback(async (card: StudyReviewCard, g: RecallGrade, title: string) => {
    if (!db) return
    const next = scheduleNext(card, g, Date.now())
    await db.study_review_cards.update(card.id, {
      easeFactor:           next.easeFactor,
      reviewIntervalDays:   next.reviewIntervalDays,
      consecutiveSuccesses: next.consecutiveSuccesses,
      nextReviewAt:         next.nextReviewAt,
      lastReviewedAt:       Date.now(),
      reviewCount:          card.reviewCount + 1,
    })
    setWorking(null)
    toast(`"${title}" — back ${formatDue(next.nextReviewAt, Date.now()).toLowerCase()}.`, 'success')
  }, [toast])

  const drop = useCallback(async (card: StudyReviewCard) => {
    if (!db) return
    await db.study_review_cards.delete(card.id)
    await db.assignments.update(Number(card.subjectId), { reviewCardId: undefined })
    toast('Removed from review.', 'info')
  }, [toast])

  /* ── Render ──────────────────────────────────────────────────── */

  if (!loaded) return <p className={styles.empty}>Loading…</p>

  if (cards.length === 0 && enrollable.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyGlyph} aria-hidden="true">⟳</span>
        <p className={styles.emptyLabel}>Nothing to review yet</p>
        <p className={styles.emptyHint}>
          Finish a problem set in the Work tab and it becomes eligible here.
          Reviews come back on a spaced schedule — a set you find easy will
          not reappear for months.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.root}>

      {due.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>
            Due now <span className={styles.headingCount}>{due.length}</span>
          </h3>

          <ul className={styles.list}>
            {due.map(({ card, set }) => {
              const open = working === card.id
              return (
                <li key={card.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.cardTitle}>{set.title}</p>
                      <p className={styles.cardMeta}>
                        {set.courseId && <span>{set.courseId} · </span>}
                        reviewed {card.reviewCount}×
                        {card.reviewIntervalDays > 0 && ` · last gap ${card.reviewIntervalDays}d`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.workBtn}
                      onClick={() => setWorking(open ? null : card.id)}
                      aria-expanded={open}
                    >
                      {open ? 'Hide' : 'Work it'}
                    </button>
                  </div>

                  {open && (
                    <>
                      {set.body ? (
                        <div className={styles.body}>
                          <MathText text={set.body} />
                        </div>
                      ) : (
                        <p className={styles.noBody}>
                          No questions saved with this set — work it from your own copy.
                        </p>
                      )}

                      <div className={styles.grades} role="group" aria-label="How did it go?">
                        {GRADES.map(g => (
                          <button
                            key={g.grade}
                            type="button"
                            className={`${styles.grade} ${g.grade >= 3 ? styles.gradePass : styles.gradeFail}`}
                            onClick={() => grade(card, g.grade, set.title)}
                            title={g.hint}
                          >
                            <span className={styles.gradeLabel}>{g.label}</span>
                            <span className={styles.gradeHint}>{g.hint}</span>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button" className={styles.dropBtn}
                        onClick={() => drop(card)}
                      >
                        Stop reviewing this
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {enrollable.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>Add to review</h3>
          <p className={styles.sectionHint}>
            Completed sets you can put into the rotation.
          </p>
          <ul className={styles.chips}>
            {enrollable.slice(0, 12).map(a => (
              <li key={a.id}>
                <button type="button" className={styles.chip} onClick={() => enroll(a)}>
                  + {a.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>Scheduled</h3>
          <ul className={styles.upcoming}>
            {upcoming.slice(0, 10).map(({ card, set }) => (
              <li key={card.id} className={styles.upcomingRow}>
                <span className={styles.upcomingTitle}>{set.title}</span>
                <span className={styles.upcomingWhen}>
                  {formatDue(card.nextReviewAt, Date.now())}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {due.length === 0 && cards.length > 0 && (
        <p className={styles.allClear}>
          Nothing due right now — the next set comes back{' '}
          {upcoming[0] ? formatDue(upcoming[0].card.nextReviewAt, Date.now()).toLowerCase() : 'soon'}.
        </p>
      )}
    </div>
  )
}
