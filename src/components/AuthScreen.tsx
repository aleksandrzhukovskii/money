import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { encrypt, decrypt } from '@/lib/crypto'
import { validateCredentials } from '@/lib/githubSync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const STORAGE_KEY = 'money-tracker-credentials'

function hasStoredCredentials(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

async function saveCredentials(password: string, repo: string, token: string) {
  const json = JSON.stringify({ repo, token })
  const bytes = new TextEncoder().encode(json)
  const encrypted = await encrypt(bytes, password)
  let binary = ''
  for (let i = 0; i < encrypted.length; i++) {
    binary += String.fromCharCode(encrypted[i]!)
  }
  localStorage.setItem(STORAGE_KEY, btoa(binary))
}

async function loadCredentials(password: string): Promise<{ repo: string; token: string }> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) throw new Error('No stored credentials')
  const binary = atob(stored)
  const encrypted = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    encrypted[i] = binary.charCodeAt(i)
  }
  const decrypted = await decrypt(encrypted, password)
  const json = new TextDecoder().decode(decrypted)
  return JSON.parse(json)
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY)
}

type Mode = 'login' | 'setup'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>(hasStoredCredentials() ? 'login' : 'setup')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const creds = await loadCredentials(password)
      useAuthStore.getState().setAuth(password, creds.repo, creds.token)
    } catch {
      setError('Wrong password')
    }
    setLoading(false)
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !repo.trim() || !token.trim()) return
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const ok = await validateCredentials(repo.trim(), token.trim())
      if (!ok) {
        setError('Cannot connect to GitHub. Check repo name and token.')
        setLoading(false)
        return
      }
      await saveCredentials(password, repo.trim(), token.trim())
      useAuthStore.getState().setAuth(password, repo.trim(), token.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    }
    setLoading(false)
  }

  function handleSwitchToSetup() {
    clearCredentials()
    setMode('setup')
    setPassword('')
    setConfirmPassword('')
    setRepo('')
    setToken('')
    setError(null)
  }

  if (mode === 'login') {
    return (
      <div className="flex h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Money Tracker</CardTitle>
            <CardDescription>Enter your password to unlock</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={!password || loading}>
                {loading ? 'Unlocking...' : 'Unlock'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={handleSwitchToSetup}
              >
                Use different account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Money Tracker</CardTitle>
          <CardDescription>Set up encryption and GitHub sync</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="setup-password">Password</Label>
              <Input
                id="setup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                data-bwautofill
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-repo">GitHub Repository</Label>
              <Input
                id="setup-repo"
                name="repo"
                autoComplete="username"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-token">Personal Access Token</Label>
              <Input
                id="setup-token"
                name="token"
                type="password"
                data-bwautofill
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={!password || !confirmPassword || !repo.trim() || !token.trim() || loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
