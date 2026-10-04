package com.volzo.core.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.volzo.core.model.Ride
import com.volzo.core.model.RideStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RideRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private val ridesCollection = firestore.collection("rides")

    suspend fun createRide(ride: Ride): Result<String> {
        return try {
            val docRef = ridesCollection.document()
            val rideWithId = ride.copy(id = docRef.id)
            docRef.set(rideWithId).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun observeRide(rideId: String): Flow<Ride?> = callbackFlow {
        val listener = ridesCollection.document(rideId).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(snapshot?.toObject(Ride::class.java))
        }
        awaitClose { listener.remove() }
    }

    suspend fun updateRideStatus(rideId: String, status: RideStatus): Result<Unit> {
        return try {
            ridesCollection.document(rideId).update("status", status.name).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getRideHistory(userId: String, role: String): Flow<List<Ride>> = callbackFlow {
        val field = if (role == "DRIVER") "driverId" else "riderId"
        val query = ridesCollection
            .whereEqualTo(field, userId)
            .orderBy("timestamp", Query.Direction.DESCENDING)

        val listener = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val rides = snapshot?.documents?.mapNotNull { it.toObject(Ride::class.java) } ?: emptyList()
            trySend(rides)
        }
        awaitClose { listener.remove() }
    }

    fun observeActiveRides(): Flow<List<Ride>> = callbackFlow {
        val listener = ridesCollection
            .whereIn("status", listOf(RideStatus.REQUESTED.name, RideStatus.ACCEPTED.name, RideStatus.STARTED.name))
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                val rides = snapshot?.documents?.mapNotNull { it.toObject(Ride::class.java) } ?: emptyList()
                trySend(rides)
            }
        awaitClose { listener.remove() }
    }
}
