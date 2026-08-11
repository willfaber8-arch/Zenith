/**
 * lib/googleBooksKey.ts — optional Google Books API key.
 *
 * The un-keyed Books endpoint shares one modest daily allowance across
 * everyone on an IP, and it is the ceiling a library of any size runs
 * into: a shelf of twenty books can spend it in a single afternoon, and
 * after that every lookup comes back 403 with no way to tell that apart
 * from "this book has no cover".
 *
 * A key moves the allowance to the user's own project. Blank is a
 * perfectly good configuration and stays the default — cover art still
 * resolves through Open Library first, which has no key and no quota
 * worth worrying about.
 *
 * Stored locally, never sent anywhere but Google, and deliberately kept
 * out of IndexedDB so it never lands in a JSON backup the user might
 * share. Same reasoning as the AI provider key in `useAiConfig`.
 */

'use client'

const STORAGE_KEY = 'zenith_google_books_key_v1'

/** Fired after a change so open views can re-read without a reload. */
export const GOOGLE_KEY_EVENT = 'zenith:google-books-key'

/** The key, or '' when unset. Safe to call during SSR. */
export function getGoogleBooksKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''                       // private mode / storage disabled
  }
}

export function setGoogleBooksKey(key: string): void {
  if (typeof window === 'undefined') return
  try {
    const clean = key.trim()
    if (clean) localStorage.setItem(STORAGE_KEY, clean)
    else       localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(GOOGLE_KEY_EVENT))
  } catch { /* nothing we can do, and nothing worth breaking over */ }
}

/** `AIza…abcd` — enough to recognise, not enough to leak over a shoulder. */
export function maskGoogleBooksKey(key: string): string {
  if (key.length <= 8) return key ? '•'.repeat(key.length) : ''
  return `${key.slice(0, 4)}${'•'.repeat(6)}${key.slice(-4)}`
}
