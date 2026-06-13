'use client'
/**
 * GritView — Phase 5 · Step 5.3
 * ────────────────────────────────────────────────────────────────
 * Orchestrates the Grit-Score Analytics Engine. Fetches the habits
 * table via useLiveQuery, pipes every row through
 * calculateMovingGritScore(), and renders the GritAnalyticsChart.
 *
 * Reactive: any habit mutation (new habit, completion, streak update)
 * propagates instantly through the live query → recomputation →
 * chart re-render pipeline without any manual refresh.
 */

import { useMemo }              from 'react'
import { useLiveQuery }         from 'dexie-react-hooks'
import { db }                   from '@/lib/db'
import {
  calculateMovingGritScore,
}                               from '@/utils/gritScore'
import GritAnalyticsChart       from '@/components/GritAnalyticsChart'
import ZenHeading               from '@/components/ui/ZenHeading'
import styles from './GritView.module.css'

/* ── Difficulty label map ─────────────────────────────────── */
const DIFF_WEIGHTS: Record<string, string> = {
  easy:   '1.0×',
  medium: '2.5×',
  hard:   '5.0×',
}

/* ── Formula variables explainer ─────────────────────────── */
const FORMULA_VARS = [
  {
    symbol: 'Wd',
    name:   'Difficulty Weight',
    desc:   'Easy = 1.0 · Medium = 2.5 · Hard = 5.0',
  },
  {
    symbol: 'Cc',
    name:   'Consistency Coefficient',
    desc:   'Completions ÷ expected days in rolling 7-day window',
  },
  {
    symbol: 'Bs',
    name:   'Streak Bonus Modifier',
    desc:   'ln(streakCount + 1) — logarithmic milestone scaling',
  },
  {
    symbol: 'Pa',
    name:   'Atrophy Decay Penalty',
    desc:   '0.85^daysMissed — exponential degradation per missed day',
  },
]

export default function GritView() {

  /* ── Live habit data ───────────────────────────────────── */
  const habits = useLiveQuery(
    () => db?.habits.toArray() ?? Promise.resolve([]),
    [],
    [],
  )

  /* ── Compute 30-day Grit Score series (memoised) ──────── */
  const gritPoints = useMemo(
    () => calculateMovingGritScore(habits ?? []),
    [habits],
  )

  const activeHabits = (habits ?? []).filter(
    h => h.streakCount > 0 || h.lastCompletedDate != null,
  )

  return (
    <div className={styles.page}>

      <ZenHeading
        eyebrow="Behavioral Analytics · Grit Engine"
        title={`Grit\nScore.`}
        subtitle="A parametric composite of habit difficulty, consistency, streak bonuses, and atrophy decay — visualised as a 30-day rolling trend."
        size="md"
      />

      {/* Active habit chips */}
      {activeHabits.length > 0 && (
        <div className={styles.habitMeta} aria-label="Active tracked habits">
          {activeHabits.map(h => (
            <span key={h.id} className={styles.habitChip}>
              <span className={styles.habitChipDot} aria-hidden="true" />
              {h.name}
            </span>
          ))}
        </div>
      )}

      {/* Main chart */}
      <GritAnalyticsChart points={gritPoints} />

      {/* Formula explainer */}
      <div className={styles.formulaCard} aria-label="Grit Score formula variables">
        {FORMULA_VARS.map(v => (
          <div key={v.symbol} className={styles.formulaItem}>
            <span className={styles.formulaSymbol}>{v.symbol}</span>
            <span className={styles.formulaName}>{v.name}</span>
            <span className={styles.formulaDesc}>{v.desc}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
