'use client'

import { useState } from 'react'
import ZenHeading            from '@/components/ui/ZenHeading'
import AquascapingValidator  from '@/components/AquascapingValidator'
import SupplierCartSimulator from '@/components/SupplierCartSimulator'
import HardscapeSimulator    from '@/components/HardscapeSimulator'
import WaterParameterLogger  from '@/components/WaterParameterLogger'
import styles from './AquascapingView.module.css'

type Tab = 'validator' | 'cart' | 'hardscape'

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  validator: {
    title: 'Ecosystem\nValidator.',
    subtitle:
      'Configure your tank profile and add inhabitants. The biological compatibility engine flags parameter conflicts and calculates live bioload capacity.',
  },
  cart: {
    title: 'Supplier\nCart.',
    subtitle:
      'Draft your shopping list, assign items to vendors, and let the pricing engine reveal per-vendor shipping thresholds and your optimised grand total.',
  },
  hardscape: {
    title: 'Hardscape &\nWater Log.',
    subtitle:
      'Plan your aquascape layout on a grid-snapped canvas, then track water chemistry over time. The nitrogen cycle auditor signals when the tank is ready for inhabitants.',
  },
}

export default function AquascapingView() {
  const [activeTab, setActiveTab] = useState<Tab>('validator')
  const meta = TAB_META[activeTab]

  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Creator's Choice · Aquascaping Engine"
          title={meta.title}
          subtitle={meta.subtitle}
          size="lg"
        />
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'validator' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('validator')}
        >
          Ecosystem Validator
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'cart' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('cart')}
        >
          Supplier Cart
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'hardscape' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('hardscape')}
        >
          Hardscape & Water Log
        </button>
      </div>

      {/*
        All three panes always mounted so state survives tab switches.
        Active pane fades in; inactive panes are hidden via display:none.
      */}
      <div className={`${styles.tabPane} ${activeTab === 'validator' ? styles.tabPaneActive : ''}`}>
        <AquascapingValidator />
      </div>

      <div className={`${styles.tabPane} ${activeTab === 'cart' ? styles.tabPaneActive : ''}`}>
        <SupplierCartSimulator />
      </div>

      <div className={`${styles.tabPane} ${activeTab === 'hardscape' ? styles.tabPaneActive : ''}`}>
        <div className={styles.hardscapeTab}>
          <HardscapeSimulator />
          <WaterParameterLogger />
        </div>
      </div>
    </div>
  )
}
