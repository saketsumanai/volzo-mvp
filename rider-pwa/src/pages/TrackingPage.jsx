import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { useRideStore } from '../store/rideStore'
import { simulateRideStatus, getRide } from '../services/api'
import { 
  Phone, Shield, Star, Ban, Navigation, 
  MapPin, Clock, Info, ShieldAlert, Award, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const mapContainerStyle = { width: '100%', height: '100%' }
const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  clickableIcons: false
}

export default function TrackingPage() {
  const { rideId } = useParams()
  const navigate = useNavigate()
  
  const { 
    activeRide, 
    fetchActiveRide, 
    driverLocation, 
    cancelActiveRide, 
    setupSocketListeners,
    resetActiveRide
  } = useRideStore()

  const [mapCenter, setMapCenter] = useState({ lat: 12.9352, lng: 77.6245 })
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false)
  const [simIntervalId, setSimIntervalId] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSosModal, setShowSosModal] = useState(false)
  const [sosPulsing, setSosPulsing] = useState(false)

  const mapRef = useRef(null)

  // Load Map Engine
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  })

  // 1. Fetch active ride details on load
  useEffect(() => {
    const init = async () => {
      let ride = activeRide
      if (!ride || ride.id !== rideId) {
        try {
          const res = await getRide(rideId)
          if (res.data?.success) {
            ride = res.data.data.ride
            useRideStore.setState({ activeRide: ride })
            setupSocketListeners(rideId)
          }
        } catch (err) {
          toast.error('Failed to load ride details')
          navigate('/home')
          return
        }
      } else {
        // Always re-setup socket listeners for this ride
        setupSocketListeners(rideId)
      }

      if (!ride) {
        navigate('/home')
        return
      }

      // Position map center to pickup
      if (ride.pickupLocation) {
        setMapCenter({
          lat: ride.pickupLocation.lat,
          lng: ride.pickupLocation.lng
        })
      }
    };
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId])

  // 2. Redirect on Completed or Cancelled status
  useEffect(() => {
    if (activeRide) {
      if (activeRide.status === 'COMPLETED') {
        if (simIntervalId) clearInterval(simIntervalId)
        toast.success('🎉 Your trip has successfully completed!')
        navigate(`/payment/${activeRide.id}`)
      } else if (activeRide.status === 'CANCELLED') {
        if (simIntervalId) clearInterval(simIntervalId)
        toast.error('This ride has been cancelled.')
        resetActiveRide()
        navigate('/home')
      }
    }
  }, [activeRide?.status, navigate, simIntervalId, resetActiveRide])

  // SOS pulsing animation
  useEffect(() => {
    const interval = setInterval(() => {
      setSosPulsing(p => !p)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  // Clean up simulator on unmount
  useEffect(() => {
    return () => {
      if (simIntervalId) clearInterval(simIntervalId)
    }
  }, [simIntervalId])

  // Simulator helper: triggers status change on backend
  const triggerSimulation = async (status) => {
    try {
      const res = await simulateRideStatus(rideId, status)
      if (res.data?.success) {
        const updated = res.data.data.ride
        useRideStore.setState({ activeRide: updated })
        toast.success(`Demo: Ride is now ${status}`)
      }
    } catch (e) {
      toast.error('Demo simulation error')
    }
  }

  // Live Drive Simulation
  const startLiveDriveSimulation = () => {
    if (!activeRide) return
    if (isSimulatingDrive) {
      clearInterval(simIntervalId)
      setIsSimulatingDrive(false)
      toast.success('Drive simulation stopped')
      return
    }

    setIsSimulatingDrive(true)
    toast.success('Starting live drive path simulation!')

    const startLat = activeRide.pickupLocation.lat
    const startLng = activeRide.pickupLocation.lng
    const endLat = activeRide.dropoffLocation.lat
    const endLng = activeRide.dropoffLocation.lng

    let step = 0
    const totalSteps = 25

    const interval = setInterval(async () => {
      step++
      if (step > totalSteps) {
        clearInterval(interval)
        setIsSimulatingDrive(false)
        await triggerSimulation('COMPLETED')
        return
      }

      const ratio = step / totalSteps
      const currentLat = startLat + (endLat - startLat) * ratio
      const currentLng = startLng + (endLng - startLng) * ratio

      setMapCenter({ lat: currentLat, lng: currentLng })

      try {
        await simulateRideStatus(rideId, 'LOCATION_UPDATE', {
          lat: currentLat,
          lng: currentLng
        })
      } catch (err) {
        console.warn('Failed to emit coordinate', err)
      }
    }, 1000)

    setSimIntervalId(interval)
  }

  const handleCancelRide = async () => {
    setShowCancelModal(false)
    toast.loading('Cancelling your ride...', { id: 'cancel' })
    const success = await cancelActiveRide('Rider cancelled from app')
    if (success) {
      toast.success('Ride cancelled successfully', { id: 'cancel' })
      navigate('/home')
    } else {
      toast.error('Failed to cancel ride', { id: 'cancel' })
    }
  }

  const handleSosAction = () => {
    setShowSosModal(false)
    // Open emergency call
    window.open('tel:112', '_self')
    toast.error('🚨 Emergency services contacted!', { duration: 5000 })
  }

  // Get visual state details
  const getStatusDisplay = () => {
    switch (activeRide?.status) {
      case 'REQUESTED': return { title: 'Finding your driver...', subtitle: 'Matching with closest EV Scooter or Rickshaw', color: '#0066FF' }
      case 'ACCEPTED': return { title: 'Driver is arriving', subtitle: `${activeRide?.driver?.user?.name || 'Your driver'} is heading to your pickup`, color: '#0066FF' }
      case 'DRIVER_ARRIVED': return { title: 'Driver has arrived! 🎉', subtitle: 'Share your OTP with driver to start the trip', color: '#F59E0B' }
      case 'STARTED': return { title: '🚀 Trip in progress', subtitle: 'Eco-friendly transit to your destination', color: '#10B981' }
      default: return { title: 'Locating trip...', subtitle: '', color: '#0066FF' }
    }
  }

  const statusInfo = getStatusDisplay()

  // Pre-calculate polyline between pickup and dropoff if loaded
  const polylinePath = activeRide ? [
    { lat: activeRide.pickupLocation.lat, lng: activeRide.pickupLocation.lng },
    { lat: activeRide.dropoffLocation.lat, lng: activeRide.dropoffLocation.lng }
  ] : []

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} className="fade-in">
      
      {/* 1. Map view */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        {isLoaded && activeRide ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={14}
            options={defaultOptions}
            onLoad={(map) => { mapRef.current = map }}
          >
            {/* Pickup Marker (Blue) */}
            <Marker 
              position={{ lat: activeRide.pickupLocation.lat, lng: activeRide.pickupLocation.lng }} 
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }}
            />

            {/* Dropoff Marker (Red) */}
            <Marker 
              position={{ lat: activeRide.dropoffLocation.lat, lng: activeRide.dropoffLocation.lng }} 
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }}
            />

            {/* Live Driver Marker */}
            {(driverLocation || (activeRide.status !== 'REQUESTED')) && (
              <Marker 
                position={driverLocation || { lat: activeRide.pickupLocation.lat - 0.005, lng: activeRide.pickupLocation.lng - 0.004 }}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                  scaledSize: new window.google.maps.Size(42, 42)
                }}
              />
            )}

            {/* Route Polyline */}
            <Polyline 
              path={polylinePath}
              options={{
                strokeColor: '#0066FF',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                geodesic: true
              }}
            />
          </GoogleMap>
        ) : (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' }}>
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {/* Developer Simulator Drawer Widget */}
      <div style={{
        position: 'absolute',
        top: '90px',
        left: '16px',
        right: '16px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 14px',
        borderRadius: '16px',
        color: 'white',
        zIndex: 20,
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldAlert size={16} color="var(--secondary)" />
          <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--secondary)' }}>
            Volzo QA Sandbox Simulator
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button 
            onClick={() => triggerSimulation('ACCEPTED')}
            style={{ padding: '6px', background: '#334155', border: 'none', color: 'white', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
          >
            1. Accept
          </button>
          <button 
            onClick={() => triggerSimulation('DRIVER_ARRIVED')}
            style={{ padding: '6px', background: '#334155', border: 'none', color: 'white', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
          >
            2. Arrived
          </button>
          <button 
            onClick={() => triggerSimulation('STARTED')}
            style={{ padding: '6px', background: '#334155', border: 'none', color: 'white', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
          >
            3. Start Trip
          </button>
          <button 
            onClick={startLiveDriveSimulation}
            style={{ 
              padding: '6px', 
              background: isSimulatingDrive ? 'var(--danger)' : 'var(--primary)', 
              border: 'none', 
              color: 'white', 
              borderRadius: '6px', 
              fontSize: '10px', 
              fontWeight: '700', 
              cursor: 'pointer' 
            }}
          >
            {isSimulatingDrive ? 'Stop Drive' : '4. Live Drive'}
          </button>
        </div>
      </div>

      {/* Floating Status / Back Header */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 100%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }} className="safe-top">
        <div style={{
          background: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          boxShadow: 'var(--shadow)',
          fontWeight: '700',
          fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: activeRide?.status === 'STARTED' ? 'var(--accent)' : 'var(--primary)',
            display: 'inline-block',
            animation: 'pulse 1.5s infinite'
          }}></span>
          Ride: {activeRide?.rideNumber || 'VLZ-...'}
        </div>

        <button 
          onClick={() => setShowCancelModal(true)}
          style={{
            background: '#FEF2F2',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            color: 'var(--danger)',
            fontWeight: '700',
            fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)'
          }}
        >
          <Ban size={14} /> Cancel Ride
        </button>
      </div>

      {/* 🚨 SOS Emergency Button — Fixed position, always visible */}
      <button
        id="sos-emergency-btn"
        onClick={() => setShowSosModal(true)}
        style={{
          position: 'absolute',
          bottom: '340px',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: sosPulsing 
            ? 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' 
            : 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)',
          color: 'white',
          fontWeight: '900',
          fontSize: '13px',
          letterSpacing: '0.5px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          boxShadow: sosPulsing
            ? '0 0 0 8px rgba(239,68,68,0.3), 0 8px 24px rgba(185,28,28,0.6)'
            : '0 0 0 4px rgba(239,68,68,0.2), 0 8px 24px rgba(185,28,28,0.5)',
          transition: 'all 0.4s ease',
          transform: sosPulsing ? 'scale(1.05)' : 'scale(1)'
        }}
      >
        <AlertTriangle size={18} style={{ marginBottom: '1px' }} />
        <span style={{ fontSize: '11px', fontWeight: '900', lineHeight: '1' }}>SOS</span>
      </button>

      {/* Bottom Tracking Card Sheet */}
      <div className="bottom-sheet slide-up" style={{ zIndex: 90, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '5px', background: '#E2E8F0', borderRadius: '99px', margin: '0 auto', marginBottom: '4px' }}></div>

        {/* Live Trip Status Details */}
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
            {statusInfo.title}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {statusInfo.subtitle}
          </p>
        </div>

        <div className="divider" style={{ margin: '8px 0' }}></div>

        {/* Step-by-step Timeline Visuals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
          {['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED'].map((state, i) => {
            const statuses = ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED']
            const activeIndex = statuses.indexOf(activeRide?.status || 'REQUESTED')
            const isCompleted = activeIndex >= i
            const isCurrent = activeIndex === i

            return (
              <div key={state} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{
                  width: '24px', height: '24px',
                  borderRadius: '50%',
                  background: isCompleted ? statusInfo.color : '#E2E8F0',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s'
                }}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  color: isCurrent ? statusInfo.color : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)' 
                }}>
                  {state === 'REQUESTED' ? 'Booked' : state === 'ACCEPTED' ? 'Accepted' : state === 'DRIVER_ARRIVED' ? 'Arrived' : 'On Ride'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Driver Details Card (Show once ride is accepted) */}
        {activeRide?.status !== 'REQUESTED' && (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 'bold', fontSize: '18px'
                }}>
                  {activeRide?.driver?.user?.name ? activeRide.driver.user.name[0].toUpperCase() : 'V'}
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800' }}>
                    {activeRide?.driver?.user?.name || 'Vikram Singh'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" /> 4.9 • Ather EV Scooter
                  </div>
                </div>
              </div>

              {/* Call driver button */}
              <a 
                href={`tel:${activeRide?.driver?.user?.phoneNumber || '+919999999998'}`}
                style={{
                  width: '40px', height: '40px',
                  borderRadius: '50%',
                  background: 'white',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary)',
                  boxShadow: 'var(--shadow)',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
              >
                <Phone size={18} />
              </a>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }}></div>

            {/* Vehicle specifics & Plate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>VEHICLE NUMBER</span>
                <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                  {activeRide?.vehicle?.registrationNumber || 'KA-01-EQ-9876'}
                </p>
              </div>

              {/* Ride Start OTP */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>START OTP</span>
                <p style={{ fontSize: '16px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '1px' }}>
                  {activeRide?.otp || '1947'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🚨 SOS Confirmation Modal */}
      {showSosModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '28px 24px',
            width: '100%',
            maxWidth: '340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.2s ease-out',
            border: '3px solid #EF4444'
          }}>
            {/* SOS Icon */}
            <div style={{
              width: '72px', height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #DC2626, #EF4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto',
              boxShadow: '0 0 0 12px rgba(239,68,68,0.15)'
            }}>
              <AlertTriangle size={36} color="white" />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '900', textAlign: 'center', color: '#DC2626' }}>
              Emergency SOS
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '22px' }}>
              This will call <strong>112 (Emergency Services)</strong> immediately. Use only in a genuine emergency.
            </p>

            <div style={{
              background: '#FEF2F2',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <p style={{ fontSize: '12px', color: '#991B1B', fontWeight: '600', textAlign: 'center' }}>
                🚨 Ride: {activeRide?.rideNumber} | Driver: {activeRide?.driver?.user?.name || 'N/A'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button 
                onClick={() => setShowSosModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSosAction}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '900',
                  fontSize: '15px',
                  cursor: 'pointer',
                  color: 'white',
                  boxShadow: '0 4px 16px rgba(239,68,68,0.4)'
                }}
              >
                📞 Call 112
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation confirmation modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', textAlign: 'center' }}>Cancel your Ride?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '20px' }}>
              Drivers count on scheduled rides. If you cancel now, a cancellation fee may apply.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Keep Ride
              </button>
              <button 
                onClick={handleCancelRide}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: 'var(--danger)', 
                  color: 'white', 
                  fontWeight: '600', 
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel Ride
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
