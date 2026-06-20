'use client'

import { useState, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useLiveQuery }   from 'dexie-react-hooks'
import { db }             from '@/lib/db'
import ZenHeading         from '@/components/ui/ZenHeading'
import { useToast }       from '@/lib/ToastContext'
import type { MealPlanSlot, SavedMealRecipe, MealIngredient, MealType, PlanType } from '@/lib/db'
import {
  INGREDIENT_PRICES, INGREDIENT_PRICE_MAP,
  EQUIPMENT_NODES, COLLEGE_MEALS, DIETARY_TAGS,
  RECIPE_CATEGORIES,
  MEAL_TYPES, PLAN_TYPE_LABELS, DAY_LABELS_SHORT,
  DAILY_CALORIE_TARGET,
  getWeekStart, getWeekDays, formatWeekLabel,
  filterIngredients, filterCollegeMeals,
  type EquipmentTier, type MealTypeKey,
} from '@/utils/mealData'
import {
  filterLibrary, recipeCountForCategory, type LibraryRecipe,
} from '@/utils/recipeLibrary'
import {
  generateWeekPlan, DEFAULT_GEN_CONFIG,
  CALORIE_GOAL_LABELS, CALORIE_GOAL_SUB,
  BUDGET_LEVEL_LABELS, BUDGET_LEVEL_SUB,
  type GenConfig, type CalorieGoal, type BudgetLevel,
} from '@/utils/mealGenerator'
import styles from './MealPlanningView.module.css'

/* ── localStorage keys ───────────────────────────────────────── */
const LS_BUDGET   = 'zenith_meal_budget_v1'
const LS_KITCHEN  = 'zenith_kitchen_setup_v1'
const LS_STORE    = 'zenith_preferred_store_v1'
const LS_PREFS    = 'zenith_food_prefs_v1'
const LS_GEN_CFG  = 'zenith_meal_gen_config_v1'
const LS_HIDDEN   = 'zenith_hidden_recipes_v1'

function loadHiddenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_HIDDEN)
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

function saveHiddenIds(ids: Set<string>) {
  try { localStorage.setItem(LS_HIDDEN, JSON.stringify([...ids])) } catch { /* noop */ }
}

function loadGenConfig(): GenConfig {
  if (typeof window === 'undefined') return DEFAULT_GEN_CONFIG
  try {
    const raw = localStorage.getItem(LS_GEN_CFG)
    return raw ? { ...DEFAULT_GEN_CONFIG, ...JSON.parse(raw) } : DEFAULT_GEN_CONFIG
  } catch { return DEFAULT_GEN_CONFIG }
}

/* Friendly label for the easiest equipment a library recipe needs. */
function equipLabel(tiers: EquipmentTier[]): string {
  if (tiers.includes('no_kitchen'))  return 'No-cook'
  if (tiers.includes('microwave'))   return 'Microwave'
  if (tiers.includes('mini_fridge')) return 'Kettle / Fridge'
  return 'Stove'
}

/* ── Food preferences ────────────────────────────────────────── */
interface FoodPrefs {
  disliked: string[]
  dietary:  string[]
}

function loadPrefs(): FoodPrefs {
  if (typeof window === 'undefined') return { disliked: [], dietary: [] }
  try { return JSON.parse(localStorage.getItem(LS_PREFS) ?? '{"disliked":[],"dietary":[]}') }
  catch { return { disliked: [], dietary: [] } }
}

function savePrefs(prefs: FoodPrefs) {
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs))
}

/* ── Tab type ────────────────────────────────────────────────── */
type Tab = 'planner' | 'recipes' | 'budget' | 'kitchen'

/* ═══════════════════════════════════════════════════════════════
   MEAL SLOT MODAL
   ═══════════════════════════════════════════════════════════════ */

interface SlotModalProps {
  weekStart:   string
  dayIndex:    number
  mealType:    MealType
  existing?:   MealPlanSlot
  equipment:   EquipmentTier[]
  disliked:    string[]
  dietary:     string[]
  onSave:      (slot: Omit<MealPlanSlot, 'id'>) => void
  onClear:     () => void
  onClose:     () => void
}

function SlotModal({ weekStart, dayIndex, mealType, existing, equipment, disliked, dietary, onSave, onClear, onClose }: SlotModalProps) {
  const [mealName,    setMealName]    = useState(existing?.mealName    ?? '')
  const [planType,    setPlanType]    = useState<PlanType>(existing?.planType ?? 'home')
  const [cookMinutes, setCookMinutes] = useState(existing?.cookMinutes ?? 0)
  const [recipeUrl,   setRecipeUrl]   = useState(existing?.recipeUrl   ?? '')
  const [notes,       setNotes]       = useState(existing?.notes       ?? '')
  const [ingredients, setIngredients] = useState<MealIngredient[]>(existing?.ingredients ?? [])
  const [ingQuery,    setIngQuery]    = useState('')
  const [showSuggest, setShowSuggest] = useState(false)

  const isHome       = planType === 'home'
  const isDiningHall = planType === 'dining_hall'

  const estimatedCost = useMemo(() =>
    isHome ? Math.round(ingredients.reduce((s, i) => s + i.estimatedPrice, 0) * 100) / 100 : 0,
    [ingredients, isHome],
  )

  const estimatedCalories = useMemo(() =>
    isHome
      ? ingredients.reduce((s, i) => {
          const p = INGREDIENT_PRICE_MAP[i.name.toLowerCase()]
          return s + (p?.servingCalories ?? 0)
        }, 0)
      : 0,
    [ingredients, isHome],
  )

  const [manualCost,     setManualCost]     = useState(existing?.estimatedCost     ?? 0)
  const [manualCalories, setManualCalories] = useState(existing?.estimatedCalories ?? 0)

  // Filter ingredients by disliked list, then by search query
  const filteredIngredients = useMemo(() => filterIngredients(INGREDIENT_PRICES, disliked), [disliked])

  const suggestions = useMemo(() => {
    if (!ingQuery.trim()) return []
    const q = ingQuery.toLowerCase()
    return filteredIngredients.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6)
  }, [ingQuery, filteredIngredients])

  const addIngredient = (name: string, price: number, unit: string) => {
    setIngredients(prev => [...prev, { name, quantity: unit, estimatedPrice: price }])
    setIngQuery('')
    setShowSuggest(false)
  }

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!mealName.trim()) return
    onSave({
      weekStart,
      dayIndex,
      mealType,
      mealName:          mealName.trim(),
      planType,
      ingredients:       isDiningHall ? [] : ingredients,
      estimatedCost:     isDiningHall ? 0 : isHome ? estimatedCost : manualCost,
      estimatedCalories: isDiningHall ? manualCalories : isHome ? estimatedCalories : manualCalories,
      cookMinutes:       isHome ? cookMinutes : 0,
      recipeUrl:         recipeUrl.trim() || undefined,
      notes:             notes.trim()     || undefined,
    })
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const dayLabel  = DAY_LABELS_SHORT[dayIndex]
  const mealLabel = MEAL_TYPES.find(m => m.key === mealType)?.label ?? mealType

  // Suggest college meals filtered by equipment + preferences
  const collegeSuggestions = useMemo(() =>
    filterCollegeMeals(
      COLLEGE_MEALS.filter(m => m.mealType === mealType && equipment.some(e => m.equipment.includes(e))),
      disliked,
      dietary,
    ).slice(0, 4),
    [mealType, equipment, disliked, dietary],
  )

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} anim-scale-in`}>

        <div className={styles.modalHead}>
          <div>
            <p className={styles.modalEyebrow}>{dayLabel} · {mealLabel}</p>
            <h2 className={styles.modalTitle}>{existing ? 'Edit Meal' : 'Plan a Meal'}</h2>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>

          {/* College quick-fill suggestions */}
          {!existing && collegeSuggestions.length > 0 && (
            <div className={styles.quickFill}>
              <p className={styles.quickFillLabel}>Quick fill from College Meals</p>
              <div className={styles.quickFillRow}>
                {collegeSuggestions.map(meal => (
                  <button
                    key={meal.id}
                    type="button"
                    className={styles.quickFillBtn}
                    onClick={() => {
                      setMealName(meal.name)
                      setCookMinutes(meal.cookMinutes)
                      setPlanType('home')
                      setNotes(meal.tips)
                      setIngredients(meal.ingredients.map(n => {
                        const p = INGREDIENT_PRICE_MAP[n.toLowerCase()]
                        return { name: n, quantity: p?.unit ?? '1 serving', estimatedPrice: p?.price ?? 1.00 }
                      }))
                      // calories set via ingredient calc automatically
                    }}
                  >
                    {meal.name}
                    <span className={styles.quickFillCost}>~${meal.cost.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meal name */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Meal name *</label>
            <input
              className={styles.fieldInput}
              placeholder="e.g. Garlic Butter Pasta"
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Plan type */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Type</label>
            <div className={styles.planTypeRow}>
              {(['home', 'dining_hall', 'dining_out', 'takeout', 'delivery'] as PlanType[]).map(pt => (
                <button
                  key={pt}
                  type="button"
                  className={`${styles.typeChip} ${planType === pt ? styles.typeChipOn : ''} ${pt === 'dining_hall' ? styles.typeChipDiningHall : ''}`}
                  onClick={() => setPlanType(pt)}
                >
                  {pt === 'dining_hall' ? '🏫 ' : ''}{PLAN_TYPE_LABELS[pt]}
                </button>
              ))}
            </div>
          </div>

          {/* Cost: auto-calculated for home, simplified for dining hall, manual for out */}
          {isDiningHall ? (
            <div className={styles.diningHallInfo}>
              <div className={styles.diningHallBadge}>🏫 Dining Hall</div>
              <p className={styles.diningHallNote}>
                Covered by your meal plan — no cost or ingredient tracking needed.
              </p>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Calories (optional)</label>
                <input
                  type="number"
                  min={0}
                  className={`${styles.fieldInput} ${styles.fieldInputSm}`}
                  value={manualCalories || ''}
                  onChange={e => setManualCalories(Math.max(0, Number(e.target.value)))}
                  placeholder="e.g. 650"
                />
              </div>
            </div>
          ) : isHome ? (
            <>
              {/* Ingredients */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Ingredients</label>
                <div className={styles.ingSearchWrap}>
                  <input
                    className={styles.fieldInput}
                    placeholder="Search ingredient…"
                    value={ingQuery}
                    onChange={e => { setIngQuery(e.target.value); setShowSuggest(true) }}
                    onFocus={() => setShowSuggest(true)}
                  />
                  {showSuggest && suggestions.length > 0 && (
                    <div className={styles.ingDropdown}>
                      {suggestions.map(s => (
                        <button
                          key={s.name}
                          type="button"
                          className={styles.ingDropItem}
                          onMouseDown={() => addIngredient(s.name, s.price, s.unit)}
                        >
                          <span>{s.name}</span>
                          <span className={styles.ingDropPrice}>~${s.price.toFixed(2)} / {s.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {ingredients.length > 0 && (
                  <div className={styles.ingList}>
                    {ingredients.map((ing, i) => (
                      <div key={i} className={styles.ingItem}>
                        <span className={styles.ingName}>{ing.name}</span>
                        <span className={styles.ingQty}>{ing.quantity}</span>
                        <span className={styles.ingPrice}>~${ing.estimatedPrice.toFixed(2)}</span>
                        <button type="button" className={styles.ingRemove} onClick={() => removeIngredient(i)}>✕</button>
                      </div>
                    ))}
                    <div className={styles.ingTotal}>
                      <span>Estimated total</span>
                      <div className={styles.ingTotalVals}>
                        <span>~${estimatedCost.toFixed(2)}</span>
                        {estimatedCalories > 0 && (
                          <span className={styles.ingTotalCal}>
                            {estimatedCalories} kcal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cook time */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Cook time (min)</label>
                  <input
                    type="number"
                    min={0}
                    className={`${styles.fieldInput} ${styles.fieldInputSm}`}
                    value={cookMinutes || ''}
                    onChange={e => setCookMinutes(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Recipe URL</label>
                  <input
                    type="url"
                    className={styles.fieldInput}
                    placeholder="https://…"
                    value={recipeUrl}
                    onChange={e => setRecipeUrl(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Estimated cost ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={`${styles.fieldInput} ${styles.fieldInputSm}`}
                  value={manualCost || ''}
                  onChange={e => setManualCost(Math.max(0, Number(e.target.value)))}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Calories (kcal)</label>
                <input
                  type="number"
                  min={0}
                  className={`${styles.fieldInput} ${styles.fieldInputSm}`}
                  value={manualCalories || ''}
                  onChange={e => setManualCalories(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                />
              </div>
            </div>
          )}


          {/* Notes */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Notes</label>
            <textarea
              className={styles.fieldTextarea}
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Tips, reminders, substitutions…"
              maxLength={200}
            />
          </div>

        </div>

        <div className={styles.modalFoot}>
          {existing && (
            <button type="button" className={styles.clearBtn} onClick={onClear}>
              Remove
            </button>
          )}
          <div className={styles.modalFootRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!mealName.trim()}
            >
              {existing ? 'Save Changes' : 'Add to Plan'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   GENERATE WEEK PLAN — preferences modal
   ═══════════════════════════════════════════════════════════════ */

function GenerateConfigModal({
  initial, weekBudget, onConfirm, onClose,
}: {
  initial:    GenConfig
  weekBudget: number
  onConfirm:  (cfg: GenConfig) => void
  onClose:    () => void
}) {
  const [cfg, setCfg] = useState<GenConfig>(initial)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const calorieGoals: CalorieGoal[] = ['cut', 'maintain', 'bulk']
  const budgetLevels: BudgetLevel[] = ['low', 'medium', 'high']

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} anim-scale-in`}>
        <div className={styles.modalHead}>
          <div>
            <p className={styles.modalEyebrow}>Auto-Generate</p>
            <h2 className={styles.modalTitle}>Plan My Week</h2>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.genIntro}>
            We&apos;ll fill empty slots from the recipe library, your saved recipes, and college meals —
            tuned to your kitchen, dietary filters, and the preferences below.
          </p>

          {/* Calorie goal */}
          <div className={styles.genSection}>
            <p className={styles.genSectionLabel}>Calorie goal</p>
            <div className={styles.genOptionRow}>
              {calorieGoals.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`${styles.genOption} ${cfg.calorieGoal === g ? styles.genOptionOn : ''}`}
                  onClick={() => setCfg(c => ({ ...c, calorieGoal: g }))}
                >
                  <span className={styles.genOptionName}>{CALORIE_GOAL_LABELS[g]}</span>
                  <span className={styles.genOptionSub}>{CALORIE_GOAL_SUB[g]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget level */}
          <div className={styles.genSection}>
            <p className={styles.genSectionLabel}>
              Budget level
              {weekBudget > 0 && <span className={styles.genBudgetNote}>weekly budget ${weekBudget.toFixed(0)}</span>}
            </p>
            <div className={styles.genOptionRow}>
              {budgetLevels.map(b => (
                <button
                  key={b}
                  type="button"
                  className={`${styles.genOption} ${cfg.budgetLevel === b ? styles.genOptionOn : ''}`}
                  onClick={() => setCfg(c => ({ ...c, budgetLevel: b }))}
                >
                  <span className={styles.genOptionName}>{BUDGET_LEVEL_LABELS[b]}</span>
                  <span className={styles.genOptionSub}>{BUDGET_LEVEL_SUB[b]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className={styles.genSection}>
            <button
              type="button"
              className={`${styles.genToggleRow} ${cfg.emphasizeProtein ? styles.genToggleRowOn : ''}`}
              onClick={() => setCfg(c => ({ ...c, emphasizeProtein: !c.emphasizeProtein }))}
            >
              <div>
                <span className={styles.genToggleName}>💪 Emphasize protein</span>
                <span className={styles.genToggleSub}>Prefer high-protein recipes</span>
              </div>
              <span className={`${styles.genSwitch} ${cfg.emphasizeProtein ? styles.genSwitchOn : ''}`}>
                <span className={styles.genSwitchThumb} />
              </span>
            </button>

            <button
              type="button"
              className={`${styles.genToggleRow} ${cfg.noRepeat ? styles.genToggleRowOn : ''}`}
              onClick={() => setCfg(c => ({ ...c, noRepeat: !c.noRepeat }))}
            >
              <div>
                <span className={styles.genToggleName}>🔀 Maximize variety</span>
                <span className={styles.genToggleSub}>Avoid repeating recipes across the week</span>
              </div>
              <span className={`${styles.genSwitch} ${cfg.noRepeat ? styles.genSwitchOn : ''}`}>
                <span className={styles.genSwitchThumb} />
              </span>
            </button>
          </div>
        </div>

        <div className={styles.modalFoot}>
          <div className={styles.modalFootRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.saveBtn} onClick={() => onConfirm(cfg)}>
              ⟳ Generate Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   WEEKLY PLANNER TAB
   ═══════════════════════════════════════════════════════════════ */

interface PlannerTabProps {
  weekStart:  string
  equipment:  EquipmentTier[]
  weekBudget: number
  disliked:   string[]
  dietary:    string[]
  hiddenIds:  Set<string>
}

function PlannerTab({ weekStart, equipment, weekBudget, disliked, dietary, hiddenIds }: PlannerTabProps) {
  const { toast }  = useToast()
  const weekDays   = getWeekDays(weekStart)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenConfig, setShowGenConfig] = useState(false)

  const slots = useLiveQuery(
    () => db?.mealPlanSlots?.where('weekStart').equals(weekStart).toArray() ?? Promise.resolve([]),
    [weekStart],
  ) ?? []

  const slotMap = useMemo(() => {
    const m = new Map<string, MealPlanSlot>()
    for (const s of slots) m.set(`${s.dayIndex}:${s.mealType}`, s)
    return m
  }, [slots])

  const weekTotal = useMemo(() =>
    slots.reduce((s, slot) => s + slot.estimatedCost, 0),
    [slots],
  )

  // Daily calorie totals per dayIndex (0-6)
  const dailyCals = useMemo(() => {
    const m: Record<number, number> = {}
    for (const s of slots) {
      if (s.estimatedCalories > 0)
        m[s.dayIndex] = (m[s.dayIndex] ?? 0) + s.estimatedCalories
    }
    return m
  }, [slots])

  const [editing, setEditing] = useState<{ dayIndex: number; mealType: MealType } | null>(null)

  const handleSave = async (slotData: Omit<MealPlanSlot, 'id'>) => {
    const key = `${slotData.dayIndex}:${slotData.mealType}`
    const existing = slotMap.get(key)
    if (existing?.id !== undefined) {
      await db.mealPlanSlots.update(existing.id, slotData)
    } else {
      await db.mealPlanSlots.add(slotData)
    }
    setEditing(null)
  }

  const handleClear = async () => {
    if (!editing) return
    const key = `${editing.dayIndex}:${editing.mealType}`
    const existing = slotMap.get(key)
    if (existing?.id !== undefined) await db.mealPlanSlots.delete(existing.id)
    setEditing(null)
  }

  const handleClearWeek = useCallback(async () => {
    const count = await db.mealPlanSlots.where('weekStart').equals(weekStart).delete()
    toast(`Cleared ${count} meal slot${count !== 1 ? 's' : ''} — ready to regenerate.`, 'info')
  }, [weekStart, toast])

  const handleRunGenerate = useCallback(async (config: GenConfig) => {
    setShowGenConfig(false)
    setIsGenerating(true)
    try {
      try { localStorage.setItem(LS_GEN_CFG, JSON.stringify(config)) } catch { /* noop */ }

      const savedRecipes = await db.savedMealRecipes.toArray()
      const existingKeys  = new Set(slots.map(s => `${s.dayIndex}:${s.mealType}`))

      const result = generateWeekPlan({
        config, equipment, disliked, dietary, weekStart,
        existingKeys, savedRecipes, weekBudget, hiddenIds,
      })

      if (result.emptyPools) {
        toast('No recipes match your filters — loosen dietary or equipment settings.', 'error')
        return
      }
      if (result.slots.length === 0) {
        toast('All slots are already filled for this week!', 'info')
        return
      }

      await db.transaction('rw', db.mealPlanSlots, async () => {
        for (const s of result.slots) await db.mealPlanSlots.add(s)
      })

      let msg = `Generated ${result.slots.length} meal${result.slots.length !== 1 ? 's' : ''} · ~$${result.projectedCost.toFixed(2)}`
      if (weekBudget > 0) {
        const projectedWeek = weekTotal + result.projectedCost
        msg += projectedWeek > weekBudget ? ' · over budget ⚠' : ' · within budget ✓'
      }
      toast(msg, 'success')
    } catch {
      toast('Could not generate plan', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [slots, equipment, disliked, dietary, weekStart, weekBudget, weekTotal, toast])

  const budgetUsedPct = weekBudget > 0 ? Math.min(100, (weekTotal / weekBudget) * 100) : 0
  const overBudget    = weekBudget > 0 && weekTotal > weekBudget

  return (
    <>
      {/* Auto-generate strip */}
      <div className={styles.generateStrip}>
        <p className={styles.generateHint}>
          Auto-fill empty slots from the recipe library, tuned to your calorie goal, protein, and budget.
        </p>
        <div className={styles.generateActions}>
          {slots.length > 0 && (
            <button
              type="button"
              className={styles.clearWeekBtn}
              onClick={handleClearWeek}
              disabled={isGenerating}
            >
              ✕ Clear Week
            </button>
          )}
          <button
            type="button"
            className={styles.generateBtn}
            onClick={() => setShowGenConfig(true)}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : '⟳ Generate Week Plan'}
          </button>
        </div>
      </div>

      {/* Budget summary strip */}
      <div className={styles.budgetStrip}>
        <div className={styles.budgetStripLeft}>
          <span className={styles.budgetStripLabel}>Week total</span>
          <span className={`${styles.budgetStripAmt} ${overBudget ? styles.budgetOver : ''}`}>
            ~${weekTotal.toFixed(2)}
          </span>
          {weekBudget > 0 && (
            <span className={styles.budgetStripOf}>of ${weekBudget.toFixed(0)} budget</span>
          )}
        </div>
        {weekBudget > 0 && (
          <div className={styles.budgetBar}>
            <div
              className={`${styles.budgetBarFill} ${overBudget ? styles.budgetBarOver : ''}`}
              style={{ width: `${budgetUsedPct}%` }}
            />
          </div>
        )}
      </div>

      {/* 7-day grid */}
      <div className={styles.plannerGrid}>
        {/* Day column headers */}
        <div className={styles.plannerGridHeader}>
          <div className={styles.plannerMealCol} />
          {weekDays.map((iso, i) => {
            const d    = new Date(iso + 'T12:00:00')
            const isToday = iso === new Date().toISOString().slice(0, 10)
            return (
              <div key={iso} className={`${styles.plannerDayCol} ${isToday ? styles.plannerDayColToday : ''}`}>
                <span className={styles.plannerDayName}>{DAY_LABELS_SHORT[i]}</span>
                <span className={styles.plannerDayNum}>{d.getDate()}</span>
              </div>
            )
          })}
        </div>

        {/* Meal rows */}
        {MEAL_TYPES.map(({ key: mt, label, emoji }) => (
          <div key={mt} className={styles.plannerRow}>
            <div className={styles.plannerMealLabel}>
              <span className={styles.plannerMealEmoji}>{emoji}</span>
              <span className={styles.plannerMealName}>{label}</span>
            </div>
            {weekDays.map((_, di) => {
              const slot = slotMap.get(`${di}:${mt}`)
              return (
                <button
                  key={di}
                  type="button"
                  className={`${styles.plannerCell} ${slot ? (slot.planType === 'dining_hall' ? styles.plannerCellDiningHall : styles.plannerCellFilled) : styles.plannerCellEmpty}`}
                  onClick={() => setEditing({ dayIndex: di, mealType: mt })}
                >
                  {slot ? (
                    <div className={styles.slotContent}>
                      <span className={styles.slotName}>
                        {slot.planType === 'dining_hall' ? '🏫 ' : ''}{slot.mealName}
                      </span>
                      <span className={styles.slotMeta}>
                        {slot.planType === 'dining_hall' ? 'Dining Hall' : slot.planType !== 'home' ? PLAN_TYPE_LABELS[slot.planType] : ''}
                        {slot.planType !== 'dining_hall' && slot.estimatedCost > 0 ? ` ~$${slot.estimatedCost.toFixed(2)}` : ''}
                        {slot.cookMinutes > 0 ? ` · ${slot.cookMinutes}m` : ''}
                      </span>
                      {slot.estimatedCalories > 0 && (
                        <span className={styles.slotCal}>{slot.estimatedCalories} kcal</span>
                      )}
                    </div>
                  ) : (
                    <span className={styles.slotAdd}>+</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Daily calorie summary row */}
      <div className={styles.calSummaryRow}>
        <div className={styles.calSummaryLabel}>Daily Calories</div>
        {weekDays.map((_, di) => {
          const cal  = dailyCals[di] ?? 0
          const over = cal > DAILY_CALORIE_TARGET
          const warn = !over && cal > DAILY_CALORIE_TARGET * 0.85
          return (
            <div
              key={di}
              className={`${styles.calSummaryCell} ${over ? styles.calOver : warn ? styles.calWarn : ''}`}
            >
              {cal > 0 ? (
                <>
                  <span className={styles.calNum}>{cal}</span>
                  <span className={styles.calUnit}>kcal</span>
                </>
              ) : (
                <span className={styles.calEmpty}>—</span>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <SlotModal
          weekStart={weekStart}
          dayIndex={editing.dayIndex}
          mealType={editing.mealType}
          existing={slotMap.get(`${editing.dayIndex}:${editing.mealType}`)}
          equipment={equipment}
          disliked={disliked}
          dietary={dietary}
          onSave={handleSave}
          onClear={handleClear}
          onClose={() => setEditing(null)}
        />
      )}

      {showGenConfig && (
        <GenerateConfigModal
          initial={loadGenConfig()}
          weekBudget={weekBudget}
          onConfirm={handleRunGenerate}
          onClose={() => setShowGenConfig(false)}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   RECIPES & RESOURCES TAB
   ═══════════════════════════════════════════════════════════════ */

function AddRecipeModal({ onSave, onClose }: { onSave: (r: Omit<SavedMealRecipe, 'id'>) => void; onClose: () => void }) {
  const { toast } = useToast()
  const [title,     setTitle]    = useState('')
  const [url,       setUrl]      = useState('')
  const [desc,      setDesc]     = useState('')
  const [category,  setCategory] = useState(RECIPE_CATEGORIES[0])
  const [cookTime,  setCookTime] = useState<number | ''>('')
  const [equipment, setEquipment]= useState('')
  const [cost,      setCost]     = useState<number | ''>('')
  const [servings,  setServings] = useState<number | ''>('')
  const [notes,     setNotes]    = useState('')
  // Macros
  const [protein,   setProtein]  = useState<number | ''>('')
  const [carbs,     setCarbs]    = useState<number | ''>('')
  const [fat,       setFat]      = useState<number | ''>('')
  const [calories,  setCalories] = useState<number | ''>('')
  // Import state
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!url.trim()) { toast('Paste a URL first', 'info'); return }
    setImporting(true)
    try {
      const res  = await fetch('/api/recipe-import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json() as { title?: string; description?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      if (data.title       && !title) setTitle(data.title)
      if (data.description && !desc)  setDesc(data.description)
      toast('Recipe info imported!', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not fetch URL', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title:         title.trim(),
      url:           url.trim()  || undefined,
      description:   desc.trim() || undefined,
      category,
      cookTime:      cookTime  !== '' ? Number(cookTime)  : undefined,
      equipment:     equipment.trim() || undefined,
      estimatedCost: cost      !== '' ? Number(cost)      : undefined,
      servings:      servings  !== '' ? Number(servings)  : undefined,
      protein:       protein   !== '' ? Number(protein)   : undefined,
      carbs:         carbs     !== '' ? Number(carbs)     : undefined,
      fat:           fat       !== '' ? Number(fat)       : undefined,
      calories:      calories  !== '' ? Number(calories)  : undefined,
      notes:         notes.trim() || undefined,
      addedAt: Date.now(),
    })
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} anim-scale-in`}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Add Recipe / Resource</h2>
          <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>

          {/* URL import — paste first, then Import to auto-fill */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Recipe URL</label>
            <div className={styles.urlImportRow}>
              <input
                type="url"
                className={styles.fieldInput}
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://recipe-site.com/…"
              />
              <button
                type="button"
                className={styles.importBtn}
                onClick={handleImport}
                disabled={importing || !url.trim()}
              >
                {importing ? '…' : 'Import'}
              </button>
            </div>
            {url && !title && (
              <p className={styles.importHint}>Click Import to auto-fill title &amp; description from the page</p>
            )}
          </div>

          <div className={styles.field}><label className={styles.fieldLabel}>Title *</label>
            <input className={styles.fieldInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="Recipe name or resource title" />
          </div>
          <div className={styles.field}><label className={styles.fieldLabel}>Description</label>
            <textarea className={styles.fieldTextarea} rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description" maxLength={200} />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}><label className={styles.fieldLabel}>Category</label>
              <select className={styles.fieldSelect} value={category} onChange={e => setCategory(e.target.value)}>
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.fieldLabel}>Cook time (min)</label>
              <input type="number" min={0} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={cookTime} onChange={e => setCookTime(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
            </div>
            <div className={styles.field}><label className={styles.fieldLabel}>Est. cost ($)</label>
              <input type="number" min={0} step={0.01} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={cost} onChange={e => setCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
            </div>
          </div>

          {/* Macros */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Macros per serving (optional)</label>
            <div className={styles.macroRow}>
              <div className={styles.macroField}>
                <span className={styles.macroChipLabel}>Protein</span>
                <input type="number" min={0} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={protein} onChange={e => setProtein(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                <span className={styles.macroUnit}>g</span>
              </div>
              <div className={styles.macroField}>
                <span className={styles.macroChipLabel}>Carbs</span>
                <input type="number" min={0} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={carbs} onChange={e => setCarbs(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                <span className={styles.macroUnit}>g</span>
              </div>
              <div className={styles.macroField}>
                <span className={styles.macroChipLabel}>Fat</span>
                <input type="number" min={0} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={fat} onChange={e => setFat(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                <span className={styles.macroUnit}>g</span>
              </div>
              <div className={styles.macroField}>
                <span className={styles.macroChipLabel}>Calories</span>
                <input type="number" min={0} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={calories} onChange={e => setCalories(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                <span className={styles.macroUnit}>kcal</span>
              </div>
              <div className={styles.macroField}>
                <span className={styles.macroChipLabel}>Servings</span>
                <input type="number" min={1} className={`${styles.fieldInput} ${styles.fieldInputSm}`} value={servings} onChange={e => setServings(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1" />
                <span className={styles.macroUnit}>svg</span>
              </div>
            </div>
          </div>

          <div className={styles.field}><label className={styles.fieldLabel}>Equipment needed</label>
            <input className={styles.fieldInput} value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="e.g. Microwave, Hot plate" />
          </div>
          <div className={styles.field}><label className={styles.fieldLabel}>Notes</label>
            <textarea className={styles.fieldTextarea} rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} placeholder="Tips, variations, substitutions…" />
          </div>
        </div>
        <div className={styles.modalFoot}>
          <div className={styles.modalFootRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={!title.trim()}>Add Recipe</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecipesTab({
  equipment, disliked, dietary, hiddenIds, setHiddenIds,
}: {
  equipment: EquipmentTier[]
  disliked:  string[]
  dietary:   string[]
  hiddenIds: Set<string>
  setHiddenIds: Dispatch<SetStateAction<Set<string>>>
}) {
  const { toast } = useToast()
  const [catFilter,  setCatFilter]  = useState<string>('All')
  const [showAdd,    setShowAdd]    = useState(false)
  const [showCollege, setShowCollege] = useState(false)
  const [collegeMealType, setCollegeMealType] = useState<MealTypeKey>('breakfast')

  /* ── Built-in recipe library (browse) ─────────────────────── */
  const [libQuery, setLibQuery] = useState('')
  const [libCat,   setLibCat]   = useState('All')
  const [libRespectKitchen, setLibRespectKitchen] = useState(false)

  const hideRecipe = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      next.add(id)
      saveHiddenIds(next)
      return next
    })
    toast('Recipe hidden. You can restore it below.', 'info')
  }

  const restoreAllHidden = () => {
    const empty = new Set<string>()
    saveHiddenIds(empty)
    setHiddenIds(() => empty)
    toast('All hidden recipes restored.', 'success')
  }

  const libraryResults = useMemo(() =>
    filterLibrary({
      category:  libCat,
      query:     libQuery,
      equipment: libRespectKitchen ? equipment : [],
      dietary:   libRespectKitchen ? dietary : [],
      disliked:  libRespectKitchen ? disliked : [],
      hiddenIds,
    }),
    [libCat, libQuery, libRespectKitchen, equipment, dietary, disliked, hiddenIds],
  )

  const handleSaveLibrary = async (r: LibraryRecipe) => {
    await db.savedMealRecipes.add({
      title:         r.name,
      addedAt:       Date.now(),
      category:      r.categories[0] ?? 'Dinner',
      description:   r.tips,
      cookTime:      r.cookMinutes,
      equipment:     equipLabel(r.equipment),
      estimatedCost: r.cost,
      protein:       r.protein,
      carbs:         r.carbs,
      fat:           r.fat,
      calories:      r.calories,
      servings:      1,
    })
    toast(`"${r.name}" saved to your recipes!`, 'success')
  }

  const rawRecipes = useLiveQuery(
    () => db?.savedMealRecipes?.toArray() ?? Promise.resolve([]),
  ) ?? []

  const recipes = useMemo(() =>
    [...rawRecipes].sort((a, b) => b.addedAt - a.addedAt),
    [rawRecipes],
  )

  const filtered = useMemo(() =>
    catFilter === 'All' ? recipes : recipes.filter(r => r.category === catFilter),
    [recipes, catFilter],
  )

  const handleSave = async (r: Omit<SavedMealRecipe, 'id'>) => {
    await db.savedMealRecipes.add(r)
    setShowAdd(false)
    toast('Recipe saved!', 'success')
  }

  const handleDelete = async (id: number) => {
    await db.savedMealRecipes.delete(id)
  }

  const collegeSuggestions = useMemo(() =>
    COLLEGE_MEALS.filter(m =>
      m.mealType === collegeMealType &&
      equipment.some(e => m.equipment.includes(e))
    ),
    [collegeMealType, equipment],
  )

  return (
    <>
      {/* ── Built-in Recipe Library (browse) ─────────────────── */}
      <div className={styles.librarySection}>
        <div className={styles.libraryHead}>
          <div>
            <h3 className={styles.libraryTitle}>Recipe Library</h3>
            <p className={styles.librarySub}>
              {libraryResults.length} recipes · tap ＋ to save
              {hiddenIds.size > 0 && (
                <button
                  type="button"
                  className={styles.restoreHiddenBtn}
                  onClick={restoreAllHidden}
                >
                  · {hiddenIds.size} hidden — restore all
                </button>
              )}
            </p>
          </div>
          <button
            type="button"
            className={`${styles.libKitchenToggle} ${libRespectKitchen ? styles.libKitchenToggleOn : ''}`}
            onClick={() => setLibRespectKitchen(v => !v)}
            title="Filter by your kitchen equipment & dietary settings"
          >
            {libRespectKitchen ? '✓ My kitchen' : 'My kitchen'}
          </button>
        </div>

        <div className={styles.librarySearchRow}>
          <span className={styles.librarySearchGlyph}>⊕</span>
          <input
            className={styles.librarySearchInput}
            placeholder="Search recipes or ingredients…"
            value={libQuery}
            onChange={e => setLibQuery(e.target.value)}
          />
          {libQuery && (
            <button type="button" className={styles.librarySearchClear} onClick={() => setLibQuery('')}>✕</button>
          )}
        </div>

        <div className={styles.libraryCatTabs}>
          {['All', ...RECIPE_CATEGORIES].map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.libraryCatTab} ${libCat === c ? styles.libraryCatTabOn : ''}`}
              onClick={() => setLibCat(c)}
            >
              {c}
              <span className={styles.libraryCatCount}>{recipeCountForCategory(c)}</span>
            </button>
          ))}
        </div>

        {libraryResults.length === 0 ? (
          <p className={styles.libraryEmpty}>No recipes match — try clearing the search or the kitchen filter.</p>
        ) : (
          <div className={styles.libraryGrid}>
            {libraryResults.map(r => (
              <div key={r.id} className={styles.libraryCard}>
                <div className={styles.libraryCardHead}>
                  <h4 className={styles.libraryCardName}>{r.name}</h4>
                  <div className={styles.libraryCardActions}>
                    <button
                      type="button"
                      className={styles.libraryHideBtn}
                      onClick={() => hideRecipe(r.id)}
                      aria-label={`Hide ${r.name}`}
                      title="Hide this recipe"
                    >✕</button>
                    <button
                      type="button"
                      className={styles.libraryAddBtn}
                      onClick={() => handleSaveLibrary(r)}
                      aria-label={`Save ${r.name}`}
                    >＋</button>
                  </div>
                </div>
                <div className={styles.libraryMacroRow}>
                  <span className={`${styles.recipeMacroChip} ${styles.macroCalChip}`}>{r.calories} kcal</span>
                  <span className={`${styles.recipeMacroChip} ${styles.macroPChip}`}>P {r.protein}g</span>
                  <span className={`${styles.recipeMacroChip} ${styles.macroCChip}`}>C {r.carbs}g</span>
                  <span className={`${styles.recipeMacroChip} ${styles.macroFChip}`}>F {r.fat}g</span>
                </div>
                <div className={styles.libraryMeta}>
                  <span>~${r.cost.toFixed(2)}</span>
                  <span>⏱ {r.cookMinutes}m</span>
                  <span>🍳 {equipLabel(r.equipment)}</span>
                </div>
                <div className={styles.libraryTags}>
                  {r.categories.slice(0, 3).map(c => (
                    <span key={c} className={styles.libraryTag}>{c}</span>
                  ))}
                </div>
                <p className={styles.libraryTip}>{r.tips}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* College dorm quick-reference */}
      <div className={styles.collegePanel}>
        <button
          type="button"
          className={styles.collegePanelToggle}
          onClick={() => setShowCollege(v => !v)}
        >
          <span>🎓 College Dorm Meals</span>
          <span>{showCollege ? '▲' : '▼'}</span>
        </button>

        {showCollege && (
          <div className={styles.collegePanelBody}>
            <div className={styles.collegeMealTypeTabs}>
              {MEAL_TYPES.map(({ key, label, emoji }) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.collegeMealTab} ${collegeMealType === key ? styles.collegeMealTabOn : ''}`}
                  onClick={() => setCollegeMealType(key)}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>

            {equipment.length === 0 && (
              <p className={styles.noEquipNote}>
                Set up your kitchen in the Kitchen Setup tab to see tailored suggestions.
              </p>
            )}

            <div className={styles.collegeMealGrid}>
              {collegeSuggestions.map(meal => (
                <div key={meal.id} className={styles.collegeMealCard}>
                  <div className={styles.collegeMealHead}>
                    <span className={styles.collegeMealName}>{meal.name}</span>
                    <div className={styles.collegeMealMeta}>
                      <span className={styles.collegeMealCost}>~${meal.cost.toFixed(2)}</span>
                      <span className={styles.collegeMealTime}>{meal.cookMinutes}m</span>
                    </div>
                  </div>
                  <p className={styles.collegeMealTips}>{meal.tips}</p>
                  <div className={styles.collegeMealIngredients}>
                    {meal.ingredients.map(ing => (
                      <span key={ing} className={styles.collegeMealIng}>{ing}</span>
                    ))}
                  </div>
                </div>
              ))}
              {collegeSuggestions.length === 0 && (
                <p className={styles.noEquipNote}>No meals match your equipment for this category.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Saved recipes */}
      <div className={styles.recipesHeader}>
        <div className={styles.recipesCatTabs}>
          {['All', ...RECIPE_CATEGORIES].map(c => (
            <button
              key={c}
              type="button"
              className={`${styles.recipeCatTab} ${catFilter === c ? styles.recipeCatTabOn : ''}`}
              onClick={() => setCatFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button type="button" className={styles.addRecipeBtn} onClick={() => setShowAdd(true)}>
          + Add Recipe
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.recipesEmpty}>
          <p className={styles.emptyIcon}>📖</p>
          <p className={styles.emptyTitle}>No recipes saved yet</p>
          <p className={styles.emptyBody}>Save recipe links, cookbooks, and resources you want to cook from.</p>
          <button type="button" className={styles.addRecipeBtn} onClick={() => setShowAdd(true)}>+ Add Recipe</button>
        </div>
      ) : (
        <div className={styles.recipesGrid}>
          {filtered.map(r => (
            <div key={r.id} className={styles.recipeCard}>
              <div className={styles.recipeCardHead}>
                <div>
                  <span className={styles.recipeCardCategory}>{r.category}</span>
                  <h3 className={styles.recipeCardTitle}>{r.title}</h3>
                  {r.description && <p className={styles.recipeCardDesc}>{r.description}</p>}
                </div>
                <button
                  type="button"
                  className={styles.recipeDeleteBtn}
                  onClick={() => r.id !== undefined && handleDelete(r.id)}
                  aria-label="Delete recipe"
                >✕</button>
              </div>
              <div className={styles.recipeCardMeta}>
                {r.cookTime      && <span>⏱ {r.cookTime}m</span>}
                {r.estimatedCost && <span>~${r.estimatedCost.toFixed(2)}</span>}
                {r.equipment     && <span>🍳 {r.equipment}</span>}
                {r.servings      && <span>{r.servings} svg</span>}
              </div>
              {(r.protein || r.carbs || r.fat || r.calories) && (
                <div className={styles.recipeMacroRow}>
                  {r.calories && <span className={`${styles.recipeMacroChip} ${styles.macroCalChip}`}>{r.calories} kcal</span>}
                  {r.protein  && <span className={`${styles.recipeMacroChip} ${styles.macroPChip}`}>P {r.protein}g</span>}
                  {r.carbs    && <span className={`${styles.recipeMacroChip} ${styles.macroCChip}`}>C {r.carbs}g</span>}
                  {r.fat      && <span className={`${styles.recipeMacroChip} ${styles.macroFChip}`}>F {r.fat}g</span>}
                </div>
              )}
              {r.notes && <p className={styles.recipeCardNotes}>{r.notes}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className={styles.recipeCardLink}>
                  Open recipe →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddRecipeModal onSave={handleSave} onClose={() => setShowAdd(false)} />}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BUDGET TAB
   ═══════════════════════════════════════════════════════════════ */

function BudgetTab({ weekStart, weekBudget, setWeekBudget }: { weekStart: string; weekBudget: number; setWeekBudget: (v: number) => void }) {
  const slots = useLiveQuery(
    () => db?.mealPlanSlots?.where('weekStart').equals(weekStart).toArray() ?? Promise.resolve([]),
    [weekStart],
  ) ?? []

  const totalByType = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of slots) {
      m[s.planType] = (m[s.planType] ?? 0) + s.estimatedCost
    }
    return m
  }, [slots])

  const totalByDay = useMemo(() => {
    const m: Record<number, number> = {}
    for (const s of slots) m[s.dayIndex] = (m[s.dayIndex] ?? 0) + s.estimatedCost
    return m
  }, [slots])

  const weekTotal = useMemo(() => slots.reduce((s, sl) => s + sl.estimatedCost, 0), [slots])
  const remaining = weekBudget - weekTotal
  const overBudget = weekBudget > 0 && weekTotal > weekBudget

  return (
    <div className={styles.budgetTab}>

      {/* Budget input */}
      <div className={styles.budgetSetCard}>
        <p className={styles.budgetSetLabel}>Weekly Budget</p>
        <div className={styles.budgetSetRow}>
          <span className={styles.budgetSetCurrency}>$</span>
          <input
            type="number"
            min={0}
            step={5}
            className={styles.budgetSetInput}
            value={weekBudget || ''}
            onChange={e => {
              const v = Math.max(0, Number(e.target.value))
              setWeekBudget(v)
              localStorage.setItem(LS_BUDGET, String(v))
            }}
            placeholder="0"
          />
          <span className={styles.budgetSetUnit}>/ week</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.budgetSummaryRow}>
        <div className={styles.budgetSumCard}>
          <span className={styles.budgetSumNum}>~${weekTotal.toFixed(2)}</span>
          <span className={styles.budgetSumLabel}>Total spent</span>
        </div>
        {weekBudget > 0 && (
          <div className={`${styles.budgetSumCard} ${overBudget ? styles.budgetSumOver : styles.budgetSumGood}`}>
            <span className={styles.budgetSumNum}>{overBudget ? '+' : ''}${Math.abs(remaining).toFixed(2)}</span>
            <span className={styles.budgetSumLabel}>{overBudget ? 'Over budget' : 'Remaining'}</span>
          </div>
        )}
        <div className={styles.budgetSumCard}>
          <span className={styles.budgetSumNum}>{slots.length}</span>
          <span className={styles.budgetSumLabel}>Meals planned</span>
        </div>
      </div>

      {/* By plan type */}
      <div className={styles.budgetSection}>
        <p className={styles.budgetSectionLabel}>Breakdown by type</p>
        {Object.entries(totalByType).length === 0 ? (
          <p className={styles.budgetEmpty}>No meals planned yet — add meals in the Weekly Planner tab.</p>
        ) : (
          <div className={styles.budgetTypeList}>
            {Object.entries(totalByType).map(([type, amt]) => (
              <div key={type} className={styles.budgetTypeRow}>
                <span className={styles.budgetTypeName}>{PLAN_TYPE_LABELS[type] ?? type}</span>
                <div className={styles.budgetTypeBar}>
                  <div
                    className={styles.budgetTypeBarFill}
                    style={{ width: weekTotal > 0 ? `${(amt / weekTotal) * 100}%` : '0%' }}
                  />
                </div>
                <span className={styles.budgetTypeAmt}>~${amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By day */}
      {Object.keys(totalByDay).length > 0 && (
        <div className={styles.budgetSection}>
          <p className={styles.budgetSectionLabel}>Breakdown by day</p>
          <div className={styles.budgetDayList}>
            {DAY_LABELS_SHORT.map((d, i) => (
              <div key={d} className={styles.budgetDayRow}>
                <span className={styles.budgetDayName}>{d}</span>
                <div className={styles.budgetTypeBar}>
                  {totalByDay[i] != null && weekTotal > 0 && (
                    <div
                      className={styles.budgetTypeBarFill}
                      style={{ width: `${(totalByDay[i] / weekTotal) * 100}%` }}
                    />
                  )}
                </div>
                <span className={styles.budgetTypeAmt}>
                  {totalByDay[i] != null ? `~$${totalByDay[i].toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   KITCHEN SETUP TAB
   ═══════════════════════════════════════════════════════════════ */

function KitchenSetupTab({
  equipment, setEquipment, prefs, setPrefs,
}: {
  equipment:    EquipmentTier[]
  setEquipment: (e: EquipmentTier[]) => void
  prefs:        FoodPrefs
  setPrefs:     (p: FoodPrefs) => void
}) {
  const { toast } = useToast()
  const [storeName, setStoreName]   = useState(() => localStorage.getItem(LS_STORE) ?? '')
  const [ingSearch, setIngSearch]   = useState('')
  const [locLoading, setLocLoading] = useState(false)
  const [nearbyStores, setNearbyStores] = useState<string[]>([])

  const toggleEquipment = (id: EquipmentTier) => {
    const next = equipment.includes(id) ? equipment.filter(e => e !== id) : [...equipment, id]
    setEquipment(next)
    localStorage.setItem(LS_KITCHEN, JSON.stringify(next))
    toast('Kitchen setup saved.', 'success')
  }

  const saveStore = (name: string) => {
    setStoreName(name)
    localStorage.setItem(LS_STORE, name)
    toast(`Preferred store set to ${name}.`, 'success')
  }

  const findNearbyStores = async () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported.', 'error')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { latitude: lat, longitude: lng } = coords
        const query = `[out:json][timeout:15];(node["shop"="supermarket"](around:6000,${lat},${lng});way["shop"="supermarket"](around:6000,${lat},${lng}););out center 8;`
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
        const data = await res.json()
        const names: string[] = []
        for (const el of data.elements ?? []) {
          const n = el.tags?.name
          if (n && !names.includes(n)) names.push(n)
          if (names.length >= 6) break
        }
        setNearbyStores(names.length > 0 ? names : ['No stores found nearby'])
      } catch {
        toast('Could not fetch nearby stores.', 'error')
      } finally {
        setLocLoading(false)
      }
    }, () => {
      toast('Location access denied.', 'error')
      setLocLoading(false)
    })
  }

  return (
    <div className={styles.kitchenTab}>

      {/* Equipment nodes */}
      <div className={styles.kitchenSection}>
        <p className={styles.kitchenSectionLabel}>What equipment do you have?</p>
        <p className={styles.kitchenSectionSub}>Select all that apply — recipe suggestions will be tailored to your setup.</p>
        <div className={styles.equipmentGrid}>
          {EQUIPMENT_NODES.map(node => {
            const active = equipment.includes(node.id)
            return (
              <button
                key={node.id}
                type="button"
                className={`${styles.equipNode} ${active ? styles.equipNodeOn : ''}`}
                onClick={() => toggleEquipment(node.id)}
              >
                <span className={styles.equipNodeEmoji}>{node.emoji}</span>
                <span className={styles.equipNodeLabel}>{node.label}</span>
                <span className={styles.equipNodeDesc}>{node.description}</span>
                {active && <span className={styles.equipNodeCheck}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preferred grocery store */}
      <div className={styles.kitchenSection}>
        <p className={styles.kitchenSectionLabel}>Preferred Grocery Store</p>
        <p className={styles.kitchenSectionSub}>
          Ingredient prices are estimated. Setting one store keeps your budget consistent.
        </p>
        {storeName && (
          <div className={styles.currentStore}>
            <span className={styles.currentStoreIcon}>🏪</span>
            <span className={styles.currentStoreName}>{storeName}</span>
            <button type="button" className={styles.currentStoreChange} onClick={() => saveStore('')}>Change</button>
          </div>
        )}
        <div className={styles.storeInputRow}>
          <input
            className={styles.fieldInput}
            placeholder="Type store name…"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            onBlur={() => storeName.trim() && saveStore(storeName.trim())}
          />
          <button
            type="button"
            className={styles.locateBtn}
            onClick={findNearbyStores}
            disabled={locLoading}
          >
            {locLoading ? 'Searching…' : '📍 Find Nearby'}
          </button>
        </div>

        {nearbyStores.length > 0 && (
          <div className={styles.nearbyList}>
            {nearbyStores.map(s => (
              <button
                key={s}
                type="button"
                className={styles.nearbyItem}
                onClick={() => saveStore(s)}
              >
                <span className={styles.nearbyIcon}>🏪</span>
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}

        <p className={styles.priceNote}>
          ℹ️ Prices are pre-estimated averages (marked ~). Real-time price APIs require paid subscriptions —
          use the store lookup to check actual prices manually.
        </p>
      </div>

      {/* ── Dietary Preferences ──────────────────────────── */}
      <div className={styles.kitchenSection}>
        <p className={styles.kitchenSectionLabel}>Dietary Preferences</p>
        <p className={styles.kitchenSectionSub}>
          Enable filters to show only meals that match. Active filters apply to recipe suggestions and quick-fill.
        </p>
        <div className={styles.dietaryGrid}>
          {DIETARY_TAGS.map(tag => {
            const active = prefs.dietary.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className={`${styles.dietaryChip} ${active ? styles.dietaryChipOn : ''}`}
                onClick={() => {
                  const next = active
                    ? prefs.dietary.filter(t => t !== tag.id)
                    : [...prefs.dietary, tag.id]
                  const updated = { ...prefs, dietary: next }
                  setPrefs(updated)
                  savePrefs(updated)
                }}
              >
                <span>{tag.emoji}</span>
                <span>{tag.label}</span>
                {active && <span className={styles.dietaryCheck}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Disliked Ingredients ──────────────────────────── */}
      <div className={styles.kitchenSection}>
        <p className={styles.kitchenSectionLabel}>Disliked Ingredients</p>
        <p className={styles.kitchenSectionSub}>
          Ingredients listed here are hidden from search results and excluded from recipe suggestions.
        </p>
        <div className={styles.storeInputRow}>
          <input
            className={styles.fieldInput}
            placeholder="Type ingredient to exclude…"
            value={ingSearch}
            onChange={e => setIngSearch(e.target.value)}
          />
          <button
            type="button"
            className={styles.locateBtn}
            onClick={() => {
              const val = ingSearch.trim()
              if (!val || prefs.disliked.includes(val)) return
              const updated = { ...prefs, disliked: [...prefs.disliked, val] }
              setPrefs(updated)
              savePrefs(updated)
              setIngSearch('')
              toast(`"${val}" added to disliked list.`, 'info')
            }}
          >
            + Add
          </button>
        </div>
        {prefs.disliked.length > 0 && (
          <div className={styles.dislikedList}>
            {prefs.disliked.map(item => (
              <div key={item} className={styles.dislikedItem}>
                <span className={styles.dislikedName}>{item}</span>
                <button
                  type="button"
                  className={styles.dislikedRemove}
                  onClick={() => {
                    const updated = { ...prefs, disliked: prefs.disliked.filter(d => d !== item) }
                    setPrefs(updated)
                    savePrefs(updated)
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {prefs.disliked.length === 0 && (
          <p className={styles.noEquipNote}>No ingredients excluded yet.</p>
        )}
      </div>

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN VIEW
   ═══════════════════════════════════════════════════════════════ */

export default function MealPlanningView() {
  const [activeTab,  setActiveTab]  = useState<Tab>('planner')
  const [weekOffset, setWeekOffset] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(loadHiddenIds)

  const weekStart = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return getWeekStart(base)
  }, [weekOffset])

  const [weekBudget, setWeekBudget] = useState(() => {
    if (typeof window === 'undefined') return 0
    return Number(localStorage.getItem(LS_BUDGET) ?? 0)
  })

  const [equipment, setEquipment] = useState<EquipmentTier[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(LS_KITCHEN) ?? '[]') } catch { return [] }
  })

  const [prefs, setPrefs] = useState<FoodPrefs>(loadPrefs)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'planner',  label: 'Weekly Planner' },
    { id: 'recipes',  label: 'Recipes & Resources' },
    { id: 'budget',   label: 'Budget' },
    { id: 'kitchen',  label: 'Kitchen Setup' },
  ]

  return (
    <div className={styles.page}>

      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Life · Meal Planning"
          title="Meal Planning."
          subtitle="Plan your week, track your grocery budget, and cook smarter with college-friendly meal ideas."
          size="md"
        />
      </div>

      {/* Tab bar + week navigator */}
      <div className={`${styles.tabBar} anim-fade-in delay-1`}>
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'planner' && (
          <div className={styles.weekNav}>
            <button type="button" className={styles.weekNavBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
            <span className={styles.weekNavLabel}>{formatWeekLabel(weekStart)}</span>
            <button type="button" className={styles.weekNavBtn} onClick={() => setWeekOffset(w => w + 1)}>›</button>
            {weekOffset !== 0 && (
              <button type="button" className={styles.weekNavToday} onClick={() => setWeekOffset(0)}>Today</button>
            )}
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="anim-fade-in delay-2">
        <div className={activeTab === 'planner'  ? '' : styles.hidden}>
          <PlannerTab weekStart={weekStart} equipment={equipment} weekBudget={weekBudget} disliked={prefs.disliked} dietary={prefs.dietary} hiddenIds={hiddenIds} />
        </div>
        <div className={activeTab === 'recipes'  ? '' : styles.hidden}>
          <RecipesTab equipment={equipment} disliked={prefs.disliked} dietary={prefs.dietary} hiddenIds={hiddenIds} setHiddenIds={setHiddenIds} />
        </div>
        <div className={activeTab === 'budget'   ? '' : styles.hidden}>
          <BudgetTab weekStart={weekStart} weekBudget={weekBudget} setWeekBudget={setWeekBudget} />
        </div>
        <div className={activeTab === 'kitchen'  ? '' : styles.hidden}>
          <KitchenSetupTab equipment={equipment} setEquipment={setEquipment} prefs={prefs} setPrefs={setPrefs} />
        </div>
      </div>

    </div>
  )
}
