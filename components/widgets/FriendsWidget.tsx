'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import styles           from './Widget.module.css'

export default function FriendsWidget() {
  const { navigate } = useNav()

  const friends = useLiveQuery(
    () => db ? db.peer_friends.toArray() : [],
    [],
  ) ?? []

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      style={{ '--widget-accent': '#52cca3' } as React.CSSProperties}
      onClick={() => navigate('friends-network', 'essentials')}
      role="button"
      tabIndex={0}
      aria-label="Open Friends Network"
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('friends-network', 'essentials')}
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Social</p>
          <p className={styles.title}>Friends</p>
        </div>
        <span className={styles.navArrow} aria-hidden="true">›</span>
      </div>

      {friends.length === 0 ? (
        <p className={styles.empty}>No friends connected yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {friends.slice(0, 6).map(f => (
            <li
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#52cca3', flexShrink: 0, opacity: 0.75,
              }} />
              {f.friendDisplayName}
            </li>
          ))}
          {friends.length > 6 && (
            <li style={{ fontSize: '0.65rem', color: 'var(--text-dark)', paddingLeft: 14 }}>
              +{friends.length - 6} more
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
