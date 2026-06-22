'use client'

import GpaSimulator  from '@/components/GpaSimulator'
import styles from './GpaView.module.css'

export default function GpaView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-fade-in delay-1">
        <GpaSimulator />
      </div>
    </div>
  )
}
