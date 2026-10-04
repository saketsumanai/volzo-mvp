import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { useAuthStore } from '../store/authStore'
import { useRideStore } from '../store/rideStore'
import { 
  Menu, Bell, MapPin, Search, Navigation, 
  History, User, LogOut, X, ArrowRight, ShieldAlert 
} from 'lucide-react'
import toast from 'react-hot-toast'

// Map Config
const mapContainerStyle = { width: '100%', height: '100%' }
const defaultCenter = { lat: 12.9352, lng: 77.6245 } // Koramangala, Bangalore
const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  clickableIcons: false
}

// Preset locations for quick testing
const presets = [
  { name: 'Kempegowda Int. Airport (BLR)', address: 'Airport Rd, Devanahalli, Bengaluru', lat: 13.1986, lng: 77.7066 },
  { name: 'Indiranagar Main Road', address: '100 Feet Rd, Indiranagar, Bengaluru', lat: 12.9719, lng: 77.6412 },
  { name: 'Majestic Metro Station', address: 'Majestic, Bengaluru', lat: 12.9779, lng: 77.5724 },
  { name: 'Whitefield ITPL', address: 'ITPL Main Rd, Whitefield, Bengaluru', lat: 12.9698, lng: 77.7500 },
  { name: 'Koramangala Sony World', address: 'Sony World Junction, Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245 },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { 
    pickupLocation, setPickupLocation,
    dropoffLocation, setDropoffLocation,
    activeRide, fetchActiveRide, clearBookingState 
  } = useRideStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isPickingDropoff, setIsPickingDropoff] = useState(false)
  const [loadingActiveRide, setLoadingActiveRide] = useState(true)

  const mapRef = useRef(null)

  // Load Google Map JS
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  })

  // 1. Check for active ride on mount
  useEffect(() => {
    const checkActive = async () => {
      try {
        const ride = await fetchActiveRide()
        if (ride) {
          toast.success('Resuming your active ride')
          if (ride.status === 'COMPLETED' || ride.status === 'FAILED') {
            // Need payment
            navigate(`/payment/${ride.id}`)
          } else {
            navigate(`/tracking/${ride.id}`)
          }
        }
      } catch (err) {
        console.error('Error fetching active ride:', err)
      } finally {
        setLoadingActiveRide(false)
      }
    }
    checkActive()
  }, [fetchActiveRide, navigate])

  // Set default pickup to current location
  useEffect(() => {
    if (!pickupLocation) {
      // Set to Koramangala by default
      setPickupLocation({
        address: 'Sony World Junction, Koramangala, Bengaluru',
        lat: 12.9352,
        lng: 77.6245
      })
    }
  }, [pickupLocation, setPickupLocation])

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setMapCenter(loc)
          
          // Geocode or set mock address
          setPickupLocation({
            address: 'My Current Location',
            lat: loc.lat,
            lng: loc.lng
          })
          toast.success('Updated current location')
        },
        () => {
          toast.error('Unable to fetch GPS. Using default location.')
        }
      )
    }
  }

  // Handle address searches (mock-supported search)
  const handleSearch = (val) => {
    setSearchQuery(val)
    if (!val.trim()) {
      setSearchResults([])
      return
    }

    // Filter presets or simulate standard geocoding
    const matches = presets.filter(p => 
      p.name.toLowerCase().includes(val.toLowerCase()) || 
      p.address.toLowerCase().includes(val.toLowerCase())
    )
    
    // Add custom typed search if no matches
    if (matches.length === 0) {
      setSearchResults([{
        name: val,
        address: `${val}, Bengaluru, Karnataka`,
        lat: 12.9716 + (Math.random() - 0.5) * 0.05,
        lng: 77.5946 + (Math.random() - 0.5) * 0.05,
        isCustom: true
      }])
    } else {
      setSearchResults(matches)
    }
  }

  const handleSelectLocation = (loc) => {
    if (isPickingDropoff) {
      setDropoffLocation({
        address: loc.name || loc.address,
        lat: loc.lat,
        lng: loc.lng
      })
      toast.success('Dropoff selected!')
      setIsPickingDropoff(false)
      setSearchQuery('')
      setSearchResults([])
      // Proceed to booking screen
      navigate('/book')
    } else {
      setPickupLocation({
        address: loc.name || loc.address,
        lat: loc.lat,
        lng: loc.lng
      })
      setMapCenter({ lat: loc.lat, lng: loc.lng })
      toast.success('Pickup updated!')
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const handleLogout = () => {
    logout()
    clearBookingState()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} className="fade-in">
      
      {/* Map Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={14}
            options={defaultOptions}
            onLoad={(map) => { mapRef.current = map }}
          >
            {pickupLocation && (
              <Marker 
                position={{ lat: pickupLocation.lat, lng: pickupLocation.lng }} 
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  scaledSize: new window.google.maps.Size(40, 40)
                }}
              />
            )}
            {dropoffLocation && (
              <Marker 
                position={{ lat: dropoffLocation.lat, lng: dropoffLocation.lng }} 
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  scaledSize: new window.google.maps.Size(40, 40)
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={{ 
            height: '100%', 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#F1F5F9' 
          }}>
            <div className="flex flex-col items-center gap-3">
              <div className="spinner"></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Loading Map Engine...</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Header UI */}
      <div style={{ 
        position: 'absolute', 
        top: 0, left: 0, right: 0, 
        padding: '16px', 
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }} className="safe-top">
        {/* Drawer Trigger */}
        <button 
          onClick={() => setDrawerOpen(true)}
          style={{
            width: '48px', height: '48px',
            borderRadius: '50%',
            border: 'none',
            background: 'white',
            boxShadow: 'var(--shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Menu size={22} color="var(--text-primary)" />
        </button>

        {/* Branding Logo */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          padding: '6px 14px',
          borderRadius: '20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '38px'
        }}>
          <img src="/volzo-logo.svg" alt="Volzo Logo" style={{ height: '24px', objectFit: 'contain' }} />
        </div>

        {/* Notifications Icon */}
        <button 
          style={{
            width: '48px', height: '48px',
            borderRadius: '50%',
            border: 'none',
            background: 'white',
            boxShadow: 'var(--shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Bell size={22} color="var(--text-primary)" />
        </button>
      </div>

      {/* Floating GPS Target Icon */}
      <button
        onClick={handleGetCurrentLocation}
        style={{
          position: 'absolute',
          bottom: isPickingDropoff ? '380px' : '260px',
          right: '16px',
          width: '52px', height: '52px',
          borderRadius: '50%',
          border: 'none',
          background: 'white',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 5,
          transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <Navigation size={22} color="var(--primary)" />
      </button>

      {/* Sliding Destination Card / Bottom Sheet */}
      <div 
        className="bottom-sheet slide-up"
        style={{ 
          padding: '24px 20px', 
          zIndex: 90, 
          maxHeight: isPickingDropoff ? '90vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Handle bar */}
        <div style={{ width: '40px', height: '5px', background: '#E2E8F0', borderRadius: '99px', margin: '0 auto', marginBottom: '8px' }}></div>

        {/* Mode Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
            {isPickingDropoff ? 'Enter Dropoff Destination' : 'Select Ride Locations'}
          </h3>
          {isPickingDropoff && (
            <button 
              onClick={() => { setIsPickingDropoff(false); setSearchQuery(''); setSearchResults([]); }}
              style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Address Inputs Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Pickup Address Box */}
          <div 
            onClick={() => { setIsPickingDropoff(false); setSearchQuery(''); }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 14px', 
              background: !isPickingDropoff ? '#EFF6FF' : '#F8FAFC',
              border: !isPickingDropoff ? '1.5px solid var(--primary)' : '1.5px solid transparent',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            <MapPin size={20} color="var(--primary)" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'block' }}>PICKUP LOCATION</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', overflow: 'hidden' }}>
                {pickupLocation?.address || 'Locating you...'}
              </span>
            </div>
          </div>

          {/* Search box or Dropoff Selector */}
          {isPickingDropoff ? (
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                placeholder="Where to? Enter location..."
                className="input"
                style={{ paddingLeft: '44px' }}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div 
              onClick={() => { setIsPickingDropoff(true); setSearchQuery(''); }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '14px', 
                background: '#F1F5F9',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              <Search size={20} color="var(--text-secondary)" />
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                {dropoffLocation?.address || 'Where to? Enter destination...'}
              </span>
            </div>
          )}
        </div>

        {/* Location presets or results */}
        {isPickingDropoff && (
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {searchResults.length > 0 ? (
              searchResults.map((res, i) => (
                <div 
                  key={i} 
                  onClick={() => handleSelectLocation(res)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px 6px', 
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer'
                  }}
                >
                  <MapPin size={18} color="var(--text-secondary)" />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{res.name}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{res.address}</p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', margin: '8px 0 4px' }}>POPULAR DESTINATIONS</p>
                {presets.map((preset, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSelectLocation(preset)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '12px 6px', 
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer'
                    }}
                  >
                    <MapPin size={18} color="var(--primary)" />
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{preset.name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{preset.address}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Go to Booking Button */}
        {!isPickingDropoff && dropoffLocation && (
          <button 
            onClick={() => navigate('/book')}
            className="btn btn-primary btn-full"
            style={{ display: 'flex', gap: '8px' }}
          >
            Review Fare Estimates <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* Slide-out Sidebar Drawer */}
      {drawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex'
        }}>
          {/* Navigation panel */}
          <div style={{
            width: '280px',
            background: 'white',
            height: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Header Profile */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #0088FF 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 'bold', fontSize: '18px'
                  }}>
                    {user?.name ? user.name[0].toUpperCase() : 'R'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{user?.name || 'Volzo Rider'}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.phoneNumber}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => { setDrawerOpen(false); navigate('/profile'); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 14px', borderRadius: '12px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                    width: '100%', color: 'var(--text-primary)', textAlign: 'left'
                  }}
                  className="btn-secondary"
                >
                  <User size={20} /> View Profile
                </button>

                <button 
                  onClick={() => { setDrawerOpen(false); navigate('/history'); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 14px', borderRadius: '12px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                    width: '100%', color: 'var(--text-primary)', textAlign: 'left'
                  }}
                  className="btn-secondary"
                >
                  <History size={20} /> Ride History
                </button>
              </div>
            </div>

            {/* Logout button */}
            <button 
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px 14px', borderRadius: '12px', border: 'none',
                background: '#FEF2F2', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                width: '100%', color: 'var(--danger)', textAlign: 'left'
              }}
            >
              <LogOut size={20} /> Log Out
            </button>
          </div>

          {/* Tap-to-dismiss space */}
          <div style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}></div>
        </div>
      )}

      {/* Safe Area Top Buffer */}
      {loadingActiveRide && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.9)',
          zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px'
        }}>
          <div className="spinner"></div>
          <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Synchronizing profile...</span>
        </div>
      )}

    </div>
  )
}
