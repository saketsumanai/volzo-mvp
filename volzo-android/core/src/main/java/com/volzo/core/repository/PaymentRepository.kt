package com.volzo.core.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.volzo.core.model.Payment
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PaymentRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private val paymentsCollection = firestore.collection("payments")

    suspend fun logPayment(payment: Payment): Result<Unit> {
        return try {
            paymentsCollection.document(payment.id).set(payment).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPaymentForRide(rideId: String): Result<Payment?> {
        return try {
            val snapshot = paymentsCollection
                .whereEqualTo("rideId", rideId)
                .limit(1)
                .get()
                .await()
            Result.success(snapshot.documents.firstOrNull()?.toObject(Payment::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
