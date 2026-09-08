/**
 * Arranging your own sidebar.
 *
 * The rule that everything else depends on is "one view, one place":
 * a view showing in two groups would look active in both and explain
 * itself in neither. Most of these exist to hold that rule steady no
 * matter what order things are clicked in, and to make sure a stored
 * arrangement from an older version can never take the sidebar down.
 */

import {
  parseLayout, addGroup, renameGroup, removeGroup, assignItem, unassignItem,
  moveItem, moveGroup, assignedIds, pruneLayout,
  EMPTY_LAYOUT, MAX_GROUPS, MAX_LABEL,
  type NavLayout,
} from '@/lib/navLayout'
import type { ViewId } from '@/lib/nav-config'

const v = (s: string) => s as ViewId

const layoutOf = (...groups: { id: string; label: string; items: string[] }[]): NavLayout =>
  ({ groups: groups.map(g => ({ ...g, items: g.items.map(v) })) })

describe('parseLayout', () => {
  it('reads a well-formed layout', () => {
    const raw = JSON.stringify(layoutOf({ id: 'a', label: 'Daily', items: ['habits'] }))
    expect(parseLayout(raw).groups[0]).toEqual({ id: 'a', label: 'Daily', items: ['habits'] })
  })

  it('treats nothing stored as no groups', () => {
    expect(parseLayout(null)).toEqual(EMPTY_LAYOUT)
    expect(parseLayout('')).toEqual(EMPTY_LAYOUT)
  })

  it('survives anything that is not a layout', () => {
    // Read on every boot, so it must never throw whatever it finds.
    for (const bad of ['not json', '[]', '"x"', '42', 'null', '{}', '{"groups":5}']) {
      expect(() => parseLayout(bad)).not.toThrow()
      expect(parseLayout(bad).groups).toEqual([])
    }
  })

  it('drops malformed groups but keeps the good ones', () => {
    const raw = JSON.stringify({ groups: [
      null, 'nope', { label: 'no id', items: [] }, { id: 'x', label: 'ok', items: ['habits'] },
      { id: 'y', label: 'bad items', items: 'nope' },
    ] })
    const out = parseLayout(raw)
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0].id).toBe('x')
  })

  it('refuses to load the same view into two groups', () => {
    const raw = JSON.stringify(layoutOf(
      { id: 'a', label: 'A', items: ['habits'] },
      { id: 'b', label: 'B', items: ['habits', 'calendar'] },
    ))
    const out = parseLayout(raw)
    expect(out.groups[0].items).toEqual(['habits'])
    expect(out.groups[1].items).toEqual(['calendar'])
  })

  it('caps how many groups it will load', () => {
    const many = { groups: Array.from({ length: MAX_GROUPS + 5 },
      (_, i) => ({ id: `g${i}`, label: `G${i}`, items: [] })) }
    expect(parseLayout(JSON.stringify(many)).groups).toHaveLength(MAX_GROUPS)
  })

  it('truncates an absurd label rather than letting it break the layout', () => {
    const raw = JSON.stringify({ groups: [{ id: 'a', label: 'x'.repeat(200), items: [] }] })
    expect(parseLayout(raw).groups[0].label.length).toBe(MAX_LABEL)
  })
})

describe('groups', () => {
  it('adds a group with a trimmed name', () => {
    const out = addGroup(EMPTY_LAYOUT, '  Daily  ')
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0].label).toBe('Daily')
  })

  it('refuses a blank name', () => {
    expect(addGroup(EMPTY_LAYOUT, '   ').groups).toHaveLength(0)
  })

  it('stops at the cap', () => {
    let l = EMPTY_LAYOUT
    for (let i = 0; i < MAX_GROUPS + 3; i++) l = addGroup(l, `G${i}`)
    expect(l.groups).toHaveLength(MAX_GROUPS)
  })

  it('gives each group a distinct id', () => {
    const l = addGroup(addGroup(EMPTY_LAYOUT, 'A'), 'B')
    expect(l.groups[0].id).not.toBe(l.groups[1].id)
  })

  it('renames, and ignores a blank rename', () => {
    const l = addGroup(EMPTY_LAYOUT, 'Old')
    const id = l.groups[0].id
    expect(renameGroup(l, id, 'New').groups[0].label).toBe('New')
    expect(renameGroup(l, id, '  ').groups[0].label).toBe('Old')
  })

  it('removes a group, and its views return to their built-in homes', () => {
    const l = layoutOf({ id: 'a', label: 'A', items: ['habits'] })
    const out = removeGroup(l, 'a')
    expect(out.groups).toHaveLength(0)
    expect(assignedIds(out).has(v('habits'))).toBe(false)
  })
})

describe('assigning views', () => {
  const base = layoutOf(
    { id: 'a', label: 'A', items: ['habits'] },
    { id: 'b', label: 'B', items: ['calendar'] },
  )

  it('moves a view between groups rather than copying it', () => {
    // Two copies would both look active and neither would say why.
    const out = assignItem(base, 'b', v('habits'))
    expect(out.groups[0].items).toEqual([])
    expect(out.groups[1].items).toEqual(['calendar', 'habits'])
  })

  it('never lists a view twice, however it is reassigned', () => {
    let l = base
    for (const g of ['a', 'b', 'a', 'b', 'a']) l = assignItem(l, g, v('habits'))
    const all = l.groups.flatMap(g => g.items)
    expect(all.filter(i => i === 'habits')).toHaveLength(1)
  })

  it('ignores an unknown group', () => {
    expect(assignItem(base, 'nope', v('habits'))).toEqual(base)
  })

  it('unassigns a view back to its built-in category', () => {
    const out = unassignItem(base, v('habits'))
    expect(assignedIds(out).has(v('habits'))).toBe(false)
    expect(assignedIds(out).has(v('calendar'))).toBe(true)
  })
})

describe('ordering', () => {
  const l = layoutOf({ id: 'a', label: 'A', items: ['habits', 'calendar', 'stats'] })

  it('moves a view up and down within its group', () => {
    expect(moveItem(l, 'a', v('calendar'), -1).groups[0].items)
      .toEqual(['calendar', 'habits', 'stats'])
    expect(moveItem(l, 'a', v('calendar'), 1).groups[0].items)
      .toEqual(['habits', 'stats', 'calendar'])
  })

  it('does nothing at the ends rather than wrapping around', () => {
    expect(moveItem(l, 'a', v('habits'), -1).groups[0].items).toEqual(l.groups[0].items)
    expect(moveItem(l, 'a', v('stats'),  1).groups[0].items).toEqual(l.groups[0].items)
  })

  it('reorders whole groups', () => {
    const two = layoutOf({ id: 'a', label: 'A', items: [] }, { id: 'b', label: 'B', items: [] })
    expect(moveGroup(two, 'b', -1).groups.map(g => g.id)).toEqual(['b', 'a'])
    expect(moveGroup(two, 'a', -1).groups.map(g => g.id)).toEqual(['a', 'b'])   // already first
  })
})

describe('pruneLayout', () => {
  it('drops views the app no longer has', () => {
    // A module removed between releases would otherwise leave a nav item
    // that navigates nowhere.
    const l = layoutOf({ id: 'a', label: 'A', items: ['habits', 'deleted-module'] })
    const out = pruneLayout(l, new Set(['habits']))
    expect(out.groups[0].items).toEqual(['habits'])
  })

  it('keeps a group that ends up empty', () => {
    const l = layoutOf({ id: 'a', label: 'A', items: ['gone'] })
    expect(pruneLayout(l, new Set()).groups).toHaveLength(1)
  })
})
