'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Water Parameter Logger
   Phase 4 · Step 4.3

   IDB-backed panel for logging water chemistry readings over time.
   Form → Dexie waterLogs table → useLiveQuery drives both the
   log table and the ParameterChart / cycle auditor automatically.
   ════════════════════════════════════════════════════════════════ */

import { useState, useCallback, type FormEvent, type ChangeEvent, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WaterLog } from '@/lib/db'
import ParameterChart from '@/components/ParameterChart'
import styles from './WaterParameterLogger.module.css'

/* ── Range constraints (matching waterChemistry.ts schema) ─────── */

const PARAMS = {
  pH:       { min: 4.0, max: 9.0,  step: 0.1,  unit: '',    label: 'pH'         },
  ammonia:  { min: 0.0, max: 8.0,  step: 0.01, unit: 'ppm', label: 'Ammonia NH₃' },
  nitrite:  { min: 0.0, max: 5.0,  step: 0.01, unit: 'ppm', label: 'Nitrite NO₂⁻' },
  nitrate:  { min: 0.0, max: 160,  step: 1,    unit: 'ppm', label: 'Nitrate NO₃⁻' },
} as const

type ParamKey = keyof typeof PARAMS

const PARAM_COLORS: Record<ParamKey, string> = {
  pH:      'var(--accent-green)',
  ammonia: '#f59e0b',
  nitrite: '#f87171',
  nitrate: '#52cca3',
}

/* ── Helpers ──────────────────────────────────────────────────── */

const todayISO = () => new Date().toISOString().slice(0, 10)

function fmtVal(key: ParamKey, v: number): string {
  if (key === 'pH')      return v.toFixed(1)
  if (key === 'nitrate') return v.toFixed(0)
  return v.toFixed(2)
}

function ppmBadgeColor(key: ParamKey, val: number): string {
  if (key === 'ammonia' && val > 0.25) return val > 2 ? '#f87171' : '#f59e0b'
  if (key === 'nitrite' && val > 0.25) return val > 1 ? '#f87171' : '#f59e0b'
  if (key === 'nitrate' && val > 40)   return val > 80 ? '#f87171' : '#f59e0b'
  return 'var(--text-dark)'
}

/* ── Component ────────────────────────────────────────────────── */

export default function WaterParameterLogger() {

  /* Form state */
  const [logDate,  setLogDate]  = useState(todayISO)
  const [pH,       setPH]       = useState(7.0)
  const [ammonia,  setAmmonia]  = useState(0.0)
  const [nitrite,  setNitrite]  = useState(0.0)
  const [nitrate,  setNitrate]  = useState(0.0)
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)

  /* Live data from IDB — chronological order */
  const logs = useLiveQuery<WaterLog[]>(
    () => db.waterLogs.orderBy('logDate').toArray(),
    [],
  )

  /* ── Handlers ─────────────────────────────────────────────── */

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await db.waterLogs.add({
        logDate,
        pH:      Math.round(pH      * 10)  / 10,
        ammonia: Math.round(ammonia * 100) / 100,
        nitrite: Math.round(nitrite * 100) / 100,
        nitrate: Math.round(nitrate * 1)   / 1,
        notes:   notes.trim() || undefined,
        createdAt: Date.now(),
      })
      // Reset to today + zero chemistry values
      setLogDate(todayISO())
      setAmmonia(0); setNitrite(0); setNitrate(0)
      setNotes('')
    } finally {
      setSaving(false)
    }
  }, [saving, logDate, pH, ammonia, nitrite, nitrate, notes])

  const deleteLog = useCallback(async (id: number) => {
    await db.waterLogs.delete(id)
  }, [])

  /* ── Number input handler (validates range) ────────────────── */
  const numHandler = (
    setter: (v: number) => void,
    key: ParamKey,
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (isNaN(v)) return
    const { min, max } = PARAMS[key]
    setter(Math.min(max, Math.max(min, v)))
  }

  /* ── Render ──────────────────────────────────────────────────── */
  const recentLogs = [...(logs ?? [])].reverse().slice(0, 10)

  return (
    <div className={styles.logger}>

      {/* ══════════════════════════════════════════════════════════
          TWO-COLUMN: FORM+TABLE left | CHART right
          ══════════════════════════════════════════════════════════ */}
      <div className={styles.mainLayout}>

        {/* ── LEFT: Form + log table ───────────────────────────── */}
        <div className={styles.leftColumn}>

          {/* Form panel */}
          <div className={styles.formPanel}>
            <span className={styles.panelLabel}>Log Parameters</span>

            <form className={styles.form} onSubmit={handleSubmit}>
              {/* Date */}
              <div className={styles.formRow}>
                <label className={styles.fieldLabel} htmlFor="wl-date">Log Date</label>
                <input
                  id="wl-date"
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className={styles.dateInput}
                  required
                />
              </div>

              {/* Chemistry parameters */}
              {(Object.keys(PARAMS) as ParamKey[]).map(key => {
                const p = PARAMS[key]
                const val = key === 'pH' ? pH : key === 'ammonia' ? ammonia : key === 'nitrite' ? nitrite : nitrate
                const setter = key === 'pH' ? setPH : key === 'ammonia' ? setAmmonia : key === 'nitrite' ? setNitrite : setNitrate
                const fillPct = ((val - p.min) / (p.max - p.min)) * 100

                return (
                  <div key={key} className={styles.paramField}>
                    <div className={styles.paramHeader}>
                      <label className={styles.fieldLabel} htmlFor={`wl-${key}`}>
                        {p.label}
                      </label>
                      <span
                        className={styles.paramValue}
                        style={{ color: PARAM_COLORS[key] }}
                      >
                        {fmtVal(key, val)}{p.unit && ` ${p.unit}`}
                      </span>
                    </div>
                    <div className={styles.sliderRow}>
                      <input
                        id={`wl-${key}`}
                        type="range"
                        min={p.min} max={p.max} step={p.step}
                        value={val}
                        onChange={e => setter(parseFloat(e.target.value))}
                        className={styles.slider}
                        style={{
                          '--fill': PARAM_COLORS[key],
                          '--fill-pct': `${fillPct}%`,
                        } as CSSProperties}
                      />
                      <input
                        type="number"
                        min={p.min} max={p.max} step={p.step}
                        value={val}
                        onChange={numHandler(setter, key)}
                        className={styles.numInput}
                        aria-label={p.label + ' value'}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Notes */}
              <div className={styles.formRow}>
                <label className={styles.fieldLabel} htmlFor="wl-notes">Notes</label>
                <input
                  id="wl-notes"
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Water change, treatment, etc."
                  className={styles.notesInput}
                  maxLength={120}
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={saving}
              >
                {saving ? 'Saving…' : '+ Log Parameters'}
              </button>
            </form>
          </div>

          {/* Log table */}
          {recentLogs.length > 0 && (
            <div className={styles.tablePanel}>
              <span className={styles.panelLabel}>
                Recent Log · {logs?.length ?? 0} reading{logs?.length !== 1 ? 's' : ''}
              </span>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>pH</th>
                      <th style={{ color: '#f59e0b' }}>NH₃</th>
                      <th style={{ color: '#f87171' }}>NO₂⁻</th>
                      <th style={{ color: '#52cca3' }}>NO₃⁻</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map(log => (
                      <tr key={log.id}>
                        <td className={styles.dateCell}>{log.logDate}</td>
                        <td>{log.pH.toFixed(1)}</td>
                        <td style={{ color: ppmBadgeColor('ammonia', log.ammonia) }}>
                          {log.ammonia.toFixed(2)}
                        </td>
                        <td style={{ color: ppmBadgeColor('nitrite', log.nitrite) }}>
                          {log.nitrite.toFixed(2)}
                        </td>
                        <td style={{ color: ppmBadgeColor('nitrate', log.nitrate) }}>
                          {log.nitrate}
                        </td>
                        <td>
                          <button
                            className={styles.deleteRowBtn}
                            onClick={() => log.id !== undefined && deleteLog(log.id)}
                            aria-label={`Delete reading from ${log.logDate}`}
                          >×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(logs?.length ?? 0) > 10 && (
                <p className={styles.moreHint}>Showing latest 10 of {logs?.length} readings.</p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Chart ─────────────────────────────────────── */}
        <div className={styles.chartPanel}>
          <span className={styles.panelLabel}>Nitrogen Cycle Timeline</span>
          <ParameterChart logs={logs ?? []} />
        </div>
      </div>
    </div>
  )
}
