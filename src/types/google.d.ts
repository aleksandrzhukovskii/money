interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void
}

interface Google {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
      }) => TokenClient
      revoke: (token: string, callback?: () => void) => void
    }
  }
}

declare const google: Google
