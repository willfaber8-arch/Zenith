/* Legacy flora types — kept for ForagingLog.tsx backwards compat */
export type FloraType = 'forageable_edible' | 'ornamental_bloom' | 'foliage'

export interface FloraEntry {
  id: string
  speciesName: string
  type: FloraType
  peakMonths: number[]
  primaryLocations: string[]
  description: string
}

export interface Houseplant {
  id?: number
  plantName:           string   // common name the user calls it
  species:             string   // scientific name (italicised in UI)
  lastWateredDate:     string   // 'YYYY-MM-DD'
  wateringIntervalDays: number
  location:            string   // user's physical location label, e.g. "Living Room"
  // Extended care fields — non-indexed, no DB migration required
  lightRequirement?:   LightRequirement
  lightPosition?:      LightPosition
  humidity?:           HumidityLevel
  healthRating?:       number    // 1-5
  lastHealthCheck?:    string    // 'YYYY-MM-DD'
  specialConditions?:  string
  notes?:              string
}

export type LightRequirement = 'full-sun' | 'partial-sun' | 'indirect-light' | 'shade'
export type LightPosition    = 'indoors'  | 'outdoors'    | 'both'
export type HumidityLevel    = 'low'      | 'medium'       | 'high'

/**
 * PlantLogEntry — one dated entry in a plant's journal/health timeline.
 * A single entry can carry any combination of a note, a health rating, and a
 * photo. The health-trend chart is built from entries with a healthRating; the
 * journal is the full list. Photos are stored as a downscaled base64 data URL
 * (local-first — no backend or blob store needed).
 */
export interface PlantLogEntry {
  id?:           number
  plantId:       number    // FK → Houseplant.id (indexed)
  date:          string    // 'YYYY-MM-DD'
  note?:         string
  healthRating?: number    // 1-5, optional
  photo?:        string    // downscaled base64 data URL, optional
  createdAt:     number    // Unix ms (indexed)
}

/** Static plant catalog entry used in the search/add modal */
export interface PlantCatalogEntry {
  commonName:          string
  scientificName:      string
  wateringIntervalDays: number
  lightRequirement:    LightRequirement
  lightPosition:       LightPosition
  humidity:            HumidityLevel
  specialConditions?:  string
}
