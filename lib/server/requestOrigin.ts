/**
 * The origin the browser actually used to reach us.
 *
 * `req.nextUrl.origin` is the origin the *server* sees, which behind a
 * proxy is often `http://localhost:3000`. Strava compares the redirect
 * URI against the registered callback domain and rejects a mismatch, so
 * the forwarded headers win when they are present.
 *
 * Only ever use this for the OAuth redirect_uri, never to build a
 * redirect we perform ourselves: `x-forwarded-host` is a request header
 * and anyone can send one. A forged value here is harmless because
 * Strava refuses any callback domain but the registered one, whereas
 * feeding it to `NextResponse.redirect` would be an open redirect. Our
 * own redirects use `req.nextUrl.origin`, which the client cannot set.
 */

import type { NextRequest } from 'next/server'

export function requestOrigin(req: NextRequest): string {
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto')
             ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  return host ? `${proto}://${host}` : req.nextUrl.origin
}
