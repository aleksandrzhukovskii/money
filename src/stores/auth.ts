import { create } from 'zustand'

interface AuthState {
  password: string | null
  repo: string | null
  token: string | null
  setAuth: (password: string, repo: string, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  password: null,
  repo: null,
  token: null,
  setAuth: (password, repo, token) => set({ password, repo, token }),
  clearAuth: () => set({ password: null, repo: null, token: null }),
}))
