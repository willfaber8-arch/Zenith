'use client'

import { useState, useCallback, useMemo } from 'react'
import type { UniversityConfig, UniversityEntry, UniTab, UniLink } from '@/config/universities'
import styles from './UniversityHub.module.css'

interface UniversityHubProps {
  config:  UniversityConfig
  entry:   UniversityEntry
  onReset: () => void
}

/* ── Customization prefs per university ────────────────────────── */

interface UniHubPrefs {
  pinned: string[]                   // link IDs that appear in Important tab
  hidden: string[]                   // link IDs suppressed from their tab
  order:  Record<string, string[]>   // categoryId → ordered link IDs
}

const EMPTY_PREFS: UniHubPrefs = { pinned: [], hidden: [], order: {} }

function prefsKey(uniId: string) {
  return `zenith_uni_hub_prefs_v1_${uniId}`
}

function loadPrefs(uniId: string): UniHubPrefs {
  if (typeof window === 'undefined') return EMPTY_PREFS
  try {
    const raw = localStorage.getItem(prefsKey(uniId))
    if (!raw) return EMPTY_PREFS
    return JSON.parse(raw) as UniHubPrefs
  } catch {
    return EMPTY_PREFS
  }
}

function savePrefs(uniId: string, prefs: UniHubPrefs) {
  try {
    localStorage.setItem(prefsKey(uniId), JSON.stringify(prefs))
  } catch { /* storage unavailable */ }
}

/* ── Types ─────────────────────────────────────────────────────── */

type DisplayTab = UniTab | 'important'

const UNI_TAB_LABELS: Record<UniTab, string> = {
  academics:  'Academics & Registration',
  career:     'Career Development',
  campus:     'Campus Life',
  essentials: 'Essentials',
}

/* ── Helper: apply order prefs to a link array ──────────────────── */

function applyOrder(links: UniLink[], orderedIds: string[]): UniLink[] {
  if (!orderedIds.length) return links
  const map = new Map(links.map(l => [l.id, l]))
  const ordered: UniLink[] = []
  for (const id of orderedIds) {
    const l = map.get(id)
    if (l) { ordered.push(l); map.delete(id) }
  }
  // Append any links not yet in the order list
  for (const l of map.values()) ordered.push(l)
  return ordered
}

/* ── Main component ─────────────────────────────────────────────── */

export default function UniversityHub({ config, entry, onReset }: UniversityHubProps) {
  const [activeTab, setActiveTab] = useState<DisplayTab>('academics')
  const [editMode,  setEditMode]  = useState(false)
  const [prefs, setPrefs] = useState<UniHubPrefs>(() => loadPrefs(entry.id))

  /* Persist prefs whenever they change */
  const updatePrefs = useCallback((next: UniHubPrefs) => {
    setPrefs(next)
    savePrefs(entry.id, next)
  }, [entry.id])

  /* Total resource count */
  const totalLinks = config.categories.reduce((acc, c) => acc + c.links.length, 0)

  /* Which UniTabs have data */
  const availableUniTabs = (Object.keys(UNI_TAB_LABELS) as UniTab[]).filter(
    tab => config.categories.some(c => c.tab === tab),
  )

  /* Pinned links (in their original order, deduplicated) */
  const pinnedLinks = useMemo(() => {
    const all: Array<UniLink & { catLabel: string }> = []
    const seen = new Set<string>()
    for (const id of prefs.pinned) {
      for (const cat of config.categories) {
        const link = cat.links.find(l => l.id === id)
        if (link && !seen.has(id)) {
          all.push({ ...link, catLabel: cat.label })
          seen.add(id)
        }
      }
    }
    return all
  }, [prefs.pinned, config.categories])

  /* ── Pin / unpin ─────────────────────────────────────────────── */
  const togglePin = useCallback((linkId: string) => {
    updatePrefs({
      ...prefs,
      pinned: prefs.pinned.includes(linkId)
        ? prefs.pinned.filter(id => id !== linkId)
        : [...prefs.pinned, linkId],
    })
  }, [prefs, updatePrefs])

  /* ── Hide / restore ──────────────────────────────────────────── */
  const toggleHide = useCallback((linkId: string) => {
    updatePrefs({
      ...prefs,
      hidden: prefs.hidden.includes(linkId)
        ? prefs.hidden.filter(id => id !== linkId)
        : [...prefs.hidden, linkId],
      // Also unpin if hiding
      pinned: prefs.hidden.includes(linkId)
        ? prefs.pinned
        : prefs.pinned.filter(id => id !== linkId),
    })
  }, [prefs, updatePrefs])

  /* ── Move within category ────────────────────────────────────── */
  const moveLink = useCallback((catId: string, linkId: string, dir: -1 | 1, orderedLinks: UniLink[]) => {
    const ids = orderedLinks.map(l => l.id)
    const idx = ids.indexOf(linkId)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= ids.length) return
    const next = [...ids]
    next.splice(idx, 1)
    next.splice(newIdx, 0, linkId)
    updatePrefs({ ...prefs, order: { ...prefs.order, [catId]: next } })
  }, [prefs, updatePrefs])

  /* ── Reset all prefs ─────────────────────────────────────────── */
  const resetPrefs = useCallback(() => {
    updatePrefs(EMPTY_PREFS)
  }, [updatePrefs])

  /* ── Render a single link card ───────────────────────────────── */
  function LinkCard({
    link,
    catId,
    orderedLinks,
    showCatLabel,
  }: {
    link: UniLink & { catLabel?: string }
    catId: string
    orderedLinks: UniLink[]
    showCatLabel?: boolean
  }) {
    const isPinned = prefs.pinned.includes(link.id)
    const isHidden = prefs.hidden.includes(link.id)
    const orderedIds = orderedLinks.map(l => l.id)
    const idx = orderedIds.indexOf(link.id)
    const isFirst = idx === 0
    const isLast  = idx === orderedIds.length - 1

    return (
      <div className={`${styles.cardWrapper} ${isHidden && editMode ? styles.cardWrapperHidden : ''}`}>
        {/* The actual link card */}
        <a
          href={isHidden && editMode ? undefined : link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.card} ${isPinned ? styles.cardPinned : ''} ${isHidden && editMode ? styles.cardHidden : ''}`}
          role="listitem"
          aria-label={`${link.title} — opens in a new tab`}
          tabIndex={isHidden && editMode ? -1 : 0}
        >
          {isPinned && !editMode && (
            <span className={styles.pinnedBadge} aria-label="Pinned to Important">★</span>
          )}
          {showCatLabel && link.catLabel && (
            <span className={styles.cardCatLabel}>{link.catLabel}</span>
          )}
          {link.tag && <span className={styles.tag} aria-hidden="true">{link.tag}</span>}
          <h3 className={styles.cardTitle}>{link.title}</h3>
          <p className={styles.cardDesc}>{link.description}</p>
          <span className={styles.linkAction} aria-hidden="true">Open →</span>
        </a>

        {/* Edit-mode controls */}
        {editMode && (
          <div className={styles.cardControls}>
            {isHidden ? (
              <button
                type="button"
                className={`${styles.controlBtn} ${styles.controlBtnRestore}`}
                onClick={() => toggleHide(link.id)}
              >
                ↩ Restore
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.controlBtn} ${isPinned ? styles.controlBtnPinActive : styles.controlBtnPin}`}
                  onClick={() => togglePin(link.id)}
                  title={isPinned ? 'Unpin from Important' : 'Pin to Important'}
                >
                  {isPinned ? '★ Pinned' : '☆ Pin'}
                </button>
                <button
                  type="button"
                  className={`${styles.controlBtn} ${styles.controlBtnMove}`}
                  onClick={() => moveLink(catId, link.id, -1, orderedLinks)}
                  disabled={isFirst}
                  aria-label="Move left"
                >
                  ← Move
                </button>
                <button
                  type="button"
                  className={`${styles.controlBtn} ${styles.controlBtnMove}`}
                  onClick={() => moveLink(catId, link.id, 1, orderedLinks)}
                  disabled={isLast}
                  aria-label="Move right"
                >
                  Move →
                </button>
                <button
                  type="button"
                  className={`${styles.controlBtn} ${styles.controlBtnHide}`}
                  onClick={() => toggleHide(link.id)}
                >
                  ✕ Hide
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ── Render Important tab content ────────────────────────────── */
  function ImportantTab() {
    if (pinnedLinks.length === 0) {
      return (
        <div className={styles.importantEmpty}>
          <p className={styles.importantEmptyGlyph}>★</p>
          <p className={styles.importantEmptyTitle}>No pinned resources yet</p>
          <p className={styles.importantEmptyBody}>
            Click{' '}
            <button type="button" className={styles.inlineEditTrigger} onClick={() => setEditMode(true)}>
              Customize
            </button>{' '}
            then tap <strong>☆ Pin</strong> on any resource to save it here.
          </p>
        </div>
      )
    }

    return (
      <div className={styles.categories}>
        <section className={`${styles.category} anim-slide-in`} aria-label="Pinned resources">
          <div className={styles.grid} role="list">
            {pinnedLinks.map(link => (
              <LinkCard
                key={link.id}
                link={link}
                catId="__important"
                orderedLinks={pinnedLinks}
                showCatLabel
              />
            ))}
          </div>
        </section>
      </div>
    )
  }

  /* ── Render regular tab content ──────────────────────────────── */
  function RegularTabContent() {
    const visibleCats = config.categories.filter(c => c.tab === (activeTab as UniTab))

    if (visibleCats.length === 0) {
      return <p className={styles.emptyTab}>No resources configured for this section.</p>
    }

    return (
      <div className={styles.categories}>
        {visibleCats.map((cat, catIdx) => {
          const orderedLinks = applyOrder(cat.links, prefs.order[cat.id] ?? [])
          const shownLinks   = editMode ? orderedLinks : orderedLinks.filter(l => !prefs.hidden.includes(l.id))
          const hiddenLinks  = editMode ? orderedLinks.filter(l => prefs.hidden.includes(l.id)) : []

          return (
            <section
              key={cat.id}
              className={`${styles.category} anim-slide-in`}
              style={{ animationDelay: `${catIdx * 60}ms` }}
              aria-labelledby={`cat-${cat.id}`}
            >
              <p id={`cat-${cat.id}`} className={styles.categoryLabel}>
                {cat.label}
                {editMode && hiddenLinks.length > 0 && (
                  <span className={styles.hiddenCount}> · {hiddenLinks.length} hidden</span>
                )}
              </p>

              <div className={styles.grid} role="list">
                {shownLinks.map(link => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    catId={cat.id}
                    orderedLinks={orderedLinks}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  /* ── Render ──────────────────────────────────────────────────── */
  const hasPins = prefs.pinned.length > 0
  const hiddenCount = prefs.hidden.length

  return (
    <div className={`${styles.wrap} anim-scale-in`}>

      {/* ── Hub header ────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <p className={styles.eyebrow}>Scholastic · University Hub</p>
          <h1 className={styles.uniName}>{config.name}</h1>
          <p className={styles.subline}>
            <span className={styles.sublineChip}>{config.location}</span>
            <span className={styles.sublineDot} aria-hidden="true">·</span>
            <span className={styles.sublineChip}>{totalLinks} resources</span>
            {hiddenCount > 0 && !editMode && (
              <>
                <span className={styles.sublineDot} aria-hidden="true">·</span>
                <span className={styles.sublineChipMuted}>{hiddenCount} hidden</span>
              </>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.editBtn} ${editMode ? styles.editBtnActive : ''}`}
            onClick={() => setEditMode(v => !v)}
          >
            {editMode ? 'Done' : '⊕ Customize'}
          </button>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={onReset}
            aria-label="Change university"
          >
            Change ↗
          </button>
        </div>
      </header>

      {/* ── Edit mode info bar ───────────────────────────────── */}
      {editMode && (
        <div className={styles.editInfoBar}>
          <span>☆ pin to Important</span>
          <span className={styles.editInfoSep}>·</span>
          <span>✕ hide from tab</span>
          <span className={styles.editInfoSep}>·</span>
          <span>← → reorder</span>
          {(prefs.pinned.length > 0 || prefs.hidden.length > 0 || Object.keys(prefs.order).length > 0) && (
            <>
              <span className={styles.editInfoSep}>·</span>
              <button type="button" className={styles.resetPrefsBtn} onClick={resetPrefs}>
                Reset all
              </button>
            </>
          )}
        </div>
      )}

      <div className={styles.divider} aria-hidden="true" />

      {/* ── Resource sub-tabs ─────────────────────────────────── */}
      <div className={styles.resourceTabBar} role="tablist" aria-label="Resource sections">
        {/* Important tab — always first */}
        <button
          key="important"
          role="tab"
          aria-selected={activeTab === 'important'}
          className={`${styles.resourceTab} ${activeTab === 'important' ? styles.resourceTabActive : ''} ${activeTab !== 'important' && hasPins ? styles.resourceTabImportant : ''}`}
          onClick={() => setActiveTab('important')}
        >
          ★ Important {hasPins ? `(${prefs.pinned.length})` : ''}
        </button>

        {availableUniTabs.map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.resourceTab} ${activeTab === tab ? styles.resourceTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {UNI_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────── */}
      {activeTab === 'important'
        ? <ImportantTab />
        : <RegularTabContent />
      }

    </div>
  )
}
