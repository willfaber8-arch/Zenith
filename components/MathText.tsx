/**
 * components/MathText.tsx — inline LaTeX rendering.
 *
 * Renders `$…$` and `$$…$$` inside otherwise-plain text. Lazy: KaTeX and
 * its stylesheet are ~280 kB with fonts, larger than any other chunk in
 * the app, so it is imported dynamically and only lands when something
 * actually containing math is rendered.
 *
 * Fonts are self-hosted from the package, so `font-src 'self'` in the CSP
 * already covers them — no next.config change. That was worth checking
 * rather than assuming: a missing CSP host is precisely what silently
 * broke book-cover fetching.
 */

'use client'

import { useEffect, useState, useMemo, Fragment, type JSX } from 'react'

/** True when there is any math worth loading KaTeX for. */
export function hasMath(text: string): boolean {
  return /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(text)
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

/**
 * Split text into prose and math runs.
 *
 * `$$…$$` is matched before `$…$` so a display block is not mistaken for
 * two adjacent inline spans. An unmatched `$` stays literal — someone
 * writing about money should not have the rest of their note swallowed.
 */
export function splitMath(text: string): Segment[] {
  const out: Segment[] = []
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'math', value: m[1], display: true })
    else                    out.push({ kind: 'math', value: m[2], display: false })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) })
  return out
}

/* Module-level so the import is shared across every instance and only
   ever happens once per session. */
type KatexModule = typeof import('katex')
let katexPromise: Promise<KatexModule> | null = null

function loadKatex(): Promise<KatexModule> {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      // @ts-expect-error — CSS import has no type declaration
      import('katex/dist/katex.min.css'),
    ]).then(([mod]) => {
      /* katex ships both a default export and named exports depending on
         the bundler's interop; take whichever actually carries
         renderToString rather than guessing. */
      const candidate = (mod as unknown as { default?: unknown }).default ?? mod
      return candidate as KatexModule
    })
  }
  return katexPromise
}

export default function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitMath(text), [text])
  const needsMath = useMemo(() => segments.some(s => s.kind === 'math'), [segments])

  const [katex, setKatex] = useState<KatexModule | null>(null)

  useEffect(() => {
    if (!needsMath) return
    let cancelled = false
    void loadKatex().then(k => { if (!cancelled) setKatex(k) })
    return () => { cancelled = true }
  }, [needsMath])

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <Fragment key={i}>{seg.value}</Fragment>

        /* Until KaTeX lands, show the source. Better than a blank gap or
           a spinner — the raw LaTeX is still readable, and the swap is
           imperceptible on a warm cache. */
        if (!katex) {
          return (
            <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>
              {seg.display ? `$$${seg.value}$$` : `$${seg.value}$`}
            </code>
          )
        }

        let html: string
        try {
          html = katex.renderToString(seg.value, {
            displayMode: seg.display,
            throwOnError: false,   // malformed input renders in red, not blank
            output: 'html',
          })
        } catch {
          return (
            <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>
              {seg.value}
            </code>
          )
        }

        /* KaTeX output is generated from the expression by KaTeX itself,
           not passed through from anywhere else, and throwOnError:false
           means malformed input yields an error node rather than raw
           markup. */
        const Tag = (seg.display ? 'div' : 'span') as keyof JSX.IntrinsicElements
        return <Tag key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </span>
  )
}
