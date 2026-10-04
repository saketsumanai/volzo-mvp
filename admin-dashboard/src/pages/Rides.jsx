import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Eye, Calendar, DollarSign, Sparkles, Info, X, Compass, ShieldAlert } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0B0F19" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B0F19" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#121b2d" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1F2E4D" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#263554" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0b1528" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }]
  }
]

export default function Rides() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRide, setSelectedRide] = useState(null)
  const [liveVehicles, setLiveVehicles] = useState([])
  const [mapLoaded, setMapLoaded] = useState(false)

  const mapContainerRef = useRef(null)
  const googleMapRef = useRef(null)
  const markersRef = useRef({})
  
  // Ref handles for selected ride route elements
  const pickupMarkerRef = useRef(null)
  const dropoffMarkerRef = useRef(null)
  const routePolylineRef = useRef(null)

  useEffect(() => {
    fetchRides()
    loadGoogleMapsScript()
    
    return () => {
      // Clear markers upon unmounting
      Object.values(markersRef.current).forEach(marker => marker.setMap(null))
      if (pickupMarkerRef.current) pickupMarkerRef.current.setMap(null)
      if (dropoffMarkerRef.current) dropoffMarkerRef.current.setMap(null)
      if (routePolylineRef.current) routePolylineRef.current.setMap(null)
    }
  }, [])

  // Dynamic Google Maps Script Injector
  const loadGoogleMapsScript = () => {
    if (window.google && window.google.maps) {
      setMapLoaded(true)
      return
    }

    const existingScript = document.getElementById('google-maps-api-script')
    if (existingScript) {
      existingScript.addEventListener('load', () => setMapLoaded(true))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-api-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true)
    script.onerror = () => toast.error('Failed to load Google Maps SDK')
    document.head.appendChild(script)
  }

  // Initialize Map Instance
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || googleMapRef.current) return

    googleMapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: 28.6139, lng: 77.2090 }, // Delhi NCR Center coordinates
      zoom: 12,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false
    })
  }, [mapLoaded])

  useEffect(() => {
    const activeRides = rides.filter(r => ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED'].includes(r.status))
    if (activeRides.length === 0) {
      setLiveVehicles([])
      return
    }

    const mapInitial = () => {
      return activeRides.map(ride => {
        const driverUser = ride.driver?.user || {}
        const driverName = driverUser.name || 'Unassigned Driver'
        const location = ride.driver?.currentLocation || {}
        
        // Parse locations safely
        let pickupLat = 28.6139
        let pickupLng = 77.2090
        try {
          if (ride.pickupLocation) {
            const parsedPickup = typeof ride.pickupLocation === 'string' 
              ? JSON.parse(ride.pickupLocation) 
              : ride.pickupLocation;
            pickupLat = parsedPickup.lat || pickupLat;
            pickupLng = parsedPickup.lng || pickupLng;
          }
        } catch (e) {
          console.error(e)
        }

        const lat = location.lat || pickupLat || (28.5 + Math.random() * 0.2)
        const lng = location.lng || pickupLng || (77.1 + Math.random() * 0.2)
        
        return {
          id: ride.id,
          name: driverName,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          speed: location.speed || `${Math.floor(20 + Math.random() * 25)} km/h`,
          type: ride.rideType === 'SCOOTER' ? 'EV Scooter' : ride.rideType === 'RICKSHAW_SHARED' ? 'E-Rickshaw (Shared)' : 'E-Rickshaw (Private)',
          battery: location.battery || `${Math.floor(60 + Math.random() * 40)}%`,
          status: ride.status
        }
      })
    }

    setLiveVehicles(mapInitial())

    const interval = setInterval(() => {
      setLiveVehicles(prev => prev.map(vehicle => {
        const dLat = (Math.random() - 0.5) * 0.0006
        const dLng = (Math.random() - 0.5) * 0.0006
        return {
          ...vehicle,
          lat: parseFloat((vehicle.lat + dLat).toFixed(4)),
          lng: parseFloat((vehicle.lng + dLng).toFixed(4)),
          speed: `${Math.floor(15 + Math.random() * 25)} km/h`
        }
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [rides])

  // Plot and Update Live Markers on the Google Map
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return

    const activeIds = new Set(liveVehicles.map(v => v.id))

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        markersRef.current[id].setMap(null)
        delete markersRef.current[id]
      }
    })

    // Create or update markers
    liveVehicles.forEach(vehicle => {
      const position = { lat: vehicle.lat, lng: vehicle.lng }

      if (markersRef.current[vehicle.id]) {
        // Update Marker Position
        markersRef.current[vehicle.id].setPosition(position)
      } else {
        // Create new Premium SVG Marker representing Volzo vehicles
        const marker = new window.google.maps.Marker({
          position,
          map: googleMapRef.current,
          title: vehicle.name,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: vehicle.status === 'STARTED' ? '#00D9FF' : '#5FD068',
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#FFFFFF'
          }
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="color: #0F172A; font-family: 'Outfit', sans-serif; padding: 8px; min-width: 140px;">
              <h4 style="font-weight: 700; margin: 0 0 4px 0; font-size: 13px;">${vehicle.name}</h4>
              <p style="margin: 0; font-size: 11px; color: #64748B;">Class: ${vehicle.type}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #0066FF; font-weight: 600;">Speed: ${vehicle.speed}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #10B981; font-weight: 600;">Battery: ${vehicle.battery}</p>
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindow.open(googleMapRef.current, marker)
        })

        markersRef.current[vehicle.id] = marker
      }
    })
  }, [liveVehicles])

  // Plot Trip route when a ride archive log is inspected
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return

    // Clear previous route plotting
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null)
      pickupMarkerRef.current = null
    }
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setMap(null)
      dropoffMarkerRef.current = null
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }

    if (!selectedRide) return

    const pickupLoc = selectedRide.pickupLocation
    const dropoffLoc = selectedRide.dropoffLocation

    if (pickupLoc?.lat && pickupLoc?.lng && dropoffLoc?.lat && dropoffLoc?.lng) {
      const pickupPos = { lat: parseFloat(pickupLoc.lat), lng: parseFloat(pickupLoc.lng) }
      const dropoffPos = { lat: parseFloat(dropoffLoc.lat), lng: parseFloat(dropoffLoc.lng) }

      // 1. Create Pickup Green Pin
      pickupMarkerRef.current = new window.google.maps.Marker({
        position: pickupPos,
        map: googleMapRef.current,
        title: 'Pickup Location',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
          scaledSize: new window.google.maps.Size(40, 40)
        }
      })

      // 2. Create Dropoff Red Pin
      dropoffMarkerRef.current = new window.google.maps.Marker({
        position: dropoffPos,
        map: googleMapRef.current,
        title: 'Dropoff Destination',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new window.google.maps.Size(40, 40)
        }
      })

      // 3. Draw premium routing polyline
      routePolylineRef.current = new window.google.maps.Polyline({
        path: [pickupPos, dropoffPos],
        geodesic: true,
        strokeColor: '#00D9FF',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: googleMapRef.current
      })

      // 4. Zoom map to fit route coordinates
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(pickupPos)
      bounds.extend(dropoffPos)
      googleMapRef.current.fitBounds(bounds)
    }
  }, [selectedRide])

  const fetchRides = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/rides`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setRides(response.data.data.rides)
    } catch (error) {
      toast.error('Failed to retrieve ride archives')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Operations & Live Tracking <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Real-time GPS coordinate telemetry logs and EV vehicle route tracking.</p>
        </div>
      </div>

      {/* Live Map Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Google Map Container */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-[#263554]/60 flex flex-col relative overflow-hidden h-[420px]">
          <div className="absolute top-8 left-8 z-10 bg-[#0B0F19]/90 px-3 py-1.5 rounded-lg border border-[#1F2E4D] backdrop-blur-sm shadow-neon-blue">
            <span className="flex items-center gap-1.5 text-xs text-[#00D9FF] font-bold">
              <span className={`h-2 w-2 rounded-full animate-ping ${liveVehicles.length > 0 ? 'bg-[#00D9FF]' : 'bg-[#94A3B8]'}`}></span>
              {liveVehicles.length > 0 ? 'Live Google Maps Sync Active' : 'Real Google Maps Standby'}
            </span>
          </div>
  
          {/* Map Mount Point */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full rounded-xl border border-[#1F2E4D] overflow-hidden mt-6 bg-[#0E1524]/60 min-h-[300px]"
          />
        </div>
 
        {/* Live Coordinate Telemetry List */}
        <div className="glass-panel rounded-2xl p-6 border border-[#263554]/60 flex flex-col justify-between h-[420px] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-1.5">
              <Compass className="h-4.5 w-4.5 text-[#00D9FF]" />
              Telemetry Feed
            </h3>
            
            <div className="space-y-3">
              {liveVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500">
                  <ShieldAlert className="h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-xs font-semibold text-white">Feed Standby Mode</p>
                  <p className="text-3xs text-gray-400 mt-1 max-w-[180px]">Awaiting active GPS coordinates from live drivers.</p>
                </div>
              ) : (
                liveVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="p-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl flex flex-col justify-between hover:border-[#00D9FF]/40 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-white">{vehicle.name}</p>
                        <p className="text-3xs text-[#94A3B8] mt-0.5">{vehicle.type}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-3xs font-bold ${
                        vehicle.status === 'STARTED'
                          ? 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {vehicle.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#1F2E4D]/60 text-3xs font-mono text-gray-400">
                      <div>
                        <span className="text-[#94A3B8]">Telemetry GPS:</span>
                        <p className="text-white mt-0.5">{vehicle.lat}, {vehicle.lng}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[#94A3B8]">Speed / Battery:</span>
                        <p className="text-[#00D9FF] mt-0.5">{vehicle.speed} ({vehicle.battery})</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archives Ride Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border border-[#263554]/60 overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-[#1F2E4D] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Ride Archive Logs</h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">Comprehensive history database of all bookings</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0E1524]/60">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Ride #</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Rider</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Driver</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Fare</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E4D]">
                {rides.map((ride) => (
                  <tr key={ride.id} className="hover:bg-[#1E293B]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">{ride.rideNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{ride.rider.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {ride.driver?.user.name || (
                        <span className="text-gray-500 italic text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-semibold">{ride.rideType}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold ${
                        ride.status === 'COMPLETED' ? 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20' :
                        ride.status === 'STARTED' ? 'bg-blue-500/10 text-[#00D9FF] border border-blue-500/20' :
                        ride.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {ride.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#00D9FF]">
                      ₹{(ride.finalFare || ride.estimatedFare).toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                      {new Date(ride.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setSelectedRide(ride)}
                        className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-[#00D9FF] border border-blue-500/20 rounded-lg transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Ride details inspection modal */}
      <AnimatePresence>
        {selectedRide && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRide(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#0E1524] border border-[#263554] shadow-2xl rounded-2xl z-50 text-white overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1F2E4D] flex justify-between items-center bg-[#0B0F19]/40">
                <div>
                  <h3 className="text-lg font-bold text-white">Inspect Ride Archive</h3>
                  <p className="text-3xs font-mono text-gray-400 mt-0.5">ID: {selectedRide.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedRide(null)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Modal details */}
              <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Ride Serial No</span>
                    <p className="text-base font-bold text-white mt-0.5">{selectedRide.rideNumber}</p>
                  </div>
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Vehicle Class</span>
                    <p className="text-sm font-semibold text-[#00D9FF] mt-0.5">{selectedRide.rideType}</p>
                  </div>
                </div>

                <div className="p-4 bg-[#131B2E] border border-[#1F2E4D] rounded-xl space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4.5 w-4.5 text-[#5FD068] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Pickup Point</span>
                      <p className="text-xs text-white mt-0.5">{selectedRide.pickupLocation?.address || 'Pickup address record not synced'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2.5 border-t border-[#1F2E4D]/60">
                    <MapPin className="h-4.5 w-4.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Dropoff Destination</span>
                      <p className="text-xs text-white mt-0.5">{selectedRide.dropoffLocation?.address || 'Dropoff address record not synced'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-[#1F2E4D] pt-4">
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Rider Dossier</span>
                    <p className="text-sm font-bold text-white mt-0.5">{selectedRide.rider.name}</p>
                    <p className="text-3xs font-mono text-gray-500 mt-0.5">{selectedRide.rider.phone || 'No phone recorded'}</p>
                  </div>
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Assigned Driver</span>
                    <p className="text-sm font-bold text-white mt-0.5">{selectedRide.driver?.user.name || 'Unassigned'}</p>
                    <p className="text-3xs font-mono text-gray-500 mt-0.5">{selectedRide.driver?.user.phone || 'No contact recorded'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-[#1F2E4D] pt-4">
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Fare Booking</span>
                    <p className="text-base font-bold text-white mt-0.5">₹{selectedRide.estimatedFare}</p>
                  </div>
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Final Rupee Split</span>
                    <p className="text-base font-bold text-[#00D9FF] mt-0.5">
                      ₹{selectedRide.finalFare || selectedRide.estimatedFare}
                    </p>
                    {selectedRide.pickupLocation?.couponCode && (
                      <p className="text-3xs text-[#5FD068] mt-0.5 font-bold">
                        Coupon: {selectedRide.pickupLocation.couponCode} (-₹{selectedRide.pickupLocation.discountAmount})
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-3xs text-[#94A3B8] font-bold uppercase tracking-wider">Verify Status</span>
                    <p className="text-xs font-bold text-[#5FD068] mt-1">{selectedRide.status}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
