/**
 * components/views/ToolkitView.tsx — Engineering Toolkit.
 *
 * Two reference tools reached for mid-problem: unit conversion and a
 * searchable formula sheet. No persistence, no network, no Dexie tables —
 * conversions are stateless and formulas are static content.
 *
 * That makes this the cheapest honest test of the module registry: if
 * adding it needed edits beyond one registry entry and one router line,
 * the registry would be wrong.
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  DIMENSIONS, DIMENSION_MAP, convert, formatResult, type Unit,
} from '@/utils/unitConversion'
import { FORMULAS, FORMULA_CATEGORIES, type Formula } from '@/data/formulas'
import { useToast } from '@/lib/ToastContext'
import ZenHeading from '@/components/ui/ZenHeading'
import styles from './ToolkitView.module.css'

type Tab = 'convert' | 'formulas'

/** Remembers the dimension between visits — the only state here. */
const LAST_DIM_KEY = 'zenith_toolkit_dimension_v1'

export default function ToolkitView() {
  const [tab, setTab] = useState<Tab>('convert')

  return (
    <div className={styles.root}>
      <ZenHeading
        eyebrow="Scholastic · Engineering Toolkit"
        title="Toolkit."
        subtitle="Convert a unit, or find the formula you half-remember."
        size="lg"
      />

      <div className={styles.tabBar} role="tablist" aria-label="Toolkit sections">
        {([['convert', 'Unit Converter'], ['formulas', 'Formula Reference']] as [Tab, string][])
          .map(([id, label]) => (
            <button
              key={id} role="tab" aria-selected={tab === id}
              className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
      </div>

      {tab === 'convert' ? <Converter /> : <FormulaReference />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Unit converter
   ══════════════════════════════════════════════════════════════════ */

function Converter() {
  const { toast } = useToast()

  const [dimId, setDimId] = useState('length')
  const [raw,   setRaw]   = useState('1')
  const [fromId, setFromId] = useState('m')
  const [toId,   setToId]   = useState('ft')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_DIM_KEY)
      if (saved && DIMENSION_MAP.has(saved)) selectDimension(saved)
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dim = DIMENSION_MAP.get(dimId)!

  function selectDimension(id: string) {
    const d = DIMENSION_MAP.get(id)
    if (!d) return
    setDimId(id)
    // Default to the base unit and the next one along, so a dimension
    // switch never leaves a stale unit from the previous dimension.
    setFromId(d.base)
    setToId(d.units.find(x => x.id !== d.base)?.id ?? d.base)
    try { localStorage.setItem(LAST_DIM_KEY, id) } catch { /* noop */ }
  }

  const from: Unit = dim.units.find(x => x.id === fromId) ?? dim.units[0]
  const to:   Unit = dim.units.find(x => x.id === toId)   ?? dim.units[0]

  const parsed = Number(raw.replace(/,/g, '').trim())
  const valid  = raw.trim() !== '' && Number.isFinite(parsed)
  const result = valid ? convert(parsed, from, to) : NaN

  const swap = () => { setFromId(to.id); setToId(from.id) }

  const copy = async () => {
    if (!valid) return
    try {
      await navigator.clipboard.writeText(String(Number(result.toPrecision(12))))
      toast('Result copied.', 'success')
    } catch {
      toast('Could not access the clipboard.', 'error')
    }
  }

  return (
    <div className={styles.pane}>
      <div className={styles.dimBar} role="tablist" aria-label="Dimension">
        {DIMENSIONS.map(d => (
          <button
            key={d.id} role="tab" aria-selected={d.id === dimId}
            className={`${styles.dimChip} ${d.id === dimId ? styles.dimChipOn : ''}`}
            onClick={() => selectDimension(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className={styles.convertGrid}>
        <div className={styles.side}>
          <label className={styles.sideLabel} htmlFor="tk-value">From</label>
          <input
            id="tk-value"
            className={`${styles.value} ${!valid && raw.trim() !== '' ? styles.valueBad : ''}`}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            inputMode="decimal"
            aria-label="Value to convert"
          />
          <select
            className={styles.unit} value={from.id}
            onChange={e => setFromId(e.target.value)}
            aria-label="Convert from unit"
          >
            {dim.units.map(x => <option key={x.id} value={x.id}>{x.label} ({x.id})</option>)}
          </select>
        </div>

        <button type="button" className={styles.swap} onClick={swap} aria-label="Swap units">
          ⇄
        </button>

        <div className={styles.side}>
          <span className={styles.sideLabel}>To</span>
          <output className={styles.result} aria-live="polite">
            {valid ? formatResult(result) : '—'}
          </output>
          <select
            className={styles.unit} value={to.id}
            onChange={e => setToId(e.target.value)}
            aria-label="Convert to unit"
          >
            {dim.units.map(x => <option key={x.id} value={x.id}>{x.label} ({x.id})</option>)}
          </select>
        </div>
      </div>

      <div className={styles.convertFoot}>
        <span className={styles.equation}>
          {valid
            ? `${formatResult(parsed)} ${from.id} = ${formatResult(result)} ${to.id}`
            : 'Enter a number to convert.'}
        </span>
        <button type="button" className={styles.copyBtn} onClick={copy} disabled={!valid}>
          ⎘ Copy result
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Formula reference
   ══════════════════════════════════════════════════════════════════ */

function FormulaReference() {
  const [query,    setQuery]    = useState('')
  const [category, setCategory] = useState<string>('all')
  const [openId,   setOpenId]   = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FORMULAS.filter(f => {
      if (category !== 'all' && f.category !== category) return false
      if (!q) return true
      return f.name.toLowerCase().includes(q)
        || f.category.toLowerCase().includes(q)
        || f.expression.toLowerCase().includes(q)
        || f.tags.some(t => t.includes(q))
        || f.variables.some(v => v.meaning.toLowerCase().includes(q))
    })
  }, [query, category])

  return (
    <div className={styles.pane}>
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, variable, or what it does…"
          aria-label="Search formulas"
        />
        <span className={styles.count}>
          {results.length} of {FORMULAS.length}
        </span>
      </div>

      <div className={styles.dimBar} role="tablist" aria-label="Category">
        <button
          role="tab" aria-selected={category === 'all'}
          className={`${styles.dimChip} ${category === 'all' ? styles.dimChipOn : ''}`}
          onClick={() => setCategory('all')}
        >All</button>
        {FORMULA_CATEGORIES.map(c => (
          <button
            key={c} role="tab" aria-selected={category === c}
            className={`${styles.dimChip} ${category === c ? styles.dimChipOn : ''}`}
            onClick={() => setCategory(c)}
          >{c}</button>
        ))}
      </div>

      {results.length === 0 && (
        <p className={styles.noResults}>
          Nothing matches “{query}”. Try a variable name or what you want to find.
        </p>
      )}

      <ul className={styles.formulaList}>
        {results.map(f => (
          <FormulaCard
            key={f.id} formula={f}
            open={openId === f.id}
            onToggle={() => setOpenId(openId === f.id ? null : f.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function FormulaCard({ formula, open, onToggle }: {
  formula: Formula; open: boolean; onToggle: () => void
}) {
  return (
    <li className={styles.formula}>
      <button
        type="button" className={styles.formulaHead}
        onClick={onToggle} aria-expanded={open}
      >
        <span className={styles.formulaName}>{formula.name}</span>
        <span className={styles.formulaExpr}>{formula.expression}</span>
        <span className={styles.formulaCat}>{formula.category}</span>
      </button>

      {open && (
        <div className={styles.formulaBody}>
          <dl className={styles.vars}>
            {formula.variables.map(v => (
              <div key={v.symbol} className={styles.var}>
                <dt>{v.symbol}</dt>
                <dd>
                  {v.meaning}
                  {v.unit && <span className={styles.varUnit}>{v.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>

          {/* Assumptions are the difference between a reference and a
              trap, so they are given their own treatment rather than
              being buried as small print. */}
          {formula.note && (
            <p className={styles.note}>
              <span className={styles.noteLabel}>Assumes</span>
              {formula.note}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
