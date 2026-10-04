import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Drivers from './pages/Drivers'
import Rides from './pages/Rides'
import Payments from './pages/Payments'
import Analytics from './pages/Analytics'
import Tickets from './pages/Tickets'
import Coupons from './pages/Coupons'
import Vehicles from './pages/Vehicles'
import Notifications from './pages/Notifications'
import SettingsPage from './pages/SettingsPage'
import Login from './pages/Login'
import Layout from './components/Layout'

// Protected Route Component
function ProtectedRoute({ children }) {
  const adminUser = localStorage.getItem('adminUser')
  const token = localStorage.getItem('token')
  
  // Clear any stale fake bypass tokens from old sessions
  if (token && token.startsWith('dev_token_bypass_')) {
    localStorage.removeItem('token')
    localStorage.removeItem('adminUser')
    return <Navigate to="/login" replace />
  }
  
  if (!adminUser || !token) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#0E1524',
            color: '#E2E8F0',
            border: '1px solid #1F2E4D',
            borderRadius: '12px',
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="rides" element={<Rides />} />
          <Route path="payments" element={<Payments />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
