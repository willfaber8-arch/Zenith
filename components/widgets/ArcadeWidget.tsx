'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useNav }       from '@/lib/NavContext'
import { gamesDb }      from '@/lib/gamesDb'
import { RESOURCE_META, RESOURCE_IDS } from '@/lib/gamesDb'
import wStyles from './Widget.module.css'

export default function ArcadeWidget() {
  const { navigate } = useNav()

  const resources = useLiveQuery(
    () => gamesDb?.resource_inventory.toArray(),
    [],
  ) ?? []

  const cp = resources.find(r => r.id === 'cosmetic_points')

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('games', 'creator')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('games', 'creator') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Arcade</div>
          <div className={wStyles.title}>Economy</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {resources.length === 0 ? (
        <div className={wStyles.empty}>Visit the Arcade to start harvesting resources.</div>
      ) : (
        <div className={wStyles.dataStack}>
          {cp && (
            <div className={wStyles.dataRow}>
              <div className={wStyles.dataIcon}>✦</div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>Credits</div>
                <div className={wStyles.dataSub}>spendable in Shop</div>
              </div>
              <div className={`${wStyles.dataBadge} ${wStyles.dataBadgeGreen}`}>
                {cp.balance.toLocaleString()}
              </div>
            </div>
          )}
          {RESOURCE_IDS.filter(id => id !== 'cosmetic_points').map(id => {
            const r    = resources.find(r => r.id === id)
            const meta = RESOURCE_META[id]
            if (!r || !meta) return null
            const cap = meta.maxCapacity ?? 1
            const pct = Math.round((r.balance / cap) * 100)
            return (
              <div key={id} className={wStyles.dataRow}>
                <div className={wStyles.dataIcon}>{meta.category === 'raw' ? '◈' : '◇'}</div>
                <div className={wStyles.dataMeta}>
                  <div className={wStyles.dataLabel}>{meta.name}</div>
                  <div className={wStyles.dataSub}>{r.balance.toLocaleString()} / {cap.toLocaleString()}</div>
                </div>
                <div className={`${wStyles.dataBadge} ${pct >= 90 ? wStyles.dataBadgeAmber : ''}`}>
                  {pct}%
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
