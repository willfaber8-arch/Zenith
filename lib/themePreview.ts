/**
 * lib/themePreview.ts — ephemeral, app-wide theme preview channel.
 *
 * A tiny module-level singleton: setting a preview id makes ThemeApplicator
 * render THAT theme everywhere (without touching the persisted activeTheme),
 * so a shopper can see a theme on the whole interface before buying. Clearing
 * it restores the real active theme. Survives across components via a simple
 * subscribe/notify list; never persisted.
 */

let previewId: string | null = null
const listeners = new Set<(id: string | null) => void>()

export function getPreviewId(): string | null {
  return previewId
}

export function setPreviewId(id: string | null): void {
  if (previewId === id) return
  previewId = id
  listeners.forEach(fn => fn(previewId))
}

export function clearPreview(): void {
  setPreviewId(null)
}

export function subscribePreview(fn: (id: string | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
