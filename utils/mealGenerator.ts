/**
 * utils/mealGenerator.ts — Smart Week-Plan Generator
 *
 * Pure logic (no React, no Dexie) that fills the empty slots of a weekly
 * meal plan from the recipe library + the user's saved recipes + college
 * meals, honouring four preferences:
 *
 *   • Calorie goal     — cut / maintain / bulk  (drives a daily kcal target)
 *   • Emphasize protein — bias toward high-protein recipes
 *   • Budget level     — low / medium / high    (bias toward cheap/pricey)
 *   • No-repeat        — avoid reusing the same recipe across the week
 *
 * Also respects the user's kitchen equipment, dietary filters, and disliked
 * ingredients so every Meal-Planning module works in tandem.
 */

import type { MealPlanSlot, MealIngredient, SavedMealRecipe } from '@/lib/db'
import type { EquipmentTier, MealTypeKey } from './mealData'
import { INGREDIENT_PRICE_MAP, COLLEGE_MEALS, filterCollegeMeals } from './mealData'
import { RECIPES_BY_MEAL, type LibraryRecipe } from './recipeLibrary'

/* ── Preference types ────────────────────────────────────────── */

export type CalorieGoal = 'cut' | 'maintain' | 'bulk'
export type BudgetLevel = 'low' | 'medium' | 'high'

export interface GenConfig {
  calorieGoal:      CalorieGoal
  emphasizeProtein: boolean
  budgetLevel:      BudgetLevel
  noRepeat:         boolean
}

export const DEFAULT_GEN_CONFIG: GenConfig = {
  calorieGoal:      'maintain',
  emphasizeProtein: false,
  budgetLevel:      'medium',
  noRepeat:         true,
}

export const DAILY_CALORIE_TARGETS: Record<CalorieGoal, number> = {
  cut: 1600, maintain: 2000, bulk: 2700,
}

export const CALORIE_GOAL_LABELS: Record<CalorieGoal, string> = {
  cut: 'Lower Intake', maintain: 'Maintain', bulk: 'Higher Intake',
}

export const CALORIE_GOAL_SUB: Record<CalorieGoal, string> = {
  cut: '~1,600 kcal/day', maintain: '~2,000 kcal/day', bulk: '~2,700 kcal/day',
}

export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  low: 'Low', medium: 'Medium', high: 'High',
}

export const BUDGET_LEVEL_SUB: Record<BudgetLevel, string> = {
  low: 'Cheapest options', medium: 'Balanced', high: 'Premium picks',
}

/* Share of the daily calorie target allocated to each meal. */
const MEAL_SHARE: Record<MealTypeKey, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.40 }

const MEAL_ORDER: MealTypeKey[] = ['breakfast', 'lunch', 'dinner']

/* ── Internal candidate shape (library + saved + college unified) ── */

interface GenCandidate {
  name:        string
  cost:        number
  calories:    number
  protein:     number
  cookMinutes: number
  ingredients: MealIngredient[]
}

function ingredientsFromNames(names: string[]): MealIngredient[] {
  return names.map(n => {
    const p = INGREDIENT_PRICE_MAP[n.toLowerCase()]
    return { name: n, quantity: p?.unit ?? '1 serving', estimatedPrice: p?.price ?? 1.0 }
  })
}

function fromLibrary(r: LibraryRecipe): GenCandidate {
  return {
    name:        r.name,
    cost:        r.cost,
    calories:    r.calories,
    protein:     r.protein,
    cookMinutes: r.cookMinutes,
    ingredients: ingredientsFromNames(r.ingredients),
  }
}

/* ── Generator input / output ────────────────────────────────── */

export interface GeneratorInput {
  config:       GenConfig
  equipment:    EquipmentTier[]
  disliked:     string[]
  dietary:      string[]
  weekStart:    string
  existingKeys: Set<string>          // "dayIndex:mealType" already filled
  savedRecipes: SavedMealRecipe[]
  weekBudget:   number               // 0 = no budget set
  hiddenIds?:   Set<string>          // recipe IDs hidden by the user
}

export interface GeneratorResult {
  slots:                  Omit<MealPlanSlot, 'id'>[]
  projectedCost:          number
  projectedDailyCalories: number[]   // length 7
  emptyPools:             boolean     // true if no candidates were available
}

/* Map a saved-recipe category to the meal types it can fill. */
const CATEGORY_MEAL_MAP: Record<string, MealTypeKey[]> = {
  'Breakfast':       ['breakfast'],
  'Lunch':           ['lunch'],
  'Dinner':          ['dinner'],
  'Snacks':          ['breakfast'],
  'College Dorm':    ['breakfast', 'lunch', 'dinner'],
  'Quick & Easy':    ['lunch', 'dinner'],
  'Meal Prep':       ['lunch', 'dinner'],
  'Budget Friendly': ['lunch', 'dinner'],
  'Vegetarian':      ['lunch', 'dinner'],
  'High Protein':    ['breakfast', 'lunch', 'dinner'],
}

/**
 * Build per-meal candidate pools from the library, the user's saved recipes,
 * and college meals — all filtered by equipment / dietary / disliked.
 */
function buildPools(input: GeneratorInput): Record<MealTypeKey, GenCandidate[]> {
  const { equipment, disliked, dietary, savedRecipes, hiddenIds } = input
  const lowerDislike = disliked.map(d => d.toLowerCase())

  const pools: Record<MealTypeKey, GenCandidate[]> = { breakfast: [], lunch: [], dinner: [] }

  const passesEquip   = (eq: EquipmentTier[]) => equipment.length === 0 || equipment.some(e => eq.includes(e))
  const passesDietary = (tags: string[]) => dietary.length === 0 || dietary.every(t => tags.includes(t))
  const passesDislike = (ings: string[]) =>
    lowerDislike.length === 0 || !ings.some(i => lowerDislike.some(d => i.toLowerCase().includes(d)))

  /* 1 — Library recipes (rich macro data) */
  for (const mt of MEAL_ORDER) {
    for (const r of RECIPES_BY_MEAL[mt]) {
      if (hiddenIds && hiddenIds.has(r.id)) continue
      if (!passesEquip(r.equipment)) continue
      if (!passesDietary(r.dietaryTags)) continue
      if (!passesDislike(r.ingredients)) continue
      pools[mt].push(fromLibrary(r))
    }
  }

  /* 2 — College meals (filtered, lighter macro data) */
  const college = filterCollegeMeals(
    COLLEGE_MEALS.filter(m => passesEquip(m.equipment)),
    disliked, dietary,
  )
  for (const cm of college) {
    pools[cm.mealType].push({
      name:        cm.name,
      cost:        cm.cost,
      calories:    cm.calories,
      protein:     Math.round(cm.calories * 0.05),   // rough estimate when unknown
      cookMinutes: cm.cookMinutes,
      ingredients: ingredientsFromNames(cm.ingredients),
    })
  }

  /* 3 — User's own saved recipes */
  for (const r of savedRecipes) {
    const mts = CATEGORY_MEAL_MAP[r.category] ?? (['lunch', 'dinner'] as MealTypeKey[])
    for (const mt of mts) {
      pools[mt].push({
        name:        r.title,
        cost:        r.estimatedCost ?? 0,
        calories:    r.calories ?? 0,
        protein:     r.protein ?? 0,
        cookMinutes: r.cookTime ?? 0,
        ingredients: [],
      })
    }
  }

  return pools
}

/** Score a candidate for a particular slot under the active config. */
function scoreCandidate(
  cand: GenCandidate,
  slotCalTarget: number,
  config: GenConfig,
  used: Set<string>,
): number {
  // Calorie closeness (1 = perfect, 0 = far off)
  const calScore = 1 - Math.min(1, Math.abs(cand.calories - slotCalTarget) / slotCalTarget)

  // Protein emphasis (caps at ~35g per meal)
  const proteinScore = config.emphasizeProtein ? Math.min(1, cand.protein / 35) : 0

  // Budget bias
  const costNorm = Math.min(1, cand.cost / 4)   // $4/serving ≈ "expensive"
  let budgetScore: number
  if (config.budgetLevel === 'low')       budgetScore = 1 - costNorm
  else if (config.budgetLevel === 'high') budgetScore = 0.35 + costNorm * 0.5
  else                                    budgetScore = 0.35

  let total =
    calScore * 1.0 +
    proteinScore * 0.9 +
    budgetScore * 0.6 +
    Math.random() * 0.25

  // No-repeat penalty (soft — still picks if the pool is exhausted)
  if (config.noRepeat && used.has(cand.name)) total -= 1.5

  return total
}

/**
 * Generate meals for the empty slots of the given week.
 * Pure and deterministic except for a small random tie-breaker.
 */
export function generateWeekPlan(input: GeneratorInput): GeneratorResult {
  const { config, weekStart, existingKeys } = input
  const pools = buildPools(input)

  const dailyTarget = DAILY_CALORIE_TARGETS[config.calorieGoal]
  const used = new Set<string>()
  const slots: Omit<MealPlanSlot, 'id'>[] = []
  const projectedDailyCalories = Array<number>(7).fill(0)
  let projectedCost = 0

  const hasAny = MEAL_ORDER.some(mt => pools[mt].length > 0)
  if (!hasAny) {
    return { slots: [], projectedCost: 0, projectedDailyCalories, emptyPools: true }
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (const mt of MEAL_ORDER) {
      const key = `${dayIndex}:${mt}`
      if (existingKeys.has(key)) continue
      const pool = pools[mt]
      if (pool.length === 0) continue

      const slotCalTarget = dailyTarget * MEAL_SHARE[mt]
      let best: GenCandidate | null = null
      let bestScore = -Infinity
      for (const cand of pool) {
        const s = scoreCandidate(cand, slotCalTarget, config, used)
        if (s > bestScore) { bestScore = s; best = cand }
      }
      if (!best) continue

      used.add(best.name)
      projectedCost += best.cost
      projectedDailyCalories[dayIndex] += best.calories

      slots.push({
        weekStart,
        dayIndex,
        mealType:          mt,
        mealName:          best.name,
        planType:          'home',
        ingredients:       best.ingredients,
        estimatedCost:     Math.round(best.cost * 100) / 100,
        estimatedCalories: best.calories,
        cookMinutes:       best.cookMinutes,
      })
    }
  }

  return {
    slots,
    projectedCost: Math.round(projectedCost * 100) / 100,
    projectedDailyCalories,
    emptyPools: false,
  }
}
