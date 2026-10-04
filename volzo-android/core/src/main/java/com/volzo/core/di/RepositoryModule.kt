package com.volzo.core.di

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.volzo.core.repository.DriverRepository
import com.volzo.core.repository.PaymentRepository
import com.volzo.core.repository.RideRepository
import com.volzo.core.repository.UserRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideUserRepository(auth: FirebaseAuth, firestore: FirebaseFirestore): UserRepository =
        UserRepository(auth, firestore)

    @Provides
    @Singleton
    fun provideRideRepository(firestore: FirebaseFirestore): RideRepository =
        RideRepository(firestore)

    @Provides
    @Singleton
    fun provideDriverRepository(firestore: FirebaseFirestore): DriverRepository =
        DriverRepository(firestore)

    @Provides
    @Singleton
    fun providePaymentRepository(firestore: FirebaseFirestore): PaymentRepository =
        PaymentRepository(firestore)
}
