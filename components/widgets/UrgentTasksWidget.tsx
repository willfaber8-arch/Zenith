'use client'

import { useLiveQuery }                   from 'dexie-react-hooks'
import { db, type Assignment, type Priority } from '@/lib/db'
import styles from './Widget.module.css'

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
}

function fmtDue(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function UrgentTasksWidget() {
  const assignments = useLiveQuery(
    async (): Promise<Assignment[]> => {
      if (!db) return []
      const rows = await db.assignments
        .where('status')
        .anyOf(['pending', 'in_progress', 'overdue'])
        .toArray()
      return rows
        .sort((a, b) => {
          const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          return pd !== 0 ? pd : a.dueDate.localeCompare(b.dueDate)
        })
        .slice(0, 6)
    },
    [],
    [] as Assignment[],
  )

  return (
    <div
      className={styles.widget}
      style={{ '--widget-accent': 'var(--accent-purple)' } as React.CSSProperties}
    >
      <div className={styles.widgetHeader}>
        <p className={styles.widgetEyebrow}>Scholastic · Active</p>
        {assignments.length > 0 && (
          <span className={styles.widgetBadge} aria-label={`${assignments.length} active`}>
            {assignments.length}
          </span>
        )}
      </div>

      <p className={styles.widgetTitle}>Urgent Tasks</p>

      <div className={styles.widgetBody}>
        {assignments.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">✓</span>
            <p className={styles.emptyText}>All clear — no active tasks.</p>
          </div>
        ) : (
          <ul className={styles.taskList} aria-label="Active assignments">
            {assignments.map(a => (
              <li
                key={a.id}
                className={styles.taskRow}
                data-priority={a.priority}
              >
                <span className={styles.taskDot} aria-hidden="true" />
                <span className={styles.taskTitle}>{a.title}</span>
                <time className={styles.taskDue} dateTime={a.dueDate}>
                  {fmtDue(a.dueDate)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
