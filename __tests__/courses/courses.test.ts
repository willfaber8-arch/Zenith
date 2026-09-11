/**
 * Deleting a course drops the label, never the work filed under it.
 */

import { db, type Assignment } from '@/lib/db'
import { listCourses, deleteCourse } from '@/lib/courses'

beforeEach(async () => {
  await Promise.all([
    db.calendarFeeds.clear(), db.calendarEvents.clear(),
    db.courseIntensityProfiles.clear(), db.gpaCourses.clear(),
    db.assignments.clear(),
  ])
})

async function seedCourse(name: string, campus = 'Cornell', sessions = 3) {
  const feedId = await db.calendarFeeds.add({
    label: `${name} — ${campus}`, url: '', color: '#7c95ff',
    isActive: 1, lastFetchedAt: Date.now(), createdAt: Date.now(),
  } as never) as number
  for (let i = 0; i < sessions; i++) {
    await db.calendarEvents.add({
      feedId, uid: `${name}-${i}`, title: name,
      startMs: Date.now(), endMs: Date.now() + 3_600_000,
      allDay: 0, is1159: 0, category: 'scholastic',
    } as never)
  }
  await db.courseIntensityProfiles.add({
    courseCode: name, courseName: campus,
    mathIntensity: 5, codingIntensity: 5, memorizationIntensity: 5,
    updatedAt: Date.now(),
  } as never)
  const semesterId = await db.gpaSemesters.add({
    name: 'Fall 2026', term: 'fall', year: 2026, displayOrder: 20260, isProjected: 0,
  } as never) as number
  await db.gpaCourses.add({
    semesterId, courseCode: name, courseName: name, credits: 4, grade: 'A',
  } as never)
  return feedId
}

const addTask = (title: string, courseId: string) =>
  db.assignments.add({
    title, dueDate: '', courseId, status: 'pending', priority: 'medium',
    category: 'scholastic', kind: 'task', createdAt: Date.now(), updatedAt: Date.now(),
  } as Assignment) as Promise<number>

describe('finding the courses', () => {
  it('gathers one course from all four places it lives', async () => {
    await seedCourse('MATH 2930')
    await addTask('PSet 4', 'MATH 2930')
    await addTask('PSet 5', 'MATH 2930')

    const [course, ...rest] = await listCourses()
    expect(rest).toEqual([])
    expect(course.code).toBe('MATH 2930')
    expect(course.sessions).toBe(3)
    expect(course.hasProfile).toBe(true)
    expect(course.gpaRows).toBe(1)
    expect(course.tasks).toBe(2)
  })

  it('does not mistake a subscribed calendar for a course', async () => {
    /* A real iCal feed has a url; a generated schedule does not. A dash
       in someone's calendar name must not turn it into a class. */
    await db.calendarFeeds.add({
      label: 'Work — Outlook', url: 'https://example.com/cal.ics', color: '#fff',
      isActive: 1, lastFetchedAt: 0, createdAt: 0,
    } as never)
    expect(await listCourses()).toEqual([])
  })

  it('treats a differently-cased tag as the same course', async () => {
    await seedCourse('PHYS 1112')
    await addTask('Lab report', 'phys 1112')
    const courses = await listCourses()
    expect(courses).toHaveLength(1)
    expect(courses[0].tasks).toBe(1)
  })
})

describe('deleting a course', () => {
  it('removes its sessions, profile and GPA row', async () => {
    await seedCourse('MATH 2930')
    const res = await deleteCourse('MATH 2930')

    expect(res.sessions).toBe(3)
    expect(res.gpaRows).toBe(1)
    expect(res.profile).toBe(true)
    expect(await db.calendarEvents.count()).toBe(0)
    expect(await db.calendarFeeds.count()).toBe(0)
    expect(await db.courseIntensityProfiles.count()).toBe(0)
    expect(await db.gpaCourses.count()).toBe(0)
    expect(await listCourses()).toEqual([])
  })

  /* The point of the whole thing. */
  it('keeps the work and clears its tag', async () => {
    await seedCourse('MATH 2930')
    const keep = await addTask('PSet 4', 'MATH 2930')
    const res  = await deleteCourse('MATH 2930')

    expect(res.tasksUntagged).toBe(1)
    const row = await db.assignments.get(keep)
    expect(row).toBeDefined()
    expect(row?.title).toBe('PSet 4')
    expect(row?.courseId).toBe('')
  })

  it('leaves every other course alone', async () => {
    await seedCourse('MATH 2930')
    await seedCourse('PHYS 1112')
    const other = await addTask('Lab report', 'PHYS 1112')

    await deleteCourse('MATH 2930')

    const left = await listCourses()
    expect(left.map(c => c.code)).toEqual(['PHYS 1112'])
    expect(left[0].sessions).toBe(3)
    expect((await db.assignments.get(other))?.courseId).toBe('PHYS 1112')
  })

  it('does nothing for a course that is not there', async () => {
    await seedCourse('MATH 2930')
    const res = await deleteCourse('NOT A COURSE')
    expect(res).toEqual({ code: 'NOT A COURSE', sessions: 0, gpaRows: 0, profile: false, tasksUntagged: 0 })
    expect(await db.calendarEvents.count()).toBe(3)
  })

  it('ignores an empty code rather than matching untagged work', async () => {
    await addTask('Untagged thing', '')
    const res = await deleteCourse('   ')
    expect(res.tasksUntagged).toBe(0)
    expect(await db.assignments.count()).toBe(1)
  })
})

/*
 * The Co-Pilot writes into the same list the UI does, so it has the
 * same way to get the kind wrong — and it had it: every item it added
 * arrived as a reminder.
 */
describe('what the Co-Pilot adds', () => {
  it('defaults to a task and honours an explicit kind', async () => {
    const { executeCopilotAction } = await import('@/lib/copilotActions')

    await executeCopilotAction({ name: 'add_todo', args: { title: 'Read chapter 3' } })
    await executeCopilotAction({ name: 'add_todo', args: { title: 'PSet 4', kind: 'problem_set', steps: '1, 2, 3' } })
    await executeCopilotAction({ name: 'add_todo', args: { title: 'Bins out', kind: 'reminder', repeat: 'weekly' } })

    const rows = await db.assignments.toArray()
    const by = (t: string) => rows.find(r => r.title === t)

    expect(by('Read chapter 3')?.kind).toBe('task')
    expect(by('PSet 4')?.kind).toBe('problem_set')
    expect(by('PSet 4')?.problems?.map(p => p.label)).toEqual(['1', '2', '3'])
    expect(by('Bins out')?.kind).toBe('reminder')
    expect(by('Bins out')?.repeat).toBe('weekly')
  })

  it('files it under a course when told one', async () => {
    const { executeCopilotAction } = await import('@/lib/copilotActions')
    await executeCopilotAction({ name: 'add_todo', args: { title: 'PSet 5', kind: 'problem_set', course: 'MATH 2930' } })
    const row = (await db.assignments.toArray()).find(r => r.title === 'PSet 5')
    expect(row?.courseId).toBe('MATH 2930')
    /* And it shows up as a course the moment it is used. */
    expect((await listCourses()).map(c => c.code)).toContain('MATH 2930')
  })
})
