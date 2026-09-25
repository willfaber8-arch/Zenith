/**
 * components/MobileTabBar.tsx — the phone's whole navigation.
 *
 * On a phone Zenith is these five screens and nothing else:
 *
 *     Home      Today     Habits     Tasks     Notes
 *
 * There is no sidebar behind it any more. The drawer used to hold the
 * other nineteen destinations, which made the phone the desktop app with
 * an extra tap in front of everything; those views are for a bigger
 * screen, and `lib/phoneViews` is where that decision lives.
 *
 * The centre "+" capture button is gone too. With Notes and Habits one
 * tap away on the bar itself, a sheet that led to those same two places
 * (and to a workout log that is no longer on the phone) was a second
 * route to somewhere already reachable.
 */

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon, { type IconName } from '@/components/ui/Icon'
import { useNav } from '@/lib/NavContext'
import { PHONE_TABS, phoneViewFor } from '@/lib/phoneViews'
import type { ViewId } from '@/lib/nav-config'
import styles from './MobileTabBar.module.css'

const ICONS: Partial<Record<ViewId, IconName>> = {
  home:     'home',
  outlook:  'sun',
  habits:   'check',
  calendar: 'clipboard',
  notes:    'note',
}

/** Anything that raises the on-screen keyboard. */
function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type)
  }
  return false
}

export default function MobileTabBar() {
  const { activeView, navigate } = useNav()
  const [mounted, setMounted] = useState(false)
  const [typing,  setTyping]  = useState(false)

  useEffect(() => setMounted(true), [])

  /*
   * Step aside while the keyboard is up.
   *
   * On Android the keyboard shrinks the viewport and a fixed bottom bar
   * rides up on top of it, taking a band out of the middle of whatever
   * you are writing in. Nothing on the bar is useful mid-sentence, so
   * it hides for as long as a text field has focus.
   */
  useEffect(() => {
    const sync = () => setTyping(isTextEntry(document.activeElement))
    /* On focusout, activeElement is still the field being left; read it
       a frame later, once focus has landed wherever it is going. */
    let raf = 0
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync) }
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', later)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', later)
    }
  }, [])

  if (!mounted) return null

  const shown = phoneViewFor(activeView)

  /*
   * Portalled to <body>.
   *
   * AppShell sits inside a wrapper that carries an inline transform for
   * the sign-in transition, and any transform — including the identity
   * matrix it settles on — makes that element the containing block for
   * `position: fixed` descendants. Left in place the bar pinned itself
   * to the bottom of the scroll content instead of the screen.
   *
   * Not labelled "Primary": that name belongs to the desktop sidebar.
   */
  return createPortal(
    <nav
      className={`${styles.bar} ${typing ? styles.barAway : ''}`}
      aria-label="Bottom navigation"
    >
      {PHONE_TABS.map(t => {
        const on = shown === t.view
        return (
          <button
            key={t.view}
            type="button"
            className={`${styles.tab} ${on ? styles.tabOn : ''}`}
            onClick={() => navigate(t.view, t.category)}
            aria-current={on ? 'page' : undefined}
          >
            <Icon name={ICONS[t.view] ?? 'grid'} size={22} />
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        )
      })}
    </nav>,
    document.body,
  )
}
