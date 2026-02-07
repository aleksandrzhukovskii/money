import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { PWAUpdatePrompt } from './PWAUpdatePrompt'

export function AppShell() {
  return (
    <div className="flex h-dvh w-full">
      <PWAUpdatePrompt />

      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav className="md:hidden" />
    </div>
  )
}
