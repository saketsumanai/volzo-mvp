/**
 * Driver Controller
 * Handles driver-specific operations
 */

const prisma = require('../config/database');
const { logger } = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure upload folder exists
    if (!fs.existsSync('uploads/kyc/')) {
      fs.mkdirSync('uploads/kyc/', { recursive: true });
    }
    cb(null, 'uploads/kyc/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed'));
  }
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed'));
  }
}).single('document');

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

class DriverController {
  /**
   * Register as driver
   */
  async registerDriver(req, res, next) {
    try {
      const userId = req.user.id;
      const { licenseNumber, aadharNumber, panNumber } = req.body;

      // Check if already a driver
      const existingDriver = await prisma.driver.findUnique({
        where: { userId }
      });

      if (existingDriver) {
        return res.status(400).json({
          success: false,
          message: 'User is already registered as a driver'
        });
      }

      // Create driver profile
      const driver = await prisma.driver.create({
        data: {
          userId,
          licenseNumber,
          aadharNumber,
          panNumber,
          kycStatus: 'PENDING'
        }
      });

      // Update user role
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'DRIVER' }
      });

      logger.info(`Driver registered: ${driver.id}`);

      res.status(201).json({
        success: true,
        message: 'Driver registration successful. Please upload KYC documents.',
        data: { driver: sanitizeDriver(driver) }
      });
    } catch (error) {
      logger.error('Register driver error:', error);
      next(error);
    }
  }

  /**
   * Upload individual document for KYC
   */
  uploadDocument = [
    (req, res, next) => {
      documentUpload(req, res, (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        next();
      });
    },
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No file provided' });
        }
        
        const url = `/uploads/kyc/${req.file.filename}`;
        
        logger.info(`File uploaded successfully: ${url}`);
        res.json({
          success: true,
          message: 'Document uploaded successfully',
          data: { url }
        });
      } catch (error) {
        logger.error('Upload document error:', error);
        next(error);
      }
    }
  ];

  /**
   * Update driver profile details & docs (Step 2 of KYC)
   */
  async patchProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, email, licenseNumber, aadharNumber, panNumber, profileImage, documents } = req.body;

      // Update basic user profile
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(profileImage && { profileImage }),
          role: 'DRIVER'
        }
      });

      // Find or create driver profile
      let driver = await prisma.driver.findUnique({
        where: { userId }
      });

      const licenseImage = documents?.license || null;
      const aadharImage = documents?.aadhar || documents?.rc || null; // supports new Aadhar and legacy RC mapping
      const panImage = documents?.pan || documents?.vehicle || null;  // supports new PAN and legacy Vehicle mapping

      if (driver) {
        driver = await prisma.driver.update({
          where: { id: driver.id },
          data: {
            ...(licenseNumber && { licenseNumber }),
            ...(licenseImage && { licenseImage }),
            ...(aadharNumber && { aadharNumber }),
            ...(aadharImage && { aadharImage }),
            ...(panNumber && { panNumber }),
            ...(panImage && { panImage }),
            kycStatus: 'PENDING'
          }
        });
      } else {
        driver = await prisma.driver.create({
          data: {
            userId,
            licenseNumber: licenseNumber || null,
            licenseImage,
            aadharNumber: aadharNumber || null,
            aadharImage,
            panNumber: panNumber || null,
            panImage,
            kycStatus: 'PENDING'
          }
        });
      }

      logger.info(`Driver profile updated/created for user: ${userId}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          driver: sanitizeDriver(driver)
        }
      });
    } catch (error) {
      logger.error('Patch profile error:', error);
      next(error);
    }
  }

  /**
   * Upload KYC documents (bulk legacy)
   */
  uploadKYC = [
    upload.fields([
      { name: 'licenseImage', maxCount: 1 },
      { name: 'aadharImage', maxCount: 1 },
      { name: 'panImage', maxCount: 1 },
      { name: 'rcImage', maxCount: 1 },
      { name: 'insuranceImage', maxCount: 1 }
    ]),
    async (req, res, next) => {
      try {
        const driverId = req.user.driver.id;
        const files = req.files;

        const updateData = {};
        if (files.licenseImage) updateData.licenseImage = files.licenseImage[0].path;
        if (files.aadharImage) updateData.aadharImage = files.aadharImage[0].path;
        if (files.panImage) updateData.panImage = files.panImage[0].path;

        const driver = await prisma.driver.update({
          where: { id: driverId },
          data: updateData
        });

        logger.info(`KYC documents uploaded for driver: ${driverId}`);

        res.json({
          success: true,
          message: 'KYC documents uploaded successfully. Awaiting verification.',
          data: { driver }
        });
      } catch (error) {
        logger.error('Upload KYC error:', error);
        next(error);
      }
    }
  ];

  /**
   * Add vehicle (Step 3 of KYC & General Management)
   */
  async addVehicle(req, res, next) {
    try {
      const driverId = req.user.driver.id;
      const { type, vehicleType, registrationNumber, model, color, year, totalSeats, vehicleImage, rcImage } = req.body;

      // Handle mobile type parameter mapping
      let finalType = vehicleType;
      if (type) {
        if (type.toLowerCase() === 'scooter') finalType = 'EV_SCOOTER';
        else if (type.toLowerCase() === 'rickshaw') finalType = 'E_RICKSHAW';
      }

      if (!finalType) {
        throw new Error('Vehicle type is required');
      }

      // Check if driver has temp images uploaded
      const driver = await prisma.driver.findUnique({
        where: { id: driverId }
      });

      // Retrieve temp RC and Vehicle images (supports direct overrides and legacy driver storage mappings)
      const finalRc = rcImage || driver?.aadharImage || null;
      const finalVehicle = vehicleImage || driver?.panImage || null;

      const vehicle = await prisma.vehicle.create({
        data: {
          driverId,
          vehicleType: finalType,
          registrationNumber,
          model,
          color: color || 'Black',
          year: year ? parseInt(year) : new Date().getFullYear(),
          totalSeats: totalSeats ? parseInt(totalSeats) : (finalType === 'E_RICKSHAW' ? 4 : 1),
          rcImage: finalRc,
          insuranceImage: finalVehicle,
          isActive: true,
          isVerified: false
        }
      });

      logger.info(`Vehicle added: ${vehicle.id} for driver ${driverId}`);

      res.status(201).json({
        success: true,
        message: 'Vehicle added successfully',
        data: { vehicle }
      });
    } catch (error) {
      logger.error('Add vehicle error:', error);
      next(error);
    }
  }

  /**
   * Update driver status (online/offline)
   */
  async updateStatus(req, res, next) {
    try {
      const driverId = req.user.driver.id;
      const { status, isAvailable } = req.body;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          status,
          isAvailable: isAvailable !== undefined ? isAvailable : (status === 'ONLINE')
        }
      });

      // Emit socket event
      const io = req.app.get('io');
      const { emitToAdmin } = require('../socket');
      
      emitToAdmin(io, 'driver:status:changed', {
        driverId: driver.id,
        status: driver.status
      });

      logger.info(`Driver ${driverId} status updated to ${status}`);

      res.json({
        success: true,
        message: `Status updated to ${status}`,
        data: { driver }
      });
    } catch (error) {
      logger.error('Update driver status error:', error);
      next(error);
    }
  }

  /**
   * Update driver location
   */
  async updateLocation(req, res, next) {
    try {
      const driverId = req.user.driver.id;
      const { lat, lng, heading } = req.body;

      const currentLocation = {
        lat,
        lng,
        heading,
        timestamp: new Date().toISOString()
      };

      await prisma.driver.update({
        where: { id: driverId },
        data: { currentLocation: JSON.stringify(currentLocation) }
      });

      // Socket.IO will handle real-time broadcasting
      // No need to emit here as it's handled in socket/index.js

      res.json({
        success: true,
        message: 'Location updated'
      });
    } catch (error) {
      logger.error('Update location error:', error);
      next(error);
    }
  }

  /**
   * Get driver earnings
   */
  async getEarnings(req, res, next) {
    try {
      const driverId = req.user.driver.id;
      const { period = 'all' } = req.query;

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          totalEarnings: true,
          pendingEarnings: true,
          totalRides: true,
          rating: true
        }
      });

      // Calculate period-specific earnings
      let periodFilter = {};
      const now = new Date();

      if (period === 'today') {
        periodFilter = {
          completedAt: {
            gte: new Date(now.setHours(0, 0, 0, 0))
          }
        };
      } else if (period === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        periodFilter = {
          completedAt: { gte: weekAgo }
        };
      } else if (period === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        periodFilter = {
          completedAt: { gte: monthAgo }
        };
      }

      const periodRides = await prisma.ride.findMany({
        where: {
          driverId,
          status: 'PAYMENT_VERIFIED',
          ...periodFilter
        },
        select: {
          finalFare: true,
          completedAt: true
        }
      });

      const periodEarnings = periodRides.reduce((sum, ride) => {
        const driverShare = ride.finalFare * (1 - (process.env.DRIVER_COMMISSION_PERCENT || 20) / 100);
        return sum + parseFloat(driverShare);
      }, 0);

      res.json({
        success: true,
        data: {
          totalEarnings: parseFloat(driver.totalEarnings),
          pendingEarnings: parseFloat(driver.pendingEarnings),
          periodEarnings,
          totalRides: driver.totalRides,
          periodRides: periodRides.length,
          rating: parseFloat(driver.rating),
          period
        }
      });
    } catch (error) {
      logger.error('Get earnings error:', error);
      next(error);
    }
  }

  /**
   * Get driver profile
   */
  async getProfile(req, res, next) {
    try {
      const driverId = req.user.driver.id;

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
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
          vehicles: {
            where: { isActive: true }
          }
        }
      });

      res.json({
        success: true,
        data: { driver: sanitizeDriver(driver) }
      });
    } catch (error) {
      logger.error('Get driver profile error:', error);
      next(error);
    }
  }
}

module.exports = new DriverController();
