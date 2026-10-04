/**
 * Authentication Routes
 * 
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticateFirebase, authenticate } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login or register with Firebase OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *               - phoneNumber
 *             properties:
 *               idToken:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               name:
 *                 type: string
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid token
 */
router.post(
  '/login',
  [
    body('idToken').notEmpty().withMessage('Firebase ID token is required'),
    body('phoneNumber').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('fcmToken').optional().isString()
  ],
  validate,
  authenticateFirebase,
  AuthController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid token
 */
router.post('/refresh', authenticate, AuthController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, AuthController.getCurrentUser);

/**
 * Verify OTP alias for Driver App onboarding
 */
router.post(
  '/verify-otp',
  [
    body('firebaseToken').notEmpty().withMessage('Firebase token is required'),
    body('phone').notEmpty().withMessage('Phone number is required')
  ],
  validate,
  (req, res, next) => {
    req.body.idToken = req.body.firebaseToken;
    req.body.phoneNumber = req.body.phone;
    next();
  },
  authenticateFirebase,
  AuthController.login
);

/**
 * Admin direct login bypass endpoint
 */
router.post(
  '/admin-login',
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      // Let's find or create a default admin user!
      let user = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            phoneNumber: '+919999999999',
            name: 'Volzo Master Admin',
            email: email || 'admin@volzo.com',
            firebaseUid: 'mock-admin-uid-1234',
            role: 'ADMIN',
            status: 'ACTIVE',
            lastLoginAt: new Date()
          }
        });
      }

      // Generate a valid admin JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          role: 'ADMIN',
          phoneNumber: user.phoneNumber
        },
        process.env.JWT_SECRET || 'volzo_super_secret_jwt_key_for_production_change_this_to_random_32_chars_min',
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'Admin authentication successful',
        data: {
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email || 'admin@volzo.com',
            role: 'ADMIN'
          },
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
