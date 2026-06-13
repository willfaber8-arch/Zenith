import { NextRequest, NextResponse } from 'next/server'

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

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only http/https URLs allowed' }, { status: 400 })
  }

  let html: string
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZenithOS/1.0; +recipe-import)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(9_000),
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
