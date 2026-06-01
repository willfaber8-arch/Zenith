'use client'

import ZenHeading from '@/components/ui/ZenHeading'
import ZenCard    from '@/components/ui/ZenCard'
import styles from './PlaceholderView.module.css'

interface Props {
  title:   string
  eyebrow: string
}

export default function PlaceholderView({ title, eyebrow }: Props) {
  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading eyebrow={eyebrow} title={title} size="lg" />
      </div>
      <div className={`${styles.cards} anim-slide-in delay-1`}>
        <ZenCard
          eyebrow="System · Status"
          title="Module Initializing"
          body={`${title} is being architected. This panel will be activated in a future build phase.`}
          accent="purple"
        />
      </div>
    </div>
  )
}
