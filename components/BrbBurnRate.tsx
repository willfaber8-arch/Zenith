'use client'

import { useState, useEffect, useMemo } from 'react'
import { computeBurnRate, fmtUSD } from '@/utils/burnRateMath'
import styles from './BrbBurnRate.module.css'

/* ── localStorage key namespace ─────────────────────────────────── */

const LS = {
  BALANCE:  'zenith_brb_balance',
  END_DATE: 'zenith_brb_end_date',
  BUFFER:   'zenith_brb_buffer',
} as const

/* ── Default values ─────────────────────────────────────────────── */
// $650 balance, Aug 22 2026 end date, $50 buffer
// → $600 / 84 days ≈ $7.14 / day (caution zone — realistic BRB scenario)

const DEFAULTS = {
  balance:  650,
  endDate:  '2026-08-22',
  buffer:   50,
} as const

/* ── Component ───────────────────────────────────────────────────── */

export default function BrbBurnRate() {
  const [balance,  setBalance]  = useState<number>(DEFAULTS.balance)
  const [endDate,  setEndDate]  = useState<string>(DEFAULTS.endDate)
  const [buffer,   setBuffer]   = useState<number>(DEFAULTS.buffer)
  const [mounted,  setMounted]  = useState(false)

  // Hydrate persisted values after first browser paint
  useEffect(() => {
    const b = localStorage.getItem(LS.BALANCE)
    const d = localStorage.getItem(LS.END_DATE)
    const r = localStorage.getItem(LS.BUFFER)
    if (b) setBalance(parseFloat(b))
    if (d) setEndDate(d)
    if (r) setBuffer(parseFloat(r))
    setMounted(true)
  }, [])

  const analysis = useMemo(
    () => computeBurnRate({ currentBalance: balance, targetEndDate: endDate, bufferReserve: buffer }),
    [balance, endDate, buffer],
  )

  /* Persist on every user change */
  function handleBalance(v: number) {
    setBalance(v)
    localStorage.setItem(LS.BALANCE, String(v))
  }
  function handleEndDate(v: string) {
    setEndDate(v)
    localStorage.setItem(LS.END_DATE, v)
  }
  function handleBuffer(v: number) {
    setBuffer(v)
    localStorage.setItem(LS.BUFFER, String(v))
  }

  const { status, statusLabel, daysRemaining, availableFunds, safeDailyLimit } = analysis

  return (
    <div className={styles.burnCard} data-status={status}>

      {/* ── Card header ──────────────────────────────────────── */}
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardEyebrow}>Big Red Bucks · Cornell Dining</div>
          <div className={styles.cardTitle}>Burn Rate Calculator</div>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {status === 'healthy' ? 'On Track' : status === 'caution' ? 'Caution' : 'Critical'}
        </span>
      </div>

      {/* ── Primary metric ───────────────────────────────────── */}
      <div className={styles.metricSection}>
        <div className={styles.limitRow}>
          <span className={styles.limitAmount} data-status={status}>
            {mounted ? fmtUSD(safeDailyLimit) : '$—'}
          </span>
          <span className={styles.limitUnit}>/ day</span>
        </div>
        <div className={styles.limitSubLabel}>safe daily spending limit</div>
        <p className={styles.statusDesc}>{statusLabel}</p>
      </div>

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>
            {mounted ? daysRemaining : '—'}
          </span>
          <span className={styles.statSub}>days remaining</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>
            {mounted ? fmtUSD(availableFunds) : '$—'}
          </span>
          <span className={styles.statSub}>available funds</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>
            {mounted ? fmtUSD(balance) : '$—'}
          </span>
          <span className={styles.statSub}>current balance</span>
        </div>
      </div>

      {/* ── Input controls ───────────────────────────────────── */}
      <div className={styles.inputSection}>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="brb-balance">
            Current Balance
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputPrefix}>$</span>
            <input
              id="brb-balance"
              type="number"
              className={styles.input}
              min={0}
              step={0.01}
              value={balance}
              onChange={e => handleBalance(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="brb-enddate">
            Semester End Date
          </label>
          <input
            id="brb-enddate"
            type="date"
            className={styles.dateInput}
            value={endDate}
            onChange={e => handleEndDate(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="brb-buffer">
            Buffer Reserve
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputPrefix}>$</span>
            <input
              id="brb-buffer"
              type="number"
              className={styles.input}
              min={0}
              step={5}
              value={buffer}
              onChange={e => handleBuffer(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
          <span className={styles.inputHint}>held in reserve at end of semester</span>
        </div>

      </div>
    </div>
  )
}
