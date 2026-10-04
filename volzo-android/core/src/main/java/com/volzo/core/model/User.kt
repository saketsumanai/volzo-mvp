package com.volzo.core.model

import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class User(
    val id: String = "",
    val phoneNumber: String = "",
    val name: String = "",
    val email: String = "",
    val profileImage: String = "",
    val role: String = "RIDER", // RIDER, DRIVER, ADMIN
    val status: String = "ACTIVE", // ACTIVE, SUSPENDED, BLOCKED
    val emergencyContact: String = "",
    val savedHome: String = "",
    val savedWork: String = "",
    val firebaseUid: String = "",
    val fcmToken: String = "",
    @ServerTimestamp val createdAt: Date? = null,
    @ServerTimestamp val updatedAt: Date? = null
)
