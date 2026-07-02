'use client'

import { useState, useEffect } from 'react'
import wStyles from './Widget.module.css'

/* Single configurable tally counter. The label, current value and the
   increment/decrement step are all user-defined and persisted locally. */

const STORAGE_KEY = 'zenith_counter_widget_v1'

interface CounterState {
  label: string
  value: number
  step:  number
}

const DEFAULT_STATE: CounterState = { label: 'Counter', value: 0, step: 1 }

function read(): CounterState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<CounterState>) }
  } catch { /* noop */ }
  return DEFAULT_STATE
}

export default function CounterWidget() {
  const [state,   setState]   = useState<CounterState>(DEFAULT_STATE)
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setState(read())
    setMounted(true)
  }, [])

  const persist = (next: CounterState) => {
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  const bump  = (dir: 1 | -1) => persist({ ...state, value: state.value + dir * (state.step || 1) })
  const reset = () => persist({ ...state, value: 0 })

  // Avoid a hydration flash of the default value before localStorage loads.
  if (!mounted) {
    return (
      <div className={wStyles.card}>
        <div className={wStyles.cardHeader}>
          <div>
            <div className={wStyles.eyebrow}>Utility</div>
            <div className={wStyles.title}>Counter</div>
          </div>
        </div>
        <div className={wStyles.counterValue}>—</div>
      </div>
    )
  }

  return (
    <div className={wStyles.card}>
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Utility</div>
          <div className={wStyles.title}>{state.label || 'Counter'}</div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={wStyles.timerResetBtn}
          title={editing ? 'Done' : 'Edit counter'}
          aria-label={editing ? 'Finish editing' : 'Edit counter'}
        >
          {editing ? '✓' : '✎'}
        </button>
      </div>

      {editing ? (
        <div className={wStyles.counterEdit}>
          <label className={wStyles.counterField}>
            <span>Label</span>
            <input
              className={wStyles.counterInput}
              type="text"
              value={state.label}
              maxLength={24}
              onChange={e => persist({ ...state, label: e.target.value })}
              placeholder="Counter"
            />
          </label>
          <label className={wStyles.counterField}>
            <span>Step</span>
            <input
              className={wStyles.counterInput}
              type="number"
              min={1}
              value={state.step}
              onChange={e => persist({ ...state, step: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
            />
          </label>
          <button className={wStyles.counterResetLink} onClick={reset} type="button">
            Reset value to 0
          </button>
        </div>
      ) : (
        <>
          <div className={wStyles.counterValue} aria-live="polite">{state.value}</div>
          <div className={wStyles.counterRow}>
            <button
              className={`${wStyles.counterBtn} ${wStyles.counterBtnMinus}`}
              onClick={() => bump(-1)}
              aria-label={`Decrease by ${state.step}`}
            >
              −{state.step}
            </button>
            <button
              className={wStyles.counterBtn}
              onClick={() => bump(1)}
              aria-label={`Increase by ${state.step}`}
            >
              +{state.step}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
