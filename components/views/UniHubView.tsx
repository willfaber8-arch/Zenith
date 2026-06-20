'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery }   from 'dexie-react-hooks'
import { useAuth }        from '@/lib/AuthContext'
import { useToast }       from '@/lib/ToastContext'
import { db }             from '@/lib/db'
import { applyFreeTheme, seedGamesDatabase } from '@/lib/gamesDb'
import {
  getUniversityBrand, uniThemeId, UNIVERSITY_THEME_DEFINITIONS,
} from '@/lib/universityThemes'
import ZenHeading         from '@/components/ui/ZenHeading'
import UniSelector        from '@/components/UniSelector'
import MajorSelector      from '@/components/MajorSelector'
import UniversityHub      from '@/components/UniversityHub'
import MajorHub           from '@/components/MajorHub'
import GpaSimulator       from '@/components/GpaSimulator'
import BrbBurnRate              from '@/components/BrbBurnRate'
import DeliveriesLogger         from '@/components/DeliveriesLogger'
import {
  UNIVERSITY_REGISTRY,
  getUniversityConfig,
  type UniversityConfig,
  type UniversityEntry,
} from '@/config/universities'
import {
  MAJOR_REGISTRY,
  getMajorConfig,
  type MajorConfig,
  type MajorEntry,
} from '@/config/majors'
import type { GpaScale } from '@/config/universities'
import styles from './UniHubView.module.css'

type TopTab = 'uni-resources' | 'major-resources' | 'gpa' | 'finances'

/* ── Setup state machine ──────────────────────────────────────
   Onboarding has three mini-steps shown on the start screen:
     step 1 → pick university
     step 2 → pick major  (after uni is chosen)
     done   → show hub
   ─────────────────────────────────────────────────────────── */

export default function UniHubView() {
  const { session } = useAuth()
  const { toast }   = useToast()
  const [activeTab, setActiveTab]     = useState<TopTab>('uni-resources')
  const [setupStep, setSetupStep]     = useState<'uni' | 'major' | 'done'>('done')
  /** University whose brand-theme switch is being offered (null = no prompt). */
  const [themePrompt, setThemePrompt] = useState<UniversityEntry | null>(null)

  /* ── Live profile ─────────────────────────────────────────── */
  const profile = useLiveQuery(
    async () => (db ? db.userProfile.get(1) : undefined),
    [],
  )

  /* ── Derived registry entries ─────────────────────────────── */
  const uniEntry: UniversityEntry | null = profile?.universityName
    ? (UNIVERSITY_REGISTRY.find(u =>
        u.name.toLowerCase() === profile.universityName.toLowerCase()
      ) ?? null)
    : null

  const majorEntry: MajorEntry | null = profile?.majorIdentifier
    ? (MAJOR_REGISTRY.find(m =>
        m.name.toLowerCase() === profile.majorIdentifier.toLowerCase() ||
        m.id.toLowerCase()   === profile.majorIdentifier.toLowerCase()
      ) ?? null)
    : null

  /* ── Lazy-loaded configs ──────────────────────────────────── */
  const [uniConfig,     setUniConfig]     = useState<UniversityConfig | null>(null)
  const [majorConfig,   setMajorConfig]   = useState<MajorConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  useEffect(() => {
    if (!uniEntry?.hasData) { setUniConfig(null); return }
    setConfigLoading(true)
    getUniversityConfig(uniEntry.id)
      .then(cfg  => { setUniConfig(cfg);  setConfigLoading(false) })
      .catch(()  => { setUniConfig(null); setConfigLoading(false) })
  }, [uniEntry?.id, uniEntry?.hasData])

  useEffect(() => {
    if (!majorEntry?.hasData) { setMajorConfig(null); return }
    getMajorConfig(majorEntry.id)
      .then(cfg  => { setMajorConfig(cfg);  })
      .catch(()  => { setMajorConfig(null); })
  }, [majorEntry?.id, majorEntry?.hasData])

  /* ── Determine setup step ─────────────────────────────────── */
  useEffect(() => {
    if (profile === undefined) return   // still loading
    if (!profile?.universityName) { setSetupStep('uni');   return }
    if (!profile?.majorIdentifier) { setSetupStep('major'); return }
    setSetupStep('done')
  }, [profile?.universityName, profile?.majorIdentifier, profile])

  /* ── DB write helpers ─────────────────────────────────────── */
  const upsertProfile = useCallback(async (patch: Partial<{
    universityName: string; majorIdentifier: string
  }>) => {
    if (!db) return
    const existing = await db.userProfile.get(1)
    if (existing) {
      await db.userProfile.update(1, patch)
    } else {
      await db.userProfile.put({
        id: 1,
        userName:        session?.userHandle ?? 'Zenith User',
        universityName:  '',
        majorIdentifier: '',
        lastActiveAt:    Date.now(),
        ...patch,
      })
    }
  }, [session?.userHandle])

  const handleSelectUni = useCallback(async (entry: UniversityEntry) => {
    await upsertProfile({ universityName: entry.name })
    setSetupStep('major')
    // Offer to theme all of Zenith in the school's colours, if we have a brand.
    if (getUniversityBrand(entry.id)) setThemePrompt(entry)
  }, [upsertProfile])

  /* ── University brand theme ───────────────────────────────── */
  const applyUniTheme = useCallback(async (uniId: string) => {
    try {
      await seedGamesDatabase()
      await applyFreeTheme(uniThemeId(uniId))
      const brand = getUniversityBrand(uniId)
      toast(`${brand?.name ?? 'School'} colors applied globally.`, 'success')
    } catch {
      toast('Could not apply school theme.', 'error')
    }
    setThemePrompt(null)
  }, [toast])

  /* ── Persist brand color for sidebar + scoped theming ──────── */
  useEffect(() => {
    const brand = uniEntry ? getUniversityBrand(uniEntry.id) : null
    try {
      if (brand?.primaryHex) {
        localStorage.setItem('zenith_uni_brand_v1', brand.primaryHex)
      } else {
        localStorage.removeItem('zenith_uni_brand_v1')
      }
    } catch { /* storage unavailable */ }
    // Notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent('zenith:uni-brand-change'))
  }, [uniEntry?.id])

  const handleSelectMajor = useCallback(async (entry: MajorEntry) => {
    await upsertProfile({ majorIdentifier: entry.name })
    setSetupStep('done')
  }, [upsertProfile])

  const handleSkipMajor = useCallback(async () => {
    await upsertProfile({ majorIdentifier: 'Undecided' })
    setSetupStep('done')
  }, [upsertProfile])

  const handleResetUni = useCallback(async () => {
    await upsertProfile({ universityName: '', majorIdentifier: '' })
    setUniConfig(null); setMajorConfig(null)
    setSetupStep('uni')
  }, [upsertProfile])

  const handleResetMajor = useCallback(async () => {
    await upsertProfile({ majorIdentifier: '' })
    setMajorConfig(null)
    setSetupStep('major')
  }, [upsertProfile])

  /* ── Render: loading ──────────────────────────────────────── */
  if (profile === undefined) {
    return <div className={styles.loadingShell} aria-hidden="true" />
  }

  /* ── Render: pick university ──────────────────────────────── */
  if (setupStep === 'uni') {
    return (
      <div className={`${styles.setupWrap} anim-scale-in`}>
        <div className={styles.setupHeading}>
          <ZenHeading
            eyebrow="Scholastic · University Hub"
            title="Select your University."
            subtitle="We'll load resources, a GPA calculator, and tools tailored to your institution."
            size="md"
          />
        </div>
        <UniSelector onSelect={handleSelectUni} />
      </div>
    )
  }

  /* ── Render: pick major ───────────────────────────────────── */
  if (setupStep === 'major') {
    return (
      <div className={`${styles.setupWrap} anim-scale-in`}>
        <div className={styles.setupHeading}>
          <ZenHeading
            eyebrow={`${profile?.universityName ?? 'University Hub'} · Major`}
            title="Select your Major."
            subtitle="We'll load major-specific resources alongside your university hub."
            size="md"
          />
        </div>
        <div className={styles.majorSetupBack}>
          <button type="button" className={styles.changeBtn} onClick={() => setSetupStep('uni')}>
            ← Change University
          </button>
        </div>
        <MajorSelector onSelect={handleSelectMajor} />
        <div className={styles.skipRow}>
          <button type="button" className={styles.skipBtn} onClick={handleSkipMajor}>
            Skip — I'll decide later
          </button>
        </div>
        {themePrompt && (
          <ThemePromptModal
            entry={themePrompt}
            onApply={() => applyUniTheme(themePrompt.id)}
            onDismiss={() => setThemePrompt(null)}
          />
        )}
      </div>
    )
  }

  /* ── Render: loading config ───────────────────────────────── */
  if (uniEntry?.hasData && configLoading) {
    return (
      <div className={styles.loadingState}>
        <p className={styles.loadingLabel}>Loading {profile?.universityName}…</p>
      </div>
    )
  }

  /* ── Render: no data for this university ──────────────────── */
  if (!uniEntry || !uniEntry.hasData || !uniConfig) {
    return (
      <UniNoData
        universityName={profile?.universityName ?? ''}
        majorName={profile?.majorIdentifier ?? ''}
        onResetUni={handleResetUni}
        onResetMajor={handleResetMajor}
      />
    )
  }

  /* ── Render: full hub ─────────────────────────────────────── */
  const gpaScale: GpaScale = uniConfig.gpaScale ?? '4.0'

  const TAB_LABELS: Record<TopTab, string> = {
    'uni-resources':   'University Resources',
    'major-resources': 'Major Resources',
    'gpa':             'GPA Calculator',
    'finances':        'Finances',
  }

  /* Scoped brand CSS vars — override accent without affecting rest of app */
  const brandThemeDef = UNIVERSITY_THEME_DEFINITIONS[uniThemeId(uniEntry.id)]
  const brandScopedStyle = brandThemeDef?.vars
    ? {
        ...Object.fromEntries(Object.entries(brandThemeDef.vars)),
        '--cat-accent':     brandThemeDef.vars['--accent-purple'],
        '--cat-accent-dim': brandThemeDef.vars['--accent-purple-dim'],
        '--cat-border':     brandThemeDef.vars['--border-subtle'],
      } as React.CSSProperties
    : {}

  return (
    <div key={uniEntry.id} className={`${styles.hubWrap} anim-scale-in`} style={brandScopedStyle}>

      {/* ── Hub identity strip ──────────────────────────────── */}
      <div className={styles.identityStrip}>
        <div className={styles.identityLeft}>
          <div className={styles.uniInitials}>
            {uniConfig.shortName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className={styles.identityUni}>{uniConfig.name}</p>
            {profile?.majorIdentifier && profile.majorIdentifier !== 'Undecided' && (
              <p className={styles.identityMajor}>{profile.majorIdentifier}</p>
            )}
            <p className={styles.identityLocation}>{uniConfig.location}</p>
          </div>
        </div>
        <div className={styles.identityActions}>
          {getUniversityBrand(uniEntry.id) && (
            <button
              type="button"
              className={styles.changeSmallBtn}
              onClick={() => applyUniTheme(uniEntry.id)}
              title={`Theme Zenith in ${uniConfig.shortName} colors`}
            >
              School Colors
            </button>
          )}
          <button type="button" className={styles.changeSmallBtn} onClick={handleResetUni}>
            Change University
          </button>
          <button type="button" className={styles.changeSmallBtn} onClick={handleResetMajor}>
            Change Major
          </button>
        </div>
      </div>

      {/* ── Top-level tab bar ───────────────────────────────── */}
      <div className={styles.subTabBar} role="tablist">
        {(Object.keys(TAB_LABELS) as TopTab[]).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.subTab} ${activeTab === tab ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── University Resources ────────────────────────────── */}
      <div className={activeTab === 'uni-resources' ? styles.tabPane : styles.tabPaneHidden}>
        <UniversityHub config={uniConfig} entry={uniEntry} onReset={handleResetUni} />
      </div>

      {/* ── Major Resources ─────────────────────────────────── */}
      <div className={activeTab === 'major-resources' ? styles.tabPane : styles.tabPaneHidden}>
        {majorEntry?.hasData && majorConfig ? (
          <MajorHub config={majorConfig} entry={majorEntry} onReset={handleResetMajor} />
        ) : (
          <div className={styles.noDataPane}>
            {profile?.majorIdentifier && profile.majorIdentifier !== 'Undecided' ? (
              <>
                <p className={styles.noDataTitle}>{profile.majorIdentifier}</p>
                <p className={styles.noDataBody}>
                  Major-specific resources for this field are coming soon.
                </p>
              </>
            ) : (
              <p className={styles.noDataBody}>
                No major selected yet.{' '}
                <button type="button" className={styles.inlineLink} onClick={handleResetMajor}>
                  Select a major
                </button>{' '}
                to see tailored resources.
              </p>
            )}
            <button type="button" className={styles.changeBtn} onClick={handleResetMajor}>
              ← Change Major
            </button>
          </div>
        )}
      </div>

      {/* ── GPA Calculator ──────────────────────────────────── */}
      <div className={activeTab === 'gpa' ? styles.tabPane : styles.tabPaneHidden}>
        <div className={styles.tabPadded}>
          <div className={styles.gpaHeader}>
            <p className={styles.gpaScaleNote}>
              Using <strong>{gpaScale === '4.3' ? 'Cornell 4.3' : 'Standard 4.0'}</strong> grading
              scale for {uniConfig.shortName}
            </p>
          </div>
          <GpaSimulator gpaScale={gpaScale} />
        </div>
      </div>

      {/* ── Finances ────────────────────────────────────────── */}
      <div className={activeTab === 'finances' ? styles.tabPane : styles.tabPaneHidden}>
        <div className={styles.tabPadded}>
          <p className={styles.financesNote}>
            Track your {uniConfig.currencyName ?? 'campus dining balance'} spend rate and manage your campus mailroom deliveries.
          </p>
          <BrbBurnRate currencyName={uniConfig.currencyName ?? 'Campus Dollars'} />
          <div style={{ marginTop: 'var(--sp-8)' }}>
            <DeliveriesLogger />
          </div>
        </div>
      </div>

    </div>
  )
}

/* ── UniNoData ────────────────────────────────────────────────── */
function UniNoData({
  universityName, majorName, onResetUni, onResetMajor,
}: {
  universityName: string; majorName: string
  onResetUni: () => void; onResetMajor: () => void
}) {
  return (
    <div className={`${styles.noDataWrap} anim-scale-in`}>
      <div className={styles.noDataHeading}>
        <ZenHeading
          eyebrow="Scholastic · University Hub"
          title={universityName}
          subtitle="Zenith is building a full resource integration for your institution. Check back in a future update."
          size="md"
        />
      </div>
      <div className={`${styles.noDataActions} anim-slide-in delay-1`}>
        <button type="button" className={styles.changeBtn} onClick={onResetUni}>
          ← Change University
        </button>
        <p className={styles.noDataHint}>
          Currently live: Cornell University, Texas A&M University, UT Austin.
        </p>
      </div>
    </div>
  )
}

/* ── ThemePromptModal ─────────────────────────────────────────────
   Offered after a university is selected — asks whether to recolour
   all of Zenith in that school's brand palette.
   ─────────────────────────────────────────────────────────────── */
function ThemePromptModal({
  entry, onApply, onDismiss,
}: {
  entry: UniversityEntry
  onApply: () => void
  onDismiss: () => void
}) {
  const brand = getUniversityBrand(entry.id)
  if (!brand) return null
  return (
    <div className={styles.themeModalBackdrop} onClick={onDismiss}>
      <div
        className={`${styles.themeModal} anim-scale-in`}
        role="dialog"
        aria-modal="true"
        aria-label={`Apply ${brand.name} theme`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.themeSwatchRow} aria-hidden="true">
          <span className={styles.themeSwatch} style={{ background: brand.primaryHex }} />
          <span className={styles.themeSwatch} style={{ background: brand.secondaryHex }} />
        </div>
        <p className={styles.themeModalTitle}>Wear your colors?</p>
        <p className={styles.themeModalBody}>
          Switch all of Zenith to <strong>{brand.name}</strong>&apos;s official palette. You can
          revert anytime from Settings → Appearance.
        </p>
        <div className={styles.themeModalActions}>
          <button type="button" className={styles.themeApplyBtn} onClick={onApply}>
            Apply {brand.name} colors
          </button>
          <button type="button" className={styles.themeDismissBtn} onClick={onDismiss}>
            Keep Zenith Classic
          </button>
        </div>
      </div>
    </div>
  )
}
