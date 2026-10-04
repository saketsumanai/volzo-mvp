/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/database');
const multer = require('multer');
const path = require('path');

// Configure multer for profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  }
});

// All routes require authentication
router.use(authenticate);

/**
 * Get user profile
 */
router.get('/profile', async (req, res, next) => {
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
    next(error);
  }
});

/**
 * Update user profile
 */
router.patch(
  '/profile',
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').optional().isEmail().withMessage('Valid email required')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email } = req.body;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name && { name }),
          ...(email && { email })
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload profile image
 */
router.post(
  '/profile/image',
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided'
        });
      }

      const profileImage = `/uploads/profiles/${req.file.filename}`;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { profileImage }
      });

      res.json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: { profileImage: user.profileImage }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update FCM token
 */
router.patch(
  '/fcm-token',
  [
    body('fcmToken').notEmpty().withMessage('FCM token required')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { fcmToken } = req.body;

      await prisma.user.update({
        where: { id: req.user.id },
        data: { fcmToken }
      });

      res.json({
        success: true,
        message: 'FCM token updated'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create a new support ticket
 */
router.post(
  '/tickets',
  [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { subject, description, priority = 'MEDIUM', rideId } = req.body;
      
      // Generate a unique ticket number like TKT-XXXXXXXX
      const ticketNumber = 'TKT-' + Math.floor(100000 + Math.random() * 900000);

      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          userId: req.user.id,
          subject,
          description,
          priority,
          rideId
        }
      });

      res.status(201).json({
        success: true,
        message: 'Support ticket created successfully',
        data: { ticket }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's support tickets
 */
router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { tickets }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Soft-delete account
 */
router.delete('/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          fcmToken: null
        }
      });

      const driver = await tx.driver.findUnique({
        where: { userId }
      });

      if (driver) {
        await tx.driver.update({
          where: { id: driver.id },
          data: {
            status: 'OFFLINE',
            isAvailable: false
          }
        });
      }
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get nearby online available drivers
 * Merges DB records with live in-memory socket locations so drivers
 * appear instantly after toggling online (before DB write completes).
 */
router.get('/nearby-drivers', async (req, res, next) => {
  try {
    // Grab live socket positions - these are always the freshest
    const { driverLocations } = require('../socket');

    // Fetch all ONLINE+available drivers from DB (no location filter)
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        isAvailable: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true
          }
        },
        vehicles: {
          where: { isActive: true }
        }
      }
    });

    // Overlay live socket positions on top of stale DB locations
    const enrichedDrivers = drivers.map(driver => {
      const liveLocation = driverLocations.get(driver.userId);
      if (liveLocation) {
        return {
          ...driver,
          currentLocation: {
            latitude: liveLocation.lat,
            longitude: liveLocation.lng,
            heading: liveLocation.heading || 0
          }
        };
      }
      return driver;
    }).filter(d => d.currentLocation != null); // Only show drivers with any known location

    res.json({
      success: true,
      data: { drivers: enrichedDrivers }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/profile-image
 * Upload user profile picture
 */
router.post('/profile-image', (req, res, next) => {
  upload.single('profileImage')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

    try {
      const url = `/uploads/profiles/${req.file.filename}`;
      await prisma.user.update({
        where: { id: req.user.id },
        data:  { profileImage: url }
      });
      res.json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  });
});

/**
 * PATCH /users/profile
 * Update user profile (name, email)
 */
router.patch(
  '/profile',
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').optional().isEmail().withMessage('Invalid email'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email } = req.body;
      const data = {};
      if (name)  data.name  = name;
      if (email) data.email = email;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data,
        select: { id: true, name: true, email: true, phoneNumber: true, profileImage: true }
      });

      res.json({ success: true, message: 'Profile updated', data: { user } });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

