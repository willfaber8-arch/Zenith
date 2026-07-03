/**
 * Zenith OS — safe external URL helpers
 *
 * User-entered URLs (custom links, recipe imports) and data restored from
 * backup JSON are untrusted: rendering them directly into an <a href> would
 * execute `javascript:` / `data:` URLs on click. These helpers restrict
 * external links to http(s) everywhere user-controlled URLs are rendered.
 */

/** Href-safe form of an untrusted URL: http(s) passes through, scheme-less
 *  input gets https:// prepended, anything else collapses to '#'. */
export function safeExternalHref(raw: string | null | undefined): string {
  const url = (raw ?? '').trim()
  if (!url) return '#'
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '#'
  } catch {
    // No scheme — treat as a bare domain/path and force https.
    // Reject strings that still smuggle a scheme-ish prefix (e.g. "java\tscript:").
    if (/^[\w.-]+(\/|$|\?|#)/.test(url)) {
      try {
        const u = new URL(`https://${url}`)
        return u.protocol === 'https:' ? u.href : '#'
      } catch { return '#' }
    }
    return '#'
  }
}

/** Normalise a URL for storage: returns the https-forced form, or null when
 *  the input can't be made into a safe http(s) URL. */
export function normalizeExternalUrl(raw: string): string | null {
  const href = safeExternalHref(raw)
  return href === '#' ? null : href
}
