'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import styles from './Widget.module.css'

export default function StudyStreakWidget() {
  const { navigate } = useNav()

  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })()

  const sessions = useLiveQuery(
    () => db?.pomodoroSessions
      .where('completedAt')
      .between(
        new Date(weekAgo + 'T00:00:00').getTime(),
        new Date(today   + 'T23:59:59').getTime(),
        true, true,
      )
      .toArray() ?? Promise.resolve([]),
    [today, weekAgo],
    [],
  )

  const todayStart = new Date(today + 'T00:00:00').getTime()
  const todayEnd   = new Date(today + 'T23:59:59').getTime()

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
      onKeyDown={e => e.key === 'Enter' && navigate('study-shield', 'essentials')}
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
