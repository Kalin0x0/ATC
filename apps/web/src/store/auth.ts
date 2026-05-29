import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AuthState {
  apiUrl: string
  token: string | null
  setCredentials: (apiUrl: string, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiUrl: '',
      token: null,
      setCredentials: (apiUrl, token) => set({ apiUrl, token }),
      logout: () => set({ token: null, apiUrl: '' }),
    }),
    {
      name: 'atc-admin-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
