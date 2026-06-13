'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery }          from 'dexie-react-hooks'
import { db }                    from '@/lib/db'
import type { CardioSession }    from '@/lib/db'
import ZenHeading                from '@/components/ui/ZenHeading'
import CardioGameDashboard       from '@/components/CardioGameDashboard'
import styles                    from './WorkoutsView.module.css'

/* ── Vitality Points localStorage helpers ───────────────────────── */

const VP_KEY    = 'zenith_vitality_v1'
const BIOME_KEY = 'zenith_cozy_biome_v1'

interface VitalityStore { balance: number; lifetime: number }
interface BiomeStore    { purchased: string[]; activeBiome: 'aquarium' | 'zoo' }

function loadVP(): VitalityStore {
  try {
    const raw = localStorage.getItem(VP_KEY)
    if (raw) return JSON.parse(raw) as VitalityStore
  } catch { /* noop */ }
  return { balance: 0, lifetime: 0 }
}

function saveVP(v: VitalityStore) {
  try { localStorage.setItem(VP_KEY, JSON.stringify(v)) } catch { /* noop */ }
}

function loadBiome(): BiomeStore {
  try {
    const raw = localStorage.getItem(BIOME_KEY)
    if (raw) return JSON.parse(raw) as BiomeStore
  } catch { /* noop */ }
  return { purchased: [], activeBiome: 'aquarium' }
}

function saveBiome(b: BiomeStore) {
  try { localStorage.setItem(BIOME_KEY, JSON.stringify(b)) } catch { /* noop */ }
}

/* ── Cardio activity types ──────────────────────────────────────── */

const ACTIVITY_TYPES = [
  { id: 'run',       label: 'Run',       icon: '🏃' },
  { id: 'walk',      label: 'Walk',      icon: '🚶' },
  { id: 'bike',      label: 'Bike',      icon: '🚴' },
  { id: 'swim',      label: 'Swim',      icon: '🏊' },
  { id: 'row',       label: 'Row',       icon: '🚣' },
  { id: 'hike',      label: 'Hike',      icon: '🥾' },
  { id: 'yoga',      label: 'Yoga',      icon: '🧘' },
  { id: 'elliptical',label: 'Elliptical',icon: '⚡' },
  { id: 'other',     label: 'Other',     icon: '💪' },
] as const

/* ── Cozy biome catalog ─────────────────────────────────────────── */

interface BiomeItem {
  id:       string
  name:     string
  emoji:    string
  cost:     number
  category: 'fish' | 'animal' | 'decor'
  biome:    'aquarium' | 'zoo' | 'both'
  desc:     string
}

const BIOME_CATALOG: BiomeItem[] = [
  // Aquarium fish
  { id: 'neon_tetra',   name: 'Neon Tetra',     emoji: '🐟', cost: 5,  category: 'fish',   biome: 'aquarium', desc: 'Tiny iridescent schooling fish.' },
  { id: 'goldfish',     name: 'Goldfish',        emoji: '🐠', cost: 10, category: 'fish',   biome: 'aquarium', desc: 'Classic, peaceful, and beautiful.' },
  { id: 'betta',        name: 'Betta Fish',      emoji: '🐡', cost: 20, category: 'fish',   biome: 'aquarium', desc: 'Vivid flowing fins, a solitary beauty.' },
  { id: 'clownfish',    name: 'Clownfish',       emoji: '🐠', cost: 25, category: 'fish',   biome: 'aquarium', desc: 'Bright orange with bold white bands.' },
  { id: 'guppy',        name: 'Guppy',           emoji: '🐟', cost: 8,  category: 'fish',   biome: 'aquarium', desc: 'Colorful, fast-breeding nano fish.' },
  // Aquarium decor
  { id: 'plants',       name: 'Aquatic Plants',  emoji: '🌿', cost: 8,  category: 'decor',  biome: 'aquarium', desc: 'Lush green stems sway in the current.' },
  { id: 'coral',        name: 'Coral Formation', emoji: '🪸', cost: 15, category: 'decor',  biome: 'aquarium', desc: 'Branching coral in amber and pink.' },
  { id: 'castle',       name: 'Mini Castle',     emoji: '🏰', cost: 30, category: 'decor',  biome: 'aquarium', desc: 'A tiny stone fortress on the gravel.' },
  { id: 'shell',        name: 'Treasure Shell',  emoji: '🐚', cost: 12, category: 'decor',  biome: 'aquarium', desc: 'A cosy spiral shell on the substrate.' },
  // Zoo animals
  { id: 'bunny',        name: 'Bunny',           emoji: '🐰', cost: 10, category: 'animal', biome: 'zoo',      desc: 'Floppy-eared and perpetually curious.' },
  { id: 'penguin',      name: 'Penguin',         emoji: '🐧', cost: 20, category: 'animal', biome: 'zoo',      desc: 'Waddling tuxedo bird, always cheerful.' },
  { id: 'turtle',       name: 'Turtle',          emoji: '🐢', cost: 25, category: 'animal', biome: 'zoo',      desc: 'Patient and slow — enjoys sunlit rocks.' },
  { id: 'red_panda',    name: 'Red Panda',       emoji: '🦊', cost: 40, category: 'animal', biome: 'zoo',      desc: 'Rusty-furred tree climber. Very rare.' },
  { id: 'deer',         name: 'Deer',            emoji: '🦌', cost: 30, category: 'animal', biome: 'zoo',      desc: 'Gentle grazer wandering the meadow.' },
  { id: 'hedgehog',     name: 'Hedgehog',        emoji: '🦔', cost: 20, category: 'animal', biome: 'zoo',      desc: 'Spiny and shy, but loves to explore.' },
  // Zoo decor
  { id: 'flowers',      name: 'Flower Garden',   emoji: '🌸', cost: 8,  category: 'decor',  biome: 'zoo',      desc: 'Cherry blossoms drift across the path.' },
  { id: 'pond',         name: 'Lily Pond',       emoji: '🪷', cost: 15, category: 'decor',  biome: 'zoo',      desc: 'A still pond with floating lotus pads.' },
  { id: 'cherry_tree',  name: 'Cherry Tree',     emoji: '🌳', cost: 20, category: 'decor',  biome: 'zoo',      desc: 'Ancient tree with pink spring blossoms.' },
]

/* ── Biome display ──────────────────────────────────────────────── */

function BiomeDisplay({ purchased, biome }: { purchased: string[]; biome: 'aquarium' | 'zoo' }) {
  const items = BIOME_CATALOG.filter(
    c => purchased.includes(c.id) && (c.biome === biome || c.biome === 'both'),
  )

  if (items.length === 0) {
    return (
      <div className={styles.biomeEmpty}>
        <div className={styles.biomeEmptyGlyph}>{biome === 'aquarium' ? '🐟' : '🐰'}</div>
        <p className={styles.biomeEmptyText}>
          {biome === 'aquarium'
            ? 'Your aquarium is empty. Earn Vitality Points by logging cardio and buy your first fish!'
            : 'Your zoo is empty. Earn Vitality Points by logging cardio and adopt your first animal!'}
        </p>
      </div>
    )
  }

  return (
    <div className={`${styles.biomeScene} ${biome === 'aquarium' ? styles.biomeSceneAqua : styles.biomeSceneZoo}`}>
      {/* Background layer */}
      <div className={styles.biomeBackground} />
      {/* Creatures & decor */}
      <div className={styles.biomeCreatures}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.biomeCreature} ${
              item.category === 'fish'   ? styles.creatureFish   :
              item.category === 'animal' ? styles.creatureAnimal :
              styles.creatureDecor
            }`}
            style={{ '--i': i } as React.CSSProperties}
            title={item.name}
          >
            <span className={styles.creatureEmoji}>{item.emoji}</span>
          </div>
        ))}
      </div>
      {/* Substrate / ground */}
      <div className={styles.biomeSurface}>
        {biome === 'aquarium' ? '· · · · · · · · · · · ·' : '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~'}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function WorkoutsView() {
  const [activeTab, setActiveTab] = useState<'cardio' | 'biome' | 'trail'>('cardio')

  /* ── Vitality + biome state (localStorage) ───────────────── */
  const [vp,    setVp]    = useState<VitalityStore>({ balance: 0, lifetime: 0 })
  const [biome, setBiome] = useState<BiomeStore>({ purchased: [], activeBiome: 'aquarium' })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setVp(loadVP())
    setBiome(loadBiome())
    setMounted(true)
  }, [])

  /* ── IDB cardio sessions ──────────────────────────────────── */
  const sessions = useLiveQuery(
    () => db.cardioSessions.orderBy('completedAt').reverse().limit(30).toArray(),
    [],
  ) ?? []

  /* ── Cardio log form ──────────────────────────────────────── */
  const [activity,  setActivity]  = useState('run')
  const [duration,  setDuration]  = useState('')
  const [distance,  setDistance]  = useState('')
  const [unit,      setUnit]      = useState<'mi' | 'km'>('mi')
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [lastVP,    setLastVP]    = useState<number | null>(null)

  const calcVP = (minutes: number): number => {
    const base  = minutes
    const bonus = minutes >= 30 ? 5 : 0
    return Math.max(0, base + bonus)
  }

  const handleLogCardio = useCallback(async () => {
    const mins = parseInt(duration, 10)
    if (!mins || mins < 1) return
    setSaving(true)

    const earned = calcVP(mins)
    const session: Omit<CardioSession, 'id'> = {
      activityType:    activity,
      durationMinutes: mins,
      distance:        distance ? parseFloat(distance) : undefined,
      distanceUnit:    unit,
      vitalityEarned:  earned,
      notes:           notes.trim() || undefined,
      logDate:         new Date().toISOString().slice(0, 10),
      completedAt:     Date.now(),
    }

    await db.cardioSessions.add(session as CardioSession)

    const next: VitalityStore = {
      balance:  vp.balance + earned,
      lifetime: vp.lifetime + earned,
    }
    saveVP(next)
    setVp(next)
    setLastVP(earned)
    setTimeout(() => setLastVP(null), 4000)

    setDuration('')
    setDistance('')
    setNotes('')
    setSaving(false)
  }, [activity, duration, distance, unit, notes, vp])

  /* ── Buy biome item ──────────────────────────────────────────── */
  const handleBuy = useCallback((item: BiomeItem) => {
    if (vp.balance < item.cost) return
    if (biome.purchased.includes(item.id)) return
    const next: BiomeStore = {
      purchased:   [...biome.purchased, item.id],
      activeBiome: biome.activeBiome,
    }
    saveBiome(next)
    setBiome(next)
    const nextVP: VitalityStore = {
      balance:  vp.balance - item.cost,
      lifetime: vp.lifetime,
    }
    saveVP(nextVP)
    setVp(nextVP)
  }, [vp, biome])

  const handleSwitchBiome = (b: 'aquarium' | 'zoo') => {
    const next = { ...biome, activeBiome: b }
    saveBiome(next)
    setBiome(next)
  }

  /* ── Computed stats ─────────────────────────────────────────── */
  const totalMins   = sessions.reduce((s, r) => s + r.durationMinutes, 0)
  const thisWeek    = sessions.filter(r => r.completedAt >= Date.now() - 7 * 86_400_000)
  const weekMins    = thisWeek.reduce((s, r) => s + r.durationMinutes, 0)

  const aquaItems  = BIOME_CATALOG.filter(c => c.biome === 'aquarium')
  const zooItems   = BIOME_CATALOG.filter(c => c.biome === 'zoo')
  const shopItems  = biome.activeBiome === 'aquarium' ? aquaItems : zooItems

  function fmtDate(completedAt: number): string {
    return new Date(completedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })
  }

  const activityIcon = (type: string) =>
    ACTIVITY_TYPES.find(a => a.id === type)?.icon ?? '💪'

  if (!mounted) return null

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Life · Movement"
        title="Workouts"
        subtitle="Log cardio, earn Vitality Points, and build your cozy biome."
        size="md"
      />

      {/* VP Balance chip */}
      <div className={styles.vpBar}>
        <div className={styles.vpChip}>
          <span className={styles.vpIcon}>⚡</span>
          <span className={styles.vpBalance}>{vp.balance.toLocaleString()}</span>
          <span className={styles.vpLabel}>Vitality Points</span>
        </div>
        <div className={styles.vpStats}>
          <span>{totalMins.toLocaleString()} total mins</span>
          <span>·</span>
          <span>{weekMins} mins this week</span>
          <span>·</span>
          <span>{sessions.length} sessions</span>
        </div>
        {lastVP !== null && (
          <div className={styles.vpToast}>+{lastVP} ⚡ VP earned!</div>
        )}
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'cardio' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('cardio')}
        >
          🏃 Cardio Log
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'biome' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('biome')}
        >
          🌿 Cozy Biome
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'trail' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('trail')}
        >
          🏕 Trail Explorer
        </button>
      </div>

      {/* ── CARDIO TAB ───────────────────────────────────────────── */}
      {activeTab === 'cardio' && (
        <div className={styles.cardioLayout}>
          {/* Log form */}
          <div className={styles.logCard}>
            <h2 className={styles.cardTitle}>Log a Session</h2>

            <div className={styles.activityPicker}>
              {ACTIVITY_TYPES.map(a => (
                <button
                  key={a.id}
                  className={`${styles.activityBtn} ${activity === a.id ? styles.activityBtnActive : ''}`}
                  onClick={() => setActivity(a.id)}
                  title={a.label}
                >
                  <span className={styles.activityIcon}>{a.icon}</span>
                  <span className={styles.activityLabel}>{a.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.formRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Duration (minutes) *</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  min={1}
                  max={600}
                  placeholder="30"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Distance (optional)</label>
                <div className={styles.distanceRow}>
                  <input
                    type="number"
                    className={styles.fieldInput}
                    min={0}
                    step={0.1}
                    placeholder="3.2"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                  />
                  <button
                    className={styles.unitBtn}
                    onClick={() => setUnit(u => u === 'mi' ? 'km' : 'mi')}
                  >
                    {unit}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Notes (optional)</label>
              <input
                type="text"
                className={styles.fieldInput}
                placeholder="How did it feel?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {duration && parseInt(duration) > 0 && (
              <div className={styles.vpPreview}>
                <span className={styles.vpPreviewIcon}>⚡</span>
                <span>You&apos;ll earn <strong>{calcVP(parseInt(duration))} VP</strong>
                  {parseInt(duration) >= 30 ? ' (+5 bonus for 30+ min!)' : ''}
                </span>
              </div>
            )}

            <button
              className={styles.logBtn}
              onClick={() => void handleLogCardio()}
              disabled={!duration || parseInt(duration) < 1 || saving}
            >
              {saving ? 'Saving…' : 'Log Session'}
            </button>
          </div>

          {/* History */}
          <div className={styles.historyCard}>
            <h2 className={styles.cardTitle}>Recent Sessions</h2>
            {sessions.length === 0 ? (
              <p className={styles.emptyText}>No sessions yet. Log your first cardio workout!</p>
            ) : (
              <div className={styles.historyList}>
                {sessions.map(s => (
                  <div key={s.id} className={styles.historyRow}>
                    <span className={styles.historyIcon}>{activityIcon(s.activityType)}</span>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyActivity}>
                        {ACTIVITY_TYPES.find(a => a.id === s.activityType)?.label ?? s.activityType}
                      </span>
                      <span className={styles.historyMeta}>
                        {s.durationMinutes} min
                        {s.distance ? ` · ${s.distance} ${s.distanceUnit ?? 'mi'}` : ''}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </span>
                    </div>
                    <div className={styles.historyRight}>
                      <span className={styles.historyDate}>{fmtDate(s.completedAt)}</span>
                      <span className={styles.historyVP}>+{s.vitalityEarned} ⚡</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TRAIL EXPLORER TAB ───────────────────────────────────── */}
      {activeTab === 'trail' && (
        <CardioGameDashboard />
      )}

      {/* ── BIOME TAB ────────────────────────────────────────────── */}
      {activeTab === 'biome' && (
        <div className={styles.biomeLayout}>
          {/* Biome switcher + live display */}
          <div className={styles.biomeViewCard}>
            <div className={styles.biomeSwitcher}>
              <button
                className={`${styles.biomeTab} ${biome.activeBiome === 'aquarium' ? styles.biomeTabActive : ''}`}
                onClick={() => handleSwitchBiome('aquarium')}
              >
                🐟 Aquarium
              </button>
              <button
                className={`${styles.biomeTab} ${biome.activeBiome === 'zoo' ? styles.biomeTabActive : ''}`}
                onClick={() => handleSwitchBiome('zoo')}
              >
                🌿 Zoo
              </button>
            </div>
            <BiomeDisplay purchased={biome.purchased} biome={biome.activeBiome} />
          </div>

          {/* Shop */}
          <div className={styles.shopCard}>
            <div className={styles.shopHeader}>
              <h2 className={styles.cardTitle}>
                {biome.activeBiome === 'aquarium' ? 'Aquarium Shop' : 'Zoo Shop'}
              </h2>
              <div className={styles.vpChipSmall}>
                <span>⚡</span>
                <span className={styles.vpSmallNum}>{vp.balance}</span>
                <span className={styles.vpSmallLabel}>VP</span>
              </div>
            </div>

            <div className={styles.shopGrid}>
              {shopItems.map(item => {
                const owned    = biome.purchased.includes(item.id)
                const canAfford = vp.balance >= item.cost
                return (
                  <div
                    key={item.id}
                    className={`${styles.shopItem}
                      ${owned ? styles.shopItemOwned : ''}
                      ${!owned && !canAfford ? styles.shopItemLocked : ''}
                    `}
                  >
                    <span className={styles.shopEmoji}>{item.emoji}</span>
                    <div className={styles.shopInfo}>
                      <span className={styles.shopName}>{item.name}</span>
                      <span className={styles.shopDesc}>{item.desc}</span>
                    </div>
                    <div className={styles.shopAction}>
                      {owned ? (
                        <span className={styles.ownedBadge}>✓ Owned</span>
                      ) : (
                        <button
                          className={`${styles.buyBtn} ${!canAfford ? styles.buyBtnDisabled : ''}`}
                          onClick={() => handleBuy(item)}
                          disabled={!canAfford}
                        >
                          ⚡ {item.cost}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
