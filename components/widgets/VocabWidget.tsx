'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import wStyles from './Widget.module.css'

export default function VocabWidget() {
  const { navigate } = useNav()

  const cards = useLiveQuery(() => db.vocab_cards?.toArray(), []) ?? []

  const due      = cards.filter(c => c.nextReviewTimestamp != null && c.nextReviewTimestamp <= Date.now()).length
  const mastered = cards.filter(c => c.reviewIntervalDays >= 21).length
  const total    = cards.length

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('vocab-builder', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('vocab-builder', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Scholastic</div>
          <div className={wStyles.title}>Polyglot Vault</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {total === 0 ? (
        <div className={wStyles.empty}>No vocab cards yet. Start building your deck!</div>
      ) : (
        <>
          <div className={wStyles.dataHero}>{due}</div>
          <div className={wStyles.dataHeroSub}>cards due for review</div>
          <div className={wStyles.dataStack}>
            <div className={wStyles.dataRow}>
              <div className={wStyles.dataIcon}>📚</div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>Total Cards</div>
                <div className={wStyles.dataSub}>in your deck</div>
              </div>
              <div className={wStyles.dataBadge}>{total}</div>
            </div>
            <div className={wStyles.dataRow}>
              <div className={wStyles.dataIcon}>✦</div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>Mastered</div>
                <div className={wStyles.dataSub}>21+ day interval</div>
              </div>
              <div className={`${wStyles.dataBadge} ${wStyles.dataBadgeGreen}`}>{mastered}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
