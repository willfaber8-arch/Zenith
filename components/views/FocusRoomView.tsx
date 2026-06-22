'use client'
/**
 * views/FocusRoomView.tsx — Multiplayer Focus Rooms
 * Phase 5 · Step 5.5
 */

import MultiplayerLobby  from '@/components/MultiplayerLobby'
import styles            from './FocusRoomView.module.css'

export default function FocusRoomView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-fade-in delay-1">
        <MultiplayerLobby />
      </div>

    </div>
  )
}
