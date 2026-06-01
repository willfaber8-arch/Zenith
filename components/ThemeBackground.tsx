'use client'

import { useNav } from '@/lib/NavContext'
import { getCategoryBg } from '@/lib/nav-config'
import styles from './ThemeBackground.module.css'

export default function ThemeBackground() {
  const { activeCategory } = useNav()
  return (
    <div
      className={styles.bg}
      style={{ backgroundColor: getCategoryBg(activeCategory) }}
      aria-hidden="true"
    />
  )
}
