/**
 * types/avatar.ts — Zenith OS Character Avatar System
 * Phase 5 · Step 5.2 — Interactive Character Canvas & Avatar Customizer
 */

/** The four equipment slots surrounding the avatar core. */
export type EquipSlot = 'head' | 'torso' | 'hands' | 'accessory'

/**
 * A single vanity / equipment item in the avatar item registry.
 * Items are unlocked either by reaching `levelRequired` OR by
 * satisfying an optional alternative condition (e.g. habit streak).
 */
export interface AvatarItem {
  id:              string
  name:            string
  description:     string
  slot:            EquipSlot
  levelRequired:   number
  /** Optional secondary unlock: minimum habit streak needed. */
  streakRequired?: number
  /** Human-readable string shown in the lock tooltip / subtitle. */
  unlockHint:      string
  /** CSS color string used to tint the item's SVG overlay and card. */
  accentColor:     string
}

/**
 * Flat map of slot → equipped itemId, as stored in userProfile.
 * Undefined slots fall back to the per-slot default in avatarItems.ts.
 */
export type EquippedItems = Partial<Record<EquipSlot, string>>
