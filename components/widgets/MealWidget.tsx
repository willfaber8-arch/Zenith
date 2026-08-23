'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import { getWeekStart } from '@/utils/mealData'
import Icon, { type IconName } from '@/components/ui/Icon'
import wStyles from './Widget.module.css'

const MEAL_ICON: Record<string, IconName> = {
  breakfast: 'sunrise',
  lunch:     'sun',
  dinner:    'moon',
}

export default function MealWidget() {
  const { navigate } = useNav()

  const today     = new Date()
  const weekStart = getWeekStart(today)
  const dayIndex  = (today.getDay() + 6) % 7  // Mon=0 … Sun=6

  const slots = useLiveQuery(
    () => db.mealPlanSlots?.where('weekStart').equals(weekStart).toArray(),
    [weekStart],
  ) ?? []

  const todaySlots = slots
    .filter(s => s.dayIndex === dayIndex)
    .sort((a, b) => {
      const order = ['breakfast', 'lunch', 'dinner']
      return order.indexOf(a.mealType) - order.indexOf(b.mealType)
    })

  const totalCals = todaySlots.reduce((sum, s) => sum + (s.estimatedCalories ?? 0), 0)

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('meal-planning', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('meal-planning', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Life</div>
          <div className={wStyles.title}>Today's Meals</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {todaySlots.length === 0 ? (
        <div className={wStyles.empty}>No meals planned today. Open Meal Planning to add some.</div>
      ) : (
        <div className={wStyles.dataStack}>
          {todaySlots.map(s => (
            <div key={s.id} className={wStyles.dataRow}>
              <div className={wStyles.dataIcon}><Icon name={MEAL_ICON[s.mealType] ?? 'pan'} size={18} /></div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>{s.mealName}</div>
                <div className={wStyles.dataSub}>{s.mealType}</div>
              </div>
              {s.estimatedCalories > 0 && (
                <div className={wStyles.dataBadge}>{s.estimatedCalories} kcal</div>
              )}
            </div>
          ))}
          {totalCals > 0 && (
            <div className={wStyles.dataRow} style={{ borderBottom: 'none', paddingTop: 'var(--sp-2)' }}>
              <div className={wStyles.dataIcon}><Icon name="chart" size={18} /></div>
              <div className={wStyles.dataMeta}>
                <div className={wStyles.dataLabel}>Total Today</div>
              </div>
              <div className={`${wStyles.dataBadge} ${totalCals > 2000 ? '' : wStyles.dataBadgeGreen}`}>
                {totalCals} kcal
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
