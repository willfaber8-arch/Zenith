'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import styles from './Widget.module.css'
import { dayBoundsMs } from '@/utils/dayBoundary'

export default function StudyStreakWidget() {
  const { navigate } = useNav()

  /*
   * "Sessions today" runs cutoff to cutoff, not midnight to midnight.
   *
   * Counted by the calendar day, a session finished at 00:05 reset the
   * number to zero at the moment it was earned — the user watched the
   * count they had just added to go back to nothing mid-study.
   */
  const [todayStart, todayEnd] = dayBoundsMs()
  const weekStart = (() => {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - 6)
    return d.getTime()
  })()

  const sessions = useLiveQuery(
    () => db?.pomodoroSessions
      .where('completedAt')
      .between(weekStart, todayEnd, true, true)
      .toArray() ?? Promise.resolve([]),
    [weekStart, todayEnd],
    [],
  )

  const todaySessions  = (sessions ?? []).filter(
    s => s.sessionType === 'work' && s.completedAt >= todayStart && s.completedAt <= todayEnd
  ).length

  const weeklySessions = (sessions ?? []).filter(s => s.sessionType === 'work').length
  const weeklyMinutes  = weeklySessions * 25

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('study-shield', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('study-shield', 'essentials') }}
      aria-label="Study Streak — go to Study Shield"
      style={{ '--widget-accent': 'var(--accent-purple)' } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <p className={styles.eyebrow}>Study Shield</p>
        <span className={styles.navArrow} aria-hidden="true">›</span>
      </div>

      <p className={styles.widgetTitle}>Study Streak</p>

      <div className={styles.widgetBody}>
        <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-end' }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize:   '2.2rem',
              fontWeight: 700,
              lineHeight: 1,
              color:      'var(--text-primary)',
            }}>
              {todaySessions}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '4px' }}>
              sessions today
            </p>
          </div>
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize:   '1.4rem',
              fontWeight: 600,
              lineHeight: 1,
              color:      'var(--text-muted)',
            }}>
              {weeklyMinutes}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '4px' }}>
              min this week
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
