/**
 * config/avatarItems.ts — Avatar Item Registry
 * Phase 5 · Step 5.2
 *
 * 16 items across 4 slots (4 per slot), with progressive level
 * requirements tied to Zenith OS academic/lifestyle themes.
 * Items with `streakRequired` can be unlocked via habit discipline
 * as an alternative path to the level gate.
 */

import type { AvatarItem, EquipSlot } from '@/types/avatar'

export const AVATAR_ITEMS: AvatarItem[] = [

  /* ── HEAD · Focus Items ───────────────────────────────────── */
  {
    id:            'focus_band',
    name:          'Focus Band',
    description:   'A minimal silicone band worn during deep work blocks.',
    slot:          'head',
    levelRequired: 1,
    unlockHint:    'Available from the start.',
    accentColor:   '#7c95ff',
  },
  {
    id:            'scholar_crown',
    name:          "Scholar's Crown",
    description:   'A geometric laurel circlet earned through academic dedication.',
    slot:          'head',
    levelRequired: 5,
    unlockHint:    'Reach Level 5.',
    accentColor:   '#fbbf24',
  },
  {
    id:            'arcane_hood',
    name:          'Arcane Hood',
    description:   'The hooded mark of those who have mastered deep focus cycles.',
    slot:          'head',
    levelRequired: 10,
    unlockHint:    'Reach Level 10.',
    accentColor:   '#a78bfa',
  },
  {
    id:            'neural_visor',
    name:          'Neural Visor',
    description:   'High-contrast optics tuned for marathon study sessions.',
    slot:          'head',
    levelRequired: 15,
    unlockHint:    'Reach Level 15.',
    accentColor:   '#52cca3',
  },

  /* ── TORSO · Scholastic Cloak ─────────────────────────────── */
  {
    id:            'student_kit',
    name:          'Student Attire',
    description:   'Standard-issue academic wear for enrolled scholars.',
    slot:          'torso',
    levelRequired: 1,
    unlockHint:    'Available from the start.',
    accentColor:   '#9ba3c4',
  },
  {
    id:            'scholastic_cloak',
    name:          'Scholastic Cloak',
    description:   'A flowing cloak signalling commitment to the pursuit of knowledge.',
    slot:          'torso',
    levelRequired: 3,
    unlockHint:    'Reach Level 3.',
    accentColor:   '#818cf8',
  },
  {
    id:            'research_vest',
    name:          'Research Vest',
    description:   'A utility vest worn in the field by those conducting rigorous study.',
    slot:          'torso',
    levelRequired: 7,
    unlockHint:    'Reach Level 7.',
    accentColor:   '#52cca3',
  },
  {
    id:            'zenith_chassis',
    name:          'Zenith Chassis',
    description:   'The pinnacle armoring — reserved for master scholars.',
    slot:          'torso',
    levelRequired: 12,
    unlockHint:    'Reach Level 12.',
    accentColor:   '#c084fc',
  },

  /* ── HANDS · Tech Tool ────────────────────────────────────── */
  {
    id:            'notepad',
    name:          'Scholar Notepad',
    description:   'A paper notepad — the original knowledge capture device.',
    slot:          'hands',
    levelRequired: 1,
    unlockHint:    'Available from the start.',
    accentColor:   '#e8eaf6',
  },
  {
    id:            'digital_stylus',
    name:          'Digital Stylus',
    description:   'For annotating PDFs and lecture slides with precision.',
    slot:          'hands',
    levelRequired: 2,
    unlockHint:    'Reach Level 2.',
    accentColor:   '#7c95ff',
  },
  {
    id:            'mech_keys',
    name:          'Mechanical Keys',
    description:   'High-performance input hardware for prolific builders.',
    slot:          'hands',
    levelRequired: 5,
    unlockHint:    'Reach Level 5.',
    accentColor:   '#52cca3',
  },
  {
    id:            'holo_gloves',
    name:          'Holo Gloves',
    description:   'Haptic-interface gloves for the highest-level practitioners.',
    slot:          'hands',
    levelRequired: 10,
    unlockHint:    'Reach Level 10.',
    accentColor:   '#38bdf8',
  },

  /* ── ACCESSORY · Creator's Badge ─────────────────────────── */
  {
    id:            'student_id',
    name:          'Student ID',
    description:   'Standard identification for registered members of the academy.',
    slot:          'accessory',
    levelRequired: 1,
    unlockHint:    'Available from the start.',
    accentColor:   '#9ba3c4',
  },
  {
    id:            'streak_torch',
    name:          'Streak Torch',
    description:   'Awarded for sustaining an unbroken 7-day habit streak.',
    slot:          'accessory',
    levelRequired: 3,
    streakRequired: 7,
    unlockHint:    'Reach Level 3 or maintain a 7-day habit streak.',
    accentColor:   '#fb923c',
  },
  {
    id:            'honor_pin',
    name:          'Honor Pin',
    description:   'Recognises sustained excellence across academic commitments.',
    slot:          'accessory',
    levelRequired: 5,
    unlockHint:    'Reach Level 5.',
    accentColor:   '#fbbf24',
  },
  {
    id:            'creators_emblem',
    name:          "Creator's Emblem",
    description:   'The mark of a creator who has mastered multiple disciplines.',
    slot:          'accessory',
    levelRequired: 8,
    unlockHint:    'Reach Level 8.',
    accentColor:   '#52cca3',
  },
]

/** Default item equipped in each slot for a new character. */
export const DEFAULT_EQUIPPED: Record<EquipSlot, string> = {
  head:      'focus_band',
  torso:     'student_kit',
  hands:     'notepad',
  accessory: 'student_id',
}

/** Display labels for each slot used in the customizer tabs. */
export const SLOT_LABELS: Record<EquipSlot, string> = {
  head:      'Focus Item',
  torso:     'Scholastic Cloak',
  hands:     'Tech Tool',
  accessory: "Creator's Badge",
}

export const SLOT_TAB_LABELS: Record<EquipSlot, string> = {
  head:      'Head',
  torso:     'Torso',
  hands:     'Hands',
  accessory: 'Badge',
}

export function getItemsForSlot(slot: EquipSlot): AvatarItem[] {
  return AVATAR_ITEMS.filter(item => item.slot === slot)
}

export function getItemById(id: string): AvatarItem | undefined {
  return AVATAR_ITEMS.find(item => item.id === id)
}
