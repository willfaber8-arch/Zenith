'use client'

import { useState } from 'react'
import ZenHeading     from '@/components/ui/ZenHeading'
import ForagingLog    from '@/components/ForagingLog'
import HouseplantGrid from '@/components/HouseplantGrid'
import styles from './BotanistView.module.css'

type Tab = 'foraging' | 'plants'

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  foraging: {
    title: 'Foraging\nLog.',
    subtitle:
      'Track seasonal bloom and foraging windows across Cornell Botanic Gardens locations. The calendar matrix shifts its accent hue with each season — Ocean Sage in spring, Amber-Rust in autumn.',
  },
  plants: {
    title: 'Plant\nCare.',
    subtitle:
      "Monitor your indoor collection's watering schedule. The dryness equation surfaces overdue plants with a warm yellow-slate warning prompt — click Log Watering Event to reset the timestamp in IndexedDB.",
  },
}

export default function BotanistView() {
  const [activeTab, setActiveTab] = useState<Tab>('foraging')
  const meta = TAB_META[activeTab]

  return (
    <div className={styles.wrap}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Creator's Choice · Botanist Guide"
          title={meta.title}
          subtitle={meta.subtitle}
          size="md"
        />
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'foraging' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('foraging')}
        >
          Foraging Log
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'plants' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('plants')}
        >
          Plant Care
        </button>
      </div>

      {/* Always mounted — preserves state across tab switches */}
      <div>
        <div className={activeTab === 'foraging' ? styles.tabPaneActive : styles.tabPane}>
          <ForagingLog />
        </div>
        <div className={activeTab === 'plants' ? styles.tabPaneActive : styles.tabPane}>
          <HouseplantGrid />
        </div>
      </div>
    </div>
  )
}
