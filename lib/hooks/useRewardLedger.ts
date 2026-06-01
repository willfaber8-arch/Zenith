'use client'
/**
 * lib/hooks/useRewardLedger.ts — Zenith Gold economy manager
 * Phase 5 · Step 5.4
 *
 * Provides a reactive `goldBalance` derived from userProfile and a
 * validated `purchaseRewardItem` handler that enforces the affordability
 * constraint inside a single IDB transaction before deducting.
 */

import { useState, useCallback } from 'react'
import { useLiveQuery }          from 'dexie-react-hooks'
import { db }                    from '@/lib/db'

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

export interface RewardItem {
  id:          string
  title:       string
  description: string
  cost:        number   // Zenith Gold required to redeem
  emoji:       string
  category:    'leisure' | 'food' | 'rest' | 'social'
}

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'insufficient_gold' | 'profile_missing' }

/* ════════════════════════════════════════════════════════════════
   DEFAULT REWARD CATALOGUE
   ════════════════════════════════════════════════════════════════ */

export const DEFAULT_REWARDS: RewardItem[] = [
  {
    id:          'gaming_30',
    title:       '30-Min Gaming Session',
    description: 'Unlock a guilt-free 30-minute gaming break.',
    cost:        40,
    emoji:       '🎮',
    category:    'leisure',
  },
  {
    id:          'coffee_premium',
    title:       'Premium Coffee Break',
    description: 'Treat yourself to your favourite café order.',
    cost:        60,
    emoji:       '☕',
    category:    'food',
  },
  {
    id:          'stream_ep',
    title:       'Streaming Episode',
    description: 'Watch one full episode with zero guilt.',
    cost:        75,
    emoji:       '📺',
    category:    'leisure',
  },
  {
    id:          'social_20',
    title:       '20-Min Social Break',
    description: 'Open social apps — the timer is authorized.',
    cost:        30,
    emoji:       '💬',
    category:    'social',
  },
  {
    id:          'walk_break',
    title:       'Outdoor Walk Break',
    description: 'Step outside for a refreshing stroll.',
    cost:        50,
    emoji:       '🚶',
    category:    'rest',
  },
  {
    id:          'snack',
    title:       'Favorite Snack',
    description: 'Grab your favourite treat — fully earned.',
    cost:        45,
    emoji:       '🍫',
    category:    'food',
  },
  {
    id:          'sleep_in',
    title:       'Sleep-In Morning',
    description: 'Bank permission to sleep in one morning.',
    cost:        120,
    emoji:       '😴',
    category:    'rest',
  },
  {
    id:          'movie_night',
    title:       'Movie Night',
    description: 'Full movie night with snacks — earned fair and square.',
    cost:        150,
    emoji:       '🎬',
    category:    'leisure',
  },
]

/* ════════════════════════════════════════════════════════════════
   HOOK
   ════════════════════════════════════════════════════════════════ */

export function useRewardLedger() {
  const [purchasing,     setPurchasing]     = useState<Set<string>>(new Set())
  const [recentPurchase, setRecentPurchase] = useState<string | null>(null)

  const profile     = useLiveQuery(() => db?.userProfile.get(1), [])
  const goldBalance = profile?.goldPoints ?? 0

  /**
   * Atomic check-then-deduct inside a single IDB read-write transaction.
   * Returns `{ success: true }` when the purchase lands, or
   * `{ success: false, reason }` when the balance is insufficient or the
   * profile row hasn't been seeded yet.
   */
  const purchaseRewardItem = useCallback(async (
    item: RewardItem,
  ): Promise<PurchaseResult> => {
    if (purchasing.has(item.id)) {
      return { success: false, reason: 'insufficient_gold' }
    }

    setPurchasing(prev => { const s = new Set(prev); s.add(item.id); return s })

    try {
      let result: PurchaseResult = { success: false, reason: 'insufficient_gold' }

      await db.transaction('rw', db.userProfile, async () => {
        const p = await db.userProfile.get(1)
        if (!p) {
          result = { success: false, reason: 'profile_missing' }
          return
        }
        const balance = p.goldPoints ?? 0
        if (balance < item.cost) return   // result stays insufficient

        await db.userProfile.update(1, { goldPoints: balance - item.cost })
        result = { success: true }
      })

      if (result.success) {
        setRecentPurchase(item.id)
        setTimeout(() => setRecentPurchase(null), 2500)
      }
      return result
    } finally {
      setPurchasing(prev => { const s = new Set(prev); s.delete(item.id); return s })
    }
  }, [purchasing])

  return {
    goldBalance,
    profile,
    purchasing,
    recentPurchase,
    purchaseRewardItem,
  }
}
