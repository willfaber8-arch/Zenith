/**
 * lib/deckShare.ts — decks in, decks out.
 *
 * Zenith has no server that holds decks, so a "share link" would be a
 * promise it cannot keep. What it can do honestly is hand you the deck
 * itself: a small JSON document you can send however you already send
 * things, and which imports cleanly on the other side.
 *
 * Pure — no Dexie, no React, no DOM. The parsing is the part that has
 * to survive a file someone edited by hand, and that is worth testing
 * on its own.
 */

export const DECK_SHARE_VERSION = 1
export const DECK_SHARE_KIND    = 'zenith.vocab.deck'

/** One card, stripped to what is worth sending. */
export interface SharedCard {
  word:      string
  meaning:   string
  phonetic?: string
}

export interface SharedDeck {
  kind:        typeof DECK_SHARE_KIND
  version:     number
  name:        string
  description: string
  cards:       SharedCard[]
  /** Informational only — never trusted on import. */
  exportedAt?: string
}

/** Anything over this is a file, not a paste, and probably a mistake. */
export const MAX_SHARED_CARDS = 5000

/**
 * Build the shareable document.
 *
 * Review state — ease factors, streaks, when a card is next due — is
 * deliberately left out. It describes how *you* are doing with the
 * deck, not what the deck is, and importing someone else's schedule
 * would tell your scheduler you had studied words you have never seen.
 */
export function serialiseDeck(
  deck: { languageName: string; description?: string },
  cards: Array<{ foreignWord: string; nativeTranslation: string; phoneticSpelling?: string }>,
): SharedDeck {
  return {
    kind:        DECK_SHARE_KIND,
    version:     DECK_SHARE_VERSION,
    name:        deck.languageName,
    description: deck.description ?? '',
    exportedAt:  new Date().toISOString(),
    cards: cards.map(c => ({
      word:    c.foreignWord,
      meaning: c.nativeTranslation,
      ...(c.phoneticSpelling ? { phonetic: c.phoneticSpelling } : {}),
    })),
  }
}

export function toShareText(deck: SharedDeck): string {
  return JSON.stringify(deck, null, 2)
}

export interface ParseFailure { ok: false; error: string }
export interface ParseSuccess { ok: true; deck: SharedDeck; skipped: number }
export type ParseResult = ParseSuccess | ParseFailure

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Read a pasted or uploaded deck.
 *
 * Every failure names what is wrong in terms of the file rather than
 * the parser, because the person seeing it is holding a file someone
 * sent them and can only act on the former.
 */
export function parseSharedDeck(raw: string): ParseResult {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Nothing to import — the text is empty.' }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That is not valid JSON. Paste the whole file, including the outer { }.' }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'That JSON is not a deck — expected an object at the top level.' }
  }

  const o = data as Record<string, unknown>

  if (o.kind !== DECK_SHARE_KIND) {
    return { ok: false, error: 'That file is not a Zenith deck.' }
  }

  /*
   * A newer file is refused rather than half-read. Reading what we
   * recognise and silently dropping the rest produces a deck that looks
   * complete and is not, which is worse than being told to update.
   */
  const version = typeof o.version === 'number' ? o.version : 0
  if (version > DECK_SHARE_VERSION) {
    return { ok: false, error: `That deck was made by a newer version of Zenith (v${version}).` }
  }

  const name = asString(o.name)
  if (!name) return { ok: false, error: 'That deck has no name.' }

  if (!Array.isArray(o.cards)) {
    return { ok: false, error: 'That deck has no cards list.' }
  }

  const cards: SharedCard[] = []
  let skipped = 0

  for (const entry of o.cards) {
    if (typeof entry !== 'object' || entry === null) { skipped++; continue }
    const c = entry as Record<string, unknown>
    const word    = asString(c.word)
    const meaning = asString(c.meaning)
    /* Both halves or nothing: a card missing either is unstudiable, and
       importing it would put a permanent blank in the deck. */
    if (!word || !meaning) { skipped++; continue }
    if (cards.length >= MAX_SHARED_CARDS) { skipped++; continue }
    const phonetic = asString(c.phonetic)
    cards.push({ word, meaning, ...(phonetic ? { phonetic } : {}) })
  }

  if (cards.length === 0) {
    return { ok: false, error: 'That deck has no usable cards — every entry was missing a word or a meaning.' }
  }

  return {
    ok: true,
    skipped,
    deck: {
      kind:        DECK_SHARE_KIND,
      version:     DECK_SHARE_VERSION,
      name,
      description: asString(o.description),
      cards,
    },
  }
}

/** A filename that survives being saved on any of the three platforms. */
export function shareFilename(name: string): string {
  const safe = name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `zenith-deck-${safe || 'vocab'}.json`
}
