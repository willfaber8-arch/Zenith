'use client'

/**
 * CustomContextMenu — Phase 14.2 · Custom Context Menus
 *
 * Rendered by ContextMenuProvider (lib/ContextMenuContext.tsx)
 * whenever the global right-click interceptor fires.
 *
 * Position clamping: uses estimated menu dimensions to keep the
 * menu fully on-screen, then derives transform-origin so the
 * spring-pop animation originates from the correct corner.
 *
 * Action execution: each item fires an async IDB operation
 * (Dexie.js) and/or navigation call, then calls onClose().
 */

import { useCallback }       from 'react'
import { useNav }            from '@/lib/NavContext'
import { useToast }          from '@/lib/ToastContext'
import { db }                from '@/lib/db'
import type { TargetType, CtxTargetData } from '@/lib/ContextMenuContext'
import styles from './CustomContextMenu.module.css'

/* ── Types ────────────────────────────────────────────────────── */

export interface CustomContextMenuProps {
  position:   { x: number; y: number }
  targetType: TargetType
  targetData: CtxTargetData
  onClose:    () => void
}

/* ── Action item shape ────────────────────────────────────────── */

interface MenuItem {
  glyph:       string
  label:       string
  destructive?: boolean
  onClick:     () => void | Promise<void>
}

type MenuSection = {
  label?: string
  items:  MenuItem[]
}

/* ── Module-level wallpaper cycle state ───────────────────────── */

const WALLPAPER_CATEGORIES = ['essentials', 'creator', 'vault'] as const
type CategoryId = (typeof WALLPAPER_CATEGORIES)[number]
let _wallpaperIdx = 0

/* ── Tomorrow date helper ─────────────────────────────────────── */

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ── Context badge metadata per type ─────────────────────────── */

const TARGET_META: Record<TargetType, { glyph: string; label: string }> = {
  TASK:      { glyph: '◈', label: 'Task' },
  CALENDAR:  { glyph: '⬡', label: 'Calendar Event' },
  WALLPAPER: { glyph: '⊡', label: 'Canvas' },
  WIDGET:    { glyph: '⊞', label: 'Widget' },
  GENERIC:   { glyph: '·', label: 'Zenith OS' },
}

/* ══════════════════════════════════════════════════════════════
   CustomContextMenu
   ══════════════════════════════════════════════════════════════ */

export function CustomContextMenu({
  position,
  targetType,
  targetData,
  onClose,
}: CustomContextMenuProps) {
  const { navigate, activeView } = useNav()
  const { toast }                = useToast()

  /* ── Position clamping ──────────────────────────────────────── */
  /*
   * Estimated menu dimensions: these are generous upper bounds.
   * The menu never renders wider than 264px (CSS max-width) or
   * taller than ~260px (4 items × 36px + badge + dividers).
   * Clamping prevents the menu from being cut off at viewport edges.
   */
  const MENU_EST_W = 264
  const MENU_EST_H = 260

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1440
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900

  /* Apply 12px inset margin from viewport edges */
  const MARGIN = 12
  const clampedX = Math.min(position.x, vw - MENU_EST_W - MARGIN)
  const clampedY = Math.min(position.y, vh - MENU_EST_H - MARGIN)

  /* Clamp prevents going negative (cursor near top/left edge) */
  const finalX = Math.max(MARGIN, clampedX)
  const finalY = Math.max(MARGIN, clampedY)

  /*
   * Transform-origin: the spring animation scales from the corner
   * closest to where the user actually clicked, so it feels like
   * the menu is "growing" out of the cursor position.
   */
  const originX = position.x > clampedX ? 'right' : 'left'
  const originY = position.y > clampedY ? 'bottom' : 'top'
  const transformOrigin = `${originY} ${originX}`

  /* ── Action builders ──────────────────────────────────────────
   * Each builder returns a MenuSection[] that the renderer maps.
   * Using useCallback here would require a dependency array that
   * covers everything used inside; since the menu remounts on
   * every open (key={openId}), closures are always fresh.
   * ─────────────────────────────────────────────────────────── */

  /* TASK actions */
  const buildTaskSections = useCallback((): MenuSection[] => {
    const id = typeof targetData.id === 'number'
      ? targetData.id
      : Number(targetData.id ?? 0)

    return [
      {
        items: [
          {
            glyph: '✓',
            label: 'Mark Complete',
            onClick: async () => {
              try {
                await db.assignments.update(id, { status: 'completed' as const })
                toast('Task marked complete.', 'success')
              } catch {
                toast('Could not update task.', 'error')
              }
              onClose()
            },
          },
          {
            glyph: '✎',
            label: 'Edit Details',
            onClick: () => {
              navigate('study-shield', 'essentials')
              toast('Tip: open the task to edit it.', 'info')
              onClose()
            },
          },
        ],
      },
      {
        items: [
          {
            glyph: '→',
            label: 'Push to Tomorrow',
            onClick: async () => {
              try {
                await db.assignments.update(id, { dueDate: tomorrowISO() })
                toast('Task pushed to tomorrow.', 'success')
              } catch {
                toast('Could not reschedule task.', 'error')
              }
              onClose()
            },
          },
        ],
      },
      {
        items: [
          {
            glyph: '⌫',
            label: 'Delete Task',
            destructive: true,
            onClick: async () => {
              try {
                await db.assignments.delete(id)
                toast('Task deleted.', 'info')
              } catch {
                toast('Could not delete task.', 'error')
              }
              onClose()
            },
          },
        ],
      },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetData, onClose])

  /* CALENDAR actions */
  const buildCalendarSections = useCallback((): MenuSection[] => {
    return [
      {
        items: [
          {
            glyph: '+',
            label: 'New Event',
            onClick: () => {
              navigate('calendar', 'essentials')
              toast('Switch to the Personal tab to create an event.', 'info')
              onClose()
            },
          },
        ],
      },
      {
        items: [
          {
            glyph: '⌫',
            label: 'Clear Day',
            destructive: true,
            onClick: async () => {
              const date = targetData.date
              if (!date) { onClose(); return }

              try {
                /* Build ms bounds for the target day (local time) */
                const parts = date.split('-').map(Number)
                const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0,  0,  0,   0).getTime()
                const dayEnd   = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime()

                const keys = await db.personalEvents
                  .where('startMs')
                  .between(dayStart, dayEnd, true, true)
                  .primaryKeys()

                if (keys.length === 0) {
                  toast('No personal events on this day.', 'info')
                } else {
                  await db.personalEvents.bulkDelete(keys as number[])
                  toast(`Cleared ${keys.length} event${keys.length > 1 ? 's' : ''}.`, 'success')
                }
              } catch {
                toast('Could not clear events.', 'error')
              }
              onClose()
            },
          },
        ],
      },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetData, onClose])

  /* WIDGET actions */
  const buildWidgetSections = useCallback((): MenuSection[] => {
    const key = String(targetData.id ?? '')
    const label = targetData.label ?? 'this widget'
    return [
      {
        items: [
          {
            glyph: '⊠',
            label: `Disable — ${label}`,
            destructive: true,
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('zenith:widget-toggle', { detail: { key } }),
              )
              onClose()
            },
          },
        ],
      },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetData, onClose])

  /* WALLPAPER actions */
  const buildWallpaperSections = useCallback((): MenuSection[] => {
    return [
      {
        items: [
          {
            glyph: '◑',
            label: 'Change Background Color',
            onClick: () => {
              _wallpaperIdx = (_wallpaperIdx + 1) % WALLPAPER_CATEGORIES.length
              const nextCat: CategoryId = WALLPAPER_CATEGORIES[_wallpaperIdx]
              navigate((activeView ?? 'home') as Parameters<typeof navigate>[0], nextCat)
              onClose()
            },
          },
        ],
      },
      {
        items: [
          {
            glyph: '⟳',
            label: 'System Diagnostics',
            onClick: () => {
              toast('Running system diagnostics...', 'info')
              onClose()
              setTimeout(() => {
                try {
                  sessionStorage.removeItem('zenith_handshake_v1')
                } catch { /* private mode */ }
                window.location.reload()
              }, 500)
            },
          },
        ],
      },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, onClose])

  /* GENERIC actions — minimal utility */
  const buildGenericSections = useCallback((): MenuSection[] => {
    return [
      {
        items: [
          {
            glyph: '⚙',
            label: 'Settings',
            onClick: () => {
              navigate('settings', null)
              onClose()
            },
          },
        ],
      },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  /* ── Resolve sections for current targetType ───────────────── */

  const sections: MenuSection[] = (() => {
    switch (targetType) {
      case 'TASK':      return buildTaskSections()
      case 'CALENDAR':  return buildCalendarSections()
      case 'WALLPAPER': return buildWallpaperSections()
      case 'WIDGET':    return buildWidgetSections()
      case 'GENERIC':   return buildGenericSections()
    }
  })()

  const meta = TARGET_META[targetType]

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div
      className={styles.menu}
      data-ctx-menu="true"
      role="menu"
      aria-label={`${meta.label} context menu`}
      style={{
        left:            finalX,
        top:             finalY,
        transformOrigin: transformOrigin,
      }}
    >
      {/* Context badge — subtle type indicator */}
      <div className={styles.badge} aria-hidden="true">
        <span className={styles.badgeGlyph}>{meta.glyph}</span>
        <span className={styles.badgeLabel}>
          {targetData.label
            ? `${meta.label} · ${targetData.label}`
            : meta.label}
        </span>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      {/* Action sections */}
      {sections.map((section, si) => (
        <div key={si} role="group" aria-label={section.label}>
          {section.label && (
            <p className={styles.sectionLabel}>{section.label}</p>
          )}
          {section.items.map((item, ii) => (
            <div
              key={ii}
              className={`${styles.item} ${item.destructive ? styles.itemDestructive : ''}`}
              role="menuitem"
              tabIndex={0}
              onClick={() => void item.onClick()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void item.onClick()
                }
              }}
            >
              <span className={styles.itemGlyph} aria-hidden="true">
                {item.glyph}
              </span>
              <span className={styles.itemLabel}>{item.label}</span>
            </div>
          ))}
          {/* Divider between sections (not after last) */}
          {si < sections.length - 1 && (
            <div className={styles.divider} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  )
}
