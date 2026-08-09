/**
 * components/widgets/SavedReadingWidget.tsx — reading list on the dashboard.
 */

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useNav } from '@/lib/NavContext'
import styles from './Widget.module.css'

export default function SavedReadingWidget() {
  const { navigate } = useNav()

  const rows = useLiveQuery(async () => {
    if (!db) return []
    const all = await db.knowledge_saved_articles.orderBy('savedAt').reverse().toArray()
    return all.filter(a => a.archived !== 1)
  }, [])

  const list   = rows ?? []
  const latest = list[0]

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('world-events', 'creator')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('world-events', 'creator') }}
      aria-label="Open saved reading"
    >
      <div className={styles.cardHeader}>
        <span>Saved Reading</span>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {rows === undefined ? null : !latest ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          Nothing saved yet.
        </p>
      ) : (
        <>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 600,
            color: 'var(--text-primary)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {latest.title}
          </p>
          <p style={{
            marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: '0.64rem',
            color: 'var(--text-dark)',
          }}>
            {latest.source}
            {list.length > 1 && ` · ${list.length} saved`}
          </p>
        </>
      )}
    </div>
  )
}
