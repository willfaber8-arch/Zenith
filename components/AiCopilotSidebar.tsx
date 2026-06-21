/**
 * components/AiCopilotSidebar.tsx — AI Academic Co-Pilot
 * Phase 7 · Step 7.1
 *
 * Slide-over chat panel.  Architecture:
 *
 *   1. On first open, calls compileUserContextPayload() to pull 14-day
 *      assignment velocity, habit streaks, and mood vectors from IDB.
 *   2. Injects the compiled snapshot into POST /api/chat as a background
 *      system context extension — never echoed back to the browser.
 *   3. Streams the Anthropic response as raw UTF-8 chunks into the message
 *      thread in real time.
 *   4. All Markdown rendering is handled by the local MarkdownBlock
 *      component (zero external libraries).
 *
 * Z-index: 300 — above StudyLayoutContainer (200) and well below Toast (600).
 */

'use client'

import {
  useState, useEffect, useRef, useCallback,
  type JSX, type KeyboardEvent, type ChangeEvent,
} from 'react'
import { useCopilot }     from '@/lib/CopilotContext'
import { useAuth }        from '@/lib/AuthContext'
import { useToast }       from '@/lib/ToastContext'
import { useAiConfig }    from '@/lib/hooks/useAiConfig'
import {
  compileUserContextPayload,
  type UserContextPayload,
} from '@/utils/aiContextBridge'
import {
  ACTION_MARKER, describeAction, type CopilotAction,
} from '@/lib/copilotTools'
import { executeCopilotAction } from '@/lib/copilotActions'
import styles from './AiCopilotSidebar.module.css'

/* ══════════════════════════════════════════════════════════════
   1. TYPES
   ══════════════════════════════════════════════════════════════ */

type ActionState = 'pending' | 'running' | 'done' | 'cancelled'

interface ChatMsg {
  id:           string
  role:         'user' | 'assistant'
  content:      string
  isStreaming:  boolean
  actions?:     CopilotAction[]   // proposed agentic actions awaiting confirmation
  actionState?: ActionState
  actionResult?: string           // success / error summary after execution
}

type ApiMsg = { role: 'user' | 'assistant'; content: string }

type ContextStatus = 'idle' | 'compiling' | 'ready' | 'error'

/* ══════════════════════════════════════════════════════════════
   2. LIGHTWEIGHT MARKDOWN RENDERER
   ══════════════════════════════════════════════════════════════ */

/**
 * Parses a line of text and returns an array of React nodes with inline
 * formatting applied: **bold**, *italic*, `inline code`.
 * Precedence: bold > code > italic (left-to-right greedy match).
 */
function inlineFormat(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  // Unified regex — bold first to prevent * ambiguity
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**'))     parts.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) parts.push(<code key={k++} className={styles.inlineCode}>{t.slice(1, -1)}</code>)
    else                        parts.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }

  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

/**
 * Block-level Markdown renderer.  Handles:
 *   ``` fenced code blocks (with optional language label)
 *   ## headings (H1–H3)
 *   --- horizontal rules
 *   - / * / • unordered lists
 *   1. ordered lists
 *   > blockquotes
 *   paragraphs (catch-all)
 *
 * Gracefully handles partial / streaming content — an unclosed code fence
 * is rendered as a pre block with whatever text has arrived so far.
 */
function MarkdownBlock({ text }: { text: string }) {
  const nodes: JSX.Element[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    /* ── Fenced code block ─────────────────────────────────── */
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      // Consume until closing fence (or EOF — handles partial streaming)
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push(
        <pre key={`cb${i}`} className={styles.codeBlock}>
          {lang && <span className={styles.codeLang}>{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
    }

    /* ── Headings (check ### before ## before #) ──────────── */
    else if (line.startsWith('### ')) {
      nodes.push(<h4 key={`h3${i}`} className={styles.mdH3}>{inlineFormat(line.slice(4))}</h4>)
    }
    else if (line.startsWith('## ')) {
      nodes.push(<h3 key={`h2${i}`} className={styles.mdH2}>{inlineFormat(line.slice(3))}</h3>)
    }
    else if (line.startsWith('# ')) {
      nodes.push(<h2 key={`h1${i}`} className={styles.mdH1}>{inlineFormat(line.slice(2))}</h2>)
    }

    /* ── Horizontal rule ──────────────────────────────────── */
    else if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr${i}`} className={styles.mdHr} />)
    }

    /* ── Unordered list — collect consecutive items ────────── */
    else if (/^[-*•] /.test(line)) {
      const items: string[] = [line.replace(/^[-*•] /, '')]
      while (i + 1 < lines.length && /^[-*•] /.test(lines[i + 1])) {
        items.push(lines[++i].replace(/^[-*•] /, ''))
      }
      nodes.push(
        <ul key={`ul${i}`} className={styles.mdList}>
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ul>,
      )
    }

    /* ── Ordered list ──────────────────────────────────────── */
    else if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, '')]
      while (i + 1 < lines.length && /^\d+\. /.test(lines[i + 1])) {
        items.push(lines[++i].replace(/^\d+\. /, ''))
      }
      nodes.push(
        <ol key={`ol${i}`} className={styles.mdList}>
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ol>,
      )
    }

    /* ── Blockquote ───────────────────────────────────────── */
    else if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={`bq${i}`} className={styles.mdBlockquote}>
          {inlineFormat(line.slice(2))}
        </blockquote>,
      )
    }

    /* ── Empty line — skip (block margins provide spacing) ── */
    else if (line.trim() === '') { /* intentional no-op */ }

    /* ── Paragraph (catch-all) ────────────────────────────── */
    else {
      nodes.push(<p key={`p${i}`} className={styles.mdPara}>{inlineFormat(line)}</p>)
    }

    i++
  }

  return <>{nodes}</>
}

/* ══════════════════════════════════════════════════════════════
   3. STATUS CHIP LABELS
   ══════════════════════════════════════════════════════════════ */

const STATUS_LABEL: Record<ContextStatus, string> = {
  idle:      '[ INITIALIZING ]',
  compiling: '[ COMPILING CONTEXT… ]',
  ready:     '[ CO-PILOT CONNECTED · CONTEXT SYNCED ]',
  error:     '[ LOCAL MODE · NO CONTEXT ]',
}

/* ══════════════════════════════════════════════════════════════
   4. MESSAGE BUBBLE
   ══════════════════════════════════════════════════════════════ */

interface MessageBubbleProps {
  msg:        ChatMsg
  onConfirm?: (id: string) => void
  onCancel?:  (id: string) => void
}

function MessageBubble({ msg, onConfirm, onCancel }: MessageBubbleProps) {
  const isUser   = msg.role === 'user'
  const hasText  = msg.content.trim().length > 0
  const actions  = msg.actions ?? []
  const state    = msg.actionState

  return (
    <div className={`${styles.msgRow} ${isUser ? styles.msgRowUser : styles.msgRowAssistant}`}>

      {/* Copilot avatar dot — shown only for assistant turns */}
      {!isUser && <div className={styles.avatarDot} aria-hidden="true" />}

      <div
        className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}
      >
        {isUser
          /* User messages: plain text only */
          ? <p className={styles.mdPara}>{msg.content}</p>
          /* Assistant messages: full markdown rendering */
          : hasText
            ? <MarkdownBlock text={msg.content} />
            : actions.length > 0 && !msg.isStreaming
              ? <p className={styles.mdPara}>I&apos;ve prepared the following:</p>
              : <MarkdownBlock text={msg.content} />
        }

        {/* Streaming cursor — visible only while tokens are arriving */}
        {msg.isStreaming && (
          <span className={styles.cursor} aria-hidden="true">▋</span>
        )}

        {/* ── Agentic action confirmation card ──────────────────── */}
        {!msg.isStreaming && actions.length > 0 && (
          <div className={styles.actionCard}>
            <span className={styles.actionHead}>
              {state === 'done'      ? '✓ COMPLETE'
                : state === 'cancelled' ? '✕ CANCELLED'
                : state === 'running'   ? '◌ SAVING…'
                : `⚡ CONFIRM ${actions.length} ACTION${actions.length > 1 ? 'S' : ''}`}
            </span>

            <ul className={styles.actionList}>
              {actions.map((a, i) => (
                <li key={i} className={styles.actionItem}>{describeAction(a)}</li>
              ))}
            </ul>

            {msg.actionResult && (
              <p className={styles.actionResult}>{msg.actionResult}</p>
            )}

            {(!state || state === 'pending') && (
              <div className={styles.actionBtns}>
                <button
                  type="button"
                  className={styles.actionConfirm}
                  onClick={() => onConfirm?.(msg.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className={styles.actionCancel}
                  onClick={() => onCancel?.(msg.id)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   5. MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function AiCopilotSidebar() {
  const { isOpen, close }   = useCopilot()
  const { session }         = useAuth()
  const { toast }           = useToast()
  const { authHeaders, config, mounted: aiMounted } = useAiConfig()

  /* ── State ─────────────────────────────────────────────────── */
  const [messages,       setMessages]       = useState<ChatMsg[]>([])
  const [input,          setInput]          = useState('')
  const [contextStatus,  setContextStatus]  = useState<ContextStatus>('idle')
  const [contextPayload, setContextPayload] = useState<string | null>(null)
  const [isSubmitting,   setIsSubmitting]   = useState(false)
  const [isListening,    setIsListening]    = useState(false)
  const [interimSpeech,  setInterimSpeech]  = useState('')

  /* ── Refs ──────────────────────────────────────────────────── */
  const threadRef       = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const abortRef        = useRef<AbortController | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null)

  /* ── Compile context on first open ────────────────────────── */
  useEffect(() => {
    if (!isOpen || contextStatus !== 'idle' || !session) return

    setContextStatus('compiling')

    compileUserContextPayload()
      .then((payload: UserContextPayload) => {
        setContextPayload(payload.systemPrompt)
        setContextStatus('ready')

        /* Personalised greeting derived from live IDB stats */
        const { assignmentsPending, assignmentsOverdue, habitCount,
                avgStressLevel, burnoutRisk } = payload.stats

        const lines: string[] = [
          `Context loaded. I can see **${assignmentsPending} active task${assignmentsPending !== 1 ? 's' : ''}**` +
          (assignmentsOverdue > 0 ? ` *(⚠ ${assignmentsOverdue} overdue)*` : '') + `,` +
          ` **${habitCount} habit${habitCount !== 1 ? 's' : ''} tracked**,` +
          ` and a 14-day avg stress of **${avgStressLevel}/10**.`,
        ]

        if (burnoutRisk === 'critical') {
          lines.push(
            `\n⚠ **Burnout risk is critical** — I'll factor recovery headroom into every recommendation.`,
          )
        } else if (burnoutRisk === 'emerging') {
          lines.push(`\n⚡ *Emerging fatigue signal detected — monitor your energy closely.*`)
        }

        lines.push(`\nWhat can I help you with today?`)

        setMessages([{
          id:          crypto.randomUUID(),
          role:        'assistant',
          content:     lines.join(' '),
          isStreaming: false,
        }])
      })
      .catch(() => {
        setContextStatus('error')
        setMessages([{
          id:          crypto.randomUUID(),
          role:        'assistant',
          content:
            'Co-Pilot online in **local mode** — context data is unavailable, ' +
            'but I can still help with academic questions and study strategies.\n\nWhat can I help you with?',
          isStreaming: false,
        }])
      })
  }, [isOpen, contextStatus, session])

  /* ── Auto-scroll to bottom whenever messages update ────────── */
  useEffect(() => {
    if (!threadRef.current) return
    // `instant` prevents scroll jank during rapid streaming updates
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  /* ── Focus textarea when panel opens ───────────────────────── */
  useEffect(() => {
    if (!isOpen) return
    // Delay to avoid conflict with CSS slide transition
    const t = setTimeout(() => textareaRef.current?.focus(), 380)
    return () => clearTimeout(t)
  }, [isOpen])

  /* ── Escape key: close panel ────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  /* ── Textarea: auto-resize up to 128 px ─────────────────────── */
  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [])

  /* ── Clear conversation & reset context ─────────────────────── */
  const handleClear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setContextStatus('idle')
    setContextPayload(null)
    setIsSubmitting(false)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [])

  /* ── Voice / speech-to-text input ───────────────────────────── */
  const handleMicClick = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SpeechRecognitionAPI: any =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!SpeechRecognitionAPI) {
      toast('Speech recognition is not supported in this browser.', 'error')
      return
    }

    const rec = new SpeechRecognitionAPI()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false

    rec.onstart = () => setIsListening(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interim = ''
      let final   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        setInput(prev =>
          prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + final.trim() + ' ',
        )
        setInterimSpeech('')
      } else {
        setInterimSpeech(interim)
      }
    }

    rec.onend = () => {
      setIsListening(false)
      setInterimSpeech('')
      recognitionRef.current = null
    }

    rec.onerror = () => {
      setIsListening(false)
      setInterimSpeech('')
      recognitionRef.current = null
    }

    recognitionRef.current = rec
    rec.start()
  }, [isListening, toast])

  /* ── Stop streaming ──────────────────────────────────────────── */
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsSubmitting(false)
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m))
  }, [])

  /* ── Confirm / cancel agentic actions ───────────────────────── */
  const confirmActions = useCallback(async (msgId: string) => {
    // Read the actions synchronously from the current message list. (A previous
    // version assigned `toRun` inside the setState updater, which React defers
    // to render time — so the early-return below always saw an empty array and
    // the card was left stuck on "SAVING…" without ever running anything.)
    const target = messages.find(m => m.id === msgId)
    const toRun  = target?.actions ?? []
    if (toRun.length === 0) return
    if (target?.actionState && target.actionState !== 'pending') return  // already run / cancelled

    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, actionState: 'running' as ActionState } : m,
    ))

    // Bound each write so a stalled IndexedDB operation (e.g. a DB upgrade
    // blocked by another open Zenith tab) can't freeze the card on "SAVING…"
    // forever — the action surfaces a concrete error instead.
    const withTimeout = (p: Promise<string>, ms: number): Promise<string> =>
      Promise.race([
        p,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(
            'Save timed out — the local database did not respond. If Zenith is open in another tab, close it and reload.',
          )), ms),
        ),
      ])

    const results: string[] = []
    let failures = 0
    for (const a of toRun) {
      try {
        results.push(`✓ ${await withTimeout(executeCopilotAction(a), 10_000)}`)
      } catch (e) {
        failures++
        results.push(`✕ ${e instanceof Error ? e.message : 'Failed to save.'}`)
      }
    }

    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, actionState: 'done' as ActionState, actionResult: results.join('\n') }
        : m,
    ))

    if (failures === 0) {
      toast(`Done — ${toRun.length} action${toRun.length > 1 ? 's' : ''} saved.`, 'success')
    } else {
      toast(`${failures} action${failures > 1 ? 's' : ''} couldn't be saved.`, 'error')
    }
  }, [messages, toast])

  const cancelActions = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, actionState: 'cancelled' as ActionState } : m,
    ))
  }, [])

  /* ── Submit message ──────────────────────────────────────────── */
  /*
   * Design notes:
   *   • history is built from current `messages` + new user turn before
   *     any setState calls — avoids React batching ambiguity.
   *   • Streaming messages are excluded from history (they are incomplete
   *     assistant turns from a previous interrupted call).
   *   • Each streaming chunk is appended via a functional setState update
   *     so rapid chunk arrival never races with stale closures.
   */
  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text || isSubmitting) return

    // Reset input
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
    setIsSubmitting(true)

    const userMsg: ChatMsg = {
      id:          crypto.randomUUID(),
      role:        'user',
      content:     text,
      isStreaming: false,
    }

    const assistantId = crypto.randomUUID()

    // Build API history from settled messages + new user turn
    const history: ApiMsg[] = [
      ...messages
        .filter(m => !m.isStreaming)          // skip any interrupted streams
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    // Add user turn + streaming placeholder atomically
    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ])

    try {
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({
          messages:       history,
          contextPayload: contextPayload ?? undefined,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' }))
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `_Error: ${errBody.error ?? 'Request failed'}_`, isStreaming: false }
            : m,
        ))
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        // Hide any (possibly partial) action sentinel from the visible text —
        // it begins with the marker's first (private-use-area) character.
        const sentinel = full.indexOf(ACTION_MARKER[0])
        const display  = sentinel >= 0 ? full.slice(0, sentinel) : full
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: display } : m,
        ))
      }

      // Split the visible text from the trailing action payload.
      let displayText = full
      let actions: CopilotAction[] = []
      const markerIdx = full.indexOf(ACTION_MARKER)
      if (markerIdx >= 0) {
        displayText = full.slice(0, markerIdx)
        try {
          const parsed = JSON.parse(full.slice(markerIdx + ACTION_MARKER.length))
          if (Array.isArray(parsed)) actions = parsed as CopilotAction[]
        } catch { /* malformed action payload — ignore */ }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content:     displayText.trimEnd(),
              isStreaming: false,
              actions:     actions.length ? actions : undefined,
              actionState: actions.length ? 'pending' : undefined,
            }
          : m,
      ))

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: '_Connection interrupted. Please try again._', isStreaming: false }
          : m,
      ))
    } finally {
      setIsSubmitting(false)
      abortRef.current = null
    }
  }, [input, isSubmitting, messages, contextPayload])

  /* ── Keyboard: Enter to submit, Shift+Enter for newline ────── */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter falls through — browser inserts a newline naturally
  }, [handleSubmit])

  /* ── Auth gate ───────────────────────────────────────────────── */
  if (!session) return null

  const canSend = input.trim().length > 0 && !isSubmitting

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Backdrop (click-outside to close) ─────────────────── */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-over panel ──────────────────────────────────── */}
      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        aria-label="AI Co-Pilot"
        aria-hidden={!isOpen}
        role="complementary"
        inert={!isOpen}
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <header className={styles.header}>

          <div className={styles.headerLeft}>
            <span className={styles.panelTitle}>
              <span className={styles.titleDot} aria-hidden="true" />
              CO-PILOT
            </span>

            <span
              className={styles.statusChip}
              data-status={contextStatus}
              aria-label={`Status: ${contextStatus}`}
            >
              {STATUS_LABEL[contextStatus]}
            </span>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleClear}
              title="New conversation"
              aria-label="New conversation"
            >
              ↺
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={close}
              title="Close Co-Pilot (Esc)"
              aria-label="Close Co-Pilot"
            >
              ✕
            </button>
          </div>

        </header>

        {/* ── Message thread ────────────────────────────────────── */}
        <div
          ref={threadRef}
          className={`${styles.thread} scrollbar-zen`}
          role="log"
          aria-live="polite"
          aria-label="Conversation thread"
        >

          {/* Loading state during context compilation */}
          {messages.length === 0 && contextStatus === 'compiling' && (
            <div className={styles.compiling} aria-label="Compiling context">
              <span className={styles.compilingDot} aria-hidden="true" />
              <span className={styles.compilingText}>Analysing your workspace…</span>
            </div>
          )}

          {/* No API key notice */}
          {aiMounted && !config.userApiKey && (
            <div className={styles.noKeyBanner}>
              <span className={styles.noKeyIcon}>◈</span>
              <div>
                <p className={styles.noKeyTitle}>API key required</p>
                <p className={styles.noKeyBody}>
                  To chat with Zenith AI, add your API key in{' '}
                  <strong>Settings → AI Provider</strong>.
                  Google Gemini has a free tier — no credit card needed.
                </p>
              </div>
            </div>
          )}

          {/* Empty state before first open */}
          {messages.length === 0 && contextStatus === 'idle' && (!aiMounted || config.userApiKey) && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">◎</span>
              <p className={styles.emptyText}>Open to connect with your workspace context.</p>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onConfirm={confirmActions}
              onCancel={cancelActions}
            />
          ))}

        </div>

        {/* ── Input bar ─────────────────────────────────────────── */}
        <div className={styles.inputBar}>

          {/* Interim speech ghost text */}
          {interimSpeech && (
            <p className={styles.interimSpeech} aria-live="polite">
              {interimSpeech}
            </p>
          )}

          <div className={styles.textareaRow}>
            <textarea
              ref={textareaRef}
              className={`${styles.textarea} scrollbar-none`}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening…' : 'Ask about tasks, deadlines, study strategies…'}
              rows={1}
              disabled={isSubmitting}
              aria-label="Message input"
              aria-describedby="copilot-hint"
            />

            <button
              type="button"
              className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
              onClick={handleMicClick}
              title={isListening ? 'Stop listening' : 'Speak your message'}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
            >
              {isListening ? '⏺' : '◎'}
            </button>
          </div>

          <div className={styles.inputFooter}>
            <span id="copilot-hint" className={styles.inputHint}>
              {isListening ? 'Listening — click ◎ to stop' : isSubmitting ? 'Generating…' : '↵ to send · ⇧↵ newline'}
            </span>

            {isSubmitting ? (
              <button
                type="button"
                className={`${styles.sendBtn} ${styles.stopBtn}`}
                onClick={handleStop}
                aria-label="Stop generating"
              >
                <span aria-hidden="true">⏹</span> Stop
              </button>
            ) : (
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
              >
                Send <span aria-hidden="true">↑</span>
              </button>
            )}
          </div>

        </div>

      </aside>
    </>
  )
}
