import { NextRequest, NextResponse } from 'next/server'
import { assertSafePublicUrl } from '@/lib/server/ssrfGuard'
import { rateLimit, clientIp } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

/* ── HTML entity decoder ─────────────────────────────────────── */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi,  '&')
    .replace(/&lt;/gi,   '<')
    .replace(/&gt;/gi,   '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi,  "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

/* ── Meta tag extractor ──────────────────────────────────────── */
function extractMeta(html: string, name: string): string {
  // property="..." or name="..." with content="..."
  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i')
  return r1.exec(html)?.[1] ?? r2.exec(html)?.[1] ?? ''
}

/* ── POST /api/recipe-import ─────────────────────────────────── */
export async function POST(req: NextRequest) {
  /* 0 — Throttle per client IP (best-effort, per-instance) */
  const limit = rateLimit(`recipe-import:${clientIp(req)}`, 15, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  /* Reject oversized bodies before parsing */
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > 4_000) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  let url: string
  try {
    const body = await req.json()
    url = body?.url ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  /* SSRF guard — protocol, port, credentials, and private-IP resolution check */
  const safe = await assertSafePublicUrl(url)
  if (!safe.ok) {
    return NextResponse.json({ error: safe.reason ?? 'URL not permitted' }, { status: 400 })
  }

  const parsed = new URL(url)

  let html: string
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZenithOS/1.0; +recipe-import)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      redirect: 'error',                     // a redirect could bypass the SSRF check
      signal:   AbortSignal.timeout(9_000),
    })
    if (!resp.ok) {
      return NextResponse.json({ error: `Site returned ${resp.status}` }, { status: 502 })
    }
    // Read only first 150 KB to stay fast
    const reader = resp.body?.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    if (reader) {
      while (totalBytes < 150_000) {
        const { done, value } = await reader.read()
        if (done || !value) break
        chunks.push(value)
        totalBytes += value.byteLength
      }
      reader.cancel()
    }
    html = new TextDecoder().decode(
      chunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c }, new Uint8Array(0)),
    )
  } catch {
    return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 502 })
  }

  /* Extract title */
  const ogTitle   = decodeEntities(extractMeta(html, 'og:title')).trim()
  const rawTitle  = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1] ?? ''
  const title     = (ogTitle || decodeEntities(rawTitle).trim()).slice(0, 120)

  /* Extract description */
  const ogDesc    = decodeEntities(extractMeta(html, 'og:description')).trim()
  const metaDesc  = decodeEntities(extractMeta(html, 'description')).trim()
  const description = (ogDesc || metaDesc).slice(0, 300)

  /* Try to detect site-level cuisine/category hint from URL */
  const domain = parsed.hostname.replace(/^www\./, '')

  return NextResponse.json({ title, description, domain, url })
}
