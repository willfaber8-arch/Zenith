'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { DeliveryItem, DeliveryStatus } from '@/types/finance'
import styles from './DeliveriesLogger.module.css'

/* ── Seed data ───────────────────────────────────────────────────── */

const SEED_DELIVERIES: Omit<DeliveryItem, 'id'>[] = [
  { carrier: 'Amazon',  itemName: 'Desk Organizer',              estimatedArrival: '2026-06-03', status: 'in_transit',         createdAt: Date.now() - 86_400_000 * 2 },
  { carrier: 'USPS',    itemName: 'Intro to Algorithms Textbook', estimatedArrival: '2026-06-01', status: 'arrived_at_mailroom', createdAt: Date.now() - 86_400_000 * 3 },
  { carrier: 'Spotify', itemName: 'Premium Subscription',         estimatedArrival: '',           status: 'active',             createdAt: Date.now() - 86_400_000 * 30 },
  { carrier: 'Apple',   itemName: 'iCloud+ (50 GB)',              estimatedArrival: '',           status: 'active',             createdAt: Date.now() - 86_400_000 * 15 },
]

/* ── Module-level seed guard (React StrictMode safe) ────────────── */

let _seedGuard = false

/* ── Constants ───────────────────────────────────────────────────── */

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  in_transit:         'In Transit',
  arrived_at_mailroom: 'At Mailroom',
  active:             'Active',
}

const BLANK_FORM = {
  carrier: '',
  itemName: '',
  estimatedArrival: '',
  status: 'in_transit' as DeliveryStatus,
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── Component ───────────────────────────────────────────────────── */

export default function DeliveriesLogger() {
  const items = useLiveQuery(
    () => db.deliveries.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [removing,  setRemoving]  = useState<number | null>(null)

  /* Seed on first mount */
  useEffect(() => {
    if (_seedGuard) return
    _seedGuard = true
    async function seed() {
      const count = await db.deliveries.count()
      if (count === 0) {
        await db.deliveries.bulkAdd(SEED_DELIVERIES as DeliveryItem[])
      }
    }
    seed()
  }, [])

  /* ── Actions ─────────────────────────────────────────────────── */

  async function addItem() {
    const { carrier, itemName, estimatedArrival, status } = form
    if (!carrier.trim() || !itemName.trim()) return
    await db.deliveries.add({
      carrier:          carrier.trim(),
      itemName:         itemName.trim(),
      estimatedArrival: estimatedArrival,
      status:           status,
      createdAt:        Date.now(),
    } as DeliveryItem)
    setForm(BLANK_FORM)
    setShowForm(false)
  }

  async function advanceStatus(item: DeliveryItem) {
    if (item.status === 'in_transit') {
      await db.deliveries.update(item.id!, { status: 'arrived_at_mailroom' })
    } else if (item.status === 'arrived_at_mailroom') {
      // "Collected" — remove from list with exit animation
      await removeItem(item.id!)
    }
  }

  async function removeItem(id: number) {
    setRemoving(id)
    // Allow CSS exit animation to play before deleting
    await new Promise(r => setTimeout(r, 280))
    await db.deliveries.delete(id)
    setRemoving(null)
  }

  const inTransitCount   = items?.filter(i => i.status === 'in_transit').length ?? 0
  const atMailroomCount  = items?.filter(i => i.status === 'arrived_at_mailroom').length ?? 0

  return (
    <div className={styles.logger}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className={styles.loggerHeader}>
        <div>
          <div className={styles.loggerEyebrow}>Mail Room · Subscriptions</div>
          <div className={styles.loggerTitle}>Deliveries & Active Services</div>
        </div>
        <div className={styles.headerRight}>
          {atMailroomCount > 0 && (
            <span className={styles.mailroomAlert}>
              {atMailroomCount} ready to collect
            </span>
          )}
          <button
            className={`${styles.addBtn} ${showForm ? styles.addBtnActive : ''}`}
            onClick={() => { setShowForm(v => !v); setForm(BLANK_FORM) }}
          >
            {showForm ? '✕ Cancel' : '+ Add Entry'}
          </button>
        </div>
      </div>

      {/* ── Add form ──────────────────────────────────────────── */}
      {showForm && (
        <div className={`${styles.addForm} anim-slide-in`}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Carrier / Service</label>
              <input
                className={styles.formInput}
                placeholder="UPS, Amazon, Spotify…"
                value={form.carrier}
                onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Item / Subscription Name</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Wireless Keyboard"
                value={form.itemName}
                onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Estimated Arrival</label>
              <input
                type="date"
                className={styles.formInput}
                value={form.estimatedArrival}
                onChange={e => setForm(f => ({ ...f, estimatedArrival: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type</label>
              <select
                className={styles.formSelect}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as DeliveryStatus }))}
              >
                <option value="in_transit">Package — In Transit</option>
                <option value="arrived_at_mailroom">Package — At Mailroom</option>
                <option value="active">Subscription — Active</option>
              </select>
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.formSubmit}
              onClick={addItem}
              disabled={!form.carrier.trim() || !form.itemName.trim()}
            >
              Add Entry
            </button>
          </div>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <div className={styles.colCarrier}>Carrier</div>
          <div className={styles.colItem}>Item</div>
          <div className={styles.colEta}>ETA</div>
          <div className={styles.colStatus}>Status</div>
          <div className={styles.colActions} />
        </div>

        <div className={styles.tableBody}>
          {!items || items.length === 0 ? (
            <div className={styles.emptyState}>
              No active deliveries or subscriptions. Click <strong>+ Add Entry</strong> to start tracking.
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className={[
                  styles.tableRow,
                  removing === item.id ? styles.tableRowRemoving : '',
                  item.status === 'arrived_at_mailroom' ? styles.tableRowAlert : '',
                ].join(' ')}
              >
                <div className={styles.colCarrier}>
                  <span className={styles.carrierName}>{item.carrier}</span>
                </div>

                <div className={styles.colItem}>
                  <span className={styles.itemName}>{item.itemName}</span>
                  {item.notes && (
                    <span className={styles.itemNotes}>{item.notes}</span>
                  )}
                </div>

                <div className={styles.colEta}>
                  <span className={styles.etaText}>{fmtDate(item.estimatedArrival)}</span>
                </div>

                <div className={styles.colStatus}>
                  <span className={`${styles.statusPill} ${styles[`pill_${item.status}`]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className={styles.colActions}>
                  {item.status === 'in_transit' && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => advanceStatus(item)}
                      title="Mark as arrived at mailroom"
                    >
                      Arrived
                    </button>
                  )}
                  {item.status === 'arrived_at_mailroom' && (
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnCollect}`}
                      onClick={() => advanceStatus(item)}
                      title="Mark as collected — removes from list"
                    >
                      Collected
                    </button>
                  )}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => removeItem(item.id!)}
                    title="Remove entry"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary footer */}
        {items && items.length > 0 && (
          <div className={styles.tableFooter}>
            <span>{inTransitCount} in transit</span>
            <span>·</span>
            <span>{atMailroomCount} at mailroom</span>
            <span>·</span>
            <span>{items.filter(i => i.status === 'active').length} active subscriptions</span>
          </div>
        )}
      </div>
    </div>
  )
}
