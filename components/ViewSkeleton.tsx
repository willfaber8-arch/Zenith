'use client'

/**
 * ViewSkeleton.tsx
 * Phase 12.2 — Lazy-Loading Cozy Shimmer Placeholder
 *
 * Rendered by every `next/dynamic` descriptor's `loading` prop while
 * the actual view chunk is downloading.  Three variants mirror the
 * structural anatomy of different view types so the transition from
 * skeleton → live content produces zero layout shift.
 *
 *   'default' — two tall cards + three short row cards  (most views)
 *   'split'   — two equal horizontal panes              (FriendsNetwork, Games)
 *   'wide'    — single full-width tall card              (GPA, Analytics)
 *
 * All blocks use a `skeletonBreathe` opacity pulse plus a warm shimmer
 * sweep that drifts from left to right — no spinners, no hard edges.
 */

import styles from './ViewSkeleton.module.css'

export type SkeletonVariant = 'default' | 'split' | 'wide'

interface ViewSkeletonProps {
  variant?: SkeletonVariant
}

export default function ViewSkeleton({ variant = 'default' }: ViewSkeletonProps) {
  return (
    <div className={styles.root} role="status" aria-label="Loading module">

      {/* ── Header anatomy ────────────────────────────── */}
      <div className={styles.header}>
        <div className={`${styles.block} ${styles.eyebrow}`} aria-hidden="true" />
        <div className={`${styles.block} ${styles.title}`}   aria-hidden="true" />
        <div className={`${styles.block} ${styles.subtitle}`} aria-hidden="true" />
      </div>

      {/* ── Content anatomy (variant-aware) ───────────── */}
      {variant === 'split' ? (
        <div className={`${styles.content} ${styles.contentSplit}`}>
          {/* Left pane */}
          <div className={styles.pane}>
            <div className={`${styles.block} ${styles.paneHeader}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.paneLine}`}   aria-hidden="true" />
            <div className={`${styles.block} ${styles.paneLine}`}   aria-hidden="true" />
            <div className={`${styles.block} ${styles.paneLineShort}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.paneLineShort}`} aria-hidden="true" />
          </div>
          {/* Right pane */}
          <div className={styles.pane}>
            <div className={`${styles.block} ${styles.paneHeader}`} aria-hidden="true" />
            <div className={styles.cardRow}>
              <div className={`${styles.block} ${styles.card}`} aria-hidden="true" />
              <div className={`${styles.block} ${styles.card}`} aria-hidden="true" />
            </div>
            <div className={`${styles.block} ${styles.paneLine}`} aria-hidden="true" />
          </div>
        </div>
      ) : variant === 'wide' ? (
        <div className={`${styles.content} ${styles.contentDefault}`}>
          <div className={`${styles.block} ${styles.cardTall}`} aria-hidden="true"
               style={{ height: '260px', width: '100%' }} />
          <div className={styles.cardRow}>
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
          </div>
        </div>
      ) : (
        /* default */
        <div className={`${styles.content} ${styles.contentDefault}`}>
          <div className={styles.cardGrid}>
            <div className={`${styles.block} ${styles.cardTall}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.cardTall}`} aria-hidden="true" />
          </div>
          <div className={styles.cardRow}>
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
            <div className={`${styles.block} ${styles.cardShort}`} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* ── Ambient loading label ─────────────────────── */}
      <div className={styles.statusLabel}>
        <span className={styles.statusDot}  aria-hidden="true" />
        <span className={styles.statusText}>Loading module</span>
      </div>

    </div>
  )
}
