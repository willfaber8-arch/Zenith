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

type ParamType = 'string' | 'number'

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
    description: 'Create a new habit for the user to track. Use when they want to start tracking a recurring habit (water, reading, exercise, etc.).',
    required:    ['name'],
    params: {
      name:      { type: 'string', description: 'Short habit name, e.g. "Drink water"' },
      dailyGoal: { type: 'number', description: 'Daily target count (default 1), e.g. 8 for 8 glasses of water' },
      unit:      { type: 'string', description: 'Optional unit label shown per tap, e.g. "glasses", "min", "pages"' },
      color:     { type: 'string', description: 'Optional hex accent colour like #7c95ff' },
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
You can take actions directly in the user's Zenith dashboard via these tools: create_habit, add_calendar_event, log_cardio, create_note, add_assignment. When the user asks you to create, add, log, or schedule something, CALL the matching tool immediately — do NOT ask for permission first and do NOT just describe how to do it manually. The user always sees a confirmation card before anything is saved, so calling a tool is safe. Today is ${todayIso}; resolve relative dates ("today", "tomorrow", "this Friday") to an absolute YYYY-MM-DD value. After a tool call you may add one short sentence of text, but keep it brief.`
}

/* ── Human-readable confirm-card label (pure formatter) ───────────────── */

export function describeAction(a: CopilotAction): string {
  const g = (k: string): string => {
    const v = a.args?.[k]
    return v === undefined || v === null ? '' : String(v)
  }
  switch (a.name) {
    case 'create_habit':
      return `Create habit "${g('name')}"${g('dailyGoal') ? ` · goal ${g('dailyGoal')}${g('unit') ? ' ' + g('unit') : ''}/day` : ''}`
    case 'add_calendar_event':
      return `Add event "${g('title')}" on ${g('date')}${g('startTime') ? ` at ${g('startTime')}` : ''}`
    case 'log_cardio':
      return `Log ${g('durationMinutes')} min ${g('activity')}${g('distanceMiles') ? ` · ${g('distanceMiles')} mi` : ''}`
    case 'create_note':
      return `Save note "${g('title')}"`
    case 'add_assignment':
      return `Add assignment "${g('title')}" due ${g('dueDate')}${g('priority') ? ` (${g('priority')})` : ''}`
    default:
      return a.name
  }
}
