import type { ReactNode } from 'react'
import styles from './ZenCard.module.css'

interface ZenCardProps {
  eyebrow?: string
  title: string
  body?: string
  accent?: 'purple' | 'green'
  children?: ReactNode
  className?: string
}

export default function ZenCard({
  eyebrow,
  title,
  body,
  accent = 'purple',
  children,
  className = '',
}: ZenCardProps) {
  const accentClass = accent === 'green' ? styles.accentGreen : styles.accentPurple

  return (
    <article className={`${styles.card} ${accentClass} ${className}`}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h3 className={styles.title}>{title}</h3>
      {body    && <p className={styles.body}>{body}</p>}
      {children && <div className={styles.slot}>{children}</div>}
    </article>
  )
}
