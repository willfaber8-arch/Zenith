'use client'

/**
 * components/ui/HoldToConfirm.tsx — a button that only fires after being
 * held down.
 *
 * ConfirmDelete's "press once, press again" is the right shape for most
 * confirmations, but not for undoing a tap: the gesture that confirms it
 * (another press) is identical to the gesture that caused the mistake in
 * the first place, so it protects against nothing. Holding for a beat is
 * a different motion from tapping — hard to do by accident, easy to do
 * on purpose — which is the property this needs instead.
 *
 * The fill is a CSS transition, not a rAF loop stepping through percentages
 * — one class toggle drives the whole animation, and it stays exactly in
 * sync with the timer that fires onConfirm because both are set to the
 * same HOLD_MS.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './HoldToConfirm.module.css'

const HOLD_MS = 700

export interface HoldToConfirmProps {
  onConfirm: () => void | Promise<void>
  /** Accessible name — say what holding this does, not just what it is. */
  label: string
  title?: string
  icon?: ReactNode
  className?: string
  disabled?: boolean
}

export default function HoldToConfirm({
  onConfirm, label, title, icon, className = '', disabled = false,
}: HoldToConfirmProps) {
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setHolding(false)
  }, [])

  /*
   * A hold interrupted by the control disappearing must not still fire.
   *
   * The timer is the only thing that calls onConfirm, and it outlived
   * the component: start a hold on a habit row, have the row unmount
   * underneath you (the day rolls over, the habit is deleted, you
   * navigate away), and ~700ms later the undo ran anyway — against a
   * row nobody was looking at.
   */
  useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
  }, [])

  const start = useCallback(() => {
    if (disabled || timerRef.current != null) return
    setHolding(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setHolding(false)
      void onConfirm()
    }, HOLD_MS)
  }, [disabled, onConfirm])

  /* A key auto-repeats while held, firing keydown over and over — guard
     with `repeat` so only the first one starts the timer. */
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault()
      start()
    }
  }, [start])

  const onKeyUp = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') cancel()
  }, [cancel])

  return (
    <button
      type="button"
      className={[styles.btn, holding ? styles.holding : '', className].filter(Boolean).join(' ')}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as React.CSSProperties}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onContextMenu={e => e.preventDefault()}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
    >
      <span className={styles.fill} aria-hidden="true" />
      <span className={styles.content}>{icon}</span>
    </button>
  )
}
