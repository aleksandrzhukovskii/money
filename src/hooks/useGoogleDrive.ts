import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrCreateSyncFolder, uploadFile, downloadFile, getFileMetadata } from '@/lib/googleDrive'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useGoogleDrive() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [folderId, setFolderId] = useState<string | null>(null)
  const tokenClientRef = useRef<TokenClient | null>(null)
  const resolveRef = useRef<((token: string | null) => void) | null>(null)

  useEffect(() => {
    if (!CLIENT_ID) return

    function tryInit() {
      if (typeof google === 'undefined') {
        setTimeout(tryInit, 200)
        return
      }
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token)
            setIsSignedIn(true)
            resolveRef.current?.(response.access_token)
          } else {
            resolveRef.current?.(null)
          }
          resolveRef.current = null
        },
      })
    }
    tryInit()
  }, [])

  const signIn = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!tokenClientRef.current) {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      tokenClientRef.current.requestAccessToken()
    })
  }, [])

  const signOut = useCallback(() => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken)
    }
    setAccessToken(null)
    setIsSignedIn(false)
    setFolderId(null)
    setSyncStatus('idle')
  }, [accessToken])

  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) return accessToken
    // Try silent re-auth
    return new Promise((resolve) => {
      if (!tokenClientRef.current) {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      tokenClientRef.current.requestAccessToken({ prompt: '' })
      // Timeout for silent auth
      setTimeout(() => {
        if (resolveRef.current) {
          resolveRef.current = null
          resolve(null)
        }
      }, 5000)
    })
  }, [accessToken])

  const ensureFolder = useCallback(async (token: string): Promise<string> => {
    if (folderId) return folderId
    const id = await getOrCreateSyncFolder(token)
    setFolderId(id)
    return id
  }, [folderId])

  const upload = useCallback(async (encryptedData: Uint8Array): Promise<boolean> => {
    try {
      setSyncStatus('syncing')
      const token = await ensureToken()
      if (!token) { setSyncStatus('error'); return false }
      const folder = await ensureFolder(token)
      await uploadFile(encryptedData, folder, token)
      setSyncStatus('synced')
      return true
    } catch {
      setSyncStatus('error')
      return false
    }
  }, [ensureToken, ensureFolder])

  const download = useCallback(async (): Promise<{ data: Uint8Array; modifiedTime: string } | null> => {
    try {
      setSyncStatus('syncing')
      const token = await ensureToken()
      if (!token) { setSyncStatus('error'); return null }
      const folder = await ensureFolder(token)
      const result = await downloadFile(folder, token)
      setSyncStatus('synced')
      return result
    } catch {
      setSyncStatus('error')
      return null
    }
  }, [ensureToken, ensureFolder])

  const getRemoteMetadata = useCallback(async (): Promise<{ modifiedTime: string } | null> => {
    try {
      const token = await ensureToken()
      if (!token) return null
      const folder = await ensureFolder(token)
      return await getFileMetadata(folder, token)
    } catch {
      return null
    }
  }, [ensureToken, ensureFolder])

  return {
    isSignedIn,
    isAvailable: !!CLIENT_ID,
    syncStatus,
    signIn,
    signOut,
    upload,
    download,
    getRemoteMetadata,
  }
}
