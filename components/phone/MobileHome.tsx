'use client'

/**
 * components/phone/MobileHome.tsx — Home on a phone.
 *
 * Four large buttons and nothing else: Today, Habits, Tasks, Notes. The
 * desktop dashboard — search, the biome, the widget grid — is a place to
 * sit and look around, and on a phone it was a long scroll to get past
 * before you could do anything.
 *
 * Each tile carries one live line so it is worth glancing at as well as
 * pressing. None of those numbers is counted here:
 *
 *   · Habits and Tasks read the sidebar's own badges (NavBadgeContext),
 *     which BadgeSyncEffect keeps live whether or not a sidebar is on
 *     screen — so this tile, the desktop sidebar and the Habits page all
 *     say the same thing (CLAUDE.md rule 98).
 *   · Today reads `useTodayAgenda`, the same hook the Today screen draws
 *     its lists from.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/AuthContext'
import { useNav } from '@/lib/NavContext'
import { useNavBadge } from '@/lib/NavBadgeContext'
import { useTodayAgenda } from '@/lib/hooks/useTodayAgenda'
import Icon, { type IconName } from '@/components/ui/Icon'
import type { ViewId, CategoryId } from '@/lib/nav-config'
import styles from './MobileHome.module.css'

interface Tile {
  view:     ViewId
  category: CategoryId | null
  label:    string
  icon:     IconName
  tone:     string
  line:     string
}

function greeting(h: number): string {
  if (h < 5)  return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export default function MobileHome() {
  const { session } = useAuth()
  const { navigate } = useNav()
  const { badges } = useNavBadge()
  const agenda = useTodayAgenda()

  const noteCount = useLiveQuery(
    () => db?.quickNotes.filter(n => n.archived !== 1).count() ?? Promise.resolve(0),
    [],
  )

  const ring  = badges.habits?.kind === 'ring'  ? badges.habits   : null
  const tasks = badges.calendar?.kind === 'count' ? badges.calendar.count : null

  const todayLine = !agenda.loaded ? ' '
    : agenda.tasks.length === 0 && agenda.events.length === 0 ? 'Nothing scheduled'
    : [
        agenda.tasks.length  ? `${agenda.tasks.length} due` : null,
        agenda.events.length ? plural(agenda.events.length, 'event') : null,
      ].filter(Boolean).join(' · ')

  /* The ring is removed rather than set to 0/0 when nothing is due
     (NavBadgeContext), so no ring means no habits today. */
  const habitLine = !ring || ring.total === 0 ? 'None due today'
    : ring.done >= ring.total  ? 'All done today'
    : `${ring.done} of ${ring.total} done`

  /* Same convention as the ring: a zero count removes the badge. */
  const taskLine = !tasks ? 'All clear' : `${tasks} open`

  const noteLine = noteCount == null ? ' '
    : noteCount === 0 ? 'Write something down'
    : plural(noteCount, 'note')

  const tiles: Tile[] = [
    { view: 'outlook',  category: 'essentials', label: 'Today',  icon: 'sun',       tone: 'var(--accent-warm)',   line: todayLine },
    { view: 'habits',   category: 'essentials', label: 'Habits', icon: 'check',     tone: 'var(--accent-green)',  line: habitLine },
    { view: 'calendar', category: 'essentials', label: 'Tasks',  icon: 'clipboard', tone: 'var(--accent-purple)', line: taskLine  },
    { view: 'notes',    category: 'vault',      label: 'Notes',  icon: 'note',      tone: 'var(--text-muted)',    line: noteLine  },
  ]

  const now  = new Date()
  const name = session?.userHandle
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className={styles.home}>
      <header className={styles.head}>
        <p className={styles.hello}>{greeting(now.getHours())}{name ? `, ${name}` : ''}</p>
        <p className={styles.date}>{date}</p>
      </header>

      <nav className={styles.grid} aria-label="Home">
        {tiles.map(t => (
          <button
            key={t.view}
            type="button"
            className={styles.tile}
            style={{ '--tile': t.tone } as React.CSSProperties}
            onClick={() => navigate(t.view, t.category)}
          >
            <span className={styles.icon} aria-hidden="true"><Icon name={t.icon} size={26} /></span>
            <span className={styles.text}>
              <span className={styles.label}>{t.label}</span>
              <span className={styles.line}>{t.line}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
