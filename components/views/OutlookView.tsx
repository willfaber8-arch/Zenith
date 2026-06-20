'use client'

import { useState, useMemo }  from 'react'
import { useLiveQuery }       from 'dexie-react-hooks'
import { db }                 from '@/lib/db'
import {
  useHabits,
  isHabitScheduledOn,
  todayISO as getTodayISO,
} from '@/lib/hooks/useHabits'
import ZenHeading             from '@/components/ui/ZenHeading'
import styles                 from './OutlookView.module.css'

/* ── Date utilities ──────────────────────────────────────────── */

function toISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayBounds(d: Date): [number, number] {
  const s = new Date(d); s.setHours(0, 0, 0, 0)
  const e = new Date(d); e.setHours(23, 59, 59, 999)
  return [s.getTime(), e.getTime()]
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours(); const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDayLabel(d: Date): string {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

/* ── Priority colours ────────────────────────────────────────── */

const PRIORITY_DOT: Record<string, string> = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#fbbf24',
  low:      '#94a3b8',
}

/* ── SVG habit progress ring ─────────────────────────────────── */

const R = 9, CIRC = 2 * Math.PI * R

function HabitRing({ pct, color }: { pct: number; color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className={styles.ring}>
      <circle cx="13" cy="13" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
      <circle
        cx="13" cy="13" r={R}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - Math.min(pct, 1))}
        strokeLinecap="round"
        transform="rotate(-90 13 13)"
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════
   TODAY PANEL
   ════════════════════════════════════════════════════════════ */

function TodayPanel() {
  const today     = new Date()
  const todayStr  = toISO(today)
  const [s, e]    = dayBounds(today)

  const { habits, increment } = useHabits()

  // Calendar events today
  const calEvts = useLiveQuery(
    () => db?.calendarEvents.where('startMs').between(s, e, true, true).sortBy('startMs') ?? Promise.resolve([]),
    [s, e],
  ) ?? []

  // Personal events today
  const persEvts = useLiveQuery(
    () => db?.personalEvents.where('startMs').between(s, e, true, true).sortBy('startMs') ?? Promise.resolve([]),
    [s, e],
  ) ?? []

  // All events merged + sorted
  const allEvts = useMemo(
    () => [...calEvts, ...persEvts].sort((a, b) => a.startMs - b.startMs),
    [calEvts, persEvts],
  )

  // Assignments — overdue OR due today
  const assignments = useLiveQuery(
    () => db?.assignments.toArray() ?? Promise.resolve([]),
    [],
  ) ?? []

  const todayTasks = useMemo(
    () => assignments
      .filter(a => {
        if (a.status === 'completed') return false
        const d = (a.dueDate ?? '').slice(0, 10)
        return d <= todayStr
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [assignments, todayStr],
  )

  const scheduledHabits = habits.filter(h => isHabitScheduledOn(h, todayStr))
  const habitsDone      = scheduledHabits.filter(h => h.todayDone).length
  const habitsPct       = scheduledHabits.length > 0 ? habitsDone / scheduledHabits.length : 0
  const overdueCount    = todayTasks.filter(a => (a.dueDate ?? '').slice(0, 10) < todayStr).length

  async function markDone(id: number) {
    await db?.assignments.update(id, { status: 'completed' })
  }

  return (
    <div className={styles.panel}>

      {/* ── Summary hero strip ──────────────────────────── */}
      <div className={styles.summaryRow}>
        <div className={`${styles.statCard} ${styles.statCalendar}`}>
          <span className={styles.statIcon}>◇</span>
          <span className={styles.statNum}>{allEvts.length}</span>
          <span className={styles.statLabel}>{allEvts.length === 1 ? 'Event' : 'Events'}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statHabits}`}>
          <HabitRing pct={habitsPct} color="#52cca3" />
          <span className={styles.statNum}>{habitsDone}<span className={styles.statOf}>/{scheduledHabits.length}</span></span>
          <span className={styles.statLabel}>Habits</span>
        </div>
        <div className={`${styles.statCard} ${overdueCount > 0 ? styles.statTasksAlert : styles.statTasks}`}>
          <span className={styles.statIcon}>{overdueCount > 0 ? '!' : '✓'}</span>
          <span className={styles.statNum}>{todayTasks.length}</span>
          <span className={styles.statLabel}>{todayTasks.length === 1 ? 'Task due' : 'Tasks due'}</span>
        </div>
      </div>

      {/* ── Events ──────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <h2 className={styles.sectionLabel}>
          <span className={`${styles.sectionGlyph} ${styles.glyphCalendar}`}>◇</span>
          Calendar
          {allEvts.length > 0 && (
            <span className={styles.count}>{allEvts.length}</span>
          )}
        </h2>

        {allEvts.length === 0 ? (
          <p className={styles.empty}>No events scheduled today.</p>
        ) : (
          <ul className={styles.list}>
            {allEvts.map((ev, i) => (
              <li key={`${ev.id}-${i}`} className={styles.eventRow}>
                <span
                  className={styles.eventDot}
                  style={{ background: (ev as { _color?: string })._color ?? 'var(--accent-purple)' }}
                />
                <span className={styles.eventTime}>{fmtTime(ev.startMs)}</span>
                <span className={styles.eventTitle}>{ev.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Habits ──────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <h2 className={styles.sectionLabel}>
          <span className={`${styles.sectionGlyph} ${styles.glyphHabits}`}>◆</span>
          Habits
          {scheduledHabits.length > 0 && (
            <span className={styles.count}>
              {scheduledHabits.filter(h => h.todayDone).length}/{scheduledHabits.length}
            </span>
          )}
        </h2>

        {scheduledHabits.length === 0 ? (
          <p className={styles.empty}>No habits scheduled today.</p>
        ) : (
          <ul className={styles.list}>
            {scheduledHabits.map(h => {
              const pct  = h.todayCount / h.targetCompletions
              const color = h.color ?? '#7c95ff'
              const label = h.stepLabel
                ? `${h.todayCount}/${h.targetCompletions} ${h.stepLabel}`
                : h.todayDone ? 'Done' : `${h.todayCount}/${h.targetCompletions}`
              return (
                <li key={h.id} className={`${styles.habitRow} ${h.todayDone ? styles.habitDone : ''}`}>
                  <HabitRing pct={pct} color={color} />
                  <span className={styles.habitName}>{h.name}</span>
                  <span className={styles.habitMeta}>{label}</span>
                  {!h.todayDone && (
                    <button
                      className={styles.habitBtn}
                      onClick={() => increment(h.id!)}
                      aria-label={`Log ${h.name}`}
                      type="button"
                    >
                      +
                    </button>
                  )}
                  {h.todayDone && (
                    <span className={styles.doneCheck} aria-label="Complete">✓</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Tasks ───────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionCard}`}>
        <h2 className={styles.sectionLabel}>
          <span className={`${styles.sectionGlyph} ${styles.glyphTasks}`}>✓</span>
          Due Today
          {todayTasks.length > 0 && (
            <span className={styles.count}>{todayTasks.length}</span>
          )}
        </h2>

        {todayTasks.length === 0 ? (
          <p className={styles.empty}>No tasks due today — you're clear.</p>
        ) : (
          <ul className={styles.list}>
            {todayTasks.map(a => {
              const overdue = (a.dueDate ?? '').slice(0, 10) < todayStr
              return (
                <li key={a.id} className={styles.taskRow}>
                  <button
                    className={styles.taskCheck}
                    onClick={() => markDone(a.id!)}
                    aria-label={`Complete ${a.title}`}
                    type="button"
                  />
                  <span className={styles.taskTitle}>{a.title}</span>
                  <span
                    className={styles.priorityDot}
                    style={{ background: PRIORITY_DOT[a.priority ?? 'low'] }}
                    title={a.priority ?? ''}
                  />
                  {overdue && <span className={styles.overdueBadge}>Overdue</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   WEEK PANEL
   ════════════════════════════════════════════════════════════ */

function WeekPanel() {
  const todayDate = new Date()
  const todayStr  = toISO(todayDate)

  // Build 7 day objects starting today
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = addDays(todayDate, i)
      return { date: d, iso: toISO(d), label: fmtDayLabel(d), isToday: i === 0 }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayStr],
  )

  const weekStart = days[0].date
  const weekEnd   = addDays(days[6].date, 1)
  const wsMs      = weekStart.getTime()
  const weMs      = weekEnd.getTime()

  // All cal events this week
  const calEvts = useLiveQuery(
    () => db?.calendarEvents.where('startMs').between(wsMs, weMs, true, false).toArray() ?? Promise.resolve([]),
    [wsMs, weMs],
  ) ?? []

  const persEvts = useLiveQuery(
    () => db?.personalEvents.where('startMs').between(wsMs, weMs, true, false).toArray() ?? Promise.resolve([]),
    [wsMs, weMs],
  ) ?? []

  const assignments = useLiveQuery(
    () => db?.assignments.toArray() ?? Promise.resolve([]),
    [],
  ) ?? []

  // Habits summary for today
  const { habits, increment } = useHabits()
  const scheduledToday = habits.filter(h => isHabitScheduledOn(h, todayStr))
  const doneToday      = scheduledToday.filter(h => h.todayDone).length

  // Group events by day ISO
  const evtsByDay = useMemo(() => {
    const map = new Map<string, { startMs: number; title: string; color?: string }[]>()
    for (const ev of [...calEvts, ...persEvts]) {
      const iso = toISO(new Date(ev.startMs))
      if (!map.has(iso)) map.set(iso, [])
      map.get(iso)!.push({
        startMs: ev.startMs,
        title:   ev.title,
        color:   (ev as { _color?: string })._color,
      })
    }
    // Sort each day's events by time
    map.forEach(arr => arr.sort((a, b) => a.startMs - b.startMs))
    return map
  }, [calEvts, persEvts])

  // Group assignments by due date
  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof assignments>()
    for (const a of assignments) {
      if (a.status === 'completed') continue
      const iso = (a.dueDate ?? '').slice(0, 10)
      // Include overdue tasks on today's row
      const key = iso < todayStr ? todayStr : iso
      if (!days.find(d => d.iso === key)) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [assignments, days, todayStr])

  async function markDone(id: number) {
    await db?.assignments.update(id, { status: 'completed' })
  }

  return (
    <div className={styles.panel}>

      {/* ── Habit streak row ──────────────────────────────── */}
      {scheduledToday.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>
            Today&apos;s Habits
            <span className={styles.count}>{doneToday}/{scheduledToday.length}</span>
          </h2>
          <ul className={styles.habitWeekRow}>
            {scheduledToday.map(h => (
              <li key={h.id} className={styles.habitWeekItem}>
                <button
                  className={styles.habitWeekDot}
                  style={{
                    background: h.todayDone ? (h.color ?? '#7c95ff') : 'transparent',
                    borderColor: h.color ?? '#7c95ff',
                  }}
                  onClick={() => !h.todayDone && increment(h.id!)}
                  aria-label={`${h.name}${h.todayDone ? ' — done' : ' — tap to log'}`}
                  type="button"
                />
                <span className={styles.habitWeekLabel}>{h.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 7-day list ────────────────────────────────────── */}
      {days.map(({ iso, label, isToday }) => {
        const evts  = evtsByDay.get(iso) ?? []
        const tasks = tasksByDay.get(iso) ?? []
        if (!isToday && evts.length === 0 && tasks.length === 0) {
          return (
            <div key={iso} className={`${styles.dayCard} ${styles.dayCardEmpty}`}>
              <span className={styles.dayHeader}>
                {label}
                {isToday && <span className={styles.todayBadge}>Today</span>}
              </span>
              <span className={styles.emptyDay}>Nothing scheduled</span>
            </div>
          )
        }
        return (
          <div key={iso} className={`${styles.dayCard} ${isToday ? styles.dayCardToday : ''}`}>
            <div className={styles.dayHeader}>
              {label}
              {isToday && <span className={styles.todayBadge}>Today</span>}
            </div>

            {evts.map((ev, i) => (
              <div key={i} className={styles.weekEventRow}>
                <span
                  className={styles.weekEventDot}
                  style={{ background: ev.color ?? 'var(--accent-purple)' }}
                />
                <span className={styles.weekEventTime}>{fmtTime(ev.startMs)}</span>
                <span className={styles.weekEventTitle}>{ev.title}</span>
              </div>
            ))}

            {tasks.map(a => (
              <div key={a.id} className={styles.weekTaskRow}>
                <button
                  className={styles.taskCheck}
                  onClick={() => markDone(a.id!)}
                  aria-label={`Complete ${a.title}`}
                  type="button"
                />
                <span className={styles.weekTaskTitle}>{a.title}</span>
                <span
                  className={styles.priorityDot}
                  style={{ background: PRIORITY_DOT[a.priority ?? 'low'] }}
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ROOT
   ════════════════════════════════════════════════════════════ */

type OutlookTab = 'today' | 'week'

export default function OutlookView() {
  const [tab, setTab] = useState<OutlookTab>('today')
  const today = getTodayISO()

  // Nice header date like "Sunday, June 15"
  const dateLabel = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Essentials · Daily Overview"
        title={`Outlook`}
        subtitle={dateLabel}
        size="md"
      />

      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'today' ? styles.tabActive : ''}`}
          onClick={() => setTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'week' ? styles.tabActive : ''}`}
          onClick={() => setTab('week')}
        >
          This Week
        </button>
      </div>

      {tab === 'today' ? <TodayPanel /> : <WeekPanel />}
    </div>
  )
}
