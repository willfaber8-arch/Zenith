'use client'
/**
 * views/FocusRoomView.tsx — Multiplayer Focus Rooms
 * Phase 5 · Step 5.5
 */

import ZenHeading        from '@/components/ui/ZenHeading'
import MultiplayerLobby  from '@/components/MultiplayerLobby'
import styles            from './FocusRoomView.module.css'

export default function FocusRoomView() {
  return (
    <div className={styles.wrap}>

      <div className="anim-scale-in">
        <ZenHeading
          eyebrow="Scholastic · Phase 5.5"
          title={'Focus\nRooms.'}
          subtitle="Create a serverless P2P focus room and share the code with peers. Pomodoro timers sync in real time via WebRTC — no server required."
          size="lg"
        />
      </div>

      <div className="anim-fade-in delay-1">
        <MultiplayerLobby />
      </div>

    </div>
  )
}
