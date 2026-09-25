/**
 * On a phone Zenith is five screens plus Settings; everything else is
 * shown as Home, without rewriting where navigation says you are.
 */

import { PHONE_TABS, phoneViewFor, phoneTitleFor } from '@/lib/phoneViews'
import { MODULE_REGISTRY } from '@/lib/modules'

describe('the phone’s screens', () => {
  it('are Home, Today, Habits, Tasks and Notes, in that order', () => {
    expect(PHONE_TABS.map(t => t.label)).toEqual(['Home', 'Today', 'Habits', 'Tasks', 'Notes'])
  })

  it('keeps its own views and Settings', () => {
    for (const v of ['home', 'outlook', 'habits', 'calendar', 'notes', 'settings'] as const) {
      expect(phoneViewFor(v)).toBe(v)
    }
  })

  it('shows Home for every other view', () => {
    const others = MODULE_REGISTRY.map(m => m.id)
      .filter(id => !['home', 'outlook', 'habits', 'calendar', 'notes', 'settings'].includes(id))
    expect(others.length).toBeGreaterThan(10)
    for (const v of others) expect(phoneViewFor(v)).toBe('home')
  })

  it('names the Calendar "Tasks", because on a phone that is all it shows', () => {
    expect(phoneTitleFor('calendar')).toBe('Tasks')
    expect(phoneTitleFor('outlook')).toBe('Today')
    expect(phoneTitleFor('games')).toBe('Home')
    expect(phoneTitleFor('settings')).toBe('Settings')
  })

  it('only points at views that exist', () => {
    const ids = new Set(MODULE_REGISTRY.map(m => m.id))
    for (const t of PHONE_TABS) expect(ids.has(t.view)).toBe(true)
  })
})
