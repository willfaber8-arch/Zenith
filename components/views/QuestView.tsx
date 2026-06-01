'use client'
/**
 * views/QuestView.tsx — Daily Quest Matrix & Reward Vault
 * Phase 5 · Step 5.4
 */

import ZenHeading       from '@/components/ui/ZenHeading'
import QuestMarketplace from '@/components/QuestMarketplace'
import styles           from './QuestView.module.css'

export default function QuestView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Gamification · Phase 5.4"
          title={'Daily Quest\nMatrix.'}
          subtitle="Procedurally generated daily objectives drawn from your habits and assignments. Complete quests to earn Zenith Gold — spend it in the Reward Vault for real-world self-care rewards."
          size="lg"
        />
      </div>

      <div className="anim-fade-in delay-1">
        <QuestMarketplace />
      </div>

    </div>
  )
}
