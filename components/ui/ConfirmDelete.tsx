'use client'

/**
 * ConfirmDelete — a delete button that asks first, in place.
 *
 * This pattern had been hand-written three times (tasks, GPA semesters,
 * notes) and was missing from eighteen other delete calls. Three copies
 * is the point at which they start to disagree: one clears its armed
 * state when the selection changes and another does not, one says what
 * it is about to remove and another just turns red.
 *
 * The shape it settles on:
 *
 *   Press once   → the button becomes a question with a way out
 *   Press again  → the delete happens
 *   Escape, Cancel, or arming a different one → back to resting
 *
 * That last clause is why arming is coordinated rather than local. With
 * per-component state, arming a second row leaves the first row armed
 * too — two live triggers, and the next click lands on whichever one
 * the hand happens to be over. Only one can be armed at a time.
 *
 * Confirmation is not the only protection and often not the best one:
 * for anything reversible, deleting and offering an Undo (see
 * lib/hooks/useUndoableDelete) asks nothing at the moment you cannot
 * yet answer. Use both where the loss is large, and prefer undo alone
 * for the cheap and recoverable.
 */

import { useCallback, useEffect, useId, useState } from 'react'
import styles from './ConfirmDelete.module.css'

/* ── Coordinating the armed one ──────────────────────────────────
   A module-level id plus an event, rather than a context: this needs
   to work in any list, in any view, without every caller having to
   remember to wrap the tree in a provider it would otherwise have no
   reason to know about. */

const ARM_EVENT = 'zenith:confirm-delete-armed'
let armedId: string | null = null

function announceArmed(id: string | null) {
  armedId = id
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ARM_EVENT, { detail: id }))
  }
}

export interface ConfirmDeleteProps {
  /** What pressing this finally does. */
  onConfirm: () => void | Promise<void>
  /**
   * Names the thing being deleted, for screen readers and the title:
   * "Read chapter 3" → "Delete Read chapter 3".
   */
  label: string
  /**
   * Shown beside the confirm button once armed — say what is about to
   * be lost when it is more than the row itself ("Its tasks become
   * unfiled."). Omit for the ordinary single-row case.
   */
  question?: string
  /** The resting glyph. `✕` suits a row; a word suits a toolbar. */
  glyph?: string
  /** Compact rows want the smaller target. */
  size?: 'sm' | 'md'
  /** Hides the resting button until its row is hovered or focused. */
  revealOnHover?: boolean
  disabled?: boolean
  className?: string
}

export default function ConfirmDelete({
  onConfirm,
  label,
  question,
  glyph = '✕',
  size = 'sm',
  revealOnHover = false,
  disabled = false,
  className = '',
}: ConfirmDeleteProps) {
  const id = useId()
  const [armed, setArmed] = useState(false)

  /* Another one arming disarms this one. */
  useEffect(() => {
    const onArm = (e: Event) => {
      const next = (e as CustomEvent<string | null>).detail
      if (next !== id) setArmed(false)
    }
    window.addEventListener(ARM_EVENT, onArm)
    return () => window.removeEventListener(ARM_EVENT, onArm)
  }, [id])

  /* Leaving the component disarms it, so a primed delete never
     survives to be pressed in a different context. */
  useEffect(() => () => { if (armedId === id) announceArmed(null) }, [id])

  const disarm = useCallback(() => {
    setArmed(false)
    if (armedId === id) announceArmed(null)
  }, [id])

  const arm = useCallback(() => {
    announceArmed(id)
    setArmed(true)
  }, [id])

  const confirm = useCallback(async () => {
    disarm()
    await onConfirm()
  }, [disarm, onConfirm])

  if (!armed) {
    return (
      <button
        type="button"
        className={[
          styles.trigger,
          size === 'md' ? styles.triggerMd : styles.triggerSm,
          revealOnHover ? styles.reveal : '',
          className,
        ].filter(Boolean).join(' ')}
        onClick={arm}
        disabled={disabled}
        aria-label={`Delete ${label}`}
        title={`Delete ${label}`}
      >
        {glyph}
      </button>
    )
  }

  /*
   * The caller's className deliberately does NOT reach here.
   *
   * It describes the resting trigger — and a trigger is usually a fixed
   * square, `width: 22px` in the task rows. Applying it to the armed
   * panel squeezed the question and both buttons into that square, so
   * the confirmation rendered as a clipped "Del…" at the edge of the
   * row. Any caller passing a sized button class got the same, which is
   * why this is fixed once here rather than at each call site.
   */
  return (
    <span
      className={styles.armed}
      role="alert"
      /* Escape belongs to the whole group, not to one button: after
         arming, focus can be on either control, and an Escape bound to
         only one leaves the other stuck open. */
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); disarm() } }}
    >
      {question && <span className={styles.question}>{question}</span>}
      <button
        type="button"
        className={styles.yes}
        onClick={() => void confirm()}
        aria-label={`Confirm deleting ${label}`}
        autoFocus
      >
        Delete
      </button>
      <button
        type="button"
        className={styles.no}
        onClick={disarm}
        aria-label="Cancel"
      >
        Cancel
      </button>
    </span>
  )
}
