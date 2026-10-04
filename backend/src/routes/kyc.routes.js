/**
 * KYC Verification Routes
 *
 * POST /kyc/verify-aadhaar  - Verify Aadhaar number
 * POST /kyc/verify-pan      - Verify PAN number
 * POST /kyc/verify-dl       - Verify Driving License
 * GET  /kyc/status          - Get KYC status for current driver
 */

const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorizeDriver } = require('../middleware/auth');
const KycService = require('../services/KycService');
const { logger }  = require('../utils/logger');
const prisma      = require('../config/database');

// All KYC routes require authentication
router.use(authenticate);

/**
 * GET /kyc/status
 * Returns KYC status for the current driver (or by driverId for admin)
 */
router.get('/status', async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found. Please register as a driver first.' });
    }
    const status = await KycService.getKycStatus(driver.id);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /kyc/verify-aadhaar
 * Body: { aadhaarNumber: "123412341234" }
 */
router.post(
  '/verify-aadhaar',
  [
    body('aadhaarNumber')
      .trim()
      .matches(/^\d{12}$/)
      .withMessage('Aadhaar must be a 12-digit number')
  ],
  validate,
  async (req, res, next) => {
    try {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver profile not found' });
      }

      const result = await KycService.verifyAadhaar(driver.id, req.body.aadhaarNumber);

      res.json({
        success: result.success,
        message: result.success ? 'Aadhaar verified successfully' : 'Aadhaar verification failed',
        data: {
          verified:   result.success,
          name:       result.name,
          dob:        result.dob,
          gender:     result.gender,
          isMock:     result.isMock || false
        }
      });
    } catch (error) {
      logger.error('Aadhaar verification route error:', error);
      next(error);
    }
  }
);

/**
 * POST /kyc/verify-pan
 * Body: { panNumber: "ABCDE1234F" }
 */
router.post(
  '/verify-pan',
  [
    body('panNumber')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
      .withMessage('Invalid PAN format (e.g., ABCDE1234F)')
  ],
  validate,
  async (req, res, next) => {
    try {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver profile not found' });
      }

      const result = await KycService.verifyPan(driver.id, req.body.panNumber);

      res.json({
        success: result.success,
        message: result.success ? 'PAN verified successfully' : 'PAN verification failed',
        data: {
          verified:   result.success,
          name:       result.name,
          dob:        result.dob,
          fatherName: result.fatherName,
          isMock:     result.isMock || false
        }
      });
    } catch (error) {
      logger.error('PAN verification route error:', error);
      next(error);
    }
  }
);

/**
 * POST /kyc/verify-dl
 * Body: { dlNumber: "DL1420230099999", dob: "1990-01-15" }
 */
router.post(
  '/verify-dl',
  [
    body('dlNumber').trim().notEmpty().withMessage('Driving license number is required'),
    body('dob').optional().isDate().withMessage('Date of birth must be in YYYY-MM-DD format')
  ],
  validate,
  async (req, res, next) => {
    try {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver profile not found' });
      }

      const result = await KycService.verifyDrivingLicense(driver.id, req.body.dlNumber, req.body.dob);

      res.json({
        success: result.success,
        message: result.success ? 'Driving license verified successfully' : 'DL verification failed',
        data: {
          verified:   result.success,
          name:       result.name,
          dob:        result.dob,
          address:    result.address,
          status:     result.status,
          isMock:     result.isMock || false
        }
      });
    } catch (error) {
      logger.error('DL verification route error:', error);
      next(error);
    }
  }
);

module.exports = router;
