'use client'

import ZenHeading      from '@/components/ui/ZenHeading'
import WellnessTracker from '@/components/SlopeDayHypeTracker'
import styles          from './SlopeDayView.module.css'

export default function WellnessView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Life · Wellness"
          title="Mental Wellness."
          subtitle="Log your daily emotional state, track your mood over time, and spot stress patterns in your mood history calendar."
          size="lg"
        />
      </div>

      <div className="anim-fade-in delay-1">
        <WellnessTracker />
      </div>

    </div>
  )
}
