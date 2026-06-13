/**
 * GET /api/world-news
 *
 * Aggregates world-news headlines from three RSS feeds that provide
 * reliable international coverage with a broadly center / center-left
 * editorial perspective:
 *
 *   • BBC World News  — UK public broadcaster, international focus
 *   • NPR World News  — US public radio, international desk
 *   • The Guardian World — UK broadsheet, international coverage
 *
 * Returns up to 25 articles sorted by publication date (newest first).
 * Response is cached at the Next.js edge layer for 10 minutes so the page
 * renders quickly after the first warm-up hit.
 */

import { NextResponse } from 'next/server'

export const revalidate = 600   // 10-minute edge cache

/* ── Types ──────────────────────────────────────────────────────── */

export interface NewsArticle {
  title:        string
  url:          string
  source:       string
  pubDate:      string      // ISO 8601 string, or raw feed date if unparseable
  pubMs:        number      // Unix ms (for client-side sorting)
  description?: string
}

/* ── Feed registry ──────────────────────────────────────────────── */

interface FeedDef {
  url:    string
  source: string
}

const FEEDS: readonly FeedDef[] = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',      source: 'BBC World'    },
  { url: 'https://feeds.npr.org/1004/rss.xml',               source: 'NPR World'    },
  { url: 'https://www.theguardian.com/world/rss',            source: 'The Guardian' },
]

/* ── XML helpers ────────────────────────────────────────────────── */

/** Extracts the inner text of the first occurrence of <tag>…</tag>,
 *  handling optional CDATA wrappers. */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    'i',
  )
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

/** Decodes the most common HTML entities found in RSS feed content. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')          // strip numeric entities
    .replace(/<[^>]+>/g, '')         // strip any leftover HTML tags
    .trim()
}

/** Parses all <item> elements from a raw RSS/Atom XML string. */
function parseRSSItems(xml: string, source: string): NewsArticle[] {
  const items: NewsArticle[] = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]

    const title       = extractTag(block, 'title')
    const rawLink     = extractTag(block, 'link')
    const pubDateStr  = extractTag(block, 'pubDate') ?? extractTag(block, 'dc:date') ?? ''
    const description = extractTag(block, 'description')

    if (!title || !rawLink) continue

    // Some feeds embed a <guid> as the link; prefer the <link> tag text
    const url = rawLink.startsWith('http') ? rawLink : ''
    if (!url) continue

    const pubMs = pubDateStr ? (new Date(pubDateStr).getTime() || 0) : 0

    items.push({
      title:       decodeEntities(title),
      url:         url.trim(),
      source,
      pubDate:     pubMs > 0 ? new Date(pubMs).toISOString() : pubDateStr,
      pubMs,
      description: description
        ? decodeEntities(description).slice(0, 240)
        : undefined,
    })
  }

  return items
}

/* ── Handler ────────────────────────────────────────────────────── */

export async function GET(): Promise<NextResponse> {
  const settled = await Promise.allSettled(
    FEEDS.map(({ url, source }) =>
      fetch(url, {
        headers: { 'User-Agent': 'ZenithOS/1.0 (news aggregator)' },
        next:    { revalidate: 600 },
      })
        .then(r => r.text())
        .then(xml => parseRSSItems(xml, source)),
    ),
  )

  const articles: NewsArticle[] = settled
    .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
    .filter(a => a.pubMs > 0)
    .sort((a, b) => b.pubMs - a.pubMs)
    .slice(0, 30)

  if (articles.length === 0) {
    return NextResponse.json(
      { error: 'No articles available — all feeds may be temporarily unreachable.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ articles })
}
