/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Relationship Notes Type Definitions
 * Phase 9 · Step 9.3 — Letterbox Live Note Dashboard Widget
 *
 * RelationshipNote is the unified surface type for all incoming
 * social messages shown on the dashboard widget.
 *
 * It is intentionally simpler than PeerMessage (Phase 9.2) which
 * retains the raw encrypted payload for auditing. RelationshipNote
 * is the display-ready record — one table, multiple intake sources:
 *   • Cloud Letterbox drain (letterboxBroker.ts)
 *   • Future WebRTC direct-message channels
 *   • Any other social integrations
 *
 * Database helper (getLatestRelationshipNote) is co-located with
 * the rest of the Dexie helpers in lib/db.ts, following the project
 * convention. Import it from there:
 *   import { getLatestRelationshipNote } from '@/lib/db'
 * ════════════════════════════════════════════════════════════════
 */

/**
 * A single relationship/social note stored in the local
 * relationship_notes IDB table.
 *
 * id          — explicit UUID string PK (not auto-increment)
 *               Stable across message sources; keyed by the
 *               React widget to re-trigger the entrance animation
 *               whenever a genuinely new message arrives.
 *
 * isRead      — false when first written; set to true by the
 *               widget's "mark read" action or on navigation
 *               to the Friends Network view.
 *
 * source      — optional origin tag for future multi-source UI.
 *               'letterbox' = async E2E cloud relay (Phase 9.2)
 *               'p2p'       = live WebRTC direct exchange (Phase 9.1)
 *               'manual'    = user-created test / development entry
 */
export interface RelationshipNote {
  id:                string    // explicit string UUID — PK
  senderDisplayName: string    // display name of the message author
  messageText:       string    // decrypted plaintext body
  timestamp:         number    // Unix ms — creation / received time
  isRead:            boolean   // unread indicator
  source?:           'letterbox' | 'p2p' | 'manual'
}
