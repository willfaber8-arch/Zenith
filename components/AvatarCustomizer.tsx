'use client'
/**
 * AvatarCustomizer — Phase 5 · Step 5.2
 * ────────────────────────────────────────────────────────────────
 * Tabbed equipment panel. Four tabs — Head, Torso, Hands, Badge —
 * show an item grid for each equipment slot. Items are:
 *   • Locked    — level (or streak) requirement not met
 *   • Unlocked  — available to equip
 *   • Equipped  — currently worn (highlighted with periwinkle border)
 *
 * Clicking an unlocked item calls equipProfileItem() which validates
 * constraints, writes to IDB, and fires a toast. On success, a
 * `scaleIn` CSS animation plays on the card for instant visual feedback.
 *
 * Props mirror what AvatarCanvas needs so both components can be
 * controlled from the same parent state.
 */

import { useState, useCallback }          from 'react'
import { useLiveQuery }                   from 'dexie-react-hooks'
import { useToast }                       from '@/lib/ToastContext'
import { db }                             from '@/lib/db'
import { equipProfileItem }               from '@/utils/equipHandler'
import {
  AVATAR_ITEMS,
  SLOT_LABELS,
  SLOT_TAB_LABELS,
  getItemsForSlot,
}                                         from '@/config/avatarItems'
import type { EquipSlot }                 from '@/types/avatar'
import styles from './AvatarCustomizer.module.css'

/* ── Tab order ────────────────────────────────────────────── */

const TABS: EquipSlot[] = ['head', 'torso', 'hands', 'accessory']

/* ── Props ────────────────────────────────────────────────── */

export interface AvatarCustomizerProps {
  /** Currently equipped item per slot (resolved with defaults). */
  equippedIds:   Record<EquipSlot, string>
  /** Character's current level — gates item unlock. */
  currentLevel:  number
  /** Max habit streak for streak-gated unlocks. */
  maxStreak:     number
  /** Externally controlled active slot — syncs with AvatarCanvas slot clicks. */
  activeTab:     EquipSlot
  onTabChange:   (slot: EquipSlot) => void
}

/* ════════════════════════════════════════════════════════════════
   ITEM CARD
   ════════════════════════════════════════════════════════════════ */

interface ItemCardProps {
  itemId:       string
  isEquipped:   boolean
  isUnlocked:   boolean
  justEquipped: boolean
  onClick:      () => void
}

function ItemCard({ itemId, isEquipped, isUnlocked, justEquipped, onClick }: ItemCardProps) {
  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  if (!item) return null

  const cardCls = [
    styles.card,
    isEquipped    ? styles.cardActive       : '',
    !isUnlocked   ? styles.cardLocked       : '',
    justEquipped  ? styles.cardJustEquipped : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={cardCls}
      onClick={onClick}
      aria-pressed={isEquipped}
      aria-label={`${item.name}${!isUnlocked ? ` (locked — ${item.unlockHint})` : ''}`}
    >
      {/* Lock icon */}
      {!isUnlocked && <span className={styles.lockIcon} aria-hidden="true">🔒</span>}

      {/* Equipped badge */}
      {isEquipped && isUnlocked && (
        <span className={styles.equippedBadge} aria-hidden="true">ON</span>
      )}

      {/* Icon preview */}
      <div className={styles.cardIcon}>
        <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
          <ItemPreview slot={item.slot} itemId={item.id} color={item.accentColor} />
        </svg>
      </div>

      {/* Text body */}
      <div className={styles.cardBody}>
        <p className={styles.cardName}>{item.name}</p>
        <p className={styles.cardDesc}>{item.description}</p>
        <span className={`${styles.levelBadge} ${isUnlocked ? styles.levelMet : styles.levelLocked}`}>
          {item.streakRequired
            ? `LVL ${item.levelRequired} · ${item.streakRequired}d STREAK`
            : `LVL ${item.levelRequired}`}
        </span>
      </div>
    </button>
  )
}

/* Inline mini icon (mirrors SlotPreviewIcon in AvatarCanvas) */
function ItemPreview({
  slot, itemId, color,
}: { slot: EquipSlot; itemId: string; color: string }) {
  switch (slot) {
    case 'head':
      switch (itemId) {
        case 'focus_band':    return <rect x="4" y="11" width="20" height="6" rx="3" fill={color} opacity="0.9" />
        case 'scholar_crown': return <path d="M4 20 L8 10 L14 16 L20 8 L24 18 Z" fill={color} opacity="0.9" />
        case 'arcane_hood':   return <path d="M4 18 Q4 6 14 4 Q24 6 24 18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        case 'neural_visor':  return <rect x="4" y="8" width="20" height="12" rx="4" fill="none" stroke={color} strokeWidth="2" />
        default: return <circle cx="14" cy="14" r="6" fill={color} opacity="0.5" />
      }
    case 'torso':
      switch (itemId) {
        case 'student_kit':       return <path d="M8 10 L14 18 L20 10" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        case 'scholastic_cloak':  return <path d="M4 10 L10 18 L14 10 M24 10 L18 18 L14 10" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        case 'research_vest':     return <><rect x="4" y="12" width="8" height="10" rx="2" fill={color} opacity="0.5" /><rect x="16" y="12" width="8" height="10" rx="2" fill={color} opacity="0.5" /></>
        case 'zenith_chassis':    return <rect x="4" y="6" width="20" height="16" rx="4" fill="none" stroke={color} strokeWidth="2" />
        default: return <rect x="6" y="6" width="16" height="16" rx="3" fill={color} opacity="0.5" />
      }
    case 'hands':
      switch (itemId) {
        case 'notepad':         return <rect x="8" y="6" width="12" height="16" rx="1.5" fill={color} opacity="0.8" />
        case 'digital_stylus':  return <rect x="12" y="4" width="4" height="20" rx="2" fill={color} opacity="0.9" />
        case 'mech_keys':       return <><rect x="4" y="10" width="20" height="12" rx="3" fill={color} opacity="0.6" /><rect x="6" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" /><rect x="12" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" /><rect x="18" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" /></>
        case 'holo_gloves':     return <rect x="5" y="5" width="18" height="18" rx="6" fill="none" stroke={color} strokeWidth="2" opacity="0.9" />
        default: return <circle cx="14" cy="14" r="7" fill={color} opacity="0.5" />
      }
    case 'accessory':
      switch (itemId) {
        case 'student_id':        return <><rect x="7" y="6" width="14" height="16" rx="2" fill={color} opacity="0.5" /><line x1="9" y1="14" x2="19" y2="14" stroke={color} strokeWidth="1.5" opacity="0.9" /></>
        case 'streak_torch':      return <path d="M14 24 Q9 16 11 10 Q13 6 14 10 Q15 6 17 10 Q19 16 14 24 Z" fill={color} opacity="0.9" />
        case 'honor_pin':         return <path d="M9 8 L19 8 L22 16 L14 22 L6 16 Z" fill={color} opacity="0.9" />
        case 'creators_emblem':   return <path d="M14 4 L16 10 L22 12 L16 14 L14 20 L12 14 L6 12 L12 10 Z" fill={color} opacity="0.9" />
        default: return <circle cx="14" cy="14" r="6" fill={color} opacity="0.5" />
      }
  }
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function AvatarCustomizer({
  equippedIds,
  currentLevel,
  maxStreak,
  activeTab,
  onTabChange,
}: AvatarCustomizerProps) {
  const { toast }                        = useToast()
  const [lastEquipped, setLastEquipped]  = useState<string | null>(null)

  /* isUnlocked: meets level requirement OR meets streak alternative */
  const isUnlocked = useCallback(
    (itemId: string) => {
      const item = AVATAR_ITEMS.find(i => i.id === itemId)
      if (!item) return false
      if (currentLevel >= item.levelRequired) return true
      if (item.streakRequired != null && maxStreak >= item.streakRequired) return true
      return false
    },
    [currentLevel, maxStreak],
  )

  const handleEquip = useCallback(
    async (itemId: string) => {
      const success = await equipProfileItem(itemId, toast, maxStreak)
      if (success) {
        setLastEquipped(itemId)
        // Clear the "just equipped" highlight after the animation
        setTimeout(() => setLastEquipped(null), 500)
      }
    },
    [toast, maxStreak],
  )

  const items = getItemsForSlot(activeTab)

  return (
    <div className={styles.panel}>

      {/* Header */}
      <div className={styles.header}>
        <p className={styles.eyebrow}>Equipment · Customiser</p>
        <span className={styles.slotName}>{SLOT_LABELS[activeTab]}</span>
      </div>

      {/* Tab bar — periwinkle active border per spec */}
      <div className={styles.tabs} role="tablist" aria-label="Equipment slots">
        {TABS.map(slot => (
          <button
            key={slot}
            type="button"
            role="tab"
            aria-selected={slot === activeTab}
            className={`${styles.tab} ${slot === activeTab ? styles.tabActive : ''}`}
            onClick={() => onTabChange(slot)}
          >
            {SLOT_TAB_LABELS[slot]}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div
        className={styles.grid}
        role="tabpanel"
        aria-label={`${SLOT_LABELS[activeTab]} items`}
      >
        {items.map(item => (
          <ItemCard
            key={item.id}
            itemId={item.id}
            isEquipped={equippedIds[activeTab] === item.id}
            isUnlocked={isUnlocked(item.id)}
            justEquipped={lastEquipped === item.id}
            onClick={() => handleEquip(item.id)}
          />
        ))}
      </div>

    </div>
  )
}
