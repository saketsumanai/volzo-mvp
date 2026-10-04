import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

let socket = null

export const connectSocket = (token) => {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => console.log('🔌 Socket connected:', socket.id))
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'))
  socket.on('connect_error', (e) => console.warn('Socket error:', e.message))

  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

export const getSocket = () => socket

export const joinRideRoom = (rideId) => {
  socket?.emit('ride:join', rideId)
}

export const leaveRideRoom = (rideId) => {
  socket?.emit('ride:leave', rideId)
}
