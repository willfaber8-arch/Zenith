/**
 * lib/moduleSearch.ts — searchable index of every Zenith module.
 *
 * Powers the Topbar module finder. Zenith has grown large, so this index maps
 * each routable view to a friendly label, a one-line hint, and a list of
 * keyword synonyms a new user might type ("budget" → Subscriptions,
 * "fish tank" → Aquascaping). Pure module — no React / Dexie imports.
 *
 * `category` is the value passed to `navigate(view, category)` so the
 * background tint morph matches the destination (null = neutral, e.g. Home /
 * Settings / Help).
 */

import type { ViewId, CategoryId } from '@/lib/nav-config'

export interface ModuleEntry {
  id:       ViewId
  label:    string
  category: CategoryId | null
  hint:     string
  keywords: string[]
}

export const MODULE_INDEX: ModuleEntry[] = [
  { id: 'home', label: 'Home', category: null,
    hint: 'Dashboard widgets & greeting',
    keywords: ['dashboard', 'start', 'main', 'overview', 'widgets'] },
  { id: 'outlook', label: 'Daily Outlook', category: 'essentials',
    hint: 'Today at a glance — weather, agenda, briefing',
    keywords: ['today', 'daily', 'briefing', 'summary', 'agenda', 'morning', 'weather'] },

  /* ── Scholastic ── */
  { id: 'uni-hub', label: 'University Hub', category: 'essentials',
    hint: 'Campus resources, GPA, courses & finances',
    keywords: ['university', 'college', 'school', 'gpa', 'grades', 'courses', 'major', 'campus', 'dorm', 'finances', 'cognitive load'] },
  { id: 'study-shield', label: 'Study Shield', category: 'essentials',
    hint: 'Focus cockpit — Pomodoro, AI notes & flashcards',
    keywords: ['focus', 'pomodoro', 'timer', 'study', 'flashcards', 'ai notes', 'lecture', 'exam prep', 'concentration', 'focus rooms'] },
  { id: 'vocab-builder', label: 'Vocab Builder', category: 'essentials',
    hint: 'Spaced-repetition vocabulary flashcards',
    keywords: ['vocabulary', 'words', 'language', 'flashcards', 'spaced repetition', 'polyglot', 'translation', 'learn language'] },

  /* ── Life ── */
  { id: 'habits', label: 'Habits', category: 'essentials',
    hint: 'Daily habit tracker with streaks & analytics',
    keywords: ['habit', 'routine', 'streak', 'daily', 'tracker', 'goals', 'water', 'reading'] },
  { id: 'calendar', label: 'Universal Calendar', category: 'essentials',
    hint: 'Events, iCal feeds, deadlines & to-do lists',
    keywords: ['schedule', 'events', 'ical', 'deadlines', 'tasks', 'todo', 'to-do', 'agenda', 'appointments', 'meetings', 'reminders', 'class schedule'] },
  { id: 'workouts', label: 'Workouts', category: 'essentials',
    hint: 'Cardio log, Vitality Points & cozy biome',
    keywords: ['cardio', 'exercise', 'gym', 'run', 'running', 'fitness', 'vitality', 'biome', 'training', 'workout'] },
  { id: 'meal-planning', label: 'Meal Planning', category: 'essentials',
    hint: 'Weekly meal planner, recipes & grocery budget',
    keywords: ['food', 'meals', 'recipes', 'diet', 'groceries', 'nutrition', 'cooking', 'calories', 'kitchen'] },
  { id: 'wellness', label: 'Mental Wellness', category: 'essentials',
    hint: 'Mood logging & monthly wellbeing calendar',
    keywords: ['mood', 'mental health', 'journal', 'stress', 'energy', 'mindfulness', 'wellbeing', 'feelings', 'meditation'] },
  { id: 'personal-brand', label: 'Personal Brand Hub', category: 'essentials',
    hint: 'Career links & AI LinkedIn post generator',
    keywords: ['career', 'linkedin', 'resume', 'jobs', 'networking', 'portfolio', 'brand', 'work', 'professional'] },
  { id: 'world-events', label: 'World Events', category: 'essentials',
    hint: 'Live world headlines from BBC, NPR & Guardian',
    keywords: ['news', 'headlines', 'current events', 'world', 'press', 'articles'] },
  { id: 'sports', label: 'Sports Tracker', category: 'essentials',
    hint: 'Follow teams, scores & leagues',
    keywords: ['sports', 'scores', 'teams', 'games', 'leagues', 'matches', 'scoreboard'] },
  { id: 'game-finder', label: 'Game Hub', category: 'essentials',
    hint: 'Find multiplayer games to play with friends',
    keywords: ['multiplayer', 'party games', 'find games', 'play', 'co-op', 'board games', 'video games'] },
  { id: 'book-tracker', label: 'Library', category: 'essentials',
    hint: 'Track your reading list & finished books',
    keywords: ['reading', 'books', 'library', 'goodreads', 'literature', 'novel', 'bookshelf', 'to read'] },
  { id: 'subscriptions', label: 'Subscriptions', category: 'essentials',
    hint: 'Recurring expenses & monthly burn-rate gauge',
    keywords: ['subscriptions', 'expenses', 'recurring', 'billing', 'budget', 'money', 'finance', 'spending', 'bills'] },
  { id: 'friends-network', label: 'Friend Ledger', category: 'essentials',
    hint: 'Peer-to-peer friend sync & leaderboard',
    keywords: ['friends', 'social', 'leaderboard', 'peers', 'ledger', 'connect', 'compete', 'partner'] },
  { id: 'tournament-hub', label: 'Tournament Hub', category: 'essentials',
    hint: 'Wheel of Names & bracket builder',
    keywords: ['tournament', 'bracket', 'wheel of names', 'competition', 'raffle', 'picker', 'random', 'spinner', 'draw'] },

  /* ── Creator's Choice ── */
  { id: 'aquascaping', label: 'Aquascaping Engine', category: 'creator',
    hint: 'Aquarium compatibility, cart & water chemistry',
    keywords: ['aquarium', 'fish', 'tank', 'fish tank', 'aquascape', 'water', 'shrimp', 'plants', 'nitrogen cycle'] },
  { id: 'trail-hunter', label: 'Trail Hunter', category: 'creator',
    hint: 'Discover hiking trails across the US',
    keywords: ['hiking', 'trails', 'outdoors', 'hikes', 'maps', 'nature', 'walking', 'mountains'] },
  { id: 'botanist', label: 'Botanist Guide', category: 'creator',
    hint: 'Houseplant care & watering schedule',
    keywords: ['plants', 'houseplants', 'gardening', 'watering', 'flora', 'greenery', 'plant care'] },
  { id: 'games', label: 'Arcade Hub', category: 'creator',
    hint: 'Mini-games, resource economy & cosmetic shop',
    keywords: ['arcade', 'mini games', 'economy', 'crucible', 'biosphere', 'cosmetic', 'shop', 'credits', 'minesweeper', '2048', 'snake'] },

  /* ── Personalized Vault ── */
  { id: 'custom-links', label: 'Custom Link Manager', category: 'vault',
    hint: 'Save & organize your favorite links',
    keywords: ['bookmarks', 'links', 'shortcuts', 'urls', 'favorites', 'sites', 'web'] },
  { id: 'stats', label: 'Stats & Analytics', category: 'vault',
    hint: 'Your personal metrics & insights',
    keywords: ['analytics', 'stats', 'metrics', 'insights', 'data', 'charts', 'progress', 'numbers'] },

  /* ── System ── */
  { id: 'settings', label: 'Settings', category: null,
    hint: 'Themes, widgets, account & data backup',
    keywords: ['settings', 'preferences', 'theme', 'account', 'config', 'options', 'backup', 'export', 'customize', 'profile'] },
  { id: 'help', label: 'Help', category: null,
    hint: 'Guides, tips & how Zenith works',
    keywords: ['help', 'guide', 'tutorial', 'faq', 'support', 'how to', 'docs', 'getting started'] },
]

/* ── Scoring ─────────────────────────────────────────────────────── */

function scoreEntry(m: ModuleEntry, q: string): number {
  const label = m.label.toLowerCase()
  if (label === q)            return 1000
  if (label.startsWith(q))    return 820
  if (label.includes(q))      return 640

  let best = 0
  for (const k of m.keywords) {
    const kl = k.toLowerCase()
    if (kl === q)            best = Math.max(best, 520)
    else if (kl.startsWith(q)) best = Math.max(best, 420)
    else if (kl.includes(q)) best = Math.max(best, 260)
  }
  if (best) return best

  if (m.id.includes(q)) return 200

  /* Multi-word: every token must appear somewhere in the haystack. */
  const hay    = `${label} ${m.keywords.join(' ')} ${m.hint.toLowerCase()}`
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && tokens.every(t => hay.includes(t))) return 120

  return 0
}

/**
 * Rank all modules against a free-text query.
 * Returns the top `limit` matches, highest score first.
 */
export function searchModules(query: string, limit = 8): ModuleEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MODULE_INDEX
    .map(m => ({ m, score: scoreEntry(m, q) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.m)
}
