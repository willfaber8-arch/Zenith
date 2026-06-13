'use client'

import { useMemo }       from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import { db }            from '@/lib/db'
import { useNav }        from '@/lib/NavContext'
import styles            from './Widget.module.css'

function todayRange(): { startMs: number; endMs: number } {
  const d    = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function CalendarTodayWidget() {
  const { navigate } = useNav()
  const { startMs, endMs } = todayRange()

  const events = useLiveQuery(
    () => db?.calendarEvents
      .where('startMs').between(startMs, endMs, true, false)
      .limit(5)
      .toArray() ?? Promise.resolve([]),
    [startMs],
    [],
  )

  const dayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('calendar', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate('calendar', 'essentials')}
      aria-label="Open Universal Calendar"
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Today</p>
          <p className={styles.title}>{dayLabel}</p>
        </div>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {!events || events.length === 0 ? (
        <p className={styles.empty}>No events scheduled today.</p>
      ) : (
        <ul className={styles.eventList}>
          {events.map(ev => (
            <li key={ev.id} className={styles.eventItem}>
              <span
                className={styles.eventDot}
                style={{ background: 'var(--accent-purple)' }}
                aria-hidden="true"
              />
              <div className={styles.eventBody}>
                <span className={styles.eventTitle}>{ev.title}</span>
                {!ev.allDay && (
                  <span className={styles.eventTime}>{fmtTime(ev.startMs)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
