/* ════════════════════════════════════════════════════════════════
   Zenith OS — Aquascaping Biological Compatibility Engine
   Phase 4 · Step 4.1

   Exports:
     SPECIES_LIBRARY  — 32-species reference database
     analyzeCompatibility(config, inhabitants) → CompatibilityReport

   Algorithm:
     1. Temperature overlap intersection across all fauna
     2. pH overlap intersection across all fauna
     3. Current tank params vs. per-species optimal range
     4. Predator / prey threat matrix (aggression × type)
     5. Minimum tank size per species
     6. Cumulative bioload as % of tank capacity
   ════════════════════════════════════════════════════════════════ */

import type {
  AquaSpecies,
  TankInhabitant,
  TankConfig,
  CompatibilityConflict,
  BioloadResult,
  CompatibilityReport,
} from '@/types/aquascaping'

/** Bioload units the tank biological filter can sustain per gallon */
const BIOLOAD_PER_GALLON = 1.5

/* ── Species Library ──────────────────────────────────────────── */

export const SPECIES_LIBRARY: AquaSpecies[] = [
  // ── Peaceful Fish ──────────────────────────────────────────
  {
    id: 'neon-tetra',
    name: 'Neon Tetra',
    type: 'fish',
    minTankSize: 10,
    tempMin: 68, tempMax: 79,
    phMin: 6.0, phMax: 7.0,
    aggression: 'peaceful',
    bioloadRating: 0.30,
  },
  {
    id: 'cardinal-tetra',
    name: 'Cardinal Tetra',
    type: 'fish',
    minTankSize: 10,
    tempMin: 73, tempMax: 82,
    phMin: 4.6, phMax: 6.2,
    aggression: 'peaceful',
    bioloadRating: 0.30,
  },
  {
    id: 'honey-gourami',
    name: 'Honey Gourami',
    type: 'fish',
    minTankSize: 10,
    tempMin: 72, tempMax: 82,
    phMin: 6.0, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: 0.60,
  },
  {
    id: 'harlequin-rasbora',
    name: 'Harlequin Rasbora',
    type: 'fish',
    minTankSize: 10,
    tempMin: 72, tempMax: 82,
    phMin: 6.0, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: 0.30,
  },
  {
    id: 'corydoras',
    name: 'Corydoras Catfish',
    type: 'fish',
    minTankSize: 10,
    tempMin: 72, tempMax: 80,
    phMin: 6.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.40,
  },
  {
    id: 'kuhli-loach',
    name: 'Kuhli Loach',
    type: 'fish',
    minTankSize: 20,
    tempMin: 75, tempMax: 86,
    phMin: 5.5, phMax: 6.5,
    aggression: 'peaceful',
    bioloadRating: 0.50,
  },
  {
    id: 'otocinclus',
    name: 'Otocinclus Catfish',
    type: 'fish',
    minTankSize: 10,
    tempMin: 72, tempMax: 82,
    phMin: 6.0, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: 0.20,
  },
  {
    id: 'endler',
    name: "Endler's Livebearer",
    type: 'fish',
    minTankSize: 5,
    tempMin: 72, tempMax: 82,
    phMin: 7.0, phMax: 8.5,
    aggression: 'peaceful',
    bioloadRating: 0.25,
  },
  {
    id: 'zebra-danio',
    name: 'Zebra Danio',
    type: 'fish',
    minTankSize: 10,
    tempMin: 64, tempMax: 77,
    phMin: 6.5, phMax: 7.0,
    aggression: 'peaceful',
    bioloadRating: 0.30,
  },
  {
    id: 'goldfish',
    name: 'Common Goldfish',
    type: 'fish',
    minTankSize: 20,
    tempMin: 50, tempMax: 72,
    phMin: 6.5, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: 2.00,
  },
  {
    id: 'discus',
    name: 'Discus',
    type: 'fish',
    minTankSize: 55,
    tempMin: 82, tempMax: 90,
    phMin: 5.5, phMax: 7.0,
    aggression: 'peaceful',
    bioloadRating: 2.00,
  },
  {
    id: 'cherry-barb',
    name: 'Cherry Barb',
    type: 'fish',
    minTankSize: 10,
    tempMin: 73, tempMax: 82,
    phMin: 6.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.35,
  },
  // ── Semi-aggressive Fish ────────────────────────────────────
  {
    id: 'betta',
    name: 'Betta Fish',
    type: 'fish',
    minTankSize: 5,
    tempMin: 75, tempMax: 86,
    phMin: 6.0, phMax: 8.0,
    aggression: 'semi-aggressive',
    bioloadRating: 0.50,
  },
  {
    id: 'angelfish',
    name: 'Angelfish',
    type: 'fish',
    minTankSize: 30,
    tempMin: 75, tempMax: 84,
    phMin: 6.0, phMax: 7.5,
    aggression: 'semi-aggressive',
    bioloadRating: 1.50,
  },
  {
    id: 'tiger-barb',
    name: 'Tiger Barb',
    type: 'fish',
    minTankSize: 20,
    tempMin: 68, tempMax: 79,
    phMin: 6.0, phMax: 8.0,
    aggression: 'semi-aggressive',
    bioloadRating: 0.50,
  },
  {
    id: 'pearl-gourami',
    name: 'Pearl Gourami',
    type: 'fish',
    minTankSize: 30,
    tempMin: 75, tempMax: 86,
    phMin: 5.5, phMax: 7.5,
    aggression: 'semi-aggressive',
    bioloadRating: 0.80,
  },
  // ── Aggressive Fish ─────────────────────────────────────────
  {
    id: 'oscar',
    name: 'Oscar Cichlid',
    type: 'fish',
    minTankSize: 75,
    tempMin: 73, tempMax: 82,
    phMin: 6.0, phMax: 8.0,
    aggression: 'aggressive',
    bioloadRating: 4.00,
  },
  {
    id: 'red-devil',
    name: 'Red Devil Cichlid',
    type: 'fish',
    minTankSize: 55,
    tempMin: 70, tempMax: 82,
    phMin: 6.5, phMax: 7.5,
    aggression: 'aggressive',
    bioloadRating: 3.50,
  },
  {
    id: 'flowerhorn',
    name: 'Flowerhorn Cichlid',
    type: 'fish',
    minTankSize: 75,
    tempMin: 78, tempMax: 85,
    phMin: 6.5, phMax: 7.8,
    aggression: 'aggressive',
    bioloadRating: 4.00,
  },
  // ── Shrimp ──────────────────────────────────────────────────
  {
    id: 'cherry-shrimp',
    name: 'Cherry Shrimp',
    type: 'shrimp',
    minTankSize: 5,
    tempMin: 65, tempMax: 79,
    phMin: 6.5, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.05,
  },
  {
    id: 'amano-shrimp',
    name: 'Amano Shrimp',
    type: 'shrimp',
    minTankSize: 10,
    tempMin: 68, tempMax: 82,
    phMin: 6.5, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: 0.08,
  },
  {
    id: 'ghost-shrimp',
    name: 'Ghost Shrimp',
    type: 'shrimp',
    minTankSize: 5,
    tempMin: 65, tempMax: 77,
    phMin: 7.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.05,
  },
  {
    id: 'crystal-red-shrimp',
    name: 'Crystal Red Shrimp',
    type: 'shrimp',
    minTankSize: 10,
    tempMin: 62, tempMax: 72,
    phMin: 6.0, phMax: 7.0,
    aggression: 'peaceful',
    bioloadRating: 0.06,
  },
  {
    id: 'blue-velvet-shrimp',
    name: 'Blue Velvet Shrimp',
    type: 'shrimp',
    minTankSize: 5,
    tempMin: 65, tempMax: 79,
    phMin: 6.5, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.05,
  },
  // ── Snails ──────────────────────────────────────────────────
  {
    id: 'nerite-snail',
    name: 'Nerite Snail',
    type: 'snail',
    minTankSize: 5,
    tempMin: 72, tempMax: 80,
    phMin: 7.0, phMax: 8.5,
    aggression: 'peaceful',
    bioloadRating: 0.15,
  },
  {
    id: 'mystery-snail',
    name: 'Mystery Snail',
    type: 'snail',
    minTankSize: 5,
    tempMin: 68, tempMax: 82,
    phMin: 7.5, phMax: 8.5,
    aggression: 'peaceful',
    bioloadRating: 0.20,
  },
  {
    id: 'trumpet-snail',
    name: 'Malaysian Trumpet Snail',
    type: 'snail',
    minTankSize: 5,
    tempMin: 72, tempMax: 82,
    phMin: 7.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: 0.10,
  },
  // ── Plants ──────────────────────────────────────────────────
  {
    id: 'java-fern',
    name: 'Java Fern',
    type: 'plant',
    minTankSize: 5,
    tempMin: 64, tempMax: 82,
    phMin: 6.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: -0.15,
  },
  {
    id: 'anubias',
    name: 'Anubias Nana',
    type: 'plant',
    minTankSize: 5,
    tempMin: 72, tempMax: 82,
    phMin: 6.0, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: -0.12,
  },
  {
    id: 'amazon-sword',
    name: 'Amazon Sword',
    type: 'plant',
    minTankSize: 10,
    tempMin: 72, tempMax: 82,
    phMin: 6.5, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: -0.20,
  },
  {
    id: 'hornwort',
    name: 'Hornwort',
    type: 'plant',
    minTankSize: 5,
    tempMin: 59, tempMax: 77,
    phMin: 6.0, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: -0.25,
  },
  {
    id: 'java-moss',
    name: 'Java Moss',
    type: 'plant',
    minTankSize: 5,
    tempMin: 64, tempMax: 86,
    phMin: 5.5, phMax: 8.0,
    aggression: 'peaceful',
    bioloadRating: -0.10,
  },
  {
    id: 'vallisneria',
    name: 'Vallisneria',
    type: 'plant',
    minTankSize: 10,
    tempMin: 59, tempMax: 82,
    phMin: 6.5, phMax: 8.5,
    aggression: 'peaceful',
    bioloadRating: -0.18,
  },
  {
    id: 'water-wisteria',
    name: 'Water Wisteria',
    type: 'plant',
    minTankSize: 10,
    tempMin: 70, tempMax: 82,
    phMin: 6.5, phMax: 7.5,
    aggression: 'peaceful',
    bioloadRating: -0.22,
  },
]

/* ── Analysis Engine ──────────────────────────────────────────── */

export function analyzeCompatibility(
  config: TankConfig,
  inhabitants: TankInhabitant[],
): CompatibilityReport {
  const conflicts: CompatibilityConflict[] = []

  // Plants are excluded from behavioral / temperature-overlap checks
  const fauna        = inhabitants.filter(i => i.species.type !== 'plant')
  const faunaSpecies = fauna.map(i => i.species)

  // ── 1. Temperature overlap intersection ──────────────────────
  let overlapTempMin: number | null = null
  let overlapTempMax: number | null = null

  if (faunaSpecies.length >= 1) {
    const rangeMin = Math.max(...faunaSpecies.map(s => s.tempMin))
    const rangeMax = Math.min(...faunaSpecies.map(s => s.tempMax))

    if (rangeMin <= rangeMax) {
      overlapTempMin = rangeMin
      overlapTempMax = rangeMax
    } else {
      const cold = faunaSpecies.filter(s => s.tempMax < rangeMin)
      const warm = faunaSpecies.filter(s => s.tempMin > rangeMax)
      conflicts.push({
        type: 'temperature',
        severity: 'critical',
        message:
          `No viable temperature overlap. Cold-water species (${cold.map(s => s.name).join(', ')}) ` +
          `require temperatures that cold-exclude warm-water species (${warm.map(s => s.name).join(', ')}). ` +
          `Their ranges are mutually exclusive.`,
        speciesInvolved: [...cold, ...warm].map(s => s.name),
      })
    }
  }

  // ── 2. pH overlap intersection ────────────────────────────────
  let overlapPhMin: number | null = null
  let overlapPhMax: number | null = null

  if (faunaSpecies.length >= 1) {
    const phMin = Math.max(...faunaSpecies.map(s => s.phMin))
    const phMax = Math.min(...faunaSpecies.map(s => s.phMax))

    if (phMin <= phMax) {
      overlapPhMin = phMin
      overlapPhMax = phMax
    } else {
      const acidic   = faunaSpecies.filter(s => s.phMax < phMin)
      const alkaline = faunaSpecies.filter(s => s.phMin > phMax)
      conflicts.push({
        type: 'ph',
        severity: 'critical',
        message:
          `Incompatible pH requirements. Soft-water acidophiles (${acidic.map(s => s.name).join(', ')}) ` +
          `cannot coexist with alkaline-preferring species (${alkaline.map(s => s.name).join(', ')}). ` +
          `No safe pH setpoint exists.`,
        speciesInvolved: [...acidic, ...alkaline].map(s => s.name),
      })
    }
  }

  // ── 3. Current tank parameters vs. per-species optimum ───────
  for (const { species } of fauna) {
    if (config.temperature < species.tempMin || config.temperature > species.tempMax) {
      conflicts.push({
        type: 'temperature',
        severity: 'warning',
        message:
          `Current tank temperature (${config.temperature}°F) is outside the optimal range for ` +
          `${species.name} (${species.tempMin}–${species.tempMax}°F).`,
        speciesInvolved: [species.name],
      })
    }
    if (config.pH < species.phMin || config.pH > species.phMax) {
      conflicts.push({
        type: 'ph',
        severity: 'warning',
        message:
          `Current tank pH (${config.pH.toFixed(1)}) is outside the optimal range for ` +
          `${species.name} (pH ${species.phMin}–${species.phMax}).`,
        speciesInvolved: [species.name],
      })
    }
  }

  // ── 4. Predator / Prey threat matrix ─────────────────────────
  const aggressors    = fauna.filter(i => i.species.type === 'fish' && i.species.aggression === 'aggressive')
  const semiAgg       = fauna.filter(i => i.species.type === 'fish' && i.species.aggression === 'semi-aggressive')
  const shrimpGroup   = fauna.filter(i => i.species.type === 'shrimp')
  const peacefulFish  = fauna.filter(i => i.species.type === 'fish' && i.species.aggression === 'peaceful')

  if (aggressors.length > 0 && shrimpGroup.length > 0) {
    conflicts.push({
      type: 'predator_prey',
      severity: 'critical',
      message:
        `Lethal predation threat: ${aggressors.map(i => i.species.name).join(', ')} will actively ` +
        `hunt and consume ${shrimpGroup.map(i => i.species.name).join(', ')}. These species cannot safely coexist.`,
      speciesInvolved: [
        ...aggressors.map(i => i.species.name),
        ...shrimpGroup.map(i => i.species.name),
      ],
    })
  }

  if (semiAgg.length > 0 && shrimpGroup.length > 0) {
    conflicts.push({
      type: 'predator_prey',
      severity: 'warning',
      message:
        `Predation risk: ${semiAgg.map(i => i.species.name).join(', ')} may harass or consume ` +
        `${shrimpGroup.map(i => i.species.name).join(', ')}, especially juveniles. Provide dense plant cover.`,
      speciesInvolved: [
        ...semiAgg.map(i => i.species.name),
        ...shrimpGroup.map(i => i.species.name),
      ],
    })
  }

  if (aggressors.length > 0 && peacefulFish.length > 0) {
    conflicts.push({
      type: 'aggression',
      severity: 'warning',
      message:
        `Aggression risk: ${aggressors.map(i => i.species.name).join(', ')} may bully or injure ` +
        `${peacefulFish.map(i => i.species.name).join(', ')}. Fin-nipping and territory dominance are likely.`,
      speciesInvolved: [
        ...aggressors.map(i => i.species.name),
        ...peacefulFish.map(i => i.species.name),
      ],
    })
  }

  // ── 5. Minimum tank size per species ─────────────────────────
  for (const { species } of inhabitants) {
    if (species.minTankSize > config.volumeGallons) {
      conflicts.push({
        type: 'tank_size',
        severity: 'critical',
        message:
          `${species.name} requires a minimum of ${species.minTankSize} gal. ` +
          `Your configured tank (${config.volumeGallons} gal) is undersized.`,
        speciesInvolved: [species.name],
      })
    }
  }

  // ── 6. Bioload calculation ────────────────────────────────────
  const totalBioload = inhabitants.reduce(
    (sum, { species, quantity }) => sum + species.bioloadRating * quantity,
    0,
  )
  const capacity    = config.volumeGallons * BIOLOAD_PER_GALLON
  const capacityPct = capacity > 0 ? (totalBioload / capacity) * 100 : 0

  const bioload: BioloadResult = {
    totalBioload: Math.round(totalBioload * 100) / 100,
    capacity:     Math.round(capacity     * 100) / 100,
    capacityPct:  Math.round(capacityPct  * 10)  / 10,
    isOverloaded: capacityPct > 100,
  }

  if (bioload.isOverloaded) {
    conflicts.push({
      type: 'tank_size',
      severity: 'warning',
      message:
        `Bioload at ${bioload.capacityPct.toFixed(1)}% of filtration capacity. ` +
        `Ammonia spikes are likely. Reduce stocking density or upgrade biological filtration.`,
      speciesInvolved: [],
    })
  }

  return {
    conflicts,
    bioload,
    overlapTempMin,
    overlapTempMax,
    overlapPhMin,
    overlapPhMax,
    isViable: !conflicts.some(c => c.severity === 'critical'),
  }
}
