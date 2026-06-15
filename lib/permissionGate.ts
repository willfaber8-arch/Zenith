'use client'

/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Permission Gate
 *
 * Centralises one-time browser-permission requests (Notifications,
 * Geolocation) so the user is only ever auto-prompted ONCE per
 * permission, ever. After the first auto-prompt — regardless of the
 * outcome (granted / denied / dismissed) — Zenith never auto-prompts
 * again. The user can still explicitly re-trigger a request from
 * Settings or a feature's "Enable" button.
 *
 * Why: previously useNotifications re-requested whenever the prompt
 * was dismissed (permission stays 'default'), and useDistanceTracker
 * called getCurrentPosition() on every mount — so the browser asked
 * for location on every page load. This module makes the auto-ask
 * a strictly one-shot event tracked in localStorage.
 * ════════════════════════════════════════════════════════════════
 */

const PERMS_KEY = 'zenith_perms_asked_v1'

type PermissionKind = 'notifications' | 'location'

interface AskedRecord {
  notifications?: boolean
  location?: boolean
}

function readAsked(): AskedRecord {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PERMS_KEY)
    return raw ? (JSON.parse(raw) as AskedRecord) : {}
  } catch {
    return {}
  }
}

function writeAsked(rec: AskedRecord): void {
  try {
    localStorage.setItem(PERMS_KEY, JSON.stringify(rec))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** True if Zenith has already auto-prompted for this permission before. */
export function hasAskedFor(kind: PermissionKind): boolean {
  return readAsked()[kind] === true
}

/** Record that we've auto-prompted for this permission (one-shot latch). */
export function markAskedFor(kind: PermissionKind): void {
  const rec = readAsked()
  rec[kind] = true
  writeAsked(rec)
}

/**
 * Should we auto-prompt for this permission on load?
 *
 * Returns true ONLY when:
 *   • we have never auto-asked before, AND
 *   • the underlying permission is still in its undecided state
 *     ('default' for Notifications) — if the user already granted or
 *     denied in the OS/browser, there's nothing to ask.
 */
export function shouldAutoAskNotifications(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (hasAskedFor('notifications')) return false
  return Notification.permission === 'default'
}
