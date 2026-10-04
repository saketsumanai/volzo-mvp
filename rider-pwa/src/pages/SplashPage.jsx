import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../services/api'
import { connectSocket } from '../services/socket'

export default function SplashPage() {
  const navigate = useNavigate()
  const { setAuth, logout, token } = useAuthStore()

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTimeout(() => navigate('/login'), 1200)
        return
      }

      try {
        const res = await getMe()
        if (res.data?.success && res.data.data.user) {
          setAuth(res.data.data.user, token)
          connectSocket(token)
          setTimeout(() => navigate('/home'), 1000)
        } else {
          logout()
          setTimeout(() => navigate('/login'), 1000)
        }
      } catch (err) {
        console.error('Splash token verification failed:', err)
        logout()
        setTimeout(() => navigate('/login'), 1000)
      }
    }

    verifyToken()
  }, [token, navigate, setAuth, logout])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      background: '#FFFFFF',
      padding: '24px'
    }} className="fade-in">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {/* Volzo SVG Logo */}
        <div style={{
          width: '240px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img src="/volzo_logo.png" alt="Volzo Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <p style={{ color: '#64748B', fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }}>
          EV MOBILITY FOR EVERYONE
        </p>

        <div className="spinner" style={{ marginTop: '32px' }}></div>
      </div>
    </div>
  )
}
