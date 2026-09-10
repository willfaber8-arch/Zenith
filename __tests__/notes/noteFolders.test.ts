/**
 * Filing notes into folders.
 *
 * Notes already had a fixed category and freeform tags; neither answers
 * "where do I keep this". The cases below are the ones where a careless
 * rule loses a note rather than merely misfiling it.
 */

import {
  validateFolderName, notesInFolder, folderCounts, selectionAfterDelete,
  ALL_NOTES, UNFILED, MAX_FOLDER_NAME,
} from '@/utils/noteFolders'

const folders = [
  { id: 1, name: 'Coursework' },
  { id: 2, name: 'Ideas' },
]
const notes = [
  { id: 10, folderId: 1 },
  { id: 11, folderId: 1 },
  { id: 12, folderId: 2 },
  { id: 13 },                 // unfiled
  { id: 14, folderId: 99 },   // folder since deleted
]

describe('validateFolderName', () => {
  it('accepts a plain name', () => {
    const r = validateFolderName('Reading', folders)
    expect(r.ok && r.name).toBe('Reading')
  })

  it('tidies whitespace', () => {
    const r = validateFolderName('  Deep   Work  ', folders)
    expect(r.ok && r.name).toBe('Deep Work')
  })

  it('refuses an empty name', () => {
    expect(validateFolderName('   ', folders).ok).toBe(false)
  })

  it('refuses a duplicate, whatever the case', () => {
    // Two folders with the same name are indistinguishable in the strip,
    // so filing becomes a coin flip and notes scatter between them.
    for (const n of ['Coursework', 'coursework', '  COURSEWORK ']) {
      const r = validateFolderName(n, folders)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/already a folder/i)
    }
  })

  it('lets a folder keep its own name when renamed', () => {
    // Renaming "Coursework" to "Coursework " must not collide with itself.
    expect(validateFolderName('Coursework', folders, 1).ok).toBe(true)
  })

  it('still catches a clash with a different folder while renaming', () => {
    expect(validateFolderName('Ideas', folders, 1).ok).toBe(false)
  })

  it('caps an absurd name', () => {
    const r = validateFolderName('x'.repeat(MAX_FOLDER_NAME + 80), folders)
    expect(r.ok && r.name.length).toBe(MAX_FOLDER_NAME)
  })
})

describe('notesInFolder', () => {
  it('shows everything under All', () => {
    expect(notesInFolder(notes, ALL_NOTES)).toHaveLength(5)
  })

  it('shows a folder’s own notes', () => {
    expect(notesInFolder(notes, 1).map(n => n.id)).toEqual([10, 11])
  })

  it('treats unfiled as a real place, not a gap', () => {
    expect(notesInFolder(notes, UNFILED).map(n => n.id)).toEqual([13])
  })

  it('returns nothing for a folder with no notes', () => {
    expect(notesInFolder(notes, 5)).toEqual([])
  })

  it('never mutates the list it was given', () => {
    const copy = [...notes]
    notesInFolder(notes, ALL_NOTES).push({ id: 999 } as never)
    expect(notes).toEqual(copy)
  })
})

describe('folderCounts', () => {
  it('counts each folder and the pseudo-folders', () => {
    const c = folderCounts(notes, folders)
    expect(c.get(ALL_NOTES)).toBe(5)
    expect(c.get(1)).toBe(2)
    expect(c.get(2)).toBe(1)
  })

  it('counts a note whose folder is gone as unfiled', () => {
    // Anything else leaves it belonging to nothing and appearing nowhere.
    expect(folderCounts(notes, folders).get(UNFILED)).toBe(2)  // #13 and #14
  })

  it('reports zero for an empty folder rather than omitting it', () => {
    const c = folderCounts([], [{ id: 3, name: 'Empty' }])
    expect(c.get(3)).toBe(0)
    expect(c.get(ALL_NOTES)).toBe(0)
  })
})

describe('selectionAfterDelete', () => {
  it('falls back to All when the folder you are viewing is deleted', () => {
    // Otherwise the list filters by an id that no longer exists and
    // simply looks empty.
    expect(selectionAfterDelete(1, 1)).toBe(ALL_NOTES)
  })

  it('leaves an unrelated selection alone', () => {
    expect(selectionAfterDelete(2, 1)).toBe(2)
    expect(selectionAfterDelete(UNFILED, 1)).toBe(UNFILED)
  })
})
