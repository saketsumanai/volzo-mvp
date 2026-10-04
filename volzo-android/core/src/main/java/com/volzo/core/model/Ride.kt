package com.volzo.core.model

import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class Ride(
    val id: String = "",
    val rideNumber: String = "",
    val riderId: String = "",
    val riderName: String = "",
    val riderPhone: String = "",
    val driverId: String? = null,
    val driverName: String? = null,
    val driverPhone: String? = null,
    val vehicleNumber: String? = null,
    val rideType: String = "SCOOTER", // SCOOTER, SCOOTER_PRO
    val status: String = "REQUESTED", // REQUESTED, ACCEPTED, DRIVER_ARRIVED, IN_PROGRESS, COMPLETED, PAYMENT_PENDING, PAYMENT_VERIFIED, CANCELLED
    val pickupLocation: String = "",
    val dropoffLocation: String = "",
    val pickupLat: Double = 0.0,
    val pickupLng: Double = 0.0,
    val dropoffLat: Double = 0.0,
    val dropoffLng: Double = 0.0,
    val estimatedFare: Double = 0.0,
    val finalFare: Double? = null,
    val distanceKm: Double = 0.0,
    val durationMin: Int = 0,
    val otp: String = "1234",
    val cancelledBy: String? = null,
    val cancellationReason: String? = null,
    @ServerTimestamp val requestedAt: Date? = null,
    @ServerTimestamp val acceptedAt: Date? = null,
    @ServerTimestamp val completedAt: Date? = null,
    @ServerTimestamp val createdAt: Date? = null,
    @ServerTimestamp val updatedAt: Date? = null
)
