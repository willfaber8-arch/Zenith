/* ════════════════════════════════════════════════════════════════
   Zenith OS — Aquascaping Type Schema
   Phase 4 · Step 4.1 — Biological Compatibility Validator
   ════════════════════════════════════════════════════════════════ */

export type SpeciesType     = 'fish' | 'shrimp' | 'snail' | 'plant'
export type AggressionLevel = 'peaceful' | 'semi-aggressive' | 'aggressive'
export type ConflictType    = 'temperature' | 'ph' | 'predator_prey' | 'tank_size' | 'aggression'
export type ConflictSeverity = 'warning' | 'critical'

export interface AquaSpecies {
  id: string
  name: string
  type: SpeciesType
  /** Minimum recommended tank volume in US gallons */
  minTankSize: number
  /** Optimal temperature range lower bound — °F */
  tempMin: number
  /** Optimal temperature range upper bound — °F */
  tempMax: number
  phMin: number
  phMax: number
  aggression: AggressionLevel
  /** Bioload impact per individual (positive); plants carry negative values to reduce load */
  bioloadRating: number
}

export interface TankInhabitant {
  species: AquaSpecies
  quantity: number
}

export interface TankConfig {
  volumeGallons: number
  /** Current tank temperature — °F */
  temperature: number
  /** Current tank pH */
  pH: number
}

export interface CompatibilityConflict {
  type: ConflictType
  severity: ConflictSeverity
  message: string
  speciesInvolved: string[]
}

export interface BioloadResult {
  totalBioload: number
  /** Maximum bioload units sustainable for this tank volume */
  capacity: number
  /** 0–∞; 100 = fully loaded; >100 = overloaded */
  capacityPct: number
  isOverloaded: boolean
}

export interface CompatibilityReport {
  conflicts: CompatibilityConflict[]
  bioload: BioloadResult
  /** Viable temperature range shared by all fauna — null when no overlap exists */
  overlapTempMin: number | null
  overlapTempMax: number | null
  /** Viable pH range shared by all fauna — null when no overlap exists */
  overlapPhMin: number | null
  overlapPhMax: number | null
  /** True when no critical-severity conflicts are detected */
  isViable: boolean
}
