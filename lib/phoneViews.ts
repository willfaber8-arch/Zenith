/**
 * lib/phoneViews.ts — what Zenith is on a phone.
 *
 * On a phone Zenith is five screens, not twenty-four: Home, Today,
 * Habits, Tasks and Notes, plus Settings behind the avatar. Everything
 * else is for a bigger screen and is simply not reachable from the
 * phone's navigation.
 *
 * The phone never *rewrites* where you are. If the last view you had
 * open on a laptop was the Arcade, the stored navigation still says so;
 * the phone just shows Home for it, and the laptop reopens the Arcade.
 * `phoneViewFor` is that mapping, and it is the only place it lives, so
 * the bottom bar's highlight and the page on screen cannot disagree.
 */

import type { ViewId, CategoryId } from '@/lib/nav-config'

export interface PhoneTab {
  view:     ViewId
  category: CategoryId | null
  label:    string
}

/**
 * The bottom bar, left to right.
 *
 * "Tasks" is the `calendar` view because the Calendar's Tasks tab is the
 * one task list in Zenith (CLAUDE.md rule 92). On a phone that view
 * shows only the list — the week grid is a laptop surface.
 */
export const PHONE_TABS: readonly PhoneTab[] = [
  { view: 'home',     category: null,         label: 'Home'   },
  { view: 'outlook',  category: 'essentials', label: 'Today'  },
  { view: 'habits',   category: 'essentials', label: 'Habits' },
  { view: 'calendar', category: 'essentials', label: 'Tasks'  },
  { view: 'notes',    category: 'vault',      label: 'Notes'  },
]

/** Views a phone will render. Settings is reached from the avatar. */
const PHONE_VIEWS: ReadonlySet<ViewId> = new Set<ViewId>([
  ...PHONE_TABS.map(t => t.view),
  'settings',
])

/** The view a phone actually shows for whatever navigation says. */
export function phoneViewFor(view: ViewId): ViewId {
  return PHONE_VIEWS.has(view) ? view : 'home'
}

/** The title in the phone's top bar. */
export function phoneTitleFor(view: ViewId): string {
  const shown = phoneViewFor(view)
  if (shown === 'settings') return 'Settings'
  return PHONE_TABS.find(t => t.view === shown)?.label ?? 'Home'
}
