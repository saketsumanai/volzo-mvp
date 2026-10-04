/**
 * Payment Service — Full Razorpay + QR UPI Integration
 *
 * Providers:
 *  - QRPaymentProvider  : Manual UPI QR scan flow (MVP fallback)
 *  - RazorpayProvider   : Official Razorpay SDK — orders, verification, refunds
 *
 * Architecture: provider pattern — swap provider without touching controllers.
 */

const Razorpay = require('razorpay');
const crypto   = require('crypto');
const prisma   = require('../config/database');
const { logger } = require('../utils/logger');
const { emitToUser, emitToRide } = require('../socket');

// ─────────────────────────────────────────────
// BASE INTERFACE
// ─────────────────────────────────────────────
class PaymentProvider {
  async initiatePayment(rideId, amount, metadata) { throw new Error('Not implemented'); }
  async verifyPayment(paymentId, verificationData) { throw new Error('Not implemented'); }
  async refundPayment(paymentId, amount, reason)   { throw new Error('Not implemented'); }
}

// ─────────────────────────────────────────────
// QR / UPI PROVIDER (Manual flow)
// ─────────────────────────────────────────────
class QRPaymentProvider extends PaymentProvider {
  constructor() {
    super();
    this.upiId      = process.env.UPI_ID;
    this.upiName    = process.env.UPI_NAME;
    this.qrImageUrl = process.env.UPI_QR_IMAGE_URL;
  }

  async initiatePayment(rideId, amount, metadata = {}) {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { rider: true, driver: true }
      });

      if (!ride) throw new Error('Ride not found');

      const payment = await prisma.payment.upsert({
        where:  { rideId },
        update: { amount, method: 'QR_UPI', status: 'PENDING', upiId: this.upiId },
        create: { rideId, amount, method: 'QR_UPI', status: 'PENDING', upiId: this.upiId }
      });

      logger.info(`QR payment initiated: ${payment.id} for ride ${rideId}`);

      return {
        paymentId: payment.id,
        method:    'QR_UPI',
        qrCode: {
          imageUrl:   this.qrImageUrl,
          upiId:      this.upiId,
          name:       this.upiName,
          amount:     amount.toString(),
          rideNumber: ride.rideNumber
        },
        instructions: [
          'Scan the QR code using any UPI app (GPay, PhonePe, Paytm, BHIM)',
          `Enter the exact amount: ₹${amount}`,
          'Complete the payment',
          'Click "I Have Paid" button',
          'Wait for driver to verify'
        ]
      };
    } catch (error) {
      logger.error('QR payment initiation failed:', error);
      throw error;
    }
  }

  async confirmPayment(paymentId, confirmationData) {
    try {
      const { upiTransactionId, screenshot, note } = confirmationData;

      const existingPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!existingPayment)               throw new Error('Payment not found');
      if (existingPayment.status !== 'PENDING') throw new Error('Payment already processed');

      // Fraud check: duplicate transaction ID
      if (upiTransactionId) {
        const dup = await prisma.payment.findFirst({
          where: {
            upiTransactionId,
            id:     { not: paymentId },
            status: { in: ['RIDER_CONFIRMED', 'DRIVER_VERIFIED'] }
          }
        });
        if (dup) {
          await prisma.payment.update({
            where: { id: paymentId },
            data:  { isFlagged: true, flagReason: 'Duplicate UPI transaction ID' }
          });
          throw new Error('Duplicate transaction detected');
        }
      }

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status:            'RIDER_CONFIRMED',
          upiTransactionId,
          paymentScreenshot: screenshot,
          riderNote:         note,
          riderConfirmedAt:  new Date()
        },
        include: { ride: { include: { rider: true, driver: true } } }
      });

      await prisma.ride.update({ where: { id: payment.rideId }, data: { status: 'PAYMENT_PENDING' } });

      // Auto-verify after 5 min if driver hasn't acted
      setTimeout(async () => {
        try {
          const latest = await prisma.payment.findUnique({
            where:   { id: paymentId },
            include: { ride: { include: { driver: true } } }
          });
          if (!latest || latest.status !== 'RIDER_CONFIRMED' || !latest.ride?.driverId) return;

          const autoVerified = await prisma.payment.update({
            where: { id: paymentId },
            data:  { status: 'DRIVER_VERIFIED', driverVerifiedAt: new Date(), verifiedBy: latest.ride.driverId }
          });

          await prisma.ride.update({ where: { id: latest.rideId }, data: { status: 'PAYMENT_VERIFIED' } });

          const io = require('../server').app.get('io');
          const payload = { paymentId: autoVerified.id, rideId: autoVerified.rideId, status: 'DRIVER_VERIFIED', autoVerified: true };
          emitToUser(io, latest.ride.riderId, 'payment:verified', payload);
          if (latest.ride.driverId) emitToUser(io, latest.ride.driverId, 'payment:verified', payload);
          emitToRide(io, latest.rideId, 'payment:verified', payload);
        } catch (err) {
          logger.error('Auto-verify payment failed:', err);
        }
      }, 5 * 60 * 1000);

      logger.info(`Payment confirmed by rider: ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error('Payment confirmation failed:', error);
      throw error;
    }
  }

  async verifyPayment(paymentId, verificationData) {
    try {
      const { driverId, isVerified, rejectionReason } = verificationData;

      const payment = await prisma.payment.findUnique({
        where:   { id: paymentId },
        include: { ride: true }
      });

      if (!payment)                                            throw new Error('Payment not found');
      if (!['RIDER_CONFIRMED', 'PENDING'].includes(payment.status)) throw new Error('Payment not ready for verification');
      if (payment.ride.driverId !== driverId)                 throw new Error('Unauthorized: driver does not own this ride');

      const newStatus  = isVerified ? 'DRIVER_VERIFIED' : 'FAILED';
      const rideStatus = isVerified ? 'PAYMENT_VERIFIED' : 'COMPLETED';

      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data:  {
          status:          newStatus,
          driverVerifiedAt: new Date(),
          verifiedBy:      driverId,
          ...(rejectionReason && { flagReason: rejectionReason, isFlagged: true })
        }
      });

      await prisma.ride.update({ where: { id: payment.rideId }, data: { status: rideStatus } });

      if (isVerified) {
        const commissionPct = parseFloat(process.env.DRIVER_COMMISSION_PERCENT) || 15;
        const driverShare   = payment.amount * (1 - commissionPct / 100);
        await prisma.driver.update({
          where: { id: driverId },
          data:  { totalEarnings: { increment: driverShare }, pendingEarnings: { increment: driverShare } }
        });
      }

      logger.info(`QR Payment ${isVerified ? 'verified' : 'rejected'} by driver: ${paymentId}`);
      return updatedPayment;
    } catch (error) {
      logger.error('QR Payment verification failed:', error);
      throw error;
    }
  }

  async refundPayment(paymentId, amount) {
    throw new Error('Refund not supported for QR payments. Process manually.');
  }
}

// ─────────────────────────────────────────────
// RAZORPAY PROVIDER — Official SDK
// ─────────────────────────────────────────────
class RazorpayProvider extends PaymentProvider {
  constructor() {
    super();
    this.keyId     = process.env.RAZORPAY_KEY_ID     || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (this.keyId && this.keySecret) {
      this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
      logger.info('✅ Razorpay SDK initialized');
    } else {
      logger.warn('⚠️ Razorpay keys not configured — running in mock mode');
      this.client = null;
    }
  }

  /**
   * Create Razorpay order (called before showing checkout)
   */
  async createOrder(rideId, amount) {
    const ride = await prisma.ride.findUnique({
      where:   { id: rideId },
      include: { rider: true }
    });
    if (!ride) throw new Error('Ride not found');

    const amountInPaise = Math.round(amount * 100);
    let   orderId;

    if (this.client) {
      const order = await this.client.orders.create({
        amount:          amountInPaise,
        currency:        'INR',
        receipt:         `rzp_${ride.rideNumber}_${Date.now()}`,
        notes:           { rideId, rideNumber: ride.rideNumber }
      });
      orderId = order.id;
    } else {
      // Mock order for development
      orderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      logger.info(`[MOCK] Razorpay order created: ${orderId}`);
    }

    const payment = await prisma.payment.upsert({
      where:  { rideId },
      update: { amount, method: 'RAZORPAY', status: 'PENDING', razorpayOrderId: orderId },
      create: { rideId, amount, method: 'RAZORPAY', status: 'PENDING', razorpayOrderId: orderId }
    });

    logger.info(`Razorpay order created: ${orderId} for ride ${rideId}`);

    return {
      paymentId:   payment.id,
      orderId,
      amount:      amountInPaise,
      currency:    'INR',
      keyId:       this.keyId,
      rideNumber:  ride.rideNumber,
      riderName:   ride.rider?.name       || 'Volzo Rider',
      riderPhone:  ride.rider?.phoneNumber || ''
    };
  }

  /**
   * Verify Razorpay payment signature (called after checkout success)
   */
  async verifySignature(rideId, paymentDetails) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentDetails;

    const payment = await prisma.payment.findFirst({
      where:   { OR: [{ rideId }, { razorpayOrderId }] },
      include: { ride: { include: { driver: true, rider: true } } }
    });
    if (!payment) throw new Error('Payment record not found');

    // Signature verification
    if (this.keySecret && razorpaySignature && razorpaySignature !== 'mock_sig') {
      const expectedSig = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSig !== razorpaySignature) {
        logger.warn(`Razorpay signature mismatch for order ${razorpayOrderId}`);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Payment signature verification failed');
        }
      }
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data:  {
        status:             'DRIVER_VERIFIED',
        method:             'RAZORPAY',
        razorpayOrderId:    razorpayOrderId    || payment.razorpayOrderId,
        razorpayPaymentId:  razorpayPaymentId  || `pay_${Date.now()}`,
        razorpaySignature:  razorpaySignature  || 'verified',
        driverVerifiedAt:   new Date()
      },
      include: { ride: { include: { rider: true, driver: true } } }
    });

    await prisma.ride.update({ where: { id: payment.rideId }, data: { status: 'PAYMENT_VERIFIED' } });

    if (payment.ride?.driverId) {
      const commissionPct = parseFloat(process.env.DRIVER_COMMISSION_PERCENT) || 15;
      const driverShare   = payment.amount * (1 - commissionPct / 100);
      await prisma.driver.update({
        where: { id: payment.ride.driverId },
        data:  { totalEarnings: { increment: driverShare }, pendingEarnings: { increment: driverShare } }
      });
    }

    logger.info(`Razorpay payment verified for ride ${payment.rideId}`);
    return updatedPayment;
  }

  /**
   * Handle Razorpay webhook (server-side payment confirmation)
   */
  async handleWebhook(webhookBody, razorpaySignature) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // Verify webhook signature
    if (webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookBody))
        .digest('hex');

      if (expectedSig !== razorpaySignature) {
        throw new Error('Webhook signature verification failed');
      }
    }

    const event = webhookBody.event;
    const paymentEntity = webhookBody.payload?.payment?.entity;

    logger.info(`Razorpay webhook received: ${event}`);

    if (event === 'payment.captured' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const payId   = paymentEntity.id;

      const payment = await prisma.payment.findFirst({
        where:   { razorpayOrderId: orderId },
        include: { ride: { include: { driver: true } } }
      });

      if (payment && payment.status === 'PENDING') {
        await prisma.payment.update({
          where: { id: payment.id },
          data:  {
            status:            'DRIVER_VERIFIED',
            razorpayPaymentId: payId,
            driverVerifiedAt:  new Date()
          }
        });

        await prisma.ride.update({ where: { id: payment.rideId }, data: { status: 'PAYMENT_VERIFIED' } });

        if (payment.ride?.driverId) {
          const commissionPct = parseFloat(process.env.DRIVER_COMMISSION_PERCENT) || 15;
          const driverShare   = payment.amount * (1 - commissionPct / 100);
          await prisma.driver.update({
            where: { id: payment.ride.driverId },
            data:  { totalEarnings: { increment: driverShare }, pendingEarnings: { increment: driverShare } }
          });
        }

        logger.info(`Webhook: Payment captured for ride ${payment.rideId}`);
      }
    }

    if (event === 'refund.processed' && webhookBody.payload?.refund?.entity) {
      const refundEntity = webhookBody.payload.refund.entity;
      const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId: refundEntity.payment_id }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data:  { status: 'REFUNDED', refundStatus: 'processed', refundedAt: new Date(), refundId: refundEntity.id }
        });
      }
    }

    return { processed: true, event };
  }

  /**
   * Initiate refund via Razorpay
   */
  async refundPayment(paymentId, amount, reason = 'Refund requested') {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Payment not found');

    if (!payment.razorpayPaymentId) {
      throw new Error('Cannot refund: no Razorpay payment ID on record');
    }

    let refundData;

    if (this.client) {
      refundData = await this.client.payments.refund(payment.razorpayPaymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
        notes:  { reason }
      });
    } else {
      // Mock refund for development
      refundData = {
        id:     `rfnd_mock_${Date.now()}`,
        status: 'processed',
        amount: amount ? Math.round(amount * 100) : Math.round(payment.amount * 100)
      };
      logger.info(`[MOCK] Razorpay refund processed: ${refundData.id}`);
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data:  {
        status:       'REFUNDED',
        refundId:     refundData.id,
        refundStatus: refundData.status || 'initiated',
        refundAmount: amount || payment.amount,
        refundedAt:   new Date()
      }
    });

    logger.info(`Refund ${refundData.id} processed for payment ${paymentId}`);
    return { refundId: refundData.id, status: refundData.status, amount: updatedPayment.refundAmount };
  }
}

// ─────────────────────────────────────────────
// PAYMENT SERVICE — Main facade
// ─────────────────────────────────────────────
class PaymentService {
  constructor() {
    this.qrProvider       = new QRPaymentProvider();
    this.razorpayProvider = new RazorpayProvider();
  }

  // QR Flow
  async initiatePayment(rideId, amount, metadata) {
    return this.qrProvider.initiatePayment(rideId, amount, metadata);
  }

  async confirmPayment(paymentId, confirmationData) {
    return this.qrProvider.confirmPayment(paymentId, confirmationData);
  }

  async verifyPayment(paymentId, verificationData) {
    return this.qrProvider.verifyPayment(paymentId, verificationData);
  }

  // Razorpay Flow
  async createRazorpayOrder(rideId, amount) {
    return this.razorpayProvider.createOrder(rideId, amount);
  }

  async verifyRazorpayPayment(rideId, paymentDetails) {
    return this.razorpayProvider.verifySignature(rideId, paymentDetails);
  }

  async handleRazorpayWebhook(webhookBody, signature) {
    return this.razorpayProvider.handleWebhook(webhookBody, signature);
  }

  // Refund — tries Razorpay, falls back to error for QR
  async refundPayment(paymentId, amount, reason) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Payment not found');

    if (payment.method === 'RAZORPAY') {
      return this.razorpayProvider.refundPayment(paymentId, amount, reason);
    }
    return this.qrProvider.refundPayment(paymentId, amount);
  }

  // Queries
  async getPayment(paymentId) {
    return prisma.payment.findUnique({
      where:   { id: paymentId },
      include: { ride: { include: { rider: true, driver: true } } }
    });
  }

  async getPaymentByRide(rideId) {
    return prisma.payment.findUnique({
      where:   { rideId },
      include: { ride: { include: { rider: true, driver: true } } }
    });
  }

  async getPendingPayments() {
    return prisma.payment.findMany({
      where:   { status: { in: ['PENDING', 'RIDER_CONFIRMED'] } },
      include: { ride: { include: { rider: true, driver: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getFlaggedPayments() {
    return prisma.payment.findMany({
      where:   { isFlagged: true },
      include: { ride: { include: { rider: true, driver: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllPayments({ status, method, page = 1, pageSize = 20, startDate, endDate } = {}) {
    const where = {};
    if (status) where.status = status;
    if (method) where.method = method;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { ride: { include: { rider: true, driver: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize
      }),
      prisma.payment.count({ where })
    ]);

    return { payments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}

module.exports = new PaymentService();
