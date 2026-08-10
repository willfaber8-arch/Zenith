/**
 * data/diningSeed.ts — starter dining schedules.
 *
 * Seeded rather than scraped, and editable rather than authoritative.
 * A scraper breaks silently when the source site changes and then shows
 * stale hours, which is worse than showing none — you walk to a closed
 * dining hall. Seeding well means most people never touch this; when
 * hours do change, a ten-second edit keeps it correct forever after.
 *
 * Times are indicative and the UI shows a "last updated" date so
 * staleness is visible instead of invisible.
 */

import type { DiningHall } from '@/lib/db'

type SeedHall = Omit<DiningHall, 'id' | 'updatedAt'>

/** Mon–Fri with one window. */
const weekdays = (open: string, close: string) =>
  ([1, 2, 3, 4, 5] as const).map(day => ({ day, open, close }))

/** Sat–Sun with one window. */
const weekend = (open: string, close: string) =>
  ([0, 6] as const).map(day => ({ day, open, close }))

export const DINING_SEED: Readonly<Record<string, readonly SeedHall[]>> = {
  cornell: [
    { universityId: 'cornell', name: 'Okenshields', location: 'Willard Straight Hall',
      hours: weekdays('11:00', '14:30'), mealPlanOnly: false,
      notes: 'Lunch only on weekdays.' },
    { universityId: 'cornell', name: 'North Star Dining', location: 'Appel Commons',
      hours: [...weekdays('07:00', '22:00'), ...weekend('09:00', '22:00')] },
    { universityId: 'cornell', name: 'Morrison Dining', location: 'Morrison Hall',
      hours: [...weekdays('07:00', '21:00'), ...weekend('10:00', '21:00')] },
    { universityId: 'cornell', name: 'Trillium', location: 'Kennedy Hall',
      hours: weekdays('08:00', '15:00') },
    { universityId: 'cornell', name: 'Terrace Restaurant', location: 'Statler Hall',
      hours: weekdays('11:00', '14:00') },
    { universityId: 'cornell', name: 'Louie’s Lunch', location: 'North Campus',
      // The classic late-night truck — the overnight case the engine handles.
      hours: [{ day: 4, open: '21:30', close: '01:00' }, { day: 5, open: '21:30', close: '01:00' }],
      notes: 'Late-night truck.' },
  ],

  'texas-am': [
    { universityId: 'texas-am', name: 'Sbisa Dining Center', location: 'Northside',
      hours: [...weekdays('07:00', '21:00'), ...weekend('09:00', '20:00')] },
    { universityId: 'texas-am', name: 'The Commons', location: 'Southside',
      hours: [...weekdays('07:00', '22:00'), ...weekend('10:00', '21:00')] },
    { universityId: 'texas-am', name: 'Duncan Dining Hall', location: 'Corps area',
      hours: weekdays('06:30', '19:00') },
  ],

  'ut-austin': [
    { universityId: 'ut-austin', name: 'J2 Dining', location: 'Jester Center',
      hours: [...weekdays('07:00', '21:00'), ...weekend('09:00', '20:00')] },
    { universityId: 'ut-austin', name: 'Kins Dining', location: 'Kinsolving',
      hours: [...weekdays('07:00', '20:00'), ...weekend('10:00', '19:00')] },
    { universityId: 'ut-austin', name: 'Cypress Bend Café', location: 'San Jacinto',
      hours: weekdays('10:30', '20:00') },
  ],
}

/** Seed ids are stable so re-seeding cannot duplicate a hall. */
export function seedIdFor(universityId: string, name: string): string {
  return `seed:${universityId}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function seedHallsFor(universityId: string): DiningHall[] {
  const now = Date.now()
  return (DINING_SEED[universityId] ?? []).map(h => ({
    ...h,
    id: seedIdFor(universityId, h.name),
    updatedAt: now,
  }))
}

export function hasSeedFor(universityId: string): boolean {
  return (DINING_SEED[universityId]?.length ?? 0) > 0
}
