/**
 * components/DeckShareModal.tsx — send a deck, or receive one.
 *
 * Zenith keeps everything on your own device and has no server holding
 * decks, so there is no link to hand out. Rather than pretend otherwise,
 * this hands you the deck itself: copy it, or save it as a file, and
 * send it however you already send things. The other side pastes it
 * back or opens the file.
 *
 * Progress does not travel. What you export is the deck — the words and
 * what they mean — not how well you know them.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { db } from '@/lib/db'
import type { VocabCard, VocabDeck } from '@/types/vocabulary'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/lib/ToastContext'
import {
  serialiseDeck, toShareText, parseSharedDeck, shareFilename,
} from '@/lib/deckShare'
import styles from './DeckShareModal.module.css'

type Mode =
  | { kind: 'export'; deck: VocabDeck }
  | { kind: 'import' }

export default function DeckShareModal({ mode, onClose, onImported }: {
  mode: Mode
  onClose: () => void
  onImported?: (deckId: string) => void
}) {
  const { toast } = useToast()
  const [text, setText]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  /* Build the export payload once the modal opens. */
  useEffect(() => {
    if (mode.kind !== 'export') { areaRef.current?.focus(); return }
    let cancelled = false
    void (async () => {
      const cards = await db.vocab_cards.where('deckId').equals(mode.deck.id).toArray()
      if (cancelled) return
      setText(toShareText(serialiseDeck(mode.deck, cards)))
    })()
    return () => { cancelled = true }
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Deck copied — paste it anywhere.', 'success')
    } catch {
      /* Clipboard access can be refused outright; the text is on screen
         and selectable, so say that rather than just failing. */
      areaRef.current?.select()
      toast('Could not reach the clipboard — the text is selected, press Ctrl/⌘+C.', 'info')
    }
  }, [text, toast])

  const download = useCallback(() => {
    if (mode.kind !== 'export') return
    const blob = new Blob([text], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = shareFilename(mode.deck.languageName)
    a.click()
    /* Revoking immediately can cancel the download in some browsers. */
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, [mode, text])

  const readFile = useCallback(async (file: File) => {
    setError(null)
    try {
      setText(await file.text())
    } catch {
      setError('That file could not be read.')
    }
  }, [])

  const doImport = useCallback(async () => {
    const parsed = parseSharedDeck(text)
    if (!parsed.ok) { setError(parsed.error); return }

    setBusy(true)
    setError(null)
    try {
      const deckId = crypto.randomUUID()
      const now = Date.now()
      const newCards: VocabCard[] = parsed.deck.cards.map(c => ({
        id:                   crypto.randomUUID(),
        deckId,
        foreignWord:          c.word,
        nativeTranslation:    c.meaning,
        phoneticSpelling:     c.phonetic ?? '',
        /* A fresh start: an imported deck is one you have never studied,
           whatever the sender's own progress looked like. */
        stabilityFactor:      0,
        easeFactor:           2.5,
        reviewIntervalDays:   0,
        consecutiveSuccesses: 0,
        nextReviewTimestamp:  now,
      }))

      /* One transaction: a deck row with no cards would show up in the
         sidebar as an empty deck nobody created on purpose. */
      await db.transaction('rw', [db.vocab_decks, db.vocab_cards], async () => {
        await db.vocab_decks.add({
          id: deckId,
          languageName: parsed.deck.name,
          description:  parsed.deck.description,
          createdAt:    now,
        })
        await db.vocab_cards.bulkAdd(newCards)
      })

      toast(
        parsed.skipped > 0
          ? `Imported ${newCards.length} cards — ${parsed.skipped} were incomplete and skipped.`
          : `Imported ${newCards.length} cards into ${parsed.deck.name}.`,
        parsed.skipped > 0 ? 'info' : 'success',
      )
      onImported?.(deckId)
      onClose()
    } catch {
      setError('Could not save the deck. Your storage may be full.')
    } finally {
      setBusy(false)
    }
  }, [text, toast, onImported, onClose])

  const isExport = mode.kind === 'export'

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true"
           aria-label={isExport ? 'Share this deck' : 'Import a deck'}>
        <div className={styles.header}>
          <span className={styles.title}>
            {isExport ? `Share “${mode.deck.languageName}”` : 'Import a deck'}
          </span>
          <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.body}>
          <p className={styles.blurb}>
            {isExport
              ? 'Copy this or save it as a file and send it however you like. It carries the words and meanings — not how well you know them.'
              : 'Paste a deck below, or open a .json file someone sent you. It arrives as a new deck with a clean slate.'}
          </p>

          <textarea
            ref={areaRef}
            className={styles.area}
            value={text}
            onChange={e => { setText(e.target.value); setError(null) }}
            readOnly={isExport}
            spellCheck={false}
            placeholder={isExport ? 'Preparing…' : 'Paste the deck JSON here…'}
            aria-label={isExport ? 'Deck contents' : 'Paste deck here'}
          />

          {error && <p className={styles.error}>{error}</p>}

          {!isExport && (
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className={styles.fileInput}
              onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f) }}
            />
          )}
        </div>

        <div className={styles.footer}>
          {isExport ? (
            <>
              <button className={styles.ghost} onClick={download} disabled={!text}>
                <Icon name="upload" size={14} /> Save file
              </button>
              <button className={styles.primary} onClick={() => void copy()} disabled={!text}>
                Copy deck
              </button>
            </>
          ) : (
            <>
              <button className={styles.ghost} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} /> Open file
              </button>
              <button
                className={styles.primary}
                onClick={() => void doImport()}
                disabled={busy || text.trim().length === 0}
              >
                {busy ? 'Importing…' : 'Import deck'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
