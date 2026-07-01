'use client'

import { useEffect } from 'react'
import { seedGamesDatabase } from '@/lib/gamesDb'
import { useZenithEconomy }  from '@/hooks/useZenithEconomy'
import { useNav }            from '@/lib/NavContext'
import { requestGamesTab }   from '@/lib/gamesNavState'
import styles from './CosmeticPointsIndicator.module.css'

/**
 * Pill-shaped ✦ Credits balance badge.
 * Renders in the Topbar cluster immediately left of the user profile chip.
 * Clicking navigates to the Arcade Hub (Games Tab) where credits are spent.
 *
 * Lifecycle:
 *   1. Mount → skeleton shown while useLiveQuery warms up.
 *   2. seedGamesDatabase() idempotently ensures baseline IDB rows exist so
 *      the indicator resolves even before the user opens the Games Tab.
 *   3. Once the resource_inventory row is present, transitions to the live badge.
 *   4. Any balance change (Crucible claim, theme purchase) propagates in 0ms
 *      via Dexie's reactive useLiveQuery subscription.
 */
export default function CosmeticPointsIndicator() {
  const { resources, cosmeticPoints } = useZenithEconomy()
  const { navigate }                  = useNav()

  // Seed the Games DB so this global indicator can always resolve its data,
  // even if the user has never visited the Games Tab.
  useEffect(() => {
    seedGamesDatabase().catch(() => {
      // Non-critical: the indicator degrades to 0 on seeding failure.
    })
  }, [])

  // An absent cosmetic_points key signals the async IDB boot frame.
  const isLoading = resources['cosmetic_points'] === undefined

  if (isLoading) {
    return (
      <div
        className={styles.skeleton}
        role="status"
        aria-label="Loading Credits balance"
      />
    )
  }

  const formatted = cosmeticPoints.toLocaleString('en-US')

  const handleClick = () => {
    requestGamesTab('shop')
    navigate('games', 'creator')
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      requestGamesTab('shop')
      navigate('games', 'creator')
    }
  }

  return (
    <div
      className={styles.badge}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${formatted} Credits — open Arcade`}
      title="Credits — click to open Arcade"
    >
      <span className={styles.label}>✦</span>
      <span className={styles.value}>{formatted}</span>
    </div>
  )
}
