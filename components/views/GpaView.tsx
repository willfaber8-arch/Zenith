'use client'

import ZenHeading    from '@/components/ui/ZenHeading'
import GpaSimulator  from '@/components/GpaSimulator'
import styles from './GpaView.module.css'

export default function GpaView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Scholastic · GPA Calculator"
          title={`Cumulative\nGPA.`}
          subtitle="Track your academic record, simulate what-if grades, and measure against your target."
          size="lg"
        />
      </div>
      <div className="anim-fade-in delay-1">
        <GpaSimulator />
      </div>
    </div>
  )
}
