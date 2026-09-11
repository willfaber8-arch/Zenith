'use client'

/**
 * The courses Zenith knows about, and a way to remove one.
 *
 * Generating a class schedule writes to three tables at once and tagging
 * a task writes to a fourth, so a course you no longer take could be
 * dropped from the calendar and still be sitting in the GPA table and
 * the workload forecast. This lists them together and deletes them
 * together.
 *
 * What it deliberately does not delete: the work. A course is an
 * organising label, and dropping a label is not a decision to throw
 * away the essays filed under it — those keep their titles, dates and
 * steps, and lose the tag. The confirmation says so, with counts, since
 * "delete MATH 2930" reads like it might take the problem sets too.
 */

import { useCallback, useEffect, useState } from 'react'

import ConfirmDelete from '@/components/ui/ConfirmDelete'
import { listCourses, deleteCourse, type CourseSummary } from '@/lib/courses'
import { useToast } from '@/lib/ToastContext'

import styles from './CourseManager.module.css'

/** "3 sessions · 1 GPA row · 2 tasks" — only the parts that exist. */
function describe(c: CourseSummary): string {
  const bits: string[] = []
  if (c.sessions > 0)  bits.push(`${c.sessions} class ${c.sessions === 1 ? 'session' : 'sessions'}`)
  if (c.hasProfile)    bits.push('workload profile')
  if (c.gpaRows > 0)   bits.push(`${c.gpaRows} GPA ${c.gpaRows === 1 ? 'row' : 'rows'}`)
  if (c.tasks > 0)     bits.push(`${c.tasks} ${c.tasks === 1 ? 'task' : 'tasks'}`)
  return bits.length > 0 ? bits.join(' · ') : 'nothing attached'
}

export default function CourseManager() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null)
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    setCourses(await listCourses())
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const remove = async (code: string) => {
    const res = await deleteCourse(code)
    await refresh()
    toast(
      res.tasksUntagged === 0
        ? `${res.code} removed.`
        : `${res.code} removed — ${res.tasksUntagged} ${res.tasksUntagged === 1 ? 'task kept its' : 'tasks kept their'} title and lost the course tag.`,
      'info',
    )
  }

  if (courses === null) return null

  if (courses.length === 0) {
    return (
      <div className={styles.block}>
        <h3 className={styles.heading}>Your courses</h3>
        <p className={styles.empty}>
          None yet. Generate a schedule above, or tag a task with a course,
          and it will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.block}>
      <h3 className={styles.heading}>Your courses</h3>
      <p className={styles.subtitle}>
        Removing one takes its class sessions off the calendar along with its
        workload profile and GPA row. Anything you filed under it keeps its
        title and dates, and loses the course tag.
      </p>

      <ul className={styles.list}>
        {courses.map(c => (
          <li key={c.code} className={styles.row}>
            <span className={styles.code}>{c.code}</span>
            <span className={styles.detail}>{describe(c)}</span>
            <ConfirmDelete
              label={c.code}
              question={c.tasks > 0
                ? `${c.tasks} ${c.tasks === 1 ? 'task is' : 'tasks are'} kept.`
                : undefined}
              onConfirm={() => remove(c.code)}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
