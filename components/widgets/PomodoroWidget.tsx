'use client'

import { useState, useEffect, useRef } from 'react'
import { useNav } from '@/lib/NavContext'
import styles from './Widget.module.css'

const FOCUS_SECS = 25 * 60
const BREAK_SECS = 5  * 60

function fmtSecs(s: number): string {
  const m   = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

type Phase = 'focus' | 'break'

export default function PomodoroWidget() {
  const { navigate }  = useNav()
  const [phase,     setPhase]   = useState<Phase>('focus')
  const [remaining, setRem]     = useState(FOCUS_SECS)
  const [running,   setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRem(prev => {
        if (prev <= 1) {
          setPhase(p => p === 'focus' ? 'break' : 'focus')
          setRunning(false)
          return prev === 1
            ? (phase === 'focus' ? BREAK_SECS : FOCUS_SECS)
            : prev - 1
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRunning(r => !r)
  }

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRunning(false)
    setPhase('focus')
    setRem(FOCUS_SECS)
  }

  return (
    <div
      className={`${styles.card} ${styles.clickable}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate('study-shield', 'essentials')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('study-shield', 'essentials') }}
      aria-label="Open Study Shield"
      style={{ '--widget-accent': 'var(--accent-purple)' } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Scholastic · Focus</p>
          <p className={styles.title}>{phase === 'focus' ? 'Deep Focus' : 'Short Break'}</p>
        </div>
        {running && (
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      '0.45rem',
            fontWeight:    700,
            letterSpacing: '0.06em',
            color:         'var(--accent-purple)',
            background:    'rgba(124,149,255,0.10)',
            padding:       '2px 6px',
            borderRadius:  '99px',
            border:        '1px solid rgba(124,149,255,0.18)',
            flexShrink:    0,
          }}>
            {phase === 'focus' ? 'FOCUS' : 'BREAK'}
          </span>
        )}
        {!running && <span className={styles.navArrow} aria-hidden="true">→</span>}
      </div>

      <div className={styles.widgetBody}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--sp-4)' }}>
          <time
            style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      '2rem',
              fontWeight:    700,
              letterSpacing: '0.04em',
              color:         'var(--text-primary)',
              lineHeight:    1,
            }}
            aria-label={`${fmtSecs(remaining)} remaining`}
            suppressHydrationWarning
          >
            {fmtSecs(remaining)}
          </time>
          <p style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      '0.45rem',
            fontWeight:    600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         'var(--text-dark)',
            paddingBottom: '4px',
          }}>
            {phase === 'focus' ? '25 min' : '5 min'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
          <button
            type="button"
            onClick={handleToggle}
            aria-label={running ? 'Pause timer' : 'Start focus session'}
            style={{
              padding:       'var(--sp-1) var(--sp-4)',
              borderRadius:  'var(--r-xl)',
              border:        '1px solid var(--border-subtle)',
              background:    running ? 'rgba(124,149,255,0.10)' : 'transparent',
              color:         'var(--accent-purple)',
              fontFamily:    'var(--font-display)',
              fontSize:      '0.6rem',
              fontWeight:    600,
              letterSpacing: '0.04em',
              cursor:        'pointer',
            }}
          >
            {running ? 'Pause' : 'Start'}
          </button>
          {(running || remaining !== FOCUS_SECS) && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset timer"
              style={{
                padding:       'var(--sp-1) var(--sp-4)',
                borderRadius:  'var(--r-xl)',
                border:        '1px solid var(--border-subtle)',
                background:    'transparent',
                color:         'var(--text-dark)',
                fontFamily:    'var(--font-display)',
                fontSize:      '0.6rem',
                fontWeight:    600,
                letterSpacing: '0.04em',
                cursor:        'pointer',
                opacity:       0.6,
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
