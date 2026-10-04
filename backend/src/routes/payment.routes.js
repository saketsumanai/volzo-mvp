/**
 * Payment Routes — Full Razorpay + QR UPI
 */

const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorizeDriver } = require('../middleware/auth');
const PaymentController = require('../controllers/PaymentController');

// ─────────────────────────────────────────────
// RAZORPAY WEBHOOK (no auth — verified by HMAC)
// Must be BEFORE the `authenticate` middleware
// ─────────────────────────────────────────────
router.post(
  '/razorpay/webhook',
  express.raw({ type: 'application/json' }), // raw body for signature verification
  PaymentController.handleRazorpayWebhook
);

// All other routes require JWT authentication
router.use(authenticate);

// ─────────────────────────────────────────────
// QR / UPI FLOW
// ─────────────────────────────────────────────

/** Get UPI QR details */
router.get('/qr-details', PaymentController.getQRDetails);

/** Upload payment screenshot */
router.post('/upload-screenshot', PaymentController.uploadScreenshot);

/** Initiate QR payment for a ride */
router.post(
  '/initiate',
  [body('rideId').notEmpty().withMessage('Ride ID required')],
  validate,
  PaymentController.initiatePayment
);

/** Rider confirms QR payment (with or without paymentId in URL) */
router.post(
  '/confirm',
  [
    body('paymentId').optional().isString(),
    body('rideId').optional().isString()
  ],
  validate,
  (req, res, next) => {
    if (!req.body.paymentId && !req.body.rideId) {
      return res.status(400).json({ success: false, message: 'Payment ID or Ride ID required' });
    }
    next();
  },
  PaymentController.confirmPayment
);

/** Legacy: Rider confirms with paymentId in URL */
router.post(
  '/:paymentId/confirm',
  [
    body('upiTransactionId').optional().trim(),
    body('screenshot').optional().isString(),
    body('note').optional().trim()
  ],
  validate,
  PaymentController.confirmPayment
);

/** Driver verifies QR payment */
router.post(
  '/:paymentId/verify',
  [
    body('isVerified').isBoolean().withMessage('Verification status required'),
    body('rejectionReason').optional().trim()
  ],
  validate,
  authorizeDriver,
  PaymentController.verifyPayment
);

// ─────────────────────────────────────────────
// RAZORPAY GATEWAY FLOW
// ─────────────────────────────────────────────

/** Create Razorpay order */
router.post(
  '/razorpay/create-order',
  [body('rideId').notEmpty().withMessage('Ride ID required')],
  validate,
  PaymentController.createRazorpayOrder
);

/** Verify Razorpay payment signature (after checkout) */
router.post(
  '/razorpay/verify',
  [
    body('rideId').optional().isString(),
    body('razorpayOrderId').optional().isString(),
    body('razorpayPaymentId').optional().isString(),
    body('razorpaySignature').optional().isString()
  ],
  validate,
  PaymentController.verifyRazorpayPayment
);

// ─────────────────────────────────────────────
// REFUND (admin or system-triggered)
// ─────────────────────────────────────────────

/** Initiate refund */
router.post(
  '/:paymentId/refund',
  [
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('reason').optional().trim()
  ],
  validate,
  PaymentController.refundPayment
);

// ─────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────

/** Get payment details by payment ID */
router.get('/:paymentId', PaymentController.getPayment);

/** Get payment by ride ID */
router.get('/ride/:rideId', PaymentController.getPaymentByRide);

module.exports = router;
