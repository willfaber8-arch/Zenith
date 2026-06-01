import type { FloraEntry } from '@/types/botany'

/**
 * Seasonal flora register for Cornell Botanic Gardens and surrounding
 * Ithaca gorge corridor. peakMonths uses 0-indexed JS month values
 * (0 = January … 11 = December).
 */
export const CORNELL_FLORA: FloraEntry[] = [

  /* ── Forageable Edibles ──────────────────────────────────────── */
  {
    id: 'ramp',
    speciesName: 'Wild Ramp (Allium tricoccum)',
    type: 'forageable_edible',
    peakMonths: [3, 4],
    primaryLocations: ['Cascadilla Gorge', 'Beebe Lake Trail'],
    description:
      'Pungent wild onion relative found on moist, shaded north-facing slopes. Harvest broad spatulate leaves before canopy closure. Intense garlic-onion flavour; used in ramp butter, kimchi, and pesto.',
  },
  {
    id: 'fiddlehead',
    speciesName: 'Ostrich Fern Fiddlehead (Matteuccia struthiopteris)',
    type: 'forageable_edible',
    peakMonths: [3, 4],
    primaryLocations: ['Cascadilla Gorge', 'Forest Home Drive'],
    description:
      'Tightly coiled spring shoots harvested when under 6 inches. The brown papery sheath distinguishes safe Ostrich Fern from toxic lookalikes. Blanch before eating; rich in antioxidants and iron.',
  },
  {
    id: 'elderflower',
    speciesName: 'Common Elderflower (Sambucus canadensis)',
    type: 'forageable_edible',
    peakMonths: [5, 6],
    primaryLocations: ['Mundell Wildflower Garden', 'Beebe Lake'],
    description:
      'Flat-topped creamy white corymbs in early summer. Harvest for elderflower cordial and fritters while in full bloom. Do not consume raw berries — fully cooked only. Foliage is toxic.',
  },
  {
    id: 'pawpaw',
    speciesName: 'Pawpaw (Asimina triloba)',
    type: 'forageable_edible',
    peakMonths: [8, 9],
    primaryLocations: ['Fall Creek Gorge', 'Six Mile Creek Corridor'],
    description:
      "Largest native fruit in North America — creamy custard-like flesh with banana-mango-vanilla flavour. Harvest when fruit yields to gentle pressure. Does not ship well; consume fresh within 3 days.",
  },
  {
    id: 'black-walnut',
    speciesName: 'Black Walnut (Juglans nigra)',
    type: 'forageable_edible',
    peakMonths: [9, 10],
    primaryLocations: ['Beebe Lake', 'Forest Home Drive'],
    description:
      'Harvest hulled nuts after green husks blacken and fruits drop. Wear thick gloves — juglone stains permanently. Intense, bold flavour compared to English walnut. Hull and dry for 2–3 weeks before cracking.',
  },
  {
    id: 'spicebush-berry',
    speciesName: 'Spicebush Berry (Lindera benzoin)',
    type: 'forageable_edible',
    peakMonths: [8, 9],
    primaryLocations: ['Cascadilla Gorge', 'Mundell Wildflower Garden'],
    description:
      'Brilliant scarlet drupes ripen in late summer on an aromatic understory shrub. Dried and ground, the berry is a traditional Appalachian spice with allspice-cinnamon notes. Host plant of the Spicebush Swallowtail caterpillar.',
  },

  /* ── Ornamental Blooms ───────────────────────────────────────── */
  {
    id: 'trout-lily',
    speciesName: 'Trout Lily (Erythronium americanum)',
    type: 'ornamental_bloom',
    peakMonths: [3, 4],
    primaryLocations: ['Mundell Wildflower Garden', 'Cascadilla Gorge'],
    description:
      'Delicate nodding yellow bloom on mottled lance-shaped leaves resembling brook trout markings. One of the earliest spring ephemerals. Peak bloom lasts only 10–14 days before canopy closure.',
  },
  {
    id: 'bloodroot',
    speciesName: 'Bloodroot (Sanguinaria canadensis)',
    type: 'ornamental_bloom',
    peakMonths: [3, 4],
    primaryLocations: ['Mundell Wildflower Garden'],
    description:
      'Pristine white bloom with golden stamens emerges wrapped in a single lobed leaf. Named for its vivid red-orange sap. Fleeting — peak bloom lasts only 3–4 days. Observe only; all parts mildly toxic.',
  },
  {
    id: 'trillium',
    speciesName: 'Large-Flowered Trillium (Trillium grandiflorum)',
    type: 'ornamental_bloom',
    peakMonths: [4, 5],
    primaryLocations: ['Mundell Wildflower Garden', 'Beebe Lake Trail'],
    description:
      'Iconic three-petalled white bloom matures to soft pink. A legally protected species in New York — observe only, never pick or transplant. A reliable indicator of high-quality old-growth forest conditions.',
  },
  {
    id: 'wild-geranium',
    speciesName: 'Wild Geranium (Geranium maculatum)',
    type: 'ornamental_bloom',
    peakMonths: [4, 5],
    primaryLocations: ['Mundell Wildflower Garden', 'Cascadilla Gorge'],
    description:
      'Five-petalled lavender-pink blooms in open clusters on deeply lobed palmate leaves. Extended bloom period through late spring. Excellent native pollinator plant; supports 40+ bee species in the northeast.',
  },
  {
    id: 'joe-pye-weed',
    speciesName: 'Sweet Joe-Pye Weed (Eutrochium purpureum)',
    type: 'ornamental_bloom',
    peakMonths: [7, 8],
    primaryLocations: ['Mundell Wildflower Garden', 'Beebe Lake'],
    description:
      'Towering native perennial reaching 7 ft with dome-shaped rosy-purple flower clusters. A monarch butterfly magnet in late summer. Crushed foliage releases a distinctive vanilla fragrance.',
  },
  {
    id: 'new-england-aster',
    speciesName: 'New England Aster (Symphyotrichum novae-angliae)',
    type: 'ornamental_bloom',
    peakMonths: [8, 9, 10],
    primaryLocations: ['Mundell Wildflower Garden', 'Larch Meadows'],
    description:
      'Dense violet-purple daisy-like blooms with golden disc centres. One of the last native bloomers before frost. Critical late-season nectar resource for migratory monarch butterflies and native bumblebees.',
  },

  /* ── Foliage ─────────────────────────────────────────────────── */
  {
    id: 'ostrich-fern',
    speciesName: 'Ostrich Fern (Matteuccia struthiopteris)',
    type: 'foliage',
    peakMonths: [4, 5, 6, 7, 8],
    primaryLocations: ['Cascadilla Gorge', 'Forest Home Drive'],
    description:
      'Vase-shaped colony-forming fern reaching 5 ft. Elegant arching bright green fronds create a lush tropical undercanopy effect along the Ithaca gorge stream margins.',
  },
  {
    id: 'royal-fern',
    speciesName: 'Royal Fern (Osmunda regalis)',
    type: 'foliage',
    peakMonths: [4, 5, 6, 7, 8],
    primaryLocations: ['Beebe Lake', 'Cascadilla Gorge'],
    description:
      'One of the largest ferns in eastern North America. Bi-pinnate fronds with widely spaced leaflets give a light, airy texture. Rusty brown fertile fronds contrast with sterile green fronds in summer.',
  },
  {
    id: 'maidenhair-fern',
    speciesName: 'Northern Maidenhair Fern (Adiantum pedatum)',
    type: 'foliage',
    peakMonths: [4, 5, 6, 7, 8],
    primaryLocations: ['Cascadilla Gorge', 'Mundell Wildflower Garden'],
    description:
      'Fan-shaped fronds on arching wire-like black stems with delicate fingered leaflets. Prefers the calcium-rich shale walls and shaded mesic slopes of the Ithaca gorge system.',
  },
]
