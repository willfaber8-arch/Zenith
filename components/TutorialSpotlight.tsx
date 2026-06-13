'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNav } from '@/lib/NavContext'
import styles from './TutorialSpotlight.module.css'

const TUTORIAL_KEY = 'zenith_tutorial_v1'
const MAX_SESSIONS = 1

interface TutorialState { sessionsShown: number }

function loadTutorialState(): TutorialState {
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY)
    if (raw) return JSON.parse(raw) as TutorialState
  } catch { /* noop */ }
  return { sessionsShown: 0 }
}

function saveTutorialState(s: TutorialState) {
  try { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

/* ── Step definitions ───────────────────────────────────────────── */

interface Step {
  icon:    string
  title:   string
  body:    string
  hint?:   string
}

const STEPS: Step[] = [
  {
    icon:  '◈',
    title: 'Welcome to Zenith',
    body:  'Your personal life dashboard — academics, habits, workouts, and creativity all in one place. Everything runs locally in your browser, so your data stays private.',
    hint:  'Session 1 of the guided tour',
  },
  {
    icon:  '⊞',
    title: 'Navigate with the Sidebar',
    body:  'The left sidebar organises everything into three categories: Zenith Essentials, Creator\'s Choice, and Personalized Vault. Click a category name to collapse or expand it. Right-click any item to hide it.',
    hint:  'Tip: right-click any nav item to hide it',
  },
  {
    icon:  '🏠',
    title: 'Your Dashboard',
    body:  'The Home screen shows your widgets — weather, habits, calendar, cardio, and your Cozy Biome. Click Manage on the dashboard to toggle which widgets are visible.',
    hint:  'Tip: click "Manage" on the dashboard to customise',
  },
  {
    icon:  '🎯',
    title: 'Study Shield',
    body:  'Study Shield activates a full-screen focus cockpit with a Pomodoro timer, flashcard deck, and ambient audio presets. Find it under Zenith Essentials → Scholastic.',
    hint:  'Tip: press Escape to exit the cockpit at any time',
  },
  {
    icon:  '⚡',
    title: 'Earn Vitality Points',
    body:  'Log cardio sessions in Workouts to earn Vitality Points. Spend them in your Cozy Biome shop to adopt fish and animals for your personal aquarium or zoo — visible right on your dashboard.',
    hint:  'Tip: 30+ minute sessions earn a bonus',
  },
  {
    icon:  '◎',
    title: 'AI Co-Pilot',
    body:  'Click the ◎ button in the top bar to open your AI Co-Pilot. It reads your habits, assignments, and wellness logs to give you personalised academic and wellbeing advice.',
    hint:  'Tip: voice input is supported via the mic button',
  },
]

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function TutorialSpotlight() {
  const [show,    setShow]    = useState(false)
  const [step,    setStep]    = useState(0)
  const [visible, setVisible] = useState(true) // controls fade
  const { navigate } = useNav()

  useEffect(() => {
    const state = loadTutorialState()
    if (state.sessionsShown < MAX_SESSIONS) {
      const next: TutorialState = { sessionsShown: state.sessionsShown + 1 }
      saveTutorialState(next)
      setShow(true)
    }
  }, [])

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setVisible(false)
      setTimeout(() => {
        setStep(s => s + 1)
        setVisible(true)
      }, 180)
    } else {
      handleClose()
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrev = useCallback(() => {
    if (step > 0) {
      setVisible(false)
      setTimeout(() => {
        setStep(s => s - 1)
        setVisible(true)
      }, 180)
    }
  }, [step])

  const handleClose = useCallback(() => {
    setShow(false)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!show) return
      if (e.key === 'Escape')      handleClose()
      if (e.key === 'ArrowRight')  handleNext()
      if (e.key === 'ArrowLeft')   handlePrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [show, handleClose, handleNext, handlePrev])

  if (!show) return null

  const current = STEPS[step]

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className={styles.cardWrapper}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={`Tutorial step ${step + 1} of ${STEPS.length}: ${current.title}`}
      >
        {/* Progress dots */}
        <div className={styles.dots} aria-hidden="true">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ''}`}
              onClick={() => {
                setVisible(false)
                setTimeout(() => { setStep(i); setVisible(true) }, 180)
              }}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div
          className={styles.content}
          style={{ opacity: visible ? 1 : 0, transition: 'opacity 180ms ease' }}
        >
          <div className={styles.icon} aria-hidden="true">{current.icon}</div>
          <h2 className={styles.title}>{current.title}</h2>
          <p  className={styles.body}>{current.body}</p>
          {current.hint && (
            <p className={styles.hint}>{current.hint}</p>
          )}
        </div>

        {/* Navigation */}
        <div className={styles.nav}>
          <button
            className={styles.skipBtn}
            onClick={handleClose}
          >
            Skip tour
          </button>

          <div className={styles.navBtns}>
            {step > 0 && (
              <button className={styles.prevBtn} onClick={handlePrev}>
                ← Back
              </button>
            )}
            <button
              className={styles.nextBtn}
              onClick={handleNext}
            >
              {step === STEPS.length - 1 ? 'Get started →' : 'Next →'}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className={styles.counter} aria-live="polite">
          {step + 1} / {STEPS.length}
        </p>
      </div>
      </div>
    </>
  )
}
