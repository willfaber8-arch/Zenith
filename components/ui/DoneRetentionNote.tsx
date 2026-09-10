'use client'

/**
 * One line under "Show done" saying what happens to finished tasks.
 *
 * Work disappearing on a schedule is fine when you know the schedule
 * and surprising when you do not, and the moment someone is looking at
 * their finished tasks is the moment it is worth saying. A component
 * rather than a line of JSX in each panel: there are two task screens,
 * and a policy stated differently in each is worse than not stating it.
 */

import { useEffect, useState } from 'react'

import { useNav } from '@/lib/NavContext'
import {
  readRetention, describeRetention, RETENTION_CHANGED, type RetentionDays,
} from '@/utils/taskRetention'

import styles from './DoneRetentionNote.module.css'

export default function DoneRetentionNote() {
  /* Read after mount: the server has no localStorage, and rendering the
     default first would flash the wrong sentence at anyone who changed it. */
  const [value, setValue] = useState<RetentionDays | 'unread'>('unread')
  const { navigate } = useNav()

  useEffect(() => {
    setValue(readRetention())
    const onChange = () => setValue(readRetention())
    window.addEventListener(RETENTION_CHANGED, onChange)
    /* Another tab is another window with its own copy of this panel. */
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(RETENTION_CHANGED, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  if (value === 'unread') return null

  return (
    <p className={styles.note}>
      <span className={styles.dot} aria-hidden="true" />
      {describeRetention(value)}{' '}
      <button
        type="button"
        className={styles.link}
        onClick={() => navigate('settings', null)}
      >
        Change this
      </button>
    </p>
  )
}
