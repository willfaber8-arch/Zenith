'use client'

import { useState } from 'react'
import TrailHunter        from '@/components/TrailHunter'
import HikerPackSafety    from '@/components/HikerPackSafety'
import CompletedTrailsLog from '@/components/CompletedTrailsLog'
import styles from './TrailHunterView.module.css'

type Tab = 'scout' | 'safety' | 'completed'

const TAB_LABEL: Record<Tab, string> = {
  scout:     'Trail Search',
  safety:    'Pack & Safety',
  completed: 'Completed',
}

export default function TrailHunterView() {
  const [activeTab, setActiveTab] = useState<Tab>('scout')

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        {(['scout', 'safety', 'completed'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {/* Search + Safety stay mounted (preserve form state + safety timer);
          Completed is light and only mounts when viewed. */}
      <div>
        <div className={activeTab === 'scout' ? styles.tabPaneActive : styles.tabPane}>
          <TrailHunter />
        </div>
        <div className={activeTab === 'safety' ? styles.tabPaneActive : styles.tabPane}>
          <HikerPackSafety />
        </div>
        {activeTab === 'completed' && <CompletedTrailsLog />}
      </div>
    </div>
  )
}
