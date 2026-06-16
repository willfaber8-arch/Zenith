/**
 * lib/copilotActions.ts — client-side execution of AI Co-Pilot actions.
 *
 * Runs ONLY in the browser (writes to IndexedDB via Dexie). The model proposes
 * a CopilotAction; after the user confirms in the sidebar, `executeCopilotAction`
 * performs the matching IDB write. Every write is validated here — the model's
 * arguments are treated as untrusted input.
 */

'use client'

import { db } from '@/lib/db'
import type { Priority } from '@/lib/db'
import type { BillingCycle } from '@/types/finance'
import type { ReadingStatus } from '@/types/bookTracker'
import { isKnownAction, DASHBOARD_WIDGET_KEYS, type CopilotAction } from '@/lib/copilotTools'
import { SANDBOX_STORAGE_KEY }                   from '@/lib/hooks/useSandboxConfig'
import { savePreset, findPresetByName, applyPreset } from '@/lib/dashboardPresets'
import type { VocabDeck, VocabCard }              from '@/types/vocabulary'

const WIDGET_KEY_SET = new Set<string>(DASHBOARD_WIDGET_KEYS)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** Validate a YYYY-MM-DD string and return [year, month, day] (month 1-12). */
function parseDate(v: unknown): [number, number, number] {
  const s = str(v)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`Invalid date "${s}" — expected YYYY-MM-DD`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Parse an optional HH:MM time; returns [h, m] or null. */
function parseTime(v: unknown): [number, number] | null {
  const s = str(v)
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

/* ── VP economy helper (localStorage, mirrors WorkoutsView) ───────────── */

function awardVitalityPoints(vp: number): void {
  try {
    const raw = localStorage.getItem('zenith_vitality_v1')
    const cur = raw ? JSON.parse(raw) as { balance?: number; lifetime?: number } : {}
    localStorage.setItem('zenith_vitality_v1', JSON.stringify({
      balance:  (cur.balance ?? 0) + vp,
      lifetime: (cur.lifetime ?? 0) + vp,
    }))
  } catch { /* localStorage unavailable — skip silently */ }
}

/* ── Executor ─────────────────────────────────────────────────────────── */

/**
 * Execute a single confirmed action. Returns a short success message for the
 * UI. Throws (with a user-readable message) on validation or write failure.
 */
export async function executeCopilotAction(action: CopilotAction): Promise<string> {
  if (!db) throw new Error('Local database is not available.')
  if (!isKnownAction(action.name)) throw new Error(`Unknown action: ${action.name}`)

  const a = action.args ?? {}

  switch (action.name) {
    /* ── Habit ──────────────────────────────────────────────────────── */
    case 'create_habit': {
      const name = str(a.name)
      if (!name) throw new Error('A habit needs a name.')
      const goalRaw = num(a.dailyGoal)
      const goal    = Number.isFinite(goalRaw) && goalRaw > 0 ? Math.floor(goalRaw) : 1
      const unit    = str(a.unit) || undefined
      const color   = /^#[0-9a-fA-F]{6}$/.test(str(a.color)) ? str(a.color) : '#7c95ff'

      await db.habits.add({
        name,
        frequency:         'daily',
        activeDays:        [],
        targetCompletions: goal,
        stepAmount:        1,
        stepLabel:         unit,
        streakCount:       0,
        lastCompletedDate: null,
        streakSaveUsed:    false,
        category:          'General',
        color,
        createdAt:         Date.now(),
      })
      return `Created habit "${name}".`
    }

    /* ── Calendar event ─────────────────────────────────────────────── */
    case 'add_calendar_event': {
      const title = str(a.title)
      if (!title) throw new Error('An event needs a title.')
      const [y, mo, d] = parseDate(a.date)
      const start = parseTime(a.startTime)
      const allDay = start === null

      let startMs: number
      let endMs:   number
      if (allDay) {
        startMs = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime()
        endMs   = startMs
      } else {
        startMs = new Date(y, mo - 1, d, start[0], start[1], 0, 0).getTime()
        const end = parseTime(a.endTime)
        endMs = end
          ? new Date(y, mo - 1, d, end[0], end[1], 0, 0).getTime()
          : startMs + 60 * 60 * 1000
      }

      const allowedCats = ['personal', 'scholastic', 'exam', 'life', 'general']
      const category = allowedCats.includes(str(a.category)) ? str(a.category) : 'personal'

      await db.personalEvents.add({
        title,
        startMs,
        endMs,
        allDay:    allDay ? 1 : 0,
        color:     '#7c95ff',
        category,
        createdAt: Date.now(),
      })
      return `Added "${title}" to your calendar.`
    }

    /* ── Cardio session ─────────────────────────────────────────────── */
    case 'log_cardio': {
      const activity = (str(a.activity) || 'other').toLowerCase()
      const mins     = num(a.durationMinutes)
      if (!Number.isFinite(mins) || mins <= 0) throw new Error('Cardio needs a positive duration.')
      const duration = Math.floor(mins)
      const distRaw  = num(a.distanceMiles)
      const distance = Number.isFinite(distRaw) && distRaw > 0 ? distRaw : undefined
      const vp       = duration + (duration >= 30 ? 5 : 0)

      await db.cardioSessions.add({
        activityType:    activity,
        durationMinutes: duration,
        distance,
        distanceUnit:    distance !== undefined ? 'mi' : undefined,
        vitalityEarned:  vp,
        logDate:         todayISO(),
        completedAt:     Date.now(),
      })
      awardVitalityPoints(vp)
      return `Logged ${duration} min of ${activity} (+${vp} VP).`
    }

    /* ── Quick note ─────────────────────────────────────────────────── */
    case 'create_note': {
      const title = str(a.title)
      if (!title) throw new Error('A note needs a title.')
      const body  = typeof a.body === 'string' ? a.body : ''
      await db.quickNotes.add({
        title,
        body,
        category:  'idea',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      })
      return `Saved note "${title}".`
    }

    /* ── Assignment ─────────────────────────────────────────────────── */
    case 'add_assignment': {
      const title = str(a.title)
      if (!title) throw new Error('An assignment needs a title.')
      const [y, mo, d] = parseDate(a.dueDate)
      const dueDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const priorities: Priority[] = ['low', 'medium', 'high', 'critical']
      const priority = priorities.includes(str(a.priority) as Priority)
        ? (str(a.priority) as Priority)
        : 'medium'

      await db.assignments.add({
        title,
        dueDate,
        courseId:  '',
        status:    'pending',
        priority,
        category:  'scholastic',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      return `Added assignment "${title}" (due ${dueDate}).`
    }

    /* ── Custom link / bookmark ─────────────────────────────────────── */
    case 'add_link': {
      const label = str(a.label)
      const url   = str(a.url)
      if (!label) throw new Error('A link needs a label.')
      if (!/^https?:\/\//i.test(url)) throw new Error('A link needs a valid http(s) URL.')
      let host = ''
      try { host = new URL(url).hostname } catch { /* ignore */ }
      await db.customBookmarks.add({
        label,
        url,
        folderName:  str(a.folder) || 'General',
        description: str(a.description) || undefined,
        iconUrl:     host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : undefined,
        addedAt:     Date.now(),
      })
      return `Saved link "${label}".`
    }

    /* ── Subscription ───────────────────────────────────────────────── */
    case 'add_subscription': {
      const name = str(a.name)
      if (!name) throw new Error('A subscription needs a name.')
      const cost = num(a.cost)
      if (!Number.isFinite(cost) || cost < 0) throw new Error('A subscription needs a valid cost.')
      const cycle: BillingCycle = str(a.billingCycle).toUpperCase() === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY'
      let renewal = ''
      if (str(a.renewalDate)) {
        const [y, mo, d] = parseDate(a.renewalDate)
        renewal = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
      await db.subscription_items.add({
        id:                crypto.randomUUID(),
        name,
        monthlyCost:       Math.round(cost * 100) / 100,
        renewalDateString: renewal,
        categoryBundle:    str(a.bundle) || 'General',
        billingCycle:      cycle,
      })
      return `Added subscription "${name}".`
    }

    /* ── Houseplant ─────────────────────────────────────────────────── */
    case 'add_plant': {
      const plantName = str(a.name)
      if (!plantName) throw new Error('A plant needs a name.')
      const intervalRaw = num(a.wateringIntervalDays)
      const interval    = Number.isFinite(intervalRaw) && intervalRaw > 0 ? Math.floor(intervalRaw) : 7
      await db.houseplants.add({
        plantName,
        species:              str(a.species),
        lastWateredDate:      todayISO(),
        wateringIntervalDays: interval,
        location:             str(a.location) || 'Home',
        healthRating:         4,
      })
      return `Added plant "${plantName}".`
    }

    /* ── Mental wellness check-in (one per day — upsert) ────────────── */
    case 'log_mood': {
      const stress = Math.max(1, Math.min(10, Math.round(num(a.stressLevel))))
      const energy = Math.max(1, Math.min(10, Math.round(num(a.energyLevel))))
      if (!Number.isFinite(stress) || !Number.isFinite(energy)) {
        throw new Error('Mood needs stress and energy levels (1–10).')
      }
      const today  = todayISO()
      const fields = {
        logDate:          today,
        stressLevel:      stress,
        energyLevel:      energy,
        qualitativeNotes: str(a.notes),
        moodVector:       str(a.mood) || 'okay',
        createdAt:        Date.now(),
      }
      const existing = await db.mentalHealthLogs.where('logDate').equals(today).first()
      if (existing?.id != null) await db.mentalHealthLogs.update(existing.id, fields)
      else                      await db.mentalHealthLogs.add(fields)
      return `Logged today's wellness check-in.`
    }

    /* ── Library book ───────────────────────────────────────────────── */
    case 'add_book': {
      const title = str(a.title)
      if (!title) throw new Error('A book needs a title.')
      const statuses: ReadingStatus[] = ['TO_READ', 'CURRENTLY_READING', 'COMPLETED']
      const status = statuses.includes(str(a.status) as ReadingStatus)
        ? (str(a.status) as ReadingStatus)
        : 'TO_READ'
      const pagesRaw = num(a.totalPages)
      await db.library_books.add({
        id:            crypto.randomUUID(),
        title,
        author:        str(a.author) || 'Unknown',
        userRating:    0,
        readCount:     status === 'COMPLETED' ? 1 : 0,
        readingStatus: status,
        totalPages:    Number.isFinite(pagesRaw) && pagesRaw > 0 ? Math.floor(pagesRaw) : undefined,
        addedAt:       Date.now(),
      })
      return `Added "${title}" to your library.`
    }

    /* ── Saved recipe ───────────────────────────────────────────────── */
    case 'add_recipe': {
      const title = str(a.title)
      if (!title) throw new Error('A recipe needs a title.')
      const calRaw = num(a.calories)
      await db.savedMealRecipes.add({
        title,
        addedAt:     Date.now(),
        category:    str(a.category) || 'Saved',
        url:         str(a.url) || undefined,
        description: str(a.description) || undefined,
        calories:    Number.isFinite(calRaw) && calRaw > 0 ? Math.floor(calRaw) : undefined,
      })
      return `Saved recipe "${title}".`
    }

    /* ── Dashboard widget toggle (localStorage + live event) ────────── */
    case 'set_dashboard_widget': {
      const widget = str(a.widget)
      if (!WIDGET_KEY_SET.has(widget)) throw new Error(`Unknown dashboard widget: ${widget}`)
      const visible = a.visible === true || str(a.visible).toLowerCase() === 'true'
      try {
        const raw    = localStorage.getItem(SANDBOX_STORAGE_KEY)
        const config = raw ? JSON.parse(raw) as Record<string, boolean> : {}
        config[widget] = visible
        localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(config))
        window.dispatchEvent(new CustomEvent('zenith:sandbox-config-change'))
      } catch {
        throw new Error('Could not update the dashboard layout.')
      }
      return `${visible ? 'Showed' : 'Hid'} the ${widget} widget.`
    }

    /* ── Profile (display name / university / major) ────────────────── */
    case 'set_profile': {
      const changes: Record<string, string> = {}
      if (str(a.displayName)) changes.userName       = str(a.displayName)
      if (str(a.university))  changes.universityName  = str(a.university)
      if (str(a.major))       changes.majorIdentifier = str(a.major)
      if (Object.keys(changes).length === 0) throw new Error('No profile fields to update.')

      const updated = await db.userProfile.update(1, changes)
      if (updated === 0) {
        await db.userProfile.put({
          id:              1,
          userName:        changes.userName ?? '',
          universityName:  changes.universityName ?? '',
          majorIdentifier: changes.majorIdentifier ?? '',
          lastActiveAt:    Date.now(),
        })
      }
      return `Updated your profile.`
    }

    /* ── Save dashboard preset ──────────────────────────────────── */
    case 'save_dashboard_preset': {
      const name = str(a.presetName)
      if (!name) throw new Error('A preset needs a name.')
      const preset = savePreset(name)
      return `Saved dashboard preset "${preset.name}".`
    }

    /* ── Load / apply dashboard preset ─────────────────────────── */
    case 'load_dashboard_preset': {
      const name = str(a.presetName)
      if (!name) throw new Error('A preset name is required.')
      const preset = findPresetByName(name)
      if (!preset) throw new Error(`No preset named "${name}" found. Check the Presets section in Settings.`)
      applyPreset(preset)
      return `Applied dashboard preset "${preset.name}".`
    }

    /* ── Vocab flashcard ────────────────────────────────────────── */
    case 'add_vocab_word': {
      const word        = str(a.word)
      const translation = str(a.translation)
      const language    = str(a.language) || 'General'
      if (!word)        throw new Error('A vocab card needs a word.')
      if (!translation) throw new Error('A vocab card needs a translation.')

      // Find or create the deck for this language.
      const decks    = await db.vocab_decks.toArray()
      const existing = decks.find(d => d.languageName.toLowerCase() === language.toLowerCase())

      let deckId: string
      if (existing) {
        deckId = existing.id
      } else {
        deckId = crypto.randomUUID()
        const deck: VocabDeck = {
          id:           deckId,
          languageName: language,
          description:  '',
          createdAt:    Date.now(),
        }
        await db.vocab_decks.add(deck)
      }

      const card: VocabCard = {
        id:                   crypto.randomUUID(),
        deckId,
        foreignWord:          word,
        nativeTranslation:    translation,
        phoneticSpelling:     str(a.phonetic),
        stabilityFactor:      0,
        easeFactor:           2.5,
        reviewIntervalDays:   1,
        consecutiveSuccesses: 0,
        nextReviewTimestamp:  Date.now(),
      }
      await db.vocab_cards.add(card)
      return `Added "${word}" to your ${language} vocab deck.`
    }

    /* ── To-do item ─────────────────────────────────────────────── */
    case 'add_todo': {
      const title    = str(a.title)
      if (!title) throw new Error('A to-do needs a title.')
      const catName  = str(a.category) || 'General'
      const dueDateStr = str(a.dueDate)

      // Validate optional due date.
      let dueDate: string | undefined
      if (dueDateStr) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDateStr)
        if (!m) throw new Error(`Invalid due date "${dueDateStr}" — expected YYYY-MM-DD`)
        dueDate = dueDateStr
      }

      // Find or create the category.
      const allCats  = await db.todo_categories.toArray()
      const existing = allCats.find(c => c.name.toLowerCase() === catName.toLowerCase())

      let categoryId: number
      if (existing?.id != null) {
        categoryId = existing.id
      } else {
        categoryId = await db.todo_categories.add({
          name:      catName,
          sortOrder: Date.now(),
          createdAt: Date.now(),
        })
      }

      await db.todo_items.add({
        categoryId,
        title,
        completed: 0,
        dueDate,
        createdAt: Date.now(),
      })
      return `Added to-do "${title}"${dueDate ? ` (due ${dueDate})` : ''}.`
    }

    default:
      throw new Error(`Unsupported action: ${action.name}`)
  }
}
