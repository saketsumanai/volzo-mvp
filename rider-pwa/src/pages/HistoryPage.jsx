import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRideHistory, getErrMsg } from '../services/api'
import { ArrowLeft, Calendar, MapPin, Bike, Users, Car, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [rides, setRides] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await getRideHistory(1)
        if (res.data?.success && res.data.data.rides) {
          setRides(res.data.data.rides)
        }
      } catch (err) {
        toast.error('Failed to load ride history')
      } finally {
        setIsLoading(false)
      }
    }
    loadHistory()
  }, [])

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'SCOOTER': return <Bike size={18} color="var(--primary)" />
      case 'RICKSHAW_SHARED': return <Users size={18} color="#00D9FF" />
      case 'RICKSHAW_PRIVATE': return <Car size={18} color="#0052CC" />
      default: return <Bike size={18} />
    }
  };

  const getVehicleLabel = (type) => {
    switch (type) {
      case 'SCOOTER': return 'Scooter'
      case 'RICKSHAW_SHARED': return 'Shared Rickshaw'
      case 'RICKSHAW_PRIVATE': return 'Private Rickshaw'
      default: return 'Ride'
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateStr
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
      
      {/* Header */}
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
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Ride History</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>List of your past bookings</p>
        </div>
      </div>

      {/* History scrollable list */}
      <div className="scroll-y" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner"></div>
          </div>
        ) : rides.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Calendar size={48} color="var(--text-muted)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>No Rides Yet</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: '20px' }}>
              Your past bookings will appear here once you take your first Volzo ride!
            </p>
            <button 
              onClick={() => navigate('/home')}
              className="btn btn-primary"
              style={{ marginTop: '12px', padding: '10px 24px', fontSize: '14px' }}
            >
              Book a Ride Now
            </button>
          </div>
        ) : (
          rides.map((ride) => (
            <div 
              key={ride.id}
              style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Header details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {getVehicleIcon(ride.rideType)}
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>
                    Volzo {getVehicleLabel(ride.rideType)}
                  </span>
                </div>
                <span className={`badge ${ride.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
                  {ride.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                <span>{ride.rideNumber}</span>
                <span>{formatDate(ride.createdAt)}</span>
              </div>

              <div style={{ height: '1px', background: '#F1F5F9' }}></div>

              {/* Pickup & Drop Addresses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <MapPin size={14} color="var(--primary)" />
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ride.pickupLocation?.address}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <MapPin size={14} color="var(--danger)" />
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ride.dropoffLocation?.address}
                  </span>
                </div>
              </div>

              {/* Pricing detail */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Amount Paid</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  ₹{ride.finalFare || ride.estimatedFare}
                </span>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  )
}
