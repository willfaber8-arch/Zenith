'use client'

import { useActiveBiomeLayout, type BiomeAsset } from '@/lib/hooks/useActiveBiomeLayout'
import styles from './BiomeWidget.module.css'

/* ─────────────────────────────────────────────────────────────────────
   Swim-distance calculation: later fish in the stagger start further
   right, so they travel a shorter absolute distance — all stay inside
   the scene boundary even on narrow viewports.
   ───────────────────────────────────────────────────────────────────── */
function swimDist(ci: number): number {
  return Math.max(100, 340 - ci * 40)
}

/* ─────────────────────────────────────────────────────────────────────
   Individual creature node — fish or animal.
   All motion is purely CSS (transform only) so it stays on the GPU
   compositor thread and never competes with JS task work.
   ───────────────────────────────────────────────────────────────────── */
function CreatureNode({ asset, index }: { asset: BiomeAsset; index: number }) {
  const isFish = asset.category === 'fish'
  return (
    <span
      className={`${styles.creature} ${isFish ? styles.fish : styles.animal}`}
      style={
        {
          '--ci':        index,
          '--swim-dist': isFish ? `${swimDist(index)}px` : '65px',
        } as React.CSSProperties
      }
      aria-hidden="true"
      title={asset.name}
    >
      {asset.emoji}
    </span>
  )
}

/* Decor node — gentle vertical bob only, positioned along the substrate */
function DecorNode({ asset, index }: { asset: BiomeAsset; index: number }) {
  return (
    <span
      className={styles.decor}
      style={{ '--di': index } as React.CSSProperties}
      aria-hidden="true"
      title={asset.name}
    >
      {asset.emoji}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   BIOME WIDGET — home screen standalone dashboard panel
   ═══════════════════════════════════════════════════════════════════ */
export default function BiomeWidget() {
  const { activeBiome, creatures, decor, isEmpty, mounted, switchBiome } = useActiveBiomeLayout()

  /* Skeleton card maintains layout height before localStorage resolves */
  if (!mounted) {
    return (
      <div className={styles.wrap} aria-hidden="true">
        <div className={styles.skeleton} />
      </div>
    )
  }

  const isAqua = activeBiome === 'aquarium'

  return (
    <div className={`${styles.wrap} anim-fade-in delay-3`}>
      <div className={styles.card} aria-label="Cozy Biome live viewport">

        {/* ── Header strip ──────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.streamChip}>
            <span className={styles.streamDot} aria-hidden="true" />
            <span className={styles.streamLabel}>[ COZY BIOME // STREAM ACTIVE ]</span>
          </div>
          <div className={styles.biomeSwitcher} role="group" aria-label="Switch biome view">
            <button
              type="button"
              className={`${styles.biomeBtn} ${isAqua ? styles.biomeBtnActive : ''}`}
              onClick={() => switchBiome('aquarium')}
              aria-pressed={isAqua}
            >
              🐟 Aquarium
            </button>
            <button
              type="button"
              className={`${styles.biomeBtn} ${!isAqua ? styles.biomeBtnActive : ''}`}
              onClick={() => switchBiome('zoo')}
              aria-pressed={!isAqua}
            >
              🌿 Zoo
            </button>
          </div>
        </div>

        {/* ── Main scene ────────────────────────────────────────── */}
        <div
          className={`${styles.scene} ${isAqua ? styles.sceneAqua : styles.sceneZoo}`}
          role="img"
          aria-label={isEmpty
            ? `Empty ${isAqua ? 'aquarium' : 'zoo'} — no items unlocked`
            : `Live ${isAqua ? 'aquarium' : 'zoo'} with ${creatures.length} creature${creatures.length !== 1 ? 's' : ''}`}
        >

          {isEmpty ? (

            /* ── Empty state ──────────────────────────────────── */
            <div className={styles.emptyState}>
              <p className={styles.emptyLabel}>
                [ ECOSYSTEM CALM // ACQUIRE COSMETIC ASSETS IN ARCADE TO POPULATE BIOME ]
              </p>
            </div>

          ) : (
            <>
              {/* ── Creatures layer (GPU-only transform animations) */}
              <div className={styles.creaturesLayer} aria-hidden="true">
                {creatures.slice(0, 6).map((c, i) => (
                  <CreatureNode key={c.id} asset={c} index={i} />
                ))}
              </div>

              {/* ── Decor layer (vertical bob only) ─────────────── */}
              <div className={styles.decorLayer} aria-hidden="true">
                {decor.slice(0, 4).map((d, i) => (
                  <DecorNode key={d.id} asset={d} index={i} />
                ))}
              </div>

              {/* ── Substrate strip ───────────────────────────── */}
              <p className={styles.substrate} aria-hidden="true">
                {isAqua
                  ? '· · · · · · · · · · · · · · · · · · · · · · · ·'
                  : '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~'}
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
