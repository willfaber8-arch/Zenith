/**
 * lib/reloadPage.ts — reload the app.
 *
 * One function so the places that reload after a cloud load (see
 * lib/CloudSyncContext) do it the same way, and so tests can stand in for
 * a browser navigation jsdom cannot perform.
 */
export function reloadPage(): void {
  if (typeof window !== 'undefined') window.location.reload()
}
