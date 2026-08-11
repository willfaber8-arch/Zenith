/**
 * Which books are allowed to seed recommendations.
 *
 * Pure logic, so it is tested directly rather than through the feed —
 * the interesting cases are all about precedence between three
 * independent ways of saying "not this one", and driving those through
 * a streaming LLM component would test the stream, not the rule.
 */

import { isRecommendationSource } from '@/lib/hooks/useShelves'
import type { LibraryBook } from '@/types/bookTracker'

function book(over: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: 'b1', title: 'Dune', author: 'Frank Herbert',
    userRating: 4, readCount: 1, readingStatus: 'COMPLETED',
    addedAt: 0,
    ...over,
  } as LibraryBook
}

const NONE = new Set<string>()

describe('isRecommendationSource', () => {
  it('allows an ordinary book', () => {
    expect(isRecommendationSource(book(), NONE)).toBe(true)
  })

  it('respects the per-book opt-out', () => {
    expect(isRecommendationSource(book({ excludeFromRecs: true }), NONE)).toBe(false)
  })

  it('respects an excluded shelf', () => {
    const b = book({ shelfIds: ['textbooks'] })
    expect(isRecommendationSource(b, new Set(['textbooks']))).toBe(false)
  })

  it('only needs one excluded shelf out of several', () => {
    // A book cross-filed onto "Sci-fi" and "Textbooks" is still a textbook.
    const b = book({ shelfIds: ['scifi', 'textbooks'] })
    expect(isRecommendationSource(b, new Set(['textbooks']))).toBe(false)
  })

  it('allows a book on shelves that are not excluded', () => {
    const b = book({ shelfIds: ['scifi'] })
    expect(isRecommendationSource(b, new Set(['textbooks']))).toBe(true)
  })

  it('treats a book with no shelves as ordinary', () => {
    // Every pre-existing book is in this state; shelves are additive and
    // must not change how an unfiled library behaves.
    expect(isRecommendationSource(book({ shelfIds: undefined }), new Set(['x']))).toBe(true)
    expect(isRecommendationSource(book({ shelfIds: [] }), new Set(['x']))).toBe(true)
  })

  it('keeps the per-book flag authoritative even on an allowed shelf', () => {
    const b = book({ shelfIds: ['scifi'], excludeFromRecs: true })
    expect(isRecommendationSource(b, NONE)).toBe(false)
  })
})
