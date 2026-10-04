import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { loginWithPhone, getErrMsg } from '../services/api'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)

  // Retrieve details passed from LoginPage
  const { phoneNumber, name } = location.state || { phoneNumber: '+919999999999', name: 'Volzo Rider' }

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(30)
  const [isLoading, setIsLoading] = useState(false)
  const inputRefs = useRef([])

  // Resend Countdown
  useEffect(() => {
    let interval = null
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (index, value) => {
    if (isNaN(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.substring(value.length - 1)
    setOtp(newOtp)

    // Automatically focus next if filled
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }

    // Trigger submit if all digits are entered
    if (newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
      } else {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    }
  }

  const handleVerify = async (otpCode) => {
    setIsLoading(true)
    const mockIdToken = `mock_otp_verified_token_${otpCode}_${Date.now()}`

    try {
      const res = await loginWithPhone(mockIdToken, phoneNumber, name)
      if (res.data?.success && res.data.data) {
        const { user, token } = res.data.data
        setAuth(user, token)
        toast.success(`Welcome ${user.name || 'Rider'}!`)
        navigate('/home')
      } else {
        toast.error('Failed to log in')
      }
    } catch (err) {
      console.error(err)
      toast.error(getErrMsg(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = () => {
    setTimer(30)
    setOtp(['', '', '', '', '', ''])
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
    toast.success('New OTP sent successfully! (Simulated)')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--surface)',
      padding: '24px',
      overflow: 'hidden'
    }} className="fade-in">

      {/* Back button */}
      <div style={{ marginTop: '24px' }}>
        <button 
          onClick={() => navigate('/login')}
          style={{
            border: 'none',
            background: '#F1F5F9',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={20} color="var(--text-primary)" />
        </button>
      </div>

      {/* Header Info */}
      <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Verify Details</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          We sent a 6-digit OTP code to <strong style={{ color: 'var(--text-primary)' }}>{phoneNumber}</strong>
        </p>
      </div>

      {/* OTP inputs container */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        gap: '8px', 
        marginTop: '48px', 
        marginBottom: '24px' 
      }}>
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="tel"
            maxLength="1"
            className="otp-input"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
        ))}
      </div>

      {/* Resend details */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        {timer > 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Resend OTP in <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{timer}s</span>
          </p>
        ) : (
          <button
            onClick={handleResend}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Resend OTP Code
          </button>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="spinner"></div>
        </div>
      )}

    </div>
  )
}
