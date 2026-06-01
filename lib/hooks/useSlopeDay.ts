'use client'
/**
 * lib/hooks/useSlopeDay.ts — Reactive Slope Day countdown hook
 * Phase 5 · Step 5.7
 *
 * Recomputes HypeMetrics every 30 seconds so the countdown display
 * stays current without unnecessary re-renders.  The hypeMultiplier
 * is also used by useQuestBoard to scale quest rewards automatically.
 */

import { useState, useEffect } from 'react'
import { computeHypeMetrics, type HypeMetrics } from '@/utils/slopeDay'

const TICK_MS = 30_000   // recompute every 30 seconds

export function useSlopeDay(): HypeMetrics {
  const [metrics, setMetrics] = useState<HypeMetrics>(
    () => computeHypeMetrics(),
  )

  useEffect(() => {
    // Immediate refresh in case mount happened mid-second
    setMetrics(computeHypeMetrics())

    const id = setInterval(() => {
      setMetrics(computeHypeMetrics())
    }, TICK_MS)

    return () => clearInterval(id)
  }, [])

  return metrics
}
