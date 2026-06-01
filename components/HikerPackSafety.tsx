'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuth }  from '@/lib/AuthContext'
import { useToast } from '@/lib/ToastContext'
import { TRAILS }   from '@/data/trails'
import type { GearItem, GearCategory } from '@/types/hikingGear'
import { formatEmergencyAlert, type TimerStatus } from '@/utils/emergencyTimer'
import styles from './HikerPackSafety.module.css'

/* ── Default gear inventory ───────────────────────────────────────── */

const DEFAULT_GEAR: GearItem[] = [
  // Essentials
  { id: 'e1', itemName: 'Headlamp',              weightOunces: 3.2,  category: 'essentials', isPacked: true  },
  { id: 'e2', itemName: 'Fire Starter Kit',      weightOunces: 1.8,  category: 'essentials', isPacked: true  },
  { id: 'e3', itemName: 'Multi-tool',            weightOunces: 6.4,  category: 'essentials', isPacked: false },
  { id: 'e4', itemName: 'Emergency Whistle',     weightOunces: 0.6,  category: 'essentials', isPacked: true  },
  { id: 'e5', itemName: 'Sun Protection Kit',    weightOunces: 3.0,  category: 'essentials', isPacked: false },
  // Shelter
  { id: 's1', itemName: 'Tent (2-person)',        weightOunces: 64.0, category: 'shelter',    isPacked: false },
  { id: 's2', itemName: 'Sleeping Bag',           weightOunces: 32.0, category: 'shelter',    isPacked: true  },
  { id: 's3', itemName: 'Sleeping Pad',           weightOunces: 16.0, category: 'shelter',    isPacked: false },
  { id: 's4', itemName: 'Emergency Bivy',         weightOunces: 5.2,  category: 'shelter',    isPacked: true  },
  // Hydration
  { id: 'h1', itemName: 'Water Filter (Sawyer)',  weightOunces: 3.0,  category: 'hydration',  isPacked: true  },
  { id: 'h2', itemName: 'Hydration Bladder (3L)', weightOunces: 4.6,  category: 'hydration',  isPacked: true  },
  { id: 'h3', itemName: 'Purification Tabs',      weightOunces: 1.2,  category: 'hydration',  isPacked: false },
  { id: 'h4', itemName: 'Electrolyte Packs ×6',  weightOunces: 2.4,  category: 'hydration',  isPacked: true  },
  // Navigation
  { id: 'n1', itemName: 'Topographic Map',        weightOunces: 2.0,  category: 'navigation', isPacked: true  },
  { id: 'n2', itemName: 'Baseplate Compass',      weightOunces: 1.8,  category: 'navigation', isPacked: true  },
  { id: 'n3', itemName: 'GPS Device',             weightOunces: 5.0,  category: 'navigation', isPacked: false },
  { id: 'n4', itemName: 'Trail Guide',            weightOunces: 4.2,  category: 'navigation', isPacked: false },
  // First Aid
  { id: 'f1', itemName: 'First Aid Kit',          weightOunces: 12.0, category: 'first_aid',  isPacked: true  },
  { id: 'f2', itemName: 'Moleskin Blister Pads',  weightOunces: 1.0,  category: 'first_aid',  isPacked: true  },
  { id: 'f3', itemName: 'Pain Reliever Tabs',     weightOunces: 0.8,  category: 'first_aid',  isPacked: true  },
  { id: 'f4', itemName: 'Ace Bandage Roll',       weightOunces: 2.4,  category: 'first_aid',  isPacked: false },
]

const CATEGORY_ORDER: GearCategory[] = [
  'essentials', 'shelter', 'hydration', 'navigation', 'first_aid',
]

const CATEGORY_LABELS: Record<GearCategory, string> = {
  essentials: 'Essentials',
  shelter:    'Shelter',
  hydration:  'Hydration',
  navigation: 'Navigation',
  first_aid:  'First Aid',
}

/* ── usePackWeight ────────────────────────────────────────────────── */

function usePackWeight(items: GearItem[]) {
  return useMemo(() => {
    const packed    = items.filter(i => i.isPacked)
    const totalOz   = packed.reduce((s, i) => s + i.weightOunces, 0)
    const totalAllOz = items.reduce((s, i) => s + i.weightOunces, 0)
    const lbs = Math.floor(totalOz / 16)
    const oz  = parseFloat((totalOz % 16).toFixed(1))
    const pct = totalAllOz > 0 ? Math.round((totalOz / totalAllOz) * 100) : 0
    return { totalOz, totalAllOz, lbs, oz, pct, packedCount: packed.length }
  }, [items])
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ── Component ───────────────────────────────────────────────────── */

export default function HikerPackSafety() {
  const { session } = useAuth()
  const { toast }   = useToast()

  /* Gear state */
  const [items, setItems] = useState<GearItem[]>(DEFAULT_GEAR)

  /* Timer state */
  const [timerStatus,    setTimerStatus]    = useState<TimerStatus>('INACTIVE')
  const [deadlineMs,     setDeadlineMs]     = useState<number | null>(null)
  const [totalDurationMs,setTotalDurationMs]= useState(0)
  const [remainingMs,    setRemainingMs]    = useState(0)
  const [returnHours,    setReturnHours]    = useState(4)
  const [returnMins,     setReturnMins]     = useState(0)
  const [selectedTrailId,setSelectedTrailId]= useState('')
  const [confirmStep,    setConfirmStep]    = useState(false)
  const [copied,         setCopied]         = useState(false)
  const confirmRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Derived */
  const packWeight    = usePackWeight(items)
  const selectedTrail = TRAILS.find(t => t.id === selectedTrailId) ?? null

  const urgencyLevel: 'normal' | 'warning' | 'critical' = useMemo(() => {
    if (timerStatus !== 'ACTIVE_HIKING') return 'normal'
    if (remainingMs < 10 * 60 * 1000)   return 'critical'
    if (remainingMs < 30 * 60 * 1000)   return 'warning'
    return 'normal'
  }, [timerStatus, remainingMs])

  const emergencyText = useMemo(
    () =>
      selectedTrail
        ? formatEmergencyAlert(
            session?.userHandle ?? 'Unknown User',
            selectedTrail.name,
            selectedTrail.coordinates,
          )
        : '',
    [session, selectedTrail],
  )

  /* Timer tick — epoch-based, immune to setInterval drift */
  useEffect(() => {
    if (timerStatus !== 'ACTIVE_HIKING' || deadlineMs === null) return

    const tick = () => {
      const rem = deadlineMs - Date.now()
      if (rem <= 0) {
        setTimerStatus('OVERDUE_ALERT_TRIGGERED')
        setRemainingMs(0)
      } else {
        setRemainingMs(rem)
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timerStatus, deadlineMs])

  /* Cleanup confirm timeout on unmount */
  useEffect(() => () => {
    if (confirmRef.current) clearTimeout(confirmRef.current)
  }, [])

  /* Actions */
  function toggleItem(id: string) {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, isPacked: !item.isPacked } : item),
    )
  }

  function initializeTimer() {
    const dur = (returnHours * 60 + returnMins) * 60 * 1000
    if (dur <= 0 || !selectedTrailId) return
    const deadline = Date.now() + dur
    setDeadlineMs(deadline)
    setTotalDurationMs(dur)
    setRemainingMs(dur)
    setTimerStatus('ACTIVE_HIKING')
    toast('Safety check-in active. Trail timer initialized.', 'success')
  }

  function handleDeactivate() {
    if (!confirmStep) {
      setConfirmStep(true)
      confirmRef.current = setTimeout(() => setConfirmStep(false), 4000)
    } else {
      if (confirmRef.current) clearTimeout(confirmRef.current)
      setTimerStatus('INACTIVE')
      setDeadlineMs(null)
      setConfirmStep(false)
      toast('Safe return confirmed. Emergency protocol disengaged.', 'success')
    }
  }

  async function copyEmergency() {
    if (!emergencyText) return
    await navigator.clipboard.writeText(emergencyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const canInit = selectedTrailId !== '' && (returnHours * 60 + returnMins) > 0

  const timerUrgencyAttr =
    timerStatus === 'ACTIVE_HIKING'
      ? urgencyLevel
      : timerStatus === 'OVERDUE_ALERT_TRIGGERED'
      ? 'overdue'
      : 'normal'

  const barPct =
    totalDurationMs > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalDurationMs) * 100))
      : 0

  return (
    <div className={styles.hikerPack}>
      <div className={styles.layout}>

        {/* ── Left: Gear Inventory ─────────────────────────── */}
        <aside className={styles.gearPanel}>

          {/* Weight summary */}
          <div className={styles.weightCard}>
            <div className={styles.weightRow}>
              <span className={styles.weightLabel}>Pack Weight</span>
              <span className={styles.weightValue}>
                {packWeight.lbs > 0 && `${packWeight.lbs} lb `}
                {packWeight.oz} oz
              </span>
            </div>
            <div className={styles.weightBar}>
              <div
                className={styles.weightFill}
                style={{ width: `${packWeight.pct}%` }}
              />
            </div>
            <div className={styles.weightMeta}>
              <span>{packWeight.packedCount} / {items.length} items packed</span>
              <span>{packWeight.pct}% of total load</span>
            </div>
          </div>

          {/* Gear list */}
          <div className={styles.gearList}>
            {CATEGORY_ORDER.map(cat => {
              const catItems = items.filter(i => i.category === cat)
              const catOz    = catItems
                .filter(i => i.isPacked)
                .reduce((s, i) => s + i.weightOunces, 0)
              return (
                <div key={cat} className={styles.catSection}>
                  <div className={styles.catHeader}>
                    <span className={styles.catLabel}>{CATEGORY_LABELS[cat]}</span>
                    <span className={styles.catWeight}>{catOz.toFixed(1)} oz packed</span>
                  </div>
                  {catItems.map(item => (
                    <label key={item.id} className={styles.gearItem}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={item.isPacked}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span
                        className={styles.itemName}
                        data-packed={item.isPacked.toString()}
                      >
                        {item.itemName}
                      </span>
                      <span className={styles.itemWeight}>{item.weightOunces} oz</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Right: Safety Timer ──────────────────────────── */}
        <main className={styles.safetyPanel}>

          {/* Trail selector */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>Active Trail</div>
            <select
              className={styles.trailSelect}
              value={selectedTrailId}
              onChange={e => setSelectedTrailId(e.target.value)}
              disabled={timerStatus !== 'INACTIVE'}
            >
              <option value="">— Select a trail —</option>
              {TRAILS.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTrail && (
              <div className={styles.trailMeta}>
                <span>{selectedTrail.locationRegion}</span>
                <span className={styles.metaSep}>·</span>
                <span>{selectedTrail.distanceMiles} mi</span>
                <span className={styles.metaSep}>·</span>
                <span className={`${styles.diffBadge} ${styles[`diff_${selectedTrail.difficulty}`]}`}>
                  {selectedTrail.difficulty}
                </span>
                <span className={styles.metaSep}>·</span>
                <span>{selectedTrail.coordinates.length} waypoints</span>
              </div>
            )}
          </div>

          {/* Return window input (only when inactive) */}
          {timerStatus === 'INACTIVE' && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Estimated Return Window</div>
              <div className={styles.returnRow}>
                <div className={styles.timeGroup}>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={returnHours}
                    onChange={e => setReturnHours(Math.max(0, Number(e.target.value)))}
                    className={styles.timeInput}
                  />
                  <span className={styles.timeUnit}>hr</span>
                </div>
                <div className={styles.timeGroup}>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={returnMins}
                    onChange={e => setReturnMins(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className={styles.timeInput}
                  />
                  <span className={styles.timeUnit}>min</span>
                </div>
              </div>
              <button
                className={styles.initBtn}
                onClick={initializeTimer}
                disabled={!canInit}
              >
                Initialize Safe Return Check-In
              </button>
              {!selectedTrailId && (
                <p className={styles.initHint}>Select a trail above to enable the timer.</p>
              )}
            </div>
          )}

          {/* Timer display */}
          {timerStatus !== 'INACTIVE' && (
            <div className={styles.timerCard} data-urgency={timerUrgencyAttr}>
              <div className={styles.timerLabel}>
                {timerStatus === 'ACTIVE_HIKING'
                  ? 'SAFETY TIMER — ACTIVE'
                  : 'OVERDUE — TIMER ELAPSED'}
              </div>

              <div className={styles.countdown} data-urgency={timerUrgencyAttr}>
                {timerStatus === 'OVERDUE_ALERT_TRIGGERED' ? '00:00:00' : fmtMs(remainingMs)}
              </div>

              <div className={styles.timerSub}>
                {timerStatus === 'ACTIVE_HIKING' && deadlineMs !== null && (
                  <>remaining · confirm return by <strong>{fmtTime(deadlineMs)}</strong></>
                )}
                {timerStatus === 'OVERDUE_ALERT_TRIGGERED' && 'Emergency dispatch protocol engaged'}
              </div>

              {timerStatus === 'ACTIVE_HIKING' && (
                <div className={styles.timeBar}>
                  <div
                    className={styles.timeBarFill}
                    data-urgency={urgencyLevel}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              )}

              <button
                className={styles.deactivateBtn}
                onClick={handleDeactivate}
                data-confirming={confirmStep.toString()}
              >
                {confirmStep
                  ? 'Click again within 4s to confirm safe return'
                  : 'Confirm Safe Return'}
              </button>
            </div>
          )}

          {/* Emergency dispatch payload */}
          {timerStatus === 'OVERDUE_ALERT_TRIGGERED' && emergencyText && (
            <div className={styles.emergencyCard}>
              <div className={styles.emergencyHeader}>
                <span className={styles.emergencyDot} />
                EMERGENCY PROTOCOL ENGAGED
              </div>
              <p className={styles.emergencyDesc}>
                Safety window elapsed without check-in confirmation. Share the dispatch text below
                with emergency services or a designated contact immediately.
              </p>
              <div className={styles.emergencyPayload}>
                <pre className={styles.emergencyText}>{emergencyText}</pre>
                <button className={styles.copyBtn} onClick={copyEmergency}>
                  {copied ? 'Copied to clipboard' : 'Copy Dispatch Text'}
                </button>
              </div>
            </div>
          )}

          {/* Inactive placeholder */}
          {timerStatus === 'INACTIVE' && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderTitle}>Safety Protocol Inactive</div>
              <p className={styles.placeholderBody}>
                Select a trail and set an estimated return window above, then initialize the check-in.
                If you don't confirm your return before the deadline, an emergency dispatch payload
                is automatically compiled for emergency services.
              </p>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
