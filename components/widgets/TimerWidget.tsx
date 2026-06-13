'use client'

import { useState, useEffect, useRef } from 'react'
import wStyles from './Widget.module.css'

const PRESETS = [5, 10, 15, 20, 25, 30]

export default function TimerWidget() {
  const [preset,    setPreset]    = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running,   setRunning]   = useState(false)
  const [done,      setDone]      = useState(false)

  const epochRef = useRef<number>(0)
  const remRef   = useRef(25 * 60)

  useEffect(() => {
    if (!running) return
    epochRef.current = Date.now()
    remRef.current   = remaining
    const id = setInterval(() => {
      const next = Math.max(0, remRef.current - Math.floor((Date.now() - epochRef.current) / 1000))
      setRemaining(next)
      if (next === 0) { setRunning(false); setDone(true) }
    }, 250)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const applyPreset = (m: number) => {
    setPreset(m); setRemaining(m * 60); setRunning(false); setDone(false)
  }

  const reset = () => { setRemaining(preset * 60); setRunning(false); setDone(false) }

  const toggle = () => {
    if (done) { reset() } else { remRef.current = remaining; setRunning(r => !r) }
  }

  const m   = Math.floor(remaining / 60)
  const s   = remaining % 60
  const pct = (remaining / (preset * 60)) * 100

  return (
    <div className={wStyles.card}>
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Utility</div>
          <div className={wStyles.title}>Timer</div>
        </div>
        <button onClick={reset} className={wStyles.timerResetBtn} title="Reset">↺</button>
      </div>

      <div className={`${wStyles.timerClock} ${done ? wStyles.timerClockDone : ''}`}>
        {done ? '✓ Done!' : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}
      </div>

      <div className={wStyles.timerTrack}>
        <div className={wStyles.timerFill} style={{ width: `${pct}%`, background: done ? 'var(--accent-green)' : undefined }} />
      </div>

      <div className={wStyles.timerPresets}>
        {PRESETS.map(p => (
          <button
            key={p}
            className={`${wStyles.timerChip} ${preset === p ? wStyles.timerChipActive : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p}m
          </button>
        ))}
      </div>

      <button
        className={`${wStyles.timerStartBtn} ${running ? wStyles.timerStartBtnPaused : ''}`}
        onClick={toggle}
      >
        {done ? '↺ Reset' : running ? '⏸ Pause' : '▶ Start'}
      </button>
    </div>
  )
}
