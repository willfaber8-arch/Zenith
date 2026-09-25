'use client'

/**
 * components/phone/MobileToday.tsx — today, on one phone screen.
 *
 * Three things and only three: the habits still to do, the tasks due,
 * and the events on the calendar. Each can be acted on where it sits —
 * a habit ticked, a task checked off — without going to its own page.
 *
 * Nothing here has rules of its own. Habits come from `useHabits` and a
 * tap goes through its `increment`, the same engine the Habits page and
 * every auto-linked tracker use, so a tick here counts towards streaks
 * exactly as one there does. Tasks and events come from
 * `useTodayAgenda`, and a task is ticked with `setDone`, which is what
 * moves a repeating task to its next date instead of finishing it.
 *
 * The screen never scrolls as a whole. Each section is a card whose list
 * scrolls inside it when there is more than fits, and the three share
 * the height in proportion to what they hold.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, type Assignment } from '@/lib/db'
import { useHabits } from '@/lib/hooks/useHabits'
import { useTodayAgenda, type AgendaEvent } from '@/lib/hooks/useTodayAgenda'
import { setDone } from '@/lib/taskMutations'
import { isHabitScheduledOn, isSkippedOn } from '@/utils/habitSchedule'
import { formatAmount } from '@/utils/habitAmount'
import { toLocalDateStr } from '@/utils/localDate'
import { playHabitProgress } from '@/lib/habitSounds'
import type { HabitTapUndo } from '@/lib/habitSync'
import { useToast } from '@/lib/ToastContext'
import HoldToConfirm from '@/components/ui/HoldToConfirm'
import Icon from '@/components/ui/Icon'
import styles from './MobileToday.module.css'

const RING_R    = 9
const RING_CIRC = 2 * Math.PI * RING_R

function timeLabel(e: AgendaEvent, dayStart: number): string {
  if (e.allDay) return 'All day'
  if (e.startMs < dayStart) return 'Ongoing'
  return new Date(e.startMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dueLabel(dueDate: string, today: string): string {
  if (dueDate === today) return 'Today'
  const [y, m, d] = dueDate.split('-').map(Number)
  const when = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `Overdue · ${when}`
}

export default function MobileToday() {
  const { toast } = useToast()
  const { habits, today, doneCount, scheduledCount, increment, undoTap } = useHabits()
  const agenda = useTodayAgenda()
  const calendarToday = toLocalDateStr(new Date())
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

  /*
   * The last tap on each habit, so a mis-tap can be taken back.
   *
   * Same shape and same rules as the Habits page (CLAUDE.md rule 97):
   * only the most recent tap, only for the day it was made, undone by
   * holding rather than tapping. Kept here rather than shared because
   * it is deliberately ephemeral — leaving the screen forgets it.
   */
  const [lastTap, setLastTap] = useState<Map<number, HabitTapUndo>>(new Map())
  useEffect(() => { setLastTap(new Map()) }, [today])

  /*
   * Habits finished on this visit stay on the list, ticked, until you
   * leave. Otherwise the row you just pressed vanishes under your thumb
   * and the undo for it goes with it.
   */
  const [finishedHere, setFinishedHere] = useState<Set<number>>(new Set())

  const todo = useMemo(() => habits.filter(h =>
    isHabitScheduledOn(h, today)
    && !isSkippedOn(h, today)
    /* A limit is not something to tick off — logging one more coffee from
       a glance screen is how you go over it by accident. They live on the
       Habits page. */
    && (h.goalType ?? 'at_least') !== 'at_most'
    && (!h.todayDone || finishedHere.has(h.id)),
  ), [habits, today, finishedHere])

  const tap = useCallback(async (habitId: number) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit || habit.todayDone) return
    const result = await increment(habitId)
    if (!result) return
    const snap = result.undo
    if (snap) setLastTap(prev => new Map(prev).set(habitId, snap))
    playHabitProgress(result, habit.targetCompletions, habit.goalType ?? 'at_least')
    if (result.completedNow) {
      setFinishedHere(prev => new Set(prev).add(habitId))
      toast(`${habit.name} — done for today`, 'success')
    }
  }, [habits, increment, toast])

  const undo = useCallback(async (habitId: number) => {
    const snap = lastTap.get(habitId)
    if (!snap) return
    await undoTap(snap)
    setLastTap(prev => { const n = new Map(prev); n.delete(habitId); return n })
    setFinishedHere(prev => { const n = new Set(prev); n.delete(habitId); return n })
  }, [lastTap, undoTap])

  /*
   * Ticking a task takes it off this screen, so the toast carries the
   * way back. It restores the exact row captured before the write —
   * for a repeating task that means its original due date too, which
   * re-deriving it by "unticking" would get wrong.
   */
  const tickTask = useCallback(async (task: Assignment) => {
    if (!db || task.id == null) return
    const before = await db.assignments.get(task.id)
    const moved = await setDone(task, true)
    const restore = before
      ? { label: 'Undo', run: async () => { await db.assignments.put(before) } }
      : undefined
    toast(
      moved ? `“${task.title}” — next due ${moved.repeatedTo}` : `Done: ${task.title}`,
      'success',
      restore,
    )
  }, [toast])

  const pct = scheduledCount > 0 ? Math.min(1, doneCount / scheduledCount) : 0
  const allDone = scheduledCount > 0 && doneCount >= scheduledCount

  return (
    <div className={styles.today}>

      {/* ── Habits ────────────────────────────────────────── */}
      <section className={styles.card} aria-labelledby="today-habits">
        <header className={styles.cardHead}>
          <span className={`${styles.ring} ${allDone ? styles.ringFull : ''}`} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r={RING_R} fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
              {pct > 0 && (
                <circle
                  cx="11" cy="11" r={RING_R} fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray={`${RING_CIRC * pct} ${RING_CIRC}`}
                  transform="rotate(-90 11 11)"
                />
              )}
            </svg>
          </span>
          <h2 id="today-habits" className={styles.cardTitle}>Habits</h2>
          <span className={styles.cardCount}>
            {scheduledCount === 0 ? 'none today' : `${doneCount}/${scheduledCount}`}
          </span>
        </header>

        {todo.length === 0 ? (
          <p className={styles.empty}>
            {scheduledCount === 0 ? 'Nothing scheduled today.' : 'All done for today.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {todo.map(h => {
              const done = h.todayDone
              const frac = h.targetCompletions > 0 ? Math.min(1, h.todayCount / h.targetCompletions) : 0
              const unit = h.stepLabel ? ` ${h.stepLabel}` : ''
              return (
                <li
                  key={h.id}
                  className={`${styles.row} ${done ? styles.rowDone : ''}`}
                  style={{ '--habit': h.color ?? 'var(--accent-purple)' } as React.CSSProperties}
                >
                  <span className={styles.habitBar} aria-hidden="true">
                    <span className={styles.habitFill} style={{ transform: `scaleY(${frac})` }} />
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{h.name}</span>
                    <span className={styles.rowMeta}>
                      {formatAmount(h.todayCount)}/{formatAmount(h.targetCompletions)}{unit}
                    </span>
                  </span>
                  {h.todayCount > 0 && lastTap.has(h.id) && (
                    <HoldToConfirm
                      onConfirm={() => undo(h.id)}
                      label={`Hold to undo the last tap on ${h.name}`}
                      title="Hold to undo your last tap"
                      icon={<Icon name="reset" size={14} />}
                      className={styles.undoBtn}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.tapBtn}
                    onClick={() => void tap(h.id)}
                    disabled={done}
                    aria-label={done ? `${h.name} done` : `Add progress to ${h.name}`}
                  >
                    <Icon name={done ? 'check' : 'plus'} size={20} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Tasks due ─────────────────────────────────────── */}
      <section className={styles.card} aria-labelledby="today-tasks">
        <header className={styles.cardHead}>
          <span className={styles.headIcon} aria-hidden="true"><Icon name="clipboard" size={18} /></span>
          <h2 id="today-tasks" className={styles.cardTitle}>Due</h2>
          {agenda.overdue > 0 && <span className={styles.overdue}>{agenda.overdue} overdue</span>}
          <span className={styles.cardCount}>{agenda.loaded ? agenda.tasks.length : ''}</span>
        </header>

        {agenda.loaded && agenda.tasks.length === 0 ? (
          <p className={styles.empty}>Nothing due today.</p>
        ) : (
          <ul className={styles.list}>
            {agenda.tasks.map(t => (
              <li key={t.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.check}
                  onClick={() => void tickTask(t)}
                  aria-label={`Mark "${t.title}" done`}
                >
                  <span className={styles.checkBox} aria-hidden="true" />
                </button>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t.title}</span>
                  <span className={`${styles.rowMeta} ${t.dueDate < calendarToday ? styles.metaLate : ''}`}>
                    {dueLabel(t.dueDate, calendarToday)}
                    {t.courseId ? ` · ${t.courseId}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Events ────────────────────────────────────────── */}
      <section className={styles.card} aria-labelledby="today-events">
        <header className={styles.cardHead}>
          <span className={styles.headIcon} aria-hidden="true"><Icon name="calendar" size={18} /></span>
          <h2 id="today-events" className={styles.cardTitle}>Events</h2>
          <span className={styles.cardCount}>{agenda.loaded ? agenda.events.length : ''}</span>
        </header>

        {agenda.loaded && agenda.events.length === 0 ? (
          <p className={styles.empty}>No events today.</p>
        ) : (
          <ul className={styles.list}>
            {agenda.events.map(e => (
              <li key={e.key} className={styles.row}>
                <span className={styles.eventTime}>{timeLabel(e, dayStart)}</span>
                <span className={styles.eventBar} style={{ background: e.color }} aria-hidden="true" />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{e.title}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
