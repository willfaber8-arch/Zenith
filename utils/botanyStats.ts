/**
 * utils/botanyStats.ts — pure botany helpers shared by the Botanist view,
 * the notification center, and the Daily Outlook. No React, no Dexie.
 */

import type { Houseplant, PlantLogEntry } from '@/types/botany'

const DAY_MS = 86_400_000

/** Whole days between an ISO 'YYYY-MM-DD' date and today (local midnight). */
export function daysSinceISO(dateStr: string): number {
  const last = new Date(dateStr); last.setHours(0, 0, 0, 0)
  const now  = new Date();        now.setHours(0, 0, 0, 0)
  if (Number.isNaN(last.getTime())) return 0
  return Math.floor((now.getTime() - last.getTime()) / DAY_MS)
}

export interface WateringInfo {
  daysSince:   number
  daysUntil:   number   // days until next watering (negative = overdue)
  isDue:       boolean  // due today or overdue
  isOverdue:   boolean  // strictly past the interval
  daysOverdue: number   // 0 when not overdue
}

/** Compute a plant's watering status from its last-watered date + interval. */
export function wateringInfo(plant: Houseplant): WateringInfo {
  const interval  = Math.max(1, plant.wateringIntervalDays || 1)
  const daysSince = daysSinceISO(plant.lastWateredDate)
  const daysUntil = interval - daysSince
  const isOverdue = daysSince > interval
  return {
    daysSince,
    daysUntil,
    isDue:       daysSince >= interval,
    isOverdue,
    daysOverdue: isOverdue ? daysSince - interval : 0,
  }
}

/** True if the plant will need watering within the next `n` days (incl. now). */
export function dueWithinDays(plant: Houseplant, n: number): boolean {
  return wateringInfo(plant).daysUntil <= n
}

export type HealthTrend = 'up' | 'down' | 'flat' | null

/**
 * Derive a health trend from a plant's log entries. Looks at entries that
 * carry a healthRating, oldest→newest, and compares the two most recent
 * ratings. Returns null when there isn't enough data (<2 ratings).
 */
export function healthTrendFromEntries(entries: PlantLogEntry[]): HealthTrend {
  const rated = entries
    .filter(e => typeof e.healthRating === 'number')
    .sort((a, b) => a.createdAt - b.createdAt)
  if (rated.length < 2) return null

  // Compare the latest rating against the one before it, with a small
  // tolerance so a single equal reading reads as flat.
  const latest = rated[rated.length - 1].healthRating as number
  const prev   = rated[rated.length - 2].healthRating as number
  if (latest > prev) return 'up'
  if (latest < prev) return 'down'
  return 'flat'
}

/** Latest health rating recorded for a plant (entries or the plant's own field). */
export function latestHealth(plant: Houseplant, entries: PlantLogEntry[]): number | null {
  const rated = entries
    .filter(e => typeof e.healthRating === 'number')
    .sort((a, b) => b.createdAt - a.createdAt)
  if (rated.length > 0) return rated[0].healthRating as number
  return typeof plant.healthRating === 'number' ? plant.healthRating : null
}

export interface GardenStats {
  total:        number
  needWater:    number   // due or overdue now
  dueThisWeek:  number   // due within 7 days
  avgHealth:    number | null   // mean of latest health ratings, 1 decimal
  improving:    number
  declining:    number
}

/** Aggregate garden-wide stats from plants + their grouped log entries. */
export function computeGardenStats(
  plants: Houseplant[],
  entriesByPlant: Map<number, PlantLogEntry[]>,
): GardenStats {
  let needWater = 0, dueThisWeek = 0, improving = 0, declining = 0
  const healths: number[] = []

  for (const p of plants) {
    const info = wateringInfo(p)
    if (info.isDue) needWater++
    if (info.daysUntil <= 7) dueThisWeek++

    const entries = (p.id != null ? entriesByPlant.get(p.id) : undefined) ?? []
    const h = latestHealth(p, entries)
    if (h != null) healths.push(h)
    const trend = healthTrendFromEntries(entries)
    if (trend === 'up') improving++
    else if (trend === 'down') declining++
  }

  const avgHealth = healths.length > 0
    ? Math.round((healths.reduce((s, x) => s + x, 0) / healths.length) * 10) / 10
    : null

  return { total: plants.length, needWater, dueThisWeek, avgHealth, improving, declining }
}
