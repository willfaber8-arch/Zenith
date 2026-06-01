'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — UniHubView
 * Phase 2 · Step 2.3 — Polymorphic University Search & Content Node
 *
 * Orchestrator view for the University Hub module. Reads
 * universityName from userProfile (IndexedDB via useLiveQuery)
 * and conditionally renders one of four states:
 *
 *   Loading         → blank shell (brief, profile hydrates fast)
 *   No university   → <UniSelector>     (onboarding autocomplete)
 *   Coming soon     → <UniNoData>        (university not yet mapped)
 *   Hub ready       → <UniversityHub>   (resource link grid)
 *
 * The hub transitions from selector to grid via a key-driven
 * remount, which replays the anim-scale-in entrance animation
 * every time the active institution changes.
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import { useAuth }       from '@/lib/AuthContext'
import { db }            from '@/lib/db'
import ZenHeading        from '@/components/ui/ZenHeading'
import UniSelector       from '@/components/UniSelector'
import UniversityHub     from '@/components/UniversityHub'
import {
  UNIVERSITY_REGISTRY,
  getUniversityConfig,
  type UniversityConfig,
  type UniversityEntry,
} from '@/config/universities'
import styles from './UniHubView.module.css'

export default function UniHubView() {
  const { session } = useAuth()

  /* ── Live profile from IndexedDB ────────────────────────── */
  const profile = useLiveQuery(
    async () => (db ? db.userProfile.get(1) : undefined),
    [],
  )

  /* ── Registry entry for the stored universityName ────────── */
  const uniEntry: UniversityEntry | null = profile?.universityName
    ? (UNIVERSITY_REGISTRY.find(
        u => u.name.toLowerCase() === profile.universityName.toLowerCase(),
      ) ?? null)
    : null

  /* ── Lazy-loaded UniversityConfig ────────────────────────── */
  const [uniConfig,      setUniConfig]      = useState<UniversityConfig | null>(null)
  const [configLoading,  setConfigLoading]  = useState(false)

  useEffect(() => {
    if (!uniEntry?.hasData) {
      setUniConfig(null)
      return
    }
    setConfigLoading(true)
    getUniversityConfig(uniEntry.id)
      .then(cfg  => { setUniConfig(cfg);   setConfigLoading(false) })
      .catch(()  => { setUniConfig(null);  setConfigLoading(false) })
  }, [uniEntry?.id, uniEntry?.hasData])

  /* ── DB write helpers ────────────────────────────────────── */

  const handleSelect = useCallback(async (entry: UniversityEntry) => {
    if (!db) return
    const existing = await db.userProfile.get(1)
    if (existing) {
      await db.userProfile.update(1, { universityName: entry.name })
    } else {
      // Profile hasn't been seeded yet — create a minimal record
      await db.userProfile.put({
        id:              1,
        userName:        session?.userHandle ?? 'Zenith User',
        universityName:  entry.name,
        majorIdentifier: '',
        expPoints:       0,
        currentLevel:    1,
        healthPoints:    100,
        lastActiveAt:    Date.now(),
      })
    }
  }, [session?.userHandle])

  const handleReset = useCallback(async () => {
    if (!db) return
    await db.userProfile.update(1, { universityName: '' })
    setUniConfig(null)
  }, [])

  /* ── Render states ───────────────────────────────────────── */

  // 1. Profile not yet hydrated from IndexedDB
  if (profile === undefined) {
    return <div className={styles.loadingShell} aria-hidden="true" />
  }

  // 2. No university configured → show onboarding selector
  if (!profile?.universityName) {
    return <UniSelector key="selector" onSelect={handleSelect} />
  }

  // 3. University set but config is still loading (dynamic import in flight)
  if (uniEntry?.hasData && configLoading) {
    return (
      <div className={styles.loadingState}>
        <p className={styles.loadingLabel}>Loading {profile.universityName}…</p>
      </div>
    )
  }

  // 4. University in registry but no data file yet
  if (!uniEntry || !uniEntry.hasData || !uniConfig) {
    return (
      <UniNoData
        universityName={profile.universityName}
        onReset={handleReset}
      />
    )
  }

  // 5. Full hub — key on universityName so entrance animation replays on change
  return (
    <UniversityHub
      key={profile.universityName}
      config={uniConfig}
      entry={uniEntry}
      onReset={handleReset}
    />
  )
}

/* ════════════════════════════════════════════════════════════
   UniNoData — inline component for recognised but unmapped
   institutions. Shown when a university is in the registry
   with hasData: false, or when it's freeform text not in
   the registry at all.
   ════════════════════════════════════════════════════════════ */

function UniNoData({
  universityName,
  onReset,
}: {
  universityName: string
  onReset: () => void
}) {
  return (
    <div className={`${styles.noDataWrap} anim-scale-in`}>

      <div className={styles.noDataHeading}>
        <ZenHeading
          eyebrow="Scholastic · University Hub"
          title={universityName}
          subtitle="Zenith is building a full resource integration for your institution. The complete link database will be activated in a future phase."
          size="md"
        />
      </div>

      <div className={`${styles.noDataActions} anim-slide-in delay-1`}>
        <button
          type="button"
          className={styles.changeBtn}
          onClick={onReset}
        >
          ← Change University
        </button>
        <p className={styles.noDataHint}>
          Currently, only Cornell University has a full data integration.
        </p>
      </div>

    </div>
  )
}
