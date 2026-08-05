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
import type { ReadingStatus, LibraryBook } from '@/types/bookTracker'
import {
  isKnownAction, isDestructiveName,
  DASHBOARD_WIDGET_KEYS, NAV_MODULE_KEYS, FREE_THEME_IDS,
  type CopilotAction,
} from '@/lib/copilotTools'
import { NAV_HIDDEN_STORAGE_KEY, NAV_VISIBILITY_EVENT } from '@/lib/hooks/useHiddenNavItems'
import { SANDBOX_STORAGE_KEY }                   from '@/lib/hooks/useSandboxConfig'
import { savePreset, findPresetByName, applyPreset } from '@/lib/dashboardPresets'
import { syncHabitSource, isHabitAutoSource }    from '@/lib/habitSync'
import { colorForHabit }                          from '@/lib/habitColors'
import type { VocabDeck, VocabCard }              from '@/types/vocabulary'
import { todayISO, toLocalDateStr } from '@/utils/localDate'

const WIDGET_KEY_SET = new Set<string>(DASHBOARD_WIDGET_KEYS)

/**
 * Hard stop for anything whose name implies data loss.
 *
 * The Co-Pilot has no delete tool and this executor makes no Dexie
 * `.delete()`, `.clear()` or `bulkDelete()` call — removing a habit, book
 * or event is something the user does in that module's own UI, with the
 * row in front of them. This guard exists so that stays true by accident
 * as well as by design: it is checked before the switch, so a destructive
 * tool added later fails loudly here instead of quietly working.
 */
function assertNonDestructive(name: string): void {
  if (isDestructiveName(name)) {
    throw new Error(
      `Refused: "${name}" looks like a destructive action. The assistant cannot ` +
      `delete your data — remove it yourself from that module if you want it gone.`,
    )
  }
}
const NAV_MODULE_SET = new Set<string>(NAV_MODULE_KEYS)
const FREE_THEME_SET = new Set<string>(FREE_THEME_IDS)


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

  /*
   * Destructive-action tripwire. Independent of the tool catalogue on
   * purpose: if someone later adds a `delete_habit` tool, this still
   * refuses to run it until they deliberately come here and reckon with
   * what deletion-by-chatbot means. Belt and braces beside
   * isKnownAction — that one enforces "is this a tool we defined", this
   * one enforces "is this a tool we are willing to run at all".
   */
  assertNonDestructive(action.name)

  if (!isKnownAction(action.name)) throw new Error(`Unknown action: ${action.name}`)

  const a = action.args ?? {}

  switch (action.name) {
    /* ── Habit ──────────────────────────────────────────────────────── */
    case 'create_habit': {
      const name = str(a.name)
      if (!name) throw new Error('A habit needs a name.')
      const goalRaw    = num(a.dailyGoal)
      const goal       = Number.isFinite(goalRaw) && goalRaw > 0 ? Math.floor(goalRaw) : 1
      const stepRaw    = num(a.stepAmount)
      const step       = Number.isFinite(stepRaw) && stepRaw > 0 ? Math.floor(stepRaw) : 1
      const unit       = str(a.unit) || undefined
      const category   = str(a.category) || 'General'
      const linkRaw    = str(a.autoSource).toLowerCase()
      const autoSource = isHabitAutoSource(linkRaw) ? linkRaw : undefined
      // Color is inferred from name + category — model does not emit a hex value.
      const color = colorForHabit(name, category)

      await db.habits.add({
        name,
        frequency:         'daily',
        activeDays:        [],
        targetCompletions: goal,
        stepAmount:        step,
        stepLabel:         unit,
        autoSource,
        streakCount:       0,
        lastCompletedDate: null,
        streakSaveUsed:    false,
        category,
        color,
        createdAt:         Date.now(),
      })
      return autoSource
        ? `Created habit "${name}" (auto-fills from ${autoSource}).`
        : `Created habit "${name}".`
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
      void syncHabitSource('cardio', duration)
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
      void syncHabitSource('mood', 1)
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

    /* ── Enrich an existing library book (AI Librarian autofill) ────── */
    case 'update_book': {
      const title = str(a.title)
      if (!title) throw new Error('A book title is required to update it.')
      const wantAuthor = str(a.author).toLowerCase()

      // Find the matching book: prefer an exact (case-insensitive) title match,
      // otherwise a title `includes` match. When several candidates share a
      // title, disambiguate by author when one was provided.
      const all      = await db.library_books.toArray()
      const titleLc  = title.toLowerCase()
      const exact    = all.filter(b => b.title.toLowerCase() === titleLc)
      const partial  = exact.length ? exact : all.filter(b => b.title.toLowerCase().includes(titleLc))
      if (partial.length === 0) throw new Error(`No book titled "${title}" found in your library.`)

      const target = (wantAuthor
        ? partial.find(b => (b.author ?? '').toLowerCase().includes(wantAuthor))
        : undefined) ?? partial[0]

      // Only fill fields that are currently empty/missing — never overwrite the
      // user's own userRating or readingStatus.
      const updates: Partial<LibraryBook> = {}

      const genre = str(a.genre)
      if (genre && !target.genre) updates.genre = genre

      const series = str(a.series)
      if (series && !target.series) updates.series = series

      const review = str(a.review)
      if (review && !target.customReviewText) updates.customReviewText = review

      const pages = num(a.pages)
      if (Number.isFinite(pages) && pages > 0 && !target.totalPages) {
        updates.totalPages = Math.floor(pages)
      }

      const year = num(a.publicationYear)
      if (Number.isFinite(year) && year > 0 && !target.publicationYear) {
        updates.publicationYear = Math.floor(year)
      }

      const rating = num(a.rating)
      if (Number.isFinite(rating) && rating >= 0 && target.globalRating === undefined) {
        updates.globalRating = Math.round(Math.min(5, Math.max(0, rating)) * 100) / 100
      }

      /* ISBN — the key cover art is fetched by, so a Goodreads row that
         imported without one can start resolving artwork once the
         Librarian supplies it. Validated to 10 or 13 digits: a malformed
         value would be cached and then quietly fail every lookup. */
      const isbnRaw = str(a.isbn13).replace(/[^0-9Xx]/g, '')
      let clearCoverCache = false
      if ((isbnRaw.length === 10 || isbnRaw.length === 13) && !target.isbn13) {
        updates.isbn13 = isbnRaw
        /* Re-arm the automatic cover sweep for this book. Without it the row
           keeps the null it resolved before the ISBN existed, and the new
           ISBN is never actually used for anything. */
        clearCoverCache = true
      }

      const filled = Object.keys(updates)
      if (filled.length === 0) {
        return `"${target.title}" already has those details — nothing to fill.`
      }
      await db.library_books.update(target.id, updates)

      /*
       * Deleting the cover-cache keys needs `modify`, not `update`.
       *
       * Dexie's update() IGNORES a property whose value is undefined — it
       * does not delete the key. Passing { coverUrl: undefined } therefore
       * left the old `null` in place, so the book kept its "checked, no
       * artwork" verdict and the sweep (which only revisits rows where
       * coverUrl is undefined) skipped it forever. The whole point of
       * researching the ISBN was to get that book another attempt.
       */
      if (clearCoverCache) {
        await db.library_books
          .where('id').equals(target.id)
          .modify(row => {
            delete (row as Partial<LibraryBook>).coverUrl
            delete (row as Partial<LibraryBook>).coverCheckedAt
          })
      }

      return `Filled in ${filled.length} detail${filled.length > 1 ? 's' : ''} for "${target.title}".`
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

    /* ── Sidebar module visibility ──────────────────────────────── */
    case 'set_nav_visibility': {
      const module = str(a.module)
      if (!NAV_MODULE_SET.has(module)) throw new Error(`Unknown sidebar module: ${module}`)
      const visible = a.visible === true || str(a.visible).toLowerCase() === 'true'
      try {
        const raw    = localStorage.getItem(NAV_HIDDEN_STORAGE_KEY)
        const hidden = new Set<string>(raw ? JSON.parse(raw) as string[] : [])
        if (visible) hidden.delete(module); else hidden.add(module)
        localStorage.setItem(NAV_HIDDEN_STORAGE_KEY, JSON.stringify([...hidden]))
        // useHiddenNavItems reads once on mount, so without this the sidebar
        // would keep showing its stale snapshot until a reload.
        window.dispatchEvent(new CustomEvent(NAV_VISIBILITY_EVENT))
      } catch {
        throw new Error('Could not update the sidebar.')
      }
      return `${visible ? 'Showed' : 'Hid'} ${module} in the sidebar.`
    }

    /* ── Free colour theme ──────────────────────────────────────── */
    case 'set_theme': {
      const theme = str(a.theme)
      // The enum is the guard, not the model: setActiveTheme does not check
      // ownership, so a hallucinated paid id would hand out a cosmetic the
      // user never bought.
      if (!FREE_THEME_SET.has(theme)) {
        throw new Error(`"${theme}" is not a free theme — paid themes are bought with ✦ credits in the Arcade.`)
      }
      const { setActiveTheme } = await import('@/lib/gamesDb')
      await setActiveTheme(theme)
      return `Applied the ${theme} theme.`
    }

    default:
      throw new Error(`Unsupported action: ${action.name}`)
  }
}
