import { create } from 'zustand'
import { connectSocket, disconnectSocket } from '../services/socket'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('rider_user') || 'null'),
  token: localStorage.getItem('rider_token') || null,
  isLoading: false,

  setAuth: (user, token) => {
    localStorage.setItem('rider_token', token)
    localStorage.setItem('rider_user', JSON.stringify(user))
    connectSocket(token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('rider_token')
    localStorage.removeItem('rider_user')
    disconnectSocket()
    set({ user: null, token: null })
  },

  isAuthenticated: () => !!get().token,
}))
