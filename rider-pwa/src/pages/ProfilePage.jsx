import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, getErrMsg } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft, User, Mail, Phone, Edit3, Save, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { setAuth, logout } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const res = await getProfile()
        if (res.data?.success && res.data.data.user) {
          const u = res.data.data.user
          setName(u.name || '')
          setEmail(u.email || '')
          setPhone(u.phoneNumber || '')
          
          // update authStore user just in case
          const token = localStorage.getItem('rider_token')
          setAuth(u, token)
        }
      } catch (err) {
        toast.error('Failed to sync profile information')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchLatestProfile()
  }, [setAuth])

  const handleSaveProfile = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Name cannot be empty')
      return
    }

    setIsSaving(true)
    toast.loading('Saving details...', { id: 'profile' })

    try {
      const res = await updateProfile({
        name: name.trim(),
        email: email.trim() || null
      })

      if (res.data?.success && res.data.data.user) {
        const updatedUser = res.data.data.user
        const token = localStorage.getItem('rider_token')
        setAuth(updatedUser, token)
        
        toast.success('Profile updated successfully!', { id: 'profile' })
        setIsEditing(false)
      } else {
        toast.error('Failed to update details', { id: 'profile' })
      }
    } catch (err) {
      toast.error(getErrMsg(err), { id: 'profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner"></div>
      </div>
    )
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
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>My Profile</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage your personal account</p>
        </div>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            style={{
              background: '#EFF6FF',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              color: 'var(--primary)',
              fontWeight: '700',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Edit3 size={14} /> Edit
          </button>
        )}
      </div>

      {/* Scrollable form body */}
      <div className="scroll-y" style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Profile Avatar Card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '8px 0 16px' }}>
          <div style={{
            width: '84px', height: '84px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary) 0%, #0088FF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '900', fontSize: '32px',
            boxShadow: 'var(--shadow)'
          }}>
            {name ? name[0].toUpperCase() : 'R'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{name || 'Volzo Rider'}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Registered Rider</p>
          </div>
        </div>

        {/* Inputs list */}
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                className="input"
                style={{ paddingLeft: '44px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing || isSaving}
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-secondary)' }} />
              <input 
                type="email"
                className="input"
                style={{ paddingLeft: '44px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing || isSaving}
                placeholder="name@example.com"
              />
            </div>
          </div>

          {/* Phone (READ ONLY) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Registered Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="input"
                style={{ paddingLeft: '44px', color: 'var(--text-secondary)', background: '#F1F5F9', cursor: 'not-allowed' }}
                value={phone}
                readOnly
              />
            </div>
          </div>

          {/* Action Save button when editing */}
          {isEditing && (
            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '16px' }}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}></div>
              ) : (
                <>
                  <Save size={18} /> Save Changes
                </>
              )}
            </button>
          )}

        </form>

        {/* Logout Section */}
        {!isEditing && (
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px 16px', borderRadius: '12px', border: 'none',
              background: '#FEF2F2', cursor: 'pointer', fontSize: '15px', fontWeight: '700',
              color: 'var(--danger)', width: '100%', marginTop: '16px'
            }}
          >
            <LogOut size={18} /> Log Out
          </button>
        )}

      </div>

    </div>
  )
}
