import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Pages
import SplashPage from './pages/SplashPage'
import LoginPage from './pages/LoginPage'
import OtpPage from './pages/OtpPage'
import HomePage from './pages/HomePage'
import BookRidePage from './pages/BookRidePage'
import TrackingPage from './pages/TrackingPage'
import PaymentPage from './pages/PaymentPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'

// Protected Route Guard
function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

// Public Route Guard (Redirects if already logged in)
function PublicRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return !token ? children : <Navigate to="/home" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      {/* 
        Centralized Mobile Frame: 
        Maintains a gorgeous mobile screen layout (centered, rounded corners, box-shadow) 
        on desktops, while scaling to a native full screen on mobile devices.
      */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        background: '#0F172A', // Dark luxurious background matching the Volzo theme
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        
        {/* Device Container Frame */}
        <div style={{
          width: '100%',
          maxWidth: '430px', // Standard modern smartphone width (iPhone 15 Pro Max equivalent)
          height: '100vh',
          maxHeight: '920px', // Standard modern smartphone height
          background: 'var(--bg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: '40px', // Curved display
          border: '10px solid #1E293B', // Premium bezel frame
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          transition: 'all 0.3s'
        }} className="mobile-frame-container">
          
          {/* Dynamic App Screens Router */}
          <Routes>
            {/* Splash screen */}
            <Route path="/" element={<SplashPage />} />
            
            {/* Auth routes */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/otp" element={
              <PublicRoute>
                <OtpPage />
              </PublicRoute>
            } />
            
            {/* Main App Protected routes */}
            <Route path="/home" element={
              <PrivateRoute>
                <HomePage />
              </PrivateRoute>
            } />
            <Route path="/book" element={
              <PrivateRoute>
                <BookRidePage />
              </PrivateRoute>
            } />
            <Route path="/tracking/:rideId" element={
              <PrivateRoute>
                <TrackingPage />
              </PrivateRoute>
            } />
            <Route path="/payment/:rideId" element={
              <PrivateRoute>
                <PaymentPage />
              </PrivateRoute>
            } />
            <Route path="/history" element={
              <PrivateRoute>
                <HistoryPage />
              </PrivateRoute>
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            } />
            
            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Dynamic Toaster Notifications Container */}
          <Toaster 
            position="top-center" 
            toastOptions={{
              duration: 3000,
              style: {
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '12px',
                padding: '10px 16px',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)'
              }
            }}
          />

        </div>
      </div>
      
      {/* 
        Responsive Styles Override: 
        Removes borders, phone bezel frame, and curved corners on actual mobile devices 
        to yield a seamless native experience.
      */}
      <style>{`
        @media (max-width: 480px) {
          .mobile-frame-container {
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0px !important;
            border: none !important;
            height: 100% !important;
          }
        }
      `}</style>
    </BrowserRouter>
  )
}
