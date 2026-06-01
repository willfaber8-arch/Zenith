'use client'
/**
 * SlopeDayHypeTracker — Phase 5 · Step 5.7
 * ─────────────────────────────────────────────────────────────────
 * Two-pane dashboard:
 *   Left  — Mental Health Map: mood emoji grid, optional notes,
 *            3-day rolling trend with stress/energy bars.
 *   Right — Slope Day Arena: bold countdown display, hype phase
 *            badge, quest multiplier strips, progress track,
 *            and a subtle canvas-based periwinkle confetti overlay
 *            that activates during peak + live phases.
 *
 * Data flows:
 *   useMentalHealthLog → left pane mood logging + trend display
 *   useSlopeDay        → right pane countdown + multiplier display
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMentalHealthLog }  from '@/lib/hooks/useMentalHealthLog'
import { useSlopeDay }         from '@/lib/hooks/useSlopeDay'
import {
  MOOD_VECTORS,
  MOOD_MAP,
  relativeDateLabel,
  todayISO,
  type MoodKey,
  type MoodVector,
} from '@/utils/mentalHealthLog'
import {
  HYPE_PHASE_LABELS,
  HYPE_PHASE_COLORS,
  fmtMultiplier,
  type HypePhase,
} from '@/utils/slopeDay'
import styles from './SlopeDayHypeTracker.module.css'

/* ════════════════════════════════════════════════════════════════
   CONFETTI CANVAS
   ════════════════════════════════════════════════════════════════ */

interface Particle {
  x: number; y: number
  vx: number; vy: number
  r: number
  hue: number; opacity: number
}

function spawnParticle(w: number, h: number): Particle {
  return {
    x:       Math.random() * w,
    y:       Math.random() * h * 0.15,         // start in top 15%
    vx:      (Math.random() - 0.5) * 0.5,
    vy:      Math.random() * 0.7 + 0.25,
    r:       Math.random() * 1.4 + 1.2,        // 1.2–2.6 px
    hue:     Math.random() * 35 + 212,          // 212–247 periwinkle band
    opacity: Math.random() * 0.14 + 0.06,       // 0.06–0.20 (spec: subtle, low-opacity)
  }
}

interface ConfettiCanvasProps { phase: HypePhase }

function ConfettiCanvas({ phase }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const active    = phase === 'peak' || phase === 'live' || phase === 'countdown'
  const count     = phase === 'live' ? 80 : phase === 'peak' ? 55 : 30

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = canvas.offsetWidth  || 400
    let H = canvas.offsetHeight || 500
    canvas.width  = W
    canvas.height = H

    let particles: Particle[] = Array.from({ length: count }, () => spawnParticle(W, H))
    let raf: number

    const onResize = () => {
      W = canvas.offsetWidth  || W
      H = canvas.offsetHeight || H
      canvas.width  = W
      canvas.height = H
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.x = (p.x + p.vx + W) % W
        p.y += p.vy
        if (p.y > H + 4) Object.assign(p, spawnParticle(W, H))

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 70%, 72%, ${p.opacity.toFixed(3)})`
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(canvas.parentElement ?? canvas)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      ctx.clearRect(0, 0, W, H)
    }
  }, [active, count])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className={styles.confettiCanvas}
      aria-hidden="true"
    />
  )
}

/* ════════════════════════════════════════════════════════════════
   STAT BAR — stress or energy reading 1–10
   ════════════════════════════════════════════════════════════════ */

function StatBar({
  name, value, variant,
}: { name: string; value: number; variant: 'stress' | 'energy' }) {
  const fillClass = variant === 'stress' ? styles.statFillStress : styles.statFillEnergy
  return (
    <div className={styles.statRow}>
      <span className={styles.statName}>{name}</span>
      <div className={styles.statTrack}>
        <div
          className={`${styles.statFill} ${fillClass}`}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   HYPE PROGRESS — percentage through current phase window
   ════════════════════════════════════════════════════════════════ */

/** Returns 0–100 indicating how far the user is through the current hype window */
function computeHypeProgress(daysUntil: number): number {
  if (daysUntil <= 0)   return 100
  if (daysUntil <= 3)   return 70 + ((3  - daysUntil) / 3)  * 30   // 70–100%
  if (daysUntil <= 7)   return 45 + ((7  - daysUntil) / 4)  * 25   // 45–70%
  if (daysUntil <= 14)  return 20 + ((14 - daysUntil) / 7)  * 25   // 20–45%
  const clamped = Math.min(daysUntil, 90)
  return Math.max(0, ((90 - clamped) / 90) * 20)                    // 0–20%
}

function hypeTrackFillClass(phase: HypePhase): string {
  return {
    standard:  styles.hypeTrackFillStandard,
    season:    styles.hypeTrackFillSeason,
    countdown: styles.hypeTrackFillCountdown,
    peak:      styles.hypeTrackFillPeak,
    live:      styles.hypeTrackFillLive,
  }[phase]
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function SlopeDayHypeTracker() {
  const mh   = useMentalHealthLog()
  const hype = useSlopeDay()

  /* ── Mood selection state ─────────────────────────────────── */
  const [selectedMood, setSelectedMood] = useState<MoodVector | null>(null)
  const [notes,        setNotes]        = useState('')
  const [justLogged,   setJustLogged]   = useState(false)

  /* Pre-select today's mood when the log loads */
  useEffect(() => {
    if (mh.todayLog?.moodVector) {
      const m = MOOD_MAP[mh.todayLog.moodVector as MoodKey]
      if (m) { setSelectedMood(m); setNotes(mh.todayLog.qualitativeNotes) }
    }
  }, [mh.todayLog])

  const handleMoodClick = useCallback((m: MoodVector) => {
    setSelectedMood(m)
  }, [])

  const handleLog = useCallback(async () => {
    if (!selectedMood || mh.submitting) return
    await mh.logMood(selectedMood, notes)
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 2200)
  }, [selectedMood, notes, mh])

  /* ── Date label ───────────────────────────────────────────── */
  const today = new Date()
  const dateDisplay = today.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  /* ── Hype progress ────────────────────────────────────────── */
  const hypeProgress = computeHypeProgress(hype.daysUntil)
  const phaseColor   = HYPE_PHASE_COLORS[hype.hypePhase]
  const isHypeActive = hype.hypeMultiplier > 1.0

  /* ── Last 3 calendar days (today, yesterday, day-before) ─── */
  const last3Days = [0, 1, 2].map(dAgo => {
    const d = new Date(); d.setDate(d.getDate() - dAgo)
    const dateStr = d.toISOString().slice(0, 10)
    const log     = mh.logs.find(l => l.logDate === dateStr) ?? null
    return { dateStr, label: relativeDateLabel(dateStr), log }
  })

  /* ── Countdown display helpers ────────────────────────────── */
  const pad = (n: number) => String(n).padStart(2, '0')
  const numClass = hype.hypePhase === 'live'  ? styles.countdownNumLive
    : hype.hypePhase === 'peak' || hype.hypePhase === 'countdown'
      ? styles.countdownNumPeak
      : ''

  return (
    <div className={styles.tracker}>

      <div className={styles.grid}>

        {/* ════════════════════════════════════════════════════
            LEFT PANE — MENTAL HEALTH MAP
            ════════════════════════════════════════════════════ */}
        <div className={`${styles.card} anim-scale-in`}>

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Daily Wellness · Log</p>
              <h2 className={styles.cardTitle}>Emotional State</h2>
            </div>
            <span className={styles.cardDate}>{dateDisplay}</span>
          </div>

          {/* Logged-today chip */}
          {justLogged && (
            <div className={`${styles.todayChip} anim-scale-in`}>
              <span className={styles.todayChipDot} aria-hidden="true" />
              Logged for today
            </div>
          )}

          {/* Mood emoji grid */}
          <div
            className={styles.moodGrid}
            role="group"
            aria-label="Select your emotional state"
          >
            {MOOD_VECTORS.map(m => {
              const isBurnout = m.stressLevel >= 8 && m.energyLevel <= 3
              return (
                <button
                  key={m.key}
                  type="button"
                  className={[
                    styles.moodBtn,
                    selectedMood?.key === m.key ? styles.moodBtnSelected : '',
                    isBurnout ? styles.moodBtnBurnout : '',
                  ].join(' ')}
                  onClick={() => handleMoodClick(m)}
                  aria-pressed={selectedMood?.key === m.key}
                  aria-label={`${m.label}: stress ${m.stressLevel}, energy ${m.energyLevel}`}
                  style={selectedMood?.key === m.key
                    ? { borderColor: `hsla(${m.hue}, 70%, 72%, 0.50)`,
                        boxShadow:  `0 0 12px hsla(${m.hue}, 70%, 72%, 0.12)` }
                    : undefined}
                >
                  <span className={styles.moodEmoji} aria-hidden="true">{m.emoji}</span>
                  <span className={styles.moodLabel}>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Notes textarea */}
          <div className={styles.notesWrap}>
            <label htmlFor="mh-notes" className={styles.notesLabel}>
              Quick Note (optional)
            </label>
            <textarea
              id="mh-notes"
              className={styles.notesInput}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What's driving today's energy level?"
              maxLength={280}
              rows={2}
            />
          </div>

          {/* Log button */}
          <button
            type="button"
            className={styles.logBtn}
            onClick={handleLog}
            disabled={!selectedMood || mh.submitting}
          >
            {mh.submitting ? 'Logging…' : justLogged ? '✓ Logged' : 'Log Entry'}
          </button>

          <div className={styles.divider} aria-hidden="true" />

          {/* 3-day trend */}
          <div className={styles.trendSection}>
            <p className={styles.trendHeading}>3-Day Trend</p>

            {last3Days.map(({ dateStr, label, log }) => (
              <div
                key={dateStr}
                className={`${styles.dayEntry} ${log ? '' : styles.dayEntryMissing}`}
              >
                <div className={styles.dayRow}>
                  <span className={styles.dayLabel}>{label}</span>
                  {log
                    ? (
                      <span className={styles.dayMood}>
                        <span className={styles.dayMoodEmoji}>
                          {MOOD_MAP[log.moodVector as MoodKey]?.emoji ?? '❓'}
                        </span>
                        <span className={styles.dayMoodLabel}>
                          {MOOD_MAP[log.moodVector as MoodKey]?.label ?? log.moodVector}
                        </span>
                      </span>
                    )
                    : <span className={styles.dayNoLog}>No entry</span>
                  }
                </div>

                {log && (
                  <>
                    <div className={styles.statBars}>
                      <StatBar name="Stress" value={log.stressLevel} variant="stress" />
                      <StatBar name="Energy" value={log.energyLevel} variant="energy" />
                    </div>
                    {log.qualitativeNotes && (
                      <p className={styles.dayNotes}>
                        &ldquo;{log.qualitativeNotes}&rdquo;
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* ════════════════════════════════════════════════════
            RIGHT PANE — SLOPE DAY ARENA
            ════════════════════════════════════════════════════ */}
        <div className={`${styles.card} ${styles.arenaCard} anim-scale-in delay-1`}>

          {/* Confetti overlay — activates during countdown / peak / live */}
          <ConfettiCanvas phase={hype.hypePhase} />

          <div className={styles.arenaContent}>

            {/* Arena header */}
            <div className={styles.arenaHeader}>
              <div className={styles.arenaTitleBlock}>
                <p className={styles.arenaEyebrow}>Cornell · Slope Day</p>
                <h2 className={styles.arenaTitle}>
                  The Hype Arena
                </h2>
              </div>
              <span className={styles.arenaDateChip}>
                {hype.dateLabel} {hype.yearLabel}
              </span>
            </div>

            {/* Countdown or live banner */}
            {hype.isPast ? (
              <div className={`${styles.pastCard}`}>
                <p className={styles.pastIcon}>🎉</p>
                <p className={styles.pastText}>
                  Slope Day {hype.yearLabel} has passed.<br />
                  Next Slope Day arrives {new Date(hype.slopeDay.getFullYear() + 1, 4, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                </p>
              </div>
            ) : hype.hypePhase === 'live' ? (
              <div className={styles.liveBanner}>
                <span className={styles.liveDot} aria-hidden="true" />
                <span className={styles.liveText}>Slope Day is TODAY 🎶</span>
              </div>
            ) : (
              <div className={styles.countdownBlock} aria-label={`${hype.daysUntil} days, ${hype.hoursUntil} hours, ${hype.minutesUntil} minutes until Slope Day`}>
                <div className={styles.countdownUnit}>
                  <span className={`${styles.countdownNum} ${numClass}`}>
                    {pad(hype.daysUntil)}
                  </span>
                  <span className={styles.countdownLabel}>days</span>
                </div>
                <span className={styles.countdownSep} aria-hidden="true">:</span>
                <div className={styles.countdownUnit}>
                  <span className={`${styles.countdownNum} ${numClass}`}>
                    {pad(hype.hoursUntil)}
                  </span>
                  <span className={styles.countdownLabel}>hours</span>
                </div>
                <span className={styles.countdownSep} aria-hidden="true">:</span>
                <div className={styles.countdownUnit}>
                  <span className={`${styles.countdownNum} ${numClass}`}>
                    {pad(hype.minutesUntil)}
                  </span>
                  <span className={styles.countdownLabel}>min</span>
                </div>
              </div>
            )}

            {/* Hype phase badge */}
            <div className={styles.hypePhase}>
              <span
                className={[
                  styles.hypePhaseDot,
                  isHypeActive ? styles.hypePhaseDotActive : '',
                ].join(' ')}
                style={{ background: phaseColor }}
                aria-hidden="true"
              />
              <span
                className={styles.hypePhaseLabel}
                style={{ color: phaseColor }}
              >
                {HYPE_PHASE_LABELS[hype.hypePhase]}
              </span>
            </div>

            {/* Multiplier strips */}
            <div className={styles.multiplierSection}>

              <div className={`${styles.multiplierRow} ${isHypeActive ? styles.multiplierRowActive : ''}`}>
                <span className={styles.multiplierIcon} aria-hidden="true">⬡</span>
                <span className={styles.multiplierName}>Quest Gold Reward</span>
                <span className={`${styles.multiplierValue} ${isHypeActive ? styles.multiplierValueActive : styles.multiplierValueStandard}`}>
                  {fmtMultiplier(hype.hypeMultiplier)}
                </span>
              </div>

              <div className={`${styles.multiplierRow} ${isHypeActive ? styles.multiplierRowActive : ''}`}>
                <span className={styles.multiplierIcon} aria-hidden="true">⬡</span>
                <span className={styles.multiplierName}>Quest XP Reward</span>
                <span className={`${styles.multiplierValue} ${isHypeActive ? styles.multiplierValueActive : styles.multiplierValueStandard}`}>
                  {fmtMultiplier(hype.hypeMultiplier)}
                </span>
              </div>

            </div>

            {/* Hype progress track */}
            <div className={styles.hypeTrackSection}>
              <div className={styles.hypeTrackLabel}>
                <span className={styles.hypeTrackName}>Hype Level</span>
                <span className={styles.hypeTrackPct}>{Math.round(hypeProgress)}%</span>
              </div>
              <div className={styles.hypeTrack} role="progressbar" aria-valuenow={Math.round(hypeProgress)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`${styles.hypeTrackFill} ${hypeTrackFillClass(hype.hypePhase)}`}
                  style={{ width: `${hypeProgress}%` }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
