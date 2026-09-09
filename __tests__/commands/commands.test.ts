/**
 * The command palette's list.
 *
 * Two judgements are worth pinning: an empty query shows everything
 * (a palette that is blank until you type teaches nothing about what it
 * can do), and nothing destructive is in the list at all — a list you
 * drive blind at speed, matching on fuzzy text, is the wrong place for
 * an action that cannot be undone.
 */

import { buildCommands, rankCommands, type Command } from '@/lib/commands'

const ctx = () => {
  const navigated: string[] = []
  const opened: string[] = []
  return {
    navigated, opened,
    commands: buildCommands({
      navigate: (v) => navigated.push(v),
      openCopilot: () => opened.push('copilot'),
    }),
  }
}

describe('the list', () => {
  it('is not empty', () => {
    expect(ctx().commands.length).toBeGreaterThan(0)
  })

  it('gives every command a unique id', () => {
    const ids = ctx().commands.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every command something to run', () => {
    for (const c of ctx().commands) expect(typeof c.run).toBe('function')
  })

  /*
   * Deliberate: a palette is driven at speed, from memory, matching on
   * fuzzy text. Anything that cannot be undone stays where you have to
   * look at it — the export, restore and reset controls all live in
   * Settings behind their own confirmations.
   */
  it('offers nothing destructive', () => {
    const dangerous = /delete|remove|reset|wipe|clear|erase|restore/i
    for (const c of ctx().commands) {
      expect(c.label).not.toMatch(dangerous)
    }
  })

  it('takes you to the backup screen rather than backing up for you', () => {
    const { commands, navigated } = ctx()
    const backup = commands.find(c => c.id === 'backup')!
    backup.run()
    expect(navigated).toEqual(['settings'])
  })

  it('runs a non-navigating action', () => {
    const { commands, opened } = ctx()
    commands.find(c => c.id === 'copilot')!.run()
    expect(opened).toEqual(['copilot'])
  })
})

describe('ranking', () => {
  const all = (): Command[] => ctx().commands

  /*
   * A palette that shows nothing until you type cannot teach you what
   * it can do, and finding that out is the first thing most people want
   * from one.
   */
  it('shows everything for an empty query', () => {
    expect(rankCommands(all(), '')).toHaveLength(all().length)
    expect(rankCommands(all(), '   ')).toHaveLength(all().length)
  })

  it('finds a command by its name', () => {
    expect(rankCommands(all(), 'new task')[0].id).toBe('new-task')
  })

  it('finds one by a word someone would reach for instead', () => {
    expect(rankCommands(all(), 'todo')[0].id).toBe('new-task')
    expect(rankCommands(all(), 'export')[0].id).toBe('backup')
    expect(rankCommands(all(), 'streak')[0].id).toBe('habits')
  })

  it('finds the Co-Pilot by "ai"', () => {
    expect(rankCommands(all(), 'ai')[0].id).toBe('copilot')
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(rankCommands(all(), 'xyzzy quantum')).toHaveLength(0)
  })

  it('puts a name match above a keyword match', () => {
    const ranked = rankCommands(all(), 'note')
    expect(ranked[0].id).toBe('new-note')
  })
})
