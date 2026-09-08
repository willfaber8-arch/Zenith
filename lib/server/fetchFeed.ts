/**
 * lib/server/fetchFeed.ts — fetch a calendar feed, redirects included.
 *
 * The proxy used to pass `redirect: 'error'`, which makes fetch throw on
 * any 3xx. The reasoning was sound — a redirect can point somewhere the
 * SSRF guard already rejected, so following one blindly would hand an
 * attacker the bypass the guard exists to prevent — but the effect was
 * that no redirecting feed could ever be added, and plenty redirect:
 * published Outlook calendars, several Canvas deployments, and most
 * webcal:// hosts.
 *
 * Refusing every redirect is not the only way to be safe. Following them
 * one at a time, re-running the guard on each destination before going
 * there, gives the same guarantee: every URL this ever fetches has been
 * validated. A hop limit stops a redirect loop from becoming an
 * unbounded walk.
 */

export interface FeedFetchResult {
  ok:       boolean
  status:   number
  /** Present when ok; the response to read the body from. */
  response?: Response
  /** Present when !ok; a sentence explaining what stopped it. */
  reason?:  string
}

export const MAX_REDIRECTS = 5

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

export interface FetchFeedDeps {
  /** Injected so the hop logic can be tested without a network. */
  fetchImpl:  typeof fetch
  /** The same SSRF guard the route uses, re-run on every hop. */
  assertSafe: (url: string) => Promise<{ ok: boolean; reason?: string }>
}

/**
 * Fetch `startUrl`, following redirects only to destinations the guard
 * accepts.
 *
 * Every hop — the first included — is validated before the request is
 * made, so a redirect cannot reach anywhere a direct request could not.
 */
export async function fetchFeedFollowingRedirects(
  startUrl: string,
  deps:     FetchFeedDeps,
  init:     RequestInit = {},
): Promise<FeedFetchResult> {
  let url = startUrl
  const seen = new Set<string>()

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    /* Re-validate at every hop. This is the property that lets us
       follow redirects at all. */
    const safe = await deps.assertSafe(url)
    if (!safe.ok) {
      return { ok: false, status: 400, reason: safe.reason ?? 'URL not permitted' }
    }

    if (seen.has(url)) {
      return { ok: false, status: 508, reason: 'That calendar link redirects in a loop.' }
    }
    seen.add(url)

    const res = await deps.fetchImpl(url, { ...init, redirect: 'manual' })

    if (!REDIRECT_CODES.has(res.status)) {
      return res.ok
        ? { ok: true, status: res.status, response: res }
        : { ok: false, status: 502, reason: `Upstream HTTP ${res.status}` }
    }

    const location = res.headers.get('location')
    if (!location) {
      return { ok: false, status: 502, reason: 'The calendar redirected without saying where.' }
    }

    /* Relative Location headers are legal and common. */
    try {
      url = new URL(location, url).toString()
    } catch {
      return { ok: false, status: 502, reason: 'The calendar redirected somewhere unreadable.' }
    }
  }

  return {
    ok: false,
    status: 508,
    reason: `That calendar link redirected more than ${MAX_REDIRECTS} times.`,
  }
}
