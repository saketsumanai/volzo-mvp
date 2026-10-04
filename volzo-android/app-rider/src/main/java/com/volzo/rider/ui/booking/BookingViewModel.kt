package com.volzo.rider.ui.booking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.volzo.core.model.Driver
import com.volzo.core.model.Ride
import com.volzo.core.model.RideStatus
import com.volzo.core.repository.DriverRepository
import com.volzo.core.repository.RideRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class BookingViewModel @Inject constructor(
    private val rideRepository: RideRepository,
    private val driverRepository: DriverRepository
) : ViewModel() {

    private val _nearbyDrivers = MutableStateFlow<List<Driver>>(emptyList())
    val nearbyDrivers: StateFlow<List<Driver>> = _nearbyDrivers.asStateFlow()

    private val _fareEstimate = MutableStateFlow<Double?>(null)
    val fareEstimate: StateFlow<Double?> = _fareEstimate.asStateFlow()

    private val _bookingStatus = MutableStateFlow<BookingState>(BookingStatus.Idle)
    val bookingStatus: StateFlow<BookingState> = _bookingStatus.asStateFlow()

    fun findNearbyDrivers(lat: Double, lng: Double) {
        viewModelScope.launch {
            driverRepository.observeNearbyDrivers(lat, lng, 5.0).collectLatest { drivers ->
                _nearbyDrivers.value = drivers
            }
        }
    }

    fun calculateFare(distanceKm: Double) {
        // Base ₹20 + ₹8/km logic
        val base = 20.0
        val perKm = 8.0
        _fareEstimate.value = base + (distanceKm * perKm)
    }

    fun bookRide(pickup: String, dropoff: String, pickupLat: Double, pickupLng: Double, dropLat: Double, dropLng: Double, distance: Double) {
        viewModelScope.launch {
            _bookingStatus.value = BookingStatus.Loading
            val fare = _fareEstimate.value ?: (20.0 + (distance * 8.0))
            
            val ride = Ride(
                rideNumber = "VLZ-" + UUID.randomUUID().toString().substring(0, 8).uppercase(),
                pickupLocation = pickup,
                dropoffLocation = dropoff,
                pickupLat = pickupLat,
                pickupLng = pickupLng,
                dropoffLat = dropLat,
                dropoffLng = dropLng,
                estimatedFare = fare,
                distanceKm = distance,
                status = RideStatus.REQUESTED.name
            )

            val result = rideRepository.createRide(ride)
            if (result.isSuccess) {
                _bookingStatus.value = BookingStatus.Success(result.getOrThrow())
            } else {
                _bookingStatus.value = BookingStatus.Error(result.exceptionOrNull()?.message ?: "Booking Failed")
            }
        }
    }
}

sealed interface BookingState
object BookingStatus {
    object Idle : BookingState
    object Loading : BookingState
    data class Success(val rideId: String) : BookingState
    data class Error(val message: String) : BookingState
}
