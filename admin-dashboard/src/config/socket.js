/**
 * Admin Socket.IO Client
 * Connects admin dashboard to live backend events
 */

import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;
const listeners = {};

export const connectAdminSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('🔌 Admin socket connected:', socket.id);
    socket.emit('admin:join'); // join admin room
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Admin socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Admin socket error:', err.message);
  });

  return socket;
};

export const disconnectAdminSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

/**
 * Subscribe to a socket event
 * Returns an unsubscribe function
 */
export const onSocketEvent = (event, callback) => {
  if (!socket) return () => {};
  socket.on(event, callback);
  return () => socket?.off(event, callback);
};

/**
 * Commonly used admin socket events:
 * - 'ride:new'              → new ride requested
 * - 'ride:status'           → ride status changed
 * - 'driver:status:changed' → driver went online/offline
 * - 'payment:verified'      → payment verified
 * - 'kyc:submitted'         → driver submitted KYC
 */
export const SOCKET_EVENTS = {
  RIDE_NEW:             'ride:new',
  RIDE_STATUS:          'ride:status',
  DRIVER_STATUS:        'driver:status:changed',
  PAYMENT_VERIFIED:     'payment:verified',
  KYC_SUBMITTED:        'kyc:submitted',
  ADMIN_STATS_UPDATE:   'admin:stats:update',
};

export default { connectAdminSocket, disconnectAdminSocket, onSocketEvent, SOCKET_EVENTS };
