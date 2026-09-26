'use client'

/**
 * components/MobileTopbar.tsx — the phone's top bar.
 *
 * Two things: where you are, and who you are. The desktop Topbar carries
 * a search box, weather, sync state, a clock, credits, the notification
 * bell and the AI button — useful on a monitor, and on a phone a row of
 * chips competing for 390px that pushed the page name out of existence.
 *
 * The avatar is the one control. It opens Settings and Sign out, which
 * the phone has no sidebar footer to hold any more.
 *
 * A separate component rather than a phone mode of Topbar, so the
 * desktop bar is not one line different for this.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useNav } from '@/lib/NavContext'
import { useToast } from '@/lib/ToastContext'
import { phoneTitleFor } from '@/lib/phoneViews'
import { seedGamesDatabase } from '@/lib/gamesDb'
import { ZenithMark } from '@/components/ZenithLogo'
import Icon from '@/components/ui/Icon'
import CloudSyncDot from '@/components/CloudSyncDot'
import styles from './MobileTopbar.module.css'

export default function MobileTopbar() {
  const { session, signOut } = useAuth()
  const { activeView, navigate } = useNav()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /*
   * The Games DB seeder lives in the desktop top bar's credits chip
   * (CLAUDE.md rule 56) — which a phone never mounts. Habit and task
   * completions award credits into that database whichever screen they
   * happen on, so whichever top bar is showing has to seed it.
   * `seedGamesDatabase` is idempotent; running it here as well costs
   * nothing when the desktop bar has already done it.
   */
  useEffect(() => {
    seedGamesDatabase().catch(() => { /* credits degrade to 0 */ })
  }, [])

  /* Close on a tap anywhere else, and on Escape. */
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const openSettings = useCallback(() => {
    setMenuOpen(false)
    navigate('settings', null)
  }, [navigate])

  const doSignOut = useCallback(() => {
    setMenuOpen(false)
    navigate('home', null)
    signOut()
    toast('Signed out.', 'info')
  }, [navigate, signOut, toast])

  const handle   = session?.userHandle ?? ''
  const initials = handle ? handle.slice(0, 2).toUpperCase() : '?'

  return (
    <header className={styles.bar}>
      <ZenithMark size={22} className={styles.mark} />
      <h1 className={styles.title}>{phoneTitleFor(activeView)}</h1>

      <CloudSyncDot compact />

      <div ref={rootRef} className={styles.menuRoot}>
        <button
          type="button"
          className={styles.avatarBtn}
          onClick={() => setMenuOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={handle ? `Account menu for ${handle}` : 'Account menu'}
        >
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            {handle && <p className={styles.menuWho}>Signed in as {handle}</p>}
            <button type="button" role="menuitem" className={styles.menuItem} onClick={openSettings}>
              <Icon name="grid" size={17} /> Settings
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={doSignOut}>
              <Icon name="chevronLeft" size={17} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
