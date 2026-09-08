'use client'

/**
 * components/EventDetailPopover.tsx — what an event actually says.
 *
 * Clicking an event used to do nothing: the pill showed a title, a time
 * and a native `title` tooltip, and the location and description that
 * came down with the feed were stored and never displayed. This is the
 * card that shows them, and the place edit and delete are reached from.
 *
 * Anchored beside the event rather than centred, so the week stays
 * visible behind it and you keep your place.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CalendarEvent } from '@/lib/db'
import { popoverPosition } from '@/utils/calendarInteraction'
import { type EditScope } from '@/lib/calendarMutations'
import Icon from '@/components/ui/Icon'
import styles from './EventDetailPopover.module.css'

const CARD_W = 320
const CARD_H = 300

export interface EventDetailPopoverProps {
  event:      CalendarEvent
  /** Where the event sits on screen, for anchoring. */
  anchor:     DOMRect
  color:      string
  feedLabel?: string
  /** How many occurrences share this event's series; 1 means a one-off. */
  seriesCount: number
  onClose:    () => void
  onEdit:     () => void
  onDelete:   (scope: EditScope) => void
}

function fmtRange(startMs: number, endMs: number, allDay: boolean): string {
  const s = new Date(startMs)
  const e = new Date(endMs)
  const day = s.toLocaleDateString(undefined,
    { weekday: 'long', month: 'long', day: 'numeric' })
  if (allDay) return `${day} · All day`
  const t = (d: Date) => d.toLocaleTimeString(undefined,
    { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t(s)} – ${t(e)}`
}

export default function EventDetailPopover({
  event, anchor, color, feedLabel, seriesCount, onClose, onEdit, onDelete,
}: EventDetailPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [askScope, setAskScope] = useState(false)

  useEffect(() => setMounted(true), [])

  /* Escape closes, and a click anywhere else does too — an anchored card
     that needs its own X to dismiss gets in the way. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    /* Deferred: the click that opened this card is still propagating. */
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const handleDelete = useCallback(() => {
    /* Only ask when the answer could differ — asking about a one-off is
       a dialog that has exactly one sensible reply. */
    if (seriesCount > 1) setAskScope(true)
    else onDelete('this')
  }, [seriesCount, onDelete])

  if (!mounted) return null

  const pos = popoverPosition(
    { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom },
    { width: CARD_W, height: CARD_H },
    { width: window.innerWidth, height: window.innerHeight },
  )

  return createPortal(
    <div
      ref={cardRef}
      className={styles.card}
      style={{ left: pos.left, top: pos.top, width: CARD_W, borderLeftColor: color }}
      role="dialog"
      aria-label={`Details for ${event.title}`}
    >
      <div className={styles.head}>
        <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
        <h3 className={styles.title}>{event.title}</h3>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <p className={styles.when}>{fmtRange(event.startMs, event.endMs, event.allDay === 1)}</p>

      {event.location && (
        <p className={styles.row}>
          <Icon name="pin" size={13} />
          <span className={styles.rowText}>{event.location}</span>
        </p>
      )}

      {event.description && (
        <p className={styles.row}>
          <Icon name="note" size={13} />
          <span className={styles.rowText}>{event.description}</span>
        </p>
      )}

      <div className={styles.meta}>
        {feedLabel && <span className={styles.metaChip}>{feedLabel}</span>}
        {seriesCount > 1 && (
          <span className={styles.metaChip}>Repeats · {seriesCount} times</span>
        )}
        {event.locallyEdited === 1 && (
          <span className={styles.editedChip} title="Kept as you left it when this feed refreshes">
            Edited here
          </span>
        )}
      </div>

      {askScope ? (
        <div className={styles.scopeBox}>
          <p className={styles.scopeQ}>Delete just this one, or every repeat?</p>
          <div className={styles.scopeRow}>
            <button type="button" className={styles.scopeBtn}
                    onClick={() => onDelete('this')}>
              This event
            </button>
            <button type="button" className={`${styles.scopeBtn} ${styles.scopeBtnAll}`}
                    onClick={() => onDelete('series')}>
              All {seriesCount}
            </button>
            <button type="button" className={styles.scopeCancel}
                    onClick={() => setAskScope(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={onEdit}>
            <Icon name="edit" size={13} /> Edit
          </button>
          <button type="button" className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={handleDelete}>
            <Icon name="trash" size={13} /> Delete
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
