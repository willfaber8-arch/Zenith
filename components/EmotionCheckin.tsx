'use client'
/**
 * components/EmotionCheckin.tsx — multi-phase emotion questionnaire
 *
 * Four short phases (Mood · Mind · Body · Drive & connection), three
 * questions each, then a results screen: the day's average wellbeing, a bar
 * per feeling, the lowest areas with something to try, and — once there are
 * a few days of check-ins — which areas are low across the week rather than
 * just today. All the arithmetic lives in utils/emotionCheckin.ts.
 */

import { useState, useMemo, useEffect, type CSSProperties } from 'react'
import {
  EMOTION_PHASES,
  INTENSITY_LABELS,
  scoreCheckin,
  averageCheckins,
  overallLabel,
  type EmotionAnswers,
} from '@/utils/emotionCheckin'
import styles from './EmotionCheckin.module.css'

interface Props {
  /** ISO day the check-in is for */
  date:        string
  /** The day's saved answers, if any */
  saved:       EmotionAnswers | undefined
  /** When they were saved — re-syncs the form once the log has loaded */
  savedAt:     number | undefined
  /** Check-ins from the week ending on `date`, for the multi-day average */
  recent:      Array<{ emotions?: EmotionAnswers }>
  submitting:  boolean
  onSave:      (answers: EmotionAnswers) => Promise<void>
}

/** Hue for a 0–100 wellbeing value: red → amber → green */
function scoreHue(v: number): number {
  return Math.round((v / 100) * 140)
}

export default function EmotionCheckin({ date, saved, savedAt, recent, submitting, onSave }: Props) {
  const hasSaved = !!saved && Object.keys(saved).length > 0

  // step: 0..phases-1 = questions, phases = results
  const RESULTS = EMOTION_PHASES.length
  const [step,    setStep]    = useState(hasSaved ? RESULTS : 0)
  const [answers, setAnswers] = useState<EmotionAnswers>(saved ?? {})

  // A different day — or that day's log arriving from IndexedDB after the
  // first render — starts over from what the day has saved.
  useEffect(() => {
    setAnswers(saved ?? {})
    setStep(saved && Object.keys(saved).length > 0 ? RESULTS : 0)
  }, [date, savedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => scoreCheckin(answers), [answers])
  const trend  = useMemo(() => averageCheckins(recent), [recent])

  const phase = step < RESULTS ? EMOTION_PHASES[step] : null
  const phaseDone = !!phase && phase.questions.every(q => answers[q.key] != null)

  const next = async () => {
    if (!phaseDone) return
    if (step === RESULTS - 1) {
      await onSave(answers)
      setStep(RESULTS)
    } else {
      setStep(s => s + 1)
    }
  }

  /* ── Results ─────────────────────────────────────────────── */
  if (!phase) {
    const overall = result.overall
    return (
      <div className={`${styles.wrap} anim-fade-in`}>
        {overall == null ? (
          <p className={styles.empty}>No check-in saved for this day yet.</p>
        ) : (
          <>
            <div className={styles.scoreRow} style={{ '--score-hue': scoreHue(overall) } as CSSProperties}>
              <div className={styles.scoreRing}>
                <span className={styles.scoreNum}>{overall}</span>
                <span className={styles.scoreOf}>/100</span>
              </div>
              <div>
                <p className={styles.scoreLabel}>{overallLabel(overall)}</p>
                <p className={styles.scoreSub}>Average wellbeing across {result.areas.length} feelings</p>
              </div>
            </div>

            <div className={styles.areaList}>
              {result.areas.map(a => (
                <div key={a.key} className={styles.areaRow}>
                  <span className={styles.areaName}>{a.label}</span>
                  <div className={styles.areaTrack}>
                    <div
                      className={styles.areaFill}
                      style={{ width: `${Math.max(4, a.wellbeing)}%`, '--score-hue': scoreHue(a.wellbeing) } as CSSProperties}
                    />
                  </div>
                  <span className={styles.areaVal}>{a.wellbeing}</span>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <p className={styles.sectionHeading}>Where to improve</p>
              {result.focusAreas.length === 0 ? (
                <p className={styles.sectionNote}>Nothing is running low today — keep doing what you&rsquo;re doing.</p>
              ) : result.focusAreas.map(a => (
                <div key={a.key} className={styles.focusCard}>
                  <p className={styles.focusTitle}>{a.label} <span className={styles.focusScore}>{a.wellbeing}/100</span></p>
                  <p className={styles.focusTip}>{a.tip}</p>
                </div>
              ))}
            </div>

            {result.strengths.length > 0 && (
              <div className={styles.section}>
                <p className={styles.sectionHeading}>Going well</p>
                <div className={styles.chips}>
                  {result.strengths.map(a => <span key={a.key} className={styles.chip}>{a.label}</span>)}
                </div>
              </div>
            )}

            {trend.days >= 2 && trend.overall != null && (
              <div className={styles.section}>
                <p className={styles.sectionHeading}>Past 7 days · {trend.days} check-ins</p>
                <p className={styles.sectionNote}>
                  Average {trend.overall}/100 ({overallLabel(trend.overall).toLowerCase()}).
                  {' '}Usually lowest: {trend.areas.slice(0, 3).map(a => `${a.label} (${a.wellbeing})`).join(', ')}.
                </p>
              </div>
            )}
          </>
        )}

        <button type="button" className={styles.secondaryBtn} onClick={() => setStep(0)}>
          {overall == null ? 'Start check-in' : 'Edit answers'}
        </button>
      </div>
    )
  }

  /* ── Question phase ──────────────────────────────────────── */
  return (
    <div className={`${styles.wrap} anim-fade-in`} key={phase.id}>
      <div className={styles.progress} aria-label={`Step ${step + 1} of ${RESULTS}`}>
        {EMOTION_PHASES.map((p, i) => (
          <span
            key={p.id}
            className={`${styles.pip} ${i < step ? styles.pipDone : ''} ${i === step ? styles.pipActive : ''}`}
          />
        ))}
      </div>

      <div>
        <p className={styles.phaseEyebrow}>Step {step + 1} of {RESULTS}</p>
        <h3 className={styles.phaseTitle}>{phase.title}</h3>
        <p className={styles.phaseSub}>{phase.subtitle}</p>
      </div>

      {phase.questions.map(q => (
        <fieldset key={q.key} className={styles.question}>
          <legend className={styles.prompt}>{q.prompt}</legend>
          <div className={styles.scale}>
            {INTENSITY_LABELS.map((lbl, v) => (
              <button
                key={lbl}
                type="button"
                className={`${styles.scaleBtn} ${answers[q.key] === v ? styles.scaleBtnOn : ''}`}
                aria-pressed={answers[q.key] === v}
                onClick={() => setAnswers(a => ({ ...a, [q.key]: v }))}
              >
                {lbl}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => setStep(s => (s === 0 ? (hasSaved ? RESULTS : 0) : s - 1))}
          disabled={step === 0 && !hasSaved}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={next}
          disabled={!phaseDone || submitting}
        >
          {step === RESULTS - 1 ? (submitting ? 'Saving…' : 'See results') : 'Next'}
        </button>
      </div>
    </div>
  )
}
