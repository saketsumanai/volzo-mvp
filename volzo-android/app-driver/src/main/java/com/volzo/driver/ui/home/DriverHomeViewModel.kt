package com.volzo.driver.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
import javax.inject.Inject

@HiltViewModel
class DriverHomeViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    private val rideRepository: RideRepository
) : ViewModel() {

    private val _isOnline = MutableStateFlow(false)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _incomingRide = MutableStateFlow<Ride?>(null)
    val incomingRide: StateFlow<Ride?> = _incomingRide.asStateFlow()

    fun toggleOnlineStatus(driverId: String) {
        viewModelScope.launch {
            val newStatus = !_isOnline.value
            driverRepository.updateDriverStatus(driverId, newStatus).onSuccess {
                _isOnline.value = newStatus
                if (newStatus) {
                    observeIncomingRides()
                }
            }
        }
    }

    private fun observeIncomingRides() {
        viewModelScope.launch {
            rideRepository.observeActiveRides().collectLatest { rides ->
                // Filter for requested rides that haven't been accepted yet
                _incomingRide.value = rides.firstOrNull { it.status == RideStatus.REQUESTED.name }
            }
        }
    }

    fun acceptRide(rideId: String, driverId: String) {
        viewModelScope.launch {
            rideRepository.updateRideStatus(rideId, RideStatus.ACCEPTED).onSuccess {
                // Navigate to tracking
            }
        }
    }

    fun updateLocation(driverId: String, lat: Double, lng: Double) {
        viewModelScope.launch {
            driverRepository.updateLocation(driverId, lat, lng)
        }
    }
}
