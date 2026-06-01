export type FloraType = 'forageable_edible' | 'ornamental_bloom' | 'foliage'

export interface FloraEntry {
  id: string
  speciesName: string
  type: FloraType
  /** 0-indexed month numbers matching Date.getMonth() — Jan=0 … Dec=11 */
  peakMonths: number[]
  primaryLocations: string[]
  description: string
}

export interface Houseplant {
  id?: number
  plantName: string
  species: string
  lastWateredDate: string      // 'YYYY-MM-DD'
  wateringIntervalDays: number
  location: string
}
