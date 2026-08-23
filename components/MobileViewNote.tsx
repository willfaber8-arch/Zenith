/**
 * components/MobileViewNote.tsx — one line of honesty.
 *
 * Five destinations are phone-shaped. The other nineteen still open on a
 * phone, because hiding someone's own data behind a screen-size check is
 * worse than showing it awkwardly — people know it is in there, and an
 * app that pretends otherwise is one they stop trusting.
 *
 * What those views get instead is a single line saying they are better
 * on a bigger screen. Not a wall, not a modal: a sentence, dismissible
 * for the session, above content that works regardless.
 *
 * The list is the "stays on the laptop" column of docs/specs/mobile.md,
 * and the reason travels with each entry so it reads as a judgement
 * someone made rather than a scolding.
 */

'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { useNav } from '@/lib/NavContext'
import type { ViewId } from '@/lib/nav-config'
import styles from './MobileViewNote.module.css'

const WIDE_VIEWS: Partial<Record<ViewId, string>> = {
  'book-tracker':  'the shelf wants width to browse',
  'games':         'the arcade is a two-pane layout',
  'trail-hunter':  'the map is worth a big screen',
  'botanist':      'plant cards read better side by side',
  'uni-hub':       'the GPA and load tools are lots of inputs',
  'subscriptions': 'easier to plan sitting down',
  'meal-planning': 'a 7×3 grid is not a phone layout at any size',
  'toolkit':       'the reference tables are wide',
  'stats':         'the charts need room',
}

const DISMISS_KEY = 'zenith_wide_note_dismissed_v1'

export default function MobileViewNote() {
  const { activeView } = useNav()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    /* sessionStorage, not localStorage: dismissing is "yes, I know, not
       now", not a permanent preference. A new session gets the note
       again, which costs one tap and keeps it honest. */
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY)
      if (raw) setDismissed(JSON.parse(raw) as string[])
    } catch { /* private mode, or corrupt — showing the note is the safe side */ }
  }, [])

  const reason = WIDE_VIEWS[activeView]
  if (!mounted || !reason || dismissed.includes(activeView)) return null

  const dismiss = () => {
    const next = [...dismissed, activeView]
    setDismissed(next)
    try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  return (
    <aside className={styles.note} role="note">
      <Icon name="grid" size={13} />
      <span className={styles.text}>Better on a bigger screen — {reason}.</span>
      <button
        type="button"
        className={`${styles.close} tap-44`}
        onClick={dismiss}
        aria-label="Dismiss note"
      >
        <Icon name="close" size={13} />
      </button>
    </aside>
  )
}
