import { create } from 'zustand'
import { 
  calculateFare as apiCalculateFare, 
  requestRide as apiRequestRide, 
  getActiveRide as apiGetActiveRide,
  cancelRide as apiCancelRide,
  getRide as apiGetRide
} from '../services/api'
import { joinRideRoom, leaveRideRoom, getSocket } from '../services/socket'

export const useRideStore = create((set, get) => ({
  pickupLocation: null,
  dropoffLocation: null,
  rideType: 'SCOOTER',
  seatsBooked: 1,
  estimatedDistance: 0,
  estimatedDuration: 0,
  fareEstimates: null,
  activeRide: null,
  driverLocation: null,
  isLoading: false,
  error: null,

  setPickupLocation: (loc) => set({ pickupLocation: loc }),
  setDropoffLocation: (loc) => set({ dropoffLocation: loc }),
  setRideType: (type) => set({ rideType: type }),
  setSeatsBooked: (seats) => set({ seatsBooked: seats }),
  
  clearBookingState: () => set({
    pickupLocation: null,
    dropoffLocation: null,
    rideType: 'SCOOTER',
    seatsBooked: 1,
    estimatedDistance: 0,
    estimatedDuration: 0,
    fareEstimates: null,
    driverLocation: null,
    error: null
  }),

  calculateFares: async () => {
    const { pickupLocation, dropoffLocation, seatsBooked } = get()
    if (!pickupLocation || !dropoffLocation) return

    set({ isLoading: true, error: null })
    try {
      // Mock distance calculation or call API if distance is not set yet
      // Let's assume a default distance based on lat/lng or 5km if not available
      const R = 6371 // Earth radius in km
      const dLat = (dropoffLocation.lat - pickupLocation.lat) * Math.PI / 180
      const dLon = (dropoffLocation.lng - pickupLocation.lng) * Math.PI / 180
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pickupLocation.lat * Math.PI / 180) * Math.cos(dropoffLocation.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      let dist = R * c
      if (isNaN(dist) || dist < 0.1) dist = 3.5 // Fallback distance
      
      // Pad by 25% for actual route distance
      const routeDist = parseFloat((dist * 1.25).toFixed(2))
      const duration = Math.round(routeDist * 2.5) // ~2.5 mins per km

      set({ estimatedDistance: routeDist, estimatedDuration: duration })

      // Get fares for each type
      const types = ['SCOOTER', 'RICKSHAW_SHARED', 'RICKSHAW_PRIVATE']
      const estimates = {}

      for (const type of types) {
        try {
          const res = await apiCalculateFare({
            rideType: type,
            distance: routeDist,
            seatsBooked: type === 'RICKSHAW_SHARED' ? seatsBooked : 1
          })
          if (res.data?.success) {
            estimates[type] = res.data.data.fare
          }
        } catch (e) {
          // Fallback static calculation if API fails or backend is missing fare rules
          const baseFare = type === 'SCOOTER' ? 20 : type === 'RICKSHAW_SHARED' ? 10 : 35
          const perKm = type === 'SCOOTER' ? 8 : type === 'RICKSHAW_SHARED' ? 5 : 12
          estimates[type] = Math.round(baseFare + (routeDist * perKm))
        }
      }

      set({ fareEstimates: estimates, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  createRide: async (couponCode = null) => {
    const { pickupLocation, dropoffLocation, rideType, estimatedDistance, seatsBooked } = get()
    if (!pickupLocation || !dropoffLocation) {
      set({ error: 'Pickup and Dropoff locations are required' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const res = await apiRequestRide({
        rideType,
        pickupLocation,
        dropoffLocation,
        estimatedDistance,
        seatsBooked: rideType === 'RICKSHAW_SHARED' ? seatsBooked : 1,
        couponCode
      })

      if (res.data?.success) {
        const ride = res.data.data.ride
        set({ activeRide: ride, isLoading: false })
        // Join ride room
        joinRideRoom(ride.id)
        get().setupSocketListeners(ride.id)
        return ride
      } else {
        throw new Error(res.data?.message || 'Failed to book ride')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to book ride'
      set({ error: msg, isLoading: false })
      return null
    }
  },

  fetchActiveRide: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await apiGetActiveRide()
      if (res.data?.success && res.data.data.ride) {
        const ride = res.data.data.ride
        set({ activeRide: ride, isLoading: false })
        joinRideRoom(ride.id)
        get().setupSocketListeners(ride.id)
        return ride
      } else {
        set({ activeRide: null, isLoading: false })
        return null
      }
    } catch (err) {
      set({ activeRide: null, isLoading: false })
      return null
    }
  },

  cancelActiveRide: async (reason = 'Rider cancelled') => {
    const { activeRide } = get()
    if (!activeRide) return false

    set({ isLoading: true })
    try {
      const res = await apiCancelRide(activeRide.id, reason)
      if (res.data?.success) {
        leaveRideRoom(activeRide.id)
        set({ activeRide: null, driverLocation: null, isLoading: false })
        return true
      }
      set({ isLoading: false })
      return false
    } catch (err) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  setupSocketListeners: (rideId) => {
    const socket = getSocket()
    if (!socket) return

    // Clean old listeners
    socket.off('ride:status:updated')
    socket.off('driver:location:updated')
    socket.off('ride:accepted')
    socket.off('ride:driver_arrived')
    socket.off('ride:started')
    socket.off('ride:completed')
    socket.off('ride:cancelled')

    // Generic status update (from ride room)
    socket.on('ride:status:updated', (data) => {
      console.log('🔔 Ride status updated via socket:', data)
      const currentRide = get().activeRide
      if (currentRide && (currentRide.id === data.rideId || !data.rideId)) {
        // Fetch full ride details to have matching up-to-date object with driver etc
        apiGetRide(data.rideId || currentRide.id).then(res => {
          if (res.data?.success) {
            set({ activeRide: res.data.data.ride })
            if (['COMPLETED', 'CANCELLED'].includes(res.data.data.ride.status)) {
              leaveRideRoom(data.rideId || currentRide.id)
            }
          }
        }).catch(err => {
          // fallback update status directly
          set({ activeRide: { ...currentRide, status: data.status } })
        })
      }
    })

    // Driver accepted - sent directly to rider user room
    socket.on('ride:accepted', (data) => {
      console.log('✅ Driver accepted ride:', data)
      const currentRide = get().activeRide
      // Use data.rideId (not stale closure rideId) to fetch updated ride
      const targetRideId = data.rideId || rideId
      if (currentRide) {
        apiGetRide(targetRideId).then(res => {
          if (res.data?.success) {
            set({ activeRide: res.data.data.ride })
          }
        }).catch(() => {
          set({ activeRide: { ...currentRide, status: 'ACCEPTED', driver: data.driver, vehicle: data.vehicle } })
        })
      }
    })

    // Driver arrived - sent directly to rider user room
    socket.on('ride:driver_arrived', (data) => {
      console.log('📍 Driver arrived:', data)
      const currentRide = get().activeRide
      if (currentRide) {
        set({ activeRide: { ...currentRide, status: 'DRIVER_ARRIVED' } })
      }
    })

    // Ride started - sent directly to rider user room
    socket.on('ride:started', (data) => {
      console.log('🏁 Ride started:', data)
      const currentRide = get().activeRide
      if (currentRide) {
        set({ activeRide: { ...currentRide, status: 'STARTED' } })
      }
    })

    // Ride completed - update status so TrackingPage redirects to payment
    socket.on('ride:completed', (data) => {
      console.log('✅ Ride completed via socket:', data)
      const currentRide = get().activeRide
      if (currentRide) {
        const completedRideId = data.rideId || currentRide.id
        apiGetRide(completedRideId).then(res => {
          if (res.data?.success) {
            set({ activeRide: res.data.data.ride })
            leaveRideRoom(completedRideId)
          }
        }).catch(() => {
          set({ activeRide: { ...currentRide, status: 'COMPLETED', finalFare: data.finalFare } })
        })
      }
    })

    socket.on('driver:location:updated', (data) => {
      console.log('📍 Driver location updated via socket:', data)
      set({ driverLocation: { lat: data.lat, lng: data.lng, heading: data.heading } })
    })
  },

  resetActiveRide: () => {
    const { activeRide } = get()
    if (activeRide) {
      leaveRideRoom(activeRide.id)
    }
    set({ activeRide: null, driverLocation: null })
  }
}))
