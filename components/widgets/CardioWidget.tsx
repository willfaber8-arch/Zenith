'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useNav } from '@/lib/NavContext'
import styles from './CardioWidget.module.css'
import wStyles from './Widget.module.css'

const VP_KEY = 'zenith_vitality_v1'

interface VitalityStore { balance: number; lifetime: number }

export default function CardioWidget() {
  const { navigate } = useNav()
  const [vp, setVp] = useState<VitalityStore | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VP_KEY)
      setVp(raw ? JSON.parse(raw) as VitalityStore : { balance: 0, lifetime: 0 })
    } catch { setVp({ balance: 0, lifetime: 0 }) }
  }, [])

  const sessions = useLiveQuery(
    () => db.cardioSessions.orderBy('completedAt').reverse().limit(7).toArray(),
    [],
  ) ?? []

  const weekAgo    = Date.now() - 7 * 86_400_000
  const weekSess   = sessions.filter(s => s.completedAt >= weekAgo)
  const weekMins   = weekSess.reduce((s, r) => s + r.durationMinutes, 0)
  const lastSess   = sessions[0]

  const ACTIVITY_ICONS: Record<string, string> = {
    run: '🏃', walk: '🚶', bike: '🚴', swim: '🏊',
    row: '🚣', hike: '🥾', yoga: '🧘', elliptical: '⚡', other: '💪',
  }

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate('workouts', 'essentials')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('workouts', 'essentials') }}
      aria-label="Open Workouts"
    >
      <div className={wStyles.cardHeader}>
        <div>
          <p className={wStyles.eyebrow}>Life · Workouts</p>
          <p className={wStyles.title}>Cardio Activity</p>
        </div>
        <span className={wStyles.navArrow}>→</span>
      </div>

      <div className={wStyles.widgetBody}>
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{weekMins}</span>
            <span className={styles.statLabel}>mins this week</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{weekSess.length}</span>
            <span className={styles.statLabel}>sessions</span>
          </div>
          {vp && (
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.vpNum}`}>
                ⚡ {vp.balance}
              </span>
              <span className={styles.statLabel}>vitality pts</span>
            </div>
          )}
        </div>

        {lastSess ? (
          <div className={styles.lastSession}>
            <span className={styles.lastIcon}>
              {ACTIVITY_ICONS[lastSess.activityType] ?? '💪'}
            </span>
            <div className={styles.lastInfo}>
              <span className={styles.lastActivity}>Last: {lastSess.activityType}</span>
              <span className={styles.lastMeta}>{lastSess.durationMinutes} min · +{lastSess.vitalityEarned} VP</span>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No sessions yet. Start logging your cardio!</p>
        )}
      </div>
    </div>
  )
}
