/**
 * lib/copilotTools.ts — AI Co-Pilot agentic tool definitions (pure / isomorphic)
 *
 * This module is SERVER-SAFE: it imports nothing from the DOM or Dexie, so the
 * chat route (`app/api/chat`) can import it to build provider-specific tool
 * schemas. The browser-side execution of these actions lives in
 * `lib/copilotActions.ts`.
 *
 * Cost model: tools are sent on every request (a few hundred input tokens) but
 * there is NO second round-trip — the model emits a tool call, the server
 * appends the parsed calls after ACTION_MARKER, and the client confirms +
 * executes locally against IndexedDB. One API call per user turn, same as a
 * plain chat completion.
 */

/** Sentinel that separates the model's display text from the JSON action list.
 *  Delimited with Unicode Private-Use-Area code points (U+E000) that never
 *  appear in normal model output, so it can never collide with real text. */
export const ACTION_MARKER = 'ZENITH_ACTIONS'

export interface CopilotAction {
  name: string
  args: Record<string, unknown>
}

type ParamType = 'string' | 'number' | 'boolean'

/** Dashboard widget keys the Co-Pilot may toggle (mirrors SandboxConfig). */
export const DASHBOARD_WIDGET_KEYS = [
  'habitSummary', 'pomodoroPreview', 'calendarToday', 'localWeather',
  'studyStreak', 'uniHub', 'cardioSummary', 'letterbox', 'distanceTracker',
  'timerWidget', 'stopwatch', 'readingTracker', 'customLinks', 'vocabTracker',
  'gpaWidget', 'wellnessCheck', 'mealToday', 'newsHeadline', 'arcadeEconomy',
] as const

interface ParamDef {
  type:        ParamType
  description: string
  enum?:       string[]
}

interface ToolDef {
  name:        string
  description: string
  required:    string[]
  params:      Record<string, ParamDef>
}

/* ── Tool catalogue (kept compact — fewer tokens, lower cost) ──────────── */

export const COPILOT_TOOLS: ToolDef[] = [
  {
    name:        'create_habit',
    description: 'Create a new habit for the user to track. Use when they want to start tracking a recurring habit (water, reading, exercise, etc.). Set autoSource to auto-fill the habit from another part of Zenith. Color is inferred automatically from the name and category — do NOT pass a color unless the user explicitly specifies one.',
    required:    ['name'],
    params: {
      name:       { type: 'string', description: 'Short habit name, e.g. "Drink water"' },
      category:   { type: 'string', description: 'Habit category, e.g. "Health", "Fitness", "Mindfulness", "Scholastic", "Finance", "Social", "Creativity", "Life". Defaults to "General".' },
      dailyGoal:  { type: 'number', description: 'Daily target count (default 1), e.g. 8 for 8 glasses of water. For an auto-linked habit this is the goal in that source\'s unit (cardio/study = minutes, vocab = words, mood = check-ins).' },
      stepAmount: { type: 'number', description: 'How much each tap adds toward the daily goal (default 1). E.g. 1 glass at a time → stepAmount=1, dailyGoal=8; 5 minutes at a time → stepAmount=5, dailyGoal=30.' },
      unit:       { type: 'string', description: 'Optional unit label shown per tap, e.g. "glasses", "min", "pages"' },
      autoSource: { type: 'string', description: 'Optional auto-fill link. One of: "cardio" (logging a workout), "study" (finishing a focus block), "vocab" (reviewing words), "mood" (a wellness check-in). Omit for a manually-tracked habit.' },
    },
  },
  {
    name:        'add_calendar_event',
    description: 'Add a personal calendar event (meeting, reminder, appointment).',
    required:    ['title', 'date'],
    params: {
      title:     { type: 'string', description: 'Event title' },
      date:      { type: 'string', description: 'Date in YYYY-MM-DD format' },
      startTime: { type: 'string', description: 'Optional start time HH:MM (24-hour). Omit for an all-day event.' },
      endTime:   { type: 'string', description: 'Optional end time HH:MM (24-hour)' },
      category:  { type: 'string', description: 'Event category', enum: ['personal', 'scholastic', 'exam', 'life', 'general'] },
    },
  },
  {
    name:        'log_cardio',
    description: 'Log a completed cardio / workout session for today and award Vitality Points.',
    required:    ['activity', 'durationMinutes'],
    params: {
      activity:        { type: 'string', description: 'Activity type, e.g. run, walk, bike, swim, row, hike, yoga, elliptical' },
      durationMinutes: { type: 'number', description: 'Session length in minutes' },
      distanceMiles:   { type: 'number', description: 'Optional distance in miles' },
    },
  },
  {
    name:        'create_note',
    description: 'Save a quick note for the user.',
    required:    ['title', 'body'],
    params: {
      title: { type: 'string', description: 'Note title' },
      body:  { type: 'string', description: 'Note content (Markdown allowed)' },
    },
  },
  {
    name:        'add_assignment',
    description: 'Add an academic assignment / task with a due date.',
    required:    ['title', 'dueDate'],
    params: {
      title:    { type: 'string', description: 'Assignment title' },
      dueDate:  { type: 'string', description: 'Due date in YYYY-MM-DD format' },
      priority: { type: 'string', description: 'Urgency', enum: ['low', 'medium', 'high', 'critical'] },
    },
  },
  {
    name:        'add_link',
    description: 'Save a bookmark / quick link to the user\'s Custom Link Manager.',
    required:    ['label', 'url'],
    params: {
      label:       { type: 'string', description: 'Link display name' },
      url:         { type: 'string', description: 'Full URL (https://…)' },
      folder:      { type: 'string', description: 'Optional category/folder name, e.g. "Research", "Tools"' },
      description: { type: 'string', description: 'Optional short description' },
    },
  },
  {
    name:        'add_subscription',
    description: 'Add a recurring subscription / expense to the Subscriptions tracker.',
    required:    ['name', 'cost'],
    params: {
      name:        { type: 'string', description: 'Service name, e.g. "Spotify"' },
      cost:        { type: 'number', description: 'Price per billing period (e.g. 9.99)' },
      billingCycle:{ type: 'string', description: 'Billing cadence', enum: ['MONTHLY', 'ANNUAL'] },
      renewalDate: { type: 'string', description: 'Optional next renewal date YYYY-MM-DD' },
      bundle:      { type: 'string', description: 'Optional grouping bundle, e.g. "Entertainment"' },
    },
  },
  {
    name:        'add_plant',
    description: 'Add a houseplant to the Botanist plant-care tracker.',
    required:    ['name'],
    params: {
      name:             { type: 'string', description: 'Plant name, e.g. "Monstera"' },
      species:          { type: 'string', description: 'Optional scientific name' },
      wateringIntervalDays: { type: 'number', description: 'Days between waterings (default 7)' },
      location:         { type: 'string', description: 'Optional location label, e.g. "Living Room"' },
    },
  },
  {
    name:        'log_mood',
    description: 'Record a Mental Wellness check-in for today.',
    required:    ['stressLevel', 'energyLevel'],
    params: {
      stressLevel: { type: 'number', description: 'Stress level 1 (calm) – 10 (overwhelmed)' },
      energyLevel: { type: 'number', description: 'Energy level 1 (drained) – 10 (energised)' },
      mood:        { type: 'string', description: 'Optional one-word mood label, e.g. "happy", "tired"' },
      notes:       { type: 'string', description: 'Optional short journal note' },
    },
  },
  {
    name:        'add_book',
    description: 'Add a book to the Reading Tracker library.',
    required:    ['title'],
    params: {
      title:      { type: 'string', description: 'Book title' },
      author:     { type: 'string', description: 'Author name' },
      status:     { type: 'string', description: 'Reading status', enum: ['TO_READ', 'CURRENTLY_READING', 'COMPLETED'] },
      totalPages: { type: 'number', description: 'Optional total page count' },
    },
  },
  {
    name:        'add_recipe',
    description: 'Save a recipe to the Meal Planning recipe box.',
    required:    ['title'],
    params: {
      title:       { type: 'string', description: 'Recipe title' },
      category:    { type: 'string', description: 'Optional category, e.g. "Breakfast", "Quick & Easy"' },
      url:         { type: 'string', description: 'Optional source URL' },
      description: { type: 'string', description: 'Optional short description' },
      calories:    { type: 'number', description: 'Optional kcal per serving' },
    },
  },
  {
    name:        'set_dashboard_widget',
    description: 'Show or hide a widget on the user\'s home dashboard. Use this to customise the dashboard layout.',
    required:    ['widget', 'visible'],
    params: {
      widget:  { type: 'string', description: 'Which dashboard widget to toggle', enum: [...DASHBOARD_WIDGET_KEYS] },
      visible: { type: 'boolean', description: 'true to show the widget, false to hide it' },
    },
  },
  {
    name:        'set_profile',
    description: 'Update the user\'s profile: display name, university, or major. Pass only the fields to change.',
    required:    [],
    params: {
      displayName: { type: 'string', description: 'New display name' },
      university:  { type: 'string', description: 'University name, e.g. "Cornell University"' },
      major:       { type: 'string', description: 'Major / field of study, e.g. "Computer Science"' },
    },
  },
  {
    name:        'save_dashboard_preset',
    description: 'Save the current dashboard widget configuration as a named preset so the user can switch back to it later without re-prompting. Call this AFTER any set_dashboard_widget calls in the same batch so the preset captures the final state.',
    required:    ['presetName'],
    params: {
      presetName: { type: 'string', description: 'Short memorable name, e.g. "Finals Week", "Weekend Chill", "Morning Routine"' },
    },
  },
  {
    name:        'load_dashboard_preset',
    description: 'Apply a previously saved dashboard preset by name, restoring its widget visibility configuration instantly.',
    required:    ['presetName'],
    params: {
      presetName: { type: 'string', description: 'Exact name of the saved preset to apply' },
    },
  },
  {
    name:        'add_vocab_word',
    description: 'Add a vocabulary flashcard to the Polyglot Vault spaced-repetition system.',
    required:    ['word', 'translation', 'language'],
    params: {
      word:        { type: 'string', description: 'The foreign word or phrase to learn' },
      translation: { type: 'string', description: 'Native language meaning / translation' },
      language:    { type: 'string', description: 'Target language name, e.g. "Spanish", "French", "Japanese"' },
      phonetic:    { type: 'string', description: 'Optional phonetic spelling or IPA romanization' },
    },
  },
  {
    name:        'add_todo',
    description: 'Add a to-do task item to the Calendar task list.',
    required:    ['title'],
    params: {
      title:    { type: 'string', description: 'Task description, e.g. "Call the dentist"' },
      category: { type: 'string', description: 'Category/list name, e.g. "Errands", "Study", "Short Term"' },
      dueDate:  { type: 'string', description: 'Optional due date YYYY-MM-DD' },
    },
  },
]

const TOOL_NAMES = new Set(COPILOT_TOOLS.map(t => t.name))
export function isKnownAction(name: unknown): name is string {
  return typeof name === 'string' && TOOL_NAMES.has(name)
}

/* ── Provider schema converters ───────────────────────────────────────── */

interface JsonObjectSchema {
  type:       'object'
  properties: Record<string, unknown>
  required:   string[]
  [key: string]: unknown   // satisfies the Anthropic SDK's InputSchema index signature
}

function jsonSchema(t: ToolDef): JsonObjectSchema {
  const properties: Record<string, unknown> = {}
  for (const [key, p] of Object.entries(t.params)) {
    properties[key] = p.enum
      ? { type: p.type, description: p.description, enum: p.enum }
      : { type: p.type, description: p.description }
  }
  return { type: 'object', properties, required: t.required }
}

/** Anthropic Messages API `tools` array. */
export function toAnthropicTools() {
  return COPILOT_TOOLS.map(t => ({
    name:         t.name,
    description:  t.description,
    input_schema: jsonSchema(t),
  }))
}

/** OpenAI Chat Completions `tools` array. */
export function toOpenAITools() {
  return COPILOT_TOOLS.map(t => ({
    type:     'function' as const,
    function: { name: t.name, description: t.description, parameters: jsonSchema(t) },
  }))
}

/** Gemini `tools` array — schema types must be UPPERCASE per the v1beta spec. */
export function toGeminiTools() {
  const declarations = COPILOT_TOOLS.map(t => {
    const properties: Record<string, unknown> = {}
    for (const [key, p] of Object.entries(t.params)) {
      const prop: Record<string, unknown> = { type: p.type.toUpperCase(), description: p.description }
      if (p.enum) prop.enum = p.enum
      properties[key] = prop
    }
    return {
      name:        t.name,
      description: t.description,
      parameters:  { type: 'OBJECT', properties, required: t.required },
    }
  })
  return [{ functionDeclarations: declarations }]
}

/* ── System-prompt addendum (date-aware) ──────────────────────────────── */

export function toolsSystemNote(todayIso: string): string {
  return `

ACTION CAPABILITIES:
You can manage the user's entire Zenith workspace via tools: create_habit, add_calendar_event, log_cardio, create_note, add_assignment, add_link, add_subscription, add_plant, log_mood, add_book, add_recipe, set_dashboard_widget (show/hide home widgets), set_profile (name / university / major), save_dashboard_preset (snapshot current widget config under a name), load_dashboard_preset (apply a saved preset by name), add_vocab_word (add a flashcard to Polyglot Vault), and add_todo (add a task to the Calendar to-do list). When the user asks you to create, add, log, schedule, customise, or set up anything, CALL the matching tool(s) immediately — do NOT ask for permission first and do NOT merely describe how to do it manually.

BATCH SETUP: You can and should emit MULTIPLE tool calls in a single response when the user asks for several things at once (e.g. "set up my dashboard for finals week" → several set_dashboard_widget calls followed by save_dashboard_preset to lock it in). The user sees one confirmation card listing every proposed action and approves them all at once, so batching is preferred over many back-and-forth turns.

PRESETS WORKFLOW: When setting up a named dashboard configuration, always end the batch with save_dashboard_preset so the user can re-apply it any time. When the user mentions a saved preset by name, use load_dashboard_preset to apply it instantly.

The user always sees a confirmation card before anything is saved, so calling tools is safe. Today is ${todayIso}; resolve relative dates ("today", "tomorrow", "this Friday") to an absolute YYYY-MM-DD value. After your tool calls you may add one short sentence of text, but keep it brief.`
}

/* ── Human-readable confirm-card label (pure formatter) ───────────────── */

export function describeAction(a: CopilotAction): string {
  const g = (k: string): string => {
    const v = a.args?.[k]
    return v === undefined || v === null ? '' : String(v)
  }
  switch (a.name) {
    case 'create_habit':
      return `Create habit "${g('name')}"${g('category') ? ` · ${g('category')}` : ''}${g('dailyGoal') ? ` · goal ${g('dailyGoal')}${g('unit') ? ' ' + g('unit') : ''}/day` : ''}${g('stepAmount') && g('stepAmount') !== '1' ? ` · +${g('stepAmount')} per tap` : ''}${g('autoSource') ? ` · auto-fills from ${g('autoSource')}` : ''}`
    case 'add_calendar_event':
      return `Add event "${g('title')}" on ${g('date')}${g('startTime') ? ` at ${g('startTime')}` : ''}`
    case 'log_cardio':
      return `Log ${g('durationMinutes')} min ${g('activity')}${g('distanceMiles') ? ` · ${g('distanceMiles')} mi` : ''}`
    case 'create_note':
      return `Save note "${g('title')}"`
    case 'add_assignment':
      return `Add assignment "${g('title')}" due ${g('dueDate')}${g('priority') ? ` (${g('priority')})` : ''}`
    case 'add_link':
      return `Save link "${g('label')}"${g('folder') ? ` → ${g('folder')}` : ''}`
    case 'add_subscription':
      return `Add subscription "${g('name')}" · $${g('cost')}/${(g('billingCycle') || 'MONTHLY').toLowerCase() === 'annual' ? 'yr' : 'mo'}`
    case 'add_plant':
      return `Add plant "${g('name')}"${g('location') ? ` · ${g('location')}` : ''}`
    case 'log_mood':
      return `Log mood · stress ${g('stressLevel')}/10 · energy ${g('energyLevel')}/10${g('mood') ? ` (${g('mood')})` : ''}`
    case 'add_book':
      return `Add book "${g('title')}"${g('author') ? ` by ${g('author')}` : ''}`
    case 'add_recipe':
      return `Save recipe "${g('title')}"`
    case 'set_dashboard_widget':
      return `${String(a.args?.visible) === 'false' || a.args?.visible === false ? 'Hide' : 'Show'} dashboard widget · ${g('widget')}`
    case 'set_profile': {
      const bits: string[] = []
      if (g('displayName')) bits.push(`name → ${g('displayName')}`)
      if (g('university'))  bits.push(`university → ${g('university')}`)
      if (g('major'))       bits.push(`major → ${g('major')}`)
      return `Update profile${bits.length ? ` · ${bits.join(', ')}` : ''}`
    }
    case 'save_dashboard_preset':
      return `Save dashboard preset "${g('presetName')}"`
    case 'load_dashboard_preset':
      return `Apply dashboard preset "${g('presetName')}"`
    case 'add_vocab_word':
      return `Add vocab word "${g('word')}" (${g('language')}) → "${g('translation')}"`
    case 'add_todo':
      return `Add to-do "${g('title')}"${g('category') ? ` · ${g('category')}` : ''}${g('dueDate') ? ` · due ${g('dueDate')}` : ''}`
    default:
      return a.name
  }
}
