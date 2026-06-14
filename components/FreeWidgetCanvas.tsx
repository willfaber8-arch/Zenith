'use client'

import {
  Component,
  useState, useEffect, useRef, useCallback,
  type ReactNode, type FormEvent,
} from 'react'
import { useLiveQuery }     from 'dexie-react-hooks'
import { useAuth }          from '@/lib/AuthContext'
import { db }               from '@/lib/db'
import { fetchWeather }     from '@/lib/weather'
import {
  WIDGET_LABELS,
  type SandboxConfig,
} from '@/lib/hooks/useSandboxConfig'

import HabitSummaryWidget      from './widgets/HabitSummaryWidget'
import PomodoroWidget          from './widgets/PomodoroWidget'
import WeatherWidget           from './widgets/WeatherWidget'
import CalendarTodayWidget     from './widgets/CalendarTodayWidget'
import StudyStreakWidget        from './widgets/StudyStreakWidget'
import UniHubWidget            from './widgets/UniHubWidget'
import CardioWidget            from './widgets/CardioWidget'
import RelationshipNotesWidget from './widgets/RelationshipNotesWidget'
import DistanceTrackerWidget   from './widgets/DistanceTrackerWidget'
import FriendsWidget           from './widgets/FriendsWidget'
import LeaderboardWidget       from './widgets/LeaderboardWidget'
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
import BiomeWidget             from './BiomeWidget'
import AudioAtmosphereWidget  from './AudioAtmosphereWidget'
import styles from './FreeWidgetCanvas.module.css'

/* ─── Types ──────────────────────────────────────────────────── */

type WidgetKey = keyof SandboxConfig
type FreeKey   = 'greeting' | 'biome' | 'friends' | 'leaderboard' | 'atmosphere' | WidgetKey

type Pos = { x: number; y: number }
type FreePositions   = Partial<Record<FreeKey, Pos>>
type FreeVisibility  = Record<FreeKey, boolean>
type FreeSizes       = Partial<Record<FreeKey, number>>
type FreeScales      = Partial<Record<FreeKey, number>>
type FreeBackgrounds = Partial<Record<FreeKey, string>>

/* ─── Constants ──────────────────────────────────────────────── */

const POSITIONS_KEY   = 'zenith_widget_positions_v2'
const VISIBILITY_KEY  = 'zenith_free_visibility_v1'
const SIZES_KEY       = 'zenith_widget_sizes_v1'
const SCALES_KEY      = 'zenith_widget_scales_v1'
const BACKGROUNDS_KEY = 'zenith_widget_backgrounds_v1'
const LOCKED_KEY      = 'zenith_free_locked_v1'

const GRID_SIZE    = 20   /* px — matches canvas dot-grid background-size */
const MAX_VISIBLE  = 16   /* soft cap — prevents off-screen chaos */
const SLOT_W       = 300  /* px — default widget width for slot calculation */
const SLOT_H       = 240  /* px — estimated widget height for row spacing */
const SLOT_GAP     = 20   /* px — gap between slots */
const SLOT_START_X = 20
const SLOT_START_Y = 20

/* Compute the Nth on-screen grid slot. Sidebar is ~96px, so subtract that. */
function findNextSlot(n: number): Pos {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  const usableW = Math.max(600, vw - 96 - SLOT_START_X)
  const cols = Math.max(1, Math.floor((usableW + SLOT_GAP) / (SLOT_W + SLOT_GAP)))
  const col = n % cols
  const row = Math.floor(n / cols)
  return {
    x: SLOT_START_X + col * (SLOT_W + SLOT_GAP),
    y: SLOT_START_Y + row * (SLOT_H + SLOT_GAP),
  }
}
const MIN_SCALE  = 1.0   /* can't shrink below natural size */
const MAX_SCALE  = 2.5   /* hard upper limit — 2.5× original */

/* Default backgrounds per widget — keyed by nav category.
   Each also overrides --surface-card on the item so the widget's
   own .card background inherits the colour automatically.

   Essentials / Scholastic → indigo-purple tint
   Creator's Choice        → deep green
   Social / Friends        → neutral slate
   Vault / neutral         → standard surface-card                      */
const DEFAULT_BACKGROUNDS: Partial<Record<FreeKey, string>> = {
  // Creator's Choice
  biome:           '#141923',   // neutral surface-card (prevents green bleed)
  // Social
  friends:         '#13161f',   // muted slate-dark
  leaderboard:     '#1b1508',   // warm amber-dark (matches amber widget-accent)
  distanceTracker: '#090e0a',   // dark moss (matches widget card bg)
  // Letterbox — parchment warmth
  letterbox:       '#141219',
  // Audio Atmosphere — coal mineral-dark (Phase 14.1)
  atmosphere:      '#0d0f12',
  // Life / Workouts — amber warmth (VP economy)
  cardioSummary:   '#1a1508',
  // Essentials / Scholastic — indigo-purple tint
  habitSummary:    '#151728',
  calendarToday:   '#151728',
  pomodoroPreview: '#151728',
  studyStreak:     '#151728',
  uniHub:          '#151728',
  localWeather:    '#151728',
}
const DEFAULT_BG = '#141923'   // neutral fallback (greeting, etc.)

/* All items are resizable. Per-key overrides; others use defaults. */
const MIN_WIDTHS: Partial<Record<FreeKey, number>> = { greeting: 280, biome: 220, letterbox: 220 }
const MAX_WIDTHS: Partial<Record<FreeKey, number>> = { greeting: 700, biome: 580, letterbox: 500 }
const DEFAULT_MIN_W = 150
const DEFAULT_MAX_W = 640

/* Per-widget border accent — overrides --border-subtle so the card
   border picks up the right category colour automatically.           */
const DEFAULT_BORDER_COLORS: Partial<Record<FreeKey, string>> = {
  leaderboard:     'rgba(245, 158,  11, 0.22)',   // amber
  friends:         'rgba(155, 163, 196, 0.18)',   // slate
  distanceTracker: 'rgba( 82, 204, 163, 0.18)',   // moss green
  atmosphere:      'rgba(194, 169, 128, 0.15)',   // parchment (audio widget)
}

const WIDGET_KEYS: WidgetKey[] = [
  'localWeather', 'habitSummary', 'calendarToday', 'pomodoroPreview',
  'studyStreak', 'uniHub', 'cardioSummary', 'letterbox', 'distanceTracker',
  'timerWidget', 'stopwatch', 'readingTracker', 'customLinks',
  'vocabTracker', 'gpaWidget', 'wellnessCheck', 'mealToday', 'newsHeadline', 'arcadeEconomy',
]

const ALL_FREE_KEYS: FreeKey[] = ['greeting', 'biome', 'atmosphere', 'friends', 'leaderboard', ...WIDGET_KEYS]

const ITEM_LABELS: Record<FreeKey, string> = {
  greeting:       'Greeting & Search',
  biome:          'Cozy Biome',
  atmosphere:     'Atmosphere',
  friends:        'Friends',
  leaderboard:    'Leaderboard',
  ...WIDGET_LABELS,
}

const ITEM_WIDTHS: Partial<Record<FreeKey, number>> = {
  greeting:    460,
  biome:       360,
  atmosphere:  340,
  friends:     300,
  leaderboard: 300,
}
const DEFAULT_WIDTH = 300

/* Default positions — 3-col grid, reasonable for a 1440px wide viewport */
const DEFAULT_POSITIONS: Record<FreeKey, Pos> = {
  greeting:        { x: 24,  y: 24  },
  biome:           { x: 720, y: 24  },
  localWeather:    { x: 24,  y: 320 },
  habitSummary:    { x: 344, y: 320 },
  calendarToday:   { x: 664, y: 320 },
  cardioSummary:   { x: 984, y: 320 },
  pomodoroPreview: { x: 24,  y: 580 },
  studyStreak:     { x: 344, y: 580 },
  uniHub:          { x: 664, y: 580 },
  letterbox:       { x: 984, y: 580 },
  distanceTracker: { x: 24,  y: 840 },
  friends:         { x: 344, y: 840 },
  leaderboard:     { x: 664, y: 840 },
  atmosphere:      { x: 984, y: 840 },
  timerWidget:     { x: 24,  y: 1100 },
  stopwatch:       { x: 344, y: 1100 },
  readingTracker:  { x: 664, y: 1100 },
  customLinks:     { x: 984, y: 1100 },
  vocabTracker:    { x: 24,  y: 1360 },
  gpaWidget:       { x: 344, y: 1360 },
  wellnessCheck:   { x: 664, y: 1360 },
  mealToday:       { x: 984, y: 1360 },
  newsHeadline:    { x: 24,  y: 1620 },
  arcadeEconomy:   { x: 344, y: 1620 },
}

const DEFAULT_VISIBILITY: FreeVisibility = {
  greeting:        true,
  biome:           true,
  atmosphere:      true,
  friends:         true,
  leaderboard:     true,
  localWeather:    true,
  habitSummary:    true,
  calendarToday:   true,
  pomodoroPreview: false,
  studyStreak:     true,
  uniHub:          false,
  cardioSummary:   true,
  letterbox:       true,
  distanceTracker: true,
  timerWidget:     false,
  stopwatch:       false,
  readingTracker:  false,
  customLinks:     false,
  vocabTracker:    false,
  gpaWidget:       false,
  wellnessCheck:   false,
  mealToday:       false,
  newsHeadline:    false,
  arcadeEconomy:   false,
}

/* ─── Persistence helpers ────────────────────────────────────── */

function loadPositions(): FreePositions {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(POSITIONS_KEY)
    if (raw) return JSON.parse(raw) as FreePositions
  } catch { /* noop */ }
  return {}
}

function savePositions(pos: FreePositions) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos)) } catch { /* noop */ }
}

function loadVisibility(): FreeVisibility {
  if (typeof window === 'undefined') return DEFAULT_VISIBILITY
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY)
    if (raw) return { ...DEFAULT_VISIBILITY, ...JSON.parse(raw) as Partial<FreeVisibility> }
  } catch { /* noop */ }
  return DEFAULT_VISIBILITY
}

function saveVisibility(v: FreeVisibility) {
  try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v)) } catch { /* noop */ }
}

function loadSizes(): FreeSizes {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SIZES_KEY)
    if (raw) return JSON.parse(raw) as FreeSizes
  } catch { /* noop */ }
  return {}
}

function saveSizes(s: FreeSizes) {
  try { localStorage.setItem(SIZES_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

function loadScales(): FreeScales {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SCALES_KEY)
    if (raw) return JSON.parse(raw) as FreeScales
  } catch { /* noop */ }
  return {}
}

function saveScales(s: FreeScales) {
  try { localStorage.setItem(SCALES_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

function loadBackgrounds(): FreeBackgrounds {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(BACKGROUNDS_KEY)
    if (raw) return JSON.parse(raw) as FreeBackgrounds
  } catch { /* noop */ }
  return {}
}

function saveBackgrounds(b: FreeBackgrounds) {
  try { localStorage.setItem(BACKGROUNDS_KEY, JSON.stringify(b)) } catch { /* noop */ }
}

function loadLocked(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(LOCKED_KEY) === 'true' } catch { return false }
}

function saveLocked(v: boolean) {
  try { localStorage.setItem(LOCKED_KEY, String(v)) } catch { /* noop */ }
}

function snap(v: number, grid: number) { return Math.round(v / grid) * grid }

/* ─── GreetingCard ───────────────────────────────────────────── */

function getPeriod(h: number) {
  if (h >= 5  && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ─── HexInput — controlled text field for direct hex entry ───── */

function HexInput({
  value,
  onChange,
}: {
  value:    string
  onChange: (hex: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  const is6 = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s)
  const is3 = (s: string) => /^#[0-9a-fA-F]{3}$/.test(s)
  const expand3 = (s: string) =>
    `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`

  const commit = (v: string) => {
    if (is6(v)) { onChange(v); return }
    if (is3(v)) { onChange(expand3(v)); return }
    setDraft(value) // revert to last valid on blur
  }

  return (
    <input
      type="text"
      className={styles.hexInput}
      value={draft}
      onChange={e => {
        const v = e.target.value
        setDraft(v)
        if (is6(v)) onChange(v) // live-apply on complete 6-digit hex
      }}
      onBlur={() => commit(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit(draft); e.currentTarget.blur() }
      }}
      maxLength={7}
      spellCheck={false}
      aria-label="Background hex color"
    />
  )
}

function GreetingCard() {
  const { session } = useAuth()
  const profile = useLiveQuery(
    async () => (db ? db.userProfile.get(1) : undefined),
    [],
  )
  const name = profile?.userName ?? session?.userHandle ?? '—'

  const [now,   setNow]   = useState<Date | null>(null)
  const [tempF, setTempF] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const data = await fetchWeather(coords.latitude, coords.longitude)
        if (data) setTempF(data.tempF)
      },
      () => {},
      { timeout: 8000 },
    )
  }, [])

  const period  = now ? getPeriod(now.getHours()) : 'Good evening'
  const timeStr = now
    ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--'
  const dateStr = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
      setQuery('')
    }
  }

  return (
    <div className={styles.greetingCard}>
      <p className={styles.gcSalutation}>{period},</p>
      <p className={styles.gcName}>{name}.</p>
      <div className={styles.gcMeta}>
        <time suppressHydrationWarning>{timeStr}</time>
        <span className={styles.gcDot} aria-hidden="true" />
        <time suppressHydrationWarning>{dateStr}</time>
        {tempF !== null && (
          <>
            <span className={styles.gcDot} aria-hidden="true" />
            <span suppressHydrationWarning>{tempF}°F</span>
          </>
        )}
      </div>
      <form className={styles.gcSearch} onSubmit={handleSearch} role="search" aria-label="Web search">
        <input
          type="text"
          className={styles.gcSearchInput}
          placeholder="Search the web…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setQuery('')}
        />
        <button
          type="submit"
          className={styles.gcSearchBtn}
          disabled={!query.trim()}
          aria-label="Run search"
        >↗</button>
      </form>
    </div>
  )
}

/* ─── Per-widget error boundary ──────────────────────────────── */
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
          [ WIDGET ERROR // {this.props.name} ]<br />
          This widget encountered a runtime error and has been isolated.
        </div>
      )
    }
    return this.props.children
  }
}

/* ─── Widget renderer ────────────────────────────────────────── */

function renderWidget(key: FreeKey): ReactNode {
  const w = (el: ReactNode) => (
    <WidgetErrorBoundary name={key}>{el}</WidgetErrorBoundary>
  )
  switch (key) {
    case 'greeting':         return w(<GreetingCard />)
    case 'biome':            return w(<BiomeWidget />)
    case 'atmosphere':       return w(<AudioAtmosphereWidget />)
    case 'timerWidget':      return w(<TimerWidget />)
    case 'stopwatch':        return w(<StopwatchWidget />)
    case 'readingTracker':   return w(<ReadingTrackerWidget />)
    case 'customLinks':      return w(<QuickLinksWidget />)
    case 'vocabTracker':     return w(<VocabWidget />)
    case 'gpaWidget':        return w(<GpaWidget />)
    case 'wellnessCheck':    return w(<WellnessWidget />)
    case 'mealToday':        return w(<MealWidget />)
    case 'newsHeadline':     return w(<NewsWidget />)
    case 'arcadeEconomy':    return w(<ArcadeWidget />)
    case 'localWeather':     return w(<WeatherWidget />)
    case 'habitSummary':     return w(<HabitSummaryWidget />)
    case 'calendarToday':    return w(<CalendarTodayWidget />)
    case 'pomodoroPreview':  return w(<PomodoroWidget />)
    case 'studyStreak':      return w(<StudyStreakWidget />)
    case 'uniHub':           return w(<UniHubWidget />)
    case 'cardioSummary':    return w(<CardioWidget />)
    case 'letterbox':        return w(<RelationshipNotesWidget />)
    case 'distanceTracker':  return w(<DistanceTrackerWidget />)
    case 'friends':          return w(<FriendsWidget />)
    case 'leaderboard':      return w(<LeaderboardWidget />)
  }
}

/* ════════════════════════════════════════════════════════════════
   FreeWidgetCanvas — one-screen drag canvas
   ════════════════════════════════════════════════════════════════ */

export default function FreeWidgetCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)

  /* ── Positions ─────────────────────────────────────────────── */
  const posRef   = useRef<FreePositions>({})
  const [posState, setPosState] = useState<FreePositions>({})

  /* ── Visibility ────────────────────────────────────────────── */
  const [visible, setVisible] = useState<FreeVisibility>(DEFAULT_VISIBILITY)

  /* ── Panel ─────────────────────────────────────────────────── */
  const [showPanel, setShowPanel] = useState(false)

  /* ── Sizes (width resize) ───────────────────────────────── */
  const sizesRef   = useRef<FreeSizes>({})
  const [sizeState, setSizeState] = useState<FreeSizes>({})

  /* ── Scales (corner resize — CSS transform:scale) ────────── */
  const scalesRef   = useRef<FreeScales>({})
  const [scaleState, setScaleState] = useState<FreeScales>({})

  /* ── Backgrounds (per-widget color) ────────────────────────── */
  const bgRef   = useRef<FreeBackgrounds>({})
  const [bgState, setBgState] = useState<FreeBackgrounds>({})

  /* ── Lock (freeze drag + resize) ────────────────────────────── */
  const lockedRef = useRef(false)
  const [locked, setLocked] = useState(false)

  /* ── Drag ──────────────────────────────────────────────────── */
  const dragRef = useRef<{
    key:    FreeKey
    startX: number
    startY: number
    origX:  number
    origY:  number
    moved:  boolean
  } | null>(null)
  const [dragging, setDragging] = useState<FreeKey | null>(null)

  /* ── Resize drag ─────────────────────────────────────────────
     mode 'edge'   = right-edge handle → width only
     mode 'corner' = corner handle     → CSS scale (uniform zoom) */
  const resizeDragRef = useRef<{
    key:       FreeKey
    startX:    number
    startY:    number
    origW:     number
    origScale: number
    mode:      'edge' | 'corner'
  } | null>(null)
  const [resizing,     setResizing]     = useState<FreeKey | null>(null)
  const [resizingMode, setResizingMode] = useState<'edge' | 'corner' | null>(null)

  /* ── Load from localStorage ─────────────────────────────────── */
  useEffect(() => {
    const loaded = loadPositions()
    posRef.current = loaded
    setPosState(loaded)
    setVisible(loadVisibility())
    const loadedSizes = loadSizes()
    sizesRef.current = loadedSizes
    setSizeState(loadedSizes)
    const loadedScales = loadScales()
    scalesRef.current = loadedScales
    setScaleState(loadedScales)
    const loadedBg = loadBackgrounds()
    bgRef.current = loadedBg
    setBgState(loadedBg)
    const initLocked = loadLocked()
    lockedRef.current = initLocked
    setLocked(initLocked)
  }, [])

  /* ── Document-level drag handlers ──────────────────────────── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      /* ── Resize drag ─────────────────────────────────────── */
      if (resizeDragRef.current) {
        const { key, startX, startY, origW, origScale, mode } = resizeDragRef.current

        if (mode === 'edge') {
          /* Right-edge handle → width only.
             Divide dx by origScale so visual width tracks mouse 1:1
             even when the widget already has a scale transform.
             Snap to GRID_SIZE for clean alignment.                       */
          const dx   = e.clientX - startX
          const minW = MIN_WIDTHS[key] ?? DEFAULT_MIN_W
          const maxW = MAX_WIDTHS[key] ?? DEFAULT_MAX_W
          const rawW = Math.max(minW, Math.min(maxW, origW + dx / origScale))
          const newW = snap(rawW, GRID_SIZE)
          sizesRef.current = { ...sizesRef.current, [key]: newW }
          setSizeState({ ...sizesRef.current })
        } else {
          /* Corner handle → CSS scale (whole widget grows uniformly).
             Use dx / origW so the visual right edge tracks the mouse
             exactly — 1 px drag right = 1 px visual width increase.
             Snap to 0.05 scale steps for consistent feel.               */
          const dx       = e.clientX - startX
          const rawScale = origScale + dx / origW
          const step     = 0.05
          const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
            Math.round(rawScale / step) * step))
          scalesRef.current = { ...scalesRef.current, [key]: newScale }
          setScaleState({ ...scalesRef.current })
        }
        return
      }
      /* ── Position drag (grid-snapped) ────────────────────── */
      if (!dragRef.current) return
      const { key, startX, startY, origX, origY } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true
      const x = snap(Math.max(0, origX + dx), GRID_SIZE)
      const y = snap(Math.max(0, origY + dy), GRID_SIZE)
      posRef.current = { ...posRef.current, [key]: { x, y } }
      setPosState({ ...posRef.current })
    }

    const onUp = () => {
      /* ── Resize end ──────────────────────────────────────── */
      if (resizeDragRef.current) {
        saveSizes(sizesRef.current)
        saveScales(scalesRef.current)
        resizeDragRef.current = null
        setResizing(null)
        setResizingMode(null)
        return
      }
      /* ── Position drag end ───────────────────────────────── */
      if (!dragRef.current) return
      const { key, moved } = dragRef.current
      const canvas = canvasRef.current
      if (canvas) {
        const w   = sizesRef.current[key] ?? ITEM_WIDTHS[key] ?? DEFAULT_WIDTH
        const s   = scalesRef.current[key] ?? 1
        const cur = posRef.current[key] ?? DEFAULT_POSITIONS[key]
        /* Account for scale so widget can't be dragged off the right edge */
        const maxX = Math.max(0, canvas.clientWidth  - Math.ceil(w * s) - 8)
        const maxY = Math.max(0, canvas.clientHeight - 60)
        posRef.current = {
          ...posRef.current,
          [key]: {
            x: snap(Math.min(cur.x, maxX), GRID_SIZE),
            y: snap(Math.min(cur.y, maxY), GRID_SIZE),
          },
        }
        setPosState({ ...posRef.current })
      }
      savePositions(posRef.current)
      dragRef.current = null
      setDragging(null)
      /* Suppress the click that fires on mouseup after a real drag */
      if (moved) {
        const suppressOnce = (e: MouseEvent) => {
          e.stopPropagation()
          document.removeEventListener('click', suppressOnce, true)
        }
        document.addEventListener('click', suppressOnce, true)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])

  /* ── Clamp every widget into the visible canvas ─────────────────
     The hardcoded DEFAULT_POSITIONS (and positions saved from a wider
     screen) can place widgets off the right edge on a smaller laptop —
     and a widget you can't see is a widget you can't drag back. This
     runs on mount and on every window resize so nothing is ever stranded
     off-screen. Only positions that actually overflow are rewritten, so
     on a wide screen this is a no-op (no spurious localStorage writes). */
  const clampToViewport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cw = canvas.clientWidth
    if (cw <= 0) return

    let changed = false
    const next: FreePositions = { ...posRef.current }
    for (const key of ALL_FREE_KEYS) {
      const eff = next[key] ?? DEFAULT_POSITIONS[key]
      const w   = sizesRef.current[key]  ?? ITEM_WIDTHS[key] ?? DEFAULT_WIDTH
      const s   = scalesRef.current[key] ?? 1
      const maxX = Math.max(0, cw - Math.ceil(w * s) - 8)
      const cx = snap(Math.min(Math.max(0, eff.x), maxX), GRID_SIZE)
      const cy = snap(Math.max(0, eff.y), GRID_SIZE)
      if (cx !== eff.x || cy !== eff.y) {
        next[key] = { x: cx, y: cy }
        changed = true
      }
    }
    if (changed) {
      posRef.current = next
      setPosState({ ...next })
      savePositions(next)
    }
  }, [])

  /* Run the clamp once the canvas is laid out, and again on resize. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => clampToViewport())
    window.addEventListener('resize', clampToViewport)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', clampToViewport)
    }
  }, [clampToViewport])

  const getPos = useCallback((key: FreeKey): Pos =>
    posRef.current[key] ?? DEFAULT_POSITIONS[key], [])

  /* Only the drag handle initiates a position drag */
  const handleDragStart = useCallback((key: FreeKey, e: React.MouseEvent) => {
    if (lockedRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos(key)
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false }
    setDragging(key)
  }, [getPos])

  /* Right-edge handle — width only */
  const handleResizeStart = useCallback((key: FreeKey, e: React.MouseEvent) => {
    if (lockedRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const origW      = sizesRef.current[key] ?? ITEM_WIDTHS[key] ?? DEFAULT_WIDTH
    const origScale  = scalesRef.current[key] ?? 1
    resizeDragRef.current = { key, startX: e.clientX, startY: e.clientY, origW, origScale, mode: 'edge' }
    setResizing(key)
    setResizingMode('edge')
  }, [])

  /* Corner handle — CSS scale resize */
  const handleCornerResizeStart = useCallback((key: FreeKey, e: React.MouseEvent) => {
    if (lockedRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const origW     = sizesRef.current[key] ?? ITEM_WIDTHS[key] ?? DEFAULT_WIDTH
    const origScale = scalesRef.current[key] ?? 1
    resizeDragRef.current = { key, startX: e.clientX, startY: e.clientY, origW, origScale, mode: 'corner' }
    setResizing(key)
    setResizingMode('corner')
  }, [])

  /* ── Lock toggle ───────────────────────────────────────────── */
  const toggleLock = useCallback(() => {
    const next = !lockedRef.current
    lockedRef.current = next
    setLocked(next)
    saveLocked(next)
  }, [])

  /* ── Background change ──────────────────────────────────────── */
  const handleBgChange = useCallback((key: FreeKey, color: string) => {
    const next = { ...bgRef.current, [key]: color }
    bgRef.current = next
    setBgState({ ...next })
    saveBackgrounds(next)
  }, [])

  /* ── Visibility toggle ──────────────────────────────────────── */
  const toggleItem = (key: FreeKey) => {
    setVisible(prev => {
      const turningOn = !prev[key]
      const currentCount = ALL_FREE_KEYS.filter(k => prev[k]).length

      // Enforce cap when enabling
      if (turningOn && currentCount >= MAX_VISIBLE) return prev

      // Auto-place if no saved position and no default on-screen position
      if (turningOn && !posRef.current[key]) {
        const slot = findNextSlot(currentCount)
        const newPos = { ...posRef.current, [key]: slot }
        posRef.current = newPos
        setPosState({ ...newPos })
        savePositions(newPos)
      }

      const next = { ...prev, [key]: !prev[key] }
      saveVisibility(next)
      return next
    })
  }

  /* ── Reset layout — repack all visible widgets on-screen ─────── */
  const resetLayout = () => {
    const keys = ALL_FREE_KEYS.filter(k => visible[k])
    const newPos: FreePositions = {}
    keys.forEach((k, i) => { newPos[k] = findNextSlot(i) })
    posRef.current = newPos
    setPosState({ ...newPos })
    savePositions(newPos)
  }

  const visibleKeys = ALL_FREE_KEYS.filter(k => visible[k])

  /* ── Listen for right-click "Disable widget" events ─────────── */
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key as FreeKey | undefined
      if (key && ALL_FREE_KEYS.includes(key)) toggleItem(key)
    }
    window.addEventListener('zenith:widget-toggle', handler)
    return () => window.removeEventListener('zenith:widget-toggle', handler)
  // toggleItem is stable (wrapped in setVisible functional update, no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className={styles.canvas} ref={canvasRef} data-ctx-type="WALLPAPER">

      {/* ── Draggable items ───────────────────────────────────── */}
      {visibleKeys.map(key => {
        const pos       = posState[key] ?? DEFAULT_POSITIONS[key]
        const w         = sizeState[key] ?? ITEM_WIDTHS[key] ?? DEFAULT_WIDTH
        const s         = scaleState[key] ?? 1
        const bg        = bgState[key] ?? DEFAULT_BACKGROUNDS[key] ?? DEFAULT_BG
        const borderClr = DEFAULT_BORDER_COLORS[key]
        const isDrag         = dragging === key
        const isResize       = resizing === key
        const isEdgeResize   = isResize && resizingMode === 'edge'
        const isCornerResize = isResize && resizingMode === 'corner'
        return (
          <div
            key={key}
            data-ctx-type="WIDGET"
            data-ctx-id={key}
            data-ctx-label={ITEM_LABELS[key]}
            className={[
              styles.item,
              isDrag         ? styles.itemDragging       : '',
              isEdgeResize   ? styles.itemResizing       : '',
              isCornerResize ? styles.itemResizingCorner : '',
              locked         ? styles.itemLocked         : '',
            ].join(' ')}
            style={{
              left:  pos.x,
              top:   pos.y,
              width: w,
              background:       bg,
              /* Cascade custom bg into the widget's .card via CSS var  */
              '--surface-card': bg,
              /* Per-widget border accent → overrides --border-subtle   */
              ...(borderClr ? { '--border-subtle': borderClr } : {}),
              ...(s !== 1 ? { transform: `scale(${s.toFixed(3)})`, transformOrigin: 'top left' } : {}),
            } as React.CSSProperties}
          >
            <div
              className={styles.dragHandle}
              title="Drag to move"
              onMouseDown={e => handleDragStart(key, e)}
            >⠿</div>
            {renderWidget(key)}
            {/* Right-edge handle — width (all items) */}
            <div
              className={`${styles.resizeHandle} ${isEdgeResize ? styles.resizeHandleActive : ''}`}
              title="Drag right edge to resize width"
              onMouseDown={e => handleResizeStart(key, e)}
            />
            {/* Corner handle — scale widget up/down (all items) */}
            <div
              className={`${styles.cornerHandle} ${isCornerResize ? styles.cornerHandleActive : ''}`}
              title="Drag corner to scale widget (max 2.5×)"
              onMouseDown={e => handleCornerResizeStart(key, e)}
            />
          </div>
        )
      })}

      {/* ── Lock button ─────────────────────────────────────── */}
      <button
        className={`${styles.panelToggleBtn} ${styles.lockBtn} ${locked ? styles.lockBtnOn : ''}`}
        onClick={toggleLock}
        aria-label={locked ? 'Unlock layout' : 'Lock layout'}
        title={locked ? 'Layout locked — click to unlock' : 'Lock layout to prevent accidental moves'}
      >
        <span className={styles.panelToggleIcon}>{locked ? '◉' : '○'}</span>
        <span className={styles.panelToggleLabel}>{locked ? 'Locked' : 'Lock'}</span>
      </button>

      {/* ── Manage panel button ──────────────────────────────── */}
      <button
        className={styles.panelToggleBtn}
        onClick={() => setShowPanel(p => !p)}
        aria-label="Manage visible widgets"
      >
        <span className={styles.panelToggleIcon}>{showPanel ? '✕' : '⚙'}</span>
        <span className={styles.panelToggleLabel}>{showPanel ? 'Close' : 'Manage'}</span>
      </button>

      {/* ── Manage panel ────────────────────────────────────── */}
      {showPanel && (
        <div className={styles.visPanel}>
          <p className={styles.visPanelTitle}>VISIBLE ITEMS &amp; COLORS</p>

          {/* Cap indicator */}
          <div className={styles.visPanelMeta}>
            <span className={`${styles.visPanelCount} ${visibleKeys.length >= MAX_VISIBLE ? styles.visPanelCountFull : ''}`}>
              {visibleKeys.length} / {MAX_VISIBLE} widgets
            </span>
            <button className={styles.resetBtn} onClick={resetLayout} title="Repack all visible widgets into an on-screen grid">
              ↺ Reset positions
            </button>
          </div>

          {visibleKeys.length >= MAX_VISIBLE && (
            <p className={styles.visPanelLimit}>
              [ CANVAS FULL ] Disable a widget to enable another.
            </p>
          )}

          {ALL_FREE_KEYS.map(key => {
            const atCap = visibleKeys.length >= MAX_VISIBLE && !visible[key]
            return (
              <div key={key} className={`${styles.visRow} ${atCap ? styles.visRowDisabled : ''}`}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={bgState[key] ?? DEFAULT_BACKGROUNDS[key] ?? DEFAULT_BG}
                  onChange={e => handleBgChange(key, e.target.value)}
                  title={`${ITEM_LABELS[key]} background color`}
                  disabled={atCap}
                />
                <HexInput
                  value={bgState[key] ?? DEFAULT_BACKGROUNDS[key] ?? DEFAULT_BG}
                  onChange={color => handleBgChange(key, color)}
                />
                <span className={styles.visLabel}>{ITEM_LABELS[key]}</span>
                <span
                  className={`${styles.visToggle} ${visible[key] ? styles.visToggleOn : ''} ${atCap ? styles.visToggleDisabled : ''}`}
                  onClick={() => !atCap && toggleItem(key)}
                  role="switch"
                  aria-checked={visible[key]}
                  aria-disabled={atCap}
                  tabIndex={atCap ? -1 : 0}
                  onKeyDown={e => !atCap && (e.key === 'Enter' || e.key === ' ') && toggleItem(key)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
