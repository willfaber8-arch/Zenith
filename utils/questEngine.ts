/**
 * utils/questEngine.ts — Procedural Daily Quest Generation Engine
 * Phase 5 · Step 5.4 — Daily Quest Matrix & Reward Ledger Vault
 *
 * Pure functions — zero React, zero Dexie.
 * Deterministic per-day selection via FNV-1a seeded hash.
 * Quest state persists in localStorage under `zenith_quest_v1`.
 */

import type { Habit, Assignment } from '@/lib/db'

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

export type QuestTier = 'daily' | 'boss'
export type QuestType = 'routine_anchor' | 'scholar_sprint' | 'boss_battle'

export interface Quest {
  id:          string    // stable unique key, e.g. "routine_anchor_2026-05-31"
  type:        QuestType
  tier:        QuestTier
  title:       string
  description: string
  xpReward:    number
  goldReward:  number
  sourceId:    number    // habit.id or assignment.id
  sourceTitle: string    // habit.name or assignment.title
  priority?:   string    // boss battles only — shows priority badge
}

export interface DailyQuestPacket {
  date:         string    // ISO "YYYY-MM-DD" — generation anchor for midnight resets
  quests:       Quest[]   // daily (routine_anchor + scholar_sprint)
  bossBattles:  Quest[]   // live high/critical assignments — not cached
  completedIds: string[]  // quest IDs marked done this calendar day
}

/* ════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const LS_KEY = 'zenith_quest_v1'

export const QUEST_REWARDS = {
  routine_anchor: { xp: 20,  gold: 10  },
  scholar_sprint: { xp: 40,  gold: 20  },
  boss_battle:    { xp: 100, gold: 50  },
} as const

/* ════════════════════════════════════════════════════════════════
   DATE UTILITIES
   ════════════════════════════════════════════════════════════════ */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ════════════════════════════════════════════════════════════════
   SEEDED RANDOMISATION
   ────────────────────────────────────────────────────────────────
   FNV-1a hash on the date string gives the same index for the
   same calendar day, so page reloads don't reshuffle the quests.
   ════════════════════════════════════════════════════════════════ */

function seededIndex(seed: string, max: number): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h  = Math.imul(h, 16777619) >>> 0
  }
  return h % max
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */

function buildBossQuest(a: Assignment): Quest {
  const r = QUEST_REWARDS.boss_battle
  return {
    id:          `boss_${a.id}`,
    type:        'boss_battle',
    tier:        'boss',
    title:       'Epic Boss Battle',
    description: `Defeat: "${a.title}"`,
    xpReward:    r.xp,
    goldReward:  r.gold,
    sourceId:    a.id!,
    sourceTitle: a.title,
    priority:    a.priority,
  }
}

function persistPacket(p: DailyQuestPacket): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch { /* storage quota exceeded — silently skip */ }
}

/* ════════════════════════════════════════════════════════════════
   MAIN GENERATION FUNCTION
   ════════════════════════════════════════════════════════════════ */

/**
 * Generates a DailyQuestPacket from current IDB snapshots.
 *
 * Strategy:
 *   • Boss battles are always live — derived from IDB, never cached.
 *   • Daily quests (routine_anchor + scholar_sprint) are selected
 *     once per calendar day via seeded hash and cached in localStorage.
 *     On midnight rollover the date key mismatches, triggering a fresh
 *     selection from the current habit/assignment state.
 */
export function generateDailyQuests(
  habits:      Habit[],
  assignments: Assignment[],
): DailyQuestPacket {
  const today = todayISO()

  // Attempt to restore cached packet
  let cached: DailyQuestPacket | null = null
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(LS_KEY)
      : null
    if (raw) cached = JSON.parse(raw) as DailyQuestPacket
  } catch { /* malformed JSON — ignore */ }

  // Boss battles are always derived fresh from IDB
  const bossBattles = assignments
    .filter(a =>
      (a.priority === 'high' || a.priority === 'critical') &&
      a.status !== 'completed',
    )
    .map(buildBossQuest)

  // Return cached daily quests when still within the same calendar day.
  // Require at least one quest to be present in the cache — an empty cached
  // packet means data wasn't ready on the initial render (useLiveQuery default
  // []) and should not block correct generation once IDB resolves.
  if (cached?.date === today && cached.quests.length > 0) {
    return { ...cached, bossBattles }
  }

  // ── Fresh daily generation ──────────────────────────────────
  const quests: Quest[] = []

  // The Routine Anchor — deterministic random habit for today
  const eligibleHabits = habits.filter(h => h.id !== undefined)
  if (eligibleHabits.length > 0) {
    const h = eligibleHabits[seededIndex(today + ':h', eligibleHabits.length)]
    const r = QUEST_REWARDS.routine_anchor
    quests.push({
      id:          `routine_anchor_${today}`,
      type:        'routine_anchor',
      tier:        'daily',
      title:       'The Routine Anchor',
      description: `Complete your habit: "${h.name}"`,
      xpReward:    r.xp,
      goldReward:  r.gold,
      sourceId:    h.id!,
      sourceTitle: h.name,
    })
  }

  // The Scholar's Sprint — closest incomplete assignment by due date
  const upcoming = assignments
    .filter(a => a.status !== 'completed' && a.status !== 'overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  if (upcoming.length > 0) {
    const a = upcoming[0]
    const r = QUEST_REWARDS.scholar_sprint
    quests.push({
      id:          `scholar_sprint_${today}`,
      type:        'scholar_sprint',
      tier:        'daily',
      title:       "The Scholar's Sprint",
      description: `Clear this assignment: "${a.title}"`,
      xpReward:    r.xp,
      goldReward:  r.gold,
      sourceId:    a.id!,
      sourceTitle: a.title,
    })
  }

  const packet: DailyQuestPacket = {
    date:         today,
    quests,
    bossBattles,
    completedIds: [],
  }
  persistPacket(packet)
  return packet
}

/* ════════════════════════════════════════════════════════════════
   COMPLETION MUTATIONS
   ════════════════════════════════════════════════════════════════ */

export function markQuestComplete(
  packet:  DailyQuestPacket,
  questId: string,
): DailyQuestPacket {
  if (packet.completedIds.includes(questId)) return packet
  const updated: DailyQuestPacket = {
    ...packet,
    completedIds: [...packet.completedIds, questId],
  }
  persistPacket(updated)
  return updated
}

export function isQuestComplete(
  packet:  DailyQuestPacket,
  questId: string,
): boolean {
  return packet.completedIds.includes(questId)
}
