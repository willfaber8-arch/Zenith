'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import { calcGpa, fmtGpa, gpaTier } from '@/utils/gpaMath'
import wStyles from './Widget.module.css'

export default function GpaWidget() {
  const { navigate } = useNav()

  const semesters = useLiveQuery(() => db.gpaSemesters?.toArray(), []) ?? []
  const courses   = useLiveQuery(() => db.gpaCourses?.toArray(),   []) ?? []

  const historicalCourses = courses.filter(c => {
    const sem = semesters.find(s => s.id === c.semesterId)
    return sem && !sem.isProjected
  })

  const result = historicalCourses.length > 0 ? calcGpa(historicalCourses) : null
  const tier   = result ? gpaTier(result.gpa) : null

  const tierColors: Record<string, string> = {
    'Excellent': 'dataBadgeGreen',
    'Good':      '',
    'Fair':      'dataBadgeAmber',
    'Low':       '',
  }

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('uni-hub', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('uni-hub', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Scholastic</div>
          <div className={wStyles.title}>GPA</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {result ? (
        <>
          <div className={wStyles.dataHero} style={{ color: 'var(--accent-green)' }}>
            {fmtGpa(result.gpa, result.totalCredits)}
          </div>
          <div className={wStyles.dataHeroSub}>cumulative GPA</div>
          <div className={wStyles.dataStack}>
            <div className={wStyles.dataRow}>
              <div className={wStyles.dataIcon}>📋</div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>Credits Completed</div>
                <div className={wStyles.dataSub}>across {semesters.filter(s => !s.isProjected).length} semesters</div>
              </div>
              <div className={wStyles.dataBadge}>{result.totalCredits}</div>
            </div>
            {tier && (
              <div className={wStyles.dataRow}>
                <div className={wStyles.dataIcon}>🏆</div>
                <div className={wStyles.dataMeta}>
                  <div className={wStyles.dataLabel}>Standing</div>
                  <div className={wStyles.dataSub}>academic tier</div>
                </div>
                <div className={`${wStyles.dataBadge} ${tierColors[tier] ? wStyles[tierColors[tier] as keyof typeof wStyles] : ''}`}>
                  {tier}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={wStyles.empty}>
          No historical courses yet. Log grades in the University Hub.
        </div>
      )}
    </div>
  )
}
