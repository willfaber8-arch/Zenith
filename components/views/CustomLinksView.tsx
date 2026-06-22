'use client'

import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import { db }            from '@/lib/db'
import type { CustomBookmark } from '@/lib/db'
import styles from './CustomLinksView.module.css'

/* ── Favicon helper ──────────────────────────────────────────── */

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

function FaviconImg({ url, label }: { url: string; label: string }) {
  const domain = getDomain(url)
  const [err,   setErr]   = useState(false)
  const letter = label.trim().charAt(0).toUpperCase() || '?'

  if (!domain || err) {
    return (
      <div className={styles.faviconFallback} aria-hidden="true">
        {letter}
      </div>
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className={styles.favicon}
      onError={() => setErr(true)}
    />
  )
}

/* ── Add/Edit modal ──────────────────────────────────────────── */

interface BookmarkForm {
  label:       string
  url:         string
  description: string
  folderName:  string
  newCategory: string
}

const EMPTY_FORM: BookmarkForm = { label: '', url: '', description: '', folderName: 'General', newCategory: '' }

interface AddModalProps {
  categories: string[]
  onSave:     (form: BookmarkForm) => void
  onClose:    () => void
  initial?:   Partial<BookmarkForm> & { id?: number }
}

function AddModal({ categories, onSave, onClose, initial }: AddModalProps) {
  const [form, setForm] = useState<BookmarkForm>({
    ...EMPTY_FORM,
    ...initial,
    folderName: initial?.folderName ?? categories[0] ?? 'General',
  })
  const [useNewCat, setUseNewCat] = useState(false)

  const set = (k: keyof BookmarkForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const effectiveCategory = useNewCat
    ? (form.newCategory.trim() || 'General')
    : form.folderName

  const handleSave = () => {
    if (!form.label.trim() || !form.url.trim()) return
    onSave({ ...form, folderName: effectiveCategory })
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} anim-scale-in`} onKeyDown={handleKey}>

        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{initial?.id ? 'Edit Link' : 'Add Link'}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>

          <label className={styles.fieldLabel}>
            Name <span className={styles.required}>*</span>
          </label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. Linear, Notion, GitHub"
            value={form.label}
            onChange={set('label')}
            autoFocus
          />

          <label className={styles.fieldLabel}>
            URL <span className={styles.required}>*</span>
          </label>
          <input
            className={styles.fieldInput}
            placeholder="https://example.com"
            value={form.url}
            onChange={set('url')}
            type="url"
          />

          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="Brief description (optional)"
            value={form.description}
            onChange={set('description')}
            rows={2}
            maxLength={160}
          />

          <label className={styles.fieldLabel}>Category</label>
          <div className={styles.categoryRow}>
            <select
              className={styles.fieldSelect}
              value={useNewCat ? '__new__' : form.folderName}
              onChange={e => {
                if (e.target.value === '__new__') { setUseNewCat(true) }
                else { setUseNewCat(false); setForm(f => ({ ...f, folderName: e.target.value })) }
              }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ New category…</option>
            </select>
            {useNewCat && (
              <input
                className={styles.fieldInput}
                placeholder="Category name"
                value={form.newCategory}
                onChange={set('newCategory')}
                autoFocus
              />
            )}
          </div>

        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!form.label.trim() || !form.url.trim()}
          >
            {initial?.id ? 'Save Changes' : 'Add Link'}
          </button>
        </div>

      </div>
    </div>
  )
}

/* ── Link card ───────────────────────────────────────────────── */

interface LinkCardProps {
  bookmark:  CustomBookmark
  onDelete:  (id: number) => void
  onEdit:    (b: CustomBookmark) => void
}

function LinkCard({ bookmark, onDelete, onEdit }: LinkCardProps) {
  const displayUrl = (() => {
    try {
      const u = new URL(bookmark.url)
      return u.hostname + (u.pathname !== '/' ? u.pathname : '')
    } catch { return bookmark.url }
  })()

  return (
    <div className={styles.card}>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.cardLink}
        aria-label={`Open ${bookmark.label}`}
      >
        <div className={styles.cardIconWrap}>
          <FaviconImg url={bookmark.url} label={bookmark.label} />
        </div>
        <div className={styles.cardBody}>
          <span className={styles.cardName}>{bookmark.label}</span>
          {bookmark.description && (
            <span className={styles.cardDesc}>{bookmark.description}</span>
          )}
          <span className={styles.cardUrl}>{displayUrl}</span>
        </div>
        <span className={styles.cardArrow} aria-hidden="true">↗</span>
      </a>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.cardActionBtn}
          onClick={() => onEdit(bookmark)}
          aria-label="Edit link"
        >
          ✎
        </button>
        <button
          type="button"
          className={`${styles.cardActionBtn} ${styles.cardDeleteBtn}`}
          onClick={() => onDelete(bookmark.id)}
          aria-label="Delete link"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/* ── Main view ───────────────────────────────────────────────── */

export default function CustomLinksView() {
  const rawBookmarks = useLiveQuery(
    () => db?.customBookmarks?.toArray().catch(() => []) ?? Promise.resolve([]),
    [],
  ) ?? []

  const bookmarks = useMemo(
    () => [...rawBookmarks].sort((a, b) => a.addedAt - b.addedAt),
    [rawBookmarks],
  )

  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState<CustomBookmark | null>(null)

  /* Derived category list */
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const b of bookmarks) if (b.folderName) set.add(b.folderName)
    return [...set].sort()
  }, [bookmarks])

  const allCategories = useMemo(
    () => (categories.length ? categories : ['General']),
    [categories],
  )

  /* Filtered links */
  const displayed = useMemo(
    () => activeCategory === 'All'
      ? bookmarks
      : bookmarks.filter(b => b.folderName === activeCategory),
    [bookmarks, activeCategory],
  )

  /* Handlers */
  const handleSave = useCallback(async (form: BookmarkForm) => {
    if (editing) {
      await db.customBookmarks.update(editing.id, {
        label:       form.label.trim(),
        url:         form.url.trim(),
        description: form.description.trim(),
        folderName:  form.folderName,
      })
      setEditing(null)
    } else {
      await db.customBookmarks.add({
        label:       form.label.trim(),
        url:         form.url.trim(),
        description: form.description.trim(),
        folderName:  form.folderName,
        addedAt:     Date.now(),
      } as Omit<CustomBookmark, 'id'>)
      setShowAdd(false)
      // Auto-switch to the saved category
      setActiveCategory(form.folderName)
    }
  }, [editing])

  const handleDelete = useCallback(async (id: number) => {
    await db.customBookmarks.delete(id)
  }, [])

  const handleEdit = useCallback((b: CustomBookmark) => {
    setEditing(b)
  }, [])

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of bookmarks) m[b.folderName] = (m[b.folderName] ?? 0) + 1
    return m
  }, [bookmarks])

  return (
    <div className={styles.wrap}>

      {/* Category tab bar + Add button */}
      <div className={`${styles.tabBar} anim-fade-in delay-1`}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'All'}
            className={`${styles.tab} ${activeCategory === 'All' ? styles.tabActive : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            All
            <span className={styles.tabCount}>{bookmarks.length}</span>
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {categoryCounts[cat] != null && (
                <span className={styles.tabCount}>{categoryCounts[cat]}</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowAdd(true)}
        >
          + Add Link
        </button>
      </div>

      {/* Link grid */}
      <div className="anim-fade-in delay-2">
        {displayed.length > 0 ? (
          <div className={styles.grid}>
            {displayed.map(b => (
              <LinkCard
                key={b.id}
                bookmark={b}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>🔗</p>
            <p className={styles.emptyTitle}>No links yet</p>
            <p className={styles.emptyBody}>
              {activeCategory === 'All'
                ? 'Click "+ Add Link" to save your first website.'
                : `No links in "${activeCategory}" yet.`}
            </p>
            <button
              type="button"
              className={styles.emptyAddBtn}
              onClick={() => setShowAdd(true)}
            >
              + Add Link
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddModal
          categories={allCategories}
          onSave={handleSave}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && (
        <AddModal
          categories={allCategories}
          initial={{
            id:          editing.id,
            label:       editing.label,
            url:         editing.url,
            description: editing.description ?? '',
            folderName:  editing.folderName,
          }}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

    </div>
  )
}
