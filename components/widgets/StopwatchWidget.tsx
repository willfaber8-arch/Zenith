'use client'

import { useState, useEffect, useRef } from 'react'
import wStyles from './Widget.module.css'

function fmtTime(ms: number): string {
  const cents = Math.floor((ms % 1000) / 10)
  const secs  = Math.floor(ms / 1000) % 60
  const mins  = Math.floor(ms / 60000) % 60
  const hrs   = Math.floor(ms / 3600000)
  if (hrs > 0)
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`
}

export default function StopwatchWidget() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps,    setLaps]    = useState<number[]>([])

  const startRef   = useRef<number>(0)
  const elapsedRef = useRef(0)

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    const id = setInterval(() => {
      setElapsed(elapsedRef.current + (Date.now() - startRef.current))
    }, 50)
    return () => clearInterval(id)
  }, [running])

  const toggle = () => {
    if (running) { elapsedRef.current = elapsed }
    setRunning(r => !r)
  }

  const lap   = () => setLaps(prev => [elapsed, ...prev].slice(0, 5))
  const reset = () => { setRunning(false); setElapsed(0); elapsedRef.current = 0; setLaps([]) }

  return (
    <div className={wStyles.card}>
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Utility</div>
          <div className={wStyles.title}>Stopwatch</div>
        </div>
        <button onClick={reset} className={wStyles.timerResetBtn} title="Reset">↺</button>
      </div>

      <div className={`${wStyles.swClock} ${running ? wStyles.swClockRunning : ''}`}>
        {fmtTime(elapsed)}
      </div>

      <div className={wStyles.swBtns}>
        <button
          className={`${wStyles.swBtn} ${running ? wStyles.swBtnStop : ''}`}
          onClick={toggle}
        >
          {running ? '⏸ Stop' : '▶ Start'}
        </button>
        <button
          className={wStyles.swBtnSm}
          onClick={lap}
          disabled={!running}
        >
          Lap
        </button>
      </div>

      {laps.length > 0 && (
        <div className={wStyles.swLapList}>
          {laps.map((l, i) => (
            <div key={i} className={wStyles.swLapEntry}>
              <span>Lap {laps.length - i}</span>
              <span>{fmtTime(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
