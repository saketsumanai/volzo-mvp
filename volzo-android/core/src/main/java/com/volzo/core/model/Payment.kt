package com.volzo.core.model

import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class Payment(
    val id: String = "",
    val rideId: String = "",
    val amount: Double = 0.0,
    val method: String = "RAZORPAY", // RAZORPAY, CASH, QR_UPI, WALLET
    val status: String = "PENDING", // PENDING, PAID, DRIVER_VERIFIED, FAILED
    val razorpayOrderId: String? = null,
    val razorpayPaymentId: String? = null,
    val razorpaySignature: String? = null,
    val upiTransactionId: String? = null,
    val isFlagged: Boolean = false,
    val flagReason: String? = null,
    @ServerTimestamp val createdAt: Date? = null,
    @ServerTimestamp val updatedAt: Date? = null
)
