import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRideStore } from '../store/rideStore'
import { 
  ArrowLeft, MapPin, Navigation2, Ticket, Users, 
  Bike, Car, Zap, Check, ChevronRight 
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function BookRidePage() {
  const navigate = useNavigate()
  const { 
    pickupLocation, 
    dropoffLocation, 
    rideType, 
    setRideType,
    seatsBooked, 
    setSeatsBooked,
    estimatedDistance, 
    estimatedDuration,
    fareEstimates, 
    calculateFares, 
    createRide, 
    isLoading,
    error 
  } = useRideStore()

  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)

  // Redirect if no locations chosen
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      toast.error('Please select pickup and dropoff first')
      navigate('/home')
      return
    }
    calculateFares()
  }, [pickupLocation, dropoffLocation, calculateFares, navigate])

  // Re-calculate fares if seat count changes for shared rides
  const handleSeatChange = (seats) => {
    setSeatsBooked(seats)
    setTimeout(() => calculateFares(), 50)
  }

  const handleApplyCoupon = (e) => {
    e.preventDefault()
    if (!coupon.trim()) return

    const code = coupon.trim().toUpperCase()
    if (code === 'WELCOME50' || code === 'VOLZOFREE') {
      setCouponApplied(true)
      setDiscountAmount(code === 'VOLZOFREE' ? 100 : 50)
      toast.success(`Coupon ${code} applied successfully!`)
    } else {
      toast.error('Invalid coupon code')
    }
  }

  const handleConfirmBooking = async () => {
    toast.loading('Finding available drivers...', { id: 'booking' })
    const ride = await createRide(couponApplied ? coupon.toUpperCase() : null)
    
    if (ride) {
      toast.success('Ride requested successfully!', { id: 'booking' })
      navigate(`/tracking/${ride.id}`)
    } else {
      toast.error(error || 'Failed to request ride. Please try again.', { id: 'booking' })
    }
  }

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'SCOOTER': return <Bike size={24} color="var(--primary)" />
      case 'RICKSHAW_SHARED': return <Users size={24} color="#00D9FF" />
      case 'RICKSHAW_PRIVATE': return <Car size={24} color="#0052CC" />
      default: return <Zap size={24} />
    }
  }

  const getVehicleLabel = (type) => {
    switch (type) {
      case 'SCOOTER': return 'Volzo Scooter'
      case 'RICKSHAW_SHARED': return 'Shared Rickshaw'
      case 'RICKSHAW_PRIVATE': return 'Private Rickshaw'
      default: return 'Volzo Ride'
    }
  }

  const getVehicleDesc = (type) => {
    switch (type) {
      case 'SCOOTER': return 'Quickest solo travel'
      case 'RICKSHAW_SHARED': return 'Eco-friendly, split cost'
      case 'RICKSHAW_PRIVATE': return 'Spacious private ride'
      default: return ''
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--bg)',
      overflow: 'hidden'
    }} className="fade-in">
      
      {/* Premium Header */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }} className="safe-top">
        <button 
          onClick={() => navigate('/home')}
          style={{ border: 'none', background: '#F1F5F9', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Confirm Booking</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Distance: {estimatedDistance} km • {estimatedDuration} mins</p>
        </div>
      </div>

      {/* Booking Scrollable Body */}
      <div className="scroll-y" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Route Card */}
        <div style={{ padding: '16px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Pickup info */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', marginTop: '4px' }}></div>
              <div style={{ width: '2px', height: '24px', background: 'var(--border)' }}></div>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>PICKUP</span>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pickupLocation?.address}
              </p>
            </div>
          </div>

          {/* Dropoff info */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)', marginTop: '4px' }}></div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>DROP</span>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {dropoffLocation?.address}
              </p>
            </div>
          </div>
        </div>

        {/* Vehicle Selection Header */}
        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '4px 0 -4px' }}>CHOOSE VEHICLE TYPE</h3>

        {/* Vehicle estimates listing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['SCOOTER', 'RICKSHAW_SHARED', 'RICKSHAW_PRIVATE'].map((type) => {
            const isSelected = rideType === type
            let fare = fareEstimates ? fareEstimates[type] : null
            if (fare && type === 'RICKSHAW_SHARED') {
              // fare is already updated in calculateFares based on seats
            }
            if (fare && couponApplied) {
              fare = Math.max(0, fare - discountAmount)
            }

            return (
              <div 
                key={type}
                onClick={() => setRideType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: isSelected ? 'linear-gradient(135deg, rgba(0,102,255,0.04) 0%, rgba(0,136,255,0.02) 100%)' : 'white',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '12px',
                    background: isSelected ? '#EFF6FF' : '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {getVehicleIcon(type)}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {getVehicleLabel(type)}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {getVehicleDesc(type)}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {fare !== null ? (
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      ₹{fare}
                    </span>
                  ) : (
                    <div className="animate-pulse" style={{ width: '40px', height: '18px', background: '#E2E8F0', borderRadius: '4px' }}></div>
                  )}
                  {type === 'RICKSHAW_SHARED' && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>per seat</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Shared ride seat picker */}
        {rideType === 'RICKSHAW_SHARED' && (
          <div style={{ 
            padding: '16px', 
            background: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'fadeIn 0.2s'
          }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Number of Seats</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Book up to 3 seats in shared mode</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => handleSeatChange(num)}
                  style={{
                    width: '36px', height: '36px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: seatsBooked === num ? 'var(--primary)' : '#F1F5F9',
                    color: seatsBooked === num ? 'white' : 'var(--text-primary)'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Coupon Card */}
        <div style={{ padding: '16px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
              <Ticket size={20} color="var(--primary)" />
              <span style={{ fontSize: '14px', fontWeight: '700' }}>Apply Discount Coupon</span>
            </div>
            {couponApplied && (
              <span className="badge badge-success">
                Applied
              </span>
            )}
          </div>

          <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text"
              placeholder="e.g. WELCOME50"
              className="input"
              style={{ padding: '10px 14px', fontSize: '14px', textTransform: 'uppercase' }}
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              disabled={couponApplied}
            />
            <button 
              type="submit" 
              className="btn btn-secondary" 
              style={{ padding: '10px 18px', fontSize: '14px' }}
              disabled={couponApplied}
            >
              Apply
            </button>
          </form>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Use code <strong style={{ color: 'var(--primary)' }}>WELCOME50</strong> to get ₹50 off.
          </span>
        </div>

      </div>

      {/* Bottom Action Footer */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)'
      }} className="safe-bottom">
        <button
          onClick={handleConfirmBooking}
          className="btn btn-primary btn-full"
          disabled={isLoading || !fareEstimates}
        >
          {isLoading ? (
            <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}></div>
          ) : (
            `Book ${getVehicleLabel(rideType)}`
          )}
        </button>
      </div>

    </div>
  )
}
