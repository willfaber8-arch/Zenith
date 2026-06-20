/**
 * lib/habitColors.ts — common-sense habit colour inference.
 *
 * Lets the AI Co-Pilot (and any other programmatic habit creator) pick a
 * sensible accent colour WITHOUT the model having to emit a hex value —
 * saving tokens and guaranteeing the colour matches the palette used in
 * the Habits view colour swatches.
 *
 * Resolution order (most specific wins):
 *   1. Name keyword   — "water" → sky blue, "read" → amber, etc.
 *   2. Category       — Fitness → emerald, Mindfulness → violet, etc.
 *   3. Default        — periwinkle (#7c95ff)
 *
 * Pure module — no DOM / Dexie imports, safe anywhere.
 */

/* Palette mirrors COLOR_PRESETS in HabitsView. */
const SKY      = '#38bdf8'
const EMERALD  = '#34d399'
const SAGE     = '#52cca3'
const PERIWINKLE = '#7c95ff'
const VIOLET   = '#a78bfa'
const AMBER    = '#f59e0b'
const ORANGE   = '#fb923c'
const ROSE     = '#f87171'
const FUCHSIA  = '#e879f9'
const INDIGO   = '#818cf8'

/* ── Category → colour ─────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  health:      SKY,
  fitness:     EMERALD,
  scholastic:  PERIWINKLE,
  study:       PERIWINKLE,
  mindfulness: VIOLET,
  life:        ORANGE,
  general:     PERIWINKLE,
  finance:     SAGE,
  social:      FUCHSIA,
  creativity:  AMBER,
}

/* ── Name keyword → colour (common-sense overrides) ────────────── */

const NAME_RULES: { test: RegExp; color: string }[] = [
  { test: /\b(water|hydrat|drink)\b/i,                 color: SKY },
  { test: /\b(read|book|chapter|page)\b/i,             color: AMBER },
  { test: /\b(sleep|bed|rest)\b/i,                     color: INDIGO },
  { test: /\b(meditat|breath|mindful|calm)\b/i,        color: FUCHSIA },
  { test: /\b(mood|journal|gratitude|reflect)\b/i,     color: VIOLET },
  { test: /\b(run|jog|walk|cardio|gym|workout|exercise|bike|swim|lift|yoga|stretch|step)\b/i, color: EMERALD },
  { test: /\b(study|focus|read.?ing|class|homework|learn|vocab|language)\b/i, color: PERIWINKLE },
  { test: /\b(eat|meal|veg|fruit|diet|cook|nutrition)\b/i, color: SAGE },
  { test: /\b(no |quit|avoid|reduce|less)\b/i,          color: ROSE },
]

/**
 * Pick a habit accent colour from its name + category.
 * Returns a hex string from the standard palette.
 */
export function colorForHabit(name?: string | null, category?: string | null): string {
  const n = (name ?? '').trim()
  if (n) {
    for (const rule of NAME_RULES) {
      if (rule.test.test(n)) return rule.color
    }
  }
  const cat = (category ?? '').trim().toLowerCase()
  if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]
  return PERIWINKLE
}
