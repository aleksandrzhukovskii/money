import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useDatabase } from '@/hooks/useDatabase'
import { MainPage } from '@/pages/MainPage'
import { StatisticsPage } from '@/pages/StatisticsPage'

export function App() {
  const { isReady, error } = useDatabase()

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

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
      </Route>
    </Routes>
  )
}
