/**
 * Socket.IO Realtime System
 * Handles live tracking, ride updates, and notifications
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const prisma = require('../config/database');

// Store active connections
const activeConnections = new Map();
const driverLocations = new Map();

// Idempotent event deduplication store
const eventCache = new Map();
const isEventDuplicate = (eventId, ttlMs = 5000) => {
  if (!eventId) return false;
  const now = Date.now();
  if (eventCache.has(eventId)) {
    const expiresAt = eventCache.get(eventId);
    if (now < expiresAt) return true;
  }
  eventCache.set(eventId, now + ttlMs);
  
  if (eventCache.size > 10000) {
    for (const [key, exp] of eventCache.entries()) {
      if (now > exp) eventCache.delete(key);
    }
  }
  return false;
};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || '*',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

    // Store connection
    activeConnections.set(socket.userId, socket.id);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // ============================================
    // DRIVER EVENTS
    // ============================================

    /**
     * Driver location update
     */
    socket.on('driver:location:update', (data) => {
      try {
        // Accept both lat/lng (web) and latitude/longitude (Flutter app) key formats
        const lat = data.lat ?? data.latitude;
        const lng = data.lng ?? data.longitude;
        const { heading, rideId } = data;

        if (lat == null || lng == null) {
          logger.warn('driver:location:update missing lat/lng keys:', data);
          return;
        }

        // Store driver location in-memory (userId as key for fast lookup)
        driverLocations.set(socket.userId, {
          lat,
          lng,
          heading: heading || 0,
          timestamp: Date.now()
        });

        // Persist location to database asynchronously
        prisma.driver.update({
          where: { userId: socket.userId },
          data: {
            currentLocation: {
              latitude: lat,
              longitude: lng,
              heading: heading || 0.0,
              timestamp: new Date().toISOString()
            }
          }
        }).catch(err => logger.error('Async driver DB location update failed:', err));

        // Broadcast to rider if on active ride
        if (rideId) {
          io.to(`ride:${rideId}`).emit('driver:location:updated', {
            rideId,
            driverId: socket.userId,
            lat,
            lng,
            heading,
            timestamp: Date.now()
          });
        }

        // Broadcast to admin dashboard
        io.to('admin').emit('driver:location:updated', {
          driverId: socket.userId,
          lat,
          lng,
          heading
        });
      } catch (error) {
        logger.error('Driver location update error:', error);
      }
    });

    /**
     * Driver goes online
     */
    socket.on('driver:online', (data) => {
      socket.join('drivers:online');
      io.to('admin').emit('driver:status:changed', {
        driverId: socket.userId,
        status: 'ONLINE'
      });
      logger.info(`Driver ${socket.userId} is now online`);
    });

    /**
     * Driver goes offline
     */
    socket.on('driver:offline', () => {
      socket.leave('drivers:online');
      driverLocations.delete(socket.userId);
      io.to('admin').emit('driver:status:changed', {
        driverId: socket.userId,
        status: 'OFFLINE'
      });
      logger.info(`Driver ${socket.userId} is now offline`);
    });

    // ============================================
    // RIDE EVENTS
    // ============================================

    /**
     * Join ride room
     */
    socket.on('ride:join', (rideId) => {
      socket.join(`ride:${rideId}`);
      logger.info(`User ${socket.userId} joined ride ${rideId}`);
    });

    /**
     * Leave ride room
     */
    socket.on('ride:leave', (rideId) => {
      socket.leave(`ride:${rideId}`);
      logger.info(`User ${socket.userId} left ride ${rideId}`);
    });

    /**
     * Ride status update
     */
    socket.on('ride:status:update', (data) => {
      const { rideId, status, eventId, ...rest } = data;
      
      if (eventId && isEventDuplicate(eventId)) {
        logger.info(`Duplicate socket event discarded: ${eventId}`);
        return;
      }

      io.to(`ride:${rideId}`).emit('ride:status:updated', {
        rideId,
        status,
        ...rest,
        timestamp: Date.now()
      });
    });

    // ============================================
    // ADMIN EVENTS
    // ============================================

    /**
     * Admin joins monitoring room
     */
    socket.on('admin:join', () => {
      if (socket.userRole === 'ADMIN') {
        socket.join('admin');
        
        // Send current driver locations
        const locations = Array.from(driverLocations.entries()).map(([driverId, location]) => ({
          driverId,
          ...location
        }));
        
        socket.emit('admin:driver:locations', locations);
        logger.info(`Admin ${socket.userId} joined monitoring`);
      }
    });

    // ============================================
    // NOTIFICATION EVENTS
    // ============================================

    /**
     * Send notification to specific user
     */
    socket.on('notification:send', (data) => {
      const { userId, notification } = data;
      io.to(`user:${userId}`).emit('notification:received', notification);
    });

    // ============================================
    // DISCONNECT
    // ============================================

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
      activeConnections.delete(socket.userId);
      driverLocations.delete(socket.userId);
    });

    // ============================================
    // ERROR HANDLING
    // ============================================

    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
};

/**
 * Emit event to specific user
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit event to ride participants
 */
const emitToRide = (io, rideId, event, data) => {
  io.to(`ride:${rideId}`).emit(event, data);
};

/**
 * Emit event to all online drivers
 */
const emitToDrivers = (io, event, data) => {
  io.to('drivers:online').emit(event, data);
};

/**
 * Emit event to admin dashboard
 */
const emitToAdmin = (io, event, data) => {
  io.to('admin').emit(event, data);
};

/**
 * Get active driver locations
 */
const getDriverLocations = () => {
  return Array.from(driverLocations.entries()).map(([driverId, location]) => ({
    driverId,
    ...location
  }));
};

/**
 * Check if user is online
 */
const isUserOnline = (userId) => {
  return activeConnections.has(userId);
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToRide,
  emitToDrivers,
  emitToAdmin,
  getDriverLocations,
  isUserOnline,
  // Expose the live in-memory map so REST endpoints can use real-time coordinates
  driverLocations
};
