'use client'

import { useState } from 'react'
import TrailHunter     from '@/components/TrailHunter'
import HikerPackSafety from '@/components/HikerPackSafety'
import styles from './TrailHunterView.module.css'

type Tab = 'scout' | 'safety'

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  scout: {
    title: 'Trail\nScout.',
    subtitle:
      'Filter regional hiking paths by distance, difficulty, and landmark features. Select a route to inspect the vector track, then export a production-standard GPX file for any GPS device or smartwatch.',
  },
  safety: {
    title: "Hiker's\nPack.",
    subtitle:
      "Catalog your gear by weight and category, then activate a precision safety check-in timer. If you fail to confirm your return before the deadline, an emergency dispatch payload is automatically compiled for emergency services.",
  },
}

export default function TrailHunterView() {
  const [activeTab, setActiveTab] = useState<Tab>('scout')
  const meta = TAB_META[activeTab]

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        {(['scout', 'safety'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'scout' ? 'Trail Scout' : 'Pack & Safety'}
          </button>
        ))}
      </div>

      {/* Always mounted — preserves Leaflet map and safety timer across tab switches */}
      <div>
        <div className={activeTab === 'scout' ? styles.tabPaneActive : styles.tabPane}>
          <TrailHunter />
        </div>
        <div className={activeTab === 'safety' ? styles.tabPaneActive : styles.tabPane}>
          <HikerPackSafety />
        </div>
      </div>
    </div>
  )
}
