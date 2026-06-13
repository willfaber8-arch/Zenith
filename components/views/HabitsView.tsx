'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  useHabits,
  type HabitWithCompletion,
  type DayStatus,
  type NewHabitInput,
} from '@/lib/hooks/useHabits'
import { useLiveQuery }         from 'dexie-react-hooks'
import { db, type Habit }       from '@/lib/db'
import { calculateMovingGritScore } from '@/utils/gritScore'
import GritAnalyticsChart       from '@/components/GritAnalyticsChart'
import ZenHeading               from '@/components/ui/ZenHeading'
import { useToast }             from '@/lib/ToastContext'
import styles from './HabitsView.module.css'

/* ── Day labels ───────────────────────────────────────────── */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_SHORT  = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/* ── Preset categories ────────────────────────────────────── */
const PRESET_CATEGORIES = ['General', 'Life', 'Scholastic', 'Health', 'Fitness', 'Mindfulness']

/* ── Colour presets ───────────────────────────────────────── */
const COLOR_PRESETS = [
  '#7c95ff', // periwinkle (default)
  '#52cca3', // ocean sage
  '#f59e0b', // amber
  '#f87171', // rose
  '#a78bfa', // violet
  '#38bdf8', // sky blue
  '#34d399', // emerald
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#94a3b8', // slate
]

/* ── Circle progress SVG ──────────────────────────────────── */
function CircleProgress({
  pct, size = 48, done, color,
}: {
  pct: number; size?: number; done: boolean; color?: string
}) {
  const r    = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct / 100, 1)
  const stroke = done ? 'var(--accent-green)' : (color ?? 'var(--accent-purple)')
  return (
    <svg width={size} height={size} className={styles.circle} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={3} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 350ms var(--ease-smooth)' }}
      />
    </svg>
  )
}

/* ── Confetti burst ───────────────────────────────────────── */
function useCompletionBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const burst = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const particles = Array.from({ length: 28 }, () => ({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 2) * 5,
      alpha: 1,
      r: Math.random() * 4 + 2,
      color: Math.random() > 0.5 ? '#7c95ff' : '#52cca3',
    }))
    let raf: number
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.alpha -= 0.025
        if (p.alpha <= 0) continue
        alive = true
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (alive) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    setTimeout(() => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height) }, 1500)
  }, [])
  return { canvasRef, burst }
}

/* ── Habit row ────────────────────────────────────────────── */
function HabitRow({
  habit, today, weekDates, onIncrement, onDelete, onEdit, editMode,
}: {
  habit:       HabitWithCompletion
  today:       string
  weekDates:   string[]
  onIncrement: (id: number, e: React.MouseEvent) => void
  onDelete:    (id: number) => void
  onEdit:      (habit: HabitWithCompletion) => void
  editMode:    boolean
}) {
  const pct           = habit.targetCompletions > 0
    ? Math.round((habit.todayCount / habit.targetCompletions) * 100) : 0
  const todayScheduled = habit.weekData.find(d => d.iso === today)?.scheduled ?? false
  const allTimeHigh    = habit.allTimeHighStreak ?? habit.streakCount
  const habitColor     = habit.color ?? '#7c95ff'

  return (
    <div
      className={`${styles.habitRow} ${habit.todayDone && todayScheduled ? styles.habitRowDone : ''} ${editMode ? styles.habitRowEdit : ''}`}
      style={{ '--habit-color': habitColor } as React.CSSProperties}
    >

      {/* Left: circle + name */}
      <div className={styles.habitLeft}>
        <div className={styles.circleWrap}>
          <CircleProgress pct={pct} done={habit.todayDone && todayScheduled} color={habitColor} />
          {todayScheduled && !editMode && (
            <button
              type="button"
              className={styles.plusBtn}
              onClick={(e) => onIncrement(habit.id, e)}
              disabled={habit.todayDone}
              aria-label={`Add completion for ${habit.name}`}
            >
              {habit.todayDone ? '✓' : '+'}
            </button>
          )}
        </div>

        <div className={styles.habitInfo}>
          <div className={styles.habitNameRow}>
            <span className={styles.habitName}>{habit.name}</span>
            {habit.category && habit.category !== 'General' && (
              <span className={styles.habitCategoryBadge}>{habit.category}</span>
            )}
          </div>
          <span className={styles.habitMeta}>
            {habit.todayCount}/{habit.targetCompletions}
            {habit.stepLabel ? ` ${habit.stepLabel}` : ''}
            {' · '}
            {habit.activeDays.length === 0
              ? 'Daily'
              : habit.activeDays.map(d => DAY_SHORT[d]).join(' ')}
          </span>
        </div>
      </div>

      {/* Centre: week dots (hidden in edit mode) */}
      {!editMode && (
        <div className={styles.weekDots} aria-label="Week progress">
          {weekDates.map((iso) => {
            const day = habit.weekData.find(d => d.iso === iso)
            const isToday = iso === today
            if (!day?.scheduled) return <span key={iso} className={styles.dotEmpty} aria-hidden="true" />
            return (
              <span
                key={iso}
                className={`${styles.dot} ${day.done ? styles.dotDone : ''} ${isToday ? styles.dotToday : ''}`}
                aria-label={`${iso}: ${day.done ? 'done' : 'pending'}`}
              />
            )
          })}
        </div>
      )}

      {/* Right: streak / edit actions */}
      <div className={styles.habitRight}>
        {!editMode && habit.streakCount > 0 && (
          <span className={`${styles.streak} ${habit.streakCount >= 7 ? styles.streakHot : ''}`}>
            🔥 {habit.streakCount}
          </span>
        )}

        {editMode && (
          <div className={styles.editActions}>
            <span className={styles.allTimeHigh} title="All-time high streak">
              🏆 {allTimeHigh}
            </span>
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => onEdit(habit)}
              aria-label={`Edit ${habit.name}`}
            >
              Edit
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(habit.id)}
              aria-label={`Delete habit ${habit.name}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Category section header ──────────────────────────────── */
function CategorySection({
  category, habits, collapsed, onToggle, children,
}: {
  category:  string
  habits:    HabitWithCompletion[]
  collapsed: boolean
  onToggle:  () => void
  children:  React.ReactNode
}) {
  const done  = habits.filter(h => h.todayDone).length
  const total = habits.length

  return (
    <div className={styles.categorySection}>
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className={styles.categoryChevron} aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
        <span className={styles.categoryName}>{category}</span>
        <span className={styles.categoryCount}>{done}/{total}</span>
      </button>
      <div
        className={styles.categoryCollapse}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className={styles.categoryCollapseInner}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ── Create/Edit habit modal ──────────────────────────────── */
function HabitModal({
  onClose,
  onSave,
  initial,
}: {
  onClose:  () => void
  onSave:   (input: NewHabitInput) => void
  initial?: HabitWithCompletion
}) {
  const initStepAmount = initial?.stepAmount ?? 1
  const [name,       setName]       = useState(initial?.name ?? '')
  const [category,   setCategory]   = useState(initial?.category ?? 'General')
  const [customCat,  setCustomCat]  = useState(
    initial?.category && !PRESET_CATEGORIES.includes(initial.category) ? initial.category : ''
  )
  const [color,      setColor]      = useState(initial?.color ?? '#7c95ff')
  const [days,       setDays]       = useState<number[]>(initial?.activeDays ?? [])
  const [daily,      setDaily]      = useState((initial?.activeDays ?? []).length === 0)
  const [useCustom,  setUseCustom]  = useState(
    !!(initial?.category && !PRESET_CATEGORIES.includes(initial.category))
  )
  // Step model: each click adds stepAmount; done when count >= goal
  const [stepAmount, setStepAmount] = useState<number>(initStepAmount)
  const [stepUnit,   setStepUnit]   = useState(initial?.stepLabel ?? '')
  const [goal,       setGoal]       = useState<number>(initial?.targetCompletions ?? 0)

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const resolvedCategory = useCustom ? (customCat || 'General') : category
  const canSubmit = name.trim().length > 0 && goal > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSave({
      name:              name.trim(),
      category:          resolvedCategory,
      color,
      activeDays:        daily ? [] : days,
      targetCompletions: goal,
      stepAmount:        stepAmount > 0 ? stepAmount : 1,
      stepLabel:         stepUnit.trim() || undefined,
    })
    onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const clicksNeeded = goal > 0 && stepAmount > 0 ? Math.ceil(goal / stepAmount) : 0

  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={initial ? 'Edit Habit' : 'Create Habit'}>
        <div className={styles.modalHeader}>
          <p className={styles.modalEyebrow}>Life · Habits</p>
          <p className={styles.modalTitle}>{initial ? 'Edit Habit' : 'New Habit'}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="habit-name">Habit name</label>
            <input
              id="habit-name"
              type="text"
              className={styles.input}
              placeholder="e.g. Drink water"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Category picker */}
          <div className={styles.field}>
            <span className={styles.label}>Category</span>
            <div className={styles.categoryPickRow}>
              {PRESET_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.dayChip} ${!useCustom && category === cat ? styles.dayChipOn : ''}`}
                  onClick={() => { setCategory(cat); setUseCustom(false) }}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.dayChip} ${useCustom ? styles.dayChipOn : ''}`}
                onClick={() => setUseCustom(true)}
              >
                Custom…
              </button>
            </div>
            {useCustom && (
              <input
                type="text"
                className={`${styles.input} ${styles.inputSmall}`}
                placeholder="Category name"
                value={customCat}
                onChange={e => setCustomCat(e.target.value)}
                style={{ marginTop: 'var(--sp-2)' }}
              />
            )}
          </div>

          {/* Colour picker */}
          <div className={styles.field}>
            <span className={styles.label}>Habit colour</span>
            <div className={styles.colorPickerRow}>
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.colorSwatch} ${color === preset ? styles.colorSwatchActive : ''}`}
                  style={{ background: preset }}
                  onClick={() => setColor(preset)}
                  aria-label={`Select colour ${preset}`}
                />
              ))}
              <label className={`${styles.colorSwatch} ${styles.colorSwatchCustom} ${!COLOR_PRESETS.includes(color) ? styles.colorSwatchActive : ''}`} style={{ background: color }} title="Custom colour">
                <span className={styles.colorWheelIcon} aria-hidden="true">⊕</span>
                <input
                  type="color"
                  className={styles.colorWheelInput}
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  aria-label="Custom habit colour"
                />
              </label>
            </div>
            <div className={styles.colorPreview}>
              <span className={styles.colorPreviewDot} style={{ background: color, boxShadow: `0 0 8px ${color}55` }} />
              <span className={styles.colorPreviewLabel}>{color}</span>
            </div>
          </div>

          {/* Frequency */}
          <div className={styles.field}>
            <span className={styles.label}>Occurs on</span>
            <div className={styles.dayToggleRow}>
              <button type="button" className={`${styles.dayChip} ${daily ? styles.dayChipOn : ''}`} onClick={() => setDaily(true)}>Daily</button>
              {DAY_NAMES.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.dayChip} ${!daily && days.includes(i) ? styles.dayChipOn : ''}`}
                  onClick={() => { setDaily(false); toggleDay(i) }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Step model */}
          <div className={styles.field}>
            <span className={styles.label}>Daily goal <span className={styles.labelRequired}>*</span></span>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.labelSub} htmlFor="habit-step">Each tap adds</label>
                <input
                  id="habit-step"
                  type="number"
                  min={1}
                  className={`${styles.input} ${styles.inputSmall}`}
                  value={stepAmount}
                  onChange={e => setStepAmount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.labelSub} htmlFor="habit-unit">Unit (optional)</label>
                <input
                  id="habit-unit"
                  type="text"
                  className={`${styles.input} ${styles.inputSmall}`}
                  placeholder="oz, min, miles…"
                  value={stepUnit}
                  onChange={e => setStepUnit(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.labelSub} htmlFor="habit-goal">Daily goal</label>
                <input
                  id="habit-goal"
                  type="number"
                  min={1}
                  className={`${styles.input} ${styles.inputSmall}`}
                  placeholder="e.g. 20"
                  value={goal === 0 ? '' : goal}
                  onChange={e => setGoal(Math.max(0, Number(e.target.value)))}
                  required
                />
              </div>
            </div>
            {clicksNeeded > 0 && (
              <p className={styles.stepHint}>
                {clicksNeeded} tap{clicksNeeded !== 1 ? 's' : ''} to reach {goal}{stepUnit ? ` ${stepUnit}` : ''}
              </p>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              {initial ? 'Save Changes' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN VIEW
   ════════════════════════════════════════════════════════════ */

export default function HabitsView() {
  const {
    habits, weekDates, today, dailyPct,
    scheduledCount, doneCount,
    increment, createHabit, deleteHabit, updateHabit,
  } = useHabits()

  const { toast }               = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [editMode,   setEditMode]   = useState(false)
  const [editTarget, setEditTarget] = useState<HabitWithCompletion | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const { canvasRef, burst }    = useCompletionBurst()

  const allHabits = useLiveQuery(
    () => db?.habits.toArray() ?? Promise.resolve([]),
    [],
    [],
  )
  const gritPoints = allHabits ? calculateMovingGritScore(allHabits) : []

  const handleIncrement = useCallback(async (habitId: number, e: React.MouseEvent) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return
    const prevDone = habit.todayDone
    await increment(habitId)
    if (!prevDone && (habit.todayCount + 1) >= habit.targetCompletions) {
      burst(e.clientX, e.clientY)
      toast(`${habit.name} — completed! 🎉`, 'success')
    }
  }, [habits, increment, burst, toast])

  const handleDelete = useCallback(async (habitId: number) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return
    await deleteHabit(habitId)
    toast(`"${habit.name}" removed.`, 'info')
  }, [habits, deleteHabit, toast])

  const handleSaveEdit = useCallback(async (input: NewHabitInput) => {
    if (!editTarget) return
    await updateHabit(editTarget.id, {
      name:              input.name.trim(),
      category:          input.category,
      color:             input.color ?? '#7c95ff',
      frequency:         input.activeDays.length === 0 ? 'daily' : 'specific_days',
      activeDays:        input.activeDays,
      targetCompletions: input.targetCompletions,
      stepAmount:        input.stepAmount ?? 1,
      stepLabel:         input.stepLabel,
    })
    toast(`"${input.name}" updated.`, 'success')
    setEditTarget(null)
  }, [editTarget, updateHabit, toast])

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  /* Group habits by category */
  const grouped = (habits ?? []).reduce<Record<string, HabitWithCompletion[]>>((acc, h) => {
    const cat = h.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(h)
    return acc
  }, {})
  const categories = Object.keys(grouped).sort()

  /* Week column header labels */
  const weekDayLabels = weekDates.map(iso => {
    const dow = new Date(iso + 'T12:00:00').getDay()
    return { short: DAY_LABELS[dow].slice(0, 1), iso }
  })

  return (
    <div className={styles.page}>
      <canvas ref={canvasRef} className={styles.confettiCanvas} aria-hidden="true" />

      {/* ── Heading + daily badge ──────────────────────────── */}
      <div className={styles.headingRow}>
        <div className="anim-scale-in">
          <ZenHeading
            eyebrow="Life · Habits"
            title="Habits."
            subtitle="Build consistency one day at a time. Every check-off counts."
            size="md"
          />
        </div>
        <div className={styles.headingRight}>
          <div className={`${styles.dailyBadge} anim-fade-in`} aria-live="polite">
            <CircleProgress pct={dailyPct} size={72} done={dailyPct === 100} />
            <div className={styles.dailyStats}>
              <span className={styles.dailyPct}>{dailyPct}%</span>
              <span className={styles.dailyLabel}>{doneCount}/{scheduledCount} done today</span>
              {habits.length > 0 && (
                <span className={styles.dailyStreak}>
                  🔥 {Math.max(...habits.map(h => h.streakCount), 0)} day streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar row ──────────────────────────────────── */}
      <div className={styles.toolbar}>
        {!editMode && (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowCreate(true)}
          >
            <span aria-hidden="true">+</span> New Habit
          </button>
        )}
        <button
          type="button"
          className={`${styles.toolbarBtn} ${editMode ? styles.toolbarBtnActive : ''}`}
          onClick={() => setEditMode(v => !v)}
        >
          {editMode ? '✓ Done Editing' : '✎ Edit Habits'}
        </button>
      </div>

      {/* ── Main two-column body ──────────────────────────── */}
      <div className={habits.length > 0 ? styles.bodyRow : undefined}>

        {/* Left: habit list */}
        <div className={styles.habitColumn}>
          {/* Week grid header (non-edit mode only) */}
          {habits.length > 0 && !editMode && (
            <div className={`${styles.weekHeader} anim-fade-in`}>
              <div className={styles.weekHeaderLeft} />
              <div className={styles.weekDayLabels}>
                {weekDayLabels.map(({ short, iso }) => (
                  <span
                    key={iso}
                    className={`${styles.weekDayLabel} ${iso === today ? styles.weekDayLabelToday : ''}`}
                  >
                    {short}
                  </span>
                ))}
              </div>
              <div className={styles.weekHeaderRight} />
            </div>
          )}

          {habits.length === 0 ? (
            <div className={`${styles.emptyState} anim-fade-in`}>
              <p className={styles.emptyIcon} aria-hidden="true">◎</p>
              <p className={styles.emptyTitle}>No habits yet</p>
              <p className={styles.emptyBody}>Create your first habit to start building streaks.</p>
            </div>
          ) : categories.length === 1 ? (
            <div className={styles.habitList}>
              {grouped[categories[0]].map((habit, i) => (
                <div key={habit.id} className={`anim-slide-in ${i < 4 ? `delay-${i + 1}` : ''}`}>
                  <HabitRow
                    habit={habit} today={today} weekDates={weekDates}
                    onIncrement={handleIncrement} onDelete={handleDelete}
                    onEdit={h => setEditTarget(h)} editMode={editMode}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.habitList}>
              {categories.map(cat => (
                <CategorySection
                  key={cat}
                  category={cat}
                  habits={grouped[cat]}
                  collapsed={collapsedCats.has(cat)}
                  onToggle={() => toggleCategory(cat)}
                >
                  {grouped[cat].map((habit, i) => (
                    <div key={habit.id} className={`anim-slide-in ${i < 4 ? `delay-${i + 1}` : ''}`}>
                      <HabitRow
                        habit={habit} today={today} weekDates={weekDates}
                        onIncrement={handleIncrement} onDelete={handleDelete}
                        onEdit={h => setEditTarget(h)} editMode={editMode}
                      />
                    </div>
                  ))}
                </CategorySection>
              ))}
            </div>
          )}
        </div>

        {/* Right: analytics panel — always visible when habits exist */}
        {habits.length > 0 && (
          <div className={`${styles.chartPanel} anim-fade-in delay-2`}>
            <p className={styles.chartLabel}>Analytics</p>

            {/* Quick stats row */}
            <div className={styles.analyticsStats}>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatNum}>{dailyPct}%</span>
                <span className={styles.analyticsStatLabel}>Today</span>
              </div>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatNum}>{habits.length}</span>
                <span className={styles.analyticsStatLabel}>Habits</span>
              </div>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatNum}>
                  {Math.max(...habits.map(h => h.streakCount), 0)}
                </span>
                <span className={styles.analyticsStatLabel}>Best Streak</span>
              </div>
            </div>

            <div className={styles.chartDivider} />
            <p className={styles.chartSubLabel}>30-Day Trend</p>
            <GritAnalyticsChart points={gritPoints} />
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      {showCreate && (
        <HabitModal
          onClose={() => setShowCreate(false)}
          onSave={createHabit}
        />
      )}
      {editTarget && (
        <HabitModal
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
          initial={editTarget}
        />
      )}
    </div>
  )
}
