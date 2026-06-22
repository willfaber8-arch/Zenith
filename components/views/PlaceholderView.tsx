'use client'

import ZenCard    from '@/components/ui/ZenCard'
import styles from './PlaceholderView.module.css'

interface Props {
  title:   string
  eyebrow: string
}

export default function PlaceholderView({ title, eyebrow }: Props) {
  return (
    <div className={styles.wrap}>
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
