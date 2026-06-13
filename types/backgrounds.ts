/**
 * types/backgrounds.ts
 * Phase 11.3 — Hardware-Accelerated Dynamic Canvas Background Options
 *
 * BackgroundStyle union + localStorage key for the ambient backdrop system.
 */

export type BackgroundStyle =
  | 'CLASSIC_STARFIELD'
  | 'RAINDROPS_ON_GLASS'
  | 'MINIMAL_GRID_MATRIX';

/** localStorage key for persisting the user's backdrop choice */
export const BACKDROP_STORAGE_KEY = 'zenith_ambient_backdrop_v2';

/** Default backdrop style on first load */
export const BACKDROP_DEFAULT: BackgroundStyle = 'MINIMAL_GRID_MATRIX';
