import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Shield, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react'
import { auth, googleProvider, signInWithPopup } from '../config/firebase'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('direct') // 'direct' or 'google'
  
  // Direct login credentials
  const [email, setEmail] = useState('admin@volzo.com')
  const [password, setPassword] = useState('admin123')

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      
      // Request an admin token exchange from our local backend endpoint
      const response = await axios.post(`${API_URL}/auth/admin-login`, {
        email: user.email,
        name: user.displayName
      });
      
      const { token } = response.data.data;
      
      // Store standard JWT separately to avoid authorization header mismatch crashes!
      localStorage.setItem('token', token);
      localStorage.setItem('adminUser', JSON.stringify({
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
        uid: user.uid,
        token: token
      }))
      
      toast.success(`Welcome ${user.displayName}!`)
      navigate('/dashboard')
    } catch (error) {
      console.error('Google sign-in failed:', error)
      const errorCode = error?.code
      if (errorCode === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled')
      } else if (errorCode === 'auth/popup-blocked') {
        toast.error('Popup blocked by browser. Please allow popups for this site and try again.')
      } else if (errorCode === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please use Direct Console login instead.')
      } else {
        toast.error('Google sign-in failed. Please use Direct Console login.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDirectSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/auth/admin-login`, {
        email: email.trim(),
        password
      });
      
      const { user, token } = response.data.data;
      
      // Standalone token saved successfully! None of the other buttons will be blocked now!
      localStorage.setItem('token', token);
      localStorage.setItem('adminUser', JSON.stringify({
        name: user.name,
        email: user.email,
        picture: null,
        uid: user.id,
        token: token
      }));
      
      toast.success(`Admin Authentication Successful! Welcome, ${user.name}`);
      navigate('/dashboard')
    } catch (error) {
      console.error('Direct console login failed:', error);
      const errMsg = error.response?.data?.message || 'Access Denied: Invalid email or password';
      toast.error(errMsg);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Clean Light Background Card */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative bg-white border border-[#E2E8F0] rounded-3xl p-8 w-full max-w-md shadow-xl z-10 flex flex-col"
      >
        {/* Brand Logo & Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img src="/volzo-logo.svg" alt="Volzo Logo" className="h-12 w-auto max-w-[180px] object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Admin Console</h1>
          <p className="text-gray-500 text-xs mt-1">Sign in to securely access operations control</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-xl border border-[#E2E8F0] mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'direct'
                ? 'bg-[#0040C8] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Direct Console
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'google'
                ? 'bg-[#0040C8] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Google SSO
          </button>
        </div>

        {/* Action Panel */}
        <AnimatePresence mode="wait">
          {activeTab === 'direct' ? (
            <motion.form
              key="direct-form"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              onSubmit={handleDirectSignIn}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-[#94A3B8] uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@volzo.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl text-sm text-white focus:outline-none focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20 transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-[#94A3B8] uppercase tracking-wider">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl text-sm text-white focus:outline-none focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20 transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white rounded-xl font-bold tracking-wide shadow-neon-blue hover:from-[#0052CC] hover:to-[#00B4D8] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="h-4.5 w-4.5" />
                    <span>Authorize Access</span>
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="google-sso"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-4"
            >
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#131B2E] border border-[#263554] hover:border-[#00D9FF] text-white rounded-xl hover:bg-[#1E293B] transition-all font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed group hover:shadow-neon-cyan shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-gray-200 font-semibold group-hover:text-white transition-colors">Sign in with Google</span>
                  </>
                )}
              </button>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <p className="text-gray-300 leading-relaxed">
                  Google SSO validates workspace identity cards. Standard accounts will require administrator role mapping in database.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-3xs font-semibold text-gray-500 uppercase tracking-widest">
            Protected by Firebase Operations Security
          </p>
          <p className="text-3xs text-gray-500">
            © 2026 Volzo Mobility. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
