/**
 * lib/navLayout.ts — the part of the sidebar you arrange yourself.
 *
 * The built-in taxonomy in nav-config is a reasonable default and a poor
 * fit for any particular person: what you open ten times a day sits
 * wherever its category happens to fall. This is a thin layer over it —
 * groups you name, holding the views you choose, rendered above
 * everything else.
 *
 * Deliberately an overlay rather than a replacement. New modules keep
 * appearing in their built-in category without needing to be added
 * here, and a group whose views were removed from the app degrades to
 * an empty group rather than a crash.
 *
 * Pure: no React, no DOM beyond localStorage, so the rules about what a
 * valid arrangement is can be tested without rendering a sidebar.
 */

import type { ViewId } from '@/lib/nav-config'

export const NAV_LAYOUT_KEY = 'zenith_nav_layout_v1'
/** Broadcast so an open sidebar re-reads without a reload. */
export const NAV_LAYOUT_EVENT = 'zenith:nav-layout'

export interface NavGroup {
  id:    string
  label: string
  items: ViewId[]
}

export interface NavLayout {
  groups: NavGroup[]
}

export const EMPTY_LAYOUT: NavLayout = { groups: [] }

export const MAX_GROUPS = 8
export const MAX_LABEL  = 24

/* ── Reading and writing ────────────────────────────────────────── */

/**
 * Parse a stored layout, discarding anything malformed.
 *
 * This is read on every boot and can contain whatever an older version
 * wrote, or whatever survived a half-finished edit. Anything that is
 * not obviously a group is dropped rather than trusted — a sidebar that
 * silently loses one custom group is recoverable; one that throws
 * during render is not.
 */
export function parseLayout(raw: string | null): NavLayout {
  if (!raw) return EMPTY_LAYOUT
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return EMPTY_LAYOUT
    const groupsRaw = (data as { groups?: unknown }).groups
    if (!Array.isArray(groupsRaw)) return EMPTY_LAYOUT

    const seen: Set<string> = new Set()
    const groups: NavGroup[] = []

    for (const g of groupsRaw) {
      if (!g || typeof g !== 'object') continue
      const { id, label, items } = g as Partial<NavGroup>
      if (typeof id !== 'string' || !id) continue
      if (typeof label !== 'string') continue
      if (!Array.isArray(items)) continue

      /* A view may live in exactly one group. Two copies in the sidebar
         would both look active and neither would explain why. */
      const kept: ViewId[] = []
      for (const it of items) {
        if (typeof it !== 'string' || seen.has(it)) continue
        seen.add(it)
        kept.push(it as ViewId)
      }
      groups.push({ id, label: label.slice(0, MAX_LABEL), items: kept })
      if (groups.length >= MAX_GROUPS) break
    }
    return { groups }
  } catch {
    return EMPTY_LAYOUT
  }
}

export function loadLayout(): NavLayout {
  try {
    return parseLayout(localStorage.getItem(NAV_LAYOUT_KEY))
  } catch {
    return EMPTY_LAYOUT
  }
}

export function saveLayout(layout: NavLayout): void {
  try {
    localStorage.setItem(NAV_LAYOUT_KEY, JSON.stringify(layout))
    window.dispatchEvent(new CustomEvent(NAV_LAYOUT_EVENT))
  } catch { /* private mode — the arrangement just won't persist */ }
}

/* ── Operations (pure) ──────────────────────────────────────────── */

/** Every view currently held by a custom group. */
export function assignedIds(layout: NavLayout): Set<ViewId> {
  const out = new Set<ViewId>()
  for (const g of layout.groups) for (const id of g.items) out.add(id)
  return out
}

export function addGroup(layout: NavLayout, label: string): NavLayout {
  const name = label.trim().slice(0, MAX_LABEL)
  if (!name || layout.groups.length >= MAX_GROUPS) return layout
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return { groups: [...layout.groups, { id, label: name, items: [] }] }
}

export function renameGroup(layout: NavLayout, groupId: string, label: string): NavLayout {
  const name = label.trim().slice(0, MAX_LABEL)
  if (!name) return layout
  return {
    groups: layout.groups.map(g => (g.id === groupId ? { ...g, label: name } : g)),
  }
}

/** Remove a group. Its views return to their built-in categories. */
export function removeGroup(layout: NavLayout, groupId: string): NavLayout {
  return { groups: layout.groups.filter(g => g.id !== groupId) }
}

/**
 * Put a view in a group, taking it out of whichever group held it.
 *
 * Moving rather than copying is what keeps "one view, one place in the
 * sidebar" true no matter which order the user clicks things in.
 */
export function assignItem(layout: NavLayout, groupId: string, view: ViewId): NavLayout {
  if (!layout.groups.some(g => g.id === groupId)) return layout
  return {
    groups: layout.groups.map(g => {
      const without = g.items.filter(i => i !== view)
      if (g.id !== groupId) return without.length === g.items.length ? g : { ...g, items: without }
      return { ...g, items: [...without, view] }
    }),
  }
}

/** Take a view out of every group; it falls back to its built-in home. */
export function unassignItem(layout: NavLayout, view: ViewId): NavLayout {
  return {
    groups: layout.groups.map(g => {
      const items = g.items.filter(i => i !== view)
      return items.length === g.items.length ? g : { ...g, items }
    }),
  }
}

/** Shift a view one place within its group. */
export function moveItem(
  layout: NavLayout, groupId: string, view: ViewId, dir: -1 | 1,
): NavLayout {
  return {
    groups: layout.groups.map(g => {
      if (g.id !== groupId) return g
      const i = g.items.indexOf(view)
      const j = i + dir
      if (i < 0 || j < 0 || j >= g.items.length) return g   // already at the end
      const items = [...g.items]
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...g, items }
    }),
  }
}

/** Shift a whole group one place up or down the sidebar. */
export function moveGroup(layout: NavLayout, groupId: string, dir: -1 | 1): NavLayout {
  const i = layout.groups.findIndex(g => g.id === groupId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= layout.groups.length) return layout
  const groups = [...layout.groups]
  ;[groups[i], groups[j]] = [groups[j], groups[i]]
  return { groups }
}

/**
 * Drop views that no longer exist in the app.
 *
 * A module can be removed or renamed between releases; without this the
 * group would keep rendering a nav item that goes nowhere.
 */
export function pruneLayout(layout: NavLayout, known: ReadonlySet<string>): NavLayout {
  return {
    groups: layout.groups.map(g => ({ ...g, items: g.items.filter(i => known.has(i)) })),
  }
}
