/**
 * components/widgets/DiningNowWidget.tsx — what's open right now.
 *
 * The one genuinely glanceable thing in Campus Companion, and the
 * strongest argument for the module existing at all: "can I still get
 * food" is a question with a time limit on it.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useNav } from '@/lib/NavContext'
import { evaluateStatus, describeStatus, sortRank } from '@/lib/engines/DiningHours'
import styles from './Widget.module.css'

export default function DiningNowWidget() {
  const { navigate } = useNav()
  const [now, setNow] = useState<Date | null>(null)

  /* Null until mounted: an open/closed state computed during SSR would
     hydrate mismatched against the client's clock. */
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const halls = useLiveQuery(async () => (db ? db.campus_dining_halls.toArray() : []), [])

  const ranked = useMemo(() => {
    if (!now || !halls) return []
    return halls
      .map(h => ({ hall: h, status: evaluateStatus(h.hours, now) }))
      .sort((a, b) => {
        const r = sortRank(a.status) - sortRank(b.status)
        return r !== 0 ? r : a.hall.name.localeCompare(b.hall.name)
      })
  }, [halls, now])

  const openNow = ranked.filter(r => r.status.state === 'open')
  const top     = openNow.length > 0 ? openNow.slice(0, 3) : ranked.slice(0, 2)

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('uni-hub', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('uni-hub', 'essentials') }}
      aria-label="Open campus dining"
    >
      <div className={styles.cardHeader}>
        <span>Dining Now</span>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {halls === undefined || !now ? null : halls.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          Add dining halls in University Hub → Campus.
        </p>
      ) : (
        <>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '1.15rem',
            fontWeight: 700, color: openNow.length ? 'var(--accent-green)' : 'var(--text-muted)',
          }}>
            {openNow.length > 0 ? `${openNow.length} open` : 'All closed'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            {top.map(({ hall, status }) => (
              <div key={hall.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  fontSize: '0.72rem', color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {hall.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                  color: status.state === 'open' ? 'var(--accent-green)' : 'var(--text-dark)',
                  whiteSpace: 'nowrap',
                }}>
                  {describeStatus(status)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
