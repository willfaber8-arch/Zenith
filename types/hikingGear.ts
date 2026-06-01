export type GearCategory =
  | 'essentials'
  | 'shelter'
  | 'hydration'
  | 'navigation'
  | 'first_aid'

export interface GearItem {
  id: string
  itemName: string
  weightOunces: number
  category: GearCategory
  isPacked: boolean
}
