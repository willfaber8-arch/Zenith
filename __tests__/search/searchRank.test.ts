/**
 * Ranking search results.
 *
 * The failure mode here is not an exception — it is a list where the
 * thing you were looking for sits fourth. These pin the orderings that
 * make a search box feel like it understood you.
 */

import {
  scoreMatch, makeSnippet, hasWordStart, terms, normalise,
} from '@/utils/searchRank'

describe('splitting a query', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalise('  Read   CHAPTER 3 ')).toBe('read chapter 3')
    expect(terms(' Read   chapter 3 ')).toEqual(['read', 'chapter', '3'])
  })

  it('treats an empty query as no terms', () => {
    expect(terms('   ')).toEqual([])
  })
})

describe('word-start matching', () => {
  /*
   * Substring matching alone is too generous: "act" would rank
   * "abstract" alongside "action", and short queries are the common
   * case in a topbar.
   */
  it('matches at the start of a word, not in the middle of one', () => {
    expect(hasWordStart('take action now', 'act')).toBe(true)
    expect(hasWordStart('an abstract idea', 'act')).toBe(false)
  })

  it('matches at the very start of the text', () => {
    expect(hasWordStart('action stations', 'action')).toBe(true)
  })

  it('treats punctuation as a word boundary', () => {
    expect(hasWordStart('re-read chapter', 'read')).toBe(true)
  })
})

describe('scoring', () => {
  it('gives nothing for a query that does not appear', () => {
    expect(scoreMatch('quantum', 'Read chapter 3', 'about rocks')).toBe(0)
  })

  it('gives nothing for an empty query', () => {
    expect(scoreMatch('', 'Read chapter 3')).toBe(0)
  })

  it('ranks an exact title above a prefix', () => {
    expect(scoreMatch('read chapter 3', 'Read chapter 3'))
      .toBeGreaterThan(scoreMatch('read chapter', 'Read chapter 3'))
  })

  it('ranks a title match above a body match', () => {
    const inTitle = scoreMatch('chapter', 'Chapter notes', 'nothing here')
    const inBody  = scoreMatch('chapter', 'Reading list', 'the chapter was long')
    expect(inTitle).toBeGreaterThan(inBody)
  })

  /*
   * The judgement call that matters most. Searching "chapter 3" should
   * prefer the thing about chapter 3 over the thing that says "chapter"
   * repeatedly and never mentions 3.
   */
  it('prefers matching every term over matching one term strongly', () => {
    const allTerms = scoreMatch('chapter 3', 'Chapter 3 questions')
    const oneTerm  = scoreMatch('chapter 3', 'Chapter chapter chapter')
    expect(allTerms).toBeGreaterThan(oneTerm)
  })

  it('still matches when only some terms are present', () => {
    expect(scoreMatch('chapter 9', 'Chapter 3 questions')).toBeGreaterThan(0)
  })

  it('is case- and spacing-insensitive', () => {
    expect(scoreMatch('READ   Chapter', 'read chapter 3'))
      .toBe(scoreMatch('read chapter', 'Read Chapter 3'))
  })
})

describe('snippets', () => {
  const body = 'The reading for this week is long and dull, but chapter 3 covers the important argument about tides and the moon.'

  it('shows the text around the match, not the opening words', () => {
    const s = makeSnippet(body, 'chapter 3')
    expect(s).toContain('chapter 3')
    expect(s.startsWith('…')).toBe(true)
  })

  /*
   * A snippet that does not contain what you searched for reads like the
   * match is somewhere you cannot see. Better to show nothing.
   */
  it('returns nothing when the query is not in the text', () => {
    expect(makeSnippet(body, 'quantum')).toBe('')
  })

  it('does not lead with an ellipsis when the match is at the start', () => {
    expect(makeSnippet('Chapter 3 is about tides', 'chapter')).not.toMatch(/^…/)
  })

  it('collapses newlines so a snippet stays one line', () => {
    expect(makeSnippet('first line\n\nchapter 3 here', 'chapter')).not.toContain('\n')
  })

  it('handles an empty body', () => {
    expect(makeSnippet('', 'chapter')).toBe('')
  })
})
