'use client'

import WellnessTracker from '@/components/SlopeDayHypeTracker'
import styles          from './SlopeDayView.module.css'

export default function WellnessView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-fade-in delay-1">
        <WellnessTracker />
      </div>

    </div>
  )
}
