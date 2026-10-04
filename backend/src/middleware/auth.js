/**
 * Authentication Middleware
 * JWT-based authentication with Firebase integration
 */

const jwt = require('jsonwebtoken');
const { verifyIdToken } = require('../config/firebase');
const prisma = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        role: true,
        status: true,
        driver: {
          select: {
            id: true,
            status: true,
            kycStatus: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or deleted'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Verify Firebase ID token (for initial login)
 */
const authenticateFirebase = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token required'
      });
    }

    const decodedToken = await verifyIdToken(idToken);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    logger.error('Firebase authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid Firebase token'
    });
  }
};

/**
 * Role-based authorization
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Driver-specific authorization
 */
const authorizeDriver = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'DRIVER') {
      return res.status(403).json({
        success: false,
        message: 'Driver access required'
      });
    }

    if (!req.user.driver) {
      return res.status(403).json({
        success: false,
        message: 'Driver profile not found'
      });
    }

    // MVP/dev: allow drivers with pending KYC so ride actions are not blocked during testing.
    if (req.user.driver.kycStatus !== 'APPROVED') {
      if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_DRIVER_KYC === 'true') {
        return res.status(403).json({
          success: false,
          message: 'KYC verification pending or rejected'
        });
      }
      logger.warn(`Driver ${req.user.driver.id} allowed with kycStatus=${req.user.driver.kycStatus}`);
    }

    next();
  } catch (error) {
    logger.error('Driver authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization failed'
    });
  }
};

module.exports = {
  authenticate,
  authenticateFirebase,
  authorize,
  authorizeDriver
};
