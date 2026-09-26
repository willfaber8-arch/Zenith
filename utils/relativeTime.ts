/**
 * utils/relativeTime.ts — "3 min ago", for sync status and the sync banner.
 *
 * Takes epoch ms or an ISO string, so a server timestamp and a device-side
 * one read the same way. Only ever used for display — never compare two
 * machines' clocks with it (CLAUDE.md rule 114).
 */
export function relativeTime(at: string | number | null | undefined): string {
  if (at == null || at === '') return 'never'
  const ms = typeof at === 'number' ? at : Date.parse(at)
  if (Number.isNaN(ms)) return 'unknown'

  const diff = Date.now() - ms
  if (diff < 45_000)       return 'just now'
  const mins = Math.round(diff / 60_000)
  if (mins < 60)           return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24)          return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30)           return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(ms).toLocaleDateString()
}
