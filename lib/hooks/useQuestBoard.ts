'use client'
/**
 * lib/hooks/useQuestBoard.ts — Quest Board state manager
 * Phase 5 · Step 5.4
 *
 * Bridges the pure questEngine functions with live IDB data via
 * useLiveQuery. Handles daily quest generation, completion gating,
 * and XP/Gold dispatch.
 */

import { useState, useEffect } from 'react'
import { useLiveQuery }        from 'dexie-react-hooks'
import { db, awardXp, awardGold } from '@/lib/db'
import { useToast }            from '@/lib/ToastContext'
import { useSlopeDay }         from '@/lib/hooks/useSlopeDay'
import { applyHypeMultiplier, fmtMultiplier, HYPE_PHASE_LABELS } from '@/utils/slopeDay'
import {
  generateDailyQuests,
  markQuestComplete,
  isQuestComplete,
  type DailyQuestPacket,
  type Quest,
} from '@/utils/questEngine'

export type { Quest, DailyQuestPacket }

/* ════════════════════════════════════════════════════════════════
   HOOK
   ════════════════════════════════════════════════════════════════ */

export function useQuestBoard() {
  const [packet,     setPacket]     = useState<DailyQuestPacket | null>(null)
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const { toast }                   = useToast()
  const { hypeMultiplier, hypePhase } = useSlopeDay()

  const habits = useLiveQuery(
    () => db?.habits.toArray() ?? Promise.resolve([]),
    [],
    [],
  )

  const assignments = useLiveQuery(
    () => db?.assignments.toArray() ?? Promise.resolve([]),
    [],
    [],
  )

  // Re-generate whenever IDB data changes (or on first load).
  // Boss battles are re-derived from live data on every call so
  // newly added high-priority tasks appear instantly.
  useEffect(() => {
    if (!habits || !assignments) return
    setPacket(generateDailyQuests(habits, assignments))
  }, [habits, assignments])

  /**
   * Marks a quest as complete, awards scaled XP and Gold (with hype
   * multiplier applied), then updates the localStorage packet.
   * Idempotent — silently no-ops on repeat calls.
   */
  async function completeQuest(quest: Quest): Promise<void> {
    if (!packet)                          return
    if (completing.has(quest.id))         return
    if (isQuestComplete(packet, quest.id)) return

    setCompleting(prev => { const s = new Set(prev); s.add(quest.id);    return s })
    try {
      const scaledXp   = applyHypeMultiplier(quest.xpReward,  hypeMultiplier)
      const scaledGold = applyHypeMultiplier(quest.goldReward, hypeMultiplier)

      await awardXp(scaledXp)
      await awardGold(scaledGold)
      setPacket(prev => prev ? markQuestComplete(prev, quest.id) : prev)

      // Toast — show hype bonus when multiplier is active
      if (hypeMultiplier > 1.0) {
        toast(
          `Quest Complete! +${scaledXp} XP  +${scaledGold} Gold  ` +
          `⚡ ${fmtMultiplier(hypeMultiplier)} ${HYPE_PHASE_LABELS[hypePhase]}`,
          'success',
        )
      }
    } finally {
      setCompleting(prev => { const s = new Set(prev); s.delete(quest.id); return s })
    }
  }

  const allQuests = packet
    ? [...(packet.quests), ...(packet.bossBattles)]
    : []

  return {
    packet,
    completing,
    completeQuest,
    hypeMultiplier,
    hypePhase,
    isComplete:     (id: string) => packet ? isQuestComplete(packet, id) : false,
    dailyCount:     packet?.quests.length      ?? 0,
    bossCount:      packet?.bossBattles.length ?? 0,
    completedCount: packet
      ? allQuests.filter(q => packet.completedIds.includes(q.id)).length
      : 0,
    totalCount: allQuests.length,
  }
}
