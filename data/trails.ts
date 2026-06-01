import type { Trail } from '@/types/hiking'

export const TRAILS: Trail[] = [
  {
    id: 'kaaterskill-falls',
    name: 'Kaaterskill Falls Trail',
    locationRegion: 'Catskill Mountains, NY',
    distanceMiles: 2.1,
    elevationGainFt: 380,
    difficulty: 'easy',
    features: ['waterfall', 'canopy_cover'],
    coordinates: [
      [-74.0726, 42.2012], [-74.0718, 42.2003], [-74.0711, 42.1996],
      [-74.0705, 42.1988], [-74.0699, 42.1981], [-74.0693, 42.1974],
      [-74.0689, 42.1968], [-74.0684, 42.1962],
    ],
    description:
      'Iconic two-tier falls dropping 260 ft through a sandstone amphitheatre deep in the Catskill escarpment. Dense northern hardwood canopy lines the descent to both platforms.',
  },
  {
    id: 'linville-gorge',
    name: 'Linville Gorge Wilderness Loop',
    locationRegion: 'Blue Ridge Mountains, NC',
    distanceMiles: 7.8,
    elevationGainFt: 1420,
    difficulty: 'strenuous',
    features: ['gorge_lookout', 'waterfall'],
    coordinates: [
      [-81.9285, 35.9512], [-81.9244, 35.9487], [-81.9205, 35.9461],
      [-81.9178, 35.9438], [-81.9155, 35.9419], [-81.9137, 35.9405],
      [-81.9118, 35.9388], [-81.9099, 35.9375], [-81.9079, 35.9362],
      [-81.9058, 35.9347], [-81.9038, 35.9334],
    ],
    description:
      'Rugged rim-to-river traverse above the "Grand Canyon of the East" — sheer quartzite walls plunge 2,000 ft above Linville Falls and the gorge floor.',
  },
  {
    id: 'sol-duc-falls',
    name: 'Sol Duc Falls Loop',
    locationRegion: 'Olympic National Park, WA',
    distanceMiles: 1.6,
    elevationGainFt: 200,
    difficulty: 'easy',
    features: ['waterfall', 'canopy_cover'],
    coordinates: [
      [-123.8522, 47.9534], [-123.8498, 47.9519], [-123.8473, 47.9503],
      [-123.8449, 47.9489], [-123.8426, 47.9477], [-123.8404, 47.9466],
      [-123.8383, 47.9457],
    ],
    description:
      'Old-growth Sitka spruce cathedral leads to a dramatic four-channel falls plunging into a mossy basalt grotto. One of the most accessible waterfall walks in the Pacific Northwest.',
  },
  {
    id: 'angels-landing',
    name: 'Angels Landing',
    locationRegion: 'Zion National Park, UT',
    distanceMiles: 5.4,
    elevationGainFt: 1488,
    difficulty: 'strenuous',
    features: ['gorge_lookout'],
    coordinates: [
      [-113.0093, 37.2581], [-113.0088, 37.2595], [-113.0082, 37.2610],
      [-113.0075, 37.2624], [-113.0068, 37.2639], [-113.0062, 37.2651],
      [-113.0058, 37.2664], [-113.0055, 37.2676], [-113.0052, 37.2687],
    ],
    description:
      'Chain-assisted ridge scramble to a knife-edge summit — 1,000 ft vertical drops into Zion Canyon on both flanks. A permit is required for the final chain section.',
  },
  {
    id: 'alum-cave',
    name: 'Alum Cave Trail',
    locationRegion: 'Great Smoky Mountains, TN',
    distanceMiles: 9.0,
    elevationGainFt: 2560,
    difficulty: 'moderate',
    features: ['canopy_cover', 'gorge_lookout'],
    coordinates: [
      [-83.4385, 35.6162], [-83.4351, 35.6188], [-83.4318, 35.6213],
      [-83.4285, 35.6237], [-83.4252, 35.6261], [-83.4219, 35.6284],
      [-83.4188, 35.6306], [-83.4158, 35.6327], [-83.4129, 35.6347],
      [-83.4101, 35.6366],
    ],
    description:
      'Climbs through old-growth hemlock and red spruce to a massive bluff overhang with sweeping Appalachian ridge views and an alum-mineral seep wall.',
  },
  {
    id: 'havasu-falls',
    name: 'Havasu Falls Trail',
    locationRegion: 'Havasupai Reservation, AZ',
    distanceMiles: 10.0,
    elevationGainFt: 2400,
    difficulty: 'moderate',
    features: ['waterfall', 'swimming_hole'],
    coordinates: [
      [-112.7081, 36.2559], [-112.7048, 36.2531], [-112.7015, 36.2503],
      [-112.6982, 36.2475], [-112.6949, 36.2447], [-112.6917, 36.2420],
      [-112.6886, 36.2393], [-112.6856, 36.2367], [-112.6827, 36.2341],
      [-112.6798, 36.2315], [-112.6771, 36.2290],
    ],
    description:
      'Descends into the turquoise oasis of Havasu Canyon — travertine falls and electric blue-green swimming holes carved into the Grand Canyon basin.',
  },
  {
    id: 'mist-trail',
    name: 'Mist Trail to Nevada Fall',
    locationRegion: 'Yosemite National Park, CA',
    distanceMiles: 7.2,
    elevationGainFt: 2000,
    difficulty: 'moderate',
    features: ['waterfall', 'canopy_cover'],
    coordinates: [
      [-119.5587, 37.7193], [-119.5561, 37.7208], [-119.5535, 37.7224],
      [-119.5509, 37.7239], [-119.5484, 37.7255], [-119.5460, 37.7270],
      [-119.5436, 37.7284], [-119.5413, 37.7298], [-119.5391, 37.7311],
    ],
    description:
      'Stone-staircase spray route past Vernal and Nevada Falls through the Merced River canyon. Hikers are drenched by mist from both falls on the ascent.',
  },
  {
    id: 'big-slide-mountain',
    name: 'Big Slide Mountain',
    locationRegion: 'Adirondack High Peaks, NY',
    distanceMiles: 9.8,
    elevationGainFt: 2640,
    difficulty: 'strenuous',
    features: ['gorge_lookout', 'canopy_cover'],
    coordinates: [
      [-73.9847, 44.1281], [-73.9812, 44.1314], [-73.9778, 44.1346],
      [-73.9745, 44.1378], [-73.9712, 44.1409], [-73.9680, 44.1440],
      [-73.9649, 44.1470], [-73.9619, 44.1499], [-73.9590, 44.1527],
      [-73.9562, 44.1554],
    ],
    description:
      'Remote 46er summit in the Johns Brook Valley — granite open-face slide with sweeping panoramas across the High Peaks wilderness and Keene Valley below.',
  },
]
