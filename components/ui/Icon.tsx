/**
 * components/ui/Icon.tsx — the line-icon set.
 *
 * Replaces the emoji scattered through the app. Emoji were quick to write
 * and are wrong for this interface in three specific ways:
 *
 *   · every platform draws them differently, so the same screen is a
 *     different design on a Mac, a Pixel and Windows
 *   · they are full-colour and cannot be recoloured, so they ignore the
 *     theme entirely and fight the low-saturation palette
 *   · they carry a text baseline, so they never sit straight next to a
 *     label without per-emoji nudging
 *
 * These are stroked paths on `currentColor` at a 24-unit grid, so they
 * inherit colour and size from whatever contains them and line up with
 * text by construction.
 *
 * Decorative by default (`aria-hidden`). Pass a `label` only when the
 * icon is the sole meaning of a control — and prefer giving the control
 * itself an accessible name instead.
 */

import type { SVGProps } from 'react'

export type IconName =
  /* Movement */
  | 'run' | 'walk' | 'bike' | 'swim' | 'row' | 'hike' | 'yoga' | 'elliptical'
  | 'dumbbell' | 'barbell' | 'stopwatch' | 'heart' | 'flame'
  /* Structure */
  | 'calendar' | 'clock' | 'list' | 'grid' | 'chart' | 'target'
  /* Actions */
  | 'plus' | 'minus' | 'check' | 'close' | 'edit' | 'trash'
  | 'chevronLeft' | 'chevronRight' | 'chevronDown'
  | 'play' | 'pause' | 'reset' | 'sparkle' | 'upload' | 'link'
  | 'search' | 'shuffle' | 'camera' | 'pin' | 'flag' | 'lock' | 'bell'
  | 'bolt' | 'spiral'
  /* Study */
  | 'brain' | 'book' | 'bookOpen' | 'graduation' | 'globe' | 'note'
  | 'clipboard' | 'document' | 'trendingUp' | 'trophy' | 'alert'
  /* Nature */
  | 'plant' | 'plantWilted' | 'sprout' | 'leaf' | 'tree' | 'droplet'
  /* Weather */
  | 'sun' | 'cloudSun' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm'
  | 'sunrise' | 'moon'
  /* Kitchen */
  | 'backpack' | 'microwave' | 'fridge' | 'pan' | 'wheat' | 'milk' | 'nut'
  | 'store' | 'school'
  /* Career */
  | 'briefcase' | 'people' | 'building' | 'rocket' | 'palette' | 'code'
  | 'video'
  /* Places */
  | 'box' | 'tower' | 'tent' | 'eye' | 'music' | 'waves' | 'swords'
  /*
   * Moods. Faces rather than abstract marks, because this is the one
   * place in the app where the icon has to carry a feeling and not a
   * category — and because the set it replaces was half faces and half
   * symbols, which is why it never looked like a set.
   */
  | 'moodThriving' | 'moodEnergized' | 'moodFocused' | 'moodRelaxed'
  | 'moodNeutral'  | 'moodBusy'      | 'moodStressed' | 'moodDrained'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Pixel size; icons are square. */
  size?: number
  /** Supply only when this icon is the only meaning available. */
  label?: string
}

/* Paths are stroked, never filled, so weight stays even at every size. */
const PATHS: Record<IconName, React.ReactNode> = {
  run: <><circle cx="14.5" cy="4.5" r="1.8" /><path d="M12 21l2.2-5.4-2.9-2.4-.8 3.4" /><path d="M13.3 8.2 9.6 9.9l-1.3 3.1" /><path d="m13.3 8.2 3.1 2.2 2.6-.5" /><path d="m14.3 13.2 1.9 2.4 1.4 4.1" /></>,
  walk: <><circle cx="13.5" cy="4.5" r="1.8" /><path d="M11 21l1.6-5.2-2.1-2.6.9-4.3" /><path d="m11.4 8.9 3.2 1.7 1 3.1" /><path d="m14.2 13.6 1.4 3.2.8 4.2" /></>,
  bike: <><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M8.5 17h4l4-8" /><path d="M11 9h4" /><path d="m14 9 2.5 8" /><circle cx="17.5" cy="4.5" r="1.5" /></>,
  swim: <><circle cx="16" cy="7" r="1.8" /><path d="m4 12 3-2 4 2.5 3-2" /><path d="M3 17.5c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0 2.4-1 3.6-.6" /></>,
  row: <><circle cx="16" cy="5" r="1.8" /><path d="M3 19h18" /><path d="m6 15 5-2 3.5 2 2-4" /><path d="m11 13-2-3.5 4-1.5 2 2.5 3 .5" /></>,
  hike: <><circle cx="13" cy="4.5" r="1.8" /><path d="M19 3v18" /><path d="M10 21l1.6-5.6-2.2-2.5 1-4.1" /><path d="m10.4 8.8 3.4 1.9.8 3" /><path d="m14.6 13.7 1.2 3.1.6 4.2" /></>,
  yoga: <><circle cx="12" cy="4.5" r="1.8" /><path d="M12 8v4" /><path d="M6 20c1.5-3 3.8-4.5 6-4.5s4.5 1.5 6 4.5" /><path d="M5 12h14" /></>,
  elliptical: <><ellipse cx="12" cy="16.5" rx="8" ry="4" /><path d="M8 15.5 15 6" /><circle cx="15.8" cy="4.6" r="1.6" /></>,
  dumbbell: <><path d="M4 9v6M7 7v10M17 7v10M20 9v6" /><path d="M7 12h10" /></>,
  barbell: <><path d="M3 9v6M6 7v10M18 7v10M21 9v6" /><path d="M6 12h12" /></>,
  stopwatch: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5" /><path d="M9.5 2h5" /><path d="m18.5 6.5 1.5-1.5" /></>,
  heart: <path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  flame: <><path d="M12 21c3.3 0 6-2.4 6-5.6 0-3.9-4-5.3-3.2-9.4-2.6.6-4 2.6-4 4.8 0 1-.7 1.7-1.4 1.2-.6-.4-.9-1.2-.9-2C6.9 11.6 6 13.4 6 15.4 6 18.6 8.7 21 12 21Z" /></>,

  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 2" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4.2" cy="6" r="1" /><circle cx="4.2" cy="12" r="1" /><circle cx="4.2" cy="18" r="1" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 20v-6M12 20V6M17 20v-9" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,

  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  edit: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 13h9l1-13" /></>,
  chevronLeft: <path d="m14.5 5-7 7 7 7" />,
  chevronRight: <path d="m9.5 5 7 7-7 7" />,
  chevronDown: <path d="m5 9.5 7 7 7-7" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  pause: <><path d="M9 5v14M15 5v14" /></>,
  reset: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>,
  sparkle: <><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" /><path d="M18.5 16.5 19.2 19l2.3.8-2.3.8-.7 2.4" /></>,
  upload: <><path d="M12 16V4.5" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></>,
  link: <><path d="M10 14a3.6 3.6 0 0 0 5.4.4l2.8-2.8a3.6 3.6 0 0 0-5.1-5.1L11.6 8" /><path d="M14 10a3.6 3.6 0 0 0-5.4-.4l-2.8 2.8a3.6 3.6 0 0 0 5.1 5.1L12.4 16" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  shuffle: <><path d="M3 7h3.5l9 10H21" /><path d="M3 17h3.5l3-3.3" /><path d="m14.2 9.3 1.3-1.3H21" /><path d="m18.5 4.5 2.5 3.5-2.5 3.5" /><path d="m18.5 13.5 2.5 3.5-2.5 3.5" /></>,
  camera: <><path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3v10a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  pin: <><path d="M12 21s6.5-6.2 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14.8 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.4" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5h10.5l-1.8 3.5L16.5 12H6" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 14.5v2.5" /></>,
  bell: <><path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6" /><path d="M4.5 17h15" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
  bolt: <><path d="M13.5 2.5 5.5 13.5h5.2L10 21.5l8.2-11.2h-5.4Z" /></>,
  spiral: <><path d="M12 12a2 2 0 1 1 2.6 1.9A4.2 4.2 0 0 1 9.5 12a6.4 6.4 0 0 1 8.2-6.1 8.6 8.6 0 0 1 5 10.9" /></>,

  brain: <><path d="M12 5.5v14" /><path d="M12 7a3 3 0 0 0-5.6-1.3A2.8 2.8 0 0 0 4 8.4a2.9 2.9 0 0 0 .8 2 3 3 0 0 0 .5 4.4A3 3 0 0 0 9 18.8a3 3 0 0 0 3-1.8" /><path d="M12 7a3 3 0 0 1 5.6-1.3A2.8 2.8 0 0 1 20 8.4a2.9 2.9 0 0 1-.8 2 3 3 0 0 1-.5 4.4A3 3 0 0 1 15 18.8a3 3 0 0 1-3-1.8" /></>,
  book: <><path d="M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v13H7.5A2.5 2.5 0 0 1 5 17.5Z" /><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H17" /><path d="M19.5 6v14" /></>,
  bookOpen: <><path d="M12 7.5v12" /><path d="M12 7.5C10.6 6.2 8.7 5.5 6 5.5H3.5v12H6c2.7 0 4.6.7 6 2" /><path d="M12 7.5c1.4-1.3 3.3-2 6-2h2.5v12H18c-2.7 0-4.6.7-6 2" /></>,
  graduation: <><path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5Z" /><path d="M6.5 11.5v4.8c0 1.5 2.5 2.7 5.5 2.7s5.5-1.2 5.5-2.7v-4.8" /><path d="M21.5 9.5v5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" /></>,
  note: <><path d="M5 4.5h11l3.5 3.5v11.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4.5Z" /><path d="M15.5 4.5V8h4" /><path d="M7.5 12.5h8M7.5 16h5" /></>,
  clipboard: <><rect x="5" y="5" width="14" height="15.5" rx="2" /><path d="M9 5V3.8h6V5" /><path d="M8.5 10.5h7M8.5 14h5" /></>,
  document: <><path d="M6 3.5h8L19 8v12.5H6Z" /><path d="M13.5 3.5V8H19" /><path d="M9 12.5h7M9 16h4.5" /></>,
  trendingUp: <><path d="M3.5 17 9 11l3.5 3.5L20 7" /><path d="M15.5 7H20v4.5" /></>,
  trophy: <><path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0Z" /><path d="M7.5 6H5a2.5 2.5 0 0 0 2.5 2.5" /><path d="M16.5 6H19a2.5 2.5 0 0 1-2.5 2.5" /><path d="M12 14v3.5" /><path d="M8.5 20.5h7" /><path d="M9.8 17.5h4.4l.8 3H9Z" /></>,
  alert: <><path d="M12 4.5 21 19.5H3Z" /><path d="M12 10v4" /><circle cx="12" cy="16.8" r=".9" /></>,

  plant: <><path d="M6.5 13.5h11l-1 6a1.5 1.5 0 0 1-1.5 1.3H9a1.5 1.5 0 0 1-1.5-1.3Z" /><path d="M12 13.5V8" /><path d="M12 9.5C12 6.7 10 4.5 7.5 4.5c0 2.8 2 5 4.5 5Z" /><path d="M12 11c0-2.5 1.8-4.5 4-4.5 0 2.5-1.8 4.5-4 4.5Z" /></>,
  plantWilted: <><path d="M6.5 13.5h11l-1 6a1.5 1.5 0 0 1-1.5 1.3H9a1.5 1.5 0 0 1-1.5-1.3Z" /><path d="M12 13.5c0-4 .6-6.5 2.5-7.5" /><path d="M14.5 6c1.9-.6 3.4.3 4 1.9-1.9.9-3.5.3-4-1.9Z" /><path d="M12.6 9.4c-1.5-1.2-3.2-1.1-4.4.2 1.4 1.4 3.1 1.4 4.4-.2Z" /></>,
  sprout: <><path d="M12 20.5v-7" /><path d="M12 15C12 11.9 9.5 9.5 6.3 9.5c0 3.1 2.5 5.5 5.7 5.5Z" /><path d="M12 13.8c0-2.8 2.3-5 5.2-5 0 2.8-2.3 5-5.2 5Z" /></>,
  leaf: <><path d="M20 4.5C10.5 4.5 5 8.6 5 14.5A5.5 5.5 0 0 0 10.5 20c5.9 0 9.5-6 9.5-15.5Z" /><path d="M17 7.5 7.5 17" /></>,
  tree: <><path d="M12 21v-4.5" /><path d="m12 3 5.5 7.5h-3l4 5.5h-13l4-5.5h-3Z" /></>,
  droplet: <><path d="M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5Z" /></>,

  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" /><path d="m5.6 5.6 1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" /></>,
  cloudSun: <><circle cx="8" cy="7.5" r="3" /><path d="M8 2.6v1.4M3.1 7.5h1.4M4.5 4 5.5 5M11.5 4l-1 1" /><path d="M9.5 19.5h8.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5.9 3 3 0 0 0 .7 6.1Z" /></>,
  cloud: <><path d="M7.5 18.5h9.5a3.75 3.75 0 0 0 .3-7.5 5.4 5.4 0 0 0-10.2 1 3.25 3.25 0 0 0 .4 6.5Z" /></>,
  rain: <><path d="M7.5 15.5h9.5a3.75 3.75 0 0 0 .3-7.5 5.4 5.4 0 0 0-10.2 1 3.25 3.25 0 0 0 .4 6.5Z" /><path d="M9 18.5 8 21M13 18.5 12 21M17 18.5 16 21" /></>,
  snow: <><path d="M7.5 15.5h9.5a3.75 3.75 0 0 0 .3-7.5 5.4 5.4 0 0 0-10.2 1 3.25 3.25 0 0 0 .4 6.5Z" /><path d="M9 19h.01M13 19h.01M17 19h.01M11 21.3h.01M15 21.3h.01" /></>,
  fog: <><path d="M7.5 13.5h9.5a3.75 3.75 0 0 0 .3-7.5A5.4 5.4 0 0 0 7.1 7a3.25 3.25 0 0 0 .4 6.5Z" /><path d="M5 17h14M7 20.3h11" /></>,
  storm: <><path d="M7.5 14h9.5a3.75 3.75 0 0 0 .3-7.5 5.4 5.4 0 0 0-10.2 1A3.25 3.25 0 0 0 7.5 14Z" /><path d="M13.2 16h-3l2.2 2.6h-2.6L13.4 22l-.9-3.4h2.7Z" /></>,
  sunrise: <><path d="M12 4v5" /><path d="m8.5 7.5 3.5-3.5 3.5 3.5" /><path d="M3.5 18.5h17" /><path d="M6.5 14.5a5.5 5.5 0 0 1 11 0" /></>,
  moon: <><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></>,

  backpack: <><rect x="5" y="7" width="14" height="13.5" rx="3" /><path d="M9 7V5.5a3 3 0 0 1 6 0V7" /><path d="M9 13h6" /><path d="M9.5 20.5v-4a2.5 2.5 0 0 1 5 0v4" /></>,
  microwave: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><rect x="5" y="8.5" width="10" height="7" rx="1" /><path d="M18 9.5v.01M18 13v3" /></>,
  fridge: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M6 10h12" /><path d="M9 6.5v2M9 12.5v2.5" /></>,
  pan: <><ellipse cx="10" cy="13.5" rx="6.5" ry="4.5" /><path d="M16.4 12.5 21.5 10" /><path d="M8 6.5c0-1.2 1.5-1.2 1.5-2.4M11.5 6.5c0-1.2 1.5-1.2 1.5-2.4" /></>,
  wheat: <><path d="M12 21v-8" /><path d="M12 13c-1.9 0-3.4-1.5-3.4-3.4C10.5 9.6 12 11.1 12 13Z" /><path d="M12 13c1.9 0 3.4-1.5 3.4-3.4C13.5 9.6 12 11.1 12 13Z" /><path d="M12 9c-1.9 0-3.4-1.5-3.4-3.4C10.5 5.6 12 7.1 12 9Z" /><path d="M12 9c1.9 0 3.4-1.5 3.4-3.4C13.5 5.6 12 7.1 12 9Z" /><path d="M12 5.4c-1.3-.9-1.7-2.6-.9-3.9.9.9 1.3 2.6.9 3.9Z" /></>,
  milk: <><path d="M9 3h6v2.8l2 3.4V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9.2l2-3.4Z" /><path d="M7 12h10" /></>,
  nut: <><path d="M6.5 8.5h11" /><path d="M7 8.5c0-2.2 2.2-4 5-4s5 1.8 5 4" /><path d="M7.6 8.5c0 4.3 2 8 4.4 10.2 2.4-2.2 4.4-5.9 4.4-10.2" /><path d="M12 18.7V21" /></>,
  store: <><path d="M4 9.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /><path d="M3 9.5 5 4.5h14l2 5" /><path d="M9.5 20.5v-6h5v6" /></>,
  school: <><path d="M4 20.5V9l8-5 8 5v11.5" /><path d="M2.5 20.5h19" /><path d="M9.5 20.5v-6h5v6" /><path d="M12 7.5v3" /></>,

  briefcase: <><rect x="3" y="7.5" width="18" height="12.5" rx="2" /><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" /><path d="M3 12.5h18" /></>,
  people: <><circle cx="8.5" cy="8" r="2.8" /><path d="M3 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="16.8" cy="9.2" r="2.2" /><path d="M15 14.9c2.9-.6 6 1.2 6 4.6" /></>,
  building: <><path d="M4.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15.5 5v15.5" /><path d="M15.5 10h3A1.5 1.5 0 0 1 20 11.5v9" /><path d="M3 20.5h18" /><path d="M8 7.5h4M8 11.5h4M8 15.5h4" /></>,
  rocket: <><path d="M12 3c2.6 2.6 4 6 4 9.6l-1.6 2.4H9.6L8 12.6C8 9 9.4 5.6 12 3Z" /><circle cx="12" cy="9.5" r="1.7" /><path d="M9.6 12.6 7 14.2v3.3l2.4-1.5M14.4 12.6 17 14.2v3.3l-2.4-1.5" /><path d="M10.8 17.5 12 21l1.2-3.5" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-1.5-1.3-1.7-1.3-2.9 0-.9.8-1.6 1.8-1.6h1.6a4.4 4.4 0 0 0 4.4-4.4c0-3.5-3.8-6.3-8.5-6.3Z" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="7.8" r="1" /><circle cx="16" cy="9.8" r="1" /></>,
  code: <><path d="m8.5 8.5-4.5 3.5 4.5 3.5" /><path d="m15.5 8.5 4.5 3.5-4.5 3.5" /><path d="m13.5 5-3 14" /></>,
  video: <><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="m15.5 10.5 6-3v9l-6-3Z" /></>,

  box: <><path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4Z" /><path d="M3.5 8 12 12l8.5-4" /><path d="M12 12v8" /></>,
  tower: <><path d="m12 2.5 3.5 3h-7Z" /><path d="M8.5 5.5h7v3h-7Z" /><path d="M9.2 8.5 6.5 21M14.8 8.5 17.5 21" /><path d="M9.9 11.5h4.2M9.1 15.5h5.8" /><path d="M5 21h14" /></>,
  tent: <><path d="M12 4 3 20h18Z" /><path d="M12 4v16" /><path d="m12 12 4.5 8M12 12l-4.5 8" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  music: <><path d="M9 18V5.5l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /></>,
  waves: <><path d="M2.5 8.5c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 3.2-1.2 4.8 0 3.2 1.2 4.6 0" /><path d="M2.5 13c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 3.2-1.2 4.8 0 3.2 1.2 4.6 0" /><path d="M2.5 17.5c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 3.2-1.2 4.8 0 3.2 1.2 4.6 0" /></>,
  swords: <><path d="M14.5 3.5h5v5L11 17l-2.5-2.5Z" /><path d="M9.5 3.5h-5v5L13 17l2.5-2.5Z" /><path d="m4.5 19.5 3-3M19.5 19.5l-3-3" /></>,

  moodThriving: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 13.5a4.5 4.5 0 0 0 7 0" /><path d="M8.2 9.2 9.5 10M15.8 9.2 14.5 10" /><circle cx="9.3" cy="10.6" r=".8" /><circle cx="14.7" cy="10.6" r=".8" /></>,
  moodEnergized: <><circle cx="12" cy="12" r="8.5" /><path d="M9 13.8a4 4 0 0 0 6 0" /><circle cx="9.3" cy="10.2" r=".8" /><circle cx="14.7" cy="10.2" r=".8" /><path d="m20 3 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" /></>,
  moodFocused: <><circle cx="12" cy="12" r="8.5" /><path d="M10 14.5h4" /><path d="M8 10.2h2.6M13.4 10.2H16" /></>,
  moodRelaxed: <><circle cx="12" cy="12" r="8.5" /><path d="M9.2 14a3.7 3.7 0 0 0 5.6 0" /><path d="M8.4 10.3a1.7 1.7 0 0 1 2.4 0M13.2 10.3a1.7 1.7 0 0 1 2.4 0" /></>,
  moodNeutral: <><circle cx="12" cy="12" r="8.5" /><path d="M9.2 14.4h5.6" /><circle cx="9.3" cy="10.2" r=".8" /><circle cx="14.7" cy="10.2" r=".8" /></>,
  moodBusy: <><circle cx="12" cy="12" r="8.5" /><path d="m9 14.6 1.5-1.2 1.5 1.2 1.5-1.2 1.5 1.2" /><circle cx="9.3" cy="10.2" r=".8" /><circle cx="14.7" cy="10.2" r=".8" /></>,
  moodStressed: <><circle cx="12" cy="12" r="8.5" /><path d="M9.2 15.6a3.7 3.7 0 0 1 5.6 0" /><path d="M8.2 8.8 10.6 10M15.8 8.8 13.4 10" /><circle cx="9.5" cy="11.4" r=".8" /><circle cx="14.5" cy="11.4" r=".8" /></>,
  moodDrained: <><circle cx="12" cy="12" r="8.5" /><path d="M10 15h4" /><path d="M8.2 10.4a1.8 1.8 0 0 0 2.6 0M13.2 10.4a1.8 1.8 0 0 0 2.6 0" /></>,
}

export default function Icon({ name, size = 18, label, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      /*
       * inline-block with an optical baseline nudge, not block.
       *
       * Block was right when every icon lived in a flex row, where the
       * display value is ignored anyway. It is wrong the moment one sits
       * inline with text — `<Icon /> Dining Hall` — because a block
       * element takes the whole line and drops the label beneath it.
       * inline-block behaves identically inside flex containers and
       * correctly outside them, and the -0.14em lifts it off the text
       * baseline so it centres against the label rather than sitting on
       * the descender line.
       */
      style={{ display: 'inline-block', verticalAlign: '-0.14em', flexShrink: 0, ...rest.style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
