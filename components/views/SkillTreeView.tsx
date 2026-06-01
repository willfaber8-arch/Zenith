/**
 * components/views/SkillTreeView.tsx — Skill Tree Page Orchestrator
 * Phase 7 · Step 7.2 — Branching Skill Trees & Focus Perks
 *
 * Composes:
 *   ZenHeading  — page title + eyebrow
 *   Token bar   — available tokens + retroactive initialisation hint
 *   Modifier row — live summary of all active perk bonuses
 *   SkillTreeCanvas — interactive constellation node viewport
 */

'use client'

import { useCallback } from 'react'
import ZenHeading     from '@/components/ui/ZenHeading'
import SkillTreeCanvas from '@/components/SkillTreeCanvas'
import { useSkillTree } from '@/hooks/useSkillTree'
import { useToast }     from '@/lib/ToastContext'
import styles from './SkillTreeView.module.css'

/* ── Active modifier summary chip factory ───────────────────── */

interface ModifierChip { label: string; cls: string }

function buildModifierChips(
  goldMult: number,
  pomMins:  number,
  xpBonus:  number,
  fatigueM: number,
  hpMult:   number,
  recovHP:  number,
  streakM:  number,
  grace:    number,
): ModifierChip[] {
  const chips: ModifierChip[] = []

  if (goldMult > 1.0)
    chips.push({ label: `+${Math.round((goldMult - 1) * 100)}% Task Gold`, cls: styles.modifierChipSchol })
  if (pomMins > 0)
    chips.push({ label: `+${pomMins}min Pomodoro`, cls: styles.modifierChipSchol })
  if (xpBonus > 0)
    chips.push({ label: `+${xpBonus} Task XP`, cls: styles.modifierChipSchol })
  if (fatigueM < 1.0)
    chips.push({ label: `−${Math.round((1 - fatigueM) * 100)}% Fatigue`, cls: styles.modifierChipErgo })
  if (hpMult < 1.0)
    chips.push({ label: `−${Math.round((1 - hpMult) * 100)}% Deadline HP`, cls: styles.modifierChipErgo })
  if (recovHP > 0)
    chips.push({ label: `+${recovHP} Recovery HP`, cls: styles.modifierChipErgo })
  if (streakM > 1.0)
    chips.push({ label: `+${Math.round((streakM - 1) * 100)}% Streak XP`, cls: styles.modifierChipHabit })
  if (grace > 0)
    chips.push({ label: `${grace} Grace Day${grace > 1 ? 's' : ''}`, cls: styles.modifierChipHabit })

  return chips
}

/* ════════════════════════════════════════════════════════════
   MAIN VIEW
   ════════════════════════════════════════════════════════════ */

export default function SkillTreeView() {
  const {
    nodes,
    modifiers,
    unlockedIds,
    availableTokens,
    totalSpent,
    isLoading,
    purchaseSkillNode,
  } = useSkillTree()

  const { toast } = useToast()

  /* ── Purchase handler with toast feedback ─────────────────── */
  const handlePurchase = useCallback(
    async (nodeId: string) => {
      const result = await purchaseSkillNode(nodeId)

      if (result.success) {
        const node = nodes.find(n => n.id === nodeId)
        toast(`${node?.name ?? 'Node'} unlocked! ${node?.modifierLabel ?? ''}`, 'success')
      } else {
        const msgMap = {
          insufficient_tokens:  'Not enough skill tokens.',
          already_unlocked:     'This node is already unlocked.',
          prerequisite_not_met: 'Unlock the prerequisite node first.',
          node_not_found:       'Unknown node.',
          profile_not_found:    'Profile not found — try refreshing.',
          db_error:             'Database error. Please try again.',
        }
        toast(msgMap[result.reason ?? 'db_error'] ?? 'Purchase failed.', 'error')
      }

      return result
    },
    [nodes, purchaseSkillNode, toast],
  )

  /* ── Modifier chips ─────────────────────────────────────────── */
  const chips = buildModifierChips(
    modifiers.assignmentGoldMultiplier,
    modifiers.pomodoroMinuteBonus,
    modifiers.assignmentXpBonus,
    modifiers.fatigueRateMultiplier,
    modifiers.deadlineHpMultiplier,
    modifiers.recoveryHpBonus,
    modifiers.streakXpMultiplier,
    modifiers.streakGraceDays,
  )

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div className={styles.page}>

      <ZenHeading
        eyebrow="Character · Phase 7.2"
        title="Skill Tree."
        subtitle="Spend milestone tokens to unlock performance perks across your three core disciplines."
        size="md"
      />

      {/* ── Token status bar ─────────────────────────────────── */}
      <div className={styles.tokenBar}>
        <div className={styles.tokenLeft}>
          <span className={styles.tokenGlyph} aria-hidden="true">✦</span>
          <div className={styles.tokenCount}>
            <span
              className={styles.tokenValue}
              aria-label={`${availableTokens} skill tokens available`}
            >
              {isLoading ? '—' : availableTokens}
            </span>
            <span className={styles.tokenLabel}>Tokens Available</span>
          </div>
        </div>

        <p className={styles.tokenHint}>
          {totalSpent > 0
            ? <>
                <strong>{totalSpent} token{totalSpent !== 1 ? 's' : ''} invested</strong>
                {' · '}
                {unlockedIds.length} node{unlockedIds.length !== 1 ? 's' : ''} unlocked.
              </>
            : <>
                Earn tokens by <strong>levelling up</strong> or completing
                {' '}<strong>legendary tasks</strong>.
              </>
          }
        </p>
      </div>

      {/* ── Active modifiers row ──────────────────────────────── */}
      {chips.length > 0 && (
        <div className={styles.modifierRow} aria-label="Active skill modifiers">
          <span className={styles.modifierLabel}>Active perks →</span>
          {chips.map((c, i) => (
            <span key={i} className={`${styles.modifierChip} ${c.cls}`}>
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Constellation canvas ───────────────────────────────── */}
      <div className={styles.canvasCard}>
        {isLoading ? (
          <div className={styles.loading}>
            <span className={styles.loadingDot} aria-hidden="true" />
            Synchronising skill tree…
          </div>
        ) : (
          <SkillTreeCanvas
            unlockedIds={unlockedIds}
            availableTokens={availableTokens}
            onPurchase={handlePurchase}
          />
        )}
      </div>

    </div>
  )
}
