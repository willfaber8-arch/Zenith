'use client'

import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { gamesDb }      from '@/lib/gamesDb'
import { calcGpa }      from '@/utils/gpaMath'
import { useNav }       from '@/lib/NavContext'
import { requestGamesTab } from '@/lib/gamesNavState'
import EcosystemWrapped from '@/components/EcosystemWrapped'
import styles from './StatsView.module.css'

/* ─────────────────────────────────────────────────────────────── */

function StatChip({
  label, value, accent,
}: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`${styles.statChip} ${accent ? styles.statChipAccent : ''}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function StatsView() {
  const [showWrapped, setShowWrapped] = useState(false)
  const { navigate } = useNav()

  /* ── Live IDB data ────────────────────────────────────────── */
  const habits     = useLiveQuery(() => db.habits.toArray(),     []) ?? []
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), []) ?? []
  const sessions   = useLiveQuery(() => db.pomodoroSessions.toArray(), []) ?? []
  const events     = useLiveQuery(() => db.calendarEvents.toArray(), []) ?? []
  const semesters  = useLiveQuery(() => db.gpaSemesters.toArray(),  []) ?? []
  const courses    = useLiveQuery(() => db.gpaCourses.toArray(),    []) ?? []
  const resources  = useLiveQuery(() => gamesDb?.resource_inventory.toArray(), []) ?? []
  const vocabCards = useLiveQuery(() => db.vocab_cards.toArray(),   []) ?? []
  const gamesProfile = useLiveQuery(() => gamesDb?.user_profile_config.get('active_user'), [])

  /* Analytics Vault perk gate */
  const hasVault = (gamesProfile?.unlockedPerks ?? []).includes('perk_extra_stats')

  const goToShop = () => { requestGamesTab('shop'); navigate('games', 'creator') }

  /* ── Computed habit stats ─────────────────────────────────── */
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayCompletions = completions.filter(c => c.date === todayISO)
  const habitsCompletedToday = habits.filter(h =>
    todayCompletions.find(c => c.habitId === h.id && c.count >= (h.targetCompletions ?? 1)),
  ).length
  const topStreak = habits.reduce((max, h) => Math.max(max, h.streakCount ?? 0), 0)

  /* ── Computed study stats ─────────────────────────────────── */
  const weekAgo     = Date.now() - 7 * 86_400_000
  const weekSessions = sessions.filter(s => s.completedAt >= weekAgo && s.sessionType === 'work')
  const totalFocusMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 25), 0)
  const focusHours  = (totalFocusMinutes / 60).toFixed(1)

  /* ── Computed GPA ────────────────────────────────────────────*/
  const allCourses = courses.filter(c => {
    const sem = semesters.find(s => s.id === c.semesterId)
    return sem && !sem.isProjected
  })
  const gpaResult  = allCourses.length > 0 ? calcGpa(allCourses) : null

  /* ── Computed economy stats ──────────────────────────────── */
  const cpBalance = resources.find(r => r.id === 'cosmetic_points')?.balance ?? 0
  const totalHarvested = resources
    .filter(r => ['raw_data_shards', 'organic_spores', 'cosmic_dust'].includes(r.id))
    .reduce((sum, r) => sum + (r.totalEarnedLifetime ?? 0), 0)

  /* ── Vocab stats ─────────────────────────────────────────── */
  const vocabMastered = vocabCards.filter(c => c.reviewIntervalDays >= 21).length
  const vocabDue      = vocabCards.filter(c => c.nextReviewTimestamp <= Date.now()).length

  /* ── Extended analytics (Analytics Vault perk) ───────────── */
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayCounts = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0]
    for (const c of completions) {
      const d = new Date(c.date + 'T12:00:00')
      if (!isNaN(d.getTime())) arr[d.getDay()] += 1
    }
    return arr
  }, [completions])
  const maxWeekday        = Math.max(1, ...weekdayCounts)
  const totalCompletions  = completions.length
  const allTimeFocusMin   = sessions
    .filter(s => s.sessionType === 'work')
    .reduce((s, x) => s + (x.durationMinutes ?? 25), 0)
  const allTimeFocusHours = (allTimeFocusMin / 60).toFixed(1)
  const bestEverStreak    = habits.reduce(
    (m, h) => Math.max(m, h.allTimeHighStreak ?? h.streakCount ?? 0), 0,
  )
  const twoWeeksAgo       = Date.now() - 14 * 86_400_000
  const prevWeekMin       = sessions
    .filter(s => s.sessionType === 'work' && s.completedAt >= twoWeeksAgo && s.completedAt < weekAgo)
    .reduce((s, x) => s + (x.durationMinutes ?? 25), 0)
  const wowDeltaMin       = totalFocusMinutes - prevWeekMin
  const busiestDayIdx     = weekdayCounts.indexOf(Math.max(...weekdayCounts))

  /* ── Upcoming events ─────────────────────────────────────── */
  const now     = Date.now()
  const nextWeek = now + 7 * 86_400_000
  const upcomingEvents = events
    .filter(e => e.startMs >= now && e.startMs <= nextWeek)
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, 5)

  function fmtEventDate(ms: number): string {
    return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className={styles.root}>
      {/* ── Annual review trigger ─────────────────────────────── */}
      <button
        type="button"
        className={styles.wrappedBtn}
        onClick={() => setShowWrapped(true)}
        aria-label="Open annual Ecosystem Wrapped review"
      >
        ◈ Annual Ecosystem Review
      </button>

      {/* ── Overview row ──────────────────────────────────────── */}
      <div className={styles.overviewRow}>
        <StatChip label="Habits Active"       value={habits.length}              />
        <StatChip label="Done Today"          value={`${habitsCompletedToday}/${habits.length}`} accent />
        <StatChip label="Best Streak"         value={`${topStreak}d`}            />
        <StatChip label="Focus This Week"     value={`${focusHours}h`}           />
        <StatChip label="Sessions (7d)"       value={weekSessions.length}        />
        {gpaResult && (
          <StatChip label="Cumulative GPA"    value={gpaResult.gpa.toFixed(2)}   accent />
        )}
        <StatChip label="✦ Credits"           value={cpBalance.toLocaleString()} />
        <StatChip label="Resources Harvested" value={totalHarvested.toLocaleString()} />
        {vocabMastered > 0 && (
          <StatChip label="Vocab Mastered" value={vocabMastered} accent />
        )}
        {vocabDue > 0 && (
          <StatChip label="Vocab Due Today" value={vocabDue} />
        )}
      </div>

      <div className={styles.grid}>

        {/* ── Habit breakdown ───────────────────────────────────── */}
        <SectionCard title="Habits">
          {habits.length === 0 ? (
            <p className={styles.empty}>No habits tracked yet.</p>
          ) : (
            <div className={styles.habitList}>
              {[...habits]
                .sort((a, b) => (b.streakCount ?? 0) - (a.streakCount ?? 0))
                .slice(0, 8)
                .map(h => {
                  const tc  = todayCompletions.find(c => c.habitId === h.id)
                  const pct = Math.min(100, Math.round(((tc?.count ?? 0) / (h.targetCompletions ?? 1)) * 100))
                  return (
                    <div key={h.id} className={styles.habitRow}>
                      <div
                        className={styles.habitDot}
                        style={{ background: h.color ?? 'var(--accent-purple)' }}
                      />
                      <span className={styles.habitName}>{h.name}</span>
                      <div className={styles.habitBar}>
                        <div
                          className={styles.habitBarFill}
                          style={{
                            width: `${pct}%`,
                            background: h.color ?? 'var(--accent-purple)',
                          }}
                        />
                      </div>
                      <span className={styles.habitPct}>{pct}%</span>
                      <span className={styles.habitStreak}>🔥 {h.streakCount ?? 0}d</span>
                    </div>
                  )
                })}
            </div>
          )}
        </SectionCard>

        {/* ── Study analytics ───────────────────────────────────── */}
        <SectionCard title="Study Sessions">
          <div className={styles.studyStats}>
            <div className={styles.studyStat}>
              <span className={styles.studyStatNum}>{weekSessions.length}</span>
              <span className={styles.studyStatLabel}>Sessions this week</span>
            </div>
            <div className={styles.studyStat}>
              <span className={styles.studyStatNum}>{focusHours}h</span>
              <span className={styles.studyStatLabel}>Focus time (7d)</span>
            </div>
            <div className={styles.studyStat}>
              <span className={styles.studyStatNum}>
                {weekSessions.length > 0
                  ? Math.round(totalFocusMinutes / weekSessions.length)
                  : 0}m
              </span>
              <span className={styles.studyStatLabel}>Avg session length</span>
            </div>
            <div className={styles.studyStat}>
              <span className={styles.studyStatNum}>{sessions.length}</span>
              <span className={styles.studyStatLabel}>Total sessions ever</span>
            </div>
          </div>
        </SectionCard>

        {/* ── Upcoming events ───────────────────────────────────── */}
        <SectionCard title="Upcoming Events (7 days)">
          {upcomingEvents.length === 0 ? (
            <p className={styles.empty}>No events in the next 7 days.</p>
          ) : (
            <div className={styles.eventList}>
              {upcomingEvents.map(ev => (
                <div key={ev.id} className={styles.eventRow}>
                  <span className={styles.eventDate}>{fmtEventDate(ev.startMs)}</span>
                  <span className={styles.eventTitle}>{ev.title}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Arcade economy ────────────────────────────────────── */}
        <SectionCard title="Arcade Economy">
          <div className={styles.studyStats}>
            {resources.map(r => (
              <div key={r.id} className={styles.studyStat}>
                <span className={styles.studyStatNum}>{r.balance.toLocaleString()}</span>
                <span className={styles.studyStatLabel}>{r.name}</span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>

      {/* ── Extended Analytics (Analytics Vault perk) ─────────── */}
      {hasVault ? (
        <div className={styles.vaultSection}>
          <div className={styles.vaultHeader}>
            <h2 className={styles.cardTitle}>Extended Analytics</h2>
            <span className={styles.vaultBadge}>◎ Vault Unlocked</span>
          </div>

          <div className={styles.grid}>
            {/* All-time totals */}
            <SectionCard title="All-Time Totals">
              <div className={styles.studyStats}>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{totalCompletions.toLocaleString()}</span>
                  <span className={styles.studyStatLabel}>Habit completions</span>
                </div>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{allTimeFocusHours}h</span>
                  <span className={styles.studyStatLabel}>Focus time (all-time)</span>
                </div>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{bestEverStreak}d</span>
                  <span className={styles.studyStatLabel}>Best streak ever</span>
                </div>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{vocabMastered}</span>
                  <span className={styles.studyStatLabel}>Vocab mastered</span>
                </div>
              </div>
            </SectionCard>

            {/* Week-over-week focus */}
            <SectionCard title="Focus Momentum">
              <div className={styles.studyStats}>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{(totalFocusMinutes / 60).toFixed(1)}h</span>
                  <span className={styles.studyStatLabel}>This week</span>
                </div>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{(prevWeekMin / 60).toFixed(1)}h</span>
                  <span className={styles.studyStatLabel}>Last week</span>
                </div>
                <div className={styles.studyStat}>
                  <span
                    className={styles.studyStatNum}
                    style={{ color: wowDeltaMin >= 0 ? 'var(--accent-green)' : '#f87171' }}
                  >
                    {wowDeltaMin >= 0 ? '+' : ''}{(wowDeltaMin / 60).toFixed(1)}h
                  </span>
                  <span className={styles.studyStatLabel}>Week-over-week</span>
                </div>
                <div className={styles.studyStat}>
                  <span className={styles.studyStatNum}>{totalCompletions > 0 ? DOW_LABELS[busiestDayIdx] : '—'}</span>
                  <span className={styles.studyStatLabel}>Most active day</span>
                </div>
              </div>
            </SectionCard>

            {/* Weekday completion breakdown */}
            <SectionCard title="Completions by Weekday">
              {totalCompletions === 0 ? (
                <p className={styles.empty}>No habit completions logged yet.</p>
              ) : (
                <div className={styles.weekdayChart}>
                  {weekdayCounts.map((count, i) => (
                    <div key={i} className={styles.weekdayCol}>
                      <div className={styles.weekdayBarTrack}>
                        <div
                          className={styles.weekdayBarFill}
                          style={{ height: `${(count / maxWeekday) * 100}%` }}
                        />
                      </div>
                      <span className={styles.weekdayCount}>{count}</span>
                      <span className={styles.weekdayLabel}>{DOW_LABELS[i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className={styles.vaultLocked}>
          <span className={styles.vaultLockGlyph}>◎</span>
          <div className={styles.vaultLockText}>
            <p className={styles.vaultLockTitle}>Extended Analytics is locked</p>
            <p className={styles.vaultLockSub}>
              Unlock the Analytics Vault to see weekday breakdowns, all-time totals,
              best-ever streaks, and week-over-week focus momentum.
            </p>
          </div>
          <button type="button" className={styles.vaultUnlockBtn} onClick={goToShop}>
            Unlock in Shop →
          </button>
        </div>
      )}

      {showWrapped && (
        <EcosystemWrapped onClose={() => setShowWrapped(false)} />
      )}
    </div>
  )
}
