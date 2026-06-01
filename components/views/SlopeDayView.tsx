'use client'
/**
 * views/SlopeDayView.tsx — Mental Health Mapping & Slope Day Hype Tracker
 * Phase 5 · Step 5.7
 */

import ZenHeading         from '@/components/ui/ZenHeading'
import SlopeDayHypeTracker from '@/components/SlopeDayHypeTracker'
import styles              from './SlopeDayView.module.css'

export default function SlopeDayView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Wellness · Phase 5.7"
          title={'Slope Day\nHype Tracker.'}
          subtitle="Log your daily emotional state and track the algorithmic hype multiplier countdown to Cornell's Slope Day festival. Quest rewards scale automatically as the celebration approaches."
          size="lg"
        />
      </div>

      <div className="anim-fade-in delay-1">
        <SlopeDayHypeTracker />
      </div>

    </div>
  )
}
