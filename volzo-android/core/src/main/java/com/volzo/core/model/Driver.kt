package com.volzo.core.model

import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class Driver(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val phoneNumber: String = "",
    val email: String = "",
    val licenseNumber: String = "",
    val aadharNumber: String = "",
    val panNumber: String = "",
    val kycStatus: String = "PENDING", // PENDING, APPROVED, REJECTED
    val kycRejectionReason: String? = null,
    val status: String = "OFFLINE", // OFFLINE, ONLINE, ON_RIDE
    val isAvailable: Boolean = false,
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val vehicleNumber: String = "",
    val vehicleModel: String = "",
    val batteryPercentage: Int = 100,
    val totalEarnings: Double = 0.0,
    val pendingEarnings: Double = 0.0,
    val totalRides: Int = 0,
    val rating: Double = 5.0,
    val totalReviews: Int = 0,
    val bankAccount: String = "",
    val ifscCode: String = "",
    @ServerTimestamp val createdAt: Date? = null,
    @ServerTimestamp val updatedAt: Date? = null
)
