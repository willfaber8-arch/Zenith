'use client'
/**
 * components/QuestMarketplace.tsx — Quest Board + Reward Vault UI
 * Phase 5 · Step 5.4
 *
 * Two-pane dashboard:
 *   Left  — Quest Board: Daily Quests + Epic Boss Battles
 *   Right — Reward Vault: Gold balance + redeemable reward grid
 */

import { useQuestBoard, type Quest } from '@/lib/hooks/useQuestBoard'
import {
  useRewardLedger,
  DEFAULT_REWARDS,
  type RewardItem,
} from '@/lib/hooks/useRewardLedger'
import { useToast } from '@/lib/ToastContext'
import styles       from './QuestMarketplace.module.css'

/* ════════════════════════════════════════════════════════════════
   QUEST CARD — Daily Quests
   ════════════════════════════════════════════════════════════════ */

interface QuestCardProps {
  quest:     Quest
  completed: boolean
  loading:   boolean
  onDone:    () => void
}

function QuestCard({ quest, completed, loading, onDone }: QuestCardProps) {
  return (
    <div
      className={`${styles.questCard} ${completed ? styles.questDone : ''}`}
    >
      <button
        className={styles.checkBtn}
        onClick={onDone}
        disabled={completed || loading}
        aria-label={completed ? 'Quest completed' : `Complete: ${quest.title}`}
        aria-pressed={completed}
      >
        {completed ? '✓' : loading ? '…' : '○'}
      </button>

      <div className={styles.questBody}>
        <p className={styles.questTitle}>{quest.title}</p>
        <p className={styles.questDesc}>{quest.description}</p>
        <div className={styles.rewardRow}>
          <span className={styles.rewardXp}>+{quest.xpReward} XP</span>
          <span className={styles.rewardGold}>+{quest.goldReward} ◆</span>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   BOSS CARD — Epic Boss Battles
   ════════════════════════════════════════════════════════════════ */

function BossCard({ quest, completed, loading, onDone }: QuestCardProps) {
  const isCritical = quest.priority === 'critical'

  return (
    <div
      className={`${styles.bossCard} ${completed ? styles.questDone : ''}`}
      data-critical={isCritical ? 'true' : undefined}
    >
      <div className={styles.bossHeader}>
        <span className={styles.bossIcon} aria-hidden="true">
          {completed ? '✓' : '☠'}
        </span>
        <span
          className={`${styles.priorityBadge} ${
            isCritical ? styles.badgeCritical : styles.badgeHigh
          }`}
        >
          {quest.priority?.toUpperCase()}
        </span>
      </div>

      <p className={styles.bossTitle}>{quest.sourceTitle}</p>

      <div className={styles.bossFooter}>
        <div className={styles.rewardRow}>
          <span className={styles.rewardXp}>+{quest.xpReward} XP</span>
          <span className={styles.rewardGold}>+{quest.goldReward} ◆</span>
        </div>
        <button
          className={`${styles.defeatBtn} ${completed ? styles.defeated : ''}`}
          onClick={onDone}
          disabled={completed || loading}
        >
          {completed ? '✓ Defeated' : loading ? 'Defeating…' : '⚔ Defeat Boss'}
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   REWARD CARD — Vault Items
   ════════════════════════════════════════════════════════════════ */

interface RewardCardProps {
  item:      RewardItem
  balance:   number
  purchasing: boolean
  redeemed:  boolean
  onRedeem:  () => void
}

function RewardCard({ item, balance, purchasing, redeemed, onRedeem }: RewardCardProps) {
  const canAfford = balance >= item.cost
  return (
    <div
      className={[
        styles.rewardCard,
        redeemed     ? styles.rewardFlash  : '',
        !canAfford   ? styles.rewardLocked : '',
      ].join(' ')}
    >
      <span className={styles.rewardEmoji} role="img" aria-label={item.title}>
        {item.emoji}
      </span>

      <div className={styles.rewardInfo}>
        <p className={styles.rewardTitle}>{item.title}</p>
        <p className={styles.rewardDesc}>{item.description}</p>
      </div>

      <button
        className={`${styles.redeemBtn} ${!canAfford ? styles.redeemDisabled : ''}`}
        onClick={onRedeem}
        disabled={!canAfford || purchasing}
        aria-label={`Redeem ${item.title} for ${item.cost} Gold`}
      >
        {purchasing ? '…' : redeemed ? '✓ Redeemed' : `${item.cost} ◆`}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function QuestMarketplace() {
  const {
    packet,
    completing,
    completeQuest,
    isComplete,
    completedCount,
    totalCount,
  } = useQuestBoard()

  const {
    goldBalance,
    purchasing,
    recentPurchase,
    purchaseRewardItem,
  } = useRewardLedger()

  const { toast } = useToast()

  async function handleCompleteQuest(quest: Quest) {
    await completeQuest(quest)
    toast(
      `Quest complete! +${quest.xpReward} XP · +${quest.goldReward} Gold earned.`,
      'success',
    )
  }

  async function handlePurchase(item: RewardItem) {
    const result = await purchaseRewardItem(item)
    if (result.success) {
      toast(`"${item.title}" redeemed! Enjoy your reward.`, 'success')
    } else {
      toast('Not enough Gold to redeem this reward.', 'error')
    }
  }

  return (
    <div className={styles.marketplace}>

      {/* ── Gold balance banner ─────────────────────────────── */}
      <div className={styles.balanceBanner}>
        <div className={styles.balanceLeft}>
          <span className={styles.balanceEyebrow}>Zenith Gold</span>
          <span className={styles.balanceValue}>
            {goldBalance.toLocaleString('en-US')}
            <span className={styles.goldGem} aria-hidden="true">◆</span>
          </span>
        </div>
        {totalCount > 0 && (
          <span className={styles.progressChip}>
            {completedCount} / {totalCount} objectives complete
          </span>
        )}
      </div>

      {/* ── Two-pane layout ─────────────────────────────────── */}
      <div className={styles.layout}>

        {/* LEFT: Quest Board */}
        <section className={styles.questBoard} aria-label="Quest Board">

          <header className={styles.panelHead}>
            <p className={styles.panelEyebrow}>Daily Objectives</p>
            <h2 className={styles.panelTitle}>Quest Board</h2>
          </header>

          {/* Daily Quests */}
          <div className={styles.questSection}>
            <p className={styles.sectionLabel}>
              <span className={styles.sectionDot} aria-hidden="true" />
              Daily Quests
            </p>

            {!packet || packet.quests.length === 0 ? (
              <p className={styles.emptyNote}>
                Add habits or assignments to generate your daily quests.
              </p>
            ) : (
              <div className={styles.questList}>
                {packet.quests.map(q => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    completed={isComplete(q.id)}
                    loading={completing.has(q.id)}
                    onDone={() => handleCompleteQuest(q)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Boss Battles */}
          <div className={styles.questSection}>
            <p className={`${styles.sectionLabel} ${styles.sectionBoss}`}>
              <span
                className={`${styles.sectionDot} ${styles.sectionDotBoss}`}
                aria-hidden="true"
              />
              Epic Boss Battles
            </p>

            {!packet || packet.bossBattles.length === 0 ? (
              <p className={styles.emptyNote}>
                No active bosses — high-priority assignments will appear here.
              </p>
            ) : (
              <div className={styles.questList}>
                {packet.bossBattles.map(q => (
                  <BossCard
                    key={q.id}
                    quest={q}
                    completed={isComplete(q.id)}
                    loading={completing.has(q.id)}
                    onDone={() => handleCompleteQuest(q)}
                  />
                ))}
              </div>
            )}
          </div>

        </section>

        {/* RIGHT: Reward Vault */}
        <section className={styles.rewardVault} aria-label="Reward Vault">

          <header className={styles.panelHead}>
            <p className={styles.panelEyebrow}>Reward Economy</p>
            <h2 className={styles.panelTitle}>Reward Vault</h2>
          </header>

          <div className={styles.goldMeter}>
            <span className={styles.goldGemLarge} aria-hidden="true">◆</span>
            <div>
              <p className={styles.goldLabel}>Available Balance</p>
              <p className={styles.goldValue}>
                {goldBalance.toLocaleString('en-US')} Gold
              </p>
            </div>
          </div>

          <div className={styles.rewardGrid}>
            {DEFAULT_REWARDS.map(item => (
              <RewardCard
                key={item.id}
                item={item}
                balance={goldBalance}
                purchasing={purchasing.has(item.id)}
                redeemed={recentPurchase === item.id}
                onRedeem={() => handlePurchase(item)}
              />
            ))}
          </div>

        </section>

      </div>
    </div>
  )
}
