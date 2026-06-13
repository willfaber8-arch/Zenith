'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * CosmeticShop — Games Tab · Step 7.1
 * Cosmetic Customization Shop Framework
 *
 * Premium theme-purchasing and inventory hub for the Games Tab.
 * Reads live profile state from user_profile_config via useLiveQuery
 * so the owned/active status of every card updates the instant a
 * transaction commits — no manual cache invalidation.
 *
 * Purchase execution pipeline
 * ───────────────────────────
 *   1. Pre-flight: cosmeticPoints (live from useZenithEconomy) vs cost
 *      → insufficient → 900 ms rose flash on card + return
 *   2. Atomic DB transaction via purchaseTheme():
 *        • Deducts cost from resource_inventory (cosmetic_points row)
 *        • Appends themeId to user_profile_config.purchasedThemes
 *      → useLiveQuery subscription propagates the profile change to
 *        all card states without manual state lifting
 *
 * Equip broadcast pipeline
 * ────────────────────────
 *   1. setActiveTheme() writes the new activeTheme string to IDB
 *   2. applyThemeCssVars() calls document.documentElement.style
 *      .setProperty() for each CSS token — takes effect immediately,
 *      zero page reload
 *   3. onThemeChanged? callback notifies the parent shell
 *
 * Loading strategy
 * ────────────────
 *   profile === undefined is the useLiveQuery boot frame.
 *   Skeleton cards with matching geometry are shown during this
 *   window so the grid never collapses or reflows on first paint.
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback } from 'react'
import { useLiveQuery }                  from 'dexie-react-hooks'
import {
  gamesDb,
  purchaseTheme,
  setActiveTheme,
  type UserProfileConfig,
} from '@/lib/gamesDb'
import { useZenithEconomy }   from '@/hooks/useZenithEconomy'
import styles                 from './CosmeticShop.module.css'

/* ════════════════════════════════════════════════════════════════
   §1  EXPORTED TYPE INTERFACES  (spec-required signatures)
   ════════════════════════════════════════════════════════════════ */

/**
 * Full descriptor for one purchasable visual theme.
 * `colorsPreview` carries the four hex values used both for swatch
 * rendering and for the live CSS-variable broadcast on equip.
 */
export interface CosmeticThemeItem {
  id: string
  name: string
  description: string
  cost: number
  colorsPreview: {
    bg:      string   // maps to --bg-main
    surface: string   // maps to --surface-card
    accent1: string   // maps to --accent-purple
    accent2: string   // maps to --accent-green
  }
}

/** Props accepted by the CosmeticShop component. */
export interface CosmeticShopProps {
  /** Called with the new theme ID immediately after the CSS broadcast fires. */
  onThemeChanged?: (newThemeId: string) => void
}

/* ════════════════════════════════════════════════════════════════
   §2  THEME LEDGER
   ────────────────────────────────────────────────────────────────
   Exhaustive compile-time dictionary of every purchasable theme.
   colorsPreview hex values match the spec's CSS token overrides
   exactly — they are applied to :root via style.setProperty on equip.
   ════════════════════════════════════════════════════════════════ */

const COSMETIC_THEME_CATALOG: readonly CosmeticThemeItem[] = [
  /* ── Theme Node 1: Nordic Frost ─────────────────────────────── */
  {
    id:          'theme_nordic',
    name:        'Nordic Frost',
    description: 'Minimalist ice-blue palette inspired by Northern European design — slate depths with calm arctic accents.',
    cost:        50,
    colorsPreview: {
      bg:      '#0f141c',
      surface: '#161f2d',
      accent1: '#81a1c1',
      accent2: '#88c0d0',
    },
  },

  /* ── Theme Node 2: Cyberpunk Crucible ───────────────────────── */
  {
    id:          'theme_cyber',
    name:        'Cyberpunk Crucible',
    description: 'High-saturation neon accents blazing across deep violet negative space — maximum contrast for extended sessions.',
    cost:        250,
    colorsPreview: {
      bg:      '#0a0512',
      surface: '#140d24',
      accent1: '#ff007f',
      accent2: '#00f0ff',
    },
  },

  /* ── Theme Node 3: E-Ink Obsidian ───────────────────────────── */
  {
    id:          'theme_obsidian',
    name:        'E-Ink Obsidian',
    description: 'Deeply monochromatic stark workspace — near-black surfaces with white and slate accents for zero visual noise.',
    cost:        500,
    colorsPreview: {
      bg:      '#050505',
      surface: '#111111',
      accent1: '#ffffff',
      accent2: '#777777',
    },
  },
] as const

/* ════════════════════════════════════════════════════════════════
   §3  CSS VARIABLE BROADCASTER
   ────────────────────────────────────────────────────────────────
   Applies the four colorsPreview tokens to :root inline style,
   overriding the cascade from :root { --x: var(--color-x) } with
   maximum specificity — no page reload required.
   SSR-safe: guarded by typeof document check.
   ════════════════════════════════════════════════════════════════ */

function applyThemeCssVars(theme: CosmeticThemeItem): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--bg-main',       theme.colorsPreview.bg)
  root.style.setProperty('--surface-card',  theme.colorsPreview.surface)
  root.style.setProperty('--accent-purple', theme.colorsPreview.accent1)
  root.style.setProperty('--accent-green',  theme.colorsPreview.accent2)
}

/* ════════════════════════════════════════════════════════════════
   §4  SKELETON CARD
   ────────────────────────────────────────────────────────────────
   Rendered in place of real cards during the useLiveQuery boot
   frame.  Geometry matches the loaded card exactly so the grid
   neither collapses nor reflows when real data arrives.
   ════════════════════════════════════════════════════════════════ */

function ThemeCardSkeleton(): React.ReactElement {
  return (
    <div className={styles.themeCardSkeleton} aria-hidden="true">
      {/* Swatch strip placeholder */}
      <div className={styles.skeletonSwatchRow} />
      {/* Body content placeholders */}
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonDescLine} />
        <div className={styles.skeletonDescLine} style={{ width: '68%' }} />
        <div className={styles.skeletonBtn} />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   §5  MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function CosmeticShop({
  onThemeChanged,
}: CosmeticShopProps = {}): React.ReactElement {

  /* ── §5a  Live data subscriptions ─────────────────────────────
     Two reactive streams covering the full purchase + equip state:
       cosmeticPoints — live balance from resource_inventory
       profile        — purchasedThemes[] + activeTheme string       */

  const { cosmeticPoints } = useZenithEconomy()

  const profile = useLiveQuery<UserProfileConfig | undefined>(
    () => gamesDb?.user_profile_config.get('active_user') ?? Promise.resolve(undefined),
    [],
  )

  /* ── §5b  Pending + flash state ───────────────────────────────
     pendingId      — themeId currently being processed (purchase or
                      equip).  Prevents concurrent mutations and drives
                      the "…" loading label on the action button.
     insufficientId — themeId whose card should play the rose flash.
                      Cleared by a 900 ms setTimeout after each flash. */

  const [pendingId,       setPendingId]       = useState<string | null>(null)
  const [insufficientId,  setInsufficientId]  = useState<string | null>(null)

  /* boot frame: profile === undefined while useLiveQuery resolves */
  const isLoading = profile === undefined

  /* ── §5c  Derived state helpers ───────────────────────────────
     Both read from the live `profile` snapshot captured by the
     useLiveQuery subscription.  useCallback ensures stable refs
     so callers (JSX map) do not trigger extra re-renders.          */

  const isPurchased = useCallback(
    (themeId: string): boolean =>
      profile?.purchasedThemes?.includes(themeId) ?? false,
    [profile],
  )

  const isActiveTheme = useCallback(
    (themeId: string): boolean =>
      profile?.activeTheme === themeId,
    [profile],
  )

  /* ── §5d  Purchase handler ─────────────────────────────────────
     Execution contract:
       1. Guard against concurrent mutations via pendingId.
       2. Verify cosmeticPoints ≥ cost; if not, flash the card and
          return without touching the DB.
       3. Call purchaseTheme() — atomic deduction + purchasedThemes
          append in a single Dexie rw transaction.
       4. useLiveQuery on profile auto-updates the card button state. */

  const handlePurchase = useCallback(
    async (theme: CosmeticThemeItem): Promise<void> => {
      if (pendingId !== null) return

      if (cosmeticPoints < theme.cost) {
        setInsufficientId(theme.id)
        window.setTimeout(
          () => setInsufficientId(prev => (prev === theme.id ? null : prev)),
          900,
        )
        return
      }

      setPendingId(theme.id)
      await purchaseTheme(theme.id, theme.cost)
      /* useLiveQuery propagates the profile update — no manual state
         sync needed.  If the transaction was refused (balance lost to
         a concurrent tab), the card simply reflects the fresh state. */
      setPendingId(null)
    },
    [pendingId, cosmeticPoints],
  )

  /* ── §5e  Equip handler — CSS broadcast on commit ──────────────
     Calls setActiveTheme() which writes activeTheme to IDB, then
     immediately calls applyThemeCssVars() so the visual change fires
     without waiting for the next useLiveQuery re-render cycle.       */

  const handleEquip = useCallback(
    async (theme: CosmeticThemeItem): Promise<void> => {
      if (pendingId !== null) return

      setPendingId(theme.id)
      const ok = await setActiveTheme(theme.id)
      if (ok) {
        applyThemeCssVars(theme)
        onThemeChanged?.(theme.id)
      }
      setPendingId(null)
    },
    [pendingId, onThemeChanged],
  )

  /* ── §5f  Render ───────────────────────────────────────────── */

  return (
    <div className={styles.shopRoot}>

      {/* ════════════════════════════════════════════════════════
          SHOP HEADER — title + live CP balance chip
          ════════════════════════════════════════════════════════ */}
      <header className={styles.shopHeader}>
        <div className={styles.shopHeaderLeft}>
          <h2 className={styles.shopTitle}>Cosmetic Shop</h2>
          <p className={styles.shopSubtitle}>
            Purchase and apply visual themes to the workspace
          </p>
        </div>

        {/* CP balance chip — skeleton during boot frame */}
        <div
          className={`${styles.cpBalanceChip} ${isLoading ? styles.cpBalanceSkeleton : ''}`}
          aria-label={
            isLoading
              ? 'Loading balance'
              : `${cosmeticPoints.toLocaleString()} Cosmetic Points available`
          }
          aria-busy={isLoading}
        >
          {!isLoading && (
            <>
              <span className={styles.cpValue}>
                {cosmeticPoints.toLocaleString()}
              </span>
              <span className={styles.cpLabel}>CP</span>
            </>
          )}
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          THEME GRID — Tailwind adaptive grid per spec
          grid grid-cols-1 md:grid-cols-3 gap-4 p-6
          ════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">

        {isLoading
          ? /* ── Boot-frame skeleton cards ───────────────────── */
            COSMETIC_THEME_CATALOG.map(theme => (
              <ThemeCardSkeleton key={theme.id} />
            ))

          : /* ── Live theme cards ─────────────────────────────── */
            COSMETIC_THEME_CATALOG.map(theme => {
              const purchased = isPurchased(theme.id)
              const active    = isActiveTheme(theme.id)
              const canAfford = cosmeticPoints >= theme.cost
              const isPending = pendingId === theme.id
              const isInsuff  = insufficientId === theme.id

              /* Compose card class list without falsy entries */
              const cardClassName = [
                styles.themeCard,
                active   ? styles.themeCardActive       : '',
                isInsuff ? styles.themeCardInsufficient : '',
                !canAfford && !purchased ? styles.themeCardDimmed : '',
              ].filter(Boolean).join(' ')

              return (
                <article
                  key={theme.id}
                  className={cardClassName}
                  aria-label={
                    active
                      ? `${theme.name} — currently active`
                      : purchased
                        ? `${theme.name} — owned`
                        : `${theme.name} — ${theme.cost} Cosmetic Points`
                  }
                >
                  {/* ── Color swatch row ──────────────────────── */}
                  <div
                    className={styles.swatchRow}
                    role="img"
                    aria-label={`${theme.name} color palette: background, surface, primary accent, secondary accent`}
                  >
                    <span
                      className={styles.swatch}
                      style={{ background: theme.colorsPreview.bg }}
                      title="Background"
                    />
                    <span
                      className={styles.swatch}
                      style={{ background: theme.colorsPreview.surface }}
                      title="Surface"
                    />
                    <span
                      className={styles.swatch}
                      style={{ background: theme.colorsPreview.accent1 }}
                      title="Primary accent"
                    />
                    <span
                      className={styles.swatch}
                      style={{ background: theme.colorsPreview.accent2 }}
                      title="Secondary accent"
                    />
                  </div>

                  {/* ── Card body ─────────────────────────────── */}
                  <div className={styles.cardBody}>

                    {/* Title + Active pill */}
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>{theme.name}</h3>
                      {active && (
                        <span
                          className={styles.activePill}
                          aria-label="This theme is currently active"
                        >
                          Active
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className={styles.cardDescription}>
                      {theme.description}
                    </p>

                    {/* Footer — cost chip + action button */}
                    <div className={styles.cardFooter}>

                      {/* Cost label — only present for unpurchased themes */}
                      {!purchased && (
                        <span
                          className={[
                            styles.costLabel,
                            !canAfford ? styles.costLabelInsufficient : '',
                          ].filter(Boolean).join(' ')}
                          aria-label={`Costs ${theme.cost} Cosmetic Points`}
                        >
                          {theme.cost.toLocaleString()} CP
                        </span>
                      )}

                      {/* ── Action button — three mutually exclusive states ── */}

                      {active ? (
                        /* State A: theme is the active one — static indicator */
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnActive}`}
                          disabled
                          aria-label={`${theme.name} is the active theme`}
                          aria-pressed="true"
                        >
                          ✓ Active
                        </button>

                      ) : purchased ? (
                        /* State B: owned but not active — equip CTA */
                        <button
                          type="button"
                          className={[
                            styles.btn,
                            styles.btnEquip,
                            isPending ? styles.btnPending : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => void handleEquip(theme)}
                          disabled={pendingId !== null}
                          aria-label={
                            isPending
                              ? 'Applying theme…'
                              : `Equip ${theme.name}`
                          }
                          aria-busy={isPending}
                        >
                          {isPending ? '…' : 'Equip Theme'}
                        </button>

                      ) : (
                        /* State C: not owned — purchase CTA (or insufficient signal) */
                        <button
                          type="button"
                          className={[
                            styles.btn,
                            styles.btnPurchase,
                            !canAfford ? styles.btnInsufficient : '',
                            isPending   ? styles.btnPending     : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => void handlePurchase(theme)}
                          disabled={pendingId !== null}
                          aria-label={
                            isPending
                              ? 'Processing purchase…'
                              : canAfford
                                ? `Purchase ${theme.name} for ${theme.cost} Cosmetic Points`
                                : `Insufficient Cosmetic Points — need ${(theme.cost - cosmeticPoints).toLocaleString()} more`
                          }
                          aria-busy={isPending}
                        >
                          {isPending
                            ? '…'
                            : canAfford
                              ? `Purchase ${theme.cost.toLocaleString()} CP`
                              : `${theme.cost.toLocaleString()} CP — Low Balance`
                          }
                        </button>
                      )}

                    </div>{/* /cardFooter */}
                  </div>{/* /cardBody */}
                </article>
              )
            })
        }

      </div>{/* /theme grid */}
    </div>
  )
}
