/**
 * components/WeightroomPanel.tsx — plans, sessions, and the log.
 *
 * Three states rather than three tabs: if there is a session today the
 * panel opens on it, because that is what someone standing in a gym
 * came for. Everything else is one scroll below.
 */

'use client'

import { useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import SetLogger from '@/components/SetLogger'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import { useToast } from '@/lib/ToastContext'
import { useWeightroom, computeStrengthStats } from '@/lib/hooks/useWeightroom'
import { buildPlanPrompt, parseWorkoutPlan } from '@/lib/engines/workoutPlanParser'
import { ACTION_MARKER } from '@/lib/copilotTools'
import { todayISO } from '@/utils/localDate'
import {
  sessionVolumeKg, sessionSetCounts, COMMON_SPLITS,
  type StrengthSession, type WorkoutPlan,
} from '@/types/weightroom'
import styles from './WeightroomPanel.module.css'

/** Spread a plan's days across the week, starting today. */
function scheduleFrom(startISO: string, index: number): string {
  const d = new Date(`${startISO}T00:00:00`)
  // Every other day: a plan of 3–4 days lands on a realistic week rather
  // than four sessions back to back.
  d.setDate(d.getDate() + index * 2)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function WeightroomPanel() {
  const { toast } = useToast()
  const { config, authHeaders } = useAiConfig()
  const {
    plans, todaySession, upcoming, history, isLoading,
    savePlan, deletePlan, logSet, finishSession, deleteSession,
  } = useWeightroom()

  const [logging, setLogging] = useState<StrengthSession | null>(null)
  const [brief, setBrief]     = useState('')
  const [days, setDays]       = useState(4)
  const [splits, setSplits]   = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [showGen, setShowGen] = useState(false)

  const stats = computeStrengthStats(history)

  /* The logger reads from the live session, so a set logged inside it
     re-renders with the next set rather than going stale. */
  const active = logging
    ? (todaySession?.id === logging.id ? todaySession
       : upcoming.find(s => s.id === logging.id) ?? logging)
    : null

  const generate = useCallback(async () => {
    if (!config.userApiKey) {
      toast('Add an AI key in Settings → AI Provider to generate a plan.', 'error')
      return
    }
    if (!brief.trim()) {
      toast('Say what you want from the plan first.', 'info')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          messages: [{ role: 'user', content: buildPlanPrompt({
            brief: brief.trim(), daysPerWeek: days, splits,
          }) }],
        }),
      })
      if (!res.ok || !res.body) throw new Error('The AI provider refused the request.')

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let full = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
      }

      // The chat route appends tool-call JSON after a marker. Plans use
      // none, but trim at it so a stray marker cannot reach the parser.
      const parsed = parseWorkoutPlan(full.split(ACTION_MARKER)[0])
      if (!parsed) {
        toast('That answer could not be read as a plan. Try rewording it.', 'error')
        return
      }

      const now = Date.now()
      const planId = crypto.randomUUID()
      const plan: WorkoutPlan = {
        id: planId, name: parsed.name, brief: brief.trim(),
        daysPerWeek: days, source: 'ai', createdAt: now,
      }
      const start = todayISO()
      const sessions: StrengthSession[] = parsed.sessions.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        planId,
        scheduledFor: scheduleFrom(start, i),
        createdAt: now, updatedAt: now,
      }))

      await savePlan(plan, sessions)
      setShowGen(false)
      setBrief('')
      toast(
        parsed.warnings.length
          ? `Plan saved. ${parsed.warnings[0]}`
          : `Saved "${parsed.name}" — ${sessions.length} sessions.`,
        parsed.warnings.length ? 'info' : 'success',
      )
    } catch (e) {
      toast((e as Error).message || 'Could not reach the AI provider.', 'error')
    } finally {
      setGenerating(false)
    }
  }, [config.userApiKey, authHeaders, brief, days, splits, savePlan, toast])

  if (active) {
    return (
      <SetLogger
        session={active}
        onLogSet={(exId, setId, patch) => void logSet(active.id, exId, setId, patch)}
        onFinish={async () => { await finishSession(active.id); setLogging(null); toast('Session saved.', 'success') }}
        onClose={() => setLogging(null)}
      />
    )
  }

  return (
    <div className={styles.root}>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className={styles.statRow}>
        <Stat icon="calendar" value={String(stats.sessionsThisWeek)} label="This week" />
        <Stat icon="barbell"  value={stats.volumeThisWeekKg.toLocaleString()} label="kg moved" />
        <Stat icon="check"    value={String(stats.totalSessions)} label="Sessions" />
      </div>

      {/* ── Today ─────────────────────────────────────────────── */}
      {todaySession ? (
        <section className={styles.today}>
          <p className={styles.todayEyebrow}>Today</p>
          <h3 className={styles.todayTitle}>{todaySession.title}</h3>
          <p className={styles.todayMeta}>
            {todaySession.exercises.length} exercises ·{' '}
            {sessionSetCounts(todaySession).total} sets
          </p>
          <ul className={styles.exList}>
            {todaySession.exercises.map(ex => (
              <li key={ex.id} className={styles.exRow}>
                <span className={styles.exName}>{ex.name}</span>
                <span className={styles.exSets}>
                  {ex.sets.length} × {ex.sets[0]?.targetReps ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <button className={styles.startBtn} onClick={() => setLogging(todaySession)}>
            <Icon name="play" size={18} />
            {todaySession.startedAt ? 'Continue session' : 'Start session'}
          </button>
        </section>
      ) : (
        <section className={styles.emptyToday}>
          <Icon name="barbell" size={26} />
          <p className={styles.emptyTitle}>Nothing scheduled today</p>
          <p className={styles.emptyHint}>
            {upcoming.length > 0
              ? `Next up: ${upcoming[0].title} on ${upcoming[0].scheduledFor}.`
              : 'Generate a plan and it will schedule itself across the week.'}
          </p>
        </section>
      )}

      {/* ── Plan generator ────────────────────────────────────── */}
      <section className={styles.panel}>
        <button
          className={styles.panelHead}
          onClick={() => setShowGen(v => !v)}
          aria-expanded={showGen}
        >
          <Icon name="sparkle" size={16} />
          <span>Generate a plan</span>
          <Icon name="chevronDown" size={16}
                style={{ marginLeft: 'auto', transform: showGen ? 'rotate(180deg)' : undefined,
                         transition: 'transform 200ms' }} />
        </button>

        {showGen && (
          <div className={styles.genBody}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>What do you want from it?</span>
              <textarea
                className={styles.textarea}
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={3}
                placeholder="Build strength, mostly barbell work, bad left shoulder so no overhead pressing."
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Days per week</span>
              <div className={styles.dayPicker}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`${styles.dayBtn} ${days === n ? styles.dayBtnOn : ''}`}
                    onClick={() => setDays(n)}
                    aria-pressed={days === n}
                  >{n}</button>
                ))}
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Split (optional)</span>
              <div className={styles.splitRow}>
                {COMMON_SPLITS.map(s => (
                  <button
                    key={s}
                    className={`${styles.splitChip} ${splits.includes(s) ? styles.splitChipOn : ''}`}
                    onClick={() => setSplits(v =>
                      v.includes(s) ? v.filter(x => x !== s) : [...v, s])}
                    aria-pressed={splits.includes(s)}
                  >{s}</button>
                ))}
              </div>
            </label>

            <p className={styles.genNote}>
              The plan sets exercises, sets and reps. It deliberately does not
              suggest weights — those come from your own history, because a
              model has no idea what you can lift.
            </p>

            <button
              className={styles.genBtn}
              onClick={generate}
              disabled={generating || !brief.trim()}
            >
              {generating ? 'Writing your plan…' : 'Generate'}
            </button>
          </div>
        )}
      </section>

      {/* ── Plans ─────────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section className={styles.panel}>
          <p className={styles.sectionLabel}>Plans</p>
          <ul className={styles.planList}>
            {plans.map(p => (
              <li key={p.id} className={styles.planRow}>
                <div className={styles.planText}>
                  <span className={styles.planName}>{p.name}</span>
                  <span className={styles.planMeta}>{p.daysPerWeek} days/week</span>
                </div>
                <button
                  className={styles.rowBtn}
                  onClick={() => void deletePlan(p.id)}
                  aria-label={`Delete plan ${p.name}`}
                  title="Removes upcoming sessions; sessions you've completed stay in the log"
                ><Icon name="trash" size={16} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Upcoming ──────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className={styles.panel}>
          <p className={styles.sectionLabel}>Upcoming</p>
          <ul className={styles.planList}>
            {upcoming.slice(0, 8).map(s => (
              <li key={s.id} className={styles.planRow}>
                <div className={styles.planText}>
                  <span className={styles.planName}>{s.title}</span>
                  <span className={styles.planMeta}>
                    {s.scheduledFor} · {sessionSetCounts(s).total} sets
                  </span>
                </div>
                <button className={styles.rowBtn} onClick={() => setLogging(s)}
                        aria-label={`Start ${s.title} early`}>
                  <Icon name="play" size={15} />
                </button>
                <button className={styles.rowBtn} onClick={() => void deleteSession(s.id)}
                        aria-label={`Delete ${s.title}`}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Log ───────────────────────────────────────────────── */}
      <section className={styles.panel}>
        <p className={styles.sectionLabel}>Log</p>
        {isLoading ? (
          <p className={styles.emptyHint}>Loading…</p>
        ) : history.length === 0 ? (
          <p className={styles.emptyHint}>
            Nothing logged yet. Finished sessions land here with their volume.
          </p>
        ) : (
          <ul className={styles.planList}>
            {history.slice(0, 20).map(s => (
              <li key={s.id} className={styles.planRow}>
                <div className={styles.planText}>
                  <span className={styles.planName}>{s.title}</span>
                  <span className={styles.planMeta}>
                    {s.scheduledFor} · {sessionSetCounts(s).done} sets ·{' '}
                    {sessionVolumeKg(s).toLocaleString()} kg
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ icon, value, label }: {
  icon: 'calendar' | 'barbell' | 'check'; value: string; label: string
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon}><Icon name={icon} size={16} /></span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
