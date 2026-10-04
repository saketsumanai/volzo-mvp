package com.volzo.core.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.volzo.core.model.Driver
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DriverRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private val driversCollection = firestore.collection("drivers")

    suspend fun getDriver(driverId: String): Result<Driver?> {
        return try {
            val snapshot = driversCollection.document(driverId).get().await()
            Result.success(snapshot.toObject(Driver::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateDriverStatus(driverId: String, isOnline: Boolean): Result<Unit> {
        return try {
            driversCollection.document(driverId).update("isOnline", isOnline).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateLocation(driverId: String, lat: Double, lng: Double): Result<Unit> {
        return try {
            val updates = mapOf(
                "latitude" to lat,
                "longitude" to lng
            )
            driversCollection.document(driverId).update(updates).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun observeNearbyDrivers(lat: Double, lng: Double, radiusKm: Double): Flow<List<Driver>> = callbackFlow {
        // Production implementation would use GeoFirestore or S2 cells
        // Simplified for this architecture: Fetch all online drivers
        val listener = driversCollection
            .whereEqualTo("isOnline", true)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                val drivers = snapshot?.documents?.mapNotNull { it.toObject(Driver::class.java) } ?: emptyList()
                trySend(drivers)
            }
        awaitClose { listener.remove() }
    }
}
