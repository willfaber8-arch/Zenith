'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNav }          from '@/lib/NavContext'
import { useAuth }         from '@/lib/AuthContext'
import { useToast }        from '@/lib/ToastContext'
import { useNavBadge }     from '@/lib/NavBadgeContext'
import { useStudyMode }    from '@/lib/StudyModeContext'
import { useHiddenNavItems } from '@/lib/hooks/useHiddenNavItems'
import Topbar                    from './Topbar'
import BadgeSyncEffect           from './BadgeSyncEffect'
import MentalHealthBurnoutBanner from './MentalHealthBurnoutBanner'
import StudyLayoutContainer      from './StudyLayoutContainer'
import {
  NAV_CONFIG,
  hexToRgba,
  type NavLink,
  type CategoryId,
} from '@/lib/nav-config'
import { ZenithMark } from './ZenithLogo'
import styles from './AppShell.module.css'

const COLLAPSED_KEY      = 'zenith_nav_collapsed_v1'
const SIDEBAR_HIDDEN_KEY = 'zenith_sidebar_hidden_v1'

function useCollapsedCategories() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY)
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]))
    } catch { /* noop */ }
  }, [])

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }

  return { collapsed, toggle }
}

function useSidebarHidden() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_HIDDEN_KEY) === 'true') setHidden(true)
    } catch { /* noop */ }
  }, [])

  const toggle = () => {
    setHidden(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  return { sidebarHidden: hidden, toggleSidebarHidden: toggle }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen]          = useState(false)
  const { activeView, activeCategory, navigate } = useNav()
  const { signOut }              = useAuth()
  const { toast }                = useToast()
  const { badges }               = useNavBadge()
  const { isStudyModeActive }    = useStudyMode()
  const {
    hidden, hideItem, showItem, showAll, mounted: hiddenMounted,
  } = useHiddenNavItems()
  const { collapsed, toggle: toggleCollapsed } = useCollapsedCategories()
  const { sidebarHidden, toggleSidebarHidden } = useSidebarHidden()

  /* Right-click context menu state */
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; linkId: string; linkLabel: string
  } | null>(null)

  /* Show hidden items management panel */
  const [showHiddenMgr, setShowHiddenMgr] = useState(false)

  /* Customize sidebar panel */
  const [showCustomize, setShowCustomize] = useState(false)

  /* Listen for right-click events bubbled from NavLinkItem */
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ x: number; y: number; id: string; label: string }>
      setCtxMenu({ x: ev.detail.x, y: ev.detail.y, linkId: ev.detail.id, linkLabel: ev.detail.label })
    }
    document.addEventListener('zenith:nav-ctx', handler)
    return () => document.removeEventListener('zenith:nav-ctx', handler)
  }, [])

  /* Close context menu on click outside */
  useEffect(() => {
    if (!ctxMenu) return
    const handler = () => setCtxMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxMenu])

  /* ── Study mode transition styles ──────────────────────────
   * The sidebar translates left, the topbar translates up.
   * ─────────────────────────────────────────────────────────── */
  const EASE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'
  const EASE_IN  = 'cubic-bezier(0.16, 1, 0.3, 1)'

  const sidebarStyle: React.CSSProperties = {
    width:         sidebarHidden ? 0 : undefined,
    overflow:      sidebarHidden ? 'hidden' : undefined,
    transform:     isStudyModeActive ? 'translateX(-100%)' : 'translateX(0)',
    opacity:       isStudyModeActive ? 0 : 1,
    pointerEvents: isStudyModeActive ? 'none' : undefined,
    transition:    isStudyModeActive
      ? `width 300ms ${EASE_OUT}, transform 400ms ${EASE_OUT}, opacity 300ms ease`
      : `width 300ms ${EASE_IN},  transform 400ms ${EASE_IN},  opacity 300ms ease`,
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

  const hiddenCount = hidden.size

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
            <ZenithMark size={26} />
            <span className={styles.logoText}>Zenith</span>
            <button
              type="button"
              className={styles.sidebarCollapseBtn}
              onClick={toggleSidebarHidden}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              ‹
            </button>
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
              {NAV_CONFIG.map((cat) => {
                const isCatCollapsed = collapsed.has(cat.id)
                return (
                  <li key={cat.id} className={styles.categoryBlock}>

                    <button
                      type="button"
                      className={styles.categoryLabelBtn}
                      onClick={() => toggleCollapsed(cat.id)}
                      aria-expanded={!isCatCollapsed}
                      aria-label={`${isCatCollapsed ? 'Expand' : 'Collapse'} ${cat.label}`}
                    >
                      <span className={styles.categoryLabelText}>{cat.label}</span>
                      <span
                        className={styles.collapseChevron}
                        style={{ transform: isCatCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </button>

                    <div
                      className={styles.categoryContent}
                      style={{
                        display: isCatCollapsed ? 'none' : undefined,
                      }}
                    >
                      {/* Sub-categories (Zenith Essentials) */}
                      {cat.subcategories?.map((sub) => (
                        <div key={sub.id} className={styles.subCatBlock}>
                          <p className={styles.subCatLabel}>{sub.label}</p>
                          <ul className={styles.navList}>
                            {sub.links
                              .filter(link => !hiddenMounted || !hidden.has(link.id))
                              .map(link => (
                              <NavLinkItem
                                key={link.id}
                                link={link}
                                active={activeView === link.id}
                                badge={badges[link.id] ?? 0}
                                onClick={() => handleLink(link)}
                                onHide={() => {
                                  hideItem(link.id)
                                  toast(`"${link.label}" hidden from sidebar.`, 'info')
                                }}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}

                      {/* Direct links (Creator's Choice, Personalized Vault) */}
                      {cat.links
                        ?.filter(link => !hiddenMounted || !hidden.has(link.id))
                        .map(link => (
                        <ul key={link.id} className={styles.navList}>
                          <NavLinkItem
                            link={link}
                            active={activeView === link.id}
                            badge={badges[link.id] ?? 0}
                            onClick={() => handleLink(link)}
                            onHide={() => {
                              hideItem(link.id)
                              toast(`"${link.label}" hidden from sidebar.`, 'info')
                            }}
                          />
                        </ul>
                      ))}
                    </div>

                  </li>
                )
              })}

            </ul>
          </nav>

          <footer className={styles.sidebarFooter}>
            {/* Hidden items manager button */}
            {hiddenCount > 0 && (
              <button
                type="button"
                className={styles.navItem}
                onClick={() => setShowHiddenMgr(true)}
                style={{
                  '--item-hover-bg': 'rgba(124, 149, 255, 0.08)',
                  '--item-accent':   'var(--text-dark)',
                } as React.CSSProperties}
              >
                <span className={styles.navIcon} aria-hidden="true">⊕</span>
                <span className={styles.navLabel}>
                  Show Hidden ({hiddenCount})
                </span>
              </button>
            )}

            <button
              type="button"
              className={styles.navItem}
              onClick={() => { setShowCustomize(s => !s); setShowHiddenMgr(false) }}
              aria-label="Customize sidebar"
              style={{
                '--item-hover-bg': 'rgba(124, 149, 255, 0.08)',
                '--item-accent':   'var(--text-muted)',
              } as React.CSSProperties}
            >
              <span className={styles.navIcon} aria-hidden="true">⊞</span>
              <span className={styles.navLabel}>Customize Sidebar</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${activeView === 'friends-network' ? styles.navItemActive : ''}`}
              onClick={() => navigate('friends-network', 'essentials')}
              aria-label="Open Friends"
              style={{
                '--item-hover-bg': 'rgba(124, 149, 255, 0.08)',
                '--item-accent':   'var(--accent-green)',
              } as React.CSSProperties}
            >
              <span className={styles.navIcon} aria-hidden="true">◎</span>
              <span className={styles.navLabel}>Friends</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${activeView === 'settings' ? styles.navItemActive : ''}`}
              onClick={() => navigate('settings', null as unknown as typeof activeCategory)}
              aria-label="Open Settings"
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

      {/* ── Context menu (right-click on nav item) ──────────── */}
      {ctxMenu && (
        <div
          className={styles.ctxMenu}
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          role="menu"
          aria-label={`Options for ${ctxMenu.linkLabel}`}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.ctxMenuItem}
            role="menuitem"
            onClick={() => {
              hideItem(ctxMenu.linkId)
              toast(`"${ctxMenu.linkLabel}" hidden from sidebar.`, 'info')
              setCtxMenu(null)
            }}
          >
            <span aria-hidden="true">⊖</span> Hide from sidebar
          </button>
        </div>
      )}

      {/* ── Hidden items management panel ───────────────────── */}
      {showHiddenMgr && (
        <>
          <div className={styles.ctxBackdrop} onClick={() => setShowHiddenMgr(false)} aria-hidden="true" />
          <div className={styles.hiddenMgrPanel} role="dialog" aria-label="Manage hidden nav items">
            <div className={styles.hiddenMgrHeader}>
              <p className={styles.hiddenMgrTitle}>Hidden Nav Items</p>
              <button
                type="button"
                className={styles.hiddenMgrClose}
                onClick={() => setShowHiddenMgr(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* All hidden nav items with restore buttons */}
            {NAV_CONFIG.flatMap(cat => [
              ...(cat.subcategories?.flatMap(sub => sub.links) ?? []),
              ...(cat.links ?? []),
            ])
              .filter(link => hidden.has(link.id))
              .map(link => (
                <div key={link.id} className={styles.hiddenMgrRow}>
                  <span className={styles.hiddenMgrLabel}>{link.label}</span>
                  <button
                    type="button"
                    className={styles.hiddenMgrShowBtn}
                    onClick={() => {
                      showItem(link.id)
                      if (hidden.size <= 1) setShowHiddenMgr(false)
                    }}
                  >
                    Show
                  </button>
                </div>
              ))}

            {hiddenCount > 1 && (
              <button
                type="button"
                className={styles.hiddenMgrShowAll}
                onClick={() => { showAll(); setShowHiddenMgr(false) }}
              >
                Show all
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Customize Sidebar panel ─────────────────────────── */}
      {showCustomize && (
        <>
          <div className={styles.ctxBackdrop} onClick={() => setShowCustomize(false)} aria-hidden="true" />
          <div className={styles.customizePanel} role="dialog" aria-label="Customize sidebar visibility">
            <div className={styles.hiddenMgrHeader}>
              <p className={styles.hiddenMgrTitle}>Customize Sidebar</p>
              <button
                type="button"
                className={styles.hiddenMgrClose}
                onClick={() => setShowCustomize(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.customizePanelScroll}>
              {NAV_CONFIG.map(cat => {
                const allLinks = [
                  ...(cat.subcategories?.flatMap(sub => sub.links) ?? []),
                  ...(cat.links ?? []),
                ]
                return (
                  <div key={cat.id}>
                    <p className={styles.customizeSectionLabel}>{cat.label}</p>
                    {allLinks.map(link => {
                      const isVisible = !hidden.has(link.id)
                      return (
                        <div key={link.id} className={styles.hiddenMgrRow}>
                          <span
                            className={styles.hiddenMgrLabel}
                            style={{ color: isVisible ? 'var(--text-muted)' : 'var(--text-dark)' }}
                          >
                            {link.label}
                          </span>
                          <span
                            className={`${styles.customizeToggle} ${isVisible ? styles.customizeToggleOn : ''}`}
                            onClick={() => isVisible ? hideItem(link.id) : showItem(link.id)}
                            role="switch"
                            aria-checked={isVisible}
                            tabIndex={0}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                isVisible ? hideItem(link.id) : showItem(link.id)
                              }
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── DB side-effects: badge sync + profile seed ──────── */}
      <BadgeSyncEffect />

      {/* ── Content Frame: Topbar + scrollable viewport ─────── */}
      <div className={styles.contentFrame}>
        <div style={topbarStyle} aria-hidden={isStudyModeActive}>
          <Topbar
            sidebarOpen={open}
            onToggleSidebar={() => setOpen(o => !o)}
          />
        </div>
        <MentalHealthBurnoutBanner />

        <div
          className={styles.viewport}
          data-category={activeCategory ?? 'essentials'}
        >
          {children}
        </div>
      </div>

      {/* ── Study mode cockpit overlay ───────────────────────── */}
      <StudyLayoutContainer />

      {/* ── Sidebar reveal button (shown when sidebar is hidden) ── */}
      {sidebarHidden && (
        <button
          type="button"
          className={styles.sidebarRevealBtn}
          onClick={toggleSidebarHidden}
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          ›
        </button>
      )}

      {/* ── Mobile backdrop ──────────────────────────────────── */}
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
  link, active, badge, onClick, onHide,
}: {
  link:    NavLink
  active:  boolean
  badge:   number
  onClick: () => void
  onHide:  () => void
}) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Dispatch a custom event so the parent can show the menu
    const event = new CustomEvent('zenith:nav-ctx', {
      detail: { x: e.clientX, y: e.clientY, id: link.id, label: link.label },
      bubbles: true,
    })
    e.currentTarget.dispatchEvent(event)
  }

  return (
    <li>
      <button
        type="button"
        className={`${styles.navItem} ${styles.navItemIndented} ${active ? styles.navItemActive : ''}`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        style={{
          '--item-hover-bg':  hexToRgba(link.color, 0.12),
          '--item-active-bg': hexToRgba(link.color, 0.18),
          '--item-accent':    link.color,
          '--item-border':    hexToRgba(link.color, 0.55),
        } as React.CSSProperties}
      >
        <span className={styles.navDot} aria-hidden="true" />
        <span className={styles.navLabel}>{link.label}</span>

        {badge > 0 && (
          <span className={styles.badge} aria-label={`${badge} pending`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    </li>
  )
}
