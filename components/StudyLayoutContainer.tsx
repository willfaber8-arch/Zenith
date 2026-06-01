'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — StudyLayoutContainer
 * Phase 3 · Step 3.1 — Custom Study Mode Layout State
 *
 * Full-bleed focus cockpit rendered as a position:fixed overlay
 * (z-index: 200) inside AppShell.  Mounts only while study mode
 * is active — timers and dock tabs reset to initial state on each
 * session entry.
 *
 * Sub-components (private, not exported):
 *   CockpitTopBar      — exit button, mode title, session pips
 *   StudyPomodoroArena — SVG ring timer, phase switching, controls
 *   StudySideDock      — tabbed placeholder dock (Notes/Cards/Music)
 *   DropZone           — single placeholder card with feature list
 *
 * Entrance / exit animation:
 *   Driven by inline style via `visible` state flag.
 *   Component stays mounted for 450 ms after `isStudyModeActive`
 *   goes false so the CSS exit transition completes before unmount.
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState, useEffect,
  type CSSProperties,
} from 'react'
import { useStudyMode } from '@/lib/StudyModeContext'
import { usePomodoroStateMachine, SESSIONS_PER_LONG_BREAK } from '@/lib/hooks/usePomodoroStateMachine'
import PomodoroCanvas from './PomodoroCanvas'
import styles from './StudyLayoutContainer.module.css'

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — Constants (retained for CockpitTopBar pips)
   ══════════════════════════════════════════════════════════════ */

/** Sessions per Pomodoro cycle before a long break */
const SESSIONS_PER_CYCLE = SESSIONS_PER_LONG_BREAK

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — CockpitTopBar
   ══════════════════════════════════════════════════════════════ */

function CockpitTopBar({
  sessionCount,
  onExit,
}: {
  sessionCount: number
  onExit:       () => void
}) {
  /* Completed sessions mod cycle (0–3) */
  const completedInCycle = sessionCount % SESSIONS_PER_CYCLE

  return (
    <div className={styles.cockpitTopBar}>

      {/* Left: exit button */}
      <button
        type="button"
        className={styles.exitBtn}
        onClick={onExit}
        aria-label="Exit study mode"
      >
        ← Exit Focus
        <span className={styles.exitKeyHint} aria-hidden="true">esc</span>
      </button>

      {/* Center: mode title */}
      <div className={styles.cockpitTitle} aria-hidden="true">
        <span className={styles.titleDot} />
        Study Mode
      </div>

      {/* Right: session pips */}
      <div className={styles.sessionCounter} aria-label={`Session ${completedInCycle + 1} of ${SESSIONS_PER_CYCLE}`}>
        <div className={styles.sessionPips} aria-hidden="true">
          {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
            <span
              key={i}
              className={`${styles.sessionPip} ${i < completedInCycle ? styles.sessionPipFilled : ''}`}
            />
          ))}
        </div>
        <span className={styles.sessionLabel}>
          {completedInCycle + 1} / {SESSIONS_PER_CYCLE}
        </span>
      </div>

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — StudyPomodoroArena
   ══════════════════════════════════════════════════════════════ */

/**
 * StudyPomodoroArena drives the FSM-backed Pomodoro engine.
 *
 * contextSessionCount is sourced from StudyModeContext (the same
 * value shown in CockpitTopBar pips) so the canvas dots always
 * mirror the top-bar indicator without a second source of truth.
 */
function StudyPomodoroArena({ contextSessionCount }: { contextSessionCount: number }) {
  const machine = usePomodoroStateMachine()
  const { timerState, remaining, totalSecs, distractionCount } = machine

  const isBreak   = timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isRunning = timerState === 'WORK' || timerState === 'SHORT_BREAK' || timerState === 'LONG_BREAK'
  const isIdle    = timerState === 'IDLE'

  /* Primary button: label + action derived from current FSM state */
  let primaryLabel: string
  let primaryAction: () => void
  if (timerState === 'IDLE') {
    primaryLabel  = '▶  Start Focus'
    primaryAction = machine.start
  } else if (timerState === 'PAUSED') {
    primaryLabel  = '▶  Resume'
    primaryAction = machine.resume
  } else if (isBreak) {
    primaryLabel  = '⏸  Pause Break'
    primaryAction = machine.pause
  } else {
    primaryLabel  = '⏸  Pause'
    primaryAction = machine.pause
  }

  return (
    <div
      className={`${styles.focalArena} ${isBreak ? styles.phaseBreak : ''}`}
      role="region"
      aria-label="Pomodoro timer arena"
    >
      {/* Ambient radial glow */}
      <div className={styles.arenaGlow} aria-hidden="true" />

      {/* Radial countdown ring — delegates all SVG + pip rendering */}
      <PomodoroCanvas
        timerState={timerState}
        remaining={remaining}
        totalSecs={totalSecs}
        cyclePosition={contextSessionCount % SESSIONS_PER_CYCLE}
      />

      {/* Controls */}
      <div className={styles.arenaControls} role="group" aria-label="Timer controls">
        <button
          type="button"
          className={`${styles.primaryBtn} ${isRunning && !isBreak ? styles.primaryBtnRunning : ''}`}
          onClick={primaryAction}
          aria-label={isIdle ? 'Start focus session' : isRunning ? 'Pause timer' : 'Resume timer'}
        >
          {primaryLabel}
        </button>

        {!isIdle && (
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={machine.skip}
              aria-label="Skip to next phase"
            >
              Skip →
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={machine.reset}
              aria-label="Reset timer"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Distraction logger — visible only during an active WORK session */}
      {timerState === 'WORK' && (
        <div className={styles.distractionRow}>
          <button
            type="button"
            className={styles.distractionBtn}
            onClick={machine.logDistraction}
            aria-label="Log a distraction and refocus"
          >
            I Got Distracted
          </button>
          {distractionCount > 0 && (
            <span className={styles.distractionCount} aria-live="polite" aria-atomic="true">
              {distractionCount} {distractionCount === 1 ? 'distraction' : 'distractions'} logged
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — DropZone placeholder card
   ══════════════════════════════════════════════════════════════ */

interface DropZoneProps {
  icon:     string
  phase:    string
  title:    string
  desc:     string
  features: string[]
}

function DropZone({ icon, phase, title, desc, features }: DropZoneProps) {
  return (
    <div className={styles.dropZone} role="region" aria-label={`${title} — coming ${phase}`}>
      <span className={styles.dropZoneIcon} aria-hidden="true">{icon}</span>
      <span className={styles.dropZonePhaseBadge}>{phase}</span>
      <h3 className={styles.dropZoneTitle}>{title}</h3>
      <p className={styles.dropZoneDesc}>{desc}</p>
      <ul className={styles.dropZoneFeatures} aria-label="Planned features">
        {features.map(f => (
          <li key={f} className={styles.dropZoneFeature}>
            <span className={styles.dropZoneFeatureDot} aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — StudySideDock
   ══════════════════════════════════════════════════════════════ */

type DockTabId = 'notes' | 'cards' | 'music'

const DOCK_TABS: { id: DockTabId; label: string; icon: string }[] = [
  { id: 'notes', label: 'Notes',  icon: '⌗'  },
  { id: 'cards', label: 'Cards',  icon: '⚡'  },
  { id: 'music', label: 'Audio',  icon: '♩'  },
]

const DOCK_CONTENT: Record<DockTabId, DropZoneProps> = {
  notes: {
    icon:  '⌗',
    phase: 'Phase 3.2',
    title: 'Markdown Scratchpad',
    desc:  'A live-rendered Markdown editor will activate here — capture lecture notes, derivations, and structured outlines without leaving focus context.',
    features: [
      'Live Markdown preview',
      'Quick-capture keyboard shortcut',
      'Auto-save to IndexedDB',
    ],
  },
  cards: {
    icon:  '⚡',
    phase: 'Phase 3.3',
    title: 'Active Recall Matrix',
    desc:  'Spaced-repetition flashcard arrays with configurable decks will surface here — interspersed between Pomodoro intervals for maximum memory consolidation.',
    features: [
      'Anki-compatible card format',
      'SM-2 interval scheduling',
      'Streak and accuracy tracking',
    ],
  },
  music: {
    icon:  '♩',
    phase: 'Phase 3.4',
    title: 'Focus Audio Engine',
    desc:  'Lofi streams, binaural beats, and ambient soundscapes will power your sessions here — with volume that auto-fades during break transitions.',
    features: [
      'Lofi & brown noise streams',
      'Binaural beat presets',
      'Break-transition auto-fade',
    ],
  },
}

function StudySideDock() {
  const [activeTab, setActiveTab] = useState<DockTabId>('notes')

  return (
    <aside className={styles.sideDock} aria-label="Study utility dock">

      {/* Tab bar */}
      <div className={styles.dockTabs} role="tablist" aria-label="Dock modules">
        {DOCK_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`dock-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`dock-panel-${tab.id}`}
            className={`${styles.dockTab} ${activeTab === tab.id ? styles.dockTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.dockTabIcon} aria-hidden="true">{tab.icon}</span>
            <span className={styles.dockTabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div
        className={styles.dockContent}
        role="tabpanel"
        id={`dock-panel-${activeTab}`}
        aria-labelledby={`dock-tab-${activeTab}`}
        key={activeTab}  /* key change re-mounts for stagger animation */
      >
        <DropZone {...DOCK_CONTENT[activeTab]} />
      </div>

    </aside>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 6 — StudyLayoutContainer  (default export)
   ══════════════════════════════════════════════════════════════ */

export default function StudyLayoutContainer() {
  const { isStudyModeActive, sessionCount, exitStudyWorkspace } = useStudyMode()

  /*
   * Decouple mount lifecycle from the context boolean so we can:
   *   • Play the entrance animation on the first frame after mount
   *   • Keep the element alive during the exit animation (450 ms)
   *     before fully unmounting and stopping the Pomodoro timer.
   */
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const EXIT_DURATION = 450

  useEffect(() => {
    if (isStudyModeActive) {
      setMounted(true)
      /*
       * A 20ms timeout (one browser frame) ensures the element is
       * committed to the DOM at opacity:0 / scale(0.97) before the
       * entrance transition is triggered.  Double-rAF is unreliable
       * in React 18 StrictMode — the outer rAF ID is cancelled by
       * the simulated-unmount cleanup before it can fire, preventing
       * the inner callback from ever scheduling setVisible(true).
       */
      const t = setTimeout(() => setVisible(true), 20)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), EXIT_DURATION)
      return () => clearTimeout(t)
    }
  }, [isStudyModeActive])

  if (!mounted) return null

  const containerStyle: CSSProperties = {
    opacity:       visible ? 1 : 0,
    transform:     visible ? 'scale(1)' : 'scale(0.97)',
    pointerEvents: visible ? 'auto' : 'none',
    transition:    visible
      /* Entrance: fast deceleration — snappy, intentional */
      ? 'opacity 380ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1)'
      /* Exit: smooth ease-in — deliberate departure */
      : `opacity ${EXIT_DURATION - 50}ms ease, transform ${EXIT_DURATION}ms cubic-bezier(0.4, 0, 1, 1)`,
  }

  return (
    <div
      className={styles.cockpit}
      style={containerStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Study mode workspace"
    >
      {/* ── Minimal chrome top bar ───────────────────────── */}
      <CockpitTopBar
        sessionCount={sessionCount}
        onExit={exitStudyWorkspace}
      />

      {/* ── Main body: focal arena + side dock ───────────── */}
      <div className={styles.cockpitBody}>
        <StudyPomodoroArena contextSessionCount={sessionCount} />
        <StudySideDock />
      </div>
    </div>
  )
}
