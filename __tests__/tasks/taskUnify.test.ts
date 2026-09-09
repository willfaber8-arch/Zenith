/**
 * One list, three kinds — the pure rules.
 *
 * Two of these exist because getting them wrong is invisible rather than
 * loud: an undated item reading as overdue, and an orphaned task
 * disappearing into a group that no longer renders. Neither throws.
 * Both just quietly show you the wrong thing.
 */

import {
  kindOf, hasDueDate, isOverdue, isOpen, compareTasks, groupByList, toReminder,
  KIND_BADGE, dueEndOfDayMs, dueStartOfDayMs, type TaskLike,
} from '@/utils/taskUnify'

const task = (o: Partial<TaskLike> = {}): TaskLike => ({
  id: 1, title: 't', dueDate: '', status: 'pending', priority: 'medium', ...o,
})

describe('kinds', () => {
  it('treats an absent kind as a task — that is what every pre-kind row is', () => {
    expect(kindOf({})).toBe('task')
    expect(kindOf({ kind: undefined })).toBe('task')
  })

  it('reads the kinds it knows and ignores anything else', () => {
    expect(kindOf({ kind: 'reminder' })).toBe('reminder')
    expect(kindOf({ kind: 'problem_set' })).toBe('problem_set')
    expect(kindOf({ kind: 'nonsense' })).toBe('task')
  })

  it('gives reminders no badge — labelling the common case is noise', () => {
    expect(KIND_BADGE.reminder).toBe('')
    expect(KIND_BADGE.task).not.toBe('')
  })
})

describe('due dates', () => {
  it('counts the empty string as no deadline', () => {
    expect(hasDueDate({ dueDate: '' })).toBe(false)
    expect(hasDueDate({})).toBe(false)
    expect(hasDueDate({ dueDate: '2026-09-09' })).toBe(true)
  })

  /*
   * The whole reason hasDueDate exists. '' sorts before every real
   * date, so a plain string comparison calls every dateless reminder
   * overdue — and it looks like a real backlog, not like a bug.
   */
  it('does not call an undated task overdue', () => {
    expect('' < '2026-09-09').toBe(true)              // the trap itself
    expect(isOverdue(task({ dueDate: '' }), '2026-09-09')).toBe(false)
  })

  it('still calls a genuinely late task overdue', () => {
    expect(isOverdue(task({ dueDate: '2026-09-08' }), '2026-09-09')).toBe(true)
  })

  it('never calls finished work overdue', () => {
    expect(isOverdue(task({ dueDate: '2026-01-01', status: 'completed' }), '2026-09-09')).toBe(false)
  })
})

describe('ordering', () => {
  it('puts unfinished work above finished', () => {
    const done = task({ id: 1, status: 'completed', dueDate: '2026-01-01' })
    const open = task({ id: 2, dueDate: '2030-01-01' })
    expect([done, open].sort(compareTasks)[0]).toBe(open)
  })

  it('puts dated work above undated', () => {
    const undated = task({ id: 1 })
    const dated   = task({ id: 2, dueDate: '2030-01-01' })
    expect([undated, dated].sort(compareTasks)[0]).toBe(dated)
  })

  it('sorts by deadline before priority — a low-priority thing due today outranks a critical one due next month', () => {
    const soon = task({ id: 1, dueDate: '2026-09-09', priority: 'low' })
    const far  = task({ id: 2, dueDate: '2026-12-01', priority: 'critical' })
    expect([far, soon].sort(compareTasks)[0]).toBe(soon)
  })

  it('falls back to priority when deadlines match', () => {
    const med  = task({ id: 1, dueDate: '2026-09-09', priority: 'medium' })
    const crit = task({ id: 2, dueDate: '2026-09-09', priority: 'critical' })
    expect([med, crit].sort(compareTasks)[0]).toBe(crit)
  })
})

describe('grouping into lists', () => {
  const lists = [{ id: 1, name: 'Short Term' }, { id: 2, name: 'Long Term' }]

  it('files each task under its list', () => {
    const groups = groupByList(
      [task({ id: 1, listId: 1 }), task({ id: 2, listId: 2 })],
      lists,
    )
    expect(groups.map(g => g.list?.name)).toEqual(['Short Term', 'Long Term'])
    expect(groups[0].items).toHaveLength(1)
  })

  it('keeps every list, including empty ones', () => {
    const groups = groupByList([task({ id: 1, listId: 1 })], lists)
    expect(groups).toHaveLength(2)
    expect(groups[1].items).toEqual([])
  })

  it('does not show an unfiled heading when nothing is unfiled', () => {
    const groups = groupByList([task({ id: 1, listId: 1 })], lists)
    expect(groups.some(g => g.list === null)).toBe(false)
  })

  it('gives listless work a home rather than dropping it', () => {
    const groups = groupByList([task({ id: 9 })], lists)
    const unfiled = groups.find(g => g.list === null)
    expect(unfiled?.items.map(i => i.id)).toEqual([9])
  })

  /*
   * A task pointing at a list that was deleted would otherwise be
   * filtered into a group nobody renders: still in the database,
   * invisible in the app, and impossible to get back.
   */
  it('rescues a task whose list no longer exists', () => {
    const groups = groupByList([task({ id: 7, listId: 999 })], lists)
    const unfiled = groups.find(g => g.list === null)
    expect(unfiled?.items.map(i => i.id)).toEqual([7])
  })
})

describe('migrating a to-do item', () => {
  const item = {
    id: 3, categoryId: 2, title: 'Read chapter 3',
    completed: 0 as const, dueDate: '2026-09-20', createdAt: 1_700_000_000_000,
  }

  it('keeps the text, the date and the list it was in', () => {
    const r = toReminder(item)
    expect(r.title).toBe('Read chapter 3')
    expect(r.dueDate).toBe('2026-09-20')
    expect(r.listId).toBe(2)
    expect(r.createdAt).toBe(1_700_000_000_000)
  })

  it('marks it a reminder, so the panels can tell it apart', () => {
    expect(toReminder(item).kind).toBe('reminder')
  })

  it('turns a ticked item into completed work rather than losing the tick', () => {
    expect(toReminder({ ...item, completed: 1 }).status).toBe('completed')
    expect(toReminder(item).status).toBe('pending')
  })

  it('represents a dateless to-do as no deadline, not as an absent field', () => {
    expect(toReminder({ ...item, dueDate: undefined }).dueDate).toBe('')
  })

  /*
   * Not cosmetic. The sync engine only uploads assignments at high or
   * critical priority, so 'medium' is what keeps a list that has only
   * ever lived on this machine from being published to a server by a
   * change that was supposed to be about where you look at it.
   */
  it('lands below the priority that triggers cloud sync', () => {
    expect(toReminder(item).priority).toBe('medium')
  })
})

describe('open work', () => {
  it('counts anything unfinished', () => {
    expect(isOpen({ status: 'pending' })).toBe(true)
    expect(isOpen({ status: 'overdue' })).toBe(true)
    expect(isOpen({ status: 'completed' })).toBe(false)
  })
})

/* ══════════════════════════════════════════════════════════════
   Deadlines as instants
   ══════════════════════════════════════════════════════════════ */

describe('when a date-only deadline passes', () => {
  it('is the end of that day, not the start of it', () => {
    const end = dueEndOfDayMs('2026-09-09')!
    const d = new Date(end)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)      // September
    expect(d.getDate()).toBe(9)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
  })

  /*
   * The bug this replaces. `new Date('2026-09-09')` is UTC midnight —
   * the one date format the spec pins to UTC — so west of Greenwich it
   * lands on the previous evening and the task goes overdue a day
   * early. This asserts the local reading regardless of the runner's
   * zone by comparing against a locally-constructed date.
   */
  it('does not fall on the day before, in any time zone', () => {
    const local = new Date(2026, 8, 9)          // 9 Sep, wherever we are
    const end   = dueEndOfDayMs('2026-09-09')!
    expect(end).toBeGreaterThan(local.getTime())
    expect(end - local.getTime()).toBeLessThan(86_400_000)
  })

  it('starts at local midnight', () => {
    const start = dueStartOfDayMs('2026-09-09')!
    const d = new Date(start)
    expect(d.getDate()).toBe(9)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('has no moment at all when there is no date', () => {
    expect(dueEndOfDayMs('')).toBeNull()
    expect(dueEndOfDayMs(undefined)).toBeNull()
    expect(dueEndOfDayMs('not a date')).toBeNull()
  })
})
