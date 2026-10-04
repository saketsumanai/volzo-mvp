/**
 * Volzo Mobility Backend Server
 * Production-grade Express.js server with Socket.IO
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { initializeSocket } = require('./socket');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const {
  sanitizeInputs,
  preventParameterPollution,
  preventPathTraversal,
  securityHeaders
} = require('./middleware/security');
const routes = require('./routes');
const { setupSwagger } = require('./config/swagger');

// Initialize Express app
const app = express();
app.disable('x-powered-by'); // Hide express fingerprint
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);
app.set('io', io);

// ============================================
// SECURITY & ESSENTIAL MIDDLEWARE
// ============================================

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Allows Swagger UI and mobile embedded WebViews
}));

// Custom security headers (HSTS, Anti-Clickjacking, No-Sniff)
app.use(securityHeaders);

// Path traversal and dangerous URI detector
app.use(preventPathTraversal);

// CORS
app.use(cors({
  origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Compression
app.use(compression());

// Body parsing with strict payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization (XSS and Prototype Pollution defense)
app.use(sanitizeInputs);

// Parameter pollution protection
app.use(preventParameterPollution);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Global API Rate limiting
app.use('/api/', rateLimiter);

// Static files (for uploaded QR codes, etc.)
app.use('/uploads', express.static('uploads'));

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/v1', routes);

// Swagger documentation
setupSwagger(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🚀 Volzo Mobility Backend Server`);
  logger.info(`📡 Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🔌 Socket.IO ready for realtime connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server };
