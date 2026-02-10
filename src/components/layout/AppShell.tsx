import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAppStore } from '@/stores/app'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { PWAUpdatePrompt } from './PWAUpdatePrompt'

export function AppShell() {
  const toastPosition = useAppStore(s => s.toastPosition)

  return (
    <div className="flex h-dvh w-full">
      <PWAUpdatePrompt />

      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Main content */}
      <main className="flex-1 overflow-hidden pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav className="md:hidden" />

      <Toaster
        position={toastPosition}
        offset={toastPosition === 'bottom-center' ? '5rem' : undefined}
        toastOptions={{
          classNames: {
            success: '!bg-emerald-50 !text-emerald-800 !border-emerald-200',
            error: '!bg-red-50 !text-red-800 !border-red-200',
          },
        }}
      />
    </div>
  )
}
