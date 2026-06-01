export type Difficulty = 'easy' | 'moderate' | 'strenuous'

export type TrailFeature =
  | 'waterfall'
  | 'gorge_lookout'
  | 'canopy_cover'
  | 'swimming_hole'

export interface Trail {
  id: string
  name: string
  locationRegion: string
  distanceMiles: number
  elevationGainFt: number
  difficulty: Difficulty
  features: TrailFeature[]
  /** GeoJSON convention: [longitude, latitude] pairs */
  coordinates: [number, number][]
  description: string
}
