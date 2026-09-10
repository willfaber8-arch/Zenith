'use client'

/**
 * Choosing how long finished tasks stick around.
 *
 * This is the only place the app deletes anything on a schedule, so the
 * control says so plainly, shows how many tasks the current setting
 * covers right now, and offers "Never" as a real option rather than a
 * very long window.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'

import { db } from '@/lib/db'
import {
  readRetention, writeRetention, RETENTION_CHOICES, RETENTION_CHANGED,
  type RetentionDays,
} from '@/utils/taskRetention'

import styles from './DoneTaskRetention.module.css'

const DAY_MS = 24 * 60 * 60 * 1000

export default function DoneTaskRetention() {
  const [value, setValue] = useState<RetentionDays | 'unread'>('unread')

  useEffect(() => {
    setValue(readRetention())
    const onChange = () => setValue(readRetention())
    window.addEventListener(RETENTION_CHANGED, onChange)
    return () => window.removeEventListener(RETENTION_CHANGED, onChange)
  }, [])

  const doneRows = useLiveQuery(
    async () => (db ? db.assignments.where('status').equals('completed').toArray() : []),
    [],
  ) ?? []

  const choose = (next: RetentionDays) => {
    writeRetention(next)
    setValue(next)
  }

  if (value === 'unread') return null

  /*
   * What this setting would remove on the next sweep — the number is the
   * point of the control. A task with no stamp yet is not counted: the
   * sweep gives it one instead of deleting it.
   */
  const cutoff  = value === null ? null : Date.now() - value * DAY_MS
  const dueOut  = cutoff === null ? 0
    : doneRows.filter(a => a.completedAt != null && a.completedAt <= cutoff).length

  return (
    <div className={styles.block}>
      <h3 className={styles.heading}>Tidying finished tasks away</h3>
      <p className={styles.subtitle}>
        &ldquo;Show done&rdquo; is only useful while it is short, so finished tasks
        are removed after a while. This is the one thing in Zenith that deletes
        anything on its own — it never touches a task that is still open, the
        clock starts when you tick a task off rather than when you made it, and
        unticking one stops the clock. Removals happen after the daily snapshot
        above, so a task tidied away today is still inside a recent snapshot.
      </p>

      <div className={styles.choices} role="group" aria-label="Keep finished tasks">
        {RETENTION_CHOICES.map(c => (
          <button
            key={String(c.value)}
            type="button"
            className={`${styles.choice} ${c.value === value ? styles.choiceOn : ''}`}
            aria-pressed={c.value === value}
            onClick={() => choose(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className={styles.count}>
        {doneRows.length === 0
          ? 'Nothing is finished at the moment.'
          : value === null
            ? `${doneRows.length} finished ${doneRows.length === 1 ? 'task' : 'tasks'} kept — none will be removed.`
            : dueOut === 0
              ? `${doneRows.length} finished ${doneRows.length === 1 ? 'task' : 'tasks'}, none old enough to be removed yet.`
              : `${dueOut} of ${doneRows.length} finished ${doneRows.length === 1 ? 'task is' : 'tasks are'} past this window and will be removed on the next check.`}
      </p>
    </div>
  )
}
