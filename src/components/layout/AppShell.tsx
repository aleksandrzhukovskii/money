import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAppStore } from '@/stores/app'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { PWAUpdatePrompt } from './PWAUpdatePrompt'

export function AppShell() {
  const toastPosition = useAppStore(s => s.toastPosition)

  // Force iOS Safari to settle its toolbar/safe-area state on load
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 1)
      requestAnimationFrame(() => {
        window.scrollTo(0, 0)
      })
    })
  }, [])

  return (
    <div className="flex h-dvh w-full">
      <PWAUpdatePrompt />

      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Main content + mobile nav */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <BottomNav className="md:hidden" />
      </div>

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
