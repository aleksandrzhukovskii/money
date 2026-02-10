import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    import('virtual:pwa-register').then(({ registerSW }) => {
      const update = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true)
        },
        onRegistered(registration) {
          if (!registration) return
          // Check for updates every 30 minutes
          setInterval(() => { registration.update() }, 30 * 60 * 1000)
          // Also check on visibility change (app foregrounded)
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update()
          })
        },
      })
      setUpdateSW(() => update)
    })
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-emerald-600 text-white text-center text-sm flex items-center justify-center gap-3"
      style={{ paddingTop: 'calc(var(--safe-area-top) + 0.75rem)' }}
    >
      <span>New version available</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateSW?.(true)}
      >
        Update
      </Button>
    </div>
  )
}
