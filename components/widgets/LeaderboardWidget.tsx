'use client'

import { useMemo }      from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import styles           from './Widget.module.css'

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.']

export default function LeaderboardWidget() {
  const { navigate } = useNav()

  const snapshots = useLiveQuery(
    () => db ? db.peer_leaderboard_snapshots.toArray() : [],
    [],
  ) ?? []

  const friends = useLiveQuery(
    () => db ? db.peer_friends.toArray() : [],
    [],
  ) ?? []

  const friendNameMap = useMemo(() => {
    const m = new Map<string, string>()
    friends.forEach(f => m.set(f.peerIdString, f.friendDisplayName))
    return m
  }, [friends])

  const ranked = useMemo(() =>
    [...snapshots]
      .sort((a, b) => b.allTimeStudyMinutes - a.allTimeStudyMinutes)
      .slice(0, 5),
    [snapshots],
  )

  const fmtTime = (mins: number) =>
    mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`

  const getName = (peerIdString: string, i: number) => {
    if (peerIdString === 'self') return 'You'
    return friendNameMap.get(peerIdString) ?? `Peer ${i + 1}`
  }

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      style={{ '--widget-accent': '#f59e0b' } as React.CSSProperties}
      onClick={() => navigate('friends-network', 'essentials')}
      role="button"
      tabIndex={0}
      aria-label="Open Leaderboard"
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('friends-network', 'essentials')}
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Social</p>
          <p className={styles.title}>Leaderboard</p>
        </div>
        <span className={styles.navArrow} aria-hidden="true">›</span>
      </div>

      {ranked.length === 0 ? (
        <p className={styles.empty}>Connect friends to see rankings.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranked.map((snap, i) => (
            <li
              key={snap.peerIdString}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}
            >
              <span style={{ fontSize: '0.85rem', width: 20, flexShrink: 0 }}>{MEDALS[i]}</span>
              <span style={{
                flex: 1,
                color: snap.peerIdString === 'self' ? 'var(--accent-purple)' : 'var(--text-muted)',
                fontWeight: snap.peerIdString === 'self' ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {getName(snap.peerIdString, i)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dark)', flexShrink: 0 }}>
                {fmtTime(snap.allTimeStudyMinutes)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
