/**
 * types/trailLog.ts — completed-trail log (Trail Hunter).
 * Each row records a trail the user finished, with notes and locally-stored
 * (downscaled base64) photos. No backend — all local.
 *
 * Freeform: entries are no longer tied to a static trail list. New entries
 * generate a uuid for `trailId`; distance / difficulty / features / rating
 * are all optional user-supplied fields.
 */

export interface CompletedTrail {
  id?:            number
  trailId:        string    // uuid for freeform entries (indexed)
  trailName:      string    // display name
  completedDate:  string    // 'YYYY-MM-DD' (local)
  distanceMiles?: number    // optional — miles
  difficulty?:    string    // optional — 'Easy' | 'Moderate' | 'Hard' | ''
  features?:      string    // optional — freeform, comma-separated
  rating?:        number    // optional — 0–5 stars
  notes?:         string
  photos:         string[]  // downscaled base64 data URLs
  createdAt:      number    // UTC ms (indexed)
}
