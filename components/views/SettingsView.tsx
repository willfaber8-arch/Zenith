'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery }     from 'dexie-react-hooks'
import { useAuth }          from '@/lib/AuthContext'
import { useToast }         from '@/lib/ToastContext'
import { useSandboxConfig } from '@/lib/hooks/useSandboxConfig'
import { useAiConfig }      from '@/lib/hooks/useAiConfig'
import { db }               from '@/lib/db'
import {
  gamesDb, purchaseTheme, setActiveTheme, applyFreeTheme,
  addToInventory, seedGamesDatabase,
} from '@/lib/gamesDb'
import { THEME_DEFINITIONS } from '@/lib/themeDefinitions'
import { SHOP_CATALOG_STATIC } from '@/lib/shopCatalog'
import {
  UNIVERSITY_BRANDS, UNIVERSITY_THEME_DEFINITIONS, uniThemeId,
} from '@/lib/universityThemes'
import {
  type BackgroundStyle,
  BACKDROP_STORAGE_KEY,
  BACKDROP_DEFAULT,
} from '@/types/backgrounds'
import {
  getPresets, savePreset, deletePreset, applyPreset,
  type DashboardPreset,
} from '@/lib/dashboardPresets'
import {
  CUSTOM_THEME_ID, loadCustomTheme, saveCustomTheme,
  DEFAULT_CUSTOM_THEME, type CustomThemeConfig,
} from '@/lib/customTheme'
import { BACKDROP_PRESETS, type BackdropId } from '@/lib/backdrops'
import { normalizeHex } from '@/lib/themeColor'
import { setPreviewId, clearPreview, subscribePreview, getPreviewId } from '@/lib/themePreview'
import FocusAudioPlayer          from '@/components/FocusAudioPlayer'
import BackupRestoreManager       from '@/components/BackupRestoreManager'
import EcosystemWrapped           from '@/components/EcosystemWrapped'
import SyncStressTestHarness      from '@/components/SyncStressTestHarness'
import ConflictAuditPanel         from '@/components/ConflictAuditPanel'
import StabilityReleaseConsole    from '@/components/StabilityReleaseConsole'
import styles from './SettingsView.module.css'

/* ── Section wrapper ──────────────────────────────────────────── */
function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

/* ── Color field (wheel + hex input) ──────────────────────────── */
function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  const commit = (raw: string) => {
    const norm = normalizeHex(raw)
    if (norm) onChange(norm)
    else setDraft(value)   // revert invalid input
  }

  return (
    <div className={styles.colorField}>
      <span className={styles.colorFieldLabel}>{label}</span>
      <div className={styles.colorFieldRow}>
        <label className={styles.colorWell} style={{ background: value }}>
          <input
            type="color"
            className={styles.colorWellInput}
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-label={`${label} colour wheel`}
          />
        </label>
        <input
          type="text"
          className={styles.colorHexInput}
          value={draft}
          spellCheck={false}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
          aria-label={`${label} hex code`}
        />
      </div>
    </div>
  )
}

/* ── Theme Forge — live custom theme creator ───────────────────── */
function ThemeForgePanel({
  isActive, onApply,
}: { isActive: boolean; onApply: () => void }) {
  const [config, setConfig] = useState<CustomThemeConfig>(() => loadCustomTheme())
  const [live, setLive]     = useState(false)

  // Persist + broadcast on every edit (ThemeApplicator re-applies live).
  const update = useCallback((patch: Partial<CustomThemeConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch }
      saveCustomTheme(next)
      return next
    })
  }, [])

  // Drive the app-wide preview while Live Preview is on.
  useEffect(() => {
    if (live) setPreviewId(CUSTOM_THEME_ID)
    return () => { if (live) clearPreview() }
  }, [live])

  const reset = () => { setConfig({ ...DEFAULT_CUSTOM_THEME }); saveCustomTheme({ ...DEFAULT_CUSTOM_THEME }) }

  return (
    <div className={styles.forgePanel}>
      <div className={styles.forgeHeader}>
        <span className={styles.forgeTitle}>✦ Theme Forge</span>
        <span className={styles.forgeSub}>Pick any colour — readability is auto-guarded.</span>
      </div>

      <div className={styles.forgeColors}>
        <ColorField label="Accent"     value={config.accent}  onChange={h => update({ accent: h })} />
        <ColorField label="Background" value={config.bgMain}  onChange={h => update({ bgMain: h })} />
        <ColorField label="Surface"    value={config.surface} onChange={h => update({ surface: h })} />
      </div>

      <div className={styles.forgeField}>
        <span className={styles.colorFieldLabel}>Backdrop</span>
        <div className={styles.forgeBackdrops}>
          {BACKDROP_PRESETS.map(b => (
            <button
              key={b.id}
              type="button"
              className={`${styles.forgeBackdropBtn} ${config.backdrop === b.id ? styles.forgeBackdropBtnActive : ''}`}
              onClick={() => update({ backdrop: b.id as BackdropId })}
              title={b.hint}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.forgeActions}>
        <button
          type="button"
          className={`${styles.themeBtn} ${live ? styles.forgeLiveOn : ''}`}
          onClick={() => setLive(v => !v)}
        >
          {live ? '◉ Live Preview On' : '◎ Live Preview'}
        </button>
        <button
          type="button"
          className={`${styles.themeBtn} ${styles.themeBtnBuy}`}
          onClick={() => { setLive(false); clearPreview(); onApply() }}
          disabled={isActive}
        >
          {isActive ? '✓ Active' : 'Apply Theme'}
        </button>
        <button type="button" className={styles.forgeResetBtn} onClick={reset}>Reset</button>
      </div>
    </div>
  )
}

/* ── Anchor section definitions ────────────────────────────────── */

const SETTINGS_SECTIONS = [
  { id: 's-appearance',    label: 'Appearance'    },
  { id: 's-school-colors', label: 'School Colors' },
  { id: 's-widgets',       label: 'Widgets'       },
  { id: 's-presets',       label: 'Presets'       },
  { id: 's-ai',            label: 'AI'            },
  { id: 's-help',          label: 'Help'          },
  { id: 's-account',       label: 'Account'       },
  { id: 's-audio',         label: 'Audio'         },
  { id: 's-privacy',       label: 'Data'          },
  { id: 's-analytics',     label: 'Analytics'     },
  { id: 's-shortcuts',     label: 'Shortcuts'     },
  { id: 's-about',         label: 'About'         },
  { id: 's-dev',           label: 'Dev'           },
  { id: 's-dev-console',   label: 'Console'       },
]

/* ── Toggle row ───────────────────────────────────────────────── */
function ToggleRow({
  label, hint, checked, onChange,
}: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <span className={styles.toggleLabel}>{label}</span>
        {hint && <span className={styles.toggleHint}>{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleThumb} />
      </button>
    </label>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function SettingsView() {
  const { session }            = useAuth()
  const { toast }              = useToast()
  const { config, toggleWidget } = useSandboxConfig()

  /* ── Ecosystem Wrapped ──────────────────────────────────────── */
  const [showWrapped, setShowWrapped] = useState(false)

  /* ── Dashboard Presets ──────────────────────────────────────── */
  const [presets,       setPresets]       = useState<DashboardPreset[]>([])
  const [presetName,    setPresetName]    = useState('')
  const [presetSaving,  setPresetSaving]  = useState(false)
  const [presetApplyId, setPresetApplyId] = useState<string | null>(null)

  useEffect(() => {
    setPresets(getPresets())
    const sync = () => setPresets(getPresets())
    window.addEventListener('zenith:sandbox-config-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('zenith:sandbox-config-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim()
    if (!name) return
    setPresetSaving(true)
    try {
      savePreset(name)
      setPresets(getPresets())
      setPresetName('')
      toast(`Preset "${name}" saved.`, 'success')
    } catch {
      toast('Could not save preset.', 'error')
    } finally {
      setPresetSaving(false)
    }
  }, [presetName, toast])

  const handleApplyPreset = useCallback((preset: DashboardPreset) => {
    setPresetApplyId(preset.id)
    try {
      applyPreset(preset)
      toast(`Applied "${preset.name}".`, 'success')
    } catch {
      toast('Could not apply preset.', 'error')
    } finally {
      setTimeout(() => setPresetApplyId(null), 900)
    }
  }, [toast])

  const handleDeletePreset = useCallback((id: string, name: string) => {
    deletePreset(id)
    setPresets(getPresets())
    toast(`Preset "${name}" deleted.`, 'info')
  }, [toast])

  /* ── Anchor hotbar active state ─────────────────────────────── */
  const [activeAnchor, setActiveAnchor] = useState<string>(SETTINGS_SECTIONS[0].id)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sectionEls = SETTINGS_SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (!sectionEls.length) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveAnchor(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-80px 0px -50% 0px', threshold: 0 },
    )

    sectionEls.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /* ── Account state ──────────────────────────────────────────── */
  const userProfile = useLiveQuery(() => db.userProfile.get(1), [])
  const [nameInput, setNameInput] = useState('')
  useEffect(() => {
    if (userProfile?.userName) setNameInput(userProfile.userName)
  }, [userProfile?.userName])

  const handleSaveName = useCallback(async () => {
    if (!nameInput.trim()) return
    await db.userProfile.update(1, { userName: nameInput.trim() })
    toast('Display name updated.', 'success')
  }, [nameInput, toast])

  /* ── Cosmetic theme state ───────────────────────────────────── */
  const gamesProfile = useLiveQuery(
    () => gamesDb?.user_profile_config.get('active_user'),
    [],
  )
  const ownedThemes  = gamesProfile?.purchasedThemes ?? ['zenith_default']
  const activeTheme  = gamesProfile?.activeTheme     ?? 'zenith_default'
  const cpBalance    = gamesProfile?.cosmeticPointsBalance ?? 0
  const [buyingId,   setBuyingId]   = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  /* ── Theme preview ──────────────────────────────────────────── */
  const [previewing, setPreviewing] = useState<string | null>(getPreviewId())
  useEffect(() => subscribePreview(setPreviewing), [])
  // End any preview when leaving Settings so it never "sticks".
  useEffect(() => () => clearPreview(), [])

  const handlePreview = useCallback((id: string) => {
    setPreviewId(previewing === id ? null : id)
  }, [previewing])

  const handleBuyTheme = useCallback(async (id: string, cost: number) => {
    setBuyingId(id)
    const result = await purchaseTheme(id, cost)
    setBuyingId(null)
    if (!result.ok) {
      toast(result.reason ?? 'Purchase failed.', 'error')
    } else {
      toast('Theme unlocked!', 'success')
    }
  }, [toast])

  const handleActivateTheme = useCallback(async (id: string) => {
    setActivatingId(id)
    await setActiveTheme(id)
    setActivatingId(null)
    toast('Theme applied.', 'success')
  }, [toast])

  /* ── School colors state ───────────────────────────────────── */
  const [applyingUniId, setApplyingUniId] = useState<string | null>(null)

  // Toggle = is the active theme a university brand theme?
  const schoolColorsGlobalOn = activeTheme.startsWith('uni_')

  const handleToggleSchoolColors = useCallback(async (on: boolean) => {
    try {
      await seedGamesDatabase()
      if (on) {
        // Find enrolled university, fall back to first brand
        const profile = await db.userProfile.get(1)
        const uniId = profile?.universityName
          ? Object.values(UNIVERSITY_BRANDS).find(b =>
              b.name.toLowerCase().includes(profile.universityName!.toLowerCase()) ||
              profile.universityName!.toLowerCase().includes(b.name.toLowerCase())
            )?.id ?? Object.keys(UNIVERSITY_BRANDS)[0]
          : Object.keys(UNIVERSITY_BRANDS)[0]
        await applyFreeTheme(uniThemeId(uniId))
        const brand = UNIVERSITY_BRANDS[uniId]
        toast(`${brand?.name ?? 'School'} colors applied globally.`, 'success')
      } else {
        await setActiveTheme('zenith_default')
        toast('School colors removed. Default theme restored.', 'info')
      }
    } catch {
      toast('Could not update school theme.', 'error')
    }
  }, [toast])

  const handleApplySchoolColors = useCallback(async (uniId: string) => {
    setApplyingUniId(uniId)
    try {
      await seedGamesDatabase()
      await applyFreeTheme(uniThemeId(uniId))
      const brand = UNIVERSITY_BRANDS[uniId]
      toast(`${brand?.name ?? 'School'} colors applied globally.`, 'success')
    } catch {
      toast('Could not apply school theme.', 'error')
    } finally {
      setApplyingUniId(null)
    }
  }, [toast])

  /* ── Developer console state ────────────────────────────────── */
  const [devCmd,      setDevCmd]      = useState('')
  const [devOutput,   setDevOutput]   = useState<string[]>([])

  const runDevCommand = useCallback(async (raw: string) => {
    const cmd = raw.trim()
    if (!cmd.startsWith('/')) {
      setDevOutput(p => [...p, `Unknown command. Try /help`])
      return
    }
    const [name, ...args] = cmd.slice(1).split(/\s+/)
    const n = parseInt(args[0] ?? '', 10)

    try {
      await seedGamesDatabase()

      if (name === 'help') {
        setDevOutput(p => [...p,
          '/give-credits N — add N cosmetic points (✦)',
          '/give-shards N — add N raw data shards',
          '/give-spores N — add N organic spores',
          '/give-vp N — add N vitality points (localStorage)',
          '/reset-arcade — wipe all gamesDb resource balances',
          '/clear — clear this console output',
        ])
        return
      }

      if (name === 'clear') {
        setDevOutput([])
        return
      }

      if (name === 'give-credits') {
        if (!n || n <= 0) { setDevOutput(p => [...p, 'Usage: /give-credits N (positive integer)']); return }
        const r = await addToInventory('cosmetic_points', n)
        if (r.ok) setDevOutput(p => [...p, `✦ Added ${r.amountActuallyAdded ?? n} cosmetic points. New balance: ${r.newBalance}`])
        else setDevOutput(p => [...p, `Failed: ${r.reason}`])
        return
      }

      if (name === 'give-shards') {
        if (!n || n <= 0) { setDevOutput(p => [...p, 'Usage: /give-shards N']); return }
        const r = await addToInventory('raw_data_shards', n)
        if (r.ok) setDevOutput(p => [...p, `Added ${r.amountActuallyAdded ?? n} raw data shards. New balance: ${r.newBalance}`])
        else setDevOutput(p => [...p, `Failed: ${r.reason}`])
        return
      }

      if (name === 'give-spores') {
        if (!n || n <= 0) { setDevOutput(p => [...p, 'Usage: /give-spores N']); return }
        const r = await addToInventory('organic_spores', n)
        if (r.ok) setDevOutput(p => [...p, `Added ${r.amountActuallyAdded ?? n} organic spores. New balance: ${r.newBalance}`])
        else setDevOutput(p => [...p, `Failed: ${r.reason}`])
        return
      }

      if (name === 'give-vp') {
        if (!n || n <= 0) { setDevOutput(p => [...p, 'Usage: /give-vp N']); return }
        try {
          const raw = localStorage.getItem('zenith_vitality_v1')
          const vp  = raw ? JSON.parse(raw) as { balance: number; lifetime: number } : { balance: 0, lifetime: 0 }
          const next = { balance: vp.balance + n, lifetime: vp.lifetime + n }
          localStorage.setItem('zenith_vitality_v1', JSON.stringify(next))
          setDevOutput(p => [...p, `Added ${n} VP. New balance: ${next.balance}`])
        } catch {
          setDevOutput(p => [...p, 'Failed to update VP balance.'])
        }
        return
      }

      if (name === 'reset-arcade') {
        if (!gamesDb) { setDevOutput(p => [...p, 'Games DB not available.']); return }
        await gamesDb.resource_inventory.clear()
        await gamesDb.user_profile_config.clear()
        await seedGamesDatabase()
        setDevOutput(p => [...p, 'Arcade data reset. All balances cleared and re-seeded.'])
        return
      }

      setDevOutput(p => [...p, `Unknown command: /${name}. Type /help for available commands.`])
    } catch (err) {
      setDevOutput(p => [...p, `Error: ${err instanceof Error ? err.message : 'unknown'}`])
    }
  }, [])

  /* ── AI Provider config ────────────────────────────────────── */
  const { config: aiConfig, saveKey: saveAiKey, clearKey: clearAiKey, maskedKey, mounted: aiMounted } = useAiConfig()
  const [aiKeyInput,  setAiKeyInput]  = useState('')
  const [aiKeySaved,  setAiKeySaved]  = useState(false)

  const handleSaveAiKey = useCallback(() => {
    const k = aiKeyInput.trim()
    if (!k) return
    saveAiKey(k)
    setAiKeyInput('')
    setAiKeySaved(true)
    toast('API key saved locally. It stays in your browser — never sent to our servers.', 'success')
    setTimeout(() => setAiKeySaved(false), 3000)
  }, [aiKeyInput, saveAiKey, toast])

  const handleClearAiKey = useCallback(() => {
    clearAiKey()
    setAiKeyInput('')
    toast('API key cleared.', 'info')
  }, [clearAiKey, toast])

  /* ── Ambient backdrop ──────────────────────────────────────── */
  const [backdrop, setBackdrop] = useState<BackgroundStyle>(BACKDROP_DEFAULT)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BACKDROP_STORAGE_KEY)
      if (stored === 'CLASSIC_STARFIELD' || stored === 'RAINDROPS_ON_GLASS' || stored === 'MINIMAL_GRID_MATRIX') {
        setBackdrop(stored)
      }
    } catch { /* storage unavailable */ }
  }, [])

  const handleBackdropChange = useCallback((next: BackgroundStyle) => {
    setBackdrop(next)
    try { window.localStorage.setItem(BACKDROP_STORAGE_KEY, next) } catch { /* ignore */ }
    toast('Backdrop updated — reload the page to see the new animation.', 'info')
  }, [toast])

  /* ── Keyboard shortcuts table ───────────────────────────────── */
  const shortcuts = [
    { key: 'Esc',     action: 'Close overlay / exit study mode' },
    { key: '↵',       action: 'Send AI Co-Pilot message' },
    { key: '⇧ ↵',    action: 'New line in AI Co-Pilot' },
    { key: '← / →',  action: 'Navigate calendar week/month' },
  ]

  return (
    <>
    <div className={styles.root}>
      {/* ── Anchor hotbar ───────────────────────────────────────── */}
      <nav className={styles.anchorBar} aria-label="Settings sections">
        {SETTINGS_SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`${styles.anchorPill} ${activeAnchor === s.id ? styles.anchorPillActive : ''}`}
            onClick={() => {
              const el = document.getElementById(s.id)
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setActiveAnchor(s.id)
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className={styles.grid} ref={gridRef}>

        {/* ── Appearance ──────────────────────────────────────── */}
        <Section id="s-appearance" title="Appearance & Themes">
          <p className={styles.sectionSubtitle}>
            ✦ Balance: <strong>{cpBalance.toLocaleString()}</strong>
          </p>
          <div className={styles.themeGrid}>
            {SHOP_CATALOG_STATIC.map(item => {
              const owned    = ownedThemes.includes(item.id)
              const equipped = activeTheme === item.id
              const afford   = cpBalance >= item.cost
              return (
                <div
                  key={item.id}
                  className={`${styles.themeCard} ${equipped ? styles.themeCardActive : ''} ${owned ? styles.themeCardOwned : ''}`}
                >
                  {item.tag && <span className={styles.themeTag}>{item.tag}</span>}
                  <div className={styles.themeCardIcon}>{item.icon}</div>
                  <p className={styles.themeCardName}>{item.name}</p>
                  <p className={styles.themeCardTagline}>{item.tagline}</p>
                  <div className={styles.themeCardFooter}>
                    {equipped ? (
                      <span className={styles.themeEquipped}>✓ Active</span>
                    ) : owned ? (
                      <button
                        className={styles.themeBtn}
                        onClick={() => void handleActivateTheme(item.id)}
                        disabled={activatingId === item.id}
                      >
                        {activatingId === item.id ? '···' : 'Apply'}
                      </button>
                    ) : (
                      <button
                        className={`${styles.themeBtn} ${styles.themeBtnBuy} ${!afford ? styles.themeBtnLocked : ''}`}
                        onClick={() => void handleBuyTheme(item.id, item.cost)}
                        disabled={!afford || buyingId === item.id}
                        title={!afford ? `Need ${(item.cost - cpBalance).toLocaleString()} more ✦` : undefined}
                      >
                        {buyingId === item.id ? '···' : item.cost === 0 ? 'Free' : `✦ ${item.cost}`}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.previewBtn} ${previewing === item.id ? styles.previewBtnOn : ''}`}
                      onClick={() => handlePreview(item.id)}
                    >
                      {previewing === item.id ? '■ Stop' : '◉ Preview'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Theme Forge (custom theme creator) ─────────────── */}
          {ownedThemes.includes(CUSTOM_THEME_ID) ? (
            <ThemeForgePanel
              isActive={activeTheme === CUSTOM_THEME_ID}
              onApply={() => void handleActivateTheme(CUSTOM_THEME_ID)}
            />
          ) : (
            <p className={styles.forgeLockedHint}>
              Unlock <strong>Theme Forge</strong> above to design your own colours, hex codes,
              and ambient backdrop — fully re-editable anytime.
            </p>
          )}

          {/* ── Ambient Backdrop ──────────────────────────────── */}
          <div className={styles.backdropSection}>
            <p className={styles.backdropLabel}>Ambient Backdrop</p>
            <p className={styles.backdropHint}>
              Dynamic canvas animation behind the star field. Takes effect on next page load.
            </p>
            <div className={styles.backdropPicker}>
              {([
                { id: 'CLASSIC_STARFIELD',  label: '✦ Classic Starfield',    hint: '3D perspective drift' },
                { id: 'RAINDROPS_ON_GLASS', label: '◎ Raindrops on Glass',   hint: 'Expanding ripple circles' },
                { id: 'MINIMAL_GRID_MATRIX',label: '⊞ Minimal Grid Matrix',  hint: 'Sine-wave pulse grid' },
              ] as { id: BackgroundStyle; label: string; hint: string }[]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.backdropBtn} ${backdrop === opt.id ? styles.backdropBtnActive : ''}`}
                  onClick={() => handleBackdropChange(opt.id)}
                >
                  <span className={styles.backdropBtnLabel}>{opt.label}</span>
                  <span className={styles.backdropBtnHint}>{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── School Colors ───────────────────────────────────── */}
        <Section id="s-school-colors" title="School Colors">
          <p className={styles.sectionSubtitle}>
            University colors always appear inside the University Hub and sidebar.
            Toggle global mode to apply your school&apos;s accent across the entire app.
          </p>
          <div className={styles.toggleList}>
            <ToggleRow
              label="Global School Colors"
              hint="Apply university brand accent app-wide, not just inside the hub"
              checked={schoolColorsGlobalOn}
              onChange={v => void handleToggleSchoolColors(v)}
            />
          </div>
          <p className={styles.sectionSubtitle} style={{ marginTop: 'var(--sp-4)' }}>
            Pick a specific school&apos;s colors to apply globally:
          </p>
          <div className={styles.themeGrid}>
            {Object.values(UNIVERSITY_BRANDS).map(brand => {
              const themeId  = uniThemeId(brand.id)
              const def      = UNIVERSITY_THEME_DEFINITIONS[themeId]
              const equipped = activeTheme === themeId
              return (
                <div
                  key={brand.id}
                  className={`${styles.themeCard} ${equipped ? styles.themeCardActive : ''} ${styles.themeCardOwned}`}
                >
                  <div
                    className={styles.themeCardSwatch}
                    style={{ background: def?.swatch ?? brand.primaryHex }}
                  />
                  <p className={styles.themeCardName}>{brand.name}</p>
                  <p className={styles.themeCardTagline}>{brand.primaryHex.toUpperCase()}</p>
                  <div className={styles.themeCardFooter}>
                    {equipped ? (
                      <span className={styles.themeEquipped}>✓ Active</span>
                    ) : (
                      <button
                        className={styles.themeBtn}
                        onClick={() => void handleApplySchoolColors(brand.id)}
                        disabled={applyingUniId === brand.id}
                      >
                        {applyingUniId === brand.id ? '···' : 'Apply'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.previewBtn} ${previewing === themeId ? styles.previewBtnOn : ''}`}
                      onClick={() => handlePreview(themeId)}
                    >
                      {previewing === themeId ? '■ Stop' : '◉ Preview'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Dashboard Widgets ───────────────────────────────── */}
        <Section id="s-widgets" title="Dashboard Widgets">
          <p className={styles.sectionSubtitle}>
            Toggle which widgets appear on your home screen.
          </p>
          <div className={styles.toggleList}>
            <ToggleRow
              label="Habit Summary"
              hint="Ring chart + streak count"
              checked={config.habitSummary ?? true}
              onChange={() => toggleWidget('habitSummary')}
            />
            <ToggleRow
              label="Calendar Today"
              hint="Today's events preview"
              checked={config.calendarToday ?? true}
              onChange={() => toggleWidget('calendarToday')}
            />
            <ToggleRow
              label="Pomodoro Timer"
              hint="Quick-launch focus timer"
              checked={config.pomodoroPreview ?? false}
              onChange={() => toggleWidget('pomodoroPreview')}
            />
            <ToggleRow
              label="Weather"
              hint="Current conditions + 7-day forecast"
              checked={config.localWeather ?? true}
              onChange={() => toggleWidget('localWeather')}
            />
            <ToggleRow
              label="Study Streak"
              hint="Daily sessions + weekly minutes"
              checked={config.studyStreak ?? true}
              onChange={() => toggleWidget('studyStreak')}
            />
            <ToggleRow
              label="University Hub"
              hint="Quick-link to your university profile"
              checked={config.uniHub ?? true}
              onChange={() => toggleWidget('uniHub')}
            />
          </div>
        </Section>

        {/* ── Dashboard Presets ───────────────────────────────── */}
        <Section id="s-presets" title="Dashboard Presets">
          <p className={styles.sectionSubtitle}>
            Save named snapshots of your widget layout. The AI Co-Pilot can also
            create and apply presets on your behalf.
          </p>

          {/* Saved presets list */}
          {presets.length > 0 && (
            <div className={styles.presetList}>
              {presets.map(p => (
                <div key={p.id} className={styles.presetRow}>
                  <span className={styles.presetName}>{p.name}</span>
                  <div className={styles.presetActions}>
                    <button
                      className={`${styles.presetApplyBtn} ${presetApplyId === p.id ? styles.presetApplyBtnActive : ''}`}
                      onClick={() => handleApplyPreset(p)}
                    >
                      {presetApplyId === p.id ? '✓' : 'Apply'}
                    </button>
                    <button
                      className={styles.presetDeleteBtn}
                      onClick={() => handleDeletePreset(p.id, p.name)}
                      aria-label={`Delete preset ${p.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {presets.length === 0 && (
            <p className={styles.presetEmpty}>
              No presets saved yet. Configure your widgets above and save them as a preset, or ask the AI Co-Pilot to create one for you.
            </p>
          )}

          {/* Save current layout */}
          <div className={styles.presetSaveRow}>
            <input
              type="text"
              className={styles.presetInput}
              placeholder='Preset name, e.g. "Finals Week"'
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSavePreset() }}
              maxLength={40}
            />
            <button
              className={styles.presetSaveBtn}
              onClick={handleSavePreset}
              disabled={!presetName.trim() || presetSaving}
            >
              Save current layout
            </button>
          </div>
        </Section>

        {/* ── AI Provider ─────────────────────────────────────── */}
        <Section id="s-ai" title="AI Provider">
          <p className={styles.sectionSubtitle}>
            Zenith&apos;s AI features (Co-Pilot, Study Shield) use your own API key —
            stored only in this browser, never on our servers. Supports Google Gemini,
            Anthropic Claude, and OpenAI (ChatGPT).
          </p>

          {/* ── Current key status ─────────────────────────────── */}
          {aiMounted && aiConfig.userApiKey && (
            <div className={styles.aiKeyStatus}>
              <span className={styles.aiKeyProvider}>
                {aiConfig.provider === 'gemini'    ? '◎ Google Gemini'    :
                 aiConfig.provider === 'anthropic' ? '◎ Anthropic Claude' :
                 aiConfig.provider === 'openai'    ? '◎ OpenAI'           :
                 '◎ Unknown provider'}
              </span>
              <span className={styles.aiKeyMasked}>{maskedKey}</span>
              <button className={styles.aiKeyClearBtn} onClick={handleClearAiKey}>
                Remove key
              </button>
            </div>
          )}

          {/* ── Key input ──────────────────────────────────────── */}
          <div className={styles.aiKeyRow}>
            <input
              type="password"
              className={styles.aiKeyInput}
              placeholder={
                aiMounted && aiConfig.userApiKey
                  ? 'Enter a new key to replace the current one'
                  : 'Gemini (AIza… / AQ.…) · Anthropic (sk-ant-…) · OpenAI (sk-…)'
              }
              value={aiKeyInput}
              onChange={e => setAiKeyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAiKey() }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className={`${styles.aiKeySaveBtn} ${aiKeySaved ? styles.aiKeySavedState : ''}`}
              onClick={handleSaveAiKey}
              disabled={!aiKeyInput.trim()}
            >
              {aiKeySaved ? '✓ Saved' : 'Save Key'}
            </button>
          </div>

          {/* ── Provider help links ────────────────────────────── */}
          <div className={styles.aiProviderLinks}>
            <span className={styles.aiProviderLinkLabel}>Get a key:</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.aiProviderLink}
            >
              Google AI Studio (Gemini · free) →
            </a>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.aiProviderLink}
            >
              Anthropic Console →
            </a>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.aiProviderLink}
            >
              OpenAI Platform (paid, ~$5 credit for new accounts) →
            </a>
          </div>

          <p className={styles.aiKeyNote}>
            🔒 Your key is stored in localStorage. It is sent only to our server
            as an HTTPS header for forwarding to the AI provider — never logged or persisted.
            Gemini free tier is the easiest starting point; OpenAI has no permanent free tier.
          </p>
        </Section>

        {/* ── Help & Tour ─────────────────────────────────────── */}
        <Section id="s-help" title="Help & Tour">
          <p className={styles.sectionSubtitle}>
            New to Zenith, or want a refresher? Replay the guided
            walkthrough that covers the sidebar, dashboard layouts,
            widgets, Study Shield, and more.
          </p>
          <button
            className={styles.dataBtn}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('zenith:replay-tutorial'))
              toast('Starting the guided tour…', 'info')
            }}
          >
            ◈ Replay walkthrough
          </button>
        </Section>

        {/* ── Account ─────────────────────────────────────────── */}
        <Section id="s-account" title="Account">
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="displayName">
              Display name
            </label>
            <div className={styles.fieldRow}>
              <input
                id="displayName"
                type="text"
                className={styles.textInput}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleSaveName()}
                placeholder="Your name"
                maxLength={40}
              />
              <button
                className={styles.saveBtn}
                onClick={() => void handleSaveName()}
                disabled={!nameInput.trim() || nameInput.trim() === userProfile?.userName}
              >
                Save
              </button>
            </div>
          </div>

          <div className={styles.accountRow}>
            <div className={styles.accountDetail}>
              <span className={styles.accountDetailLabel}>Session token</span>
              <span className={styles.accountDetailValue}>
                {session?.sessionToken?.slice(0, 24)}…
              </span>
            </div>
          </div>
        </Section>

        {/* ── Focus Audio ─────────────────────────────────────── */}
        <Section id="s-audio" title="Focus Audio">
          <p className={styles.sectionSubtitle}>
            Ambient soundscapes and music streams for deep focus sessions.
          </p>
          <FocusAudioPlayer />
        </Section>

        {/* ── Privacy & Data ───────────────────────────────────── */}
        <Section id="s-privacy" title="Privacy & Data">
          <p className={styles.sectionSubtitle}>
            All data is stored locally in your browser&apos;s IndexedDB —
            never transmitted without your explicit consent.
            Use the archive system below to back up or restore your entire workspace.
          </p>
          <BackupRestoreManager />
        </Section>

        {/* ── Ecosystem Analytics ──────────────────────────────── */}
        <Section id="s-analytics" title="Ecosystem Analytics">
          <p className={styles.sectionSubtitle}>
            Compile your full local database history into a cinematic
            annual review — habit streaks, completed tasks, vocabulary
            retention, and reading progress synthesised into one narrative.
          </p>
          <button
            className={styles.dataBtn}
            onClick={() => setShowWrapped(true)}
          >
            ◈ Wake Annual Ecosystem Wrapped
          </button>
        </Section>

        {/* ── Keyboard Shortcuts ───────────────────────────────── */}
        <Section id="s-shortcuts" title="Keyboard Shortcuts">
          <table className={styles.shortcutsTable}>
            <tbody>
              {shortcuts.map(({ key, action }) => (
                <tr key={key} className={styles.shortcutRow}>
                  <td><kbd className={styles.kbd}>{key}</kbd></td>
                  <td className={styles.shortcutAction}>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ── About ────────────────────────────────────────────── */}
        <Section id="s-about" title="About">
          <div className={styles.aboutGrid}>
            <div className={styles.aboutRow}>
              <span className={styles.aboutLabel}>Version</span>
              <span className={styles.aboutValue}>Zenith OS · 2026.R13</span>
            </div>
            <div className={styles.aboutRow}>
              <span className={styles.aboutLabel}>Framework</span>
              <span className={styles.aboutValue}>Next.js 15 · React 19 · TypeScript</span>
            </div>
            <div className={styles.aboutRow}>
              <span className={styles.aboutLabel}>Persistence</span>
              <span className={styles.aboutValue}>IndexedDB via Dexie.js v4</span>
            </div>
            <div className={styles.aboutRow}>
              <span className={styles.aboutLabel}>AI Model</span>
              <span className={styles.aboutValue}>Claude (Anthropic) — server-side</span>
            </div>
          </div>
        </Section>

        {/* ── Developer Diagnostics ────────────────────────────── */}
        <Section id="s-dev" title="Developer Diagnostics">
          <p className={styles.sectionSubtitle}>
            Inject configurable network chaos to verify that the offline
            synchronisation stack (IndexedDB write-ahead log + Supabase broker)
            holds transactions safely and replays them cleanly on recovery.
            All test records are purged from IndexedDB at the end of each run.
          </p>
          <SyncStressTestHarness />
        </Section>

        {/* ── Conflict Resolution Auditor ───────────────────────── */}
        <Section title="Conflict Resolution Auditor">
          <p className={styles.sectionSubtitle}>
            Simulate concurrent multi-device mutations and observe the deterministic
            Last-Write-Wins algorithm resolve data collisions in real time. Each run
            exercises a different resolution path — timestamp delta, stale-sync
            rejection, or millisecond-exact UUID tie-break — and certifies that
            every node converges to an identical ground state without any server
            coordination.
          </p>
          <ConflictAuditPanel />
        </Section>

        {/* ── Developer Console ────────────────────────────────── */}
        {/* TODO: remove before launch */}
        <Section id="s-dev-console" title="Developer Console [ REMOVE BEFORE LAUNCH ]">
          <p className={styles.sectionSubtitle}>
            Internal command interface for testing game economy and data states.
            Type <strong>/help</strong> to list all commands.
          </p>
          <div className={styles.devConsoleWrap}>
            <div className={styles.devConsoleOutput}>
              {devOutput.length === 0
                ? <span className={styles.devConsolePlaceholder}>[ CONSOLE READY // TYPE /help ]</span>
                : devOutput.map((line, i) => (
                    <p key={i} className={styles.devConsoleLine}>{line}</p>
                  ))
              }
            </div>
            <div className={styles.devConsoleInput}>
              <span className={styles.devConsolePrompt}>{'>'}</span>
              <input
                type="text"
                className={styles.devConsoleField}
                value={devCmd}
                onChange={e => setDevCmd(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && devCmd.trim()) {
                    setDevOutput(p => [...p, `> ${devCmd}`])
                    void runDevCommand(devCmd)
                    setDevCmd('')
                  }
                }}
                placeholder="/give-credits 500"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className={styles.devConsoleRunBtn}
                onClick={() => {
                  if (!devCmd.trim()) return
                  setDevOutput(p => [...p, `> ${devCmd}`])
                  void runDevCommand(devCmd)
                  setDevCmd('')
                }}
              >
                Run
              </button>
            </div>
          </div>
        </Section>

        {/* ── Stability Release Console ─────────────────────────── */}
        <Section title="Total System Hardening Console">
          <p className={styles.sectionSubtitle}>
            Run the complete Phase 8–13 regression suite across every architectural
            pillar — IndexedDB schema, SM-2 calculator, WebRTC mesh, AES-GCM crypto
            integrity, schedule date boundaries, CSS token registry, canvas pixel
            rendering, lazy routing chunks, network simulator teardown, and the LWW
            conflict engine. Once all checks pass, execute the final system
            sign-off to seal the build.
          </p>
          <StabilityReleaseConsole />
        </Section>

      </div>
    </div>

    {/* Ecosystem Wrapped overlay — rendered at root so it covers the full viewport */}
    {showWrapped && (
      <EcosystemWrapped onClose={() => setShowWrapped(false)} />
    )}

    {/* ── Live theme preview bar ──────────────────────────────── */}
    {previewing && (() => {
      const shopItem = SHOP_CATALOG_STATIC.find(i => i.id === previewing)
      const isUni    = previewing.startsWith('uni_')
      const ownedP   = ownedThemes.includes(previewing)
      const name     = previewing === CUSTOM_THEME_ID
        ? 'Theme Forge'
        : shopItem?.name ?? UNIVERSITY_THEME_DEFINITIONS[previewing]?.label ?? previewing
      const applyPreview = () => {
        if (shopItem && !ownedP && previewing !== CUSTOM_THEME_ID) {
          void handleBuyTheme(previewing, shopItem.cost)
          return
        }
        if (isUni) void handleApplySchoolColors(previewing.replace(/^uni_/, ''))
        else       void handleActivateTheme(previewing)
        clearPreview()
      }
      const buyMode = !!shopItem && !ownedP && previewing !== CUSTOM_THEME_ID
      return (
        <div className={styles.previewBar} role="status">
          <span className={styles.previewBarDot} aria-hidden="true" />
          <span className={styles.previewBarLabel}>
            Previewing <strong>{name}</strong>
          </span>
          <button type="button" className={styles.previewBarApply} onClick={applyPreview}>
            {buyMode ? `Buy ✦ ${shopItem!.cost.toLocaleString()}` : 'Apply'}
          </button>
          <button type="button" className={styles.previewBarStop} onClick={() => clearPreview()}>
            Stop preview
          </button>
        </div>
      )
    })()}
    </>
  )
}
