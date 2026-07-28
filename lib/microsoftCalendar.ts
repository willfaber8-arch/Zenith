/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Microsoft Calendar Integration
 *
 * Two independent paths for getting a personal event into Microsoft:
 *
 *   1. Instant deep-link  — `outlookComposeUrl(event)` builds an Outlook
 *      web "compose event" URL. Requires ZERO setup or sign-in and works
 *      for every user immediately (opens outlook.live.com in a new tab).
 *
 *   2. Full Graph write   — `pushEventToMicrosoft(event)` signs the user in
 *      via MSAL (popup flow) and POSTs the event straight to their primary
 *      Microsoft 365 / Outlook calendar through Microsoft Graph. This path
 *      is gated behind `NEXT_PUBLIC_MS_CLIENT_ID`; when that env var is
 *      absent every function no-ops or throws a friendly, explanatory Error
 *      and the UI falls back to the instant deep-link above.
 *
 * SSR-safe: the MSAL `PublicClientApplication` is only ever instantiated in
 * the browser (mirrors the lib/supabase.ts lazy-singleton pattern). Never
 * import-and-call these at module scope in a Server Component — call inside
 * event handlers / effects only.
 *
 * Environment variable (add to .env.local):
 *   NEXT_PUBLIC_MS_CLIENT_ID — the Application (client) ID of an Azure
 *   "Single-page application" App registration. It is a PUBLIC client ID
 *   and is safe to expose in the browser bundle.
 * ════════════════════════════════════════════════════════════════
 */

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type Configuration,
} from '@azure/msal-browser'

/* ── Config / feature flag ─────────────────────────────────────── */

/** Azure App registration Application (client) ID — public, safe to expose. */
export const MS_CLIENT_ID = process.env.NEXT_PUBLIC_MS_CLIENT_ID ?? ''

/** True when the direct Microsoft Graph sync path is configured. */
export const isMicrosoftConfigured = Boolean(MS_CLIENT_ID)

/** Delegated Microsoft Graph scopes required to write calendar events. */
export const MS_SCOPES = ['Calendars.ReadWrite', 'User.Read'] as const

const GRAPH_EVENTS_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/events'
const NOT_CONFIGURED_MSG =
  'Direct Microsoft sync is not configured. Ask the admin to set NEXT_PUBLIC_MS_CLIENT_ID — ' +
  'the instant "Add to Outlook" link still works without any setup.'

/* ── Shared event shape (decoupled from the IDB PersonalEvent row) ── */

export interface ExternalCalendarEvent {
  title:        string
  startMs:      number
  endMs:        number
  allDay:       boolean
  description?: string
}

/* ── Lazy, browser-only MSAL singleton ─────────────────────────── */

let _pca: PublicClientApplication | null = null
let _initPromise: Promise<PublicClientApplication> | null = null

/**
 * Returns the initialised MSAL client, creating it on first use.
 * Throws a friendly Error on the server or when unconfigured.
 */
async function getClient(): Promise<PublicClientApplication> {
  if (typeof window === 'undefined') {
    throw new Error('Microsoft Calendar is only available in the browser.')
  }
  if (!isMicrosoftConfigured) {
    throw new Error(NOT_CONFIGURED_MSG)
  }
  if (_pca) return _pca

  if (!_initPromise) {
    const config: Configuration = {
      auth: {
        clientId:    MS_CLIENT_ID,
        authority:   'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    }
    const pca = new PublicClientApplication(config)
    // MSAL v3+ requires an explicit initialize() before any other API call.
    _initPromise = pca.initialize().then(() => {
      _pca = pca
      return pca
    })
  }

  return _initPromise
}

/** Resolves the currently-signed-in account (active, else first cached). */
async function resolveAccount(pca: PublicClientApplication) {
  return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null
}

/* ── Public auth surface ───────────────────────────────────────── */

/**
 * Signs the user in via the MSAL popup flow and returns their username.
 * Throws the friendly "not configured" Error when the client ID is absent.
 */
export async function signInMicrosoft(): Promise<{ username: string }> {
  const pca    = await getClient()
  const result = await pca.loginPopup({ scopes: [...MS_SCOPES] })
  if (result.account) pca.setActiveAccount(result.account)
  return { username: result.account?.username ?? '' }
}

/** Signs the user out via the MSAL popup flow. No-ops when unconfigured. */
export async function signOutMicrosoft(): Promise<void> {
  if (typeof window === 'undefined' || !isMicrosoftConfigured) return
  const pca     = await getClient()
  const account = await resolveAccount(pca)
  await pca.logoutPopup({ account: account ?? undefined })
  pca.setActiveAccount(null)
}

/**
 * Returns the signed-in account, or null when unconfigured / signed out /
 * on the server. Safe to call on mount.
 */
export async function getMicrosoftAccount(): Promise<{ username: string } | null> {
  if (typeof window === 'undefined' || !isMicrosoftConfigured) return null
  try {
    const pca     = await getClient()
    const account = await resolveAccount(pca)
    return account ? { username: account.username } : null
  } catch {
    return null
  }
}

/* ── Token acquisition (silent → popup fallback) ───────────────── */

async function acquireAccessToken(): Promise<string> {
  const pca     = await getClient()
  const account = await resolveAccount(pca)

  // No cached session → interactive sign-in.
  if (!account) {
    const login = await pca.loginPopup({ scopes: [...MS_SCOPES] })
    if (login.account) pca.setActiveAccount(login.account)
    return login.accessToken
  }

  // Prefer silent acquisition; fall back to popup on interaction-required.
  try {
    const silent = await pca.acquireTokenSilent({ scopes: [...MS_SCOPES], account })
    return silent.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const popup = await pca.acquireTokenPopup({ scopes: [...MS_SCOPES], account })
      return popup.accessToken
    }
    // Any other silent failure — try one interactive acquisition before giving up.
    const popup = await pca.acquireTokenPopup({ scopes: [...MS_SCOPES] })
    return popup.accessToken
  }
}

/* ── Graph write ───────────────────────────────────────────────── */

/**
 * Graph dateTime is ISO 8601 WITHOUT a trailing offset — it is paired with an
 * explicit `timeZone` field. All-day events must sit on a midnight boundary,
 * so we emit the event's local calendar date at 00:00:00.
 */
function toGraphDateTime(ms: number, allDay: boolean): string {
  const d = new Date(ms)
  if (allDay) {
    const y   = d.getFullYear()
    const mo  = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${day}T00:00:00`
  }
  return d.toISOString().replace(/\.\d{3}Z$/, '')
}

/**
 * Acquires a token and POSTs the event to the user's primary Microsoft
 * calendar via Microsoft Graph. Throws a clear Error on any failure.
 */
export async function pushEventToMicrosoft(event: ExternalCalendarEvent): Promise<void> {
  if (!isMicrosoftConfigured) throw new Error(NOT_CONFIGURED_MSG)

  const token = await acquireAccessToken()

  const graphBody = {
    subject: event.title,
    body: {
      contentType: 'text',
      content:     event.description ?? '',
    },
    start:   { dateTime: toGraphDateTime(event.startMs, event.allDay), timeZone: 'UTC' },
    end:     { dateTime: toGraphDateTime(event.endMs,   event.allDay), timeZone: 'UTC' },
    isAllDay: event.allDay,
  }

  const res = await fetch(GRAPH_EVENTS_ENDPOINT, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(graphBody),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const payload = await res.json()
      detail = payload?.error?.message ?? ''
    } catch {
      /* non-JSON error body — ignore */
    }
    throw new Error(
      `Microsoft Graph rejected the event (${res.status})${detail ? `: ${detail}` : ''}`,
    )
  }
}

/* ── Instant deep-link (no setup required) ─────────────────────── */

/** Local calendar date as YYYY-MM-DD (used for all-day deep-links). */
function toDateOnly(ms: number): string {
  const d   = new Date(ms)
  const y   = d.getFullYear()
  const mo  = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/**
 * Builds an Outlook web "compose event" deep-link. Works for every user with
 * zero setup — opening it drops them on outlook.live.com with the event
 * pre-filled, ready to save into whichever Microsoft account they're in.
 *
 * Timed events pass full ISO 8601 (UTC) start/end datetimes; all-day events
 * pass date-only values with allday=true.
 */
export function outlookComposeUrl(event: ExternalCalendarEvent): string {
  const params = new URLSearchParams()
  params.set('subject', event.title)
  params.set('body',    event.description ?? '')

  if (event.allDay) {
    params.set('startdt', toDateOnly(event.startMs))
    params.set('enddt',   toDateOnly(event.endMs))
    params.set('allday',  'true')
  } else {
    params.set('startdt', new Date(event.startMs).toISOString())
    params.set('enddt',   new Date(event.endMs).toISOString())
    params.set('allday',  'false')
  }

  params.set('path', '/calendar/action/compose')
  params.set('rru',  'addevent')

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
