'use client'
/**
 * AvatarCanvas — Phase 5 · Step 5.2
 * ────────────────────────────────────────────────────────────────
 * Procedural SVG avatar layout with:
 *   • Geometric scholar-warrior figure (SVG primitives, no assets)
 *   • HP-reactive visual states:
 *       HP > 70  → ocean-sage drop-shadow glow
 *       HP < 30  → feColorMatrix desaturate + CSS pulse animation
 *   • Four equipment slot indicators (Head, Torso, Hands, Accessory)
 *     absolutely positioned around the avatar core
 *   • Per-slot item overlays rendered directly inside the SVG canvas
 *
 * Props:
 *   equippedIds   — resolved slot → itemId map (from resolveEquipped)
 *   healthPoints  — current HP value (0–100)
 *   activeSlot    — which slot tab is currently open in the customizer
 *   onSlotClick   — callback when a slot indicator is clicked
 */

import type { EquipSlot }                from '@/types/avatar'
import { AVATAR_ITEMS, DEFAULT_EQUIPPED } from '@/config/avatarItems'
import styles from './AvatarCanvas.module.css'

/* ════════════════════════════════════════════════════════════════
   ITEM OVERLAY RENDERER
   Returns SVG <g> children (no wrapping element) for each slot.
   All coordinates are in the 220 × 320 viewBox space.
   ════════════════════════════════════════════════════════════════ */

function HeadOverlay({ itemId }: { itemId: string }) {
  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  const c = item?.accentColor ?? '#7c95ff'

  switch (itemId) {
    case 'focus_band':
      return (
        <rect x="80" y="28" width="60" height="9" rx="4.5"
          fill={c} opacity="0.85" />
      )
    case 'scholar_crown':
      return (
        <path
          d="M88 28 L95 10 L102 24 L110 6 L118 24 L125 10 L132 28 Z"
          fill={c} opacity="0.9"
        />
      )
    case 'arcane_hood':
      return (
        <path
          d="M78 40 Q76 16 110 8 Q144 16 142 40"
          fill="none" stroke={c} strokeWidth="3.5"
          strokeLinecap="round" opacity="0.9"
        />
      )
    case 'neural_visor':
      return (
        <>
          <rect x="80" y="44" width="60" height="34" rx="12"
            fill={c} opacity="0.22" />
          <rect x="80" y="44" width="60" height="34" rx="12"
            fill="none" stroke={c} strokeWidth="1.5" opacity="0.9" />
          <line x1="87" y1="54" x2="133" y2="54"
            stroke={c} strokeWidth="1" opacity="0.5" />
          <circle cx="100" cy="61" r="3" fill={c} opacity="0.8" />
          <circle cx="120" cy="61" r="3" fill={c} opacity="0.8" />
        </>
      )
    default:
      return null
  }
}

function TorsoOverlay({ itemId }: { itemId: string }) {
  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  const c = item?.accentColor ?? '#9ba3c4'

  switch (itemId) {
    case 'student_kit':
      // Subtle collar V
      return (
        <path d="M96 116 L110 136 L124 116"
          stroke={c} strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      )
    case 'scholastic_cloak':
      // Dual flowing lapels
      return (
        <>
          <path d="M68 116 L84 142 L96 116"
            stroke={c} strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          <path d="M152 116 L136 142 L124 116"
            stroke={c} strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          {/* Clasp */}
          <circle cx="110" cy="136" r="4"
            fill={c} opacity="0.9" />
        </>
      )
    case 'research_vest':
      // Left and right pocket details
      return (
        <>
          <rect x="68" y="136" width="20" height="26" rx="3"
            fill={c} opacity="0.30" stroke={c} strokeWidth="1.5" />
          <rect x="132" y="136" width="20" height="26" rx="3"
            fill={c} opacity="0.30" stroke={c} strokeWidth="1.5" />
          <line x1="73" y1="144" x2="83" y2="144"
            stroke={c} strokeWidth="1" opacity="0.6" />
          <line x1="137" y1="144" x2="147" y2="144"
            stroke={c} strokeWidth="1" opacity="0.6" />
        </>
      )
    case 'zenith_chassis':
      // Armored chest plate border
      return (
        <>
          <rect x="68" y="116" width="84" height="68" rx="10"
            fill="none" stroke={c} strokeWidth="2.5" opacity="0.9" />
          <line x1="68" y1="134" x2="152" y2="134"
            stroke={c} strokeWidth="1" opacity="0.4" />
          <path d="M68 116 L52 120 L52 132 L68 128 Z"
            fill={c} opacity="0.5" />
          <path d="M152 116 L168 120 L168 132 L152 128 Z"
            fill={c} opacity="0.5" />
        </>
      )
    default:
      return null
  }
}

function HandsOverlay({ itemId }: { itemId: string }) {
  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  const c = item?.accentColor ?? '#e8eaf6'

  switch (itemId) {
    case 'notepad':
      return (
        <>
          <rect x="30" y="184" width="18" height="24" rx="2"
            fill={c} opacity="0.75" />
          <line x1="33" y1="190" x2="45" y2="190"
            stroke="#0b0d13" strokeWidth="1.5" opacity="0.5" />
          <line x1="33" y1="194" x2="45" y2="194"
            stroke="#0b0d13" strokeWidth="1.5" opacity="0.5" />
          <line x1="33" y1="198" x2="42" y2="198"
            stroke="#0b0d13" strokeWidth="1.5" opacity="0.5" />
        </>
      )
    case 'digital_stylus':
      return (
        <>
          <rect x="37" y="174" width="4" height="38" rx="2"
            fill={c} opacity="0.9" />
          <path d="M35 212 L39 218 L43 212 Z"
            fill={c} opacity="0.9" />
        </>
      )
    case 'mech_keys':
      return (
        <>
          <rect x="24" y="190" width="32" height="18" rx="4"
            fill={c} opacity="0.55" stroke={c} strokeWidth="1.5" />
          <rect x="27" y="193" width="6" height="5" rx="1" fill="#0b0d13" opacity="0.6" />
          <rect x="35" y="193" width="6" height="5" rx="1" fill="#0b0d13" opacity="0.6" />
          <rect x="43" y="193" width="6" height="5" rx="1" fill="#0b0d13" opacity="0.6" />
          <rect x="27" y="200" width="22" height="5" rx="1" fill="#0b0d13" opacity="0.6" />
        </>
      )
    case 'holo_gloves':
      return (
        <>
          {/* Left forearm glow outline */}
          <rect x="28" y="176" width="26" height="42" rx="10"
            fill="none" stroke={c} strokeWidth="2" opacity="0.85" />
          <rect x="28" y="176" width="26" height="42" rx="10"
            fill={c} opacity="0.08" />
          {/* Right hand */}
          <rect x="166" y="176" width="26" height="42" rx="10"
            fill="none" stroke={c} strokeWidth="2" opacity="0.85" />
          <rect x="166" y="176" width="26" height="42" rx="10"
            fill={c} opacity="0.08" />
        </>
      )
    default:
      return null
  }
}

function AccessoryOverlay({ itemId }: { itemId: string }) {
  const item = AVATAR_ITEMS.find(i => i.id === itemId)
  const c = item?.accentColor ?? '#9ba3c4'

  switch (itemId) {
    case 'student_id':
      return (
        <>
          <rect x="148" y="128" width="18" height="24" rx="2"
            fill={c} opacity="0.35" stroke={c} strokeWidth="1.2" />
          <line x1="151" y1="136" x2="163" y2="136"
            stroke={c} strokeWidth="1" opacity="0.7" />
          <line x1="151" y1="140" x2="163" y2="140"
            stroke={c} strokeWidth="1" opacity="0.7" />
          <circle cx="157" cy="132" r="3" fill={c} opacity="0.7" />
        </>
      )
    case 'streak_torch':
      return (
        <path
          d="M158 156 Q153 143 156 134 Q158 129 161 134 Q163 128 166 133 Q170 142 164 156 Z"
          fill={c} opacity="0.90"
        />
      )
    case 'honor_pin':
      return (
        <path
          d="M157 128 L163 128 L167 138 L160 146 L153 138 Z"
          fill={c} opacity="0.90"
        />
      )
    case 'creators_emblem':
      // 8-point compass star
      return (
        <path
          d="M160 126 L162 133 L169 135 L162 137 L160 144
             L158 137 L151 135 L158 133 Z"
          fill={c} opacity="0.92"
        />
      )
    default:
      return null
  }
}

/* ════════════════════════════════════════════════════════════════
   SLOT INDICATOR BUTTON
   ════════════════════════════════════════════════════════════════ */

interface SlotIndicatorProps {
  slot:       EquipSlot
  equippedId: string
  label:      string
  posClass:   string
  isActive:   boolean
  onClick:    () => void
}

function SlotIndicator({
  slot, equippedId, label, posClass, isActive, onClick,
}: SlotIndicatorProps) {
  const item = AVATAR_ITEMS.find(i => i.id === equippedId)
  const color = item?.accentColor ?? '#5c6487'

  return (
    <button
      type="button"
      className={`${styles.slot} ${posClass} ${isActive ? styles.slotActive : ''}`}
      onClick={onClick}
      aria-label={`${label}: ${item?.name ?? 'Empty'}. Click to customise.`}
    >
      <div className={styles.slotIcon}>
        {/* Mini slot preview SVG (28×28) */}
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <SlotPreviewIcon slot={slot} itemId={equippedId} color={color} />
        </svg>
      </div>
      <span className={styles.slotLabel}>{label}</span>
    </button>
  )
}

function SlotPreviewIcon({
  slot, itemId, color,
}: { slot: EquipSlot; itemId: string; color: string }) {
  switch (slot) {
    case 'head':
      switch (itemId) {
        case 'focus_band':
          return <rect x="4" y="11" width="20" height="6" rx="3" fill={color} opacity="0.9" />
        case 'scholar_crown':
          return <path d="M4 20 L8 10 L14 16 L20 8 L24 18 Z" fill={color} opacity="0.9" />
        case 'arcane_hood':
          return <path d="M4 18 Q4 6 14 4 Q24 6 24 18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        case 'neural_visor':
          return <rect x="4" y="8" width="20" height="12" rx="4" fill="none" stroke={color} strokeWidth="2" />
        default:
          return <circle cx="14" cy="14" r="6" fill={color} opacity="0.5" />
      }
    case 'torso':
      switch (itemId) {
        case 'student_kit':
          return <path d="M8 10 L14 18 L20 10" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        case 'scholastic_cloak':
          return <path d="M4 10 L10 18 L14 10 M24 10 L18 18 L14 10" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        case 'research_vest':
          return (
            <>
              <rect x="4" y="12" width="8" height="10" rx="2" fill={color} opacity="0.5" />
              <rect x="16" y="12" width="8" height="10" rx="2" fill={color} opacity="0.5" />
            </>
          )
        case 'zenith_chassis':
          return <rect x="4" y="6" width="20" height="16" rx="4" fill="none" stroke={color} strokeWidth="2" />
        default:
          return <rect x="6" y="6" width="16" height="16" rx="3" fill={color} opacity="0.5" />
      }
    case 'hands':
      switch (itemId) {
        case 'notepad':
          return <rect x="8" y="6" width="12" height="16" rx="1.5" fill={color} opacity="0.8" />
        case 'digital_stylus':
          return <rect x="12" y="4" width="4" height="20" rx="2" fill={color} opacity="0.9" />
        case 'mech_keys':
          return (
            <>
              <rect x="4" y="10" width="20" height="12" rx="3" fill={color} opacity="0.6" />
              <rect x="6" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" />
              <rect x="12" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" />
              <rect x="18" y="12" width="4" height="3" rx="1" fill="#0b0d13" opacity="0.6" />
            </>
          )
        case 'holo_gloves':
          return <rect x="5" y="5" width="18" height="18" rx="6" fill="none" stroke={color} strokeWidth="2" opacity="0.9" />
        default:
          return <circle cx="14" cy="14" r="7" fill={color} opacity="0.5" />
      }
    case 'accessory':
      switch (itemId) {
        case 'student_id':
          return (
            <>
              <rect x="7" y="6" width="14" height="16" rx="2" fill={color} opacity="0.5" />
              <line x1="9" y1="14" x2="19" y2="14" stroke={color} strokeWidth="1.5" opacity="0.9" />
            </>
          )
        case 'streak_torch':
          return <path d="M14 24 Q9 16 11 10 Q13 6 14 10 Q15 6 17 10 Q19 16 14 24 Z" fill={color} opacity="0.9" />
        case 'honor_pin':
          return <path d="M9 8 L19 8 L22 16 L14 22 L6 16 Z" fill={color} opacity="0.9" />
        case 'creators_emblem':
          return <path d="M14 4 L16 10 L22 12 L16 14 L14 20 L12 14 L6 12 L12 10 Z" fill={color} opacity="0.9" />
        default:
          return <circle cx="14" cy="14" r="6" fill={color} opacity="0.5" />
      }
  }
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export interface AvatarCanvasProps {
  equippedIds:  Record<EquipSlot, string>
  healthPoints: number
  activeSlot?:  EquipSlot | null
  onSlotClick?: (slot: EquipSlot) => void
}

const SLOT_ORDER: EquipSlot[] = ['head', 'torso', 'hands', 'accessory']

const SLOT_DISPLAY: Record<EquipSlot, { label: string; posClass: keyof typeof styles }> = {
  head:      { label: 'HEAD',      posClass: 'slotHead'      },
  hands:     { label: 'HANDS',     posClass: 'slotHands'     },
  accessory: { label: 'BADGE',     posClass: 'slotAccessory' },
  torso:     { label: 'TORSO',     posClass: 'slotTorso'     },
}

export default function AvatarCanvas({
  equippedIds,
  healthPoints,
  activeSlot = null,
  onSlotClick,
}: AvatarCanvasProps) {
  const hp        = healthPoints ?? 100
  const hpClass   = hp > 70 ? styles.hpHigh : hp < 30 ? styles.hpCritical : ''

  return (
    <div className={`${styles.root} ${hpClass}`}>

      {/* ── Slot indicators ─────────────────────────────────── */}
      {SLOT_ORDER.map(slot => {
        const { label, posClass } = SLOT_DISPLAY[slot]
        return (
          <SlotIndicator
            key={slot}
            slot={slot}
            equippedId={equippedIds[slot] ?? DEFAULT_EQUIPPED[slot]}
            label={label}
            posClass={styles[posClass]}
            isActive={activeSlot === slot}
            onClick={() => onSlotClick?.(slot)}
          />
        )
      })}

      {/* ── Avatar SVG ──────────────────────────────────────── */}
      <svg
        viewBox="0 0 220 320"
        className={styles.avatarSvg}
        aria-label="Character avatar"
        role="img"
      >
        <defs>
          {/* Critical HP desaturation filter */}
          <filter id="av-desat" x="-5%" y="-5%" width="110%" height="110%">
            <feColorMatrix
              type="matrix"
              values="0.30 0.30 0.30 0 0
                      0.30 0.30 0.30 0 0
                      0.30 0.30 0.30 0 0
                      0    0    0    1 0"
            />
          </filter>
        </defs>

        {/* Main body group — filter applied here for HP state */}
        <g
          className={styles.avatarGroup}
          filter={hp < 30 ? 'url(#av-desat)' : undefined}
        >

          {/* ── Legs & boots ──────────────────────────────── */}
          <rect x="64"  y="218" width="36" height="72" rx="12" className={styles.bodyBase} />
          <rect x="120" y="218" width="36" height="72" rx="12" className={styles.bodyBase} />
          {/* Boot highlights */}
          <rect x="58"  y="280" width="48" height="28" rx="10" className={styles.bodyEdge} />
          <rect x="114" y="280" width="48" height="28" rx="10" className={styles.bodyEdge} />

          {/* ── Torso ─────────────────────────────────────── */}
          <rect x="52"  y="116" width="116" height="104" rx="14" className={styles.bodyBase} />
          {/* Shoulder caps */}
          <rect x="46"  y="114" width="34" height="20"  rx="8"  className={styles.bodyEdge} />
          <rect x="140" y="114" width="34" height="20"  rx="8"  className={styles.bodyEdge} />
          {/* Chest panel */}
          <rect x="68"  y="130" width="84" height="62"  rx="9"  className={styles.bodyPanel} />
          {/* Core ring outer */}
          <circle cx="110" cy="161" r="16" className={styles.bodyEdge} />
          {/* Core ring inner fill */}
          <circle cx="110" cy="161" r="11" className={styles.bodyEye} opacity="0.18" />
          {/* Core centre glow */}
          <circle cx="110" cy="161" r="6"  className={styles.bodyEye} opacity="0.55" />

          {/* ── Arms ──────────────────────────────────────── */}
          <rect x="30"  y="116" width="22" height="62" rx="10" className={styles.bodyBase} />
          <rect x="168" y="116" width="22" height="62" rx="10" className={styles.bodyBase} />
          {/* Forearms */}
          <rect x="28"  y="176" width="26" height="42" rx="10" className={styles.bodyEdge} />
          <rect x="166" y="176" width="26" height="42" rx="10" className={styles.bodyEdge} />

          {/* ── Neck ──────────────────────────────────────── */}
          <rect x="100" y="102" width="20" height="16" rx="7" className={styles.bodyEdge} />

          {/* ── Head capsule ──────────────────────────────── */}
          <rect x="78"  y="28"  width="64" height="76" rx="32" className={styles.bodyBase} />
          {/* Visor background */}
          <rect x="86"  y="44"  width="48" height="34" rx="12" className={styles.bodyPanel} />
          {/* Left eye */}
          <ellipse cx="99"  cy="61" rx="7" ry="6" className={styles.bodyEye} opacity="0.85" />
          <ellipse cx="99"  cy="61" rx="3" ry="3" className={styles.bodyEyeInner} />
          {/* Right eye */}
          <ellipse cx="121" cy="61" rx="7" ry="6" className={styles.bodyEye} opacity="0.85" />
          <ellipse cx="121" cy="61" rx="3" ry="3" className={styles.bodyEyeInner} />
          {/* Head panel chin-bar */}
          <rect x="86"  y="90"  width="48" height="10" rx="4" className={styles.bodyEdge} />

          {/* ── Equipment overlays ─────────────────────────── */}
          <g aria-hidden="true">
            <HeadOverlay      itemId={equippedIds.head      ?? DEFAULT_EQUIPPED.head}      />
            <TorsoOverlay     itemId={equippedIds.torso     ?? DEFAULT_EQUIPPED.torso}     />
            <HandsOverlay     itemId={equippedIds.hands     ?? DEFAULT_EQUIPPED.hands}     />
            <AccessoryOverlay itemId={equippedIds.accessory ?? DEFAULT_EQUIPPED.accessory} />
          </g>

        </g>
      </svg>
    </div>
  )
}
