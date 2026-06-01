'use client'
/**
 * WidgetSandbox — Phase 1 · Step 1.4
 * ────────────────────────────────────────────────────────────────
 * Configurable widget grid for the Zen home screen. Manages:
 *   • Four dashboard slots: UrgentTasks, Pomodoro, HabitSummary, Weather
 *   • localStorage-persisted visibility config via useSandboxConfig()
 *   • Animated mount / unmount via AnimatedWidget wrapper
 *   • Floating "Manage Sandbox" panel for toggling widget visibility
 *
 * SSR safety: all DB / localStorage access is deferred until after
 * mount via the `mounted` flag from useSandboxConfig.
 */

import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import {
  useSandboxConfig,
  WIDGET_LABELS,
  type SandboxConfig,
} from '@/lib/hooks/useSandboxConfig'
import UrgentTasksWidget  from './widgets/UrgentTasksWidget'
import HabitSummaryWidget from './widgets/HabitSummaryWidget'
import PomodoroWidget     from './widgets/PomodoroWidget'
import WeatherWidget      from './widgets/WeatherWidget'
import styles from './WidgetSandbox.module.css'


/* ════════════════════════════════════════════════════════════════
   AnimatedWidget — mount/unmount wrapper with enter + exit anim
   ════════════════════════════════════════════════════════════════ */

function AnimatedWidget({
  visible,
  children,
}: {
  visible:  boolean
  children: ReactNode
}) {
  const [rendered, setRendered] = useState(visible)
  const [exiting,  setExiting]  = useState(false)
  /*
   * Track whether this is the very first render so we can skip
   * the enter animation on initial page load (widgets that start
   * visible should just appear, not animate in).
   */
  const isFirstRender = useRef(true)

  useEffect(() => {
    isFirstRender.current = false
  }, [])

  useEffect(() => {
    if (visible) {
      setExiting(false)
      setRendered(true)
    } else if (rendered) {
      setExiting(true)   /* Start exit animation */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  /* Once the exit animation ends, actually remove from DOM */
  const handleAnimEnd = () => {
    if (exiting) {
      setRendered(false)
      setExiting(false)
    }
  }

  if (!rendered) return null

  const cls = exiting
    ? styles.widgetExit
    : isFirstRender.current
      ? styles.widgetIdle
      : styles.widgetEnter

  return (
    <div
      className={cls}
      onAnimationEnd={handleAnimEnd}
      aria-hidden={exiting}
    >
      {children}
    </div>
  )
}


/* ════════════════════════════════════════════════════════════════
   ManagePanel — floating toggle overlay
   ════════════════════════════════════════════════════════════════ */

function ManagePanel({
  config,
  toggle,
  onClose,
}: {
  config:   SandboxConfig
  toggle:   (k: keyof SandboxConfig) => void
  onClose:  () => void
}) {
  /* Close panel on Escape key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const keys = Object.keys(WIDGET_LABELS) as (keyof SandboxConfig)[]

  return (
    <>
      {/* Invisible backdrop — click to close */}
      <div
        className={styles.panelBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={styles.managePanel}
        role="dialog"
        aria-modal="true"
        aria-label="Customize Workspace"
      >
        <div className={styles.panelHeader}>
          <p className={styles.panelEyebrow}>Dashboard</p>
          <p className={styles.panelTitle}>Customize Workspace</p>
        </div>

        <ul className={styles.toggleList} role="list">
          {keys.map(key => {
            const on = config[key]
            return (
              <li key={key} className={styles.toggleRow}>
                <span className={styles.toggleLabel}>{WIDGET_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${on ? 'Hide' : 'Show'} ${WIDGET_LABELS[key]}`}
                  className={`${styles.togglePill} ${on ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => toggle(key)}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className={styles.panelDone}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </>
  )
}


/* ════════════════════════════════════════════════════════════════
   WidgetSandbox — main export
   ════════════════════════════════════════════════════════════════ */

export default function WidgetSandbox() {
  const { config, toggleWidget, mounted } = useSandboxConfig()
  const [panelOpen, setPanelOpen]         = useState(false)

  /*
   * Before `mounted` is true the config is still the SSR default.
   * We render a skeleton to avoid a flash of incorrect widget state.
   */
  if (!mounted) {
    return <div className={styles.skeletonGrid} aria-busy="true" />
  }

  const anyVisible =
    config.urgentTasks     ||
    config.pomodoroPreview ||
    config.habitSummary    ||
    config.localWeather

  return (
    <section className={styles.sandbox} aria-label="Widget Sandbox">

      {/* ── Section header ──────────────────────────────────── */}
      <div className={styles.sandboxHeader}>
        <div>
          <p className={styles.sandboxEyebrow}>Home · Workspace</p>
          <h2 className={styles.sandboxTitle}>Dashboard</h2>
        </div>
        <button
          type="button"
          className={styles.manageBtn}
          onClick={() => setPanelOpen(p => !p)}
          aria-label="Manage sandbox widgets"
          aria-expanded={panelOpen}
        >
          <span className={styles.manageBtnIcon} aria-hidden="true">⊞</span>
          Manage
        </button>
      </div>

      {/* ── Widget grid ─────────────────────────────────────── */}
      {anyVisible ? (
        <div className={styles.grid}>
          <AnimatedWidget visible={config.urgentTasks}>
            <UrgentTasksWidget />
          </AnimatedWidget>

          <AnimatedWidget visible={config.habitSummary}>
            <HabitSummaryWidget />
          </AnimatedWidget>

          <AnimatedWidget visible={config.pomodoroPreview}>
            <PomodoroWidget />
          </AnimatedWidget>

          <AnimatedWidget visible={config.localWeather}>
            <WeatherWidget />
          </AnimatedWidget>
        </div>
      ) : (
        <div className={styles.emptyGrid} aria-live="polite">
          <p className={styles.emptyGridIcon} aria-hidden="true">⊞</p>
          <p className={styles.emptyGridText}>
            All widgets are hidden. Open{' '}
            <button
              type="button"
              className={styles.inlineManageLink}
              onClick={() => setPanelOpen(true)}
            >
              Manage
            </button>
            {' '}to add one back.
          </p>
        </div>
      )}

      {/* ── Manage panel ────────────────────────────────────── */}
      {panelOpen && (
        <ManagePanel
          config={config}
          toggle={toggleWidget}
          onClose={() => setPanelOpen(false)}
        />
      )}

    </section>
  )
}
