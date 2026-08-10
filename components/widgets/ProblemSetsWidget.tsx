/**
 * components/widgets/ProblemSetsWidget.tsx — what's due, on the dashboard.
 *
 * Reads the same `assignments` table the urgent-tasks widget does, but
 * scoped to outstanding work with its per-problem progress — the thing
 * the Work tab exists to make visible.
 */

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Assignment } from '@/lib/db'
import { useNav } from '@/lib/NavContext'
import { todayISO } from '@/utils/localDate'
import styles from './Widget.module.css'

const OPEN = ['pending', 'in_progress', 'overdue']

/** Local-date arithmetic, never toISOString. */
function daysUntil(dueDate: string): number {
  const today = todayISO()
  if (dueDate === today) return 0
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = dueDate.split('-').map(Number)
  return Math.round(
    (new Date(dy, dm - 1, dd).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000,
  )
}

export default function ProblemSetsWidget() {
  const { navigate } = useNav()

  const rows = useLiveQuery(async (): Promise<Assignment[]> => {
    if (!db) return []
    const all = await db.assignments.toArray()
    return all
      .filter(a => OPEN.includes(a.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [])

  const open    = rows ?? []
  const sets    = open.filter(a => a.kind === 'problem_set')
  const overdue = open.filter(a => daysUntil(a.dueDate) < 0).length
  const next    = open[0]

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => navigate('study-shield', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('study-shield', 'essentials') }}
      aria-label="Open work"
    >
      <div className={styles.cardHeader}>
        <span>Work Due</span>
        <span className={styles.navArrow} aria-hidden="true">→</span>
      </div>

      {rows === undefined ? null : open.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          Nothing outstanding.
        </p>
      ) : (
        <>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700,
            color: overdue > 0 ? '#f87171' : 'var(--text-primary)', lineHeight: 1.1,
          }}>
            {open.length}
            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dark)', marginLeft: 6 }}>
              open{sets.length > 0 && ` · ${sets.length} set${sets.length === 1 ? '' : 's'}`}
            </span>
          </p>

          {overdue > 0 && (
            <p style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: '#f87171' }}>
              {overdue} overdue
            </p>
          )}

          {next && (
            <p style={{
              marginTop: 8, fontSize: '0.73rem', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Next: {next.title}
            </p>
          )}
        </>
      )}
    </div>
  )
}
