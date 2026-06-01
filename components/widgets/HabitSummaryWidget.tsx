'use client'

import { useHabitProgress } from '@/lib/hooks/useHabitProgress'
import styles from './Widget.module.css'

/* SVG ring geometry */
const RADIUS = 38
const CIRC   = 2 * Math.PI * RADIUS  // ≈ 238.76

export default function HabitSummaryWidget() {
  const { habits, total, completedToday, percentage, todayISO } =
    useHabitProgress()

  const dashOffset = total === 0 ? CIRC : CIRC * (1 - percentage / 100)

  return (
    <div
      className={styles.widget}
      style={{ '--widget-accent': 'var(--accent-green)' } as React.CSSProperties}
    >
      <div className={styles.widgetHeader}>
        <p className={styles.widgetEyebrow}>Life · Daily Habits</p>
      </div>

      <p className={styles.widgetTitle}>Habit Progress</p>

      <div className={styles.widgetBody}>

        {total === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">◎</span>
            <p className={styles.emptyText}>No habits tracked yet.</p>
          </div>
        ) : (
          <div className={styles.ringLayout}>

            {/* ── SVG ring ───────────────────────────────────── */}
            <div className={styles.ringWrap} aria-hidden="true">
              <svg viewBox="0 0 96 96" className={styles.ringSvg}>
                {/* Background track */}
                <circle
                  cx="48" cy="48" r={RADIUS}
                  fill="none"
                  strokeWidth="4.5"
                  className={styles.ringTrack}
                />
                {/* Progress arc */}
                <circle
                  cx="48" cy="48" r={RADIUS}
                  fill="none"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={`${CIRC} ${CIRC}`}
                  strokeDashoffset={dashOffset}
                  className={styles.ringProgress}
                />
              </svg>
              {/* Centre label */}
              <div className={styles.ringCenter}>
                <span className={styles.ringPct}>
                  {percentage}
                  <span className={styles.ringPctSuffix}>%</span>
                </span>
                <span className={styles.ringLabel}>
                  {completedToday}/{total}
                </span>
              </div>
            </div>

            {/* ── Habit list (top 4) ─────────────────────────── */}
            <ul
              className={styles.habitList}
              aria-label={`${completedToday} of ${total} habits completed today`}
            >
              {habits.slice(0, 4).map(h => {
                const done = h.lastCompletedDate === todayISO
                return (
                  <li
                    key={h.id}
                    className={`${styles.habitRow} ${done ? styles.habitRowDone : ''}`}
                  >
                    <span
                      className={styles.habitCheck}
                      aria-label={done ? 'completed' : 'pending'}
                    >
                      {done ? '✓' : '○'}
                    </span>
                    <span className={styles.habitName}>{h.name}</span>
                    {h.streakCount > 0 && (
                      <span className={styles.habitStreak} aria-label={`${h.streakCount} day streak`}>
                        {h.streakCount}🔥
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
