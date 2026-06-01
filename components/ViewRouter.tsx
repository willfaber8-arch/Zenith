'use client'

import { useState, useEffect, type JSX } from 'react'
import { useNav } from '@/lib/NavContext'
import type { ViewId } from '@/lib/nav-config'
import HomeView          from '@/components/views/HomeView'
import UniHubView        from '@/components/views/UniHubView'
import MajorHubView      from '@/components/views/MajorHubView'
import CalendarView      from '@/components/views/CalendarView'
import GpaView           from '@/components/views/GpaView'
import CourseMatrixView  from '@/components/views/CourseMatrixView'
import StudyShieldView      from '@/components/views/StudyShieldView'
import AquascapingView      from '@/components/views/AquascapingView'
import TrailHunterView      from '@/components/views/TrailHunterView'
import BotanistView         from '@/components/views/BotanistView'
import BurnRateView         from '@/components/views/BurnRateView'
import PlaceholderView      from '@/components/views/PlaceholderView'
import CharacterView        from '@/components/views/CharacterView'
import GritView            from '@/components/views/GritView'
import QuestView           from '@/components/views/QuestView'
import FocusRoomView       from '@/components/views/FocusRoomView'
import SlopeDayView        from '@/components/views/SlopeDayView'

/* ── View registry ────────────────────────────────────────── */

const META: Partial<Record<ViewId, { title: string; eyebrow: string }>> = {
  'major-hub':     { title: 'Major Hub',          eyebrow: 'Scholastic · Module'   },
  'calendar':     { title: 'Universal Calendar', eyebrow: 'Life · Module'         },
  'workouts':     { title: 'Workouts',           eyebrow: 'Life · Module'         },
  'custom-links': { title: 'Custom Link Manager',eyebrow: 'Personalized Vault'    },
}

function resolveView(id: ViewId): JSX.Element {
  if (id === 'home')           return <HomeView />
  if (id === 'uni-hub')        return <UniHubView />
  if (id === 'major-hub')      return <MajorHubView />
  if (id === 'calendar')       return <CalendarView />
  if (id === 'gpa-calc')       return <GpaView />
  if (id === 'course-matrix')  return <CourseMatrixView />
  if (id === 'study-shield')   return <StudyShieldView />
  if (id === 'aquascaping')   return <AquascapingView />
  if (id === 'trail-hunter') return <TrailHunterView />
  if (id === 'botanist')    return <BotanistView />
  if (id === 'burn-rate')   return <BurnRateView />
  if (id === 'character')     return <CharacterView />
  if (id === 'grit-analytics') return <GritView />
  if (id === 'quest-matrix')  return <QuestView />
  if (id === 'focus-rooms')   return <FocusRoomView />
  if (id === 'slope-day')    return <SlopeDayView />
  const m = META[id]
  if (m) return <PlaceholderView title={m.title} eyebrow={m.eyebrow} />
  return <HomeView />
}

/* ── ViewRouter ───────────────────────────────────────────── */
/*
   Two-phase transition:
     1. Outgoing: opacity → 0, scale → 0.98  (200ms ease)
     2. Swap displayed view, then incoming:
        opacity → 1, scale → 1  (300ms ease-out)
*/
const EXIT_MS = 200

export default function ViewRouter() {
  const { activeView } = useNav()
  const [displayed, setDisplayed] = useState<ViewId>(activeView)
  const [visible,   setVisible]   = useState(true)

  useEffect(() => {
    if (activeView === displayed) return

    setVisible(false)

    const t = setTimeout(() => {
      setDisplayed(activeView)
      setVisible(true)
    }, EXIT_MS)

    return () => clearTimeout(t)
  }, [activeView]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'scale(1)' : 'scale(0.98)',
        transition: visible
          ? `opacity 300ms cubic-bezier(0.16,1,0.3,1),
             transform 300ms cubic-bezier(0.16,1,0.3,1)`
          : `opacity ${EXIT_MS}ms ease,
             transform ${EXIT_MS}ms ease`,
        /* Prevent interaction during exit */
        pointerEvents: visible ? undefined : 'none',
      }}
    >
      {resolveView(displayed)}
    </div>
  )
}
