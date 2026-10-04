/**
 * Admin Controller
 * High-fidelity administration logic for SaaS analytics, coupon management,
 * support tickets, heatmaps, and exhaustive entity linkages.
 */

const prisma = require('../config/database');
const { logger } = require('../utils/logger');

const sanitizeDriver = (driver) => {
  if (!driver) return null;
  const sanitized = { ...driver };
  
  if (sanitized.licenseNumber) {
    const num = sanitized.licenseNumber.toString();
    sanitized.licenseNumber = num.length >= 4 
      ? '*'.repeat(num.length - 4) + num.slice(-4)
      : '[SECURE_PLACEHOLDER]';
  }

  if (sanitized.aadharNumber) {
    const num = sanitized.aadharNumber.toString();
    sanitized.aadharNumber = num.length >= 4 
      ? '*'.repeat(num.length - 4) + num.slice(-4)
      : '[SECURE_PLACEHOLDER]';
  }

  if (sanitized.panNumber) {
    const num = sanitized.panNumber.toString();
    sanitized.panNumber = num.length >= 4 
      ? '*'.repeat(num.length - 4) + num.slice(-4)
      : '[SECURE_PLACEHOLDER]';
  }

  if (sanitized.aadharImage) sanitized.aadharImage = '[ACCESS_RESTRICTED]';
  if (sanitized.panImage) sanitized.panImage = '[ACCESS_RESTRICTED]';
  if (sanitized.licenseImage) sanitized.licenseImage = '[ACCESS_RESTRICTED]';

  return sanitized;
};

class AdminController {
  /**
   * Get detailed driver dossier linking Vehicles, KYC documents, reviews, rides, and payments
   */
  async getDriverDetails(req, res, next) {
    try {
      const { driverId } = req.params;

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
              profileImage: true,
              status: true,
              createdAt: true
            }
          },
          vehicles: true,
          rides: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              rider: {
                select: { name: true, phoneNumber: true }
              },
              payment: true
            }
          }
        }
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      // Calculate earnings breakdown
      const completedRides = await prisma.ride.findMany({
        where: {
          driverId,
          status: 'COMPLETED'
        },
        select: { finalFare: true }
      });

      const totalRevenueGenerated = completedRides.reduce((sum, r) => sum + parseFloat(r.finalFare || 0), 0);
      const commissionPercent = parseFloat(process.env.DRIVER_COMMISSION_PERCENT || 15);
      const hostRevenue = totalRevenueGenerated * (commissionPercent / 100);
      const driverPayout = totalRevenueGenerated - hostRevenue;

      // Fetch driver reviews
      const reviews = await prisma.review.findMany({
        where: { driverId: driver.userId },
        include: {
          rider: { select: { name: true, profileImage: true } }
        }
      });

      res.json({
        success: true,
        data: {
          driver: sanitizeDriver(driver),
          analytics: {
            totalRevenueGenerated,
            hostRevenue,
            driverPayout,
            completedRidesCount: completedRides.length
          },
          reviews
        }
      });
    } catch (error) {
      logger.error('Get admin driver details error:', error);
      next(error);
    }
  }

  /**
   * Manually verify a driver's vehicle and mark it active
   */
  async verifyVehicle(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { isVerified } = req.body;

      const vehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          isVerified,
          isActive: isVerified
        }
      });

      logger.info(`Vehicle ${vehicleId} verification state updated to ${isVerified}`);
      res.json({
        success: true,
        message: `Vehicle ${isVerified ? 'verified' : 'unverified'} successfully`,
        data: { vehicle }
      });
    } catch (error) {
      logger.error('Verify vehicle error:', error);
      next(error);
    }
  }

  /**
   * List all support tickets
   */
  async getSupportTickets(req, res, next) {
    try {
      const { status, priority } = req.query;
      const where = {
        ...(status && { status }),
        ...(priority && { priority })
      };

      const tickets = await prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: { name: true, phoneNumber: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: { tickets }
      });
    } catch (error) {
      logger.error('Get support tickets error:', error);
      next(error);
    }
  }

  /**
   * Update support ticket status & write resolution
   */
  async updateTicketStatus(req, res, next) {
    try {
      const { ticketId } = req.params;
      const { status, resolution } = req.body;

      const ticket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status,
          ...(resolution && { description: resolution }),
          ...(status === 'RESOLVED' && { resolvedAt: new Date() })
        }
      });

      logger.info(`Support ticket ${ticketId} status updated to ${status}`);
      res.json({
        success: true,
        message: 'Ticket updated successfully',
        data: { ticket }
      });
    } catch (error) {
      logger.error('Update support ticket error:', error);
      next(error);
    }
  }

  /**
   * Interactive heatmap points (Ride coordinate mappings)
   */
  async getHeatmaps(req, res, next) {
    try {
      const rides = await prisma.ride.findMany({
        where: {
          status: { in: ['COMPLETED', 'STARTED', 'ACCEPTED', 'REQUESTED'] }
        },
        select: {
          pickupLocation: true,
          dropoffLocation: true,
          status: true
        }
      });

      const points = rides.map(ride => {
        let pickup = ride.pickupLocation;
        let dropoff = ride.dropoffLocation;

        if (typeof pickup === 'string') {
          try { pickup = JSON.parse(pickup); } catch (e) { pickup = {}; }
        }
        if (typeof dropoff === 'string') {
          try { dropoff = JSON.parse(dropoff); } catch (e) { dropoff = {}; }
        }

        return {
          pickup: { lat: pickup.lat || pickup.latitude, lng: pickup.lng || pickup.longitude, address: pickup.address },
          dropoff: { lat: dropoff.lat || dropoff.latitude, lng: dropoff.lng || dropoff.longitude, address: dropoff.address },
          status: ride.status
        };
      });

      res.json({
        success: true,
        data: { points }
      });
    } catch (error) {
      logger.error('Get heatmaps error:', error);
      next(error);
    }
  }

  /**
   * Aggregated City-wise revenue and analytics
   */
  async getCityAnalytics(req, res, next) {
    try {
      const rides = await prisma.ride.findMany({
        where: { status: 'COMPLETED' },
        select: { pickupLocation: true, finalFare: true }
      });

      const cityGroups = {};
      rides.forEach(ride => {
        let pickup = ride.pickupLocation;
        if (typeof pickup === 'string') {
          try { pickup = JSON.parse(pickup); } catch (e) { pickup = {}; }
        }
        const addr = pickup?.address || 'Other';
        let city = 'Delhi NCR';
        if (addr.toLowerCase().includes('noida')) city = 'Noida';
        else if (addr.toLowerCase().includes('gurugram') || addr.toLowerCase().includes('gurgaon')) city = 'Gurugram';
        else if (addr.toLowerCase().includes('saket') || addr.toLowerCase().includes('india gate') || addr.toLowerCase().includes('place') || addr.toLowerCase().includes('delhi')) city = 'Delhi';
        else if (addr.toLowerCase().includes('mumbai')) city = 'Mumbai';
        else if (addr.toLowerCase().includes('bengaluru') || addr.toLowerCase().includes('bangalore')) city = 'Bengaluru';

        if (!cityGroups[city]) {
          cityGroups[city] = { city, ridesCount: 0, revenue: 0 };
        }
        cityGroups[city].ridesCount += 1;
        cityGroups[city].revenue += parseFloat(ride.finalFare || 0);
      });

      const cityData = Object.values(cityGroups);

      res.json({
        success: true,
        data: { cities: cityData }
      });
    } catch (error) {
      logger.error('Get city analytics error:', error);
      next(error);
    }
  }

  /**
   * Coupon code management (CRUD stored in SystemConfig as JSON)
   */
  async getCoupons(req, res, next) {
    try {
      let config = await prisma.systemConfig.findUnique({
        where: { key: 'active_coupons' }
      });

      let coupons = [];
      if (config) {
        coupons = JSON.parse(config.value);
      }

      res.json({
        success: true,
        data: { coupons }
      });
    } catch (error) {
      logger.error('Get coupons error:', error);
      next(error);
    }
  }

  async createCoupon(req, res, next) {
    try {
      const { code, discountType, discountValue, maxDiscount, minRideAmount, expiryDate } = req.body;

      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ success: false, message: 'Code, type and value are required' });
      }

      let config = await prisma.systemConfig.findUnique({
        where: { key: 'active_coupons' }
      });

      let coupons = [];
      if (config) {
        coupons = JSON.parse(config.value);
      }

      if (coupons.some(c => c.code.toUpperCase() === code.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }

      const newCoupon = {
        id: Date.now().toString(),
        code: code.toUpperCase(),
        discountType,
        discountValue: parseFloat(discountValue),
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        minRideAmount: minRideAmount ? parseFloat(minRideAmount) : 0,
        expiryDate: expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        createdAt: new Date().toISOString()
      };

      coupons.push(newCoupon);

      if (config) {
        await prisma.systemConfig.update({
          where: { id: config.id },
          data: { value: JSON.stringify(coupons) }
        });
      } else {
        await prisma.systemConfig.create({
          data: {
            key: 'active_coupons',
            value: JSON.stringify(coupons),
            description: 'List of active promotional coupons'
          }
        });
      }

      logger.info(`Coupon created: ${code}`);
      res.status(201).json({
        success: true,
        message: 'Coupon created successfully',
        data: { coupon: newCoupon }
      });
    } catch (error) {
      logger.error('Create coupon error:', error);
      next(error);
    }
  }

  async deleteCoupon(req, res, next) {
    try {
      const { couponId } = req.params;

      const config = await prisma.systemConfig.findUnique({
        where: { key: 'active_coupons' }
      });

      if (!config) {
        return res.status(404).json({ success: false, message: 'No coupons found' });
      }

      let coupons = JSON.parse(config.value);
      const initialCount = coupons.length;
      coupons = coupons.filter(c => c.id !== couponId);

      if (coupons.length === initialCount) {
        return res.status(404).json({ success: false, message: 'Coupon not found' });
      }

      await prisma.systemConfig.update({
        where: { id: config.id },
        data: { value: JSON.stringify(coupons) }
      });

      logger.info(`Coupon deleted: ${couponId}`);
      res.json({
        success: true,
        message: 'Coupon deleted successfully'
      });
    } catch (error) {
      logger.error('Delete coupon error:', error);
      next(error);
    }
  }

  /**
   * Update user account status (ACTIVE, SUSPENDED, DELETED)
   */
  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['ACTIVE', 'SUSPENDED', 'DELETED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { status }
      });

      logger.info(`User ${userId} status updated to ${status}`);
      res.json({
        success: true,
        message: `User marked as ${status.toLowerCase()}`,
        data: { user }
      });
    } catch (error) {
      logger.error('Update user status error:', error);
      next(error);
    }
  }

  /**
   * Create (Pre-register) a new Rider
   */
  async createRider(req, res, next) {
    try {
      const { name, email, phoneNumber } = req.body;

      if (!phoneNumber || !name) {
        return res.status(400).json({ success: false, message: 'Name and phone number are required' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber }
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }

      const mockFirebaseUid = 'mock-pre-reg-' + Math.random().toString(36).substring(2, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email: email || null,
          phoneNumber,
          role: 'RIDER',
          status: 'ACTIVE',
          firebaseUid: mockFirebaseUid
        }
      });

      logger.info(`Administrative rider pre-registration successful: ${user.id}`);
      res.status(201).json({
        success: true,
        message: 'Rider pre-registered successfully!',
        data: { user }
      });
    } catch (error) {
      logger.error('Pre-register rider error:', error);
      next(error);
    }
  }

  /**
   * Create (Pre-register) a new Driver with automated KYC approval & Active Vehicle link
   */
  async createDriver(req, res, next) {
    try {
      const { name, email, phoneNumber, licenseNumber, vehicleType, vehiclePlate, vehicleModel } = req.body;

      if (!phoneNumber || !name) {
        return res.status(400).json({ success: false, message: 'Name and phone number are required' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber }
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }

      const mockFirebaseUid = 'mock-pre-reg-drv-' + Math.random().toString(36).substring(2, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email: email || null,
          phoneNumber,
          role: 'DRIVER',
          status: 'ACTIVE',
          firebaseUid: mockFirebaseUid,
          driver: {
            create: {
              licenseNumber: licenseNumber || 'MOCK-LIC-' + Math.floor(100000 + Math.random() * 900000),
              kycStatus: 'APPROVED',
              status: 'ONLINE',
              isAvailable: true,
              vehicles: {
                create: {
                  vehicleType: vehicleType || 'EV_2W',
                  registrationNumber: vehiclePlate || 'DL-' + Math.floor(10 + Math.random() * 90) + '-EV-' + Math.floor(1000 + Math.random() * 9000),
                  model: vehicleModel || 'Volzo EV Class A',
                  color: 'Blue',
                  isActive: true,
                  isVerified: true
                }
              }
            }
          }
        },
        include: {
          driver: {
            include: {
              vehicles: true
            }
          }
        }
      });

      logger.info(`Administrative driver pre-registration successful: ${user.id}`);
      res.status(201).json({
        success: true,
        message: 'Driver pre-registered successfully!',
        data: { user }
      });
    } catch (error) {
      logger.error('Pre-register driver error:', error);
      next(error);
    }
  }

  /**
   * Approve driver KYC
   */
  async approveKyc(req, res, next) {
    try {
      const { driverId } = req.params;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          kycStatus: 'APPROVED',
          kycRejectionReason: null,
          approvedAt: new Date()
        },
        include: { user: true }
      });

      // Emit socket event to driver
      const io = req.app.get('io');
      const { emitToUser } = require('../socket');
      emitToUser(io, driver.userId, 'kyc:approved', {
        message: 'Your KYC has been approved! You can now start accepting rides.',
        kycStatus: 'APPROVED'
      });

      logger.info(`KYC approved for driver: ${driverId}`);
      res.json({ success: true, message: 'Driver KYC approved', data: { driver: sanitizeDriver(driver) } });
    } catch (error) {
      logger.error('Approve KYC error:', error);
      next(error);
    }
  }

  /**
   * Reject driver KYC
   */
  async rejectKyc(req, res, next) {
    try {
      const { driverId } = req.params;
      const { reason } = req.body;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          kycStatus: 'REJECTED',
          kycRejectionReason: reason || 'Documents incomplete or invalid'
        },
        include: { user: true }
      });

      // Notify driver
      const io = req.app.get('io');
      const { emitToUser } = require('../socket');
      emitToUser(io, driver.userId, 'kyc:rejected', {
        message: `Your KYC was rejected: ${reason || 'Documents incomplete or invalid'}`,
        kycStatus: 'REJECTED',
        reason
      });

      logger.info(`KYC rejected for driver: ${driverId}`);
      res.json({ success: true, message: 'Driver KYC rejected', data: { driver: sanitizeDriver(driver) } });
    } catch (error) {
      logger.error('Reject KYC error:', error);
      next(error);
    }
  }

  /**
   * Get all payments with filters (admin)
   */
  async getPayments(req, res, next) {
    try {
      const { status, method, page = 1, pageSize = 20, startDate, endDate, flagged } = req.query;

      const where = {};
      if (status)  where.status  = status;
      if (method)  where.method  = method;
      if (flagged === 'true') where.isFlagged = true;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate)   where.createdAt.lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(pageSize);

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            ride: {
              include: {
                rider:  { select: { id: true, name: true, phoneNumber: true } },
                driver: { include: { user: { select: { id: true, name: true, phoneNumber: true } } } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(pageSize)
        }),
        prisma.payment.count({ where })
      ]);

      // Revenue summary
      const totalRevenue = await prisma.payment.aggregate({
        where: { status: { in: ['DRIVER_VERIFIED', 'PAID'] } },
        _sum: { amount: true }
      });

      res.json({
        success: true,
        data: {
          payments,
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize)),
          totalRevenue: totalRevenue._sum.amount || 0
        }
      });
    } catch (error) {
      logger.error('Admin get payments error:', error);
      next(error);
    }
  }

  /**
   * Refund payment (admin triggers via Razorpay)
   */
  async refundPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { amount, reason } = req.body;

      const PaymentService = require('../services/PaymentService');
      const result = await PaymentService.refundPayment(paymentId, amount, reason || 'Admin refund');

      logger.info(`Admin refunded payment ${paymentId}`);
      res.json({ success: true, message: 'Refund processed', data: result });
    } catch (error) {
      logger.error('Admin refund error:', error);
      next(error);
    }
  }
}

module.exports = new AdminController();
