const PaymentService = require('../services/PaymentService');
const { logger } = require('../utils/logger');
const prisma = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Configure storage for payment screenshots
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads/payments/')) {
      fs.mkdirSync('uploads/payments/', { recursive: true });
    }
    cb(null, 'uploads/payments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const receiptUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  }
}).single('screenshot');

class PaymentController {
  async _resolvePaymentIdFromRide(rideId, userId) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        payment: true
      }
    });

    if (!ride) {
      throw new Error('Ride not found');
    }

    if (ride.riderId !== userId) {
      throw new Error('Unauthorized');
    }

    if (!['COMPLETED', 'PAYMENT_PENDING'].includes(ride.status)) {
      throw new Error('Ride must be completed before payment');
    }

    if (ride.payment?.id) {
      return ride.payment.id;
    }

    const amount = ride.finalFare || ride.estimatedFare || 0;
    const paymentData = await PaymentService.initiatePayment(ride.id, amount);
    return paymentData.paymentId;
  }

  /**
   * Initiate payment
   */
  async initiatePayment(req, res, next) {
    try {
      const { rideId } = req.body;
      const userId = req.user.id;

      // Verify ride belongs to user
      const ride = await prisma.ride.findUnique({
        where: { id: rideId }
      });

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: 'Ride not found'
        });
      }

      if (ride.riderId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      if (ride.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Ride must be completed before payment'
        });
      }

      const amount = ride.finalFare || ride.estimatedFare;
      const paymentData = await PaymentService.initiatePayment(rideId, amount);

      res.json({
        success: true,
        message: 'Payment initiated',
        data: paymentData
      });
    } catch (error) {
      logger.error('Initiate payment error:', error);
      next(error);
    }
  }

  /**
   * Create Razorpay Order
   */
  async createRazorpayOrder(req, res, next) {
    try {
      const { rideId } = req.body;
      const userId = req.user.id;

      const ride = await prisma.ride.findUnique({
        where: { id: rideId }
      });

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: 'Ride not found'
        });
      }

      if (ride.riderId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const amount = ride.finalFare || ride.estimatedFare || 0;
      const orderData = await PaymentService.createRazorpayOrder(rideId, amount);

      res.json({
        success: true,
        message: 'Razorpay order created successfully',
        data: orderData
      });
    } catch (error) {
      logger.error('Create Razorpay order error:', error);
      next(error);
    }
  }

  /**
   * Verify Razorpay Payment
   */
  async verifyRazorpayPayment(req, res, next) {
    try {
      const { rideId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!rideId && !razorpayOrderId) {
        return res.status(400).json({
          success: false,
          message: 'Ride ID or Razorpay Order ID is required'
        });
      }

      const updatedPayment = await PaymentService.verifyRazorpayPayment(rideId, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });

      const io = req.app.get('io');
      const { emitToUser, emitToRide } = require('../socket');
      
      if (updatedPayment.ride?.driver?.userId) {
        emitToUser(io, updatedPayment.ride.driver.userId, 'payment:verified', {
          paymentId: updatedPayment.id,
          rideId: updatedPayment.rideId,
          status: updatedPayment.status,
          amount: updatedPayment.amount
        });
      }

      emitToUser(io, updatedPayment.ride.riderId, 'payment:verified', {
        paymentId: updatedPayment.id,
        rideId: updatedPayment.rideId,
        status: updatedPayment.status,
        amount: updatedPayment.amount
      });

      emitToRide(io, updatedPayment.rideId, 'payment:verified', {
        paymentId: updatedPayment.id,
        rideId: updatedPayment.rideId,
        status: updatedPayment.status,
        amount: updatedPayment.amount
      });

      res.json({
        success: true,
        message: 'Razorpay payment verified successfully',
        data: { payment: updatedPayment }
      });
    } catch (error) {
      logger.error('Verify Razorpay payment error:', error);
      next(error);
    }
  }

  /**
   * Get dynamic UPI/QR payment details (Rider App Step 2)
   */
  async getQRDetails(req, res, next) {
    try {
      const host = req.get('host');
      const protocol = req.protocol;
      res.json({
        success: true,
        data: {
          upiId: process.env.UPI_ID || '8102964108@ptsbi',
          name: process.env.UPI_NAME || 'SAKET SUMAN',
          qrImageUrl: process.env.UPI_QR_IMAGE_URL || `${protocol}://${host}/uploads/payments/payment-qr.jpg`
        }
      });
    } catch (error) {
      logger.error('Get QR details error:', error);
      next(error);
    }
  }

  /**
   * Upload screenshot of payment receipt
   */
  uploadScreenshot = [
    (req, res, next) => {
      receiptUpload(req, res, (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        next();
      });
    },
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No screenshot file provided' });
        }
        const url = `/uploads/payments/${req.file.filename}`;
        res.json({
          success: true,
          message: 'Screenshot uploaded successfully',
          data: { url }
        });
      } catch (error) {
        logger.error('Upload screenshot error:', error);
        next(error);
      }
    }
  ];

  /**
   * Confirm payment (Rider)
   */
  async confirmPayment(req, res, next) {
    try {
      let paymentId = req.params.paymentId || req.body.paymentId;
      const rideId = req.body.rideId;
      const { upiTransactionId, screenshot, screenshotUrl, note } = req.body;
      const userId = req.user.id;

      if (!paymentId && !rideId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID or Ride ID is required'
        });
      }

      if (!paymentId && rideId) {
        paymentId = await this._resolvePaymentIdFromRide(rideId, userId);
      }

      // Verify payment belongs to user
      const payment = await PaymentService.getPayment(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.ride.riderId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const confirmationData = {
        upiTransactionId,
        screenshot: screenshot || screenshotUrl,
        note
      };

      const updatedPayment = await PaymentService.confirmPayment(paymentId, confirmationData);

      // Notify driver via Socket.IO
      const io = req.app.get('io');
      const { emitToUser } = require('../socket');
      
      if (payment.ride.driverId) {
        emitToUser(io, payment.ride.driver.userId, 'payment:confirmed', {
          paymentId: updatedPayment.id,
          rideId: payment.rideId,
          amount: updatedPayment.amount
        });
      }

      res.json({
        success: true,
        message: 'Payment confirmation received. Waiting for driver verification.',
        data: { payment: updatedPayment }
      });
    } catch (error) {
      logger.error('Confirm payment error:', error);
      next(error);
    }
  }

  /**
   * Verify payment (Driver)
   */
  async verifyPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { isVerified, rejectionReason } = req.body;
      const driverId = req.user.driver.id;

      const verificationData = {
        driverId,
        isVerified,
        rejectionReason
      };

      const payment = await PaymentService.verifyPayment(paymentId, verificationData);

      // Notify rider via Socket.IO
      const io = req.app.get('io');
      const { emitToUser } = require('../socket');
      
      emitToUser(io, payment.ride.riderId, 'payment:verified', {
        paymentId: payment.id,
        rideId: payment.rideId,
        status: payment.status,
        isVerified
      });

      res.json({
        success: true,
        message: isVerified ? 'Payment verified successfully' : 'Payment rejected',
        data: { payment }
      });
    } catch (error) {
      logger.error('Verify payment error:', error);
      next(error);
    }
  }

  /**
   * Get payment details
   */
  async getPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const userId = req.user.id;

      const payment = await PaymentService.getPayment(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Check authorization
      const isAuthorized = 
        payment.ride.riderId === userId ||
        payment.ride.driver?.userId === userId ||
        req.user.role === 'ADMIN';

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      res.json({
        success: true,
        data: { payment }
      });
    } catch (error) {
      logger.error('Get payment error:', error);
      next(error);
    }
  }

  /**
   * Get payment by ride
   */
  async getPaymentByRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      const payment = await prisma.payment.findUnique({
        where: { rideId },
        include: {
          ride: {
            include: {
              rider: true,
              driver: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found for this ride'
        });
      }

      // Check authorization
      const isAuthorized = 
        payment.ride.riderId === userId ||
        payment.ride.driver?.userId === userId ||
        req.user.role === 'ADMIN';

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      res.json({
        success: true,
        data: { payment }
      });
    } catch (error) {
      logger.error('Get payment by ride error:', error);
      next(error);
    }
  }
  /**
   * Handle Razorpay Webhook (HMAC-verified, no auth middleware)
   */
  async handleRazorpayWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const body = req.body;

      // Parse raw body if needed
      const bodyObj = typeof body === 'string' ? JSON.parse(body) :
                      Buffer.isBuffer(body)    ? JSON.parse(body.toString()) : body;

      const result = await PaymentService.handleRazorpayWebhook(bodyObj, signature);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Razorpay webhook error:', error);
      // Always return 200 to Razorpay to prevent retries on signature failures
      res.status(200).json({ success: false, message: error.message });
    }
  }

  /**
   * Refund payment (Admin or system)
   */
  async refundPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { amount, reason } = req.body;

      // Only ADMIN can trigger refunds
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Admin access required for refunds' });
      }

      const result = await PaymentService.refundPayment(paymentId, amount, reason);

      res.json({
        success: true,
        message: 'Refund initiated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Refund payment error:', error);
      next(error);
    }
  }
}

module.exports = new PaymentController();
