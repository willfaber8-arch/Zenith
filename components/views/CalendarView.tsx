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
import { useLiveQuery } from 'dexie-react-hooks'
import { useCalendarData } from '@/lib/hooks/useCalendarData'
import { db, type CalendarFeed, type CalendarEvent, type PersonalEvent, type TodoCategory, type TodoItem } from '@/lib/db'
import UniversityScheduleReplicator from '@/components/UniversityScheduleReplicator'
import CognitiveLoadMap from '@/components/CognitiveLoadMap'
import styles from './CalendarView.module.css'

/* ── Personal event color presets (mirrors habits color picker) ── */
const EVENT_COLORS = [
  '#7c95ff', '#52cca3', '#f59e0b', '#f87171',
  '#a78bfa', '#38bdf8', '#34d399', '#fb923c',
]

const PERSONAL_FEED_ID = -1

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

/* ── Month-grid utilities ──────────────────────────────────── */

/** 42-cell grid starting from the Monday of the week containing the 1st. */
function getMonthGridDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const dow      = firstDay.getDay()           // 0=Sun
  const offset   = dow === 0 ? 6 : dow - 1    // shift to Monday start
  const start    = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const FORMAT_MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric',
})

function formatMonthRange(d: Date): string {
  return FORMAT_MONTH_YEAR.format(d)
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

  const color   = (event as CalendarEvent & { _color?: string })._color ?? feed?.color ?? '#7c95ff'
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

/* ── MonthGrid ─────────────────────────────────────────────── */

interface MonthGridProps {
  year:       number
  month:      number       // 0-indexed
  events:     CalendarEvent[]
  feeds:      CalendarFeed[]
  onDayClick: (day: Date) => void
}

function MonthGrid({ year, month, events, feeds, onDayClick }: MonthGridProps) {
  const feedMap  = useMemo(() => new Map(feeds.map(f => [f.id, f])), [feeds])
  const gridDays = useMemo(() => getMonthGridDays(year, month), [year, month])

  /* Build a day-keyed event map (skip 11:59 banners — they clutter cells) */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const evt of events) {
      const d   = new Date(evt.startMs)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const arr = map.get(key) ?? []
      arr.push(evt)
      map.set(key, arr)
    }
    return map
  }, [events])

  const MAX_VISIBLE = 3

  return (
    <div className={styles.monthGrid}>
      {/* Day-of-week column headers */}
      <div className={styles.monthColHeaders}>
        {DAY_NAMES.map(n => (
          <div key={n} className={styles.monthColHeader}>{n}</div>
        ))}
      </div>

      {/* 6 weeks × 7 days = 42 cells */}
      <div className={styles.monthCells}>
        {gridDays.map((day, i) => {
          const inMonth = day.getMonth() === month
          const todayDay = isToday(day)
          const key      = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const dayEvts  = (eventsByDay.get(key) ?? []).sort((a, b) => a.startMs - b.startMs)
          const shown    = dayEvts.slice(0, MAX_VISIBLE)
          const extra    = dayEvts.length - shown.length

          return (
            <div
              key={i}
              className={`${styles.monthCell}${!inMonth ? ` ${styles.monthCellOut}` : ''}${todayDay ? ` ${styles.monthCellToday}` : ''}`}
              onClick={() => onDayClick(day)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onDayClick(day) }}
              aria-label={`${FORMAT_WEEKDAY_FULL.format(day)}, ${dayEvts.length} event${dayEvts.length !== 1 ? 's' : ''}`}
            >
              <span className={`${styles.monthCellNum}${todayDay ? ` ${styles.monthCellNumToday}` : ''}`}>
                {day.getDate()}
              </span>
              <div className={styles.monthEvtList}>
                {shown.map(evt => {
                  const feed  = feedMap.get(evt.feedId)
                  const color = (evt as CalendarEvent & { _color?: string })._color ?? feed?.color ?? '#7c95ff'
                  return (
                    <div
                      key={evt.id}
                      className={styles.monthEvt}
                      style={{
                        background:  `${color}28`,
                        borderLeft:  `2px solid ${color}cc`,
                      }}
                      title={`${evt.title}${evt.allDay ? '' : ` · ${formatTime(evt.startMs)}`}`}
                    >
                      {!evt.allDay && (
                        <span className={styles.monthEvtTime}>{formatTime(evt.startMs)}</span>
                      )}
                      <span className={styles.monthEvtTitle}>{evt.title}</span>
                    </div>
                  )
                })}
                {extra > 0 && (
                  <div className={styles.monthEvtMore}>+{extra} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — CalendarView (default export)
   ══════════════════════════════════════════════════════════════ */

type ViewMode = 'week' | 'month' | 'agenda'

/* ── EmptyPersonal ─────────────────────────────────────────── */

function EmptyPersonal({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">📅</span>
      <p className={styles.emptyTitle}>Your personal calendar is empty</p>
      <p className={styles.emptySubtitle}>
        Add your own events — classes, appointments, reminders — and color-code them however you like.
      </p>
      <button type="button" className={styles.feedToggleBtn} onClick={onAdd} style={{ marginTop: 'var(--sp-2)' }}>
        + Create your first event
      </button>
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

/* ── TasksPanel ────────────────────────────────────────────── */

const DEFAULT_CATEGORIES = [
  { name: 'Short Term', sortOrder: 0 },
  { name: 'Long Term',  sortOrder: 1 },
]

function TasksPanel() {
  const categories = useLiveQuery(
    () => db?.todo_categories.orderBy('id').toArray() ?? Promise.resolve([]),
    [],
  ) as TodoCategory[] | undefined

  const items = useLiveQuery(
    () => db?.todo_items.orderBy('id').toArray() ?? Promise.resolve([]),
    [],
  ) as TodoItem[] | undefined

  /* Seed default categories once */
  useEffect(() => {
    if (!db || categories === undefined) return
    if (categories.length === 0) {
      void db.todo_categories.bulkAdd(
        DEFAULT_CATEGORIES.map(c => ({ ...c, createdAt: Date.now() }))
      )
    }
  }, [categories])

  const [addingCategory,   setAddingCategory]   = useState(false)
  const [newCatName,       setNewCatName]       = useState('')
  /* per-category add-task state: categoryId → { title, dueDate } */
  const [addTaskState, setAddTaskState] = useState<Record<number, { title: string; dueDate: string }>>({})

  const getTaskState = (catId: number) =>
    addTaskState[catId] ?? { title: '', dueDate: '' }

  const setTaskField = (catId: number, field: 'title' | 'dueDate', value: string) =>
    setAddTaskState(prev => ({
      ...prev,
      [catId]: { ...getTaskState(catId), [field]: value },
    }))

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name || !db) return
    await db.todo_categories.add({ name, sortOrder: (categories?.length ?? 0), createdAt: Date.now() })
    setNewCatName('')
    setAddingCategory(false)
  }

  const handleDeleteCategory = async (id: number) => {
    if (!db) return
    await db.todo_items.where('categoryId').equals(id).delete()
    await db.todo_categories.delete(id)
  }

  const handleAddTask = async (catId: number) => {
    const { title, dueDate } = getTaskState(catId)
    if (!title.trim() || !db) return
    await db.todo_items.add({
      categoryId: catId,
      title: title.trim(),
      completed: 0,
      dueDate: dueDate || undefined,
      createdAt: Date.now(),
    })
    setAddTaskState(prev => ({ ...prev, [catId]: { title: '', dueDate: '' } }))
  }

  const handleToggleTask = async (item: TodoItem) => {
    if (!db) return
    await db.todo_items.update(item.id!, { completed: item.completed === 0 ? 1 : 0 })
  }

  const handleDeleteTask = async (id: number) => {
    if (!db) return
    await db.todo_items.delete(id)
  }

  const today = new Date().toISOString().slice(0, 10)

  if (categories === undefined || items === undefined) return null

  return (
    <div className={styles.tasksPanel}>
      <div className={styles.tasksPanelHeader}>
        <p className={styles.tasksPanelTitle}>To-Do Lists</p>
        {!addingCategory && (
          <button type="button" className={styles.addCategoryBtn} onClick={() => setAddingCategory(true)}>
            + New List
          </button>
        )}
      </div>

      {addingCategory && (
        <div className={styles.newCategoryRow}>
          <input
            type="text"
            className={styles.newCategoryInput}
            placeholder="List name…"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleAddCategory()
              if (e.key === 'Escape') { setAddingCategory(false); setNewCatName('') }
            }}
            autoFocus
          />
          <button type="button" className={styles.newCategoryConfirm} onClick={() => void handleAddCategory()}>
            Add
          </button>
          <button type="button" className={styles.newCategoryCancel} onClick={() => { setAddingCategory(false); setNewCatName('') }}>
            Cancel
          </button>
        </div>
      )}

      {categories.length === 0 && !addingCategory && (
        <p className={styles.tasksEmpty}>No lists yet. Click &ldquo;+ New List&rdquo; to get started.</p>
      )}

      {categories.map(cat => {
        const catItems = items.filter(i => i.categoryId === cat.id)
        const openCount = catItems.filter(i => i.completed === 0).length
        const taskState = getTaskState(cat.id!)

        return (
          <div key={cat.id} className={styles.taskCategory}>
            <div className={styles.taskCategoryHeader}>
              <span className={styles.taskCategoryName}>{cat.name}</span>
              <span className={styles.taskCategoryCount}>{openCount} open</span>
              <button
                type="button"
                className={styles.deleteCategoryBtn}
                onClick={() => void handleDeleteCategory(cat.id!)}
                aria-label={`Delete list ${cat.name}`}
                title="Delete list"
              >
                ✕
              </button>
            </div>

            {catItems.length > 0 && (
              <ul className={styles.taskList}>
                {catItems.map(item => {
                  const isOverdue = item.completed === 0 && item.dueDate && item.dueDate < today
                  return (
                    <li key={item.id} className={styles.taskItem}>
                      <button
                        type="button"
                        className={`${styles.taskCheckbox} ${item.completed === 1 ? styles.taskCheckboxDone : ''}`}
                        onClick={() => void handleToggleTask(item)}
                        aria-label={item.completed === 1 ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {item.completed === 1 && <span className={styles.taskCheckMark}>✓</span>}
                      </button>
                      <span className={`${styles.taskTitle} ${item.completed === 1 ? styles.taskTitleDone : ''}`}>
                        {item.title}
                      </span>
                      {item.dueDate && (
                        <span className={`${styles.taskDueDate} ${isOverdue ? styles.taskDueDateOverdue : ''}`}>
                          {isOverdue ? '⚠ ' : ''}{item.dueDate}
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.deleteTaskBtn}
                        onClick={() => void handleDeleteTask(item.id!)}
                        aria-label="Delete task"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className={styles.addTaskRow}>
              <input
                type="text"
                className={styles.addTaskInput}
                placeholder="Add a task…"
                value={taskState.title}
                onChange={e => setTaskField(cat.id!, 'title', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleAddTask(cat.id!) }}
              />
              <input
                type="date"
                className={styles.addTaskDateInput}
                value={taskState.dueDate}
                onChange={e => setTaskField(cat.id!, 'dueDate', e.target.value)}
                aria-label="Optional due date"
                title="Optional due date"
              />
              <button
                type="button"
                className={styles.addTaskSubmit}
                onClick={() => void handleAddTask(cat.id!)}
                disabled={!taskState.title.trim()}
              >
                Add
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CalendarView() {
  const { feeds, events, isFetching, addFeed, deleteFeed, refreshFeed } =
    useCalendarData()

  const [view,          setView]          = useState<ViewMode>('week')
  const [weekStart,     setWeekStart]     = useState(() => getWeekStart(new Date()))
  const [feedPanelOpen, setFeedPanelOpen] = useState(false)
  const [gridKey,       setGridKey]       = useState(0)
  const [calTab,        setCalTab]        = useState<'personal' | 'feeds' | 'schedule' | 'tasks'>('personal')
  const [showNewEvent,  setShowNewEvent]  = useState(false)
  const [editEvent,     setEditEvent]     = useState<PersonalEvent | null>(null)

  /* Month view state */
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const goToPrevMonth = useCallback(() => {
    setMonthStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setMonthStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))
  }, [])

  const goToCurrentMonth = useCallback(() => {
    const d = new Date()
    setMonthStart(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [])

  const isCurrentMonth = useMemo(() => {
    const now = new Date()
    return monthStart.getFullYear() === now.getFullYear() &&
           monthStart.getMonth()    === now.getMonth()
  }, [monthStart])

  /* Month day click — drill into week view for that week */
  const handleMonthDayClick = useCallback((day: Date) => {
    setWeekStart(getWeekStart(day))
    setGridKey(k => k + 1)
    setView('week')
  }, [])

  /* Personal events from IDB */
  const personalEventsRaw = useLiveQuery(
    () => db?.personalEvents.orderBy('startMs').toArray() ?? Promise.resolve([]),
    [],
  )

  /* Synthetic feed entry for personal events */
  const personalFeed: CalendarFeed = useMemo(() => ({
    id: PERSONAL_FEED_ID, label: 'Personal', url: '',
    color: '#7c95ff', isActive: 1, lastFetchedAt: 0, createdAt: 0,
  }), [])

  /* Convert personal events to CalendarEvent-compatible shape */
  const personalAsCalEvents: CalendarEvent[] = useMemo(() =>
    (personalEventsRaw ?? []).map(pe => ({
      id:          pe.id * -1,   // negative id to avoid collision with feed events
      feedId:      PERSONAL_FEED_ID,
      uid:         `personal-${pe.id}`,
      title:       pe.title,
      startMs:     pe.startMs,
      endMs:       pe.endMs,
      allDay:      pe.allDay,
      is1159:      0,
      category:    pe.category,
      description: pe.description,
      _color:      pe.color,     // extra field read by EventPillEl
    } as CalendarEvent & { _color?: string })),
  [personalEventsRaw])

  /* All events & feeds for the week grid */
  const allEvents = useMemo(() => [...events, ...personalAsCalEvents], [events, personalAsCalEvents])
  const allFeeds  = useMemo(() => [personalFeed, ...feeds], [personalFeed, feeds])

  /* Personal event CRUD */
  const handleAddEvent = useCallback(async (data: Omit<PersonalEvent, 'id'>) => {
    if (!db) return
    await db.personalEvents.add(data as PersonalEvent)
  }, [])

  const handleEditEvent = useCallback(async (data: Omit<PersonalEvent, 'id'>) => {
    if (!db || !editEvent?.id) return
    await db.personalEvents.update(editEvent.id, data)
    setEditEvent(null)
  }, [editEvent])

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

  /* Keyboard shortcuts: ← / → to navigate weeks or months */
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (view === 'month') {
        if (e.key === 'ArrowLeft')  goToPrevMonth()
        if (e.key === 'ArrowRight') goToNextMonth()
      } else {
        if (e.key === 'ArrowLeft')  goToPrev()
        if (e.key === 'ArrowRight') goToNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, goToPrev, goToNext, goToPrevMonth, goToNextMonth])

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
            {(['week', 'month', 'agenda'] as ViewMode[]).map(v => (
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
        </div>
      </header>

      {/* ── Calendar source tab bar ───────────────────── */}
      <div className={styles.calTabBar}>
        <button
          type="button"
          className={`${styles.calTab} ${calTab === 'personal' ? styles.calTabActive : ''}`}
          onClick={() => { setCalTab('personal'); setFeedPanelOpen(false) }}
        >
          <span className={styles.calTabDot} style={{ background: '#7c95ff' }} aria-hidden="true" />
          Personal
        </button>
        <button
          type="button"
          className={`${styles.calTab} ${calTab === 'feeds' ? styles.calTabActive : ''}`}
          onClick={() => setCalTab('feeds')}
        >
          <span className={styles.calTabDot} style={{ background: '#52cca3' }} aria-hidden="true" />
          iCal Feeds
          {feeds.length > 0 && <span className={styles.calTabCount}>{feeds.length}</span>}
        </button>
        <button
          type="button"
          className={`${styles.calTab} ${calTab === 'schedule' ? styles.calTabActive : ''}`}
          onClick={() => { setCalTab('schedule'); setFeedPanelOpen(false) }}
        >
          <span className={styles.calTabDot} style={{ background: '#f59e0b' }} aria-hidden="true" />
          Course Schedule
        </button>
        <button
          type="button"
          className={`${styles.calTab} ${calTab === 'tasks' ? styles.calTabActive : ''}`}
          onClick={() => { setCalTab('tasks'); setFeedPanelOpen(false) }}
        >
          <span className={styles.calTabDot} style={{ background: '#a78bfa' }} aria-hidden="true" />
          Tasks
        </button>

        {calTab === 'personal' && (
          <button
            type="button"
            className={styles.newEventBtn}
            onClick={() => setShowNewEvent(true)}
          >
            + New Event
          </button>
        )}
      </div>

      {/* ── Feed manager panel ────────────────────────── */}
      {calTab === 'feeds' && (
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

      {calTab === 'schedule' && (
        <div className={styles.scheduleTabContent}>
          <UniversityScheduleReplicator
            onDone={() => setCalTab('personal')}
          />
          <div className={styles.cognitiveLoadSection}>
            <div className={styles.cognitiveLoadHeader}>
              <span className={styles.cognitiveLoadEyebrow}>Course Load · Cognitive Forecast</span>
            </div>
            <CognitiveLoadMap />
          </div>
        </div>
      )}

      {calTab === 'tasks' && <TasksPanel />}

      {/* ── Week / Month navigation bar ───────────────── */}
      {(view === 'week' || view === 'month') && (
        <nav
          className={styles.weekNav}
          aria-label={view === 'month' ? 'Month navigation' : 'Week navigation'}
        >
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={view === 'month' ? goToPrevMonth : goToPrev}
            aria-label={view === 'month' ? 'Previous month' : 'Previous week'}
          >←</button>
          <span className={styles.weekRange} aria-live="polite">
            {view === 'month' ? formatMonthRange(monthStart) : formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            className={styles.weekNavBtn}
            onClick={view === 'month' ? goToNextMonth : goToNext}
            aria-label={view === 'month' ? 'Next month' : 'Next week'}
          >→</button>
          {view === 'week' && !isCurrentWeek && (
            <button type="button" className={styles.todayBtn} onClick={goToToday}>Today</button>
          )}
          {view === 'month' && !isCurrentMonth && (
            <button type="button" className={styles.todayBtn} onClick={goToCurrentMonth}>Today</button>
          )}
        </nav>
      )}

      {/* ── 11:59 deadline banners (week view) ───────── */}
      {view === 'week' && allEvents.length > 0 && (
        <DeadlineBanners weekDays={weekDays} events={allEvents} feeds={allFeeds} />
      )}

      {/* ── Main content area ─────────────────────────── */}
      {view === 'week' ? (
        allEvents.length === 0 ? (
          calTab === 'personal'
            ? <EmptyPersonal onAdd={() => setShowNewEvent(true)} />
            : <EmptyCalendar onOpenFeedPanel={() => setCalTab('feeds')} />
        ) : (
          <WeekGrid key={gridKey} weekDays={weekDays} events={allEvents} feeds={allFeeds} />
        )
      ) : view === 'month' ? (
        <MonthGrid
          year={monthStart.getFullYear()}
          month={monthStart.getMonth()}
          events={allEvents}
          feeds={allFeeds}
          onDayClick={handleMonthDayClick}
        />
      ) : (
        <AgendaList events={allEvents} feeds={allFeeds} />
      )}

      {/* ── Modals ────────────────────────────────────── */}
      {showNewEvent && (
        <NewEventModal onClose={() => setShowNewEvent(false)} onSave={handleAddEvent} />
      )}
      {editEvent && (
        <NewEventModal onClose={() => setEditEvent(null)} onSave={handleEditEvent} initial={editEvent} />
      )}

    </div>
  )
}

/* ── NewEventModal ─────────────────────────────────────────── */

function NewEventModal({
  onClose, onSave, initial,
}: {
  onClose:  () => void
  onSave:   (e: Omit<PersonalEvent, 'id'>) => void
  initial?: PersonalEvent
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const initDate = initial ? new Date(initial.startMs).toISOString().slice(0, 10) : todayStr
  const initStart = initial && !initial.allDay
    ? new Date(initial.startMs).toTimeString().slice(0, 5)
    : '09:00'
  const initEnd = initial && !initial.allDay
    ? new Date(initial.endMs).toTimeString().slice(0, 5)
    : '10:00'

  const [title,   setTitle]   = useState(initial?.title ?? '')
  const [date,    setDate]    = useState(initDate)
  const [start,   setStart]   = useState(initStart)
  const [end,     setEnd]     = useState(initEnd)
  const [allDay,  setAllDay]  = useState((initial?.allDay ?? 0) === 1)
  const [color,   setColor]   = useState(initial?.color ?? '#7c95ff')
  const [cat,     setCat]     = useState(initial?.category ?? 'personal')
  const [desc,    setDesc]    = useState(initial?.description ?? '')

  const canSave = title.trim().length > 0 && date.length > 0

  function handleSave() {
    if (!canSave) return
    const startMs = allDay
      ? new Date(date + 'T00:00:00').getTime()
      : new Date(`${date}T${start}:00`).getTime()
    const endMs = allDay
      ? startMs + 86_400_000
      : Math.max(startMs + 900_000, new Date(`${date}T${end}:00`).getTime())
    onSave({
      title:    title.trim(),
      startMs, endMs,
      allDay:   allDay ? 1 : 0,
      color,
      category: cat,
      description: desc.trim() || undefined,
      createdAt:   Date.now(),
    })
    onClose()
  }

  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const CATEGORIES = ['personal', 'scholastic', 'exam', 'life', 'general']

  return (
    <>
      <div className={styles.eventModalBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.eventModal} role="dialog" aria-modal="true">
        <div className={styles.eventModalHeader}>
          <p className={styles.eventModalEyebrow}>Personal Calendar</p>
          <p className={styles.eventModalTitle}>{initial ? 'Edit Event' : 'New Event'}</p>
        </div>

        <div className={styles.eventModalForm}>
          <div className={styles.evField}>
            <label className={styles.evLabel} htmlFor="ev-title">Title *</label>
            <input
              id="ev-title" type="text" className={styles.evInput} autoFocus
              placeholder="e.g. Study group, Doctor appointment…"
              value={title} onChange={e => setTitle(e.target.value)} required
            />
          </div>

          <div className={styles.evRow}>
            <div className={styles.evField}>
              <label className={styles.evLabel} htmlFor="ev-date">Date *</label>
              <input id="ev-date" type="date" className={styles.evInput} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <label className={styles.evCheckRow}>
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              <span className={styles.evLabel}>All day</span>
            </label>
          </div>

          {!allDay && (
            <div className={styles.evRow}>
              <div className={styles.evField}>
                <label className={styles.evLabel} htmlFor="ev-start">Start time</label>
                <input id="ev-start" type="time" className={styles.evInput} value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div className={styles.evField}>
                <label className={styles.evLabel} htmlFor="ev-end">End time</label>
                <input id="ev-end" type="time" className={styles.evInput} value={end} onChange={e => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div className={styles.evRow}>
            <div className={styles.evField}>
              <label className={styles.evLabel} htmlFor="ev-cat">Category</label>
              <select id="ev-cat" className={styles.evInput} value={cat} onChange={e => setCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.evField}>
            <span className={styles.evLabel}>Color</span>
            <div className={styles.evColorRow}>
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.evColorSwatch} ${color === c ? styles.evColorSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <label className={`${styles.evColorSwatch} ${styles.evColorSwatchCustom} ${!EVENT_COLORS.includes(color) ? styles.evColorSwatchActive : ''}`} style={{ background: color }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>⊕</span>
                <input type="color" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={color} onChange={e => setColor(e.target.value)} />
              </label>
            </div>
          </div>

          <div className={styles.evField}>
            <label className={styles.evLabel} htmlFor="ev-desc">Description (optional)</label>
            <input id="ev-desc" type="text" className={styles.evInput} placeholder="Add a note…" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div className={styles.evActions}>
            <button type="button" className={styles.evCancelBtn} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.evSaveBtn} onClick={handleSave} disabled={!canSave}>
              {initial ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

