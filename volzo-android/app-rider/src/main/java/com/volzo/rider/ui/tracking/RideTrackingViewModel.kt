package com.volzo.rider.ui.tracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.volzo.core.model.Driver
import com.volzo.core.model.Ride
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
class RideTrackingViewModel @Inject constructor(
    private val rideRepository: RideRepository,
    private val driverRepository: DriverRepository
) : ViewModel() {

    private val _ride = MutableStateFlow<Ride?>(null)
    val ride: StateFlow<Ride?> = _ride.asStateFlow()

    private val _driver = MutableStateFlow<Driver?>(null)
    val driver: StateFlow<Driver?> = _driver.asStateFlow()

    fun startTracking(rideId: String) {
        viewModelScope.launch {
            rideRepository.observeRide(rideId).collectLatest { ride ->
                _ride.value = ride
                if (ride?.driverId != null) {
                    trackDriver(ride.driverId)
                }
            }
        }
    }

    private fun trackDriver(driverId: String) {
        viewModelScope.launch {
            driverRepository.getDriver(driverId).onSuccess { driver ->
                _driver.value = driver
            }
        }
    }
}
