/**
 * lib/courses.ts — one course, four places that know about it.
 *
 * A course in Zenith is a string that four unrelated tables happen to
 * agree on:
 *
 *   calendarFeeds + calendarEvents   the generated class sessions
 *   courseIntensityProfiles          its workload estimate
 *   gpaCourses                       its credits and grade
 *   assignments.courseId             the tag on work filed under it
 *
 * Nothing joined them, so dropping a course meant finding it four times
 * and remembering the fourth — and the schedule generator registers two
 * of them in one go, which makes forgetting the rest easy. This is the
 * one place that knows the whole set.
 *
 * The rule on deletion: a course is an organising label, and removing a
 * label is not a decision to throw away the work filed under it. Class
 * sessions, the workload profile and the GPA row go, because they only
 * exist to describe the course. Tasks and problem sets stay and lose
 * their tag.
 */

import { db, type Assignment } from '@/lib/db'

/** Everything Zenith knows about one course, and where. */
export interface CourseSummary {
  /** The course's name — the string all four tables key on. */
  code:      string
  /** Generated class sessions, and the feed holding them. */
  feedId?:   number
  sessions:  number
  /** Whether a workload profile exists for it. */
  hasProfile: boolean
  /** GPA rows carrying this code. */
  gpaRows:   number
  /** Open + finished tasks tagged with it. */
  tasks:     number
}

export interface CourseDeletion {
  code:         string
  sessions:     number
  gpaRows:      number
  profile:      boolean
  tasksUntagged: number
}

/** Case- and space-insensitive, because these are typed in four places. */
function norm(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * Every course Zenith knows about, whichever table introduced it.
 *
 * Gathered rather than stored: there is no course table, and adding one
 * now would leave every existing install with an empty list beside a
 * calendar full of classes.
 */
export async function listCourses(): Promise<CourseSummary[]> {
  if (!db) return []

  const [feeds, profiles, gpaRows, tasks] = await Promise.all([
    db.calendarFeeds.toArray(),
    db.courseIntensityProfiles.toArray(),
    db.gpaCourses.toArray(),
    db.assignments.toArray(),
  ])

  const byCode = new Map<string, CourseSummary>()
  const ensure = (code: string): CourseSummary => {
    const key = norm(code)
    let row = byCode.get(key)
    if (!row) {
      row = { code: code.trim(), sessions: 0, hasProfile: false, gpaRows: 0, tasks: 0 }
      byCode.set(key, row)
    }
    return row
  }

  /*
   * A generated feed is labelled "<course> — <campus>" and has no url,
   * which is what separates it from a subscribed iCal calendar. Taking
   * the part before the dash recovers the course; requiring an empty
   * url keeps a real subscription with a dash in its name out of this.
   */
  for (const f of feeds) {
    if (f.url !== '' || f.id == null) continue
    const code = f.label.split('—')[0]?.trim()
    if (!code) continue
    const row = ensure(code)
    row.feedId = f.id
  }

  if (byCode.size > 0) {
    const events = await db.calendarEvents.toArray()
    for (const e of events) {
      for (const row of byCode.values()) {
        if (row.feedId != null && e.feedId === row.feedId) { row.sessions += 1; break }
      }
    }
  }

  for (const p of profiles)  ensure(p.courseCode).hasProfile = true
  for (const g of gpaRows)   ensure(g.courseCode).gpaRows   += 1
  for (const a of tasks) {
    const tag = (a as Assignment).courseId
    if (tag && tag.trim()) ensure(tag).tasks += 1
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Remove a course everywhere it is known, keeping the work filed under it.
 *
 * One transaction: a course half-deleted — sessions gone but still in
 * the GPA table, or a workload profile for a class that no longer
 * exists — is worse than either outcome, and is exactly what four
 * separate deletes produce when the third one throws.
 */
export async function deleteCourse(code: string): Promise<CourseDeletion> {
  const empty: CourseDeletion = {
    code, sessions: 0, gpaRows: 0, profile: false, tasksUntagged: 0,
  }
  if (!db || !code.trim()) return empty

  const target = norm(code)
  const summary = (await listCourses()).find(c => norm(c.code) === target)
  if (!summary) return empty

  return db.transaction('rw',
    [db.calendarFeeds, db.calendarEvents, db.courseIntensityProfiles,
     db.gpaCourses, db.assignments],
    async () => {
      let sessions = 0
      if (summary.feedId != null) {
        sessions = await db.calendarEvents.where('feedId').equals(summary.feedId).delete()
        await db.calendarFeeds.delete(summary.feedId)
      }

      const profiles = await db.courseIntensityProfiles.toArray()
      const profileIds = profiles
        .filter(p => norm(p.courseCode) === target)
        .map(p => p.id)
        .filter((id): id is number => id != null)
      if (profileIds.length > 0) await db.courseIntensityProfiles.bulkDelete(profileIds)

      const gpa = await db.gpaCourses.toArray()
      const gpaIds = gpa
        .filter(g => norm(g.courseCode) === target)
        .map(g => g.id)
        .filter((id): id is number => id != null)
      if (gpaIds.length > 0) await db.gpaCourses.bulkDelete(gpaIds)

      /*
       * The work stays. Clearing the tag rather than deleting the row is
       * the whole point: a course is a label, and dropping a label is
       * not a decision to throw away the essays filed under it.
       */
      const tagged = (await db.assignments.toArray())
        .filter(a => (a.courseId ?? '').trim() && norm(a.courseId) === target)
      if (tagged.length > 0) {
        await db.assignments.bulkUpdate(
          tagged.map(a => ({ key: a.id as number, changes: { courseId: '', updatedAt: Date.now() } })),
        )
      }

      return {
        code:          summary.code,
        sessions,
        gpaRows:       gpaIds.length,
        profile:       profileIds.length > 0,
        tasksUntagged: tagged.length,
      }
    })
}
