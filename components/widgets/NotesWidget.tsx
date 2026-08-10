/**
 * components/widgets/NotesWidget.tsx — most recent note on the dashboard.
 *
 * Shows the last thing captured plus outstanding checklist items, so the
 * dashboard answers "what did I jot down?" without a navigation.
 */

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useNav } from '@/lib/NavContext'
import { checklistProgress } from '@/lib/engines/NoteTaskDetector'
import styles from './Widget.module.css'

export default function NotesWidget() {
  const { navigate } = useNav()

  const recent = useLiveQuery(async () => {
    if (!db) return null
    const all = await db.quickNotes.orderBy('updatedAt').reverse().limit(12).toArray()
    return all.filter(n => n.archived !== 1)[0] ?? null
  }, [])

  /* Outstanding items across every live note — the number worth a glance. */
  const open = useLiveQuery(async () => {
    if (!db) return 0
    const all = await db.quickNotes.toArray()
    return all
      .filter(n => n.archived !== 1)
      .reduce((sum, n) => {
        const p = checklistProgress(n.body)
        return sum + (p.total - p.done)
      }, 0)
  }, [])

  const body = (recent?.body ?? '').trim()
  const preview = body
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*+]|\d+[.)])\s*\[[ xX]\]\s*/, '').trim())
    .filter(Boolean)
    .slice(1, 4)
    .join(' · ')

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('notes', 'vault')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('notes', 'vault') }}
      aria-label="Open Notes"
    >
      <div className={styles.cardHeader}>
        <span>Notes</span>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {recent === undefined ? null : !recent ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          Nothing captured yet.
        </p>
      ) : (
        <>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '0.85rem',
            fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {recent.title}
          </p>
          {preview && (
            <p style={{
              marginTop: 4, fontSize: '0.72rem', lineHeight: 1.5,
              color: 'var(--text-dark)',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {preview}
            </p>
          )}
          {!!open && open > 0 && (
            <p style={{
              marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              color: 'var(--accent-purple)',
            }}>
              {open} open item{open === 1 ? '' : 's'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
