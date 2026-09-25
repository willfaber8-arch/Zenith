'use client'

/**
 * components/phone/MobileTasks.tsx — the phone's Tasks screen.
 *
 * The Calendar's Tasks tab, on its own. The week grid and the tab bar
 * above it are desktop surfaces; the list is the part you reach for on a
 * phone, and it is the very same component, so a task added here is the
 * one the laptop shows.
 */

import { TasksPanel } from '@/components/views/CalendarView'

export default function MobileTasks() {
  return <TasksPanel phone />
}
