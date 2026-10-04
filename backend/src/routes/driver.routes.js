/**
 * Driver Routes
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorizeDriver } = require('../middleware/auth');
const DriverController = require('../controllers/DriverController');
const prisma = require('../config/database');
const RideController = require('../controllers/RideController');
const PaymentController = require('../controllers/PaymentController');

// All routes require authentication
router.use(authenticate);

/**
 * Register as driver
 */
router.post(
  '/register',
  [
    body('licenseNumber').notEmpty().trim().withMessage('License number required'),
    body('aadharNumber').isLength({ min: 12, max: 12 }).withMessage('Valid Aadhar number required'),
    body('panNumber').isLength({ min: 10, max: 10 }).withMessage('Valid PAN number required')
  ],
  validate,
  DriverController.registerDriver
);

/**
 * Upload single KYC document (onboarding)
 */
router.post('/upload-document', DriverController.uploadDocument);

/**
 * Update driver profile and license info (onboarding Step 2)
 */
router.patch('/profile', DriverController.patchProfile);

/**
 * Add vehicle (onboarding Step 3 - mobile app)
 */
router.post('/vehicle', DriverController.addVehicle);

/**
 * Upload KYC documents (bulk legacy)
 */
router.post('/kyc', DriverController.uploadKYC);

/**
 * Add vehicle (bulk legacy)
 */
router.post(
  '/vehicles',
  [
    body('vehicleType').isIn(['EV_2W', 'EV_2W_PRO']).withMessage('Invalid vehicle type'),
    body('registrationNumber').notEmpty().trim().withMessage('Registration number required'),
    body('model').notEmpty().trim().withMessage('Model required'),
    body('color').optional().trim(),
    body('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 1 }),
    body('totalSeats').optional().isInt({ min: 1, max: 6 })
  ],
  validate,
  DriverController.addVehicle
);

/**
 * Active ride check
 */
router.get('/active-ride', RideController.getActiveRide);

/**
 * Pending unassigned ride requests (polling fallback for socket disconnects)
 */
router.get('/pending-requests', RideController.getPendingRequests);


/**
 * Ride details
 */
router.get('/rides/:rideId', RideController.getRide);

/**
 * Ride actions (require KYC-approved driver)
 */
router.post('/rides/:rideId/accept', authorizeDriver, RideController.acceptRide);
router.post('/rides/:rideId/arrive', authorizeDriver, RideController.driverArrived);
router.post('/rides/:rideId/start', authorizeDriver, RideController.startRide);
router.post('/rides/:rideId/complete', authorizeDriver, RideController.completeRide);
router.post('/rides/:rideId/rate', authorizeDriver, RideController.rateRide);
router.patch('/rides/:rideId/rate', authorizeDriver, RideController.rateRide);

// Reject ride alias (mock success)
router.post('/rides/:rideId/reject', (req, res) => {
  res.json({ success: true, message: 'Ride request rejected' });
});

// Verify payment alias
router.post('/rides/:rideId/verify-payment', authorizeDriver, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.driver.id;

    if (req.body.received === false) {
      req.body.isVerified = false;
    } else if (req.body.isVerified === undefined) {
      req.body.isVerified = true;
    }

    let payment = await prisma.payment.findUnique({
      where: { rideId },
      include: { ride: true }
    });

    if (!payment) {
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride || ride.driverId !== driverId) {
        return res.status(404).json({ success: false, message: 'Ride not found for payment verification' });
      }
      const PaymentService = require('../services/PaymentService');
      const amount = ride.finalFare || ride.estimatedFare || 0;
      const initiated = await PaymentService.initiatePayment(rideId, amount);
      payment = await prisma.payment.findUnique({
        where: { id: initiated.paymentId },
        include: { ride: true }
      });
    }

    if (!payment || payment.ride.driverId !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized payment verification' });
    }

    req.params.paymentId = payment.id;
    return PaymentController.verifyPayment(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel active ride (driver)
 */
router.post(
  '/rides/:rideId/cancel',
  authorizeDriver,
  [
    body('reason').optional().isString().trim()
  ],
  validate,
  RideController.cancelRide
);

/**
 * Update driver status
 */
router.patch(
  '/status',
  (req, res, next) => {
    if (req.body.isOnline !== undefined && req.body.status === undefined) {
      req.body.status = req.body.isOnline ? 'ONLINE' : 'OFFLINE';
    }
    next();
  },
  [
    body('status').isIn(['ONLINE', 'OFFLINE']).withMessage('Invalid status'),
    body('isAvailable').optional().isBoolean()
  ],
  validate,
  authorizeDriver,
  DriverController.updateStatus
);

/**
 * Update location
 */
router.patch(
  '/location',
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('heading').optional().isFloat({ min: 0, max: 360 })
  ],
  validate,
  authorizeDriver,
  DriverController.updateLocation
);

/**
 * Get earnings
 */
router.get(
  '/earnings',
  [
    query('period').optional().isIn(['today', 'week', 'month', 'all'])
  ],
  validate,
  authorizeDriver,
  DriverController.getEarnings
);

/**
 * Get driver profile
 */
router.get('/profile', DriverController.getProfile);

module.exports = router;
