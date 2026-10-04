/**
 * Main API Routes
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes    = require('./auth.routes');
const rideRoutes    = require('./ride.routes');
const driverRoutes  = require('./driver.routes');
const paymentRoutes = require('./payment.routes');
const userRoutes    = require('./user.routes');
const adminRoutes   = require('./admin.routes');
const kycRoutes     = require('./kyc.routes');

// Import security rate limiters
const { authLimiter, paymentLimiter } = require('../middleware/rateLimiter');

// Mount routes with dedicated security layers
router.use('/auth',     authLimiter, authRoutes);
router.use('/rides',    rideRoutes);
router.use('/drivers',  driverRoutes);
router.use('/payments', paymentLimiter, paymentRoutes);
router.use('/users',    userRoutes);
router.use('/admin',    adminRoutes);
router.use('/kyc',      kycRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Volzo Mobility API v1',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

module.exports = router;
