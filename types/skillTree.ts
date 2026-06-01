/**
 * types/skillTree.ts — Skill Tree Type Matrix, Node Data & Modifier Engine
 * Phase 7 · Step 7.2 — Branching Skill Trees & Focus Perks
 *
 * Three specialisation branches:
 *   SCHOLASTIC_FOCUS     — assignment gold yields + Pomodoro duration bonuses
 *   ERGONOMIC_RESILIENCE — fatigue rate reduction + deadline HP protection
 *   HABIT_MASTERY        — streak XP multipliers + grace day buffers
 *
 * Canvas coordinate system: 960 × 560 logical pixels.
 *   Branch lanes:  SCHOLASTIC x≈160  |  ERGONOMIC x≈480  |  HABIT x≈800
 *   Tiers (y):     root=80 · tier1=210 · tier2=340 · apex=470
 */

/* ══════════════════════════════════════════════════════════════
   1.  CORE TYPES
   ══════════════════════════════════════════════════════════════ */

export type SkillBranch =
  | 'SCHOLASTIC_FOCUS'
  | 'ERGONOMIC_RESILIENCE'
  | 'HABIT_MASTERY'

/**
 * Static node definition — lives in SKILL_TREE_DATA, never mutates.
 * This is the canonical spec as required by the feature brief.
 */
export type SkillNode = {
  id:                 string
  branch:             SkillBranch
  tier:               0 | 1 | 2 | 3
  name:               string
  description:        string
  glyph:              string          // unicode symbol rendered inside the node circle
  cost:               number          // skill tokens required (root nodes cost 1)
  isUnlocked:         boolean         // runtime: computed from userProfile.unlockedSkillNodeIds
  prerequisiteNodeId: string | null   // null = no prerequisite (root nodes)
  modifierId:         string          // maps to a field in SkillModifiers
  modifierValue:      number          // magnitude of the effect
  modifierLabel:      string          // human label, e.g. "+15% Assignment Gold"
  position:           { x: number; y: number }  // SVG/CSS canvas coordinates
}

/**
 * Runtime-enriched node — extends the static definition with computed
 * UI state fields. Returned by computeNodeStates().
 */
export interface SkillNodeRuntime extends SkillNode {
  isAvailable:   boolean  // prereq met + enough tokens to purchase
  isAffordable:  boolean  // prereq met but may lack tokens
}

/** Visual state bucket used to drive CSS class selection */
export type NodeState = 'locked' | 'affordable' | 'available' | 'unlocked'

/** SVG wire connection between two nodes */
export interface SkillTreeConnection {
  from:       string   // nodeId
  to:         string   // nodeId
  isPrimary:  boolean  // true = used for purchase validation; false = visual-only
}

/* ══════════════════════════════════════════════════════════════
   2.  MODIFIER SHAPE
   ══════════════════════════════════════════════════════════════ */

/**
 * Aggregated performance modifier values computed from all unlocked nodes.
 * Consumed globally via SkillModifierContext.
 *
 * Multiplier convention: 1.0 = no effect.  0.80 = −20%.  1.15 = +15%.
 * Bonus convention:      0 = no effect.   5 = +5 units.
 */
export interface SkillModifiers {
  /* SCHOLASTIC_FOCUS */
  assignmentGoldMultiplier: number   // e.g. 1.15 → completed tasks yield +15% gold
  pomodoroMinuteBonus:      number   // extra minutes added to each WORK block
  assignmentXpBonus:        number   // flat XP added to assignment completion events

  /* ERGONOMIC_RESILIENCE */
  fatigueRateMultiplier:    number   // multiplied against continuous-work minute accumulation
  deadlineHpMultiplier:     number   // multiplied against HP loss on overdue assignment penalties
  recoveryHpBonus:          number   // extra HP restored by each RecoveryCockpit session

  /* HABIT_MASTERY */
  streakXpMultiplier:       number   // multiplied against streak-based XP awards
  streakGraceDays:          number   // additional days before a habit streak resets
}

/* ══════════════════════════════════════════════════════════════
   3.  DEFAULT MODIFIERS  (all neutral — no active bonuses)
   ══════════════════════════════════════════════════════════════ */

export const DEFAULT_MODIFIERS: SkillModifiers = {
  assignmentGoldMultiplier: 1.0,
  pomodoroMinuteBonus:      0,
  assignmentXpBonus:        0,
  fatigueRateMultiplier:    1.0,
  deadlineHpMultiplier:     1.0,
  recoveryHpBonus:          0,
  streakXpMultiplier:       1.0,
  streakGraceDays:          0,
}

/* ══════════════════════════════════════════════════════════════
   4.  SKILL TREE NODE DATA  (18 nodes across 3 branches)
   ══════════════════════════════════════════════════════════════ */

/**
 * Node definitions: static, immutable, exported as the single source of truth.
 * isUnlocked is always false here — runtime state is injected by computeNodeStates().
 */
export const SKILL_TREE_DATA: SkillNode[] = [

  /* ── SCHOLASTIC FOCUS ──────────────────────────────────────── */
  {
    id: 'sf-root', branch: 'SCHOLASTIC_FOCUS', tier: 0,
    name: "Scholar's Foundation",
    description: 'Establish your academic framework. Unlocks the Scholastic Focus path and grants a baseline gold yield bonus on all tasks.',
    glyph: '◈', cost: 1, isUnlocked: false,
    prerequisiteNodeId: null,
    modifierId: 'sf_foundation', modifierValue: 0.05,
    modifierLabel: '+5% Assignment Gold',
    position: { x: 160, y: 80 },
  },
  {
    id: 'sf-gold1', branch: 'SCHOLASTIC_FOCUS', tier: 1,
    name: 'Task Accelerator',
    description: 'Completed assignments yield 15% more Zenith Gold. High and critical priority tasks benefit most.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'sf-root',
    modifierId: 'sf_gold_1', modifierValue: 0.15,
    modifierLabel: '+15% Assignment Gold',
    position: { x: 80, y: 210 },
  },
  {
    id: 'sf-timer1', branch: 'SCHOLASTIC_FOCUS', tier: 1,
    name: 'Deep Focus',
    description: 'Each Pomodoro WORK block is extended by 5 minutes, allowing longer uninterrupted study sessions.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'sf-root',
    modifierId: 'sf_timer_1', modifierValue: 5,
    modifierLabel: '+5 min Pomodoro',
    position: { x: 240, y: 210 },
  },
  {
    id: 'sf-gold2', branch: 'SCHOLASTIC_FOCUS', tier: 2,
    name: "Scholar's Vanguard",
    description: 'Every completed assignment awards an additional +5 XP bonus on top of the base RPG engine reward.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'sf-gold1',
    modifierId: 'sf_xp_2', modifierValue: 5,
    modifierLabel: '+5 XP per Assignment',
    position: { x: 80, y: 340 },
  },
  {
    id: 'sf-timer2', branch: 'SCHOLASTIC_FOCUS', tier: 2,
    name: 'Iron Focus',
    description: 'An additional 10 minutes are added to each Pomodoro WORK block. Stacks with Deep Focus for a total of +15 min.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'sf-timer1',
    modifierId: 'sf_timer_2', modifierValue: 10,
    modifierLabel: '+10 min Pomodoro',
    position: { x: 240, y: 340 },
  },
  {
    id: 'sf-apex', branch: 'SCHOLASTIC_FOCUS', tier: 3,
    name: 'Arc of Mastery',
    description: 'Peak academic velocity. Assignment gold yield increases by an additional 25%. Represents the pinnacle of scholastic optimisation.',
    glyph: '✦', cost: 3, isUnlocked: false,
    prerequisiteNodeId: 'sf-gold2',
    modifierId: 'sf_apex', modifierValue: 0.25,
    modifierLabel: '+25% Assignment Gold',
    position: { x: 160, y: 470 },
  },

  /* ── ERGONOMIC RESILIENCE ───────────────────────────────────── */
  {
    id: 'er-root', branch: 'ERGONOMIC_RESILIENCE', tier: 0,
    name: 'Ironclad Core',
    description: 'Build a foundation of mental and physical resilience. Unlocks the Ergonomic Resilience path and provides initial fatigue resistance.',
    glyph: '◈', cost: 1, isUnlocked: false,
    prerequisiteNodeId: null,
    modifierId: 'er_foundation', modifierValue: 0.05,
    modifierLabel: '−5% Fatigue Rate',
    position: { x: 480, y: 80 },
  },
  {
    id: 'er-fatigue1', branch: 'ERGONOMIC_RESILIENCE', tier: 1,
    name: 'Fatigue Buffer',
    description: 'Reduces continuous work fatigue accumulation by 20%. Your sessions before the fatigue overlay triggers become noticeably longer.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'er-root',
    modifierId: 'er_fatigue_1', modifierValue: 0.20,
    modifierLabel: '−20% Fatigue Rate',
    position: { x: 400, y: 210 },
  },
  {
    id: 'er-shield1', branch: 'ERGONOMIC_RESILIENCE', tier: 1,
    name: 'Deadline Shield',
    description: 'Reduces HP damage from overdue assignment penalties by 25%. Overdue tasks hurt less — but completing them still matters.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'er-root',
    modifierId: 'er_shield_1', modifierValue: 0.25,
    modifierLabel: '−25% Deadline HP Loss',
    position: { x: 560, y: 210 },
  },
  {
    id: 'er-fatigue2', branch: 'ERGONOMIC_RESILIENCE', tier: 2,
    name: 'Endurance Protocol',
    description: 'Total fatigue buildup rate slashed by a further 35%. Combined with Fatigue Buffer your effective resistance reaches −55%.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'er-fatigue1',
    modifierId: 'er_fatigue_2', modifierValue: 0.35,
    modifierLabel: '−35% Fatigue Rate',
    position: { x: 400, y: 340 },
  },
  {
    id: 'er-shield2', branch: 'ERGONOMIC_RESILIENCE', tier: 2,
    name: 'Resilient Constitution',
    description: 'Recovery Cockpit sessions restore 15 additional HP. Pairs powerfully with the base recovery reward for faster health regeneration.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'er-shield1',
    modifierId: 'er_recovery_2', modifierValue: 15,
    modifierLabel: '+15 HP from Recovery',
    position: { x: 560, y: 340 },
  },
  {
    id: 'er-apex', branch: 'ERGONOMIC_RESILIENCE', tier: 3,
    name: 'Fortress Mind',
    description: 'Maximum resilience. Combined with prior fatigue nodes, achieves near-total fatigue immunity. HP loss from deadlines is capped at 3.',
    glyph: '✦', cost: 3, isUnlocked: false,
    prerequisiteNodeId: 'er-fatigue2',
    modifierId: 'er_apex', modifierValue: 0.55,
    modifierLabel: '−55% Fatigue (apex)',
    position: { x: 480, y: 470 },
  },

  /* ── HABIT MASTERY ──────────────────────────────────────────── */
  {
    id: 'hm-root', branch: 'HABIT_MASTERY', tier: 0,
    name: 'Steady Path',
    description: 'Lay the groundwork for unbreakable behavioural patterns. Unlocks Habit Mastery and improves streak XP from the first day.',
    glyph: '◈', cost: 1, isUnlocked: false,
    prerequisiteNodeId: null,
    modifierId: 'hm_foundation', modifierValue: 0.05,
    modifierLabel: '+5% Streak Multiplier',
    position: { x: 800, y: 80 },
  },
  {
    id: 'hm-streak1', branch: 'HABIT_MASTERY', tier: 1,
    name: 'Streak Catalyst',
    description: 'Habit streak XP multiplier permanently increased by 10%. The longer your streaks, the greater the compounding benefit.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'hm-root',
    modifierId: 'hm_streak_1', modifierValue: 0.10,
    modifierLabel: '+10% Streak Multiplier',
    position: { x: 720, y: 210 },
  },
  {
    id: 'hm-rhythm1', branch: 'HABIT_MASTERY', tier: 1,
    name: 'Rhythm Lock',
    description: 'Adds 1 grace day per week before a habit streak is broken. Occasional travel or illness no longer resets your progress.',
    glyph: '◆', cost: 1, isUnlocked: false,
    prerequisiteNodeId: 'hm-root',
    modifierId: 'hm_grace_1', modifierValue: 1,
    modifierLabel: '+1 Streak Grace Day',
    position: { x: 880, y: 210 },
  },
  {
    id: 'hm-streak2', branch: 'HABIT_MASTERY', tier: 2,
    name: 'Compound Momentum',
    description: 'Streak XP multiplier grows 20% faster as streaks extend. Long streaks produce dramatically accelerating returns.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'hm-streak1',
    modifierId: 'hm_streak_2', modifierValue: 0.20,
    modifierLabel: '+20% Streak Growth',
    position: { x: 720, y: 340 },
  },
  {
    id: 'hm-rhythm2', branch: 'HABIT_MASTERY', tier: 2,
    name: 'Unbroken Chain',
    description: 'Extends streak grace to 2 days per week. Streak milestone events also trigger a Zenith Gold bonus payout.',
    glyph: '★', cost: 2, isUnlocked: false,
    prerequisiteNodeId: 'hm-rhythm1',
    modifierId: 'hm_grace_2', modifierValue: 1,
    modifierLabel: '+1 More Grace Day',
    position: { x: 880, y: 340 },
  },
  {
    id: 'hm-apex', branch: 'HABIT_MASTERY', tier: 3,
    name: 'Ascendant Habit',
    description: 'Ultimate streak mastery. Adds a final +30% streak XP multiplier. Total multiplier boost across the entire branch reaches +65%.',
    glyph: '✦', cost: 3, isUnlocked: false,
    prerequisiteNodeId: 'hm-streak2',
    modifierId: 'hm_apex', modifierValue: 0.30,
    modifierLabel: '+30% Streak Multiplier',
    position: { x: 800, y: 470 },
  },
]

/** O(1) lookup map — keyed by node ID */
export const SKILL_TREE_MAP = new Map<string, SkillNode>(
  SKILL_TREE_DATA.map(n => [n.id, n]),
)

/* ══════════════════════════════════════════════════════════════
   5.  VISUAL CONNECTIONS  (SVG wires)
   ══════════════════════════════════════════════════════════════ */

/**
 * All connections rendered as SVG paths.
 * isPrimary = true means this edge is the canonical purchase prerequisite.
 * isPrimary = false means the wire is drawn for visual completeness only
 * (e.g. a second tier-2 node also converging on the apex).
 */
export const SKILL_TREE_CONNECTIONS: SkillTreeConnection[] = [
  /* SCHOLASTIC FOCUS */
  { from: 'sf-root',  to: 'sf-gold1',  isPrimary: true  },
  { from: 'sf-root',  to: 'sf-timer1', isPrimary: true  },
  { from: 'sf-gold1', to: 'sf-gold2',  isPrimary: true  },
  { from: 'sf-timer1',to: 'sf-timer2', isPrimary: true  },
  { from: 'sf-gold2', to: 'sf-apex',   isPrimary: true  },
  { from: 'sf-timer2',to: 'sf-apex',   isPrimary: false },
  /* ERGONOMIC RESILIENCE */
  { from: 'er-root',    to: 'er-fatigue1', isPrimary: true  },
  { from: 'er-root',    to: 'er-shield1',  isPrimary: true  },
  { from: 'er-fatigue1',to: 'er-fatigue2', isPrimary: true  },
  { from: 'er-shield1', to: 'er-shield2',  isPrimary: true  },
  { from: 'er-fatigue2',to: 'er-apex',     isPrimary: true  },
  { from: 'er-shield2', to: 'er-apex',     isPrimary: false },
  /* HABIT MASTERY */
  { from: 'hm-root',    to: 'hm-streak1', isPrimary: true  },
  { from: 'hm-root',    to: 'hm-rhythm1', isPrimary: true  },
  { from: 'hm-streak1', to: 'hm-streak2', isPrimary: true  },
  { from: 'hm-rhythm1', to: 'hm-rhythm2', isPrimary: true  },
  { from: 'hm-streak2', to: 'hm-apex',    isPrimary: true  },
  { from: 'hm-rhythm2', to: 'hm-apex',    isPrimary: false },
]

/* ══════════════════════════════════════════════════════════════
   6.  RUNTIME COMPUTATION HELPERS
   ══════════════════════════════════════════════════════════════ */

/**
 * Injects runtime state (isUnlocked, isAvailable, isAffordable) into every
 * static node definition.  Called inside useSkillTree on each render.
 */
export function computeNodeStates(
  unlockedIds: string[],
  availableTokens: number,
): SkillNodeRuntime[] {
  const unlockedSet = new Set(unlockedIds)

  return SKILL_TREE_DATA.map(def => {
    const isUnlocked  = unlockedSet.has(def.id)
    const prereqMet   = def.prerequisiteNodeId === null
      || unlockedSet.has(def.prerequisiteNodeId)
    const isAffordable = !isUnlocked && prereqMet
    const isAvailable  = isAffordable && availableTokens >= def.cost

    return { ...def, isUnlocked, isAvailable, isAffordable }
  })
}

/**
 * Maps a SkillNodeRuntime to its 4-state visual bucket.
 */
export function resolveNodeState(node: SkillNodeRuntime): NodeState {
  if (node.isUnlocked)   return 'unlocked'
  if (node.isAvailable)  return 'available'
  if (node.isAffordable) return 'affordable'
  return 'locked'
}

/**
 * Aggregates all unlocked node modifiers into a single SkillModifiers object.
 * Returns DEFAULT_MODIFIERS when the unlockedIds array is empty.
 */
export function computeModifiers(unlockedIds: string[]): SkillModifiers {
  const m = { ...DEFAULT_MODIFIERS }

  for (const id of unlockedIds) {
    const node = SKILL_TREE_MAP.get(id)
    if (!node) continue

    switch (node.modifierId) {
      /* SCHOLASTIC_FOCUS */
      case 'sf_foundation': m.assignmentGoldMultiplier += 0.05; break
      case 'sf_gold_1':     m.assignmentGoldMultiplier += 0.15; break
      case 'sf_timer_1':    m.pomodoroMinuteBonus      += 5;    break
      case 'sf_xp_2':       m.assignmentXpBonus        += 5;    break
      case 'sf_timer_2':    m.pomodoroMinuteBonus      += 10;   break
      case 'sf_apex':       m.assignmentGoldMultiplier += 0.25; break
      /* ERGONOMIC_RESILIENCE */
      case 'er_foundation': m.fatigueRateMultiplier    -= 0.05; break
      case 'er_fatigue_1':  m.fatigueRateMultiplier    -= 0.20; break
      case 'er_shield_1':   m.deadlineHpMultiplier     -= 0.25; break
      case 'er_fatigue_2':  m.fatigueRateMultiplier    -= 0.35; break
      case 'er_recovery_2': m.recoveryHpBonus          += 15;   break
      case 'er_apex':       m.fatigueRateMultiplier    -= 0.55; break
      /* HABIT_MASTERY */
      case 'hm_foundation': m.streakXpMultiplier       += 0.05; break
      case 'hm_streak_1':   m.streakXpMultiplier       += 0.10; break
      case 'hm_grace_1':    m.streakGraceDays          += 1;    break
      case 'hm_streak_2':   m.streakXpMultiplier       += 0.20; break
      case 'hm_grace_2':    m.streakGraceDays          += 1;    break
      case 'hm_apex':       m.streakXpMultiplier       += 0.30; break
    }
  }

  /* Hard clamps — prevent modifiers from crossing zero or 100% */
  m.fatigueRateMultiplier = Math.max(0.10, Math.round(m.fatigueRateMultiplier * 100) / 100)
  m.deadlineHpMultiplier  = Math.max(0.10, Math.round(m.deadlineHpMultiplier  * 100) / 100)

  return m
}

/* ══════════════════════════════════════════════════════════════
   7.  CANVAS LAYOUT CONSTANTS  (shared between SVG + nodes)
   ══════════════════════════════════════════════════════════════ */

export const CANVAS_W      = 960
export const CANVAS_H      = 560
export const NODE_RADIUS   = 36   // px — half of the 72px node diameter
export const NODE_DIAMETER = NODE_RADIUS * 2
