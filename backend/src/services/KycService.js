/**
 * KYC Verification Service
 *
 * Integrates with Surepass API for:
 * - Aadhaar (OTP-less) verification
 * - PAN verification
 * - Driving License (DL) verification
 *
 * To switch KYC provider, only update the API calls below.
 * The rest of the system uses the normalized response format.
 *
 * ENV vars required:
 *   KYC_API_KEY       - Surepass API token
 *   KYC_API_BASE_URL  - https://kyc-api.surepass.io/api/v1 (default)
 */

const axios = require('axios');
const prisma = require('../config/database');
const { logger } = require('../utils/logger');

const KYC_BASE_URL = process.env.KYC_API_BASE_URL || 'https://kyc-api.surepass.io/api/v1';
const KYC_API_KEY  = process.env.KYC_API_KEY || '';

// Check if KYC API is configured
const isKycConfigured = () => KYC_API_KEY && KYC_API_KEY !== '' && KYC_API_KEY !== 'YOUR_KYC_API_KEY_HERE';

/**
 * Normalize API response into a standard shape
 */
function normalizeKycResponse(data, docType) {
  return {
    success:      data?.success ?? data?.status === 'success' ?? false,
    docType,
    name:         data?.data?.full_name || data?.data?.name || null,
    dob:          data?.data?.dob || data?.data?.date_of_birth || null,
    gender:       data?.data?.gender || null,
    fatherName:   data?.data?.father_name || null,
    address:      data?.data?.address || null,
    status:       data?.data?.status || data?.message || null,
    raw:          data
  };
}

class KycService {
  /**
   * Verify Aadhaar number via Surepass
   * Returns verified name, dob, gender, address
   */
  async verifyAadhaar(driverId, aadhaarNumber) {
    try {
      if (!isKycConfigured()) {
        logger.warn('KYC API not configured — running in MOCK mode');
        return this._mockVerify(driverId, aadhaarNumber, 'AADHAAR');
      }

      const { data } = await axios.post(
        `${KYC_BASE_URL}/aadhaar-validation/aadhaar-validation`,
        { id_number: aadhaarNumber },
        {
          headers: {
            Authorization: `Bearer ${KYC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const result = normalizeKycResponse(data, 'AADHAAR');

      if (result.success) {
        await prisma.driver.update({
          where: { id: driverId },
          data: {
            aadhaarVerified:   true,
            aadhaarVerifiedAt: new Date(),
            kycApiResponse:    JSON.stringify({ ...JSON.parse((await prisma.driver.findUnique({ where: { id: driverId }, select: { kycApiResponse: true } }))?.kycApiResponse || '{}'), aadhaar: result })
          }
        });
      }

      logger.info(`Aadhaar verification ${result.success ? 'PASSED' : 'FAILED'} for driver ${driverId}`);
      return result;
    } catch (error) {
      logger.error('Aadhaar verification error:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        return this._mockVerify(driverId, aadhaarNumber, 'AADHAAR');
      }
      throw new Error('Aadhaar verification failed: ' + error.message);
    }
  }

  /**
   * Verify PAN number via Surepass
   */
  async verifyPan(driverId, panNumber) {
    try {
      if (!isKycConfigured()) {
        logger.warn('KYC API not configured — running in MOCK mode');
        return this._mockVerify(driverId, panNumber, 'PAN');
      }

      const { data } = await axios.post(
        `${KYC_BASE_URL}/pan/pan`,
        { id_number: panNumber },
        {
          headers: {
            Authorization: `Bearer ${KYC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const result = normalizeKycResponse(data, 'PAN');

      if (result.success) {
        await prisma.driver.update({
          where: { id: driverId },
          data: {
            panVerified:   true,
            panVerifiedAt: new Date()
          }
        });
      }

      logger.info(`PAN verification ${result.success ? 'PASSED' : 'FAILED'} for driver ${driverId}`);
      return result;
    } catch (error) {
      logger.error('PAN verification error:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        return this._mockVerify(driverId, panNumber, 'PAN');
      }
      throw new Error('PAN verification failed: ' + error.message);
    }
  }

  /**
   * Verify Driving License via Surepass
   */
  async verifyDrivingLicense(driverId, dlNumber, dob) {
    try {
      if (!isKycConfigured()) {
        logger.warn('KYC API not configured — running in MOCK mode');
        return this._mockVerify(driverId, dlNumber, 'DL');
      }

      const { data } = await axios.post(
        `${KYC_BASE_URL}/driving-license/driving-license`,
        {
          id_number: dlNumber,
          dob: dob // Format: YYYY-MM-DD
        },
        {
          headers: {
            Authorization: `Bearer ${KYC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const result = normalizeKycResponse(data, 'DL');

      if (result.success) {
        await prisma.driver.update({
          where: { id: driverId },
          data: {
            dlVerified:   true,
            dlVerifiedAt: new Date()
          }
        });
      }

      logger.info(`DL verification ${result.success ? 'PASSED' : 'FAILED'} for driver ${driverId}`);
      return result;
    } catch (error) {
      logger.error('DL verification error:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        return this._mockVerify(driverId, dlNumber, 'DL');
      }
      throw new Error('DL verification failed: ' + error.message);
    }
  }

  /**
   * Get KYC status for a driver
   */
  async getKycStatus(driverId) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        kycStatus:         true,
        aadhaarVerified:   true,
        aadhaarVerifiedAt: true,
        panVerified:       true,
        panVerifiedAt:     true,
        dlVerified:        true,
        dlVerifiedAt:      true,
        kycRejectionReason: true,
        approvedAt:        true
      }
    });

    if (!driver) throw new Error('Driver not found');

    return {
      overall: driver.kycStatus,
      rejectionReason: driver.kycRejectionReason,
      approvedAt: driver.approvedAt,
      documents: {
        aadhaar: {
          verified:   driver.aadhaarVerified,
          verifiedAt: driver.aadhaarVerifiedAt
        },
        pan: {
          verified:   driver.panVerified,
          verifiedAt: driver.panVerifiedAt
        },
        dl: {
          verified:   driver.dlVerified,
          verifiedAt: driver.dlVerifiedAt
        }
      }
    };
  }

  /**
   * Mock verification for development (when KYC API key not provided)
   */
  async _mockVerify(driverId, docNumber, docType) {
    logger.info(`[MOCK KYC] Verifying ${docType}: ${docNumber} for driver ${driverId}`);

    const updateData = {};
    if (docType === 'AADHAAR') {
      updateData.aadhaarVerified   = true;
      updateData.aadhaarVerifiedAt = new Date();
    } else if (docType === 'PAN') {
      updateData.panVerified   = true;
      updateData.panVerifiedAt = new Date();
    } else if (docType === 'DL') {
      updateData.dlVerified   = true;
      updateData.dlVerifiedAt = new Date();
    }

    if (driverId) {
      await prisma.driver.update({ where: { id: driverId }, data: updateData });
    }

    return {
      success:    true,
      docType,
      name:       'MOCK VERIFIED NAME',
      dob:        '1990-01-01',
      gender:     'M',
      fatherName: 'MOCK FATHER NAME',
      address:    'MOCK ADDRESS, INDIA',
      status:     'VALID (Mock)',
      isMock:     true
    };
  }
}

module.exports = new KycService();
