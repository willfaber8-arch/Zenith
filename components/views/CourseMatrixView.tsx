'use client'

import ZenHeading       from '@/components/ui/ZenHeading'
import CognitiveLoadMap from '@/components/CognitiveLoadMap'
import styles from './CourseMatrixView.module.css'

export default function CourseMatrixView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Scholastic · Cognitive Load"
          title={`Cognitive\nLoad Map.`}
          subtitle="Rate your courses across math, coding, and memorization dimensions — the engine forecasts weekly cognitive strain from your calendar."
          size="lg"
        />
      </div>
      <div className="anim-fade-in delay-1">
        <CognitiveLoadMap />
      </div>
    </div>
  )
}
