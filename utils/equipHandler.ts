/**
 * utils/equipHandler.ts — Level-Gated Equipment Handler
 * Phase 5 · Step 5.2
 *
 * Validates level (and optional streak) constraints before writing
 * an equipped item to the userProfile singleton in IDB.
 *
 * Import only in `'use client'` components or event handlers.
 */

import { db }                           from '@/lib/db'
import { AVATAR_ITEMS, DEFAULT_EQUIPPED } from '@/config/avatarItems'
import type { EquipSlot }               from '@/types/avatar'

type ToastFn = (message: string, type: 'info' | 'success' | 'error') => void

/**
 * Equips `itemId` to its designated slot on the userProfile singleton.
 *
 * Validation order:
 *   1. Item must exist in the registry.
 *   2. `profile.currentLevel >= item.levelRequired`
 *      — OR — `maxHabitStreak >= item.streakRequired` (if present)
 *   3. On failure: calls `showToast` with an error and returns false.
 *   4. On success: writes to IDB and returns true.
 *
 * @param itemId       ID of the item to equip.
 * @param showToast    Toast callback from useToast().
 * @param maxStreak    Highest streakCount across all habits (0 if unknown).
 */
export async function equipProfileItem(
  itemId:     string,
  showToast:  ToastFn,
  maxStreak = 0,
): Promise<boolean> {
  if (!db) return false

  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  if (!item) return false

  const profile = await db.userProfile.get(1)
  if (!profile) return false

  /* ── Level / streak constraint check ──────────────────────── */
  const meetsLevel  = profile.currentLevel >= item.levelRequired
  const meetsStreak = item.streakRequired != null && maxStreak >= item.streakRequired

  if (!meetsLevel && !meetsStreak) {
    const req = item.streakRequired != null
      ? `Level ${item.levelRequired} or a ${item.streakRequired}-day habit streak`
      : `Level ${item.levelRequired}`
    showToast(
      `Level requirement not met. "${item.name}" requires ${req}. You are Level ${profile.currentLevel}.`,
      'error',
    )
    return false
  }

  /* ── Write equipped state ──────────────────────────────────── */
  const current: Partial<Record<EquipSlot, string>> =
    (profile.equippedItems as Partial<Record<EquipSlot, string>>) ?? { ...DEFAULT_EQUIPPED }

  await db.userProfile.update(1, {
    equippedItems: { ...current, [item.slot]: itemId },
  })

  showToast(`"${item.name}" equipped.`, 'success')
  return true
}

/**
 * Resolves the full equipped map from a (possibly sparse) profile value,
 * filling any missing slots with the DEFAULT_EQUIPPED fallback.
 */
export function resolveEquipped(
  equippedItems: Record<string, string> | undefined,
): Record<EquipSlot, string> {
  const e = equippedItems as Partial<Record<EquipSlot, string>> | undefined
  return {
    head:      e?.head      ?? DEFAULT_EQUIPPED.head,
    torso:     e?.torso     ?? DEFAULT_EQUIPPED.torso,
    hands:     e?.hands     ?? DEFAULT_EQUIPPED.hands,
    accessory: e?.accessory ?? DEFAULT_EQUIPPED.accessory,
  }
}
