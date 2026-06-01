'use client'

import { useState }        from 'react'
import { useNav }          from '@/lib/NavContext'
import { useAuth }         from '@/lib/AuthContext'
import { useToast }        from '@/lib/ToastContext'
import { useNavBadge }     from '@/lib/NavBadgeContext'
import { useStudyMode }    from '@/lib/StudyModeContext'
import Topbar                    from './Topbar'
import BadgeSyncEffect           from './BadgeSyncEffect'
import RpgSyncEffect             from './RpgSyncEffect'
import MentalHealthBurnoutBanner from './MentalHealthBurnoutBanner'
import StudyLayoutContainer      from './StudyLayoutContainer'
import {
  NAV_CONFIG,
  CATEGORY_ACCENT,
  CATEGORY_HOVER_BG,
  CATEGORY_ACTIVE_BG,
  CATEGORY_BORDER,
  type NavLink,
  type CategoryId,
} from '@/lib/nav-config'
import styles from './AppShell.module.css'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen]          = useState(false)
  const { activeView, navigate } = useNav()
  const { signOut }              = useAuth()
  const { toast }                = useToast()
  const { badges }               = useNavBadge()
  const { isStudyModeActive }    = useStudyMode()

  /* ── Study mode transition styles ──────────────────────────
   * The sidebar translates left, the topbar translates up.
   * Both fade out in 300 ms (opacity) while moving (400 ms).
   * The StudyLayoutContainer overlay covers the gap visually.
   * ─────────────────────────────────────────────────────────── */
  const EASE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'
  const EASE_IN  = 'cubic-bezier(0.16, 1, 0.3, 1)'

  const sidebarStyle: React.CSSProperties = {
    transform:     isStudyModeActive ? 'translateX(-100%)' : 'translateX(0)',
    opacity:       isStudyModeActive ? 0 : 1,
    pointerEvents: isStudyModeActive ? 'none' : undefined,
    transition:    isStudyModeActive
      ? `transform 400ms ${EASE_OUT}, opacity 300ms ease`
      : `transform 400ms ${EASE_IN},  opacity 300ms ease`,
  }

  const topbarStyle: React.CSSProperties = {
    transform:  isStudyModeActive ? 'translateY(-100%)' : 'translateY(0)',
    opacity:    isStudyModeActive ? 0 : 1,
    transition: isStudyModeActive
      ? `transform 380ms ${EASE_OUT}, opacity 280ms ease`
      : `transform 380ms ${EASE_IN},  opacity 280ms ease`,
  }

  const handleLink = (link: NavLink) => {
    navigate(link.id, link.category)
    setOpen(false)
  }

  const handleHome = () => {
    navigate('home', null)
    setOpen(false)
  }

  const handleSignOut = () => {
    navigate('home', null)
    signOut()
    toast('Session terminated successfully.', 'info')
    setOpen(false)
  }

  return (
    <div className={styles.shell}>

      {/* ── Persistent Sidebar ──────────────────────────────── */}
      <aside
        id="sidebar"
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
        aria-label="Main navigation"
        style={sidebarStyle}
        aria-hidden={isStudyModeActive}
      >
        <div className={styles.sidebarInner}>

          <header className={styles.sidebarHeader}>
            <div className={styles.logoMark} aria-hidden="true">Z</div>
            <span className={styles.logoText}>Zenith</span>
          </header>

          <nav className={styles.nav} aria-label="Primary">
            <ul className={styles.navList}>

              {/* ── Home ─────────────────────────────────────── */}
              <li>
                <button
                  type="button"
                  className={`${styles.navItem} ${activeView === 'home' ? styles.navItemActive : ''}`}
                  onClick={handleHome}
                  style={{
                    '--item-hover-bg':  'rgba(124, 149, 255, 0.12)',
                    '--item-active-bg': 'rgba(124, 149, 255, 0.18)',
                    '--item-accent':    'var(--accent-purple)',
                    '--item-border':    'rgba(124, 149, 255, 0.55)',
                  } as React.CSSProperties}
                >
                  <span className={styles.navIcon} aria-hidden="true">◈</span>
                  <span className={styles.navLabel}>Home</span>
                </button>
              </li>

              {/* ── Category taxonomy ─────────────────────────── */}
              {NAV_CONFIG.map((cat) => (
                <li key={cat.id} className={styles.categoryBlock}>

                  <p className={styles.categoryLabel}>{cat.label}</p>

                  {/* Sub-categories (Zenith Essentials) */}
                  {cat.subcategories?.map((sub) => (
                    <div key={sub.id} className={styles.subCatBlock}>
                      <p className={styles.subCatLabel}>{sub.label}</p>
                      <ul className={styles.navList}>
                        {sub.links.map(link => (
                          <NavLinkItem
                            key={link.id}
                            link={link}
                            active={activeView === link.id}
                            badge={badges[link.id] ?? 0}
                            onClick={() => handleLink(link)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Direct links (Creator's Choice, Personalized Vault) */}
                  {cat.links?.map(link => (
                    <ul key={link.id} className={styles.navList}>
                      <NavLinkItem
                        link={link}
                        active={activeView === link.id}
                        badge={badges[link.id] ?? 0}
                        onClick={() => handleLink(link)}
                      />
                    </ul>
                  ))}

                </li>
              ))}

            </ul>
          </nav>

          <footer className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.navItem}
              style={{
                '--item-hover-bg': 'rgba(124, 149, 255, 0.08)',
                '--item-accent':   'var(--text-muted)',
              } as React.CSSProperties}
            >
              <span className={styles.navIcon} aria-hidden="true">⊙</span>
              <span className={styles.navLabel}>Settings</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${styles.signOutBtn}`}
              onClick={handleSignOut}
              aria-label="Sign out of Zenith"
            >
              <span className={styles.navIcon} aria-hidden="true">⏻</span>
              <span className={styles.navLabel}>Sign Out</span>
            </button>
          </footer>

        </div>
      </aside>

      {/* ── DB side-effects: badge sync + profile seed ──────── */}
      <BadgeSyncEffect />
      {/* ── RPG lifecycle engine: Dexie hooks + overdue scan ─── */}
      <RpgSyncEffect />

      {/* ── Content Frame: Topbar + scrollable viewport ─────── */}
      <div className={styles.contentFrame}>
        {/* Topbar wrapped so the translateY transition doesn't clip siblings */}
        <div style={topbarStyle} aria-hidden={isStudyModeActive}>
          <Topbar
            sidebarOpen={open}
            onToggleSidebar={() => setOpen(o => !o)}
          />
        </div>
        {/* Mental health burnout alert — sticky below topbar when risk detected */}
        <MentalHealthBurnoutBanner />

        <div className={styles.viewport}>
          {children}
        </div>
      </div>

      {/* ── Study mode cockpit overlay ───────────────────────── */}
      {/*
       * Rendered as the last child of .shell so it sits on top of
       * the sidebar (z:100) and content frame within this stacking
       * context.  Toast (z:600, outside .shell) still shows above.
       */}
      <StudyLayoutContainer />

      {/* ── Mobile backdrop (closes drawer on outside click) ── */}
      {open && (
        <div
          className={styles.backdrop}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

    </div>
  )
}

/* ── NavLinkItem sub-component ──────────────────────────────── */

function NavLinkItem({
  link,
  active,
  badge,
  onClick,
}: {
  link:    NavLink
  active:  boolean
  badge:   number
  onClick: () => void
}) {
  const cat = link.category as CategoryId

  return (
    <li>
      <button
        type="button"
        className={`${styles.navItem} ${styles.navItemIndented} ${active ? styles.navItemActive : ''}`}
        onClick={onClick}
        /*
         * CSS custom properties drive all hover + active colours via pure
         * CSS — no JS state needed. Set unconditionally so :hover rules
         * can resolve the vars even before the item becomes active.
         */
        style={{
          '--item-hover-bg':  CATEGORY_HOVER_BG[cat],
          '--item-active-bg': CATEGORY_ACTIVE_BG[cat],
          '--item-accent':    CATEGORY_ACCENT[cat],
          '--item-border':    CATEGORY_BORDER[cat],
        } as React.CSSProperties}
      >
        <span className={styles.navDot} aria-hidden="true" />
        <span className={styles.navLabel}>{link.label}</span>

        {/* Badge — rendered only when count > 0; scales in via CSS */}
        {badge > 0 && (
          <span
            className={styles.badge}
            aria-label={`${badge} pending`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    </li>
  )
}
