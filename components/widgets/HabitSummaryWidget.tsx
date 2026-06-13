'use client'

import { useHabits }  from '@/lib/hooks/useHabits'
import { useNav }     from '@/lib/NavContext'
import styles         from './Widget.module.css'

const RADIUS = 38
const CIRC   = 2 * Math.PI * RADIUS

export default function HabitSummaryWidget() {
  const { habits, dailyPct, scheduledCount, doneCount } = useHabits()
  const { navigate } = useNav()

  const dashOffset = scheduledCount === 0 ? CIRC : CIRC * (1 - dailyPct / 100)

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('habits', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate('habits', 'essentials')}
      aria-label="Open Habits"
      style={{ '--widget-accent': 'var(--accent-green)' } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Life · Habits</p>
          <p className={styles.title}>Today's Habits</p>
        </div>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {habits.length === 0 ? (
        <p className={styles.empty}>No habits yet. Click to create one.</p>
      ) : (
        <div className={styles.ringLayout}>
          <div className={styles.ringWrap} aria-hidden="true">
            <svg viewBox="0 0 96 96" className={styles.ringSvg}>
              <circle cx="48" cy="48" r={RADIUS} fill="none" strokeWidth="4.5" className={styles.ringTrack} />
              <circle
                cx="48" cy="48" r={RADIUS} fill="none" strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={dashOffset}
                className={styles.ringProgress}
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.ringPct}>{dailyPct}<span className={styles.ringPctSuffix}>%</span></span>
              <span className={styles.ringLabel}>{doneCount}/{scheduledCount}</span>
            </div>
          </div>

          <ul className={styles.habitList} aria-label={`${doneCount} of ${scheduledCount} habits done today`}>
            {habits.slice(0, 4).map(h => (
              <li key={h.id} className={`${styles.habitRow} ${h.todayDone ? styles.habitRowDone : ''}`}>
                <span className={styles.habitCheck} aria-label={h.todayDone ? 'completed' : 'pending'}>
                  {h.todayDone ? '✓' : '○'}
                </span>
                <span className={styles.habitName}>{h.name}</span>
                {h.streakCount > 0 && (
                  <span className={styles.habitStreak}>{h.streakCount}🔥</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
