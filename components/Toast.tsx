'use client'

import { useToast } from '@/lib/ToastContext'
import styles from './Toast.module.css'

export default function Toast() {
  const { toasts } = useToast()

  return (
    <div
      id="toast-container"
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]} ${t.exiting ? styles.exiting : ''}`}
        >
          <span className={styles.dot} aria-hidden="true" />
          {t.message}
        </div>
      ))}
    </div>
  )
}
