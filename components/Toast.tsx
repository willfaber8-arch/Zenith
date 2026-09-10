'use client'

import { useToast } from '@/lib/ToastContext'
import styles from './Toast.module.css'

export default function Toast() {
  const { toasts, dismiss } = useToast()

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
          <span className={styles.message}>{t.message}</span>
          {t.action && (
            /* The way back sits in the message that told you what
               happened, because that is where you are looking when you
               realise you did not mean it. */
            <button
              type="button"
              className={styles.action}
              onClick={() => { void t.action!.run(); dismiss(t.id) }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
