'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useCallback, useMemo } from 'react'
import { db } from '@/lib/db'
import { calculateTrueMonthlyCost } from '@/types/finance'
import type { SubscriptionItem, BillingCycle } from '@/types/finance'

/* ── localStorage persistence key ────────────────────────── */
const BUDGET_KEY = 'zenith_sub_budget_v1'
const DEFAULT_THRESHOLD = 50

function readStoredThreshold(): number {
  try {
    const raw = localStorage.getItem(BUDGET_KEY)
    if (raw !== null) {
      const v = parseFloat(raw)
      if (!isNaN(v) && v > 0) return v
    }
  } catch {
    // localStorage unavailable (SSR / private mode)
  }
  return DEFAULT_THRESHOLD
}

/* ── Public types ─────────────────────────────────────────── */

export interface BundleGroup {
  bundle: string
  items: SubscriptionItem[]
  totalMonthly: number
}

export interface SubscriptionAnalytics {
  /** Raw item list (live-reactive via useLiveQuery) */
  items: SubscriptionItem[]
  /** Total number of active subscriptions */
  totalCount: number
  /** Sum of all true monthly costs (ANNUAL items ÷ 12) */
  grossMonthlyOutflow: number
  /** Items grouped by categoryBundle, sorted heaviest-first */
  bundleGroups: BundleGroup[]
  /** User-defined budget ceiling (default $50) */
  budgetThreshold: number
  /** Persist a new budget ceiling to localStorage */
  setBudgetThreshold: (value: number) => void
  /** true when grossMonthlyOutflow >= budgetThreshold */
  criticalBurn: boolean
  /** Percentage of budget consumed (0–999+) */
  burnPercent: number
  /** Write a new subscription to IDB */
  addItem: (data: Omit<SubscriptionItem, 'id'>) => Promise<void>
  /** Delete a subscription by UUID */
  removeItem: (id: string) => Promise<void>
  /** Partial-update a subscription by UUID */
  updateItem: (id: string, patch: Partial<Omit<SubscriptionItem, 'id'>>) => Promise<void>
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useSubscriptionAnalytics(): SubscriptionAnalytics {
  const [threshold, setThresholdState] = useState<number>(() =>
    typeof window !== 'undefined' ? readStoredThreshold() : DEFAULT_THRESHOLD
  )

  /* Live-reactive IDB query — re-renders whenever any row changes */
  const items: SubscriptionItem[] = useLiveQuery(
    () => db.subscription_items.toArray(),
    []
  ) ?? []

  /* Aggregate burn: normalize all costs to monthly before summing */
  const grossMonthlyOutflow = useMemo(
    () => items.reduce(
      (sum, item) => sum + calculateTrueMonthlyCost(item.monthlyCost, item.billingCycle),
      0
    ),
    [items]
  )

  /* Group items by bundle, sort by descending total monthly spend */
  const bundleGroups = useMemo<BundleGroup[]>(() => {
    const map = new Map<string, SubscriptionItem[]>()
    for (const item of items) {
      const bucket = map.get(item.categoryBundle) ?? []
      bucket.push(item)
      map.set(item.categoryBundle, bucket)
    }
    return Array.from(map.entries())
      .map(([bundle, bundleItems]) => ({
        bundle,
        items: bundleItems,
        totalMonthly: bundleItems.reduce(
          (s, i) => s + calculateTrueMonthlyCost(i.monthlyCost, i.billingCycle),
          0
        ),
      }))
      .sort((a, b) => b.totalMonthly - a.totalMonthly)
  }, [items])

  /* Budget guard loop */
  const criticalBurn = grossMonthlyOutflow >= threshold
  const burnPercent  = threshold > 0
    ? (grossMonthlyOutflow / threshold) * 100
    : 0

  /* Stable setter — writes both React state and localStorage */
  const setBudgetThreshold = useCallback((value: number) => {
    setThresholdState(value)
    try { localStorage.setItem(BUDGET_KEY, String(value)) } catch { /* noop */ }
  }, [])

  /* IDB mutation helpers — all stable via useCallback([]) */

  const addItem = useCallback(async (data: Omit<SubscriptionItem, 'id'>) => {
    const id = crypto.randomUUID()
    await db.subscription_items.add({ ...data, id })
  }, [])

  const removeItem = useCallback(async (id: string) => {
    await db.subscription_items.delete(id)
  }, [])

  const updateItem = useCallback(
    async (id: string, patch: Partial<Omit<SubscriptionItem, 'id'>>) => {
      await db.subscription_items.update(id, patch as Partial<SubscriptionItem>)
    },
    []
  )

  return {
    items,
    totalCount: items.length,
    grossMonthlyOutflow,
    bundleGroups,
    budgetThreshold: threshold,
    setBudgetThreshold,
    criticalBurn,
    burnPercent,
    addItem,
    removeItem,
    updateItem,
  }
}

/* ── Re-export for convenience at consumer call sites ─────── */
export type { SubscriptionItem, BillingCycle }
