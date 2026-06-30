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
    body:  'Your personal life dashboard — academics, habits, workouts, calendar, and creative tools all in one place. Everything runs locally in your browser, so your data stays private. This quick tour shows you the essentials; you can replay it any time from Settings.',
    hint:  'Use ← / → or the buttons below to move through the tour',
  },
  {
    icon:  '⊞',
    title: 'Navigate with the Sidebar',
    body:  'The left sidebar groups everything into three categories: Zenith Essentials, Creator\'s Choice, and Personalized Vault. Click a category heading to collapse or expand it, and right-click any item to hide it from the list.',
    hint:  'Tip: right-click a nav item → "Hide" to declutter',
  },
  {
    icon:  '☀',
    title: 'Light & Dark Mode',
    body:  'Hard to read in daylight? Click the ☀ / ☽ button in the top bar to switch between dark and light themes instantly. Your choice is remembered on this device.',
    hint:  'Tip: the toggle sits just left of the ◎ AI button',
  },
  {
    icon:  '▤',
    title: 'Two Dashboard Layouts',
    body:  'Your Home screen has two modes, switched from the chips in the top-right corner: "Classic" is a tidy auto-arranged grid, and "Free" is a drag-and-drop canvas where you can place, resize, and recolour every widget exactly where you want it.',
    hint:  'Tip: try the Classic / Free chips at the top-right of Home',
  },
  {
    icon:  '⚙',
    title: 'Customise Your Widgets',
    body:  'In Classic mode, click "Manage" to toggle which widgets appear. In Free mode, use the ⚙ Manage panel to show/hide widgets and recolour them, drag the ⠿ handle to move a widget, and drag its edge or corner to resize. Hit "Lock" when you\'re happy so nothing shifts by accident.',
    hint:  'Tip: "↺ Reset positions" re-packs everything on-screen',
  },
  {
    icon:  '🔍',
    title: 'Search & Quick Tools',
    body:  'The search bar on your dashboard runs a Google search in a new tab. Around it you\'ll find live widgets — weather, today\'s calendar, habit rings, study streak, and more.',
    hint:  'Tip: press Enter in the search bar to launch a query',
  },
  {
    icon:  '🎓',
    title: 'University Hub',
    body:  'Under Zenith Essentials → Scholastic, the University Hub gathers your school\'s real resources, a GPA calculator, a cognitive-load planner, and campus finance tools. Pick your university and major once and it tailors everything.',
    hint:  'Tip: your university also powers the Calendar schedule builder',
  },
  {
    icon:  '🎯',
    title: 'Study Shield',
    body:  'Study Shield opens a full-screen focus cockpit with a Pomodoro timer, a flashcard deck, voice notes, and ambient audio presets (rain, ocean, brown noise, focus tones). Everything you need to lock in.',
    hint:  'Tip: press Escape to exit the cockpit at any time',
  },
  {
    icon:  '📅',
    title: 'Habits & Calendar',
    body:  'Track daily habits with streaks and a weekly grid, and manage your schedule in the Universal Calendar — add personal events, subscribe to iCal/Canvas feeds, or auto-generate your class timetable from your university.',
    hint:  'Tip: the calendar has week, month, and agenda views',
  },
  {
    icon:  '⚡',
    title: 'Workouts & Your Cozy Biome',
    body:  'Log cardio in Workouts to earn Vitality Points, then spend them in the Cozy Biome shop to adopt fish and animals for your own aquarium or zoo — which animates right on your dashboard.',
    hint:  'Tip: sessions of 30+ minutes earn a bonus',
  },
  {
    icon:  '◎',
    title: 'AI Co-Pilot',
    body:  'Click the ◎ button in the top bar to open your AI Co-Pilot. It reads your habits, assignments, and wellness logs to give personalised academic and wellbeing advice — and you can talk to it with the mic button.',
    hint:  'Tip: voice input is supported via the mic button',
  },
  {
    icon:  '✦',
    title: 'You\'re All Set',
    body:  'That\'s the tour! Explore the sidebar to discover more — meal planning, library, trail finder, and the Arcade Hub. You can replay this walkthrough any time from Settings → Help & Tour.',
    hint:  'Settings → Help & Tour → Replay walkthrough',
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

  /* Replay trigger — dispatched from Settings → Help & Tour.
     Restarts the walkthrough from step 1 regardless of session count. */
  useEffect(() => {
    const replay = () => {
      setStep(0)
      setVisible(true)
      setShow(true)
    }
    window.addEventListener('zenith:replay-tutorial', replay)
    return () => window.removeEventListener('zenith:replay-tutorial', replay)
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
