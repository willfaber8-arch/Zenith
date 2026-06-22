'use client'

import { useState, useRef, useEffect } from 'react'
import { useAiConfig } from '@/lib/hooks/useAiConfig'
import styles from './PersonalBrandView.module.css'

/* ── Career resource links ──────────────────────────────────────── */

interface CareerLink {
  name:        string
  url:         string
  description: string
  tag:         string
  icon:        string
}

const CAREER_LINKS: CareerLink[] = [
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com',
    description: 'Build your professional network and showcase your experience.',
    tag: 'Networking',
    icon: '💼',
  },
  {
    name: 'Handshake',
    url: 'https://joinhandshake.com',
    description: 'Early-career job platform connecting students with employers.',
    tag: 'Jobs',
    icon: '🤝',
  },
  {
    name: 'Indeed',
    url: 'https://www.indeed.com',
    description: 'Comprehensive job search across millions of listings.',
    tag: 'Jobs',
    icon: '🔍',
  },
  {
    name: 'Glassdoor',
    url: 'https://www.glassdoor.com',
    description: 'Company reviews, salaries, and interview insights.',
    tag: 'Research',
    icon: '🏢',
  },
  {
    name: 'Wellfound (AngelList)',
    url: 'https://wellfound.com',
    description: 'Startup jobs and tech company opportunities.',
    tag: 'Startups',
    icon: '🚀',
  },
  {
    name: 'Canva',
    url: 'https://www.canva.com',
    description: 'Design your resume, portfolio, and personal brand materials.',
    tag: 'Design',
    icon: '🎨',
  },
  {
    name: 'Notion',
    url: 'https://www.notion.so',
    description: 'Build a public portfolio or personal landing page.',
    tag: 'Portfolio',
    icon: '📄',
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    description: 'Showcase your code projects and open-source contributions.',
    tag: 'Portfolio',
    icon: '🐙',
  },
  {
    name: 'Resume.io',
    url: 'https://resume.io',
    description: 'Professional resume builder with recruiter-ready templates.',
    tag: 'Resume',
    icon: '📝',
  },
  {
    name: 'Levels.fyi',
    url: 'https://www.levels.fyi',
    description: 'Tech compensation data — know your worth before negotiating.',
    tag: 'Research',
    icon: '📊',
  },
  {
    name: 'Y Combinator Jobs',
    url: 'https://www.ycombinator.com/jobs',
    description: 'Jobs at YC-backed companies — high growth opportunities.',
    tag: 'Startups',
    icon: '🍊',
  },
  {
    name: 'Loom',
    url: 'https://www.loom.com',
    description: 'Record async video pitches or portfolio walkthroughs.',
    tag: 'Portfolio',
    icon: '🎥',
  },
]

const TAGS = ['All', ...Array.from(new Set(CAREER_LINKS.map(l => l.tag)))]

/* ── Post tones ─────────────────────────────────────────────────── */

const TONES = ['Professional', 'Casual', 'Storytelling', 'Motivational'] as const
type Tone = typeof TONES[number]

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function PersonalBrandView() {
  const { authHeaders, config, mounted: aiMounted } = useAiConfig()
  const [activeTag, setActiveTag] = useState('All')

  /* ── LinkedIn generator state ───────────────────────────────── */
  const [writingStyle,  setWritingStyle]  = useState('')
  const [topic,         setTopic]         = useState('')
  const [tone,          setTone]          = useState<Tone>('Professional')
  const [generatedPost, setGeneratedPost] = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState<string | null>(null)
  const [copied,        setCopied]        = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    setGenError(null)
    setGeneratedPost('')
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const styleHint = writingStyle.trim()
      ? `My writing style sample: "${writingStyle.slice(0, 400)}"\n\n`
      : ''

    const systemMsg = `You are an expert LinkedIn content strategist. Write a compelling LinkedIn post in a ${tone.toLowerCase()} tone. ${styleHint ? 'Match the user\'s writing style closely.' : 'Use a natural, authentic voice.'} Keep it under 280 words. Use line breaks for readability. Do not use generic phrases like "I\'m excited to share". Do not include hashtags unless the user asks.`

    const userMsg = `${styleHint}Write a LinkedIn post about: ${topic}`

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({
          messages: [{ role: 'user', content: userMsg }],
          contextPayload: { systemPrompt: systemMsg },
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setGeneratedPost(prev => prev + chunk)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenError(err instanceof Error ? err.message : 'Generation failed')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(generatedPost)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = activeTag === 'All'
    ? CAREER_LINKS
    : CAREER_LINKS.filter(l => l.tag === activeTag)

  return (
    <div className={styles.root}>

      {/* ── Career Resources ──────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Career Resources</h2>
          <div className={styles.tagFilter}>
            {TAGS.map(tag => (
              <button
                key={tag}
                className={`${styles.tagBtn} ${activeTag === tag ? styles.tagBtnActive : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.linkGrid}>
          {filtered.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkCard}
            >
              <div className={styles.linkCardTop}>
                <span className={styles.linkIcon}>{link.icon}</span>
                <span className={styles.linkTag}>{link.tag}</span>
              </div>
              <p className={styles.linkName}>{link.name}</p>
              <p className={styles.linkDesc}>{link.description}</p>
              <span className={styles.linkAction}>Open →</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── LinkedIn Post Generator ───────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>LinkedIn Post Generator</h2>
          <p className={styles.sectionSubtitle}>
            Paste a sample of your writing so the AI can match your voice, then describe what you want to post about.
          </p>
        </div>

        <div className={styles.generatorLayout}>
          {/* Inputs */}
          <div className={styles.generatorInputs}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Your Writing Style Sample <span className={styles.labelHint}>(optional)</span></label>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder="Paste a paragraph or two from a past post, bio, or email so the AI can match your tone…"
                value={writingStyle}
                onChange={e => setWritingStyle(e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>What do you want to post about? <span className={styles.labelRequired}>*</span></label>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="e.g. I just completed my first machine learning project using PyTorch…"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Tone</label>
              <div className={styles.toneRow}>
                {TONES.map(t => (
                  <button
                    key={t}
                    className={`${styles.toneBtn} ${tone === t ? styles.toneBtnActive : ''}`}
                    onClick={() => setTone(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={styles.generateBtn}
              onClick={() => void handleGenerate()}
              disabled={!topic.trim() || generating || (aiMounted && !config.userApiKey)}
            >
              {generating ? (
                <><span className={styles.generating} /> Generating…</>
              ) : (
                '✦ Generate Post'
              )}
            </button>
          </div>

          {/* Output */}
          <div className={styles.generatorOutput}>
            <div className={styles.outputHeader}>
              <span className={styles.outputLabel}>Generated Post</span>
              {generatedPost && !generating && (
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
              )}
            </div>
            <div className={styles.outputBox}>
              {aiMounted && !config.userApiKey ? (
                <div className={styles.noKeyNotice}>
                  <span className={styles.noKeyGlyph}>◈</span>
                  <p>
                    Add your API key in <strong>Settings → AI Provider</strong> to generate posts.
                    Google Gemini has a free tier — no credit card needed.
                  </p>
                </div>
              ) : generatedPost ? (
                <p className={styles.outputText}>{generatedPost}{generating && <span className={styles.cursor} />}</p>
              ) : generating ? (
                <p className={styles.outputPlaceholder}><span className={styles.cursor} /></p>
              ) : genError ? (
                <p className={styles.outputError}>⚠ {genError}</p>
              ) : (
                <p className={styles.outputPlaceholder}>
                  Your generated post will appear here. Fill in the topic and click Generate.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
