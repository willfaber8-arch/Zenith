'use client'

import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import ZenHeading from '@/components/ui/ZenHeading'
import type {
  Houseplant, PlantCatalogEntry,
  LightRequirement, LightPosition, HumidityLevel,
} from '@/types/botany'
import styles from './BotanistView.module.css'

/* ── Plant catalog database ───────────────────────────────── */

const PLANT_CATALOG: PlantCatalogEntry[] = [
  { commonName: 'Monstera',            scientificName: 'Monstera deliciosa',        wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Provide a moss pole as it grows. Wipe leaves monthly.' },
  { commonName: 'Golden Pothos',       scientificName: 'Epipremnum aureum',         wateringIntervalDays: 10, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Tolerates low light. Trim vines to encourage bushy growth.' },
  { commonName: 'Snake Plant',         scientificName: 'Dracaena trifasciata',      wateringIntervalDays: 14, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Drought-tolerant. Overwatering is the most common mistake.' },
  { commonName: 'Peace Lily',          scientificName: 'Spathiphyllum wallisii',    wateringIntervalDays: 7,  lightRequirement: 'shade',          lightPosition: 'indoors',  humidity: 'high',   specialConditions: 'Droops dramatically when thirsty — an easy watering cue.' },
  { commonName: 'ZZ Plant',            scientificName: 'Zamioculcas zamiifolia',    wateringIntervalDays: 21, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Extremely drought-tolerant. Allow soil to dry fully between waterings.' },
  { commonName: 'Fiddle-Leaf Fig',     scientificName: 'Ficus lyrata',             wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Dislikes being moved. Keep away from drafts and cold windows.' },
  { commonName: 'Spider Plant',        scientificName: 'Chlorophytum comosum',      wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'both',     humidity: 'low',    specialConditions: 'Produces runners with plantlets — easy to propagate.' },
  { commonName: 'Aloe Vera',           scientificName: 'Aloe barbadensis miller',   wateringIntervalDays: 21, lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'low',    specialConditions: 'Gel-filled leaves treat minor burns. Ensure excellent drainage.' },
  { commonName: 'Rubber Plant',        scientificName: 'Ficus elastica',            wateringIntervalDays: 10, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Wipe leaves with a damp cloth to keep them glossy.' },
  { commonName: 'Bird of Paradise',    scientificName: 'Strelitzia reginae',        wateringIntervalDays: 7,  lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'medium', specialConditions: 'Needs 4–6 hours of direct sun daily to bloom indoors.' },
  { commonName: 'Chinese Evergreen',   scientificName: 'Aglaonema commutatum',      wateringIntervalDays: 10, lightRequirement: 'shade',          lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'One of the most air-purifying indoor plants. Avoid cold draughts.' },
  { commonName: 'Boston Fern',         scientificName: 'Nephrolepis exaltata',      wateringIntervalDays: 3,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'high',   specialConditions: 'Mist daily in dry climates. Keep soil consistently moist.' },
  { commonName: 'Orchid',              scientificName: 'Phalaenopsis spp.',         wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Water by soaking pot for 15 min, then allow to drain fully.' },
  { commonName: 'Jade Plant',          scientificName: 'Crassula ovata',            wateringIntervalDays: 14, lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'low',    specialConditions: 'Considered good luck in some cultures. Drought-tolerant succulent.' },
  { commonName: 'String of Pearls',    scientificName: 'Senecio rowleyanus',        wateringIntervalDays: 14, lightRequirement: 'partial-sun',    lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Grows best in a hanging planter. Needs bright, indirect light.' },
  { commonName: 'Prayer Plant',        scientificName: 'Maranta leuconeura',        wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'high',   specialConditions: 'Leaves fold upward at night like praying hands — normal behavior.' },
  { commonName: 'Areca Palm',          scientificName: 'Dypsis lutescens',          wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Natural humidifier. Keep fronds dust-free for best appearance.' },
  { commonName: 'Dracaena',            scientificName: 'Dracaena marginata',        wateringIntervalDays: 14, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Fluoride-sensitive — use filtered water if leaf tips brown.' },
  { commonName: 'Calathea',            scientificName: 'Calathea orbifolia',        wateringIntervalDays: 7,  lightRequirement: 'shade',          lightPosition: 'indoors',  humidity: 'high',   specialConditions: 'Very sensitive to tap water chlorine. Use distilled or rainwater.' },
  { commonName: 'Philodendron',        scientificName: 'Philodendron hederaceum',   wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'medium', specialConditions: 'Fast grower. Pinch tips to keep compact. Toxic to pets.' },
  { commonName: 'Anthurium',           scientificName: 'Anthurium andraeanum',      wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'high',   specialConditions: 'Wax-like blooms last weeks. Feed monthly with diluted fertilizer.' },
  { commonName: 'Tradescantia',        scientificName: 'Tradescantia zebrina',      wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'both',     humidity: 'medium', specialConditions: 'Striking purple-striped leaves. Pinch leggy stems to promote fullness.' },
  { commonName: 'Lavender',            scientificName: 'Lavandula angustifolia',    wateringIntervalDays: 14, lightRequirement: 'full-sun',       lightPosition: 'outdoors', humidity: 'low',    specialConditions: 'Needs 6+ hours sun. Excellent drainage essential — hates wet roots.' },
  { commonName: 'Basil',               scientificName: 'Ocimum basilicum',          wateringIntervalDays: 2,  lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'medium', specialConditions: 'Pinch flower buds to extend harvest. Keep soil consistently moist.' },
  { commonName: 'Mint',                scientificName: 'Mentha spp.',               wateringIntervalDays: 2,  lightRequirement: 'partial-sun',    lightPosition: 'both',     humidity: 'medium', specialConditions: 'Invasive — grow in contained pots. Harvest frequently for best flavor.' },
  { commonName: 'Rosemary',            scientificName: 'Salvia rosmarinus',         wateringIntervalDays: 10, lightRequirement: 'full-sun',       lightPosition: 'outdoors', humidity: 'low',    specialConditions: 'Mediterranean herb — drought-tolerant once established. Full sun essential.' },
  { commonName: 'Echeveria (Succulent)',scientificName: 'Echeveria elegans',         wateringIntervalDays: 14, lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'low',    specialConditions: 'Water only when completely dry. Avoid water sitting in the rosette.' },
  { commonName: 'Cactus (Barrel)',     scientificName: 'Ferocactus wislizeni',      wateringIntervalDays: 30, lightRequirement: 'full-sun',       lightPosition: 'both',     humidity: 'low',    specialConditions: 'Minimal water in winter. Handle with thick gloves when repotting.' },
  { commonName: 'Pothos (Neon)',       scientificName: 'Epipremnum aureum Neon',    wateringIntervalDays: 10, lightRequirement: 'indirect-light', lightPosition: 'indoors',  humidity: 'low',    specialConditions: 'Brighter location intensifies neon-yellow color. Trailing or climbing.' },
  { commonName: 'English Ivy',         scientificName: 'Hedera helix',              wateringIntervalDays: 7,  lightRequirement: 'indirect-light', lightPosition: 'both',     humidity: 'medium', specialConditions: 'Great for hanging baskets. Can be invasive outdoors in some regions.' },
]

/* ── Helpers ──────────────────────────────────────────────── */

const today = () => new Date().toISOString().slice(0, 10)

function daysSince(dateStr: string): number {
  const last = new Date(dateStr); last.setHours(0,0,0,0)
  const now  = new Date();        now.setHours(0,0,0,0)
  return Math.floor((now.getTime() - last.getTime()) / 86_400_000)
}

const LIGHT_LABEL: Record<LightRequirement, string> = {
  'full-sun':       '☀ Full Sun',
  'partial-sun':    '⛅ Partial Sun',
  'indirect-light': '🌤 Indirect Light',
  'shade':          '🌑 Shade',
}
const POSITION_LABEL: Record<LightPosition, string> = {
  indoors: 'Indoors', outdoors: 'Outdoors', both: 'In/Outdoors',
}
const HUMIDITY_LABEL: Record<HumidityLevel, string> = {
  low: '💧 Low',  medium: '💧💧 Medium', high: '💧💧💧 High',
}
const HEALTH_EMOJI = ['', '🤒', '😟', '😐', '😊', '🌿']

/* ── Add/Edit Plant Modal ─────────────────────────────────── */

function PlantModal({
  onClose,
  onSave,
  initial,
}: {
  onClose:  () => void
  onSave:   (p: Omit<Houseplant, 'id'>) => void
  initial?: Houseplant
}) {
  const [query,     setQuery]     = useState('')
  const [selected,  setSelected]  = useState<PlantCatalogEntry | null>(null)
  const [customMode, setCustom]   = useState(!!initial)

  const [plantName, setPlantName] = useState(initial?.plantName ?? '')
  const [species,   setSpecies]   = useState(initial?.species ?? '')
  const [location,  setLocation]  = useState(initial?.location ?? '')
  const [interval,  setInterval]  = useState(initial?.wateringIntervalDays ?? 7)
  const [light,     setLight]     = useState<LightRequirement>(
    (initial as Houseplant & { lightRequirement?: LightRequirement })?.lightRequirement ?? 'indirect-light'
  )
  const [pos,       setPos]       = useState<LightPosition>(
    (initial as Houseplant & { lightPosition?: LightPosition })?.lightPosition ?? 'indoors'
  )
  const [hum,       setHum]       = useState<HumidityLevel>(
    (initial as Houseplant & { humidity?: HumidityLevel })?.humidity ?? 'medium'
  )
  const [special,   setSpecial]   = useState(
    (initial as Houseplant & { specialConditions?: string })?.specialConditions ?? ''
  )
  const [notes,     setNotes]     = useState(initial?.notes ?? '')

  const filtered = useMemo(() => {
    if (!query.trim()) return PLANT_CATALOG.slice(0, 12)
    const q = query.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.commonName.toLowerCase().includes(q) ||
      p.scientificName.toLowerCase().includes(q)
    )
  }, [query])

  function pickCatalog(entry: PlantCatalogEntry) {
    setSelected(entry)
    setPlantName(entry.commonName)
    setSpecies(entry.scientificName)
    setInterval(entry.wateringIntervalDays)
    setLight(entry.lightRequirement)
    setPos(entry.lightPosition)
    setHum(entry.humidity)
    setSpecial(entry.specialConditions ?? '')
    setCustom(true)
  }

  const canSave = plantName.trim() && species.trim() && location.trim()

  function handleSave() {
    if (!canSave) return
    onSave({
      plantName:           plantName.trim(),
      species:             species.trim(),
      location:            location.trim(),
      lastWateredDate:     initial?.lastWateredDate ?? today(),
      wateringIntervalDays: interval,
      lightRequirement:    light,
      lightPosition:       pos,
      humidity:            hum,
      specialConditions:   special.trim() || undefined,
      notes:               notes.trim() || undefined,
      healthRating:        (initial as Houseplant & { healthRating?: number })?.healthRating,
      lastHealthCheck:     (initial as Houseplant & { lastHealthCheck?: string })?.lastHealthCheck,
    } as Omit<Houseplant, 'id'>)
    onClose()
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <p className={styles.modalEyebrow}>Botanist Guide</p>
          <p className={styles.modalTitle}>{initial ? 'Edit Plant' : 'Add Plant'}</p>
        </div>

        {!customMode && !initial && (
          <div className={styles.catalogSection}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search plants (e.g. Monstera, succulent…)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            <div className={styles.catalogList}>
              {filtered.map(entry => (
                <button
                  key={entry.scientificName}
                  type="button"
                  className={styles.catalogRow}
                  onClick={() => pickCatalog(entry)}
                >
                  <span className={styles.catalogCommon}>{entry.commonName}</span>
                  <span className={styles.catalogScientific}>{entry.scientificName}</span>
                </button>
              ))}
            </div>
            <button type="button" className={styles.customBtn} onClick={() => setCustom(true)}>
              + Enter custom plant
            </button>
          </div>
        )}

        {(customMode || !!initial) && (
          <div className={styles.formSection}>
            {selected && (
              <p className={styles.selectedHint}>
                From catalog: <em>{selected.scientificName}</em>
              </p>
            )}
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Common name *</label>
                <input type="text" className={styles.input} value={plantName} onChange={e => setPlantName(e.target.value)} placeholder="e.g. My Monstera" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Scientific name *</label>
                <input type="text" className={styles.input} value={species} onChange={e => setSpecies(e.target.value)} placeholder="e.g. Monstera deliciosa" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Location *</label>
                <input type="text" className={styles.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Living Room windowsill" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Watering interval (days)</label>
                <input type="number" min={1} max={365} className={styles.input} value={interval} onChange={e => setInterval(Math.max(1, Number(e.target.value)))} />
              </div>
            </div>

            <div className={styles.careRow}>
              <div className={styles.field}>
                <label className={styles.label}>Light</label>
                <select className={styles.input} value={light} onChange={e => setLight(e.target.value as LightRequirement)}>
                  <option value="full-sun">Full Sun</option>
                  <option value="partial-sun">Partial Sun</option>
                  <option value="indirect-light">Indirect Light</option>
                  <option value="shade">Shade</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Position</label>
                <select className={styles.input} value={pos} onChange={e => setPos(e.target.value as LightPosition)}>
                  <option value="indoors">Indoors</option>
                  <option value="outdoors">Outdoors</option>
                  <option value="both">In/Outdoors</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Humidity</label>
                <select className={styles.input} value={hum} onChange={e => setHum(e.target.value as HumidityLevel)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Special conditions</label>
              <input type="text" className={styles.input} value={special} onChange={e => setSpecial(e.target.value)} placeholder="e.g. Needs misting, keep above 15°C" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <input type="text" className={styles.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Personal care notes…" />
            </div>

            <div className={styles.modalActions}>
              {!initial && (
                <button type="button" className={styles.backBtn} onClick={() => setCustom(false)}>← Back</button>
              )}
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={!canSave}>
                {initial ? 'Save Changes' : 'Add Plant'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ── Health check popover ─────────────────────────────────── */

function HealthPicker({ plantId, current }: { plantId: number; current?: number }) {
  const [open, setOpen] = useState(false)

  async function rate(v: number) {
    await db.houseplants.update(plantId, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      healthRating: v as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastHealthCheck: today() as any,
    })
    setOpen(false)
  }

  return (
    <div className={styles.healthWrap}>
      <button type="button" className={styles.healthBtn} onClick={() => setOpen(v => !v)} title="Record health">
        {current ? HEALTH_EMOJI[current] : '♥'} Health
      </button>
      {open && (
        <div className={styles.healthPicker}>
          {[1,2,3,4,5].map(v => (
            <button key={v} type="button" className={`${styles.healthRating} ${current === v ? styles.healthRatingActive : ''}`} onClick={() => rate(v)}>
              {HEALTH_EMOJI[v]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Plant card ───────────────────────────────────────────── */

function PlantCard({
  plant, onEdit, onDelete,
}: {
  plant:    Houseplant
  onEdit:   (p: Houseplant) => void
  onDelete: (id: number)    => void
}) {
  const days      = daysSince(plant.lastWateredDate)
  const pct       = Math.min(100, Math.round((days / plant.wateringIntervalDays) * 100))
  const isOverdue = days >= plant.wateringIntervalDays
  const isWarning = pct >= 75 && !isOverdue
  const urgency   = isOverdue ? 'overdue' : isWarning ? 'warning' : 'ok'

  const ext = plant as Houseplant & {
    lightRequirement?: string; lightPosition?: string; humidity?: string
    healthRating?: number; specialConditions?: string; notes?: string
  }

  async function logWatering() {
    if (plant.id === undefined) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.houseplants.update(plant.id, { lastWateredDate: today() as any })
  }

  return (
    <div className={styles.plantCard} data-urgency={urgency}>
      <div className={styles.cardTop}>
        <div className={styles.cardNames}>
          <span className={styles.plantName}>{plant.plantName}</span>
          <em className={styles.plantScientific}>{plant.species}</em>
        </div>
        <span className={styles.locationChip}>{plant.location}</span>
      </div>

      {/* Care badges */}
      <div className={styles.careBadges}>
        {ext.lightRequirement && (
          <span className={styles.badge}>{LIGHT_LABEL[ext.lightRequirement as LightRequirement]}</span>
        )}
        {ext.lightPosition && (
          <span className={styles.badge}>{POSITION_LABEL[ext.lightPosition as LightPosition]}</span>
        )}
        {ext.humidity && (
          <span className={styles.badge}>{HUMIDITY_LABEL[ext.humidity as HumidityLevel]}</span>
        )}
      </div>

      {ext.specialConditions && (
        <p className={styles.specialNote}>{ext.specialConditions}</p>
      )}

      {/* Watering progress */}
      <div className={styles.waterSection}>
        <div className={styles.waterStats}>
          <span className={styles.waterDays} data-urgency={urgency}>{days}d since watered</span>
          <span className={styles.waterInterval}>every {plant.wateringIntervalDays}d</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} data-urgency={urgency} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.progressLabel} data-urgency={urgency}>
          {isOverdue
            ? `${days - plant.wateringIntervalDays}d overdue`
            : `${plant.wateringIntervalDays - days}d until next watering`
          }
        </p>
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        <button type="button" className={styles.waterBtn} data-urgency={urgency} onClick={logWatering}>
          💧 Water Now
        </button>
        <HealthPicker plantId={plant.id!} current={ext.healthRating} />
        <button type="button" className={styles.editBtn} onClick={() => onEdit(plant)}>Edit</button>
        <button type="button" className={styles.deleteBtn} onClick={() => onDelete(plant.id!)}>✕</button>
      </div>

      {ext.notes && <p className={styles.notesText}>{ext.notes}</p>}
    </div>
  )
}

/* ── Main view ────────────────────────────────────────────── */

export default function BotanistView() {
  const [showAdd,   setShowAdd]   = useState(false)
  const [editPlant, setEditPlant] = useState<Houseplant | null>(null)
  const [search,    setSearch]    = useState('')

  const plants = useLiveQuery(() => db?.houseplants.toArray() ?? Promise.resolve([]), [])

  const filtered = useMemo(() => {
    if (!search.trim()) return plants ?? []
    const q = search.toLowerCase()
    return (plants ?? []).filter(p =>
      p.plantName.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    )
  }, [plants, search])

  const overdueCount = (plants ?? []).filter(p => daysSince(p.lastWateredDate) >= p.wateringIntervalDays).length

  const handleAdd = useCallback(async (data: Omit<Houseplant, 'id'>) => {
    if (!db) return
    await db.houseplants.add(data as Houseplant)
  }, [])

  const handleEdit = useCallback(async (data: Omit<Houseplant, 'id'>) => {
    if (!db || !editPlant?.id) return
    await db.houseplants.update(editPlant.id, data)
    setEditPlant(null)
  }, [editPlant])

  const handleDelete = useCallback(async (id: number) => {
    if (!db) return
    await db.houseplants.delete(id)
  }, [])

  return (
    <div className={styles.page}>
      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Creator's Choice · Botanist Guide"
          title="Plant Care."
          subtitle="Track your collection, log waterings, record health, and get care reminders based on each plant's requirements."
          size="md"
        />
      </div>

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Filter your plants…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="button" className={styles.addBtn} onClick={() => setShowAdd(true)}>
          + Add Plant
        </button>
      </div>

      {/* ── Summary ───────────────────────────────────────── */}
      {(plants ?? []).length > 0 && (
        <div className={`${styles.summary} anim-fade-in`}>
          <span className={styles.summaryItem}>{(plants ?? []).length} plants</span>
          {overdueCount > 0 && (
            <span className={`${styles.summaryItem} ${styles.summaryAlert}`}>
              💧 {overdueCount} need watering
            </span>
          )}
        </div>
      )}

      {/* ── Plant grid ────────────────────────────────────── */}
      {filtered.length === 0 && (plants ?? []).length === 0 ? (
        <div className={`${styles.emptyState} anim-fade-in`}>
          <p className={styles.emptyIcon}>🌱</p>
          <p className={styles.emptyTitle}>No plants yet</p>
          <p className={styles.emptyBody}>Add your first plant to start tracking its care schedule.</p>
          <button type="button" className={styles.emptyAddBtn} onClick={() => setShowAdd(true)}>
            + Add Your First Plant
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((plant, i) => (
            <div key={plant.id} className={`anim-slide-in ${i < 6 ? `delay-${Math.min(i+1, 4)}` : ''}`}>
              <PlantCard
                plant={plant}
                onEdit={p => setEditPlant(p)}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showAdd && (
        <PlantModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editPlant && (
        <PlantModal onClose={() => setEditPlant(null)} onSave={handleEdit} initial={editPlant} />
      )}
    </div>
  )
}
