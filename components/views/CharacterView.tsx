'use client'
/**
 * CharacterView — Phase 5 · Step 5.2
 * ────────────────────────────────────────────────────────────────
 * Top-level orchestrator for the interactive character canvas.
 *
 * Layout:
 *   Left column  — AvatarCanvas (SVG figure + equipment slot indicators)
 *                  mini EXP / HP bars
 *   Right column — AvatarCustomizer (tabbed item selection panel)
 *
 * Shared state: `activeSlot` bridges the two panels so clicking a
 * slot indicator on the canvas auto-switches the customizer tab.
 *
 * Live data: profile is streamed from IDB via useLiveQuery so equip
 * actions (writing through equipProfileItem) reflect instantly with
 * no manual refresh.
 */

import { useState, useMemo }    from 'react'
import { useLiveQuery }         from 'dexie-react-hooks'
import { db }                   from '@/lib/db'
import { resolveEquipped }      from '@/utils/equipHandler'
import { expRequired, HP_MAX }  from '@/utils/rpgEngine'
import AvatarCanvas             from '@/components/AvatarCanvas'
import AvatarCustomizer         from '@/components/AvatarCustomizer'
import ZenHeading               from '@/components/ui/ZenHeading'
import type { EquipSlot }       from '@/types/avatar'
import styles from './CharacterView.module.css'

export default function CharacterView() {
  const [activeSlot, setActiveSlot] = useState<EquipSlot>('head')

  /* ── Live profile + habit data ─────────────────────────── */
  const profile = useLiveQuery(
    () => db?.userProfile.get(1),
    [],
  )

  const maxStreak = useLiveQuery(
    async (): Promise<number> => {
      if (!db) return 0
      const habits = await db.habits.toArray()
      return habits.reduce((max, h) => Math.max(max, h.streakCount ?? 0), 0)
    },
    [],
    0,
  )

  /* ── Derived display values ────────────────────────────── */
  const equippedIds = useMemo(
    () => resolveEquipped(profile?.equippedItems),
    [profile?.equippedItems],
  )

  const hp     = profile?.healthPoints ?? 100
  const level  = profile?.currentLevel ?? 1
  const xp     = profile?.expPoints    ?? 0
  const expReq = expRequired(level)
  const expPct = Math.min(100, (xp / expReq) * 100)
  const hpPct  = Math.min(100, Math.max(0, hp))

  const name = profile?.userName ?? 'Scholar'

  const showHpWarning = hp < 30

  return (
    <div className={styles.page}>

      <ZenHeading
        eyebrow="Character · Identity Engine"
        title={`Character\nSheet.`}
        subtitle="Equip vanity items earned through academic discipline and habit mastery. Items are gated by character level."
        size="md"
      />

      {/* HP warning banner */}
      {showHpWarning && (
        <div className={styles.hpWarning} role="alert">
          <div className={styles.hpWarningDot} aria-hidden="true" />
          <p className={styles.hpWarningText}>
            Critical vitality — complete overdue assignments or log habits to restore HP.
          </p>
        </div>
      )}

      <div className={styles.layout}>

        {/* ── Left: Avatar Canvas + mini stats ─────────── */}
        <div className={styles.leftCol}>
          <div className={styles.avatarCard}>
            <p className={styles.charName}>{name}</p>
            <div className={styles.charMeta}>
              <span className={styles.charLevel}>◆ Level {level}</span>
            </div>

            <AvatarCanvas
              equippedIds={equippedIds}
              healthPoints={hp}
              activeSlot={activeSlot}
              onSlotClick={setActiveSlot}
            />

            {/* Mini stat bars */}
            <div className={styles.miniStats}>
              <div className={styles.miniStatRow}>
                <span className={styles.miniStatLabel}>EXP</span>
                <div className={styles.miniBarTrack}>
                  <div
                    className={`${styles.miniBarFill} ${styles.expBar}`}
                    style={{ width: `${expPct}%` }}
                  />
                </div>
                <span className={styles.miniStatVal}>{xp} / {expReq}</span>
              </div>

              <div className={styles.miniStatRow}>
                <span className={styles.miniStatLabel}>HP</span>
                <div className={styles.miniBarTrack}>
                  <div
                    className={`${styles.miniBarFill} ${styles.hpBar}`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <span className={styles.miniStatVal}>{hp} / {HP_MAX}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Equipment Customizer ───────────────── */}
        <div className={styles.rightCol}>
          <AvatarCustomizer
            equippedIds={equippedIds}
            currentLevel={level}
            maxStreak={maxStreak ?? 0}
            activeTab={activeSlot}
            onTabChange={setActiveSlot}
          />
        </div>

      </div>
    </div>
  )
}
