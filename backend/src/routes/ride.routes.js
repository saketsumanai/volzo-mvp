/**
 * Ride Routes
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorizeDriver } = require('../middleware/auth');
const RideController = require('../controllers/RideController');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /rides:
 *   post:
 *     summary: Request a new ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  [
    body('rideType').isIn(['SCOOTER', 'SCOOTER_PRO']).withMessage('Invalid ride type'),
    body('pickupLocation').isObject().withMessage('Pickup location required'),
    body('dropoffLocation').isObject().withMessage('Dropoff location required'),
    body('estimatedDistance').isFloat({ min: 0.1 }).withMessage('Valid distance required'),
    body('seatsBooked').optional().isInt({ min: 1, max: 1 }).withMessage('Seats must be 1 for 2W')
  ],
  validate,
  RideController.requestRide
);

/**
 * @swagger
 * /rides/calculate-fare:
 *   post:
 *     summary: Calculate fare estimate
 *     tags: [Rides]
 */
router.post(
  '/calculate-fare',
  [
    body('rideType').isIn(['SCOOTER', 'SCOOTER_PRO']),
    body('distance').isFloat({ min: 0.1 }),
    body('seatsBooked').optional().isInt({ min: 1, max: 1 })
  ],
  validate,
  RideController.calculateFare
);

/**
 * Estimate fare alias for Rider app compatibility
 */
router.post(
  '/estimate-fare',
  [
    body('rideType').isIn(['SCOOTER', 'SCOOTER_PRO']),
    body('distance').isFloat({ min: 0.1 }),
    body('seatsBooked').optional().isInt({ min: 1, max: 1 })
  ],
  validate,
  RideController.calculateFare
);

/**
 * @swagger
 * /rides/active:
 *   get:
 *     summary: Get active ride
 *     tags: [Rides]
 */
router.get('/active', RideController.getActiveRide);

/**
 * @swagger
 * /rides/history:
 *   get:
 *     summary: Get ride history
 *     tags: [Rides]
 */
router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  RideController.getRideHistory
);

/**
 * @swagger
 * /rides/:rideId:
 *   get:
 *     summary: Get ride details
 *     tags: [Rides]
 */
router.get('/:rideId', RideController.getRide);

/**
 * @swagger
 * /rides/:rideId/cancel:
 *   patch:
 *     summary: Cancel ride
 *     tags: [Rides]
 */
router.patch(
  '/:rideId/cancel',
  [
    body('reason').optional().isString().trim()
  ],
  validate,
  RideController.cancelRide
);

/**
 * Cancel ride alias (POST) for Rider app compatibility
 */
router.post(
  '/:rideId/cancel',
  [
    body('reason').optional().isString().trim()
  ],
  validate,
  RideController.cancelRide
);

// Driver-only routes
/**
 * @swagger
 * /rides/:rideId/accept:
 *   post:
 *     summary: Accept ride (Driver only)
 *     tags: [Rides]
 */
router.post('/:rideId/accept', authorizeDriver, RideController.acceptRide);

/**
 * @swagger
 * /rides/:rideId/arrive:
 *   post:
 *     summary: Mark driver arrived (Driver only)
 *     tags: [Rides]
 */
router.post('/:rideId/arrive', authorizeDriver, RideController.driverArrived);

/**
 * @swagger
 * /rides/:rideId/start:
 *   post:
 *     summary: Start ride (Driver only)
 *     tags: [Rides]
 */
router.post('/:rideId/start', authorizeDriver, RideController.startRide);

/**
 * @swagger
 * /rides/:rideId/complete:
 *   post:
 *     summary: Complete ride (Driver only)
 *     tags: [Rides]
 */
router.post(
  '/:rideId/complete',
  [
    body('finalDistance').optional().isFloat({ min: 0.1 }).withMessage('Valid final distance required'),
    body('actualRoute').optional().isArray()
  ],
  validate,
  authorizeDriver,
  RideController.completeRide
);

/**
 * Simulator route for dev testing and presentation
 */
router.post('/:rideId/simulate', async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;
    const prisma = require('../config/database');
    
    // Find or create a mock driver
    let driver = await prisma.driver.findFirst({
      include: { user: true, vehicles: true }
    });
    
    if (!driver) {
      let user = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            phoneNumber: '+919999999998',
            name: 'Vikram Singh (Mock Driver)',
            firebaseUid: 'mock-driver-uid',
            role: 'DRIVER',
            status: 'ACTIVE'
          }
        });
      }
      driver = await prisma.driver.create({
        data: {
          userId: user.id,
          licenseNumber: 'KA-03-2026-12345',
          aadharNumber: '123456789012',
          panNumber: 'ABCDE1234F',
          kycStatus: 'APPROVED',
          status: 'ONLINE',
          isAvailable: true
        },
        include: { user: true }
      });
    }

    // Find or create vehicle
    let vehicle = await prisma.vehicle.findFirst({
      where: { driverId: driver.id }
    });

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          driverId: driver.id,
          vehicleType: 'EV_SCOOTER',
          registrationNumber: 'KA-01-EQ-9876',
          model: 'Ather 450X',
          color: 'Space Grey',
          isActive: true
        }
      });
    }

    let updatedRide;
    const io = req.app.get('io');

    if (status === 'ACCEPTED') {
      updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'ACCEPTED',
          driverId: driver.id,
          vehicleId: vehicle.id,
          acceptedAt: new Date()
        },
        include: { rider: true, driver: { include: { user: true } }, vehicle: true }
      });
      io.to(`ride:${rideId}`).emit('ride:status:updated', { rideId, status: 'ACCEPTED' });
    } else if (status === 'DRIVER_ARRIVED') {
      updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: { status: 'DRIVER_ARRIVED', driverArrivedAt: new Date() },
        include: { rider: true, driver: { include: { user: true } }, vehicle: true }
      });
      io.to(`ride:${rideId}`).emit('ride:status:updated', { rideId, status: 'DRIVER_ARRIVED' });
    } else if (status === 'STARTED') {
      updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: { status: 'STARTED', startedAt: new Date() },
        include: { rider: true, driver: { include: { user: true } }, vehicle: true }
      });
      io.to(`ride:${rideId}`).emit('ride:status:updated', { rideId, status: 'STARTED' });
    } else if (status === 'COMPLETED') {
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      const finalFare = ride.estimatedFare;
      updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          finalFare,
          duration: 12
        },
        include: { rider: true, driver: { include: { user: true } }, vehicle: true }
      });
      io.to(`ride:${rideId}`).emit('ride:status:updated', { rideId, status: 'COMPLETED' });
    } else if (status === 'LOCATION_UPDATE') {
      const { lat, lng } = req.body;
      io.to(`ride:${rideId}`).emit('driver:location:updated', {
        rideId,
        driverId: driver.id,
        lat,
        lng,
        heading: 180,
        timestamp: Date.now()
      });
      return res.json({ success: true, message: 'Driver location updated via simulator' });
    }

    res.json({
      success: true,
      message: `Ride transitioned to ${status}`,
      data: { ride: updatedRide }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Rate ride
 */
router.post('/:rideId/rate', RideController.rateRide);
router.patch('/:rideId/rate', RideController.rateRide);

// ─────────────────────────────────────────────────────────────────
// FLUTTER APP COMPATIBILITY ALIASES
// The Flutter apps use different field names than the original routes.
// These aliases normalise the payload before forwarding to controllers.
// ─────────────────────────────────────────────────────────────────

/**
 * POST /rides/request  (Flutter Rider app uses this path)
 * Normalises: vehicleType → rideType, dropLocation → dropoffLocation
 */
router.post('/request', async (req, res, next) => {
  try {
    const { vehicleType, dropLocation, pickupLocation, paymentMethod, couponCode, seatsBooked } = req.body;
    req.body.rideType        = vehicleType || req.body.rideType || 'SCOOTER';
    req.body.dropoffLocation = dropLocation || req.body.dropoffLocation;
    req.body.pickupLocation  = pickupLocation || req.body.pickupLocation;

    // Estimate distance if not provided
    if (!req.body.estimatedDistance && pickupLocation && dropLocation) {
      const R = 6371;
      const lat1 = (pickupLocation.lat * Math.PI) / 180;
      const lat2 = (dropLocation.lat  * Math.PI) / 180;
      const dLat = lat2 - lat1;
      const dLng = ((dropLocation.lng - pickupLocation.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      req.body.estimatedDistance = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)) || 1.0;
    }
    req.body.estimatedDistance = req.body.estimatedDistance || 1.0;
    next();
  } catch (e) { next(e); }
}, RideController.requestRide);

/**
 * POST /rides/estimate  (Flutter Rider app uses this path)
 * Returns fare estimates for all vehicle types
 */
router.post('/estimate', async (req, res, next) => {
  try {
    const { pickupLocation, dropLocation, vehicleType } = req.body;

    // Haversine distance
    let distance = 1.0;
    if (pickupLocation && dropLocation) {
      const R = 6371;
      const lat1 = (pickupLocation.lat * Math.PI) / 180;
      const lat2 = (dropLocation.lat  * Math.PI) / 180;
      const dLat = lat2 - lat1;
      const dLng = ((dropLocation.lng - pickupLocation.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      distance = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)) || 1.0;
    }

    const BASE_FARE   = { EV_SCOOTER: 20, EV_RICKSHAW_SHARED: 15, EV_RICKSHAW_PRIVATE: 40, SCOOTER: 20, SCOOTER_PRO: 40 };
    const PER_KM_RATE = { EV_SCOOTER: 8,  EV_RICKSHAW_SHARED: 6,  EV_RICKSHAW_PRIVATE: 12, SCOOTER: 8,  SCOOTER_PRO: 12 };

    const types = vehicleType ? [vehicleType] : ['EV_SCOOTER', 'EV_RICKSHAW_SHARED', 'EV_RICKSHAW_PRIVATE'];
    const estimates = {};
    types.forEach(t => {
      const base = BASE_FARE[t] || 20;
      const rate = PER_KM_RATE[t] || 8;
      const fare = Math.round(base + rate * distance);
      estimates[t] = { fare, distance, baseFare: base, perKmRate: rate, estimatedMinutes: Math.round(distance * 3 + 5) };
    });

    res.json({ success: true, data: { estimates, distance, vehicleType: vehicleType || 'EV_SCOOTER' } });
  } catch (e) { next(e); }
});

/**
 * POST /rides/validate-coupon  (Flutter Rider app uses this path)
 */
router.post('/validate-coupon', async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    if (!code) return res.json({ success: false, message: 'Coupon code required' });

    const prisma = require('../config/database');
    const config = await prisma.systemConfig.findUnique({ where: { key: 'active_coupons' } });
    if (!config) return res.json({ success: false, message: 'No active coupons' });

    const coupons = JSON.parse(config.value);
    const coupon  = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
    if (!coupon)           return res.json({ success: false, message: 'Invalid coupon code' });
    if (!coupon.isActive)  return res.json({ success: false, message: 'Coupon is no longer active' });
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.json({ success: false, message: 'Coupon has expired' });
    }
    if (amount && amount < coupon.minRideAmount) {
      return res.json({ success: false, message: `Minimum ride amount ₹${coupon.minRideAmount} required` });
    }

    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = Math.min(Math.round((amount || 100) * coupon.discountValue / 100), coupon.maxDiscount || Infinity);
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      success: true,
      message: `Coupon applied! You save ₹${discount}`,
      data: { discount, discountValue: coupon.discountValue, discountType: coupon.discountType, code: coupon.code }
    });
  } catch (e) { next(e); }
});

module.exports = router;

