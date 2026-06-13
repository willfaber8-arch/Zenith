'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import { MOOD_VECTORS } from '@/utils/mentalHealthLog'
import wStyles from './Widget.module.css'

export default function WellnessWidget() {
  const { navigate } = useNav()

  const latest = useLiveQuery(
    () => db.mentalHealthLogs?.orderBy('createdAt').reverse().first(),
    [],
  )

  const todayISO = new Date().toISOString().slice(0, 10)
  const isToday  = latest?.logDate === todayISO

  const vector = latest?.moodVector
    ? MOOD_VECTORS.find(v => v.key === latest.moodVector)
    : null

  const wellbeing = latest
    ? Math.round(((latest.energyLevel - latest.stressLevel + 9) / 18) * 100)
    : null

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('wellness', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('wellness', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Life</div>
          <div className={wStyles.title}>Wellness</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {latest ? (
        <div className={wStyles.dataStack}>
          <div className={wStyles.dataRow}>
            <div className={wStyles.dataIcon}>{vector?.emoji ?? '😐'}</div>
            <div className={wStyles.dataMeta}>
              <div className={wStyles.dataLabel}>{vector?.label ?? latest.moodVector}</div>
              <div className={wStyles.dataSub}>{isToday ? 'logged today' : latest.logDate}</div>
            </div>
            {wellbeing !== null && (
              <div className={`${wStyles.dataBadge} ${wellbeing >= 60 ? wStyles.dataBadgeGreen : wellbeing < 40 ? '' : wStyles.dataBadgeAmber}`}>
                {wellbeing}%
              </div>
            )}
          </div>
          <div className={wStyles.dataRow}>
            <div className={wStyles.dataIcon}>⚡</div>
            <div className={wStyles.dataMeta}>
              <div className={wStyles.dataLabel}>Energy</div>
            </div>
            <div className={wStyles.dataBadge}>{latest.energyLevel}/10</div>
          </div>
          <div className={wStyles.dataRow}>
            <div className={wStyles.dataIcon}>🌀</div>
            <div className={wStyles.dataMeta}>
              <div className={wStyles.dataLabel}>Stress</div>
            </div>
            <div className={`${wStyles.dataBadge} ${latest.stressLevel >= 7 ? '' : wStyles.dataBadgeGreen}`}>
              {latest.stressLevel}/10
            </div>
          </div>
        </div>
      ) : (
        <div className={wStyles.empty}>No mood logged yet. Check in today!</div>
      )}
    </div>
  )
}
