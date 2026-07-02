'use client'

import { useState, useMemo } from 'react'
import styles from './TrailHunter.module.css'

/* ── Constants ────────────────────────────────────────────────────── */

type DistanceKey = 'any' | 'u3' | '3-6' | '6-10' | '10p'
type DifficultyKey = 'any' | 'easy' | 'moderate' | 'hard'

const DISTANCE_OPTIONS: { key: DistanceKey; label: string; words: string }[] = [
  { key: 'any',  label: 'Any distance', words: '' },
  { key: 'u3',   label: 'Under 3 mi',   words: 'under 3 miles' },
  { key: '3-6',  label: '3–6 mi',       words: '3 to 6 miles' },
  { key: '6-10', label: '6–10 mi',      words: '6 to 10 miles' },
  { key: '10p',  label: '10+ mi',       words: '10+ miles' },
]

const DIFFICULTY_OPTIONS: { key: DifficultyKey; label: string; words: string }[] = [
  { key: 'any',      label: 'Any',      words: '' },
  { key: 'easy',     label: 'Easy',     words: 'easy' },
  { key: 'moderate', label: 'Moderate', words: 'moderate' },
  { key: 'hard',     label: 'Hard',     words: 'hard' },
]

const FEATURE_OPTIONS: { key: string; label: string; words: string }[] = [
  { key: 'waterfall', label: 'Waterfall',       words: 'waterfall' },
  { key: 'lake',      label: 'Lake / swimming', words: 'lake swimming' },
  { key: 'scenic',    label: 'Scenic views',    words: 'scenic views' },
  { key: 'loop',      label: 'Loop trail',      words: 'loop trail' },
  { key: 'dog',       label: 'Dog-friendly',    words: 'dog friendly' },
  { key: 'kid',       label: 'Kid-friendly',    words: 'kid friendly' },
]

/* ── Component ────────────────────────────────────────────────────── */

export default function TrailHunter() {
  const [region,     setRegion]     = useState('')
  const [distance,   setDistance]   = useState<DistanceKey>('any')
  const [difficulty, setDifficulty] = useState<DifficultyKey>('any')
  const [features,   setFeatures]   = useState<Set<string>>(new Set())

  const distWords = DISTANCE_OPTIONS.find(d => d.key === distance)?.words ?? ''
  const diffWords = DIFFICULTY_OPTIONS.find(d => d.key === difficulty)?.words ?? ''
  const featWords = useMemo(
    () => FEATURE_OPTIONS.filter(f => features.has(f.key)).map(f => f.words),
    [features],
  )

  const trimmedRegion = region.trim()
  const canSearch = trimmedRegion.length > 0

  /** The raw Google query string. */
  const query = useMemo(() => {
    const parts = [
      'hiking trails near',
      trimmedRegion,
      distWords,
      diffWords,
      ...featWords,
    ].filter(Boolean)
    return parts.join(' ')
  }, [trimmedRegion, distWords, diffWords, featWords])

  /** Human-readable preview (segmented with · separators). */
  const preview = useMemo(() => {
    const segs = [
      `hiking trails near ${trimmedRegion || '…'}`,
      distWords,
      diffWords,
      ...featWords,
    ].filter(Boolean)
    return segs.join(' · ')
  }, [trimmedRegion, distWords, diffWords, featWords])

  function toggleFeature(key: string) {
    setFeatures(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function runSearch() {
    if (!canSearch) return
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.trailHunter}>
      <div className={styles.builderCard}>

        <div className={styles.builderIntro}>
          <p className={styles.introLabel}>Trail Search Builder</p>
          <p className={styles.introHint}>
            Describe the hike you want. We&apos;ll build a Google search and open real,
            up-to-date trail results in a new tab.
          </p>
        </div>

        {/* Region */}
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="th-region">Region <span className={styles.req}>*</span></label>
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8.5 8.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              id="th-region"
              className={styles.searchInput}
              type="text"
              placeholder="City, state, or park — e.g. Ithaca NY"
              value={region}
              onChange={e => setRegion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
            />
          </div>
        </div>

        {/* Distance + Difficulty selects */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="th-distance">Distance</label>
            <select
              id="th-distance"
              className={styles.select}
              value={distance}
              onChange={e => setDistance(e.target.value as DistanceKey)}
            >
              {DISTANCE_OPTIONS.map(d => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="th-difficulty">Difficulty</label>
            <select
              id="th-difficulty"
              className={styles.select}
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as DifficultyKey)}
            >
              {DIFFICULTY_OPTIONS.map(d => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Features */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Features</label>
          <div className={styles.featureGrid}>
            {FEATURE_OPTIONS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFeature(f.key)}
                className={[
                  styles.featureBtn,
                  features.has(f.key) ? styles.featureBtnActive : '',
                ].join(' ')}
                aria-pressed={features.has(f.key)}
              >
                <span className={styles.featureCheck}>
                  {features.has(f.key) ? '✓' : '+'}
                </span>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className={styles.previewBox}>
          <span className={styles.previewLabel}>Query</span>
          <span className={styles.previewText}>{preview}</span>
        </div>

        {/* Search */}
        <button
          type="button"
          className={styles.searchBtn}
          onClick={runSearch}
          disabled={!canSearch}
        >
          Search on Google →
        </button>
      </div>
    </div>
  )
}
