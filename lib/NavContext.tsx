'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ViewId, CategoryId } from './nav-config'

interface NavState {
  activeView: ViewId
  activeCategory: CategoryId | null
  navigate: (viewId: ViewId, category: CategoryId | null) => void
}

const NavContext = createContext<NavState>({
  activeView:     'home',
  activeCategory: null,
  navigate:       () => {},
})

export function NavProvider({ children }: { children: ReactNode }) {
  const [activeView,     setActiveView]     = useState<ViewId>('home')
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null)

  const navigate = (viewId: ViewId, category: CategoryId | null) => {
    setActiveView(viewId)
    setActiveCategory(category)
  }

  return (
    <NavContext.Provider value={{ activeView, activeCategory, navigate }}>
      {children}
    </NavContext.Provider>
  )
}

export const useNav = () => useContext(NavContext)
