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
      /* Block, so no text baseline creeps in and shifts it against a label. */
      style={{ display: 'block', flexShrink: 0, ...rest.style }}
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
