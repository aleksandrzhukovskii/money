import { useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useDatabase, isDirty, deleteLocalDatabase } from '@/hooks/useDatabase'
import { useBackup } from '@/hooks/useBackup'
import { useAuthStore } from '@/stores/auth'
import { AuthScreen, clearCredentials } from '@/components/AuthScreen'
import { refreshExchangeRates } from '@/lib/exchangeRateSync'
import { MainPage } from '@/pages/MainPage'
import { IncomesPage } from '@/pages/IncomesPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { SpendingsPage } from '@/pages/SpendingsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { StatisticsPage } from '@/pages/StatisticsPage'
import { Button } from '@/components/ui/button'

type SyncPhase = 'pending' | 'syncing' | 'synced' | 'error'

export function App() {
  const { db, isReady, error, persistDebounced } = useDatabase()
  const { password } = useAuthStore()
  const isAuthenticated = !!password
  const backup = useBackup()
  const backupRef = useRef(backup)
  backupRef.current = backup

  const [syncPhase, setSyncPhase] = useState<SyncPhase>('pending')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Reset sync state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setSyncPhase('pending')
      setSyncError(null)
    }
  }, [isAuthenticated])

  // Initial sync after auth
  useEffect(() => {
    if (!isAuthenticated || !db || syncPhase === 'synced') return

    setSyncPhase('syncing')
    setSyncError(null)

    backupRef.current.initialSync().then((result) => {
      if (result.ok) {
        setSyncPhase('synced')
      } else {
        setSyncPhase('error')
        setSyncError(result.error)
      }
    })
  }, [isAuthenticated, db, retryCount])

  // Lifecycle handlers — only active after sync completes
  useEffect(() => {
    if (!db || syncPhase !== 'synced') return

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        backupRef.current.pull()
      }
    }

    function handlePersisted() {
      backupRef.current.schedulePush()
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty()) {
        e.preventDefault()
      }
    }

    function handlePageHide() {
      deleteLocalDatabase()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('db-persisted', handlePersisted)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('db-persisted', handlePersisted)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [db, syncPhase])

  // Fetch exchange rates after sync completes
  useEffect(() => {
    if (!db || syncPhase !== 'synced') return
    refreshExchangeRates(db, persistDebounced).catch(() => {})
  }, [db, syncPhase, persistDebounced])

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-red-600 mb-2">Database Error</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  if (syncPhase === 'error') {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-lg font-semibold text-red-600">Sync Failed</h1>
          <p className="text-sm text-gray-600">{syncError}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setRetryCount((c) => c + 1)}>Retry</Button>
            <Button
              variant="outline"
              onClick={() => {
                useAuthStore.getState().clearAuth()
                clearCredentials()
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (syncPhase !== 'synced') {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-gray-500">Syncing...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/incomes" element={<IncomesPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/spendings" element={<SpendingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
      </Route>
    </Routes>
  )
}
