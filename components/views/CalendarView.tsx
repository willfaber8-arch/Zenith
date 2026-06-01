'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — CalendarView  (Universal Calendar)
 * Phase 2 · Step 2.5 — iCal / Canvas Feed Aggregate Matrix
 *
 * Architecture:
 *   CalendarView      — top-level orchestrator; all state lives here
 *   FeedPanel         — collapsible URL input + active feeds manager
 *   WeekGrid          — 7-column hourly time grid with positioned pills
 *   DeadlineBanners   — 11:59 PM events extracted above the grid
 *   AgendaList        — fallback flat chronological list view
 *   EventPillEl       — individual timed event inside the week grid
 *
 * 11:59 PM rule (spec §2):
 *   Any event whose local end time is exactly 23:59 is extracted from
 *   the hourly scroll timeline and rendered as a top-pinned banner with
 *   --accent-purple border and a pulsing dot indicator.
 *
 * Animation:
 *   View entrance: anim-scale-in (globals.css)
 *   Feed panel:    scaleIn keyframe on mount
 *   Agenda rows:   staggered slideIn via animationDelay
 *   On week change: short opacity/scale transition via inline style
 * ════════════════════════════════════════════════════════════════
 */

import {
  useState, useEffect, useRef, useMemo, useCallback,
  type ChangeEvent, type KeyboardEvent,
} from 'react'
import { useCalendarData } from '@/lib/hooks/useCalendarData'
import type { CalendarFeed, CalendarEvent } from '@/lib/db'
import styles from './CalendarView.module.css'

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — Date utilities
   ══════════════════════════════════════════════════════════════ */

const HOUR_PX   = 60   // pixels per one hour slot in the week grid
const DAY_MS    = 86_400_000
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Returns the Monday of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d   = new Date(date)
  const day = d.getDay()                        // 0 = Sun, 1 = Mon …
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns an array of 7 Date objects (Mon … Sun) for the given week. */
function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

const FORMAT_MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric',
})
const FORMAT_MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})
const FORMAT_TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
})
const FORMAT_WEEKDAY_FULL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
})

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS)
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${FORMAT_MONTH_DAY.format(weekStart)} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
  }
  return `${FORMAT_MONTH_DAY.format(weekStart)} – ${FORMAT_MONTH_DAY_YEAR.format(weekEnd)}`
}

function formatTime(ms: number): string {
  return FORMAT_TIME.format(new Date(ms))
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — Event grouping helpers
   ══════════════════════════════════════════════════════════════ */

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const start = day.getTime()
  const end   = start + DAY_MS
  return events.filter(e => e.startMs >= start && e.startMs < end)
}

/** Current-time progress within today as a pixel offset from midnight. */
function getNowOffset(): number {
  const now = new Date()
  return (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_PX
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — Sub-components
   ══════════════════════════════════════════════════════════════ */

/* ── FeedPanel ─────────────────────────────────────────────── */

interface FeedPanelProps {
  feeds:       CalendarFeed[]
  isFetching:  boolean
  onAdd:       (url: string, label: string) => void
  onDelete:    (id: number) => void
  onRefresh:   (feed: CalendarFeed) => void
}

function FeedPanel({
  feeds, isFetching, onAdd, onDelete, onRefresh,
}: FeedPanelProps) {
  const [url,   setUrl]   = useState('')
  const [label, setLabel] = useState('')

  const handleAdd = () => {
    onAdd(url, label)
    setUrl('')
    setLabel('')
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className={styles.feedPanel} role="region" aria-label="Calendar feed manager">
      <p className={styles.feedPanelLabel}>Calendar Feeds</p>

      <div className={styles.addFeedRow}>
        <input
          type="url"
          className={styles.feedInput}
          placeholder="Paste iCal / Canvas subscription URL  (webcal:// or https://)"
          value={url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={handleKey}
          aria-label="Feed URL"
          autoComplete="off"
          spellCheck={false}
        />
        <input
          type="text"
          className={styles.feedInput}
          placeholder="Label  (optional)"
          value={label}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          onKeyDown={handleKey}
          aria-label="Feed label"
          maxLength={40}
        />
        <button
          type="button"
          className={styles.addFeedBtn}
          onClick={handleAdd}
          disabled={isFetching || !url.trim()}
          aria-busy={isFetching}
        >
          {isFetching ? 'Importing…' : '+ Add Feed'}
        </button>
      </div>

      {feeds.length > 0 ? (
        <ul className={styles.feedList} role="list">
          {feeds.map(feed => (
            <li key={feed.id} className={styles.feedChip}>
              <span
                className={styles.feedChipDot}
                style={{ background: feed.color }}
                aria-hidden="true"
              />
              <span className={styles.feedChipLabel} title={feed.url}>
                {feed.label}
              </span>
              <span className={styles.feedChipActions}>
                <button
                  type="button"
                  className={styles.feedChipBtn}
                  onClick={() => onRefresh(feed)}
                  disabled={isFetching}
                  aria-label={`Refresh ${feed.label}`}
                  title="Refresh"
                >
                  ↺
                </button>
                <button
                  type="button"
                  className={`${styles.feedChipBtn} ${styles.feedChipBtnDelete}`}
                  onClick={() => onDelete(feed.id)}
                  aria-label={`Remove ${feed.label}`}
                  title="Remove feed"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.feedEmptyHint}>
          No feeds yet — paste an iCal URL above to import your schedule.
        </p>
      )}
    </div>
  )
}

/* ── DeadlineBanners ───────────────────────────────────────── */

interface DeadlineBannersProps {
  weekDays: Date[]
  events:   CalendarEvent[]
  feeds:    CalendarFeed[]
}

function DeadlineBanners({ weekDays, events, feeds }: DeadlineBannersProps) {
  const feedMap = useMemo(() => new Map(feeds.map(f => [f.id, f])), [feeds])

  const bannersByDay = useMemo(
    () => weekDays.map(day =>
      getEventsForDay(events, day).filter(e => e.is1159 === 1),
    ),
    [weekDays, events],
  )

  const hasAny = bannersByDay.some(arr => arr.length > 0)
  if (!hasAny) return null

  return (
    <div
      className={styles.bannerSection}
      role="region"
      aria-label="11:59 PM deadlines"
    >
      <div className={styles.bannerSectionHeader}>
        <span className={styles.bannerSectionIcon} aria-hidden="true" />
        <span className={styles.bannerSectionLabel}>11:59 PM Deadlines</span>
      </div>

      <div className={styles.bannerRow} role="list">
        <div className={styles.bannerGutter} aria-hidden="true" />
        {bannersByDay.map((dayBanners, i) => (
          <div
            key={i}
            className={styles.bannerCell}
            role="listitem"
            aria-label={`${DAY_NAMES[i]} deadlines`}
          >
            {dayBanners.map(evt => {
              const feed = feedMap.get(evt.feedId)
              return (
                <div
                  key={evt.id}
                  className={styles.deadlineBanner}
                  title={`${evt.title}${evt.location ? ` · ${evt.location}` : ''}`}
                  role="article"
                  aria-label={`Deadline: ${evt.title}`}
                >
                  <span
                    className={styles.deadlineTime}
                    style={feed ? { color: feed.color } : undefined}
                  >
                    11:59
                  </span>
                  <span className={styles.deadlineTitle}>{evt.title}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── EventPillEl ───────────────────────────────────────────── */

interface EventPillElProps {
  event:   CalendarEvent
  feed?:   CalendarFeed
}

function EventPillEl({ event, feed }: EventPillElProps) {
  const start = new Date(event.startMs)
  const end   = new Date(event.endMs)

  const startMins   = start.getHours() * 60 + start.getMinutes()
  const endMins     = end.getHours()   * 60 + end.getMinutes()
  const durationMin = Math.max(endMins - startMins, 20) // min height

  const top    = (startMins / 60) * HOUR_PX
  const height = (durationMin / 60) * HOUR_PX - 2

  const color   = feed?.color ?? '#7c95ff'
  const bgAlpha = height < 30 ? '22' : '18'  // slightly denser for short pills

  return (
    <div
      className={styles.eventPill}
      style={{
        top:             `${top}px`,
        height:          `${height}px`,
        backgroundColor: `${color}${bgAlpha}`,
        borderLeft:      `2px solid ${color}cc`,
      }}
      title={`${event.title}\n${formatTime(event.startMs)} – ${formatTime(event.endMs)}${event.location ? `\n${event.location}` : ''}`}
      role="article"
      aria-label={event.title}
    >
      <span className={styles.eventPillTitle}>{event.title}</span>
      {height >= 30 && (
        <span className={styles.eventPillTime}>
          {formatTime(event.startMs)}
        </span>
      )}
      {height >= 46 && (
        <span className={styles.eventPillCat}>{event.category}</span>
      )}
    </div>
  )
}

/* ── WeekGrid ──────────────────────────────────────────────── */

interface WeekGridProps {
  weekDays: Date[]
  events:   CalendarEvent[]
  feeds:    CalendarFeed[]
}

function WeekGrid({ weekDays, events, feeds }: WeekGridProps) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const feedMap    = useMemo(() => new Map(feeds.map(f => [f.id, f])), [feeds])
  const [nowOffset, setNowOffset] = useState(getNowOffset)

  /* Auto-scroll to current hour on mount */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = Math.max(getNowOffset() - 120, 0)  // show 2h above now
    el.scrollTop = target
  }, [])

  /* Update the now-line every minute */
  useEffect(() => {
    setNowOffset(getNowOffset())
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000)
    return () => clearInterval(id)
  }, [])

  const todayIdx = weekDays.findIndex(d => isToday(d))

  return (
    <div
      className={styles.weekWrapper}
      ref={scrollRef}
      role="grid"
      aria-label="Week calendar grid"
    >
      {/* Sticky day-header row */}
      <div className={styles.weekDayHeader} role="row">
        <div className={styles.weekDayHeaderGutter} aria-hidden="true" />
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={`${styles.weekDayHeaderCell} ${isToday(day) ? styles.dayHeaderToday : ''}`}
            role="columnheader"
            aria-label={FORMAT_WEEKDAY_FULL.format(day)}
          >
            <span className={styles.dayName}>{DAY_NAMES[i]}</span>
            <span className={styles.dayNumber}>{day.getDate()}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className={styles.timeGrid} role="presentation">

        {/* Left time gutter — 24 hour labels */}
        <div className={styles.timeGutter} aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className={styles.hourLabel}>
              {h === 0 ? '' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
            </div>
          ))}
        </div>

        {/* 7 day columns */}
        {weekDays.map((day, colIdx) => {
          const dayEvents = getEventsForDay(events, day)
          const timedEvts = dayEvents.filter(e => e.is1159 !== 1 && e.allDay !== 1)

          return (
            <div
              key={colIdx}
              className={styles.dayColumn}
              role="gridcell"
              aria-label={FORMAT_WEEKDAY_FULL.format(day)}
            >
              {/* Hour guide lines */}
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className={styles.hourGuide}
                  style={{ top: `${h * HOUR_PX}px` }}
                  aria-hidden="true"
                />
              ))}

              {/* Quarter-hour sub-guides */}
              {Array.from({ length: 24 * 3 }, (_, q) => (
                <div
                  key={q}
                  className={styles.quarterGuide}
                  style={{ top: `${(q + 1) * (HOUR_PX / 4)}px` }}
                  aria-hidden="true"
                />
              ))}

              {/* Current-time line (today column only) */}
              {colIdx === todayIdx && (
                <div
                  className={styles.nowLine}
                  style={{ top: `${nowOffset}px` }}
                  aria-hidden="true"
                />
              )}

              {/* Event pills */}
              {timedEvts.map(evt => (
                <EventPillEl
                  key={evt.id}
                  event={evt}
                  feed={feedMap.get(evt.feedId)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── AgendaList ────────────────────────────────────────────── */

interface AgendaListProps {
  events: CalendarEvent[]
  feeds:  CalendarFeed[]
}

function AgendaList({ events, feeds }: AgendaListProps) {
  const feedMap = useMemo(() => new Map(feeds.map(f => [f.id, f])), [feeds])

  /* Group upcoming events by ISO date (next 60 days) */
  const groups = useMemo(() => {
    const nowMs = Date.now()
    const limit = nowMs + 60 * DAY_MS

    const upcoming = events
      .filter(e => e.startMs >= nowMs && e.startMs <= limit)

    const byDate = new Map<string, CalendarEvent[]>()
    for (const evt of upcoming) {
      const d    = new Date(evt.startMs)
      const key  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const arr  = byDate.get(key) ?? []
      arr.push(evt)
      byDate.set(key, arr)
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evts]) => ({
        key,
        date:   new Date(evts[0].startMs),
        events: evts.sort((a, b) => a.startMs - b.startMs),
      }))
  }, [events])

  if (groups.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon} aria-hidden="true">📅</span>
        <p className={styles.emptyTitle}>No upcoming events</p>
        <p className={styles.emptySubtitle}>
          Add a calendar feed above to populate your agenda.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.agendaList} role="feed" aria-label="Agenda">
      {groups.map(({ key, date, events: grpEvts }, groupIdx) => (
        <section
          key={key}
          className={`${styles.agendaDateGroup} ${isToday(date) ? styles.agendaDateToday : ''}`}
          style={{ animationDelay: `${groupIdx * 40}ms` }}
          aria-label={FORMAT_WEEKDAY_FULL.format(date)}
        >
          <div className={styles.agendaDateLabel}>
            <span className={styles.agendaDateText}>
              {isToday(date) ? 'Today' : FORMAT_WEEKDAY_FULL.format(date)}
            </span>
            <div className={styles.agendaDateLine} aria-hidden="true" />
          </div>

          <ul className={styles.agendaEvents} role="list">
            {grpEvts.map(evt => {
              const feed = feedMap.get(evt.feedId)
              return (
                <li
                  key={evt.id}
                  className={`${styles.agendaEvent} ${evt.is1159 ? styles.agendaEventIs1159 : ''}`}
                  style={feed ? { borderLeftColor: `${feed.color}88` } : undefined}
                >
                  <div className={styles.agendaEventTime}>
                    {evt.allDay ? (
                      <span className={styles.agendaEventTimeLabel}>All day</span>
                    ) : (
                      <span className={styles.agendaEventTimeLabel}>
                        {formatTime(evt.startMs)}
                      </span>
                    )}
                    {evt.is1159 === 1 && (
                      <span className={styles.agendaEventDeadlineTag}>
                        Deadline
                      </span>
                    )}
                  </div>

                  <div className={styles.agendaEventBody}>
                    <p className={styles.agendaEventTitle}>{evt.title}</p>
                    <div className={styles.agendaEventMeta}>
                      <span className={styles.agendaEventCat}>{evt.category}</span>
                      {evt.location && (
                        <span className={styles.agendaEventLocation}>
                          {evt.location}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — CalendarView (default export)
   ══════════════════════════════════════════════════════════════ */

type ViewMode = 'week' | 'agenda'

export default function CalendarView() {
  const { feeds, events, isFetching, addFeed, deleteFeed, refreshFeed } =
    useCalendarData()

  const [view,          setView]          = useState<ViewMode>('week')
  const [weekStart,     setWeekStart]     = useState(() => getWeekStart(new Date()))
  const [feedPanelOpen, setFeedPanelOpen] = useState(false)
  const [gridKey,       setGridKey]       = useState(0)  // forces re-mount on nav

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  /* Week navigation */
  const goToPrev = useCallback(() => {
    setWeekStart(prev => new Date(prev.getTime() - 7 * DAY_MS))
    setGridKey(k => k + 1)
  }, [])

  const goToNext = useCallback(() => {
    setWeekStart(prev => new Date(prev.getTime() + 7 * DAY_MS))
    setGridKey(k => k + 1)
  }, [])

  const goToToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()))
    setGridKey(k => k + 1)
  }, [])

  /* Keyboard shortcuts: ← / → to navigate weeks */
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft')  goToPrev()
      if (e.key === 'ArrowRight') goToNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goToPrev, goToNext])

  const isCurrentWeek = isSameDay(weekStart, getWeekStart(new Date()))

  /* Feed-panel toggle dot: show if any feeds active */
  const hasFeedDot = feeds.length > 0

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Page header ──────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>Life · Universal Calendar</p>
          <h1 className={styles.title}>Calendar</h1>
        </div>

        <div className={styles.headerRight}>
          {/* View mode toggle */}
          <div className={styles.viewToggle} role="group" aria-label="Calendar view">
            {(['week', 'agenda'] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
                onClick={() => setView(v)}
                aria-pressed={view === v}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Feed manager toggle */}
          <button
            type="button"
            className={`${styles.feedToggleBtn} ${feedPanelOpen ? styles.feedToggleBtnActive : ''}`}
            onClick={() => setFeedPanelOpen(p => !p)}
            aria-expanded={feedPanelOpen}
            aria-controls="feed-panel"
          >
            {hasFeedDot && (
              <span className={styles.feedDot} aria-hidden="true" />
            )}
            Feeds
          </button>
        </div>
      </header>

      {/* ── Feed manager panel ────────────────────────── */}
      {feedPanelOpen && (
        <div id="feed-panel">
          <FeedPanel
            feeds={feeds}
            isFetching={isFetching}
            onAdd={addFeed}
            onDelete={deleteFeed}
            onRefresh={refreshFeed}
          />
        </div>
      )}

      {/* ── Week navigation bar (week view only) ─────── */}
      {view === 'week' && (
        <nav className={styles.weekNav} aria-label="Week navigation">
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={goToPrev}
            aria-label="Previous week"
          >
            ←
          </button>
          <span className={styles.weekRange} aria-live="polite">
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={goToNext}
            aria-label="Next week"
          >
            →
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              className={styles.todayBtn}
              onClick={goToToday}
            >
              Today
            </button>
          )}
        </nav>
      )}

      {/* ── 11:59 deadline banners (week view) ───────── */}
      {view === 'week' && events.length > 0 && (
        <DeadlineBanners
          weekDays={weekDays}
          events={events}
          feeds={feeds}
        />
      )}

      {/* ── Main content area ─────────────────────────── */}
      {view === 'week' ? (
        events.length === 0 && feeds.length === 0 ? (
          <EmptyCalendar onOpenFeedPanel={() => setFeedPanelOpen(true)} />
        ) : (
          <WeekGrid
            key={gridKey}
            weekDays={weekDays}
            events={events}
            feeds={feeds}
          />
        )
      ) : (
        <AgendaList events={events} feeds={feeds} />
      )}

    </div>
  )
}

/* ── EmptyCalendar ─────────────────────────────────────────── */

function EmptyCalendar({ onOpenFeedPanel }: { onOpenFeedPanel: () => void }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">🗓</span>
      <p className={styles.emptyTitle}>No calendar feeds connected</p>
      <p className={styles.emptySubtitle}>
        Paste your Canvas iCal subscription URL or any .ics feed link
        to import your academic schedule and deadlines.
      </p>
      <button
        type="button"
        className={styles.feedToggleBtn}
        onClick={onOpenFeedPanel}
        style={{ marginTop: 'var(--sp-2)' }}
      >
        + Add your first feed
      </button>
    </div>
  )
}
