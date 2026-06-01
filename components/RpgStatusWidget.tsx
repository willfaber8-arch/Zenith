'use client'
/**
 * RpgStatusWidget — Phase 5 · Step 5.1
 * ────────────────────────────────────────────────────────────────
 * Full-width character lifecycle banner. Displays the user's
 * current RPG state (Level, EXP progress, HP / Vitality) with
 * live-streamed data via useRpgStats and scaleIn / levelUpFlash
 * CSS animations on level-up events.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  CHARACTER LIFECYCLE · RPG               ◆ LVL 12      │
 *   │  ─────────────────────────────────────────────────────  │
 *   │   12  │  EXPERIENCE  ████████░░░░  847 / 1,107 XP      │
 *   │  LVL  │  VITALITY    ██████████░░   82 / 100 HP        │
 *   └─────────────────────────────────────────────────────────┘
 */

import { useRpgStats }        from '@/lib/hooks/useRpgStats'
import { HP_MAX }             from '@/utils/rpgEngine'
import styles from './RpgStatusWidget.module.css'

/* ── Numeric formatter ─────────────────────────────────────── */

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/* ── Component ─────────────────────────────────────────────── */

export default function RpgStatusWidget() {
  const { profile, expReq, expPct, hpPct, justLeveledUp } = useRpgStats()

  /* Loading skeleton while IDB resolves */
  if (!profile) {
    return <div className={styles.skeleton} aria-busy="true" aria-label="Loading character stats" />
  }

  const hpCritical = profile.healthPoints <= 25

  return (
    <div
      className={`${styles.widget} ${justLeveledUp ? styles.levelUpFlash : ''}`}
      role="region"
      aria-label="Character Lifecycle Stats"
    >

      {/* ── Header ────────────────────────────────────────────── */}
      <div className={styles.header}>
        <p className={styles.eyebrow}>Character Lifecycle · RPG</p>
        <span className={styles.levelBadge} aria-label={`Level ${profile.currentLevel}`}>
          ◆ LVL {profile.currentLevel}
        </span>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Left — large level number */}
        <div className={styles.levelBlock} aria-hidden="true">
          <span
            className={`${styles.levelNum} ${justLeveledUp ? styles.levelNumFlash : ''}`}
          >
            {profile.currentLevel}
          </span>
          <span className={styles.levelLabel}>LEVEL</span>
        </div>

        {/* Visual divider */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Right — stat bars */}
        <div className={styles.bars}>

          {/* EXP row */}
          <div className={styles.statRow}>
            <div className={styles.statMeta}>
              <span className={styles.statLabel}>Experience</span>
              <span className={styles.statVal}>
                {fmt(profile.expPoints)} / {fmt(expReq)}&thinsp;XP
              </span>
            </div>
            <div
              className={styles.barTrack}
              role="progressbar"
              aria-valuenow={profile.expPoints}
              aria-valuemin={0}
              aria-valuemax={expReq}
              aria-label="Experience points"
            >
              <div
                className={`${styles.barFill} ${styles.expFill} ${justLeveledUp ? styles.expFillFlash : ''}`}
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>

          {/* HP row */}
          <div className={styles.statRow}>
            <div className={styles.statMeta}>
              <span className={styles.statLabel}>Vitality</span>
              <span
                className={`${styles.statVal} ${hpCritical ? styles.statValCritical : ''}`}
              >
                {profile.healthPoints} / {HP_MAX}&thinsp;HP
              </span>
            </div>
            <div
              className={styles.barTrack}
              role="progressbar"
              aria-valuenow={profile.healthPoints}
              aria-valuemin={0}
              aria-valuemax={HP_MAX}
              aria-label="Health points"
            >
              <div
                className={`${styles.barFill} ${styles.hpFill} ${hpCritical ? styles.hpFillLow : ''}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
