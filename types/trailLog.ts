/**
 * types/trailLog.ts — completed-trail log (Trail Hunter).
 * Each row records a trail the user finished, with notes and locally-stored
 * (downscaled base64) photos. No backend — all local.
 */

export interface CompletedTrail {
  id?:           number
  trailId:       string    // FK → TRAILS[].id (indexed)
  trailName:     string    // denormalised for the log display
  completedDate: string    // 'YYYY-MM-DD' (local)
  notes?:        string
  photos:        string[]  // downscaled base64 data URLs
  createdAt:     number    // UTC ms (indexed)
}
