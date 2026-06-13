'use client'

import { useNav } from '@/lib/NavContext'
import styles from './ThemeBackground.module.css'

export default function ThemeBackground() {
  const { activeCategory } = useNav()
  const tintVar = activeCategory ? `var(--tint-${activeCategory})` : 'var(--tint-home)'
  return (
    <div
      className={styles.bg}
      style={{ backgroundColor: tintVar }}
      aria-hidden="true"
    />
  )
}
