'use client'

import { useEffect, useState } from 'react'
import { useLiveQuery }        from 'dexie-react-hooks'
import { useAuth }             from '@/lib/AuthContext'
import { db }                  from '@/lib/db'
import styles from './GreetingHero.module.css'

function getPeriod(hour: number): string {
  if (hour >= 5  && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  })
}

export default function GreetingHero() {
  const { session } = useAuth()

  /*
   * Hydrate userName from the local userProfile DB record.
   * Falls back to the auth session handle if the profile hasn't
   * been seeded yet (first-load race condition).
   */
  const profile = useLiveQuery(
    async () => (db ? db.userProfile.get(1) : undefined),
    [],
  )
  const userName =
    profile?.userName ?? session?.userHandle ?? '—'

  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const greeting = now ? getPeriod(now.getHours()) : 'Good evening'
  const timeStr  = now ? fmtTime(now) : '  :  '
  const dateStr  = now ? fmtDate(now) : ' '

  return (
    <section className={styles.hero} aria-label="Home greeting">

      {/* ── Greeting text ─────────────────────────────────── */}
      <div className={`${styles.greetingWrap} anim-scale-in`}>
        <p className={styles.salutation}>{greeting},</p>
        <p className={styles.name}>{userName}.</p>
      </div>

      {/* ── Time · Date · Weather meta row ────────────────── */}
      <div className={`${styles.metaBar} anim-fade-in delay-2`}>
        <time className={styles.clock} suppressHydrationWarning>
          {timeStr}
        </time>
        <span className={styles.dot} aria-hidden="true" />
        <time className={styles.dateLine} suppressHydrationWarning>
          {dateStr}
        </time>
        <span className={styles.dot} aria-hidden="true" />
        {/* Weather slot — wired to Open-Meteo in a later step */}
        <span className={styles.weather} aria-label="Weather">— °C</span>
      </div>

    </section>
  )
}
