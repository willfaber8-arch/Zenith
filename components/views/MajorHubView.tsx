'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — MajorHubView
 * Phase 2 · Step 2.4 — Major-Specific Link Matrix & Resource Hub
 *
 * Orchestrator view for the Major Hub module. Reads majorIdentifier
 * from userProfile (IndexedDB via useLiveQuery) and conditionally
 * renders one of five states:
 *
 *   Loading         → blank shell (brief, profile hydrates fast)
 *   No major        → <MajorSelector>   (onboarding combobox)
 *   Config loading  → pulsing label     (dynamic import in flight)
 *   Coming soon     → <MajorNoData>     (major not yet mapped)
 *   Hub ready       → <MajorHub>        (resource link grid)
 *
 * key={majorIdentifier} on MajorHub drives a remount + animation
 * replay every time the active major changes (same pattern as
 * UniHubView → UniversityHub).
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import { useAuth }       from '@/lib/AuthContext'
import { db }            from '@/lib/db'
import MajorSelector     from '@/components/MajorSelector'
import MajorHub          from '@/components/MajorHub'
import {
  MAJOR_REGISTRY,
  getMajorConfig,
  type MajorConfig,
  type MajorEntry,
} from '@/config/majors'
import styles from './MajorHubView.module.css'

export default function MajorHubView() {
  const { session } = useAuth()

  /* ── Live profile from IndexedDB ────────────────────────── */
  const profile = useLiveQuery(
    async () => (db ? db.userProfile.get(1) : undefined),
    [],
  )

  /* ── Registry entry for the stored majorIdentifier ──────── */
  const majorEntry: MajorEntry | null = profile?.majorIdentifier
    ? (MAJOR_REGISTRY.find(
        m => m.name.toLowerCase() === profile.majorIdentifier.toLowerCase(),
      ) ?? null)
    : null

  /* ── Lazy-loaded MajorConfig ─────────────────────────────── */
  const [majorConfig,    setMajorConfig]    = useState<MajorConfig | null>(null)
  const [configLoading,  setConfigLoading]  = useState(false)

  useEffect(() => {
    if (!majorEntry?.hasData) {
      setMajorConfig(null)
      return
    }
    setConfigLoading(true)
    getMajorConfig(majorEntry.id)
      .then(cfg  => { setMajorConfig(cfg);   setConfigLoading(false) })
      .catch(()  => { setMajorConfig(null);  setConfigLoading(false) })
  }, [majorEntry?.id, majorEntry?.hasData])

  /* ── DB write helpers ────────────────────────────────────── */

  const handleSelect = useCallback(async (entry: MajorEntry) => {
    if (!db) return
    const existing = await db.userProfile.get(1)
    if (existing) {
      await db.userProfile.update(1, { majorIdentifier: entry.name })
    } else {
      await db.userProfile.put({
        id:              1,
        userName:        session?.userHandle ?? 'Zenith User',
        universityName:  '',
        majorIdentifier: entry.name,
        lastActiveAt:    Date.now(),
      })
    }
  }, [session?.userHandle])

  const handleReset = useCallback(async () => {
    if (!db) return
    await db.userProfile.update(1, { majorIdentifier: '' })
    setMajorConfig(null)
  }, [])

  /* ── Render states ───────────────────────────────────────── */

  if (profile === undefined) {
    return <div className={styles.loadingShell} aria-hidden="true" />
  }

  if (!profile?.majorIdentifier) {
    return <MajorSelector key="major-selector" onSelect={handleSelect} />
  }

  if (majorEntry?.hasData && configLoading) {
    return (
      <div className={styles.loadingState}>
        <p className={styles.loadingLabel}>Loading {profile.majorIdentifier}…</p>
      </div>
    )
  }

  if (!majorEntry || !majorEntry.hasData || !majorConfig) {
    return (
      <MajorNoData
        majorName={profile.majorIdentifier}
        onReset={handleReset}
      />
    )
  }

  return (
    <MajorHub
      key={profile.majorIdentifier}
      config={majorConfig}
      entry={majorEntry}
      onReset={handleReset}
    />
  )
}

/* ════════════════════════════════════════════════════════════
   MajorNoData — shown when a major is in the registry with
   hasData: false, or when the user typed a freeform string
   not matching any registry entry.
   ════════════════════════════════════════════════════════════ */

function MajorNoData({
  majorName,
  onReset,
}: {
  majorName: string
  onReset:   () => void
}) {
  return (
    <div className={`${styles.noDataWrap} anim-scale-in`}>

      <div className={`${styles.noDataActions} anim-slide-in delay-1`}>
        <button
          type="button"
          className={styles.changeBtn}
          onClick={onReset}
        >
          ← Change Major
        </button>
        <p className={styles.noDataHint}>
          Currently, only Engineering has a full resource hub. More major tracks
          are being mapped and will launch progressively.
        </p>
      </div>

    </div>
  )
}
