package com.volzo.admin.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.volzo.core.model.Ride
import com.volzo.core.repository.RideRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AdminDashboardViewModel @Inject constructor(
    private val rideRepository: RideRepository
) : ViewModel() {

    private val _activeRides = MutableStateFlow<List<Ride>>(emptyList())
    val activeRides: StateFlow<List<Ride>> = _activeRides.asStateFlow()

    private val _stats = MutableStateFlow(AdminStats())
    val stats: StateFlow<AdminStats> = _stats.asStateFlow()

    fun startMonitoring() {
        viewModelScope.launch {
            rideRepository.observeActiveRides().collectLatest { rides ->
                _activeRides.value = rides
                updateStats(rides)
            }
        }
    }

    private fun updateStats(rides: List<Ride>) {
        _stats.value = _stats.value.copy(
            activeTripsCount = rides.size,
            revenue = rides.sumOf { it.estimatedFare }
        )
    }
}

data class AdminStats(
    val totalRiders: Int = 0,
    val totalDrivers: Int = 0,
    val onlineDriversCount: Int = 0,
    val activeTripsCount: Int = 0,
    val revenue: Double = 0.0
)
