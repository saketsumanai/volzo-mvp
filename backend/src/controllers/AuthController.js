/**
 * Authentication Controller
 */

const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { logger } = require('../utils/logger');
const { initializeFirebase } = require('../config/firebase');

// Initialize Firebase
initializeFirebase();

class AuthController {
  /**
   * Login or Register with Firebase OTP
   */
  async login(req, res, next) {
    try {
      const { phoneNumber, name, fcmToken } = req.body;
      const firebaseUser = req.firebaseUser;

      // Check if this is the Developer Driver Bypass phone number or starts with mock_driver
      const isDriverBypass = phoneNumber === '+919876543210' || (firebaseUser && firebaseUser.uid && firebaseUser.uid.startsWith('mock_driver'));

      if (isDriverBypass) {
        logger.info(`🔑 Developer Driver Bypass login initiated for ${phoneNumber}`);
        
        // 1. Find or create the user as DRIVER
        let bypassUser = await prisma.user.findUnique({
          where: { phoneNumber }
        });

        if (!bypassUser) {
          bypassUser = await prisma.user.create({
            data: {
              phoneNumber,
              name: name || 'Saket Driver',
              firebaseUid: firebaseUser?.uid || 'mock_driver_uid_123',
              fcmToken: fcmToken || null,
              role: 'DRIVER',
              status: 'ACTIVE',
              lastLoginAt: new Date()
            }
          });
        } else {
          bypassUser = await prisma.user.update({
            where: { id: bypassUser.id },
            data: {
              role: 'DRIVER',
              status: 'ACTIVE',
              lastLoginAt: new Date(),
              fcmToken: fcmToken || bypassUser.fcmToken
            }
          });
        }

        // 2. Find or create the Driver profile and set KYC APPROVED
        let driver = await prisma.driver.findUnique({
          where: { userId: bypassUser.id }
        });

        if (!driver) {
          driver = await prisma.driver.create({
            data: {
              userId: bypassUser.id,
              licenseNumber: 'DL1420230099999',
              kycStatus: 'APPROVED',
              status: 'ONLINE',
              isAvailable: true
            }
          });
        } else {
          driver = await prisma.driver.update({
            where: { id: driver.id },
            data: {
              kycStatus: 'APPROVED',
              status: 'ONLINE',
              isAvailable: true
            }
          });
        }

        // 3. Find or create a Vehicle for the driver
        let vehicle = await prisma.vehicle.findFirst({
          where: { driverId: driver.id }
        });

        if (!vehicle) {
          vehicle = await prisma.vehicle.create({
            data: {
              driverId: driver.id,
              vehicleType: 'EV_SCOOTER',
              registrationNumber: 'DL-3C-AB-1234',
              model: 'Volzo Electric S1',
              color: 'Black',
              year: new Date().getFullYear(),
              totalSeats: 1,
              isActive: true,
              isVerified: true
            }
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: bypassUser.id,
            role: 'DRIVER',
            phoneNumber: bypassUser.phoneNumber
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
          { userId: bypassUser.id },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
        );

        return res.json({
          success: true,
          message: 'Developer bypass login successful',
          data: {
            user: {
              id: bypassUser.id,
              phoneNumber: bypassUser.phoneNumber,
              name: bypassUser.name,
              email: bypassUser.email || 'testdriver@volzo.com',
              role: 'DRIVER',
              profileImage: bypassUser.profileImage,
              driver: {
                id: driver.id,
                status: driver.status,
                kycStatus: driver.kycStatus,
                rating: driver.rating,
                totalRides: driver.totalRides,
                vehicle: vehicle
              }
            },
            driver: {
              id: driver.id,
              status: driver.status,
              kycStatus: driver.kycStatus,
              rating: driver.rating,
              totalRides: driver.totalRides,
              vehicle: vehicle
            },
            token,
            refreshToken
          }
        });
      }

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { phoneNumber },
        include: {
          driver: {
            select: {
              id: true,
              status: true,
              kycStatus: true,
              rating: true,
              totalRides: true
            }
          }
        }
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            phoneNumber,
            name: name || null,
            firebaseUid: firebaseUser.uid,
            fcmToken: fcmToken || null,
            role: 'RIDER',
            status: 'ACTIVE',
            lastLoginAt: new Date()
          }
        });

        logger.info(`New user registered: ${user.id}`);
      } else {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: firebaseUser.uid,
            fcmToken: fcmToken || user.fcmToken,
            lastLoginAt: new Date()
          },
          include: {
            driver: {
              select: {
                id: true,
                status: true,
                kycStatus: true,
                rating: true,
                totalRides: true
              }
            }
          }
        });

        logger.info(`User logged in: ${user.id}`);
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          phoneNumber: user.phoneNumber
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
      );

      res.json({
        success: true,
        message: user.createdAt === user.updatedAt ? 'Registration successful' : 'Login successful',
        data: {
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            driver: user.driver
          },
          driver: user.driver, // Root-level driver field for seamless mobile-app parsing compatibility
          token,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(req, res, next) {
    try {
      const user = req.user;

      // Generate new token
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          phoneNumber: user.phoneNumber
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        success: true,
        data: { token }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      next(error);
    }
  }

  /**
   * Logout
   */
  async logout(req, res, next) {
    try {
      const userId = req.user.id;

      // Clear FCM token
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: null }
      });

      // If driver, set offline
      if (req.user.driver) {
        await prisma.driver.update({
          where: { userId },
          data: {
            status: 'OFFLINE',
            isAvailable: false
          }
        });
      }

      logger.info(`User logged out: ${userId}`);

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(req, res, next) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          driver: {
            include: {
              vehicles: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();
