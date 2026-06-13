'use client'

import ZenHeading      from '@/components/ui/ZenHeading'
import SocialLeaderboard from '@/components/SocialLeaderboard'

export default function FriendsNetworkView() {
  return (
    <div>
      <div style={{ padding: 'var(--sp-8) var(--sp-8) var(--sp-6)' }}>
        <ZenHeading
          eyebrow="Life · Social"
          title="Friend Ledger."
          subtitle="Serverless P2P stat sync and multi-temporal leaderboard."
        />
      </div>
      <SocialLeaderboard />
    </div>
  )
}
