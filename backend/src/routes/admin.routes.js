/**
 * Admin Routes
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/database');
const RideService = require('../services/RideService');
const PaymentService = require('../services/PaymentService');
const AdminController = require('../controllers/AdminController');

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * Dashboard statistics
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalRides,
      activeRides,
      totalUsers,
      totalDrivers,
      activeDrivers,
      todayRides,
      pendingPayments
    ] = await Promise.all([
      prisma.ride.count(),
      prisma.ride.count({
        where: {
          status: { in: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED'] }
        }
      }),
      prisma.user.count({ where: { role: 'RIDER' } }),
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
      prisma.ride.count({
        where: {
          createdAt: { gte: startOfDay }
        }
      }),
      prisma.payment.count({
        where: {
          status: { in: ['PENDING', 'RIDER_CONFIRMED'] }
        }
      })
    ]);

    // Calculate today's revenue
    const todayCompletedRides = await prisma.ride.findMany({
      where: {
        completedAt: { gte: startOfDay },
        status: 'PAYMENT_VERIFIED'
      },
      select: { finalFare: true }
    });

    const todayRevenue = todayCompletedRides.reduce((sum, ride) => 
      sum + parseFloat(ride.finalFare || 0), 0
    );

    res.json({
      success: true,
      data: {
        totalRides,
        activeRides,
        totalUsers,
        totalDrivers,
        activeDrivers,
        todayRides,
        todayRevenue,
        pendingPayments
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List all users
 */
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      role: 'RIDER',
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && { status })
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List all drivers
 */
router.get('/drivers', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, kycStatus, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(kycStatus && { kycStatus }),
      ...(status && { status })
    };

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
              profileImage: true
            }
          },
          vehicles: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.driver.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        drivers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Approve/Reject driver KYC
 */
router.patch(
  '/drivers/:driverId/kyc',
  [
    body('action').isIn(['APPROVE', 'REJECT']).withMessage('Invalid action'),
    body('reason').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { driverId } = req.params;
      const { action, reason } = req.body;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          kycStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          kycRejectionReason: action === 'REJECT' ? reason : null,
          approvedAt: action === 'APPROVE' ? new Date() : null
        }
      });

      res.json({
        success: true,
        message: `KYC ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
        data: { driver }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List all rides
 */
router.get('/rides', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        include: {
          rider: {
            select: {
              id: true,
              name: true,
              phoneNumber: true
            }
          },
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true
                }
              }
            }
          },
          vehicle: true,
          payment: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ride.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        rides,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get active rides
 */
router.get('/rides/active', async (req, res, next) => {
  try {
    const rides = await RideService.getActiveRides();

    res.json({
      success: true,
      data: { rides }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List payments
 */
router.get('/payments', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, flagged } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(flagged === 'true' && { isFlagged: true })
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          ride: {
            include: {
              rider: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true
                }
              },
              driver: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      phoneNumber: true
                    }
                  }
                }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get pending payments
 */
router.get('/payments/pending', async (req, res, next) => {
  try {
    const payments = await PaymentService.getPendingPayments();

    res.json({
      success: true,
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get flagged payments
 */
router.get('/payments/flagged', async (req, res, next) => {
  try {
    const payments = await PaymentService.getFlaggedPayments();

    res.json({
      success: true,
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Analytics data
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;

    const now = new Date();
    let startDate;

    if (period === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (period === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'PAYMENT_VERIFIED'
      },
      select: {
        finalFare: true,
        createdAt: true,
        rideType: true,
        pickupLocation: true
      }
    });

    // Group by date
    const revenueByDate = {};
    const ridesByDate = {};

    rides.forEach(ride => {
      const date = ride.createdAt.toISOString().split('T')[0];
      revenueByDate[date] = (revenueByDate[date] || 0) + parseFloat(ride.finalFare || 0);
      ridesByDate[date] = (ridesByDate[date] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        revenue: Object.entries(revenueByDate).map(([date, amount]) => ({ date, amount })),
        rides: Object.entries(ridesByDate).map(([date, count]) => ({ date, count })),
        totalRevenue: rides.reduce((sum, ride) => sum + parseFloat(ride.finalFare || 0), 0),
        totalRides: rides.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Detailed driver dossiers link (KYC, Vehicles, Earnings, Rides, Reviews)
 */
router.get('/drivers/:driverId', AdminController.getDriverDetails);

/**
 * Manually verify a driver's vehicle listing
 */
router.patch('/vehicles/:vehicleId/verify', AdminController.verifyVehicle);

/**
 * Support ticket lists & updates
 */
router.get('/tickets', AdminController.getSupportTickets);
router.patch('/tickets/:ticketId/status', AdminController.updateTicketStatus);

/**
 * Coordinate Heatmaps & aggregated City Analytics
 */
router.get('/heatmaps', AdminController.getHeatmaps);
router.get('/city-analytics', AdminController.getCityAnalytics);

/**
 * Promotional Coupon Management CRUD
 */
router.get('/coupons', AdminController.getCoupons);
router.post('/coupons', AdminController.createCoupon);
router.delete('/coupons/:couponId', AdminController.deleteCoupon);

/**
 * Update user status suspended/deleted
 */
router.patch('/users/:userId/status', AdminController.updateUserStatus);

/**
 * Pre-register riders and drivers
 */
router.post('/users', AdminController.createRider);
router.post('/drivers', AdminController.createDriver);

// ─────────────────────────────────────────────
// KYC MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Approve driver KYC
 */
router.post('/kyc/:driverId/approve', AdminController.approveKyc);

/**
 * Reject driver KYC (with reason)
 */
router.post(
  '/kyc/:driverId/reject',
  [body('reason').optional().trim()],
  validate,
  AdminController.rejectKyc
);

// ─────────────────────────────────────────────
// PAYMENTS MANAGEMENT (full CRUD + filters)
// ─────────────────────────────────────────────

/**
 * Get all payments with filters
 * Query: status, method, flagged, page, pageSize, startDate, endDate
 */
router.get('/payments', AdminController.getPayments);

/**
 * Initiate refund for a payment
 */
router.post(
  '/payments/:paymentId/refund',
  [
    body('amount').optional().isNumeric(),
    body('reason').optional().trim()
  ],
  validate,
  AdminController.refundPayment
);

module.exports = router;
