/**
 * lib/SkillModifierContext.tsx — Global Skill Modifier Broadcast
 * Phase 7 · Step 7.2 — Branching Skill Trees & Focus Perks
 *
 * Computes and exposes the aggregated SkillModifiers object to the entire
 * React tree so other systems can read active perk bonuses without coupling
 * to the full useSkillTree hook.
 *
 * Integration reference:
 *   FatigueContext.tsx       → read modifiers.fatigueRateMultiplier
 *   usePomodoroStateMachine  → add modifiers.pomodoroMinuteBonus to WORK_SECS
 *   RpgSyncEffect / awardXp → multiply by modifiers.assignmentXpBonus
 *   awardGold / quest engine → multiply by modifiers.assignmentGoldMultiplier
 *   Habit streak hooks       → multiply by modifiers.streakXpMultiplier
 */

'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  computeModifiers,
  DEFAULT_MODIFIERS,
  type SkillModifiers,
} from '@/types/skillTree'

/* ── Context shape ───────────────────────────────────────────── */

interface SkillModifierContextValue {
  modifiers: SkillModifiers
  /** True while the first IDB read is in-flight — callers receive DEFAULT_MODIFIERS */
  isLoading: boolean
}

const SkillModifierCtx = createContext<SkillModifierContextValue>({
  modifiers: DEFAULT_MODIFIERS,
  isLoading: true,
})

/* ── Provider ────────────────────────────────────────────────── */

export function SkillModifierProvider({ children }: { children: ReactNode }) {
  // Read only the two skill-related fields from userProfile — the reactive
  // subscription means any purchase immediately propagates to all consumers.
  const profile = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return undefined
      try {
        const { getDb } = require('@/lib/db') as typeof import('@/lib/db')
        return getDb().userProfile.get(1)
      } catch { return undefined }
    },
    [],
  )

  const isLoading = profile === undefined

  const modifiers = useMemo(
    () => profile
      ? computeModifiers(profile.unlockedSkillNodeIds ?? [])
      : DEFAULT_MODIFIERS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.unlockedSkillNodeIds],
  )

  return (
    <SkillModifierCtx.Provider value={{ modifiers, isLoading }}>
      {children}
    </SkillModifierCtx.Provider>
  )
}

/* ── Hook ────────────────────────────────────────────────────── */

/**
 * Returns the current aggregated skill modifier values.
 * Safe to call from any client component inside SkillModifierProvider.
 *
 * @example
 * const { modifiers } = useSkillModifiers()
 * const effectiveGold = baseGold * modifiers.assignmentGoldMultiplier
 */
export function useSkillModifiers(): SkillModifierContextValue {
  return useContext(SkillModifierCtx)
}
