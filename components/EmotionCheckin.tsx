'use client'
/**
 * components/EmotionCheckin.tsx — the daily check-in, and what it adds up to
 *
 * Five 1–10 sliders and an optional journal on one screen. Below them, for
 * the day being looked at:
 *   · category scores, each with a word for it, and one overall number;
 *   · each score against your own 7/30-day usual;
 *   · a 30-day chart of overall wellbeing;
 *   · links — how you tend to feel on days you worked out, focused, kept
 *     your habits, read, or had a pile of tasks due.
 * All of the arithmetic is in utils/emotionCheckin.ts, pure and tested.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  CHECKIN_QUESTIONS,
  DEFAULT_ANSWER,
  answersFromLog,
  categoryScores,
  compareToUsual,
  describeDelta,
  findLinks,
  hasFullCheckin,
  overallLabel,
  overallScore,
  toneOf,
  wellbeingSeries,
  type CheckinAnswers,
  type CheckinKey,
  type Tone,
} from '@/utils/emotionCheckin'
import { useCheckinFactors } from '@/lib/hooks/useCheckinFactors'
import type { MentalHealthLog } from '@/lib/db'
import styles from './EmotionCheckin.module.css'

interface Props {
  /** ISO day being checked in */
  date:       string
  /** That day's log, if any */
  log:        MentalHealthLog | null
  /** Every log, for your usual and the links */
  history:    MentalHealthLog[]
  submitting: boolean
  onSave:     (answers: CheckinAnswers, notes: string) => Promise<void>
}

const TONE_CLASS: Record<Tone, string> = {
  good: styles.toneGood, ok: styles.toneOk, low: styles.toneLow, bad: styles.toneBad,
}

function startingAnswers(log: MentalHealthLog | null): Record<CheckinKey, number> {
  const known = log ? answersFromLog(log) : {}
  const out = {} as Record<CheckinKey, number>
  for (const q of CHECKIN_QUESTIONS) out[q.key] = known[q.key] ?? DEFAULT_ANSWER
  return out
}

/* ── 30-day chart ────────────────────────────────────────────── */

function TrendChart({ points }: { points: Array<{ date: string; value: number }> }) {
  const W = 300, H = 72, PAD = 6
  if (points.length < 2) return null
  const first = new Date(points[0].date + 'T12:00:00').getTime()
  const last  = new Date(points[points.length - 1].date + 'T12:00:00').getTime()
  const span  = Math.max(1, last - first)
  const xy = points.map(p => ({
    x: PAD + ((new Date(p.date + 'T12:00:00').getTime() - first) / span) * (W - PAD * 2),
    y: PAD + (1 - p.value / 100) * (H - PAD * 2),
    p,
  }))
  /* Smooth line through the points — cubic segments, as the other charts draw. */
  let d = `M ${xy[0].x.toFixed(1)} ${xy[0].y.toFixed(1)}`
  for (let i = 1; i < xy.length; i++) {
    const a = xy[i - 1], b = xy[i], mx = (a.x + b.x) / 2
    d += ` C ${mx.toFixed(1)} ${a.y.toFixed(1)} ${mx.toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }
  const mid = PAD + 0.5 * (H - PAD * 2)
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Overall wellbeing over ${points.length} check-ins, latest ${points[points.length - 1].value} out of 100`}>
      <line x1={PAD} x2={W - PAD} y1={mid} y2={mid} className={styles.chartMid} />
      <path d={d} className={styles.chartLine} />
      {xy.map(({ x, y, p }) => (
        <circle key={p.date} cx={x} cy={y} r={2.6} className={`${styles.chartDot} ${TONE_CLASS[toneOf(p.value)]}`}>
          <title>{`${p.date}: ${p.value}`}</title>
        </circle>
      ))}
    </svg>
  )
}

/* ── Main ────────────────────────────────────────────────────── */

export default function EmotionCheckin({ date, log, history, submitting, onSave }: Props) {
  const [answers, setAnswers] = useState<Record<CheckinKey, number>>(() => startingAnswers(log))
  const [notes,   setNotes]   = useState(log?.qualitativeNotes ?? '')
  const [saved,   setSaved]   = useState(false)

  /*
   * Load the day's entry once per day — and once more when that day's row
   * first appears from IndexedDB. Never on every live-query result, which
   * would reset a slider or a half-written journal whenever anything else
   * in the database changed.
   */
  const loadedFor = useRef('')
  useEffect(() => {
    const key = `${date}:${log?.id ?? 'none'}`
    if (loadedFor.current === key) return
    loadedFor.current = key
    setAnswers(startingAnswers(log))
    setNotes(log?.qualitativeNotes ?? '')
    setSaved(false)
  }, [date, log])

  const save = async () => {
    await onSave(answers, notes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  /* Results read what is *saved*, so they never show an unsaved slider. */
  const savedAnswers = useMemo(() => (log ? answersFromLog(log) : {}), [log])
  const cats         = useMemo(() => categoryScores(savedAnswers), [savedAnswers])
  const overall      = useMemo(() => overallScore(savedAnswers), [savedAnswers])
  const usual        = useMemo(() => compareToUsual(date, savedAnswers, history), [date, savedAnswers, history])
  const series       = useMemo(() => wellbeingSeries(history, date, 30), [history, date])
  const avg30 = useMemo(() => {
    const prior = series.filter(p => p.date < date)
    return prior.length >= 3 ? Math.round(prior.reduce((s, p) => s + p.value, 0) / prior.length) : null
  }, [series, date])

  const { factors, from } = useCheckinFactors(date)
  const links = useMemo(
    () => (factors ? findLinks(history, factors, { from, to: date }) : []),
    [history, factors, from, date],
  )

  const inferred = !!log && !hasFullCheckin(log)

  return (
    <div className={styles.wrap}>
      {/* ── The five sliders ─────────────────────────────── */}
      <div className={styles.sliders}>
        {CHECKIN_QUESTIONS.map(q => (
          <div key={q.key} className={styles.slider}>
            <div className={styles.sliderTop}>
              <label htmlFor={`ci-${q.key}`} className={styles.prompt}>{q.prompt}</label>
              <span className={styles.sliderVal} aria-hidden="true">{answers[q.key]}</span>
            </div>
            <input
              id={`ci-${q.key}`}
              type="range"
              min={1}
              max={10}
              step={1}
              value={answers[q.key]}
              onChange={e => setAnswers(a => ({ ...a, [q.key]: Number(e.target.value) }))}
              className={`${styles.range} ${q.positive ? '' : styles.rangeInverse}`}
              style={{ '--fill': `${((answers[q.key] - 1) / 9) * 100}%` } as CSSProperties}
              aria-valuetext={`${answers[q.key]} of 10`}
            />
            <div className={styles.ends} aria-hidden="true"><span>{q.low}</span><span>{q.high}</span></div>
          </div>
        ))}
      </div>

      <div className={styles.notesWrap}>
        <label htmlFor="mh-notes" className={styles.notesLabel}>Journal (optional)</label>
        <textarea
          id="mh-notes"
          className={styles.notes}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything on your mind — what's behind today's numbers, or nothing at all."
          maxLength={2000}
          rows={3}
        />
      </div>

      <button type="button" className={styles.saveBtn} onClick={save} disabled={submitting}>
        {submitting ? 'Saving…' : saved ? '✓ Saved' : log ? 'Update check-in' : 'Save check-in'}
      </button>

      {/* ── Results ──────────────────────────────────────── */}
      {cats.length > 0 && (
        <section className={`${styles.results} anim-fade-in`} aria-label="Check-in results">
          {overall != null && (
            <div className={`${styles.overall} ${TONE_CLASS[toneOf(overall)]}`}>
              <div className={styles.ring}>
                <span className={styles.ringNum}>{overall}</span>
                <span className={styles.ringOf}>/100</span>
              </div>
              <div>
                <p className={styles.overallLabel}>{overallLabel(overall)}</p>
                <p className={styles.overallSub}>
                  Overall wellbeing{avg30 != null ? ` · your 30-day average is ${avg30}` : ''}
                </p>
              </div>
            </div>
          )}

          {inferred && (
            <p className={styles.note}>
              This day was logged before the sliders, so only what it recorded is shown. Save a check-in to fill in the rest.
            </p>
          )}

          <div className={styles.cats}>
            {cats.map(c => {
              const u = usual.find(x => x.key === c.key)
              const chip = u ? describeDelta(u) : null
              return (
                <div key={c.key} className={styles.cat}>
                  <span className={styles.catName}>{c.label}</span>
                  <div className={styles.catTrack}>
                    <div className={`${styles.catFill} ${TONE_CLASS[c.tone]}`} style={{ width: `${Math.max(3, c.score)}%` }} />
                  </div>
                  <span className={styles.catScore}>{c.score}</span>
                  <span className={`${styles.catBand} ${TONE_CLASS[c.tone]}`}>{c.band}</span>
                  {chip && (
                    <span
                      className={`${styles.delta} ${u?.notable ? (u.better ? styles.deltaBetter : styles.deltaWorse) : ''}`}
                      title={u?.basis ? `Compared with your ${u.basis} average` : undefined}
                    >
                      {chip}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {series.length >= 2 && (
            <div className={styles.block}>
              <p className={styles.heading}>Past 30 days</p>
              <TrendChart points={series} />
            </div>
          )}

          <div className={styles.block}>
            <p className={styles.heading}>What lines up with how you feel</p>
            {links.length === 0 ? (
              <p className={styles.note}>
                Nothing stands out yet. Links appear once there are at least 3 check-in days with and without
                each activity — workouts, focus sessions, habits, reading, busy task days.
              </p>
            ) : (
              <>
                <ul className={styles.links}>
                  {links.map(l => (
                    <li key={l.factor} className={`${styles.link} ${l.better ? styles.linkBetter : styles.linkWorse}`}>
                      <p className={styles.linkText}>{l.sentence}</p>
                      <p className={styles.linkMeta}>{l.withDays} days with · {l.withoutDays} without</p>
                    </li>
                  ))}
                </ul>
                <p className={styles.note}>These show what tends to go together on your days, not what causes what.</p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
