/**
 * utils/mealData.ts — Meal Planning Data
 * Ingredient prices + calories, college meals, equipment tiers,
 * dietary preference filtering.
 */

/* ════════════════════════════════════════════════════════════════
   EQUIPMENT TIERS
   ════════════════════════════════════════════════════════════════ */

export type EquipmentTier = 'no_kitchen' | 'microwave' | 'mini_fridge' | 'hot_plate'

export interface EquipmentNode {
  id:          EquipmentTier
  label:       string
  emoji:       string
  description: string
  unlocks:     string[]
}

export const EQUIPMENT_NODES: EquipmentNode[] = [
  {
    id:          'no_kitchen',
    label:       'No Kitchen',
    emoji:       '🎒',
    description: 'No cooking equipment — snacks, packaged foods, vending-machine items',
    unlocks:     ['no-cook', 'packaged', 'snack'],
  },
  {
    id:          'microwave',
    label:       'Microwave',
    emoji:       '📡',
    description: 'Microwave meals, mug recipes, ramen upgrades',
    unlocks:     ['microwave', 'no-cook', 'packaged'],
  },
  {
    id:          'mini_fridge',
    label:       'Mini Fridge + Kettle',
    emoji:       '🧊',
    description: 'Overnight oats, cold prep meals, sandwiches, instant noodles',
    unlocks:     ['mini-fridge', 'microwave', 'no-cook', 'packaged'],
  },
  {
    id:          'hot_plate',
    label:       'Hot Plate / Toaster Oven',
    emoji:       '🍳',
    description: 'Simple cooked meals — eggs, pasta, stir fry, toasted sandwiches',
    unlocks:     ['hot-plate', 'mini-fridge', 'microwave', 'no-cook', 'packaged'],
  },
]

/* ════════════════════════════════════════════════════════════════
   DIETARY TAGS
   ════════════════════════════════════════════════════════════════ */

export interface DietaryTag {
  id:    string
  label: string
  emoji: string
  description: string
}

export const DIETARY_TAGS: DietaryTag[] = [
  { id: 'vegetarian',  label: 'Vegetarian',  emoji: '🥦', description: 'No meat or fish' },
  { id: 'vegan',       label: 'Vegan',       emoji: '🌱', description: 'No animal products' },
  { id: 'gluten-free', label: 'Gluten-Free', emoji: '🌾', description: 'No wheat/gluten' },
  { id: 'dairy-free',  label: 'Dairy-Free',  emoji: '🥛', description: 'No dairy products' },
  { id: 'nut-free',    label: 'Nut-Free',    emoji: '🥜', description: 'No nuts or peanuts' },
  { id: 'high-protein',label: 'High Protein',emoji: '💪', description: 'Protein-rich meals' },
  { id: 'low-cal',     label: 'Low Calorie', emoji: '🔥', description: 'Under 400 cal per meal' },
]

/* ════════════════════════════════════════════════════════════════
   INGREDIENT PRICE + CALORIE DATABASE
   prices = estimated per purchase unit (marked ~ in UI)
   servingCalories = approximate calories per typical recipe use
   ════════════════════════════════════════════════════════════════ */

export interface IngredientPrice {
  name:            string
  unit:            string
  price:           number    // USD estimate per purchase unit
  servingCalories: number    // calories per typical recipe serving/use
}

export const INGREDIENT_PRICES: IngredientPrice[] = [
  // Proteins
  { name: 'Eggs',               unit: 'dozen',     price: 3.99,  servingCalories: 140 },
  { name: 'Chicken breast',     unit: '1 lb',      price: 4.99,  servingCalories: 165 },
  { name: 'Ground beef',        unit: '1 lb',      price: 5.99,  servingCalories: 300 },
  { name: 'Canned tuna',        unit: '5 oz can',  price: 1.99,  servingCalories: 100 },
  { name: 'Peanut butter',      unit: '16 oz',     price: 3.99,  servingCalories: 190 },
  { name: 'Greek yogurt',       unit: '32 oz',     price: 4.99,  servingCalories: 100 },
  { name: 'Deli turkey',        unit: '8 oz',      price: 3.49,  servingCalories: 60  },
  { name: 'Cottage cheese',     unit: '16 oz',     price: 3.49,  servingCalories: 110 },
  { name: 'Tofu',               unit: '14 oz',     price: 2.49,  servingCalories: 80  },
  { name: 'Canned chickpeas',   unit: '15 oz',     price: 1.29,  servingCalories: 135 },
  { name: 'Canned black beans', unit: '15 oz',     price: 1.29,  servingCalories: 115 },
  // Produce
  { name: 'Banana',             unit: '1 lb',      price: 0.59,  servingCalories: 105 },
  { name: 'Apple',              unit: '1 lb',      price: 1.99,  servingCalories: 95  },
  { name: 'Orange',             unit: 'each',      price: 0.99,  servingCalories: 62  },
  { name: 'Spinach',            unit: '5 oz bag',  price: 3.99,  servingCalories: 7   },
  { name: 'Romaine lettuce',    unit: 'head',      price: 1.99,  servingCalories: 8   },
  { name: 'Broccoli',           unit: 'head',      price: 2.49,  servingCalories: 55  },
  { name: 'Bell pepper',        unit: 'each',      price: 1.49,  servingCalories: 40  },
  { name: 'Tomato',             unit: '1 lb',      price: 2.49,  servingCalories: 22  },
  { name: 'Onion',              unit: '1 lb',      price: 1.49,  servingCalories: 32  },
  { name: 'Garlic',             unit: 'bulb',      price: 0.99,  servingCalories: 10  },
  { name: 'Potato',             unit: '5 lb bag',  price: 4.99,  servingCalories: 161 },
  { name: 'Avocado',            unit: 'each',      price: 1.49,  servingCalories: 120 },
  { name: 'Cucumber',           unit: 'each',      price: 1.29,  servingCalories: 22  },
  { name: 'Carrot',             unit: '1 lb',      price: 1.49,  servingCalories: 25  },
  // Grains & Carbs
  { name: 'Bread (loaf)',       unit: 'loaf',      price: 3.49,  servingCalories: 160 },
  { name: 'Pasta',              unit: '1 lb box',  price: 1.99,  servingCalories: 210 },
  { name: 'White rice',         unit: '5 lb bag',  price: 4.99,  servingCalories: 200 },
  { name: 'Oatmeal',            unit: '42 oz',     price: 4.49,  servingCalories: 150 },
  { name: 'Tortillas',          unit: '10 pack',   price: 3.29,  servingCalories: 130 },
  { name: 'Ramen noodles',      unit: 'pack',      price: 0.29,  servingCalories: 380 },
  { name: 'Mac & cheese (box)', unit: 'box',       price: 1.19,  servingCalories: 400 },
  { name: 'Instant oatmeal',    unit: '8-pack',    price: 3.49,  servingCalories: 150 },
  { name: 'Granola bar',        unit: '6-pack',    price: 3.99,  servingCalories: 180 },
  { name: 'Cereal',             unit: 'box',       price: 4.99,  servingCalories: 150 },
  // Dairy
  { name: 'Milk',               unit: '1 gal',     price: 3.99,  servingCalories: 120 },
  { name: 'Cheese (shredded)',  unit: '8 oz',      price: 3.99,  servingCalories: 110 },
  { name: 'Butter',             unit: '1 lb',      price: 4.99,  servingCalories: 102 },
  { name: 'Cream cheese',       unit: '8 oz',      price: 2.99,  servingCalories: 100 },
  // Pantry
  { name: 'Olive oil',          unit: '16 oz',     price: 6.99,  servingCalories: 120 },
  { name: 'Vegetable oil',      unit: '48 oz',     price: 5.49,  servingCalories: 120 },
  { name: 'Salt',               unit: '26 oz',     price: 1.49,  servingCalories: 0   },
  { name: 'Black pepper',       unit: '2 oz',      price: 3.49,  servingCalories: 2   },
  { name: 'Soy sauce',          unit: '10 oz',     price: 2.99,  servingCalories: 10  },
  { name: 'Hot sauce',          unit: '5 oz',      price: 3.49,  servingCalories: 2   },
  { name: 'Mayonnaise',         unit: '30 oz',     price: 4.99,  servingCalories: 90  },
  { name: 'Ketchup',            unit: '20 oz',     price: 3.29,  servingCalories: 15  },
  { name: 'Jelly',              unit: '18 oz',     price: 3.49,  servingCalories: 50  },
  // Frozen / Ready
  { name: 'Frozen pizza',       unit: 'each',      price: 5.99,  servingCalories: 400 },
  { name: 'Frozen vegetables',  unit: '16 oz bag', price: 2.49,  servingCalories: 50  },
  { name: 'Microwave burrito',  unit: 'each',      price: 1.49,  servingCalories: 350 },
  // Drinks
  { name: 'Coffee (ground)',    unit: '12 oz',     price: 8.99,  servingCalories: 5   },
  { name: 'Tea bags',           unit: '20 pack',   price: 3.99,  servingCalories: 2   },
  { name: 'Orange juice',       unit: '52 oz',     price: 4.99,  servingCalories: 112 },
]

/** Fast O(1) price lookup by ingredient name (lowercased) */
export const INGREDIENT_PRICE_MAP: Record<string, IngredientPrice> = Object.fromEntries(
  INGREDIENT_PRICES.map(i => [i.name.toLowerCase(), i]),
)

/* ════════════════════════════════════════════════════════════════
   COLLEGE DORM MEAL SUGGESTIONS
   ════════════════════════════════════════════════════════════════ */

export type MealTypeKey = 'breakfast' | 'lunch' | 'dinner'

export interface CollegeMeal {
  id:          string
  name:        string
  mealType:    MealTypeKey
  equipment:   EquipmentTier[]
  cookMinutes: number
  cost:        number
  calories:    number
  ingredients: string[]
  tips:        string
  tags:        string[]
  dietaryTags: string[]
}

export const COLLEGE_MEALS: CollegeMeal[] = [
  {
    id: 'overnight-oats-cold',
    name: 'Overnight Oats (No Heat)',
    mealType: 'breakfast',
    equipment: ['no_kitchen', 'microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 5, cost: 1.50, calories: 350,
    ingredients: ['Instant oatmeal', 'Banana', 'Granola bar'],
    tips: 'Mix oats with water or milk in a cup, leave overnight in your fridge/cooler.',
    tags: ['no-cook', 'packaged', 'quick'],
    dietaryTags: ['vegetarian', 'dairy-free', 'nut-free'],
  },
  {
    id: 'pb-banana-wrap',
    name: 'PB & Banana Wrap',
    mealType: 'breakfast',
    equipment: ['no_kitchen', 'microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 3, cost: 1.20, calories: 420,
    ingredients: ['Tortillas', 'Peanut butter', 'Banana'],
    tips: 'Spread PB on a tortilla, add banana slices, roll up. High energy, no heat needed.',
    tags: ['no-cook', 'quick'],
    dietaryTags: ['vegetarian', 'dairy-free', 'vegan'],
  },
  {
    id: 'granola-yogurt',
    name: 'Yogurt Parfait',
    mealType: 'breakfast',
    equipment: ['no_kitchen', 'microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 2, cost: 2.00, calories: 280,
    ingredients: ['Greek yogurt', 'Granola bar', 'Banana'],
    tips: 'Layer yogurt with crushed granola bar and sliced fruit.',
    tags: ['no-cook', 'quick'],
    dietaryTags: ['vegetarian', 'gluten-free', 'high-protein'],
  },
  {
    id: 'dorm-sandwich',
    name: 'Turkey & Cheese Sandwich',
    mealType: 'lunch',
    equipment: ['no_kitchen', 'microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 3, cost: 2.50, calories: 430,
    ingredients: ['Bread (loaf)', 'Deli turkey', 'Cheese (shredded)', 'Mayonnaise'],
    tips: 'Classic dorm lunch — prep in 3 min, no heat needed.',
    tags: ['no-cook', 'quick'],
    dietaryTags: ['nut-free'],
  },
  {
    id: 'upgraded-ramen',
    name: 'Upgraded Ramen Bowl',
    mealType: 'lunch',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 5, cost: 1.50, calories: 450,
    ingredients: ['Ramen noodles', 'Eggs', 'Spinach', 'Soy sauce'],
    tips: 'Microwave ramen, crack an egg in halfway through. Add spinach and soy sauce.',
    tags: ['microwave', 'quick', 'college'],
    dietaryTags: ['dairy-free', 'nut-free'],
  },
  {
    id: 'microwave-mac',
    name: 'Microwave Mac & Cheese',
    mealType: 'lunch',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 8, cost: 1.49, calories: 400,
    ingredients: ['Mac & cheese (box)', 'Milk', 'Butter'],
    tips: 'Use a microwave-safe bowl. Add a splash of milk for creamier results.',
    tags: ['microwave', 'quick'],
    dietaryTags: ['vegetarian', 'nut-free'],
  },
  {
    id: 'microwave-burrito-bowl',
    name: 'Burrito Bowl',
    mealType: 'lunch',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 6, cost: 2.50, calories: 490,
    ingredients: ['Microwave burrito', 'Canned black beans', 'Cheese (shredded)', 'Hot sauce'],
    tips: 'Microwave the burrito and beans separately, layer in a bowl.',
    tags: ['microwave', 'college'],
    dietaryTags: ['nut-free'],
  },
  {
    id: 'mug-scrambled-eggs',
    name: 'Mug Scrambled Eggs',
    mealType: 'breakfast',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 3, cost: 1.00, calories: 230,
    ingredients: ['Eggs', 'Milk', 'Cheese (shredded)', 'Salt'],
    tips: 'Crack 2 eggs into a mug, add a splash of milk. Microwave 30s, stir, 30s more.',
    tags: ['microwave', 'quick', 'college'],
    dietaryTags: ['vegetarian', 'gluten-free', 'nut-free', 'high-protein'],
  },
  {
    id: 'microwave-oatmeal',
    name: 'Microwave Oatmeal',
    mealType: 'breakfast',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 4, cost: 1.20, calories: 370,
    ingredients: ['Oatmeal', 'Milk', 'Banana', 'Peanut butter'],
    tips: 'Combine oats and milk in a bowl, microwave 2–3 min. Top with banana and PB.',
    tags: ['microwave', 'quick'],
    dietaryTags: ['vegetarian'],
  },
  {
    id: 'canned-soup-upgrade',
    name: 'Chickpea Ramen Bowl',
    mealType: 'dinner',
    equipment: ['microwave', 'mini_fridge', 'hot_plate'],
    cookMinutes: 6, cost: 2.50, calories: 380,
    ingredients: ['Canned chickpeas', 'Spinach', 'Soy sauce', 'Ramen noodles'],
    tips: 'Microwave chickpeas with water, add raw spinach, season with soy sauce over ramen.',
    tags: ['microwave', 'college'],
    dietaryTags: ['vegetarian', 'vegan', 'dairy-free', 'nut-free'],
  },
  {
    id: 'kettle-ramen',
    name: 'Kettle Ramen',
    mealType: 'lunch',
    equipment: ['mini_fridge', 'hot_plate'],
    cookMinutes: 5, cost: 0.80, calories: 380,
    ingredients: ['Ramen noodles', 'Soy sauce', 'Eggs'],
    tips: 'Pour boiling kettle water over ramen, cover 3 min. Add soft-boiled egg.',
    tags: ['mini-fridge', 'quick', 'college'],
    dietaryTags: ['dairy-free'],
  },
  {
    id: 'overnight-oats-deluxe',
    name: 'Overnight Oats Deluxe',
    mealType: 'breakfast',
    equipment: ['mini_fridge', 'hot_plate'],
    cookMinutes: 5, cost: 1.80, calories: 440,
    ingredients: ['Oatmeal', 'Milk', 'Peanut butter', 'Banana', 'Greek yogurt'],
    tips: 'Mix oats, milk, and PB in a jar the night before. Top with yogurt and banana.',
    tags: ['mini-fridge', 'no-cook', 'prep-ahead'],
    dietaryTags: ['vegetarian', 'high-protein'],
  },
  {
    id: 'scrambled-eggs-toast',
    name: 'Scrambled Eggs & Toast',
    mealType: 'breakfast',
    equipment: ['hot_plate'],
    cookMinutes: 10, cost: 1.80, calories: 400,
    ingredients: ['Eggs', 'Butter', 'Bread (loaf)', 'Salt', 'Black pepper'],
    tips: 'Melt butter on low heat, add whisked eggs and salt. Stir gently until barely set.',
    tags: ['hot-plate', 'classic'],
    dietaryTags: ['vegetarian', 'nut-free', 'high-protein'],
  },
  {
    id: 'pasta-butter-garlic',
    name: 'Garlic Butter Pasta',
    mealType: 'dinner',
    equipment: ['hot_plate'],
    cookMinutes: 15, cost: 2.00, calories: 540,
    ingredients: ['Pasta', 'Butter', 'Garlic', 'Black pepper', 'Cheese (shredded)'],
    tips: 'Boil pasta, drain. Melt butter, add minced garlic for 1 min, toss pasta. Add cheese.',
    tags: ['hot-plate', 'classic', 'college'],
    dietaryTags: ['vegetarian', 'nut-free'],
  },
  {
    id: 'stir-fry-rice',
    name: 'Fried Rice Bowl',
    mealType: 'dinner',
    equipment: ['hot_plate'],
    cookMinutes: 20, cost: 2.50, calories: 580,
    ingredients: ['White rice', 'Eggs', 'Frozen vegetables', 'Soy sauce', 'Vegetable oil'],
    tips: 'Cook rice first, let it cool. Fry on high heat, push aside and scramble eggs, add veg.',
    tags: ['hot-plate', 'college', 'filling'],
    dietaryTags: ['vegetarian', 'vegan', 'dairy-free', 'nut-free'],
  },
  {
    id: 'avocado-toast',
    name: 'Avocado Toast & Egg',
    mealType: 'breakfast',
    equipment: ['hot_plate'],
    cookMinutes: 8, cost: 3.00, calories: 430,
    ingredients: ['Bread (loaf)', 'Avocado', 'Eggs', 'Salt', 'Hot sauce'],
    tips: 'Toast bread, mash avocado with salt. Fry or poach an egg. Add hot sauce.',
    tags: ['hot-plate', 'trending'],
    dietaryTags: ['vegetarian', 'dairy-free', 'nut-free'],
  },
  {
    id: 'quesadilla',
    name: 'Cheese Quesadilla',
    mealType: 'lunch',
    equipment: ['hot_plate'],
    cookMinutes: 8, cost: 1.80, calories: 370,
    ingredients: ['Tortillas', 'Cheese (shredded)', 'Butter'],
    tips: 'Melt butter in pan, place tortilla, add cheese to half, fold. Cook until golden.',
    tags: ['hot-plate', 'quick', 'college'],
    dietaryTags: ['vegetarian', 'nut-free'],
  },
]

/* ════════════════════════════════════════════════════════════════
   PREFERENCE FILTERING
   ════════════════════════════════════════════════════════════════ */

/**
 * Filter ingredient list by disliked names (case-insensitive substring match)
 */
export function filterIngredients(
  ingredients: IngredientPrice[],
  disliked: string[],
): IngredientPrice[] {
  if (!disliked.length) return ingredients
  const lower = disliked.map(d => d.toLowerCase())
  return ingredients.filter(
    ing => !lower.some(d => ing.name.toLowerCase().includes(d)),
  )
}

/**
 * Filter college meals by disliked ingredients + dietary tags.
 * A meal is excluded if:
 *  - it contains any disliked ingredient
 *  - the user has active dietary filters and the meal doesn't satisfy all of them
 */
export function filterCollegeMeals(
  meals: CollegeMeal[],
  disliked: string[],
  dietary: string[],
): CollegeMeal[] {
  const lower = disliked.map(d => d.toLowerCase())
  return meals.filter(meal => {
    // Exclude if any ingredient is disliked
    if (lower.length) {
      const hasDisliked = meal.ingredients.some(ing =>
        lower.some(d => ing.toLowerCase().includes(d)),
      )
      if (hasDisliked) return false
    }
    // Exclude if meal doesn't satisfy all active dietary filters
    if (dietary.length) {
      const satisfies = dietary.every(tag => meal.dietaryTags.includes(tag))
      if (!satisfies) return false
    }
    return true
  })
}

/* ════════════════════════════════════════════════════════════════
   RECIPE CATEGORIES
   ════════════════════════════════════════════════════════════════ */

export const RECIPE_CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'College Dorm',
  'Quick & Easy', 'Meal Prep', 'Budget Friendly', 'Vegetarian', 'High Protein',
]

/* ════════════════════════════════════════════════════════════════
   WEEK UTILITIES
   ════════════════════════════════════════════════════════════════ */

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart + 'T12:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function formatWeekLabel(weekStart: string): string {
  const days = getWeekDays(weekStart)
  const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(days[0])} – ${fmt(days[6])}`
}

export const MEAL_TYPES: { key: MealTypeKey; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙' },
]

export const PLAN_TYPE_LABELS: Record<string, string> = {
  home:        'Home Cooked',
  dining_out:  'Dining Out',
  takeout:     'Takeout',
  delivery:    'Delivery',
}

export const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DAILY_CALORIE_TARGET = 2000
