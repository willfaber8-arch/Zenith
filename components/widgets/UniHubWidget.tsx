'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import styles from './Widget.module.css'

export default function UniHubWidget() {
  const { navigate } = useNav()

  const profile = useLiveQuery(
    () => db?.userProfile.get(1),
    [],
  )

  const uniName   = profile?.universityName || null
  const majorName = profile?.majorIdentifier || null

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('uni-hub', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate('uni-hub', 'essentials')}
      aria-label="University Hub"
      style={{ '--widget-accent': 'var(--accent-green)' } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <p className={styles.eyebrow}>University Hub</p>
        <span className={styles.navArrow} aria-hidden="true">›</span>
      </div>

      <p className={styles.widgetTitle}>
        {uniName ?? 'Not configured'}
      </p>

      <div className={styles.widgetBody}>
        {uniName ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {majorName && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {majorName}
              </p>
            )}
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>
              Resources, GPA calculator &amp; more →
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>
            Set up your university in University Hub
          </p>
        )}
      </div>
    </div>
  )
}
