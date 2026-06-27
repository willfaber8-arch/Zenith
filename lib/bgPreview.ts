/**
 * lib/bgPreview.ts — ephemeral, app-wide background preview channel.
 *
 * Mirrors lib/themePreview.ts but for shop backgrounds. Setting a preview id
 * makes ThemeApplicator render THAT background pattern everywhere (without
 * touching the persisted activeBackground), so a shopper can see a background
 * on the whole interface before buying or equipping. Clearing it restores the
 * real equipped background. Never persisted.
 */

let bgPreviewId: string | null = null
const listeners = new Set<(id: string | null) => void>()

export function getBgPreviewId(): string | null {
  return bgPreviewId
}

export function setBgPreviewId(id: string | null): void {
  if (bgPreviewId === id) return
  bgPreviewId = id
  listeners.forEach(fn => fn(bgPreviewId))
}

export function clearBgPreview(): void {
  setBgPreviewId(null)
}

export function subscribeBgPreview(fn: (id: string | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
