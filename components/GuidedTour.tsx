'use client'

/* ════════════════════════════════════════════════════════════════
   GuidedTour — anchored first-launch walkthrough
   ----------------------------------------------------------------
   Replaces the old card-only TutorialSpotlight with a tour that
   highlights the REAL interface: each step measures a live element
   (via its data-tour attribute), cuts a spotlight hole around it,
   points a bouncing arrow at it, and explains it in a step card.
   The spotlight glides between targets on Next/Back so it is always
   obvious which control is being described.

   • First launch: a small welcome dialog offers "Start tour / Skip"
     exactly once (localStorage zenith_tour_v2). Fully optional.
   • Replay any time: Settings → Help & Tour dispatches
     `zenith:replay-tutorial`, which starts the tour directly.
   • While touring, the app underneath is inert — only the tour's
     own controls respond. Escape exits.
   • Steps whose target is missing or hidden (e.g. mobile drawer
     closed, free-layout mode) are skipped automatically.
   ════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/AuthContext'
import { useNav }  from '@/lib/NavContext'
import styles from './GuidedTour.module.css'

const TOUR_KEY = 'zenith_tour_v2'
/** Delay before the first-launch welcome card — lets the boot handshake finish. */
const WELCOME_DELAY_MS = 3500
/** Spotlight padding around the measured element. */
const PAD = 8

interface TourStep {
  /** data-tour attribute value; null → centered card, no spotlight */
  target: string | null
  title:  string
  body:   string
}

const STEPS: TourStep[] = [
  {
    target: 'sidebar',
    title:  'Your command center',
    body:   'Everything in Zenith lives in this sidebar — organised into Essentials, Creator’s Choice, and your Personalized Vault. Right-click any item to hide it; collapse whole categories with the ▾ chevron.',
  },
  {
    target: 'nav-uni-hub',
    title:  'University Hub',
    body:   'Your academic base: university + major resource links, a GPA calculator with what-if sliders, cognitive load planning, and campus finances.',
  },
  {
    target: 'nav-habits',
    title:  'Habits',
    body:   'Build daily habits with step goals, streaks, and colour-coded progress rings. A full analytics chart tracks your 30-day trend.',
  },
  {
    target: 'nav-calendar',
    title:  'Universal Calendar',
    body:   'Week, month, and agenda views. Import iCal/Canvas feeds, add personal events, or auto-generate your class schedule for the whole semester.',
  },
  {
    target: 'nav-games',
    title:  'Arcade',
    body:   'Play Minesweeper, 2048, Zen Snake and more to harvest resources, refine them, unlock skills, and buy cosmetic themes for the whole app.',
  },
  {
    target: 'widgets',
    title:  'Home widgets',
    body:   'Your dashboard is built from widgets — habits, weather, calendar, counters, sports teams and more. Rearrange them, toggle them, or switch to a free-drag layout.',
  },
  {
    target: 'copilot',
    title:  'AI Co-Pilot',
    body:   'Click ◎ to open the AI assistant. It reads your recent habits, tasks and schedule (locally) to give grounded answers. Bring your own API key in Settings → AI Provider.',
  },
  {
    target: 'credits',
    title:  '✦ Credits',
    body:   'Credits earned in the Arcade appear here. Click the badge to jump straight to the cosmetic Shop and spend them on themes.',
  },
  {
    target: 'nav-settings',
    title:  'Settings',
    body:   'Themes, school colors, account, data backup & restore, privacy documents — and you can replay this tour any time from Help & Tour.',
  },
  {
    target: null,
    title:  'You’re all set',
    body:   'That’s the grand tour. Zenith is local-first — your data stays on this device. Explore at your own pace, and check Settings → Help if you ever get stuck.',
  },
]

type Phase = 'idle' | 'welcome' | 'touring'

interface SpotRect { top: number; left: number; width: number; height: number }

/** Measure a step's target; null if absent or not visibly rendered. */
function measure(target: string | null): SpotRect | null {
  if (!target) return null
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export default function GuidedTour() {
  const { session } = useAuth()
  const { navigate } = useNav()

  const [mounted, setMounted] = useState(false)
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [stepIdx, setStepIdx] = useState(0)
  const [rect,    setRect]    = useState<SpotRect | null>(null)

  const nextBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  /* ── First-launch welcome (once, only when signed in) ─────────── */
  useEffect(() => {
    if (!session) return
    let seen = true
    try { seen = localStorage.getItem(TOUR_KEY) !== null } catch { /* noop */ }
    if (seen) return
    const t = setTimeout(() => {
      setPhase(p => (p === 'idle' ? 'welcome' : p))
    }, WELCOME_DELAY_MS)
    return () => clearTimeout(t)
  }, [session])

  /* ── Replay from Settings → Help & Tour ───────────────────────── */
  const startTour = useCallback(() => {
    try { localStorage.setItem(TOUR_KEY, JSON.stringify({ seenAt: Date.now() })) } catch { /* noop */ }
    navigate('home', null as never)   // all anchors live on the home screen
    setStepIdx(0)
    setPhase('touring')
  }, [navigate])

  useEffect(() => {
    const onReplay = () => startTour()
    window.addEventListener('zenith:replay-tutorial', onReplay)
    return () => window.removeEventListener('zenith:replay-tutorial', onReplay)
  }, [startTour])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(TOUR_KEY, JSON.stringify({ seenAt: Date.now() })) } catch { /* noop */ }
    setPhase('idle')
  }, [])

  /* ── Step navigation (auto-skipping unmeasurable targets) ─────── */
  const goTo = useCallback((from: number, dir: 1 | -1) => {
    let i = from + dir
    while (i >= 0 && i < STEPS.length) {
      if (STEPS[i].target === null || measure(STEPS[i].target)) { setStepIdx(i); return }
      i += dir
    }
    if (i >= STEPS.length) dismiss()   // walked off the end → finish
  }, [dismiss])

  /* ── Measure the current target; re-measure on resize/scroll ──── */
  useEffect(() => {
    if (phase !== 'touring') return
    const step = STEPS[stepIdx]

    const el = step.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior })

    const update = () => setRect(measure(step.target))
    // Measure on the next frame so scrollIntoView has settled.
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [phase, stepIdx])

  /* ── Keyboard: Escape exits, arrows navigate ──────────────────── */
  useEffect(() => {
    if (phase === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { dismiss(); return }
      if (phase !== 'touring') return
      if (e.key === 'ArrowRight') goTo(stepIdx, 1)
      if (e.key === 'ArrowLeft')  goTo(stepIdx, -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, stepIdx, goTo, dismiss])

  /* ── Body scroll lock + focus while touring ───────────────────── */
  useEffect(() => {
    if (phase === 'idle') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nextBtnRef.current?.focus()
    return () => { document.body.style.overflow = prev }
  }, [phase, stepIdx])

  if (!mounted || phase === 'idle') return null

  /* ══ Welcome dialog ═════════════════════════════════════════════ */
  if (phase === 'welcome') {
    return createPortal(
      <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Welcome to Zenith">
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeGlyph} aria-hidden="true">◈</div>
          <h2 className={styles.welcomeTitle}>Welcome to Zenith</h2>
          <p className={styles.welcomeBody}>
            Want a quick guided tour? We&rsquo;ll point out the sidebar, your
            dashboard widgets, the Arcade and the AI Co-Pilot — about a minute,
            and you can leave at any time.
          </p>
          <div className={styles.welcomeActions}>
            <button type="button" className={styles.primaryBtn} onClick={startTour} autoFocus>
              Start tour
            </button>
            <button type="button" className={styles.ghostBtn} onClick={dismiss}>
              Skip for now
            </button>
          </div>
          <p className={styles.welcomeHint}>Replay any time from Settings → Help &amp; Tour</p>
        </div>
      </div>,
      document.body,
    )
  }

  /* ══ Touring ════════════════════════════════════════════════════ */
  const step    = STEPS[stepIdx]
  const isFirst = stepIdx === 0
  const isLast  = stepIdx === STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight

  /* Card placement: prefer the side of the target with the most room. */
  const CARD_W = Math.min(360, vw - 32)
  const CARD_H = 230   // estimate for collision maths
  const GAP    = 26    // room for the arrow between target and card

  let cardStyle: React.CSSProperties
  let arrowStyle: React.CSSProperties | null = null
  let arrowDirClass = ''

  if (rect) {
    const spaceRight  = vw - (rect.left + rect.width)
    const spaceLeft   = rect.left
    const spaceBottom = vh - (rect.top + rect.height)

    const clampTop  = (t: number) => Math.max(16, Math.min(t, vh - CARD_H - 16))
    const clampLeft = (l: number) => Math.max(16, Math.min(l, vw - CARD_W - 16))

    if (spaceRight >= CARD_W + GAP + 16) {
      // Card to the RIGHT of the target, arrow pointing left at it.
      cardStyle = { top: clampTop(rect.top + rect.height / 2 - CARD_H / 2), left: rect.left + rect.width + GAP + PAD + 14 }
      arrowStyle = { top: rect.top + rect.height / 2 - 13, left: rect.left + rect.width + PAD + 4 }
      arrowDirClass = styles.arrowLeft
    } else if (spaceLeft >= CARD_W + GAP + 16) {
      // Card to the LEFT, arrow pointing right.
      cardStyle = { top: clampTop(rect.top + rect.height / 2 - CARD_H / 2), left: rect.left - CARD_W - GAP - PAD - 14 }
      arrowStyle = { top: rect.top + rect.height / 2 - 13, left: rect.left - PAD - 30 }
      arrowDirClass = styles.arrowRight
    } else if (spaceBottom >= CARD_H + GAP + 16) {
      // Card BELOW, arrow pointing up.
      cardStyle = { top: rect.top + rect.height + GAP + PAD + 14, left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2) }
      arrowStyle = { top: rect.top + rect.height + PAD + 4, left: rect.left + rect.width / 2 - 13 }
      arrowDirClass = styles.arrowUp
    } else {
      // Card ABOVE, arrow pointing down.
      cardStyle = { top: Math.max(16, rect.top - CARD_H - GAP - PAD - 14), left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2) }
      arrowStyle = { top: rect.top - PAD - 30, left: rect.left + rect.width / 2 - 13 }
      arrowDirClass = styles.arrowDown
    }
  } else {
    // No target (finish step) — centered card, dimmed screen, no arrow.
    // Pixel-centred so the entrance keyframe's transform doesn't conflict.
    cardStyle = {
      top:  Math.max(16, vh / 2 - CARD_H / 2),
      left: Math.max(16, vw / 2 - CARD_W / 2),
    }
  }

  return createPortal(
    <div className={styles.tourRoot} role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Click shield — makes the app inert while touring */}
      <div className={styles.shield} />

      {/* Spotlight hole — its huge box-shadow dims everything else and it
          glides between targets via a CSS transition. */}
      {rect ? (
        <div
          className={styles.spot}
          style={{
            top:    rect.top - PAD,
            left:   rect.left - PAD,
            width:  rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className={styles.fullDim} />
      )}

      {/* Bouncing arrow pointing at the highlighted element */}
      {arrowStyle && (
        <div className={`${styles.arrow} ${arrowDirClass}`} style={arrowStyle} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M20 12H5M5 12l6-6M5 12l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Step card */}
      <div className={styles.card} style={cardStyle} key={stepIdx}>
        <p className={styles.stepCount}>Step {stepIdx + 1} of {STEPS.length}</p>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.body}>{step.body}</p>

        <div className={styles.dots} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === stepIdx ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.ghostBtn} onClick={dismiss}>
            {isLast ? 'Close' : 'Skip tour'}
          </button>
          <div className={styles.navBtns}>
            {!isFirst && (
              <button type="button" className={styles.backBtn} onClick={() => goTo(stepIdx, -1)}>
                ← Back
              </button>
            )}
            {isLast ? (
              <button ref={nextBtnRef} type="button" className={styles.primaryBtn} onClick={dismiss}>
                Finish
              </button>
            ) : (
              <button ref={nextBtnRef} type="button" className={styles.primaryBtn} onClick={() => goTo(stepIdx, 1)}>
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
