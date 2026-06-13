'use client'

import { useState, useMemo } from 'react'
import ZenHeading from '@/components/ui/ZenHeading'
import { useSubscriptionAnalytics } from '@/lib/hooks/useSubscriptionAnalytics'
import { calculateTrueMonthlyCost } from '@/types/finance'
import type { BillingCycle } from '@/types/finance'
import styles from './SubscriptionPackagesView.module.css'

/* ── Constants ────────────────────────────────────────────── */

const BUNDLE_PRESETS = [
  'Entertainment Bundle',
  'Academic Suite',
  'Productivity Tools',
  'Cloud Storage',
  'Music & Audio',
  'Gaming',
  'News & Media',
  'Health & Fitness',
  'Developer Tools',
]

const BLANK_FORM = {
  name:             '',
  cost:             '',
  billingCycle:     'MONTHLY' as BillingCycle,
  renewalDateString: '',
  categoryBundle:   '',
}

/* ── Formatting helpers ───────────────────────────────────── */

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}

function daysUntil(iso: string): number {
  if (!iso) return 9999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function fmtRenewal(iso: string): string {
  if (!iso) return ''
  const days = daysUntil(iso)
  if (days <= 0)  return 'Renews today'
  if (days === 1) return 'Renews tomorrow'
  return fmtDate(iso)
}

/* ── Component ────────────────────────────────────────────── */

export default function SubscriptionPackagesView() {
  const {
    items,
    totalCount,
    grossMonthlyOutflow,
    bundleGroups,
    budgetThreshold,
    setBudgetThreshold,
    criticalBurn,
    burnPercent,
    addItem,
    removeItem,
  } = useSubscriptionAnalytics()

  /* Form state */
  const [form, setForm]           = useState({ ...BLANK_FORM })
  const [budgetInput, setBudgetInput] = useState(() => budgetThreshold.toFixed(2))
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /* Unique bundle names already in use (for datalist suggestions) */
  const existingBundles = useMemo(
    () => [...new Set(items.map(i => i.categoryBundle))],
    [items]
  )

  /* ── Event handlers ─────────────────────────────────────── */

  function handleBudgetBlur() {
    const v = parseFloat(budgetInput)
    if (!isNaN(v) && v > 0) {
      setBudgetThreshold(v)
    } else {
      setBudgetInput(budgetThreshold.toFixed(2))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cost = parseFloat(form.cost)

    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (isNaN(cost) || cost <= 0) {
      setFormError('Enter a valid cost greater than $0.')
      return
    }
    if (!form.categoryBundle.trim()) {
      setFormError('Bundle is required.')
      return
    }

    setFormError('')
    setSubmitting(true)
    try {
      await addItem({
        name:              form.name.trim(),
        monthlyCost:       cost,
        billingCycle:      form.billingCycle,
        renewalDateString: form.renewalDateString,
        categoryBundle:    form.categoryBundle.trim(),
      })
      setForm({ ...BLANK_FORM })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Derived gauge values ───────────────────────────────── */
  const fillPct  = Math.min(burnPercent, 100)
  const annualProjection = grossMonthlyOutflow * 12
  const budgetRemaining  = budgetThreshold - grossMonthlyOutflow
  const costPreview = form.billingCycle === 'ANNUAL' && form.cost !== '' && !isNaN(parseFloat(form.cost))
    ? parseFloat(form.cost) / 12
    : null

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className={styles.container}>
      <ZenHeading
        eyebrow="Life · Finance"
        title="Subscriptions."
        subtitle="Track, bundle, and optimize your recurring expenses."
      />

      {/* ── Burn-Rate Panel ─────────────────────────────── */}
      <div className={`${styles.burnPanel} ${criticalBurn ? styles.burnPanelCritical : ''}`}>
        <div className={styles.burnTopRow}>
          <div className={styles.burnOutflowBlock}>
            <span className={styles.burnLabel}>Monthly Burn</span>
            <span className={`${styles.burnAmount} ${criticalBurn ? styles.burnAmountCritical : ''}`}>
              ${fmt(grossMonthlyOutflow)}
            </span>
          </div>

          <div className={styles.burnBudgetBlock}>
            <label className={styles.burnLabel} htmlFor="budget-threshold">
              Budget Ceiling
            </label>
            <div className={styles.burnBudgetInput}>
              <span className={styles.burnCurrencySymbol}>$</span>
              <input
                id="budget-threshold"
                type="number"
                min="1"
                step="0.01"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onBlur={handleBudgetBlur}
                className={styles.burnThresholdField}
                aria-label="Monthly budget ceiling"
              />
              <span className={styles.burnLabel}>/mo</span>
            </div>
          </div>
        </div>

        {/* Gauge */}
        <div className={styles.burnTrack} role="progressbar" aria-valuenow={Math.round(fillPct)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={styles.burnFill}
            style={{
              '--fill-pct': fillPct,
              '--bar-color': criticalBurn ? '#ff5c5c' : '#52cca3',
            } as React.CSSProperties}
          />
        </div>

        <div className={styles.burnFooter}>
          <span className={`${styles.burnFooterText} ${criticalBurn ? styles.burnFooterCritical : ''}`}>
            {criticalBurn
              ? `⚠ CRITICAL BURN — ${fmt(Math.min(burnPercent, 999))}% of budget consumed`
              : `${fmt(fillPct)}% of $${fmt(budgetThreshold)} monthly budget`}
          </span>
          <div className={styles.burnStatChips}>
            <span className={styles.burnChip}>{totalCount} active</span>
            <span className={styles.burnChip}>{bundleGroups.length} bundle{bundleGroups.length !== 1 ? 's' : ''}</span>
            {totalCount > 0 && (
              <span className={styles.burnChip}>${fmt(annualProjection)}/yr</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content Grid ────────────────────────────────── */}
      <div className={styles.contentGrid}>

        {/* ── Bundle Groups ─────────────────────────────── */}
        <div className={styles.bundlesColumn}>
          {bundleGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyGlyph}>◫</span>
              <p className={styles.emptyLabel}>No subscriptions yet</p>
              <p className={styles.emptyHint}>Add your first subscription using the form →</p>
            </div>
          ) : (
            bundleGroups.map(group => (
              <div key={group.bundle} className={styles.bundleCard}>
                <div className={styles.bundleHeader}>
                  <div className={styles.bundleNameRow}>
                    <span className={styles.bundleIcon}>⬡</span>
                    <span className={styles.bundleName}>{group.bundle}</span>
                    <span className={styles.bundleCount}>{group.items.length}</span>
                  </div>
                  <div className={styles.bundleTotalBlock}>
                    <span className={styles.bundleTotalLabel}>Bundle total</span>
                    <span className={styles.bundleTotalAmount}>
                      ${fmt(group.totalMonthly)}
                      <span className={styles.bundleTotalSuffix}>/mo</span>
                    </span>
                  </div>
                </div>

                <div className={styles.itemList}>
                  {group.items.map(item => {
                    const trueMonthly = calculateTrueMonthlyCost(item.monthlyCost, item.billingCycle)
                    const days        = daysUntil(item.renewalDateString)
                    const renewalStr  = fmtRenewal(item.renewalDateString)
                    const soonFlag    = item.renewalDateString !== '' && days <= 7

                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemMain}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={`${styles.cycleBadge} ${
                            item.billingCycle === 'ANNUAL'
                              ? styles.cycleBadgeAnnual
                              : styles.cycleBadgeMonthly
                          }`}>
                            {item.billingCycle === 'ANNUAL' ? '12-mo' : 'mo'}
                          </span>
                        </div>

                        <div className={styles.itemMeta}>
                          {renewalStr && (
                            <span className={`${styles.renewalDate} ${soonFlag ? styles.renewalSoon : ''}`}>
                              {renewalStr}
                            </span>
                          )}
                          <span className={styles.itemCost}>
                            ${fmt(trueMonthly)}
                            <span className={styles.costSuffix}>/mo</span>
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className={styles.deleteBtn}
                            aria-label={`Remove ${item.name}`}
                            title="Remove subscription"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Right Column: Form + Projection ───────────── */}
        <div className={styles.formColumn}>

          {/* Add subscription form */}
          <form onSubmit={handleSubmit} className={styles.addForm} noValidate>
            <h3 className={styles.formTitle}>Add Subscription</h3>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="sub-name">Name</label>
              <input
                id="sub-name"
                className={styles.fieldInput}
                type="text"
                placeholder="e.g. Spotify Premium"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoComplete="off"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Billing Cycle</label>
              <div className={styles.cycleToggle}>
                {(['MONTHLY', 'ANNUAL'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.cycleBtn} ${form.billingCycle === c ? styles.cycleBtnActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, billingCycle: c }))}
                  >
                    {c === 'MONTHLY' ? 'Monthly' : 'Annual'}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="sub-cost">
                {form.billingCycle === 'ANNUAL' ? 'Annual Cost ($)' : 'Monthly Cost ($)'}
              </label>
              <input
                id="sub-cost"
                className={styles.fieldInput}
                type="number"
                min="0.01"
                step="0.01"
                placeholder={form.billingCycle === 'ANNUAL' ? 'e.g. 99.99' : 'e.g. 9.99'}
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
              />
              {costPreview !== null && (
                <span className={styles.costPreview}>≈ ${fmt(costPreview)}/mo</span>
              )}
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="sub-renewal">Next Renewal</label>
              <input
                id="sub-renewal"
                className={styles.fieldInput}
                type="date"
                value={form.renewalDateString}
                onChange={e => setForm(f => ({ ...f, renewalDateString: e.target.value }))}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="sub-bundle">Bundle</label>
              <input
                id="sub-bundle"
                className={styles.fieldInput}
                type="text"
                placeholder="e.g. Entertainment Bundle"
                list="bundle-presets-list"
                value={form.categoryBundle}
                onChange={e => setForm(f => ({ ...f, categoryBundle: e.target.value }))}
                autoComplete="off"
              />
              <datalist id="bundle-presets-list">
                {existingBundles.map(b => <option key={`existing-${b}`} value={b} />)}
                {BUNDLE_PRESETS
                  .filter(p => !existingBundles.includes(p))
                  .map(p => <option key={`preset-${p}`} value={p} />)}
              </datalist>
            </div>

            {formError && (
              <p className={styles.formError} role="alert">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={styles.submitBtn}
            >
              {submitting ? 'Adding…' : '+ Add Subscription'}
            </button>
          </form>

          {/* Annual projection card — only when data exists */}
          {totalCount > 0 && (
            <div className={styles.projectionCard}>
              <h4 className={styles.projectionTitle}>Annual Projection</h4>

              <div className={styles.projectionRow}>
                <span className={styles.projectionLabel}>Monthly outflow</span>
                <span className={styles.projectionValue}>${fmt(grossMonthlyOutflow)}</span>
              </div>
              <div className={styles.projectionRow}>
                <span className={styles.projectionLabel}>Annual total</span>
                <span className={styles.projectionValue}>${fmt(annualProjection)}</span>
              </div>

              <div className={styles.projectionDivider} />

              <div className={styles.projectionRow}>
                <span className={styles.projectionLabel}>
                  {criticalBurn ? 'Over budget by' : 'Budget remaining'}
                </span>
                <span className={`${styles.projectionValue} ${criticalBurn ? styles.projectionOver : styles.projectionUnder}`}>
                  {criticalBurn ? '+' : ''}${fmt(Math.abs(budgetRemaining))}/mo
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
