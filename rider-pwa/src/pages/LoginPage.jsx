import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Phone, User, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSendOtp = (e) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter your name')
      return
    }

    // Match 10 digit Indian number
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number')
      return
    }

    setIsLoading(true)
    
    // Simulate sending OTP
    setTimeout(() => {
      setIsLoading(false)
      toast.success('OTP sent successfully (Simulated)')
      // Pass states to the OTP page
      navigate('/otp', { state: { phoneNumber: `+91${cleanPhone}`, name: name.trim() } })
    }, 800)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--surface)',
      padding: '24px',
      justifyContent: 'space-between',
      overflow: 'hidden'
    }} className="fade-in">
      
      {/* Top branding */}
      <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          width: '180px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <img src="/volzo-logo.svg" alt="Volzo Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Welcome to Volzo</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Enter your details to get moving</p>
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: 'auto 0' }}>
        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Full Name</label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '16px', top: '18px', color: 'var(--text-secondary)' }} />
            <input 
              type="text"
              placeholder="e.g. Saket Suman"
              className="input"
              style={{ paddingLeft: '48px' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Phone input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Phone Number</label>
          <div style={{ position: 'relative' }}>
            <span style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '16px', 
              fontWeight: '600', 
              fontSize: '15px',
              color: 'var(--text-primary)'
            }}>+91</span>
            <Phone size={18} style={{ position: 'absolute', left: '54px', top: '18px', color: 'var(--text-secondary)' }} />
            <input 
              type="tel"
              maxLength="10"
              placeholder="98765 43210"
              className="input"
              style={{ paddingLeft: '84px', fontWeight: '600' }}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary btn-full"
          style={{ marginTop: '12px' }}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}></div>
          ) : (
            <>
              Continue <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '18px' }}>
          By continuing, you agree to Volzo's Terms of Service and Privacy Policy.
        </p>
      </div>

    </div>
  )
}
