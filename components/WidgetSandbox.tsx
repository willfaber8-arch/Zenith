'use client'

import {
  Component,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import {
  useSandboxConfig,
  WIDGET_LABELS,
  WIDGET_SIZE,
  type SandboxConfig,
} from '@/lib/hooks/useSandboxConfig'

/* ── Per-widget accent colors ─────────────────────────────────── */
const WIDGET_ACCENT: Record<keyof SandboxConfig, string> = {
  habitSummary:    '#f87171',
  pomodoroPreview: '#38bdf8',
  calendarToday:   '#60a5fa',
  localWeather:    '#60a5fa',
  studyStreak:     '#38bdf8',
  uniHub:          '#6366f1',
  cardioSummary:   '#fb923c',
  letterbox:       '#2dd4bf',
  distanceTracker: '#2dd4bf',
  timerWidget:     '#7c95ff',
  stopwatch:       '#52cca3',
  counter:         '#38bdf8',
  sportsTeams:     '#34d399',
  readingTracker:  '#a78bfa',
  customLinks:     '#7c95ff',
  vocabTracker:    '#f59e0b',
  gpaWidget:       '#52cca3',
  wellnessCheck:   '#f87171',
  mealToday:       '#fb923c',
  newsHeadline:    '#9ba3c4',
  arcadeEconomy:   '#52cca3',
}

import HabitSummaryWidget      from './widgets/HabitSummaryWidget'
import PomodoroWidget          from './widgets/PomodoroWidget'
import WeatherWidget           from './widgets/WeatherWidget'
import CalendarTodayWidget     from './widgets/CalendarTodayWidget'
import StudyStreakWidget        from './widgets/StudyStreakWidget'
import UniHubWidget            from './widgets/UniHubWidget'
import CardioWidget            from './widgets/CardioWidget'
import RelationshipNotesWidget from './widgets/RelationshipNotesWidget'
import DistanceTrackerWidget   from './widgets/DistanceTrackerWidget'
import TimerWidget             from './widgets/TimerWidget'
import StopwatchWidget         from './widgets/StopwatchWidget'
import ReadingTrackerWidget    from './widgets/ReadingTrackerWidget'
import QuickLinksWidget        from './widgets/QuickLinksWidget'
import VocabWidget             from './widgets/VocabWidget'
import GpaWidget               from './widgets/GpaWidget'
import WellnessWidget          from './widgets/WellnessWidget'
import MealWidget              from './widgets/MealWidget'
import NewsWidget              from './widgets/NewsWidget'
import ArcadeWidget            from './widgets/ArcadeWidget'
import CounterWidget           from './widgets/CounterWidget'
import SportsWidget            from './widgets/SportsWidget'
import styles from './WidgetSandbox.module.css'

/* ── Per-widget error boundary ────────────────────────────────── */
class WidgetErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 'var(--sp-4)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--r-md)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          lineHeight: 1.5,
        }}>
          Widget error · {this.props.name}<br />
          This widget encountered a runtime error and has been isolated.
        </div>
      )
    }
    return this.props.children
  }
}

/* ── Default widget order ─────────────────────────────────────── */
const DEFAULT_ORDER: (keyof SandboxConfig)[] = [
  'localWeather',
  'habitSummary',
  'calendarToday',
  'pomodoroPreview',
  'studyStreak',
  'uniHub',
  'cardioSummary',
  'letterbox',
  'distanceTracker',
  'timerWidget',
  'stopwatch',
  'counter',
  'sportsTeams',
  'readingTracker',
  'customLinks',
  'vocabTracker',
  'gpaWidget',
  'wellnessCheck',
  'mealToday',
  'newsHeadline',
  'arcadeEconomy',
]
const ORDER_KEY = 'zenith_widget_order_v1'

function loadOrder(): (keyof SandboxConfig)[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      // Merge: keep user order for known keys, append any new keys at end
      const knownInOrder = parsed.filter(k => DEFAULT_ORDER.includes(k as keyof SandboxConfig))
      const newKeys = DEFAULT_ORDER.filter(k => !parsed.includes(k))
      return [...knownInOrder, ...newKeys] as (keyof SandboxConfig)[]
    }
  } catch { /* noop */ }
  return DEFAULT_ORDER
}

function saveOrder(order: (keyof SandboxConfig)[]) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)) } catch { /* noop */ }
}

/* ── Widget renderer map ──────────────────────────────────────── */
function renderWidget(key: keyof SandboxConfig): ReactNode {
  const w = (el: ReactNode) => (
    <WidgetErrorBoundary name={key}>{el}</WidgetErrorBoundary>
  )
  switch (key) {
    case 'localWeather':    return w(<WeatherWidget />)
    case 'habitSummary':    return w(<HabitSummaryWidget />)
    case 'calendarToday':   return w(<CalendarTodayWidget />)
    case 'pomodoroPreview': return w(<PomodoroWidget />)
    case 'studyStreak':     return w(<StudyStreakWidget />)
    case 'uniHub':          return w(<UniHubWidget />)
    case 'cardioSummary':   return w(<CardioWidget />)
    case 'letterbox':       return w(<RelationshipNotesWidget />)
    case 'distanceTracker': return w(<DistanceTrackerWidget />)
    case 'timerWidget':     return w(<TimerWidget />)
    case 'stopwatch':       return w(<StopwatchWidget />)
    case 'counter':         return w(<CounterWidget />)
    case 'sportsTeams':     return w(<SportsWidget />)
    case 'readingTracker':  return w(<ReadingTrackerWidget />)
    case 'customLinks':     return w(<QuickLinksWidget />)
    case 'vocabTracker':    return w(<VocabWidget />)
    case 'gpaWidget':       return w(<GpaWidget />)
    case 'wellnessCheck':   return w(<WellnessWidget />)
    case 'mealToday':       return w(<MealWidget />)
    case 'newsHeadline':    return w(<NewsWidget />)
    case 'arcadeEconomy':   return w(<ArcadeWidget />)
  }
}

/* ════════════════════════════════════════════════════════════════
   AnimatedWidget — mount/unmount wrapper with accent propagation
   ════════════════════════════════════════════════════════════════ */

function AnimatedWidget({
  visible,
  wide,
  accent,
  children,
}: {
  visible:  boolean
  wide?:    boolean
  accent?:  string
  children: ReactNode
}) {
  const [rendered, setRendered] = useState(visible)
  const [exiting,  setExiting]  = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => { isFirstRender.current = false }, [])

  useEffect(() => {
    if (visible) {
      setExiting(false)
      setRendered(true)
    } else if (rendered) {
      setExiting(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleAnimEnd = () => {
    if (exiting) { setRendered(false); setExiting(false) }
  }

  if (!rendered) return null

  const cls = exiting
    ? styles.widgetExit
    : isFirstRender.current
      ? styles.widgetIdle
      : styles.widgetEnter

  return (
    <div
      className={`${cls} ${wide ? styles.widgetWide : ''}`}
      onAnimationEnd={handleAnimEnd}
      aria-hidden={exiting}
      style={accent ? { '--widget-accent': accent } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   WidgetSandbox — main export
   ════════════════════════════════════════════════════════════════ */

export default function WidgetSandbox() {
  const { config, toggleWidget, mounted } = useSandboxConfig()
  const [editMode, setEditMode]           = useState(false)
  const [widgetOrder, setWidgetOrder]     = useState<(keyof SandboxConfig)[]>(DEFAULT_ORDER)

  /* Load persisted order after mount */
  useEffect(() => {
    setWidgetOrder(loadOrder())
  }, [])

  /* ── Drag-and-drop state ──────────────────────────────────── */
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (index !== dropIndex) setDropIndex(index)
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    setWidgetOrder(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      saveOrder(next)
      return next
    })
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  if (!mounted) {
    return <div className={styles.skeletonGrid} aria-busy="true" />
  }

  const anyVisible = widgetOrder.some(k => config[k])

  /* ── Edit mode — flat draggable list ─────────────────────── */
  if (editMode) {
    return (
      <section className={styles.sandbox} aria-label="Widget Sandbox">
        <div className={styles.sandboxHeader}>
          <div>
            <p className={styles.sandboxEyebrow}>Home · Workspace</p>
            <h2 className={styles.sandboxTitle}>Arrange Widgets</h2>
          </div>
          <button
            type="button"
            className={`${styles.manageBtn} ${styles.manageBtnActive}`}
            onClick={() => setEditMode(false)}
            aria-label="Finish editing widgets"
          >
            <span className={styles.manageBtnIcon} aria-hidden="true">✓</span>
            Done
          </button>
        </div>

        <div className={styles.editList} role="list" aria-label="Widget order — drag to reorder">
          {widgetOrder.map((key, index) => {
            const isDragging  = dragIndex === index
            const isDropZone  = dropIndex === index && dragIndex !== null && dragIndex !== index
            const isWide      = WIDGET_SIZE[key] === 'wide'
            return (
              <div
                key={key}
                role="listitem"
                className={[
                  styles.editRow,
                  isDragging  ? styles.editRowDragging  : '',
                  isDropZone  ? styles.editRowDropZone  : '',
                ].join(' ')}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <span className={styles.editDragHandle} aria-hidden="true">⠿</span>
                <span className={styles.editWidgetLabel}>
                  {WIDGET_LABELS[key]}
                  {isWide && (
                    <span className={styles.editWidthBadge}>wide</span>
                  )}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config[key]}
                  aria-label={`${config[key] ? 'Hide' : 'Show'} ${WIDGET_LABELS[key]}`}
                  className={`${styles.editToggle} ${config[key] ? styles.editToggleOn : styles.editToggleOff}`}
                  onClick={() => toggleWidget(key)}
                >
                  <span className={styles.editToggleThumb} />
                </button>
              </div>
            )
          })}
        </div>

        <p className={styles.editHint}>
          Drag ⠿ to reorder · toggle to show/hide
        </p>
      </section>
    )
  }

  /* ── Normal mode — masonry grid in user-defined order ─────── */
  return (
    <section className={styles.sandbox} aria-label="Widget Sandbox">

      <div className={styles.sandboxHeader}>
        <div>
          <p className={styles.sandboxEyebrow}>Home · Workspace</p>
          <h2 className={styles.sandboxTitle}>Dashboard</h2>
        </div>
        <button
          type="button"
          className={styles.manageBtn}
          onClick={() => setEditMode(true)}
          aria-label="Edit widgets"
        >
          <span className={styles.manageBtnIcon} aria-hidden="true">⊞</span>
          Edit
        </button>
      </div>

      {anyVisible ? (
        <div className={styles.masonryGrid}>
          {widgetOrder.map(key => (
            <AnimatedWidget
              key={key}
              visible={config[key]}
              wide={WIDGET_SIZE[key] === 'wide'}
              accent={WIDGET_ACCENT[key]}
            >
              {renderWidget(key)}
            </AnimatedWidget>
          ))}
        </div>
      ) : (
        <div className={styles.emptyGrid} aria-live="polite">
          <p className={styles.emptyGridIcon} aria-hidden="true">⊞</p>
          <p className={styles.emptyGridText}>
            All widgets are hidden.{' '}
            <button
              type="button"
              className={styles.inlineManageLink}
              onClick={() => setEditMode(true)}
            >
              Edit
            </button>
            {' '}to add one back.
          </p>
        </div>
      )}

    </section>
  )
}
