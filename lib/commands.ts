'use client'

/**
 * lib/commands.ts — the things you can do, as a list.
 *
 * Zenith has four keyboard shortcuts and thirty-odd modules. Everything
 * else — making a task, exporting a backup, taking a snapshot — is
 * reachable only by knowing which screen it lives on and going there.
 * That is fine when you are exploring and slow when you already know
 * what you want.
 *
 * A command is a name, some words people might reach for instead of
 * that name, and a function. Building the list is separated from
 * showing it so the ranking can be tested against strings rather than
 * against a rendered overlay.
 */

import type { ViewId, CategoryId } from '@/lib/nav-config'
import { scoreMatch } from '@/utils/searchRank'

export type CommandGroup = 'action' | 'module'

export interface Command {
  id:       string
  label:    string
  /** Shown under the label — what it does, not how. */
  hint?:    string
  group:    CommandGroup
  /** Words someone might type instead of the label. */
  keywords: string[]
  run:      () => void | Promise<void>
}

/** What the palette needs from the app to build its actions. */
export interface CommandContext {
  navigate: (view: ViewId, category: CategoryId | null) => void
  /** Opens the AI Co-Pilot panel. */
  openCopilot: () => void
}

/**
 * The actions, as opposed to the places.
 *
 * Deliberately short. A palette listing everything is a menu with worse
 * ergonomics — its value is that the few things you do constantly are
 * one keystroke away, and every entry that is not one of those makes
 * those harder to find.
 *
 * Anything destructive is absent on purpose: a list you drive blind at
 * speed, matching on fuzzy text, is the wrong place to put an action
 * that cannot be undone.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const go = (id: string, label: string, view: ViewId, category: CategoryId | null,
              hint: string, keywords: string[]): Command => ({
    id, label, hint, group: 'action', keywords, run: () => ctx.navigate(view, category),
  })

  return [
    go('new-task', 'New task', 'calendar', 'essentials',
       'Opens the task list', ['todo', 'add', 'reminder', 'chore']),
    go('new-note', 'New note', 'notes', 'vault',
       'Opens Notes', ['write', 'jot', 'scratch']),
    go('today', 'What is on today', 'outlook', 'essentials',
       'Daily Outlook — agenda, habits, weather', ['agenda', 'daily', 'schedule', 'morning']),
    go('habits', 'Tick a habit', 'habits', 'essentials',
       'Opens Habits', ['streak', 'daily', 'routine']),
    go('backup', 'Back up my data', 'settings', null,
       'Settings — export a file or take a snapshot', ['export', 'save', 'snapshot', 'restore']),
    go('shortcuts', 'Keyboard shortcuts', 'settings', null,
       'Settings — the shortcuts list', ['keys', 'help', 'hotkeys']),
    {
      id: 'copilot', label: 'Ask the Co-Pilot', hint: 'Opens the AI panel',
      group: 'action', keywords: ['ai', 'chat', 'assistant', 'help'],
      run: () => ctx.openCopilot(),
    },
  ]
}

/**
 * Ranks commands against what has been typed.
 *
 * An empty query returns the list as authored rather than nothing: a
 * palette that is blank until you type teaches nothing about what it
 * can do, and the first thing most people want from one is to find out.
 */
export function rankCommands(commands: readonly Command[], query: string): Command[] {
  const q = query.trim()
  if (!q) return [...commands]

  return commands
    .map(c => ({ c, score: scoreMatch(q, c.label, `${c.hint ?? ''} ${c.keywords.join(' ')}`) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c)
}
