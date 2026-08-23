/**
 * lib/weatherIcons.ts — one condition-to-icon map.
 *
 * There were two: one in the Topbar chip and one in the weather widget,
 * with different emoji for the same conditions ('☀' against '☀️'), so
 * the same weather was drawn two ways on one screen. Whichever one was
 * edited, the other drifted.
 *
 * The strings are Open-Meteo's WMO labels as `conditionToLabel()`
 * produces them, so this map has to be updated alongside that function
 * and nowhere else.
 */

import type { IconName } from '@/components/ui/Icon'

const CONDITION_ICON: Record<string, IconName> = {
  'Clear sky':                  'sun',
  'Mainly clear':               'sun',
  'Partly cloudy':              'cloudSun',
  'Overcast':                   'cloud',
  'Foggy':                      'fog',
  'Icy fog':                    'fog',
  'Light drizzle':              'rain',
  'Drizzle':                    'rain',
  'Heavy drizzle':              'rain',
  'Light rain':                 'rain',
  'Rain':                       'rain',
  'Heavy rain':                 'rain',
  'Light snow':                 'snow',
  'Snow':                       'snow',
  'Heavy snow':                 'snow',
  'Snow grains':                'snow',
  'Rain showers':               'rain',
  'Showers':                    'rain',
  'Heavy showers':              'rain',
  'Snow showers':               'snow',
  'Heavy snow showers':         'snow',
  'Thunderstorm':               'storm',
  'Thunderstorm w/ hail':       'storm',
  'Thunderstorm w/ heavy hail': 'storm',
}

/**
 * Falls back to a plain cloud rather than a thermometer.
 *
 * An unknown condition means we could not read the sky, and a cloud is
 * the least wrong thing to draw; a thermometer claims to be about
 * temperature, which is shown next to it as a number anyway.
 */
export function weatherIcon(condition: string): IconName {
  return CONDITION_ICON[condition] ?? 'cloud'
}
