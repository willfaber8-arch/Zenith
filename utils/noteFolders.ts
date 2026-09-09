/**
 * utils/noteFolders.ts — grouping notes into folders.
 *
 * Notes already had a fixed internal category and freeform tags. Neither
 * answers "where do I keep this": a category is a type, and tags
 * describe a note rather than place it. A folder is the one place a note
 * lives, which is what makes it useful for finding things again.
 *
 * Unfiled is a first-class state, not a gap. A note jotted down in a
 * hurry should not demand a filing decision before you can write it.
 *
 * Pure — no Dexie, no DOM.
 */

/** The pseudo-folders the strip always offers, alongside the real ones. */
export const ALL_NOTES  = 'all'
export const UNFILED    = 'unfiled'

/** Which folder view is selected: a real id, or one of the two pseudo-folders. */
export type FolderSelection = number | typeof ALL_NOTES | typeof UNFILED

export const MAX_FOLDER_NAME = 40

export interface FolderLike { id?: number; name: string }
export interface NoteLike   { folderId?: number }

export type FolderNameResult =
  | { ok: true;  name: string }
  | { ok: false; reason: string }

/**
 * Check a folder name before it is saved.
 *
 * Refuses duplicates by name, case-insensitively: two folders called
 * "Coursework" are indistinguishable in the strip, so filing becomes a
 * coin flip and notes scatter between them.
 */
export function validateFolderName(
  raw:       string,
  existing:  readonly FolderLike[],
  /** The folder being renamed, so it does not collide with itself. */
  ignoreId?: number,
): FolderNameResult {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, reason: 'A folder needs a name.' }

  const clash = existing.some(f =>
    f.id !== ignoreId && f.name.trim().toLowerCase() === name.toLowerCase())
  if (clash) return { ok: false, reason: `There is already a folder called "${name}".` }

  return { ok: true, name: name.slice(0, MAX_FOLDER_NAME) }
}

/** Notes belonging to the current selection. */
export function notesInFolder<T extends NoteLike>(
  notes:     readonly T[],
  selection: FolderSelection,
): T[] {
  if (selection === ALL_NOTES) return [...notes]
  if (selection === UNFILED)   return notes.filter(n => n.folderId == null)
  return notes.filter(n => n.folderId === selection)
}

/**
 * How many notes sit in each folder, plus the two pseudo-folders.
 *
 * Counted in one pass rather than a filter per folder, because the strip
 * re-renders on every keystroke in the search box.
 */
export function folderCounts<T extends NoteLike>(
  notes:   readonly T[],
  folders: readonly FolderLike[],
): Map<FolderSelection, number> {
  const out = new Map<FolderSelection, number>()
  out.set(ALL_NOTES, notes.length)

  let unfiled = 0
  const byId = new Map<number, number>()
  for (const f of folders) if (f.id != null) byId.set(f.id, 0)

  for (const n of notes) {
    if (n.folderId == null) { unfiled++; continue }
    /* A note whose folder was deleted counts as unfiled, which is what
       it now is — the alternative is a note that belongs to nothing and
       appears nowhere. */
    if (byId.has(n.folderId)) byId.set(n.folderId, byId.get(n.folderId)! + 1)
    else unfiled++
  }

  out.set(UNFILED, unfiled)
  for (const [id, n] of byId) out.set(id, n)
  return out
}

/**
 * Where a selection should fall back to when its folder disappears.
 *
 * Deleting the folder you are looking at should show you everything
 * again, not an empty list filtered by an id that no longer exists.
 */
export function selectionAfterDelete(
  selection: FolderSelection,
  deletedId: number,
): FolderSelection {
  return selection === deletedId ? ALL_NOTES : selection
}
