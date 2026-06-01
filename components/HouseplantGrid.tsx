'use client'

import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Houseplant } from '@/types/botany'
import styles from './HouseplantGrid.module.css'

/* ── Default seed collection ─────────────────────────────────────── */

const SEED_PLANTS: Omit<Houseplant, 'id'>[] = [
  { plantName: 'Monstera',       species: 'Monstera deliciosa',       lastWateredDate: '2026-05-23', wateringIntervalDays: 7,  location: 'Living Room'  },
  { plantName: 'Golden Pothos',  species: 'Epipremnum aureum',        lastWateredDate: '2026-05-18', wateringIntervalDays: 10, location: 'Office Shelf' },
  { plantName: 'Snake Plant',    species: 'Dracaena trifasciata',     lastWateredDate: '2026-05-22', wateringIntervalDays: 14, location: 'Bedroom'      },
  { plantName: 'Peace Lily',     species: 'Spathiphyllum wallisii',   lastWateredDate: '2026-05-21', wateringIntervalDays: 7,  location: 'Bathroom'     },
  { plantName: 'ZZ Plant',       species: 'Zamioculcas zamiifolia',   lastWateredDate: '2026-05-10', wateringIntervalDays: 21, location: 'Hallway'      },
  { plantName: 'Fiddle-Leaf Fig',species: 'Ficus lyrata',             lastWateredDate: '2026-05-26', wateringIntervalDays: 7,  location: 'Living Room'  },
]

/* ── Dryness computation ─────────────────────────────────────────── */

function daysSince(dateStr: string): number {
  const last = new Date(dateStr)
  const now  = new Date()
  last.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - last.getTime()) / 86_400_000)
}

interface PlantState {
  days:      number
  pct:       number   // 0-100 capped
  isOverdue: boolean
  isWarning: boolean  // 75-99% of interval
}

function usePlantState(plant: Houseplant): PlantState {
  return useMemo(() => {
    const days      = daysSince(plant.lastWateredDate)
    const pct       = Math.min(100, Math.round((days / plant.wateringIntervalDays) * 100))
    const isOverdue = days >= plant.wateringIntervalDays
    const isWarning = pct >= 75 && !isOverdue
    return { days, pct, isOverdue, isWarning }
  }, [plant.lastWateredDate, plant.wateringIntervalDays])
}

/* ── PlantCard sub-component ─────────────────────────────────────── */

function PlantCard({ plant }: { plant: Houseplant }) {
  const { days, pct, isOverdue, isWarning } = usePlantState(plant)
  const today = new Date().toISOString().split('T')[0]

  async function logWatering() {
    if (plant.id === undefined) return
    await db.houseplants.update(plant.id, { lastWateredDate: today })
  }

  const urgency = isOverdue ? 'overdue' : isWarning ? 'warning' : 'normal'

  return (
    <div className={styles.plantCard} data-urgency={urgency}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.plantName}>{plant.plantName}</div>
          <div className={styles.plantSpecies}>{plant.species}</div>
        </div>
        <span className={styles.locationChip}>{plant.location}</span>
      </div>

      <div className={styles.waterStats}>
        <div className={styles.daysStat}>
          <span className={styles.daysNum} data-urgency={urgency}>{days}</span>
          <span className={styles.daysSub}>days since watered</span>
        </div>
        <div className={styles.intervalStat}>
          <span className={styles.intervalNum}>{plant.wateringIntervalDays}</span>
          <span className={styles.daysSub}>day interval</span>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          data-urgency={urgency}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={styles.progressLabel}>
        {isOverdue
          ? `${days - plant.wateringIntervalDays} day${days - plant.wateringIntervalDays !== 1 ? 's' : ''} overdue`
          : `${plant.wateringIntervalDays - days} day${plant.wateringIntervalDays - days !== 1 ? 's' : ''} remaining`
        }
      </div>

      <button
        className={styles.waterBtn}
        data-urgency={urgency}
        onClick={logWatering}
      >
        Log Watering Event
      </button>
    </div>
  )
}

/* ── Seed guard (module-level prevents React StrictMode double-invoke) ── */

let _seedGuard = false

/* ── Main component ──────────────────────────────────────────────── */

export default function HouseplantGrid() {
  const plants = useLiveQuery(() => db.houseplants.toArray(), [])

  // Seed default plants once. The module-level flag prevents the StrictMode
  // double-invoke from writing duplicate rows; the count check clears any
  // duplicates that may have persisted from a previous session.
  useEffect(() => {
    if (_seedGuard) return
    _seedGuard = true
    async function seed() {
      const count = await db.houseplants.count()
      if (count === 0) {
        await db.houseplants.bulkAdd(SEED_PLANTS as Houseplant[])
      } else if (count > SEED_PLANTS.length) {
        await db.houseplants.clear()
        await db.houseplants.bulkAdd(SEED_PLANTS as Houseplant[])
      }
    }
    seed()
  }, [])

  if (!plants) {
    return <div className={styles.loading}>Loading collection…</div>
  }

  const overdueCount = plants.filter(p => daysSince(p.lastWateredDate) >= p.wateringIntervalDays).length

  return (
    <div className={styles.houseplantGrid}>

      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryNum}>{plants.length}</span>
          <span className={styles.summarySub}>plants tracked</span>
        </div>
        {overdueCount > 0 && (
          <div className={styles.summaryItem} data-alert="true">
            <span className={styles.summaryNum} data-alert="true">{overdueCount}</span>
            <span className={styles.summarySub}>need watering</span>
          </div>
        )}
      </div>

      {/* Plant grid */}
      <div className={styles.grid}>
        {plants.map(plant => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>
    </div>
  )
}
