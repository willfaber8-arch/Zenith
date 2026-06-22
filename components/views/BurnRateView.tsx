'use client'

import BrbBurnRate      from '@/components/BrbBurnRate'
import DeliveriesLogger from '@/components/DeliveriesLogger'
import styles from './BurnRateView.module.css'

export default function BurnRateView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-fade-in delay-1">
        <BrbBurnRate />
      </div>
      <div className="anim-fade-in delay-2">
        <DeliveriesLogger />
      </div>
    </div>
  )
}
