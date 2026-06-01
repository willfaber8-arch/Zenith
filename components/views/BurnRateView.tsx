'use client'

import ZenHeading       from '@/components/ui/ZenHeading'
import BrbBurnRate      from '@/components/BrbBurnRate'
import DeliveriesLogger from '@/components/DeliveriesLogger'
import styles from './BurnRateView.module.css'

export default function BurnRateView() {
  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Life · BRB Burn Rate"
          title={'Budget\nBurn Rate.'}
          subtitle="Log your Cornell Big Red Bucks balance and auto-calculate a safe daily spending limit based on remaining semester days. Track incoming packages and active subscriptions below."
          size="lg"
        />
      </div>
      <div className="anim-fade-in delay-1">
        <BrbBurnRate />
      </div>
      <div className="anim-fade-in delay-2">
        <DeliveriesLogger />
      </div>
    </div>
  )
}
