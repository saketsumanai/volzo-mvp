/**
 * Ride Controller
 * Handles all ride-related operations
 */

const RideService = require('../services/RideService');
const { logger } = require('../utils/logger');
const prisma = require('../config/database');

function enrichRide(ride) {
  if (!ride) return null;
  let otp = '1234';
  let pickupAddr = 'Unknown Pickup';
  let dropAddr = 'Unknown Destination';
  let pickupLat = 0, pickupLng = 0, dropLat = 0, dropLng = 0;

  if (ride.pickupLocation) {
    try {
      const parsedPickup = typeof ride.pickupLocation === 'string'
        ? JSON.parse(ride.pickupLocation)
        : ride.pickupLocation;
      if (parsedPickup) {
        if (parsedPickup.otp) otp = parsedPickup.otp.toString();
        pickupAddr = parsedPickup.address || pickupAddr;
        pickupLat = parsedPickup.latitude || parsedPickup.lat || 0;
        pickupLng = parsedPickup.longitude || parsedPickup.lng || 0;
      }
    } catch (e) {}
  }

  if (ride.dropoffLocation) {
    try {
      const parsedDrop = typeof ride.dropoffLocation === 'string'
        ? JSON.parse(ride.dropoffLocation)
        : ride.dropoffLocation;
      if (parsedDrop) {
        dropAddr = parsedDrop.address || dropAddr;
        dropLat = parsedDrop.latitude || parsedDrop.lat || 0;
        dropLng = parsedDrop.longitude || parsedDrop.lng || 0;
      }
    } catch (e) {}
  }

  ride.otp = otp;
  ride.pickupAddress = pickupAddr;
  ride.dropAddress = dropAddr;
  ride.pickupLatitude = pickupLat;
  ride.pickupLongitude = pickupLng;
  ride.dropLatitude = dropLat;
  ride.dropLongitude = dropLng;

  // Set fare field - prioritize finalFare (after completion), then estimatedFare
  if (ride.finalFare) {
    ride.fare = ride.finalFare;
  } else if (ride.estimatedFare) {
    ride.fare = ride.estimatedFare;
  }
  
  // Ensure rider object is always present and properly formatted
  if (ride.rider) {
    ride.rider = {
      id: ride.rider.id,
      name: ride.rider.name || 'Rider',
      phoneNumber: ride.rider.phoneNumber || ride.rider.phone || '',
      phone: ride.rider.phoneNumber || ride.rider.phone || '',
      profileImage: ride.rider.profileImage || null
    };
  } else {
    // Fallback if rider is missing
    ride.rider = {
      id: null,
      name: 'Rider',
      phoneNumber: '',
      phone: '',
      profileImage: null
    };
  }
  
  return ride;
}

class RideController {
  /**
   * Request a new ride
   */
  async requestRide(req, res, next) {
    try {
      const riderId = req.user.id;
      const rideData = req.body;

      let ride = await RideService.requestRide(riderId, rideData);
      ride = enrichRide(ride);

      res.status(201).json({
        success: true,
        message: 'Ride requested successfully',
        data: { ride }
      });
    } catch (error) {
      logger.error('Request ride error:', error);
      next(error);
    }
  }

  /**
   * Get ride details
   */
  async getRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;

      let ride = await RideService.getRide(rideId);
      ride = enrichRide(ride);

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: 'Ride not found'
        });
      }

      // Check authorization: rider, the assigned driver (by userId), or admin
      const driverUserId = ride.driver?.userId || ride.driver?.user?.id;
      if (ride.riderId !== userId && driverUserId !== userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view this ride'
        });
      }

      res.json({
        success: true,
        data: { ride }
      });
    } catch (error) {
      logger.error('Get ride error:', error);
      next(error);
    }
  }

  /**
   * Get ride history
   */
  async getRideHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      let result;
      if (req.user.role === 'DRIVER' && req.user.driver) {
        result = await RideService.getDriverHistory(req.user.driver.id, parseInt(page), parseInt(limit));
      } else {
        result = await RideService.getRiderHistory(userId, parseInt(page), parseInt(limit));
      }

      if (result && result.rides) {
        result.rides = result.rides.map(enrichRide);
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get ride history error:', error);
      next(error);
    }
  }

  /**
   * Get active ride
   */
  async getActiveRide(req, res, next) {
    try {
      const userId = req.user.id;

      let ride = await prisma.ride.findFirst({
        where: {
          OR: [
            { riderId: userId },
            { driverId: req.user.driver?.id }
          ],
          status: {
            in: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED']
          }
        },
        include: {
          rider: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              profileImage: true
            }
          },
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true,
                  profileImage: true
                }
              }
            }
          },
          vehicle: true
        }
      });

      ride = enrichRide(ride);

      res.json({
        success: true,
        data: { ride }
      });
    } catch (error) {
      logger.error('Get active ride error:', error);
      next(error);
    }
  }

  /**
   * Cancel ride
   */
  async cancelRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      const ride = await RideService.cancelRide(rideId, userId, reason);

      res.json({
        success: true,
        message: 'Ride cancelled successfully',
        data: { ride }
      });
    } catch (error) {
      logger.error('Cancel ride error:', error);
      next(error);
    }
  }

  /**
   * Accept ride (Driver)
   */
  async acceptRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.driver.id;

      let ride = await RideService.acceptRide(rideId, driverId);
      ride = enrichRide(ride);

      res.json({
        success: true,
        message: 'Ride accepted successfully',
        data: { ride }
      });
    } catch (error) {
      logger.error('Accept ride error:', error);
      next(error);
    }
  }

  /**
   * Driver arrived at pickup
   */
  async driverArrived(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.driver.id;

      let ride = await RideService.driverArrived(rideId, driverId);
      ride = enrichRide(ride);

      res.json({
        success: true,
        message: 'Arrival confirmed',
        data: { ride }
      });
    } catch (error) {
      logger.error('Driver arrived error:', error);
      next(error);
    }
  }

  /**
   * Start ride
   */
  async startRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.driver.id;
      const { otp } = req.body;

      let ride = await RideService.startRide(rideId, driverId, otp);
      ride = enrichRide(ride);

      res.json({
        success: true,
        message: 'Ride started successfully',
        data: { ride }
      });
    } catch (error) {
      logger.error('Start ride error:', error);
      next(error);
    }
  }

  /**
   * Complete ride
   */
  async completeRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.driver.id;
      const completionData = req.body;

      let ride = await RideService.completeRide(rideId, driverId, completionData);
      ride = enrichRide(ride);

      res.json({
        success: true,
        message: 'Ride completed successfully',
        data: { ride }
      });
    } catch (error) {
      logger.error('Complete ride error:', error);
      next(error);
    }
  }

  /**
   * Calculate fare estimate
   */
  async calculateFare(req, res, next) {
    try {
      const { rideType, distance, seatsBooked = 1, couponCode } = req.body;

      const fare = RideService.calculateFare(rideType, distance, seatsBooked);
      let discount = 0;
      let couponDetails = null;

      if (couponCode) {
        const couponVal = await RideService.validateCoupon(couponCode, fare);
        if (couponVal.isValid) {
          discount = couponVal.discount;
          couponDetails = couponVal.coupon;
        } else {
          return res.status(400).json({
            success: false,
            message: couponVal.reason
          });
        }
      }

      res.json({
        success: true,
        data: {
          estimatedFare: fare,
          discount,
          finalFare: Math.round((fare - discount) * 100) / 100,
          rideType,
          distance,
          seatsBooked,
          couponApplied: couponDetails ? couponDetails.code : null
        }
      });
    } catch (error) {
      logger.error('Calculate fare error:', error);
      next(error);
    }
  }

  /**
   * Submit rating and feedback for a ride
   */
  async rateRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
      }

      // Check if ride exists
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { driver: true }
      });

      if (!ride) {
        return res.status(404).json({ success: false, message: 'Ride not found' });
      }

      // If user is rider, rate the driver
      if (userRole === 'RIDER') {
        if (ride.riderId !== userId) {
          return res.status(403).json({ success: false, message: 'Unauthorized to rate this ride' });
        }

        if (!ride.driverId) {
          return res.status(400).json({ success: false, message: 'No driver is linked to this ride yet' });
        }

        // Create or update Review
        const review = await prisma.review.upsert({
          where: { rideId },
          update: {
            rating: parseInt(rating),
            comment: comment || ''
          },
          create: {
            rideId,
            riderId: userId,
            driverId: ride.driver.userId,
            rating: parseInt(rating),
            comment: comment || ''
          }
        });

        // Update driver average rating & review count
        const driverId = ride.driverId;
        const driver = await prisma.driver.findUnique({ where: { id: driverId } });
        const newTotalReviews = driver.totalReviews + 1;
        const newRating = ((parseFloat(driver.rating) * driver.totalReviews) + parseInt(rating)) / newTotalReviews;

        await prisma.driver.update({
          where: { id: driverId },
          data: {
            totalReviews: newTotalReviews,
            rating: newRating
          }
        });

        // Emit socket notification to let the driver app know they received a rating!
        const io = req.app.get('io');
        const { emitToUser } = require('../socket');
        emitToUser(io, ride.driver.userId, 'ride:driver_rated', {
          rideId,
          rating: parseInt(rating),
          comment: comment || ''
        });

        return res.json({
          success: true,
          message: 'Thank you for your feedback! Driver rating submitted successfully.',
          data: { review }
        });
      }

      // If user is driver, rate the rider
      if (userRole === 'DRIVER') {
        if (ride.driver?.userId !== userId) {
          return res.status(403).json({ success: false, message: 'Unauthorized to rate this ride' });
        }

        // Since there is no riderRating column on the schema and we want to avoid migrations,
        // we can simply emit a socket notification to update Rider's UI and logs.
        const io = req.app.get('io');
        const { emitToUser } = require('../socket');
        emitToUser(io, ride.riderId, 'ride:rider_rated', {
          rideId,
          rating: parseInt(rating),
          comment: comment || ''
        });

        return res.json({
          success: true,
          message: 'Thank you! Rider rating submitted successfully.'
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid role for rating' });
    } catch (error) {
      logger.error('Rate ride error:', error);
      next(error);
    }
  }
  /**
   * Get latest pending (unassigned) ride request for drivers to poll
   */
  async getPendingRequests(req, res, next) {
    try {
      // Find the most recent REQUESTED ride with no driver assigned yet
      const ride = await prisma.ride.findFirst({
        where: {
          status: 'REQUESTED',
          driverId: null
        },
        orderBy: { createdAt: 'desc' },
        include: {
          rider: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              profileImage: true
            }
          }
        }
      });

      if (!ride) {
        return res.json({ success: true, data: { ride: null } });
      }

      // Parse locations for flat fields matching the socket event schema
      let pickupAddr = 'Unknown Pickup';
      let dropAddr = 'Unknown Destination';
      let pickupLat = 0, pickupLng = 0, dropLat = 0, dropLng = 0;
      let otp = '----';
      try {
        const pl = typeof ride.pickupLocation === 'string' ? JSON.parse(ride.pickupLocation) : ride.pickupLocation;
        const dl = typeof ride.dropoffLocation === 'string' ? JSON.parse(ride.dropoffLocation) : ride.dropoffLocation;
        pickupAddr = pl?.address || pickupAddr;
        dropAddr = dl?.address || dropAddr;
        pickupLat = pl?.latitude || 0;
        pickupLng = pl?.longitude || 0;
        dropLat = dl?.latitude || 0;
        dropLng = dl?.longitude || 0;
        otp = pl?.otp?.toString() || '----';
      } catch (e) {}

      return res.json({
        success: true,
        data: {
          ride: {
            id: ride.id,
            rideId: ride.id,
            rideNumber: ride.rideNumber,
            rideType: ride.rideType,
            status: ride.status,
            pickupAddress: pickupAddr,
            dropAddress: dropAddr,
            pickupLatitude: pickupLat,
            pickupLongitude: pickupLng,
            dropLatitude: dropLat,
            dropLongitude: dropLng,
            fare: ride.estimatedFare,
            estimatedFare: ride.estimatedFare,
            seatsBooked: ride.seatsBooked,
            otp,
            rider: {
              id: ride.rider?.id,
              name: ride.rider?.name || 'Rider',
              phone: ride.rider?.phoneNumber || '',
              phoneNumber: ride.rider?.phoneNumber || ''
            }
          }
        }
      });
    } catch (error) {
      logger.error('Get pending requests error:', error);
      next(error);
    }
  }
}

module.exports = new RideController();
