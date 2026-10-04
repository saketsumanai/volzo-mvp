/**
 * Ride Service
 * Core business logic for ride management
 * Handles: Scooter rides, Shared e-rickshaw, Private e-rickshaw
 */

const prisma = require('../config/database');
const { logger } = require('../utils/logger');
const { emitToUser, emitToRide, emitToDrivers } = require('../socket');

class RideService {
  /**
   * Validate promotional coupon code
   */
  async validateCoupon(code, amount) {
    if (!code) return { isValid: false, reason: 'No code provided' };
    
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'active_coupons' }
      });
      
      if (!config) return { isValid: false, reason: 'No coupons active at the moment' };
      
      const coupons = JSON.parse(config.value);
      const coupon = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
      
      if (!coupon) return { isValid: false, reason: 'Invalid coupon code' };
      if (!coupon.isActive) return { isValid: false, reason: 'This coupon is no longer active' };
      
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return { isValid: false, reason: 'This coupon has expired' };
      }
      
      if (amount < coupon.minRideAmount) {
        return { isValid: false, reason: `Minimum ride amount of ₹${coupon.minRideAmount} required for this coupon` };
      }
      
      let discount = 0;
      if (coupon.discountType === 'PERCENTAGE') {
        discount = (amount * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }
      
      discount = Math.min(discount, amount);
      
      return {
        isValid: true,
        discount: Math.round(discount * 100) / 100,
        coupon
      };
    } catch (error) {
      logger.error('Validate coupon error:', error);
      return { isValid: false, reason: 'Error validating coupon' };
    }
  }

  /**
   * Calculate fare based on ride type and distance
   */
  calculateFare(rideType, distance, seatsBooked = 1) {
    const baseFares = {
      SCOOTER: parseFloat(process.env.BASE_FARE_SCOOTER) || 20,
      SCOOTER_PRO: parseFloat(process.env.BASE_FARE_RICKSHAW_PRIVATE) || 40
    };

    const perKmRates = {
      SCOOTER: parseFloat(process.env.PER_KM_RATE_SCOOTER) || 8,
      SCOOTER_PRO: parseFloat(process.env.PER_KM_RATE_RICKSHAW_PRIVATE) || 12
    };

    const baseFare = baseFares[rideType] || 20;
    const perKmRate = perKmRates[rideType] || 8;

    let fare = baseFare + (distance * perKmRate);

    return Math.round(fare * 100) / 100; // Round to 2 decimals
  }

  /**
   * Generate unique ride number
   */
  async generateRideNumber() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get today's ride count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const count = await prisma.ride.count({
      where: {
        createdAt: { gte: startOfDay }
      }
    });

    return `VLZ-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Request a new ride
   */
  async requestRide(riderId, rideData) {
    try {
      const {
        rideType,
        pickupLocation,
        dropoffLocation,
        estimatedDistance,
        seatsBooked = 1,
        couponCode
      } = rideData;

      // Validate ride type
      if (!['SCOOTER', 'SCOOTER_PRO'].includes(rideType)) {
        throw new Error('Invalid ride type');
      }

      // Validate seats for shared rides
      if (rideType === 'RICKSHAW_SHARED') {
        const maxSeats = parseInt(process.env.MAX_SHARED_SEATS) || 4;
        if (seatsBooked < 1 || seatsBooked > maxSeats) {
          throw new Error(`Seats must be between 1 and ${maxSeats}`);
        }
      }

      // Check if rider has active ride
      const activeRide = await prisma.ride.findFirst({
        where: {
          riderId,
          status: {
            in: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED']
          }
        }
      });

      if (activeRide) {
        throw new Error('You already have an active ride');
      }

      // Calculate fare
      let estimatedFare = this.calculateFare(rideType, estimatedDistance, seatsBooked);
      let discount = 0;
      let couponDetails = null;

      if (couponCode) {
        const couponVal = await this.validateCoupon(couponCode, estimatedFare);
        if (couponVal.isValid) {
          discount = couponVal.discount;
          couponDetails = couponVal.coupon;
          estimatedFare = Math.round((estimatedFare - discount) * 100) / 100;
        } else {
          throw new Error(couponVal.reason);
        }
      }

      // Generate random 4-digit OTP for ride verification
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      // Rich metadata embedding inside pickupLocation for persistence
      const enrichedPickupLocation = {
        ...pickupLocation,
        couponCode: couponDetails ? couponDetails.code : null,
        discountAmount: discount,
        originalEstimatedFare: estimatedFare + discount,
        otp: otp
      };

      // Generate ride number
      const rideNumber = await this.generateRideNumber();

      // Create ride
      const ride = await prisma.ride.create({
        data: {
          rideNumber,
          riderId,
          rideType,
          pickupLocation: JSON.stringify(enrichedPickupLocation),
          dropoffLocation: JSON.stringify(dropoffLocation),
          estimatedFare,
          distance: estimatedDistance,
          seatsBooked,
          status: 'REQUESTED'
        },
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

      logger.info(`Ride requested: ${ride.id} by rider ${riderId}`);

      // Parse locations for flat address fields
      let pickupAddr = 'Unknown Pickup';
      let dropAddr = 'Unknown Destination';
      let pickupLat = 0, pickupLng = 0, dropLat = 0, dropLng = 0;
      try {
        const pl = typeof ride.pickupLocation === 'string' ? JSON.parse(ride.pickupLocation) : ride.pickupLocation;
        const dl = typeof ride.dropoffLocation === 'string' ? JSON.parse(ride.dropoffLocation) : ride.dropoffLocation;
        pickupAddr = pl?.address || pickupAddr;
        dropAddr = dl?.address || dropAddr;
        pickupLat = pl?.latitude || 0;
        pickupLng = pl?.longitude || 0;
        dropLat = dl?.latitude || 0;
        dropLng = dl?.longitude || 0;
      } catch(e) {}

      // Broadcast to available drivers - use 'ride:new_request' to match driver app listener
      const io = require('../server').app.get('io');
      emitToDrivers(io, 'ride:new_request', {
        id: ride.id,
        rideId: ride.id,
        rideNumber: ride.rideNumber,
        rideType: ride.rideType,
        pickupAddress: pickupAddr,
        dropAddress: dropAddr,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        dropLatitude: dropLat,
        dropLongitude: dropLng,
        fare: ride.estimatedFare,
        estimatedFare: ride.estimatedFare,
        seatsBooked: ride.seatsBooked,
        rider: {
          id: ride.rider?.id,
          name: ride.rider?.name || 'Rider',
          phone: ride.rider?.phoneNumber || '',
          phoneNumber: ride.rider?.phoneNumber || ''
        }
      });

      return ride;
    } catch (error) {
      logger.error('Ride request failed:', error);
      throw error;
    }
  }

  /**
   * Driver accepts ride
   */
  async acceptRide(rideId, driverId) {
    try {
      const updatedRide = await prisma.$transaction(async (tx) => {
        // 1. Fetch driver profile with active vehicles inside transaction
        const driver = await tx.driver.findUnique({
          where: { id: driverId },
          include: {
            vehicles: {
              where: { isActive: true },
              take: 1
            }
          }
        });

        if (!driver) {
          throw new Error('Driver not found');
        }

        // 2. Use first active vehicle if available
        const vehicle = driver.vehicles.length > 0 ? driver.vehicles[0] : null;

        // 3. Atomically update ride status ONLY if it remains 'REQUESTED' (optimistic concurrency control)
        const updateResult = await tx.ride.updateMany({
          where: {
            id: rideId,
            status: 'REQUESTED'
          },
          data: {
            driverId,
            vehicleId: vehicle?.id || null,
            status: 'ACCEPTED',
            acceptedAt: new Date()
          }
        });

        if (updateResult.count === 0) {
          throw new Error('Ride is no longer available');
        }

        // 4. Retrieve fully populated ride model to guarantee absolute data alignment
        const rideDetails = await tx.ride.findUnique({
          where: { id: rideId },
          include: {
            rider: true,
            driver: {
              include: {
                user: true
              }
            },
            vehicle: true
          }
        });

        // 5. Update driver status to ON_RIDE to prevent other incoming requests
        await tx.driver.update({
          where: { id: driverId },
          data: {
            status: 'ON_RIDE',
            isAvailable: false
          }
        });

        return rideDetails;
      });

      logger.info(`Ride ${rideId} atomically accepted by driver ${driverId}`);

      // 6. Notify rider via WebSocket - Guaranteed to fire after transaction commit has completed
      const io = require('../server').app.get('io');
      emitToUser(io, updatedRide.riderId, 'ride:accepted', {
        rideId: updatedRide.id,
        status: 'ACCEPTED',
        driver: {
          id: updatedRide.driver.id,
          name: updatedRide.driver.user.name,
          phoneNumber: updatedRide.driver.user.phoneNumber,
          phone: updatedRide.driver.user.phoneNumber,
          rating: parseFloat(updatedRide.driver.rating),
          profileImage: updatedRide.driver.user.profileImage
        },
        vehicle: updatedRide.vehicle ? {
          type: updatedRide.vehicle.vehicleType,
          registrationNumber: updatedRide.vehicle.registrationNumber,
          model: updatedRide.vehicle.model,
          color: updatedRide.vehicle.color
        } : null
      });

      // 7. Emit status update to ride room
      emitToRide(io, rideId, 'ride:status:updated', {
        rideId: updatedRide.id,
        status: 'ACCEPTED'
      });

      return updatedRide;
    } catch (error) {
      logger.error('Ride acceptance failed:', error);
      throw error;
    }
  }

  /**
   * Driver arrives at pickup
   */
  async driverArrived(rideId, driverId) {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
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

      if (!ride || ride.driverId !== driverId) {
        throw new Error('Unauthorized or ride not found');
      }

      if (ride.status !== 'ACCEPTED') {
        throw new Error('Invalid ride status');
      }

      const updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'DRIVER_ARRIVED',
          driverArrivedAt: new Date()
        },
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

      logger.info(`Driver arrived for ride ${rideId}`);

      // Notify rider
      const io = require('../server').app.get('io');
      emitToUser(io, ride.riderId, 'ride:driver_arrived', {
        rideId: updatedRide.id,
        message: 'Your driver has arrived'
      });

      return updatedRide;
    } catch (error) {
      logger.error('Driver arrival update failed:', error);
      throw error;
    }
  }

  /**
   * Start ride
   */
  async startRide(rideId, driverId, otp) {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
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

      if (!ride || ride.driverId !== driverId) {
        throw new Error('Unauthorized or ride not found');
      }

      if (ride.status !== 'DRIVER_ARRIVED' && ride.status !== 'ACCEPTED') {
        throw new Error('Cannot start ride from current status: ' + ride.status);
      }

      // OTP validation - check ride.otp field first, then fallback to pickupLocation
      let expectedOtp = ride.otp ? ride.otp.toString() : null;
      
      if (!expectedOtp && ride.pickupLocation) {
        try {
          const parsedPickup = typeof ride.pickupLocation === 'string'
            ? JSON.parse(ride.pickupLocation)
            : ride.pickupLocation;
          if (parsedPickup && parsedPickup.otp) {
            expectedOtp = parsedPickup.otp.toString();
          }
        } catch (e) {}
      }

      // If no OTP was generated, accept any input (dev mode fallback)
      if (expectedOtp && otp && otp.toString() !== expectedOtp) {
        throw new Error('Invalid OTP. Please ask the rider for the correct code.');
      }

      const updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'STARTED',
          startedAt: new Date()
        },
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

      logger.info(`Ride started: ${rideId}`);

      // Notify rider and all ride participants
      const io = require('../server').app.get('io');
      emitToUser(io, ride.riderId, 'ride:started', {
        rideId: updatedRide.id,
        status: 'STARTED',
        message: 'Your ride has started! Enjoy your trip.'
      });
      
      emitToRide(io, rideId, 'ride:status:updated', {
        rideId: updatedRide.id,
        status: 'STARTED'
      });

      return updatedRide;
    } catch (error) {
      logger.error('Ride start failed:', error);
      throw error;
    }
  }

  /**
   * Complete ride
   */
  async completeRide(rideId, driverId, completionData) {
    try {
      const { finalDistance, actualRoute } = completionData;

      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
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

      if (!ride || ride.driverId !== driverId) {
        throw new Error('Unauthorized or ride not found');
      }

      // Allow completion from STARTED or DRIVER_ARRIVED (fallback if OTP was skipped)
      if (!['STARTED', 'DRIVER_ARRIVED'].includes(ride.status)) {
        throw new Error('Ride is not in progress (status: ' + ride.status + ')');
      }

      // Calculate final fare
      let finalFare = this.calculateFare(ride.rideType, finalDistance || ride.distance || 3, ride.seatsBooked);

      // Apply coupon discount if it was saved in pickupLocation
      let discount = 0;
      let pickupLoc = ride.pickupLocation;
      if (typeof pickupLoc === 'string') {
        try { pickupLoc = JSON.parse(pickupLoc); } catch (e) {}
      }

      if (pickupLoc && typeof pickupLoc === 'object') {
        if (pickupLoc.couponCode) {
          const couponVal = await this.validateCoupon(pickupLoc.couponCode, finalFare);
          if (couponVal.isValid) {
            discount = couponVal.discount;
            finalFare = Math.round((finalFare - discount) * 100) / 100;
          }
        }
      }

      // Calculate duration (gracefully handle missing startedAt)
      const startRef = ride.startedAt || ride.driverArrivedAt || ride.acceptedAt || ride.createdAt;
      const duration = startRef ? Math.round((new Date() - new Date(startRef)) / 60000) : 10; // minutes

      const updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          finalFare,
          distance: finalDistance || ride.distance,
          duration,
          actualRoute: actualRoute ? JSON.stringify(actualRoute) : null
        },
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

      // Update driver stats
      await prisma.driver.update({
        where: { id: driverId },
        data: {
          status: 'ONLINE',
          isAvailable: true,
          totalRides: { increment: 1 }
        }
      });

      // Ensure payment record exists immediately after completion (driver QR flow depends on it)
      const paymentAmount = updatedRide.finalFare || updatedRide.estimatedFare || 0;
      await prisma.payment.upsert({
        where: { rideId },
        create: {
          rideId,
          amount: paymentAmount,
          method: 'QR_UPI',
          status: 'PENDING',
          upiId: process.env.UPI_ID || '8102964108@ptsbi'
        },
        update: {
          amount: paymentAmount
        }
      });

      logger.info(`Ride completed: ${rideId}`);

      // Notify rider via direct user event AND ride room status update
      const io = require('../server').app.get('io');
      emitToUser(io, ride.riderId, 'ride:completed', {
        rideId: updatedRide.id,
        finalFare: updatedRide.finalFare,
        distance: updatedRide.distance,
        duration: updatedRide.duration
      });

      // Also emit to ride room so any subscribed listeners get status update
      emitToRide(io, rideId, 'ride:status:updated', {
        rideId: updatedRide.id,
        status: 'COMPLETED',
        finalFare: updatedRide.finalFare
      });

      return updatedRide;
    } catch (error) {
      logger.error('Ride completion failed:', error);
      throw error;
    }
  }

  /**
   * Cancel ride
   */
  async cancelRide(rideId, userId, reason) {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          driver: {
            include: {
              user: true
            }
          }
        }
      });

      if (!ride) {
        throw new Error('Ride not found');
      }

      const driverUserId = ride.driver?.userId || ride.driver?.user?.id;

      // Check authorization (rider user id OR assigned driver's user id)
      if (ride.riderId !== userId && driverUserId !== userId) {
        throw new Error('Unauthorized to cancel this ride');
      }

      // Cannot cancel completed rides
      if (['COMPLETED', 'CANCELLED'].includes(ride.status)) {
        throw new Error('Cannot cancel this ride');
      }

      const updatedRide = await prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason
        }
      });

      // If driver was assigned, make them available again
      if (ride.driverId) {
        await prisma.driver.update({
          where: { id: ride.driverId },
          data: {
            status: 'ONLINE',
            isAvailable: true
          }
        });
      }

      logger.info(`Ride cancelled: ${rideId} by user ${userId}`);

      // Notify other party (socket rooms are keyed by user id, not driver id)
      const io = require('../server').app.get('io');
      const notifyUserId = userId === ride.riderId ? driverUserId : ride.riderId;

      if (notifyUserId) {
        emitToUser(io, notifyUserId, 'ride:cancelled', {
          rideId: updatedRide.id,
          reason: reason,
          cancelledBy: userId === ride.riderId ? 'rider' : 'driver'
        });

        if (userId === ride.riderId) {
          emitToUser(io, notifyUserId, 'ride:cancelled_by_rider', {
            rideId: updatedRide.id,
            reason: reason || 'Rider cancelled'
          });
        }
      }

      return updatedRide;
    } catch (error) {
      logger.error('Ride cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Get ride details
   */
  async getRide(rideId) {
    return prisma.ride.findUnique({
      where: { id: rideId },
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
        vehicle: true,
        payment: true,
        review: true
      }
    });
  }

  /**
   * Get rider's ride history
   */
  async getRiderHistory(riderId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { riderId },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  name: true,
                  profileImage: true
                }
              }
            }
          },
          vehicle: true,
          payment: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.ride.count({ where: { riderId } })
    ]);

    return {
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get driver's ride history
   */
  async getDriverHistory(driverId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { driverId },
        include: {
          rider: {
            select: {
              name: true,
              profileImage: true
            }
          },
          payment: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.ride.count({ where: { driverId } })
    ]);

    return {
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get active rides (for admin)
   */
  async getActiveRides() {
    return prisma.ride.findMany({
      where: {
        status: {
          in: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED']
        }
      },
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
        vehicle: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

module.exports = new RideService();
