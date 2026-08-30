/**
 * Deck sharing.
 *
 * The parser is the half that matters: it reads a file someone else
 * made, possibly edited by hand, possibly from a future version. Every
 * way it can be wrong should end in a sentence the reader can act on
 * rather than a half-imported deck.
 */

import {
  serialiseDeck, toShareText, parseSharedDeck, shareFilename,
  DECK_SHARE_KIND, DECK_SHARE_VERSION, MAX_SHARED_CARDS,
} from '@/lib/deckShare'

const deck = { languageName: 'Spanish', description: 'Semester one' }
const cards = [
  { foreignWord: 'hola',  nativeTranslation: 'hello', phoneticSpelling: 'ˈo.la' },
  { foreignWord: 'casa',  nativeTranslation: 'house' },
]

describe('serialiseDeck', () => {
  it('keeps the words and drops the review state', () => {
    const out = serialiseDeck(deck, cards)
    expect(out.name).toBe('Spanish')
    expect(out.cards).toEqual([
      { word: 'hola', meaning: 'hello', phonetic: 'ˈo.la' },
      { word: 'casa', meaning: 'house' },
    ])
    // Nothing about how well *this* person knows the deck travels with it.
    const text = toShareText(out)
    for (const leaked of ['easeFactor', 'consecutiveSuccesses', 'nextReviewTimestamp', 'stabilityFactor']) {
      expect(text).not.toContain(leaked)
    }
  })

  it('omits phonetic rather than sending an empty string', () => {
    expect(serialiseDeck(deck, cards).cards[1]).not.toHaveProperty('phonetic')
  })

  it('round-trips through text', () => {
    const parsed = parseSharedDeck(toShareText(serialiseDeck(deck, cards)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.deck.name).toBe('Spanish')
    expect(parsed.deck.cards).toHaveLength(2)
    expect(parsed.skipped).toBe(0)
  })
})

describe('parseSharedDeck', () => {
  const good = () => toShareText(serialiseDeck(deck, cards))

  it('rejects empty input', () => {
    const r = parseSharedDeck('   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/empty/i)
  })

  it('rejects text that is not JSON, and says what to paste', () => {
    const r = parseSharedDeck('hola = hello')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/valid JSON/i)
  })

  it('rejects JSON that is not a deck', () => {
    for (const s of ['[]', '"hello"', '42', 'null']) {
      const r = parseSharedDeck(s)
      expect(r.ok).toBe(false)
    }
    const r = parseSharedDeck(JSON.stringify({ hello: 'world' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not a Zenith deck/i)
  })

  it('refuses a newer version rather than half-reading it', () => {
    // Reading what we recognise and dropping the rest yields a deck that
    // looks complete and is not.
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: DECK_SHARE_VERSION + 1,
      name: 'Spanish', cards: [{ word: 'hola', meaning: 'hello' }],
    }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/newer version/i)
  })

  it('accepts an older version', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 0,
      name: 'Spanish', cards: [{ word: 'hola', meaning: 'hello' }],
    }))
    expect(r.ok).toBe(true)
  })

  it('needs a name', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: '   ',
      cards: [{ word: 'hola', meaning: 'hello' }],
    }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/no name/i)
  })

  it('skips half-written cards and counts them', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: 'Spanish',
      cards: [
        { word: 'hola', meaning: 'hello' },
        { word: 'casa' },                    // no meaning
        { meaning: 'dog' },                  // no word
        { word: '  ', meaning: 'blank' },    // whitespace only
        'not an object',
        null,
      ],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deck.cards).toHaveLength(1)
    expect(r.skipped).toBe(5)
  })

  it('fails when nothing usable survives', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: 'Spanish',
      cards: [{ word: 'casa' }, { meaning: 'dog' }],
    }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/no usable cards/i)
  })

  it('trims whitespace off both halves', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: '  Spanish  ',
      cards: [{ word: '  hola \n', meaning: '\thello  ' }],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deck.name).toBe('Spanish')
    expect(r.deck.cards[0]).toEqual({ word: 'hola', meaning: 'hello' })
  })

  it('caps an absurdly large deck instead of importing it whole', () => {
    const many = Array.from({ length: MAX_SHARED_CARDS + 25 },
      (_, i) => ({ word: 'w' + i, meaning: 'm' + i }))
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: 'Huge', cards: many,
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deck.cards).toHaveLength(MAX_SHARED_CARDS)
    expect(r.skipped).toBe(25)
  })

  it('ignores any review state a hand-edited file carries', () => {
    const r = parseSharedDeck(JSON.stringify({
      kind: DECK_SHARE_KIND, version: 1, name: 'Spanish',
      cards: [{ word: 'hola', meaning: 'hello', easeFactor: 9, consecutiveSuccesses: 99 }],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deck.cards[0]).toEqual({ word: 'hola', meaning: 'hello' })
  })
})

describe('shareFilename', () => {
  it('makes a name that saves on any platform', () => {
    expect(shareFilename('Spanish')).toBe('zenith-deck-spanish.json')
    expect(shareFilename('GRE / SAT: core!')).toBe('zenith-deck-gre-sat-core.json')
    expect(shareFilename('   ')).toBe('zenith-deck-vocab.json')
    expect(shareFilename('日本語')).toBe('zenith-deck-vocab.json')
  })

  it('does not run away with a very long deck name', () => {
    expect(shareFilename('a'.repeat(300)).length).toBeLessThan(70)
  })
})
