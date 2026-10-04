import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('rider_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rider_token')
      localStorage.removeItem('rider_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const getErrMsg = (e) =>
  e?.response?.data?.message || e?.message || 'Something went wrong'

// Auth
export const loginWithPhone = (idToken, phoneNumber, name) =>
  api.post('/auth/login', { idToken, phoneNumber, name })

export const getMe = () => api.get('/auth/me')

// User
export const getProfile = () => api.get('/users/profile')
export const updateProfile = (data) => api.patch('/users/profile', data)

// Rides
export const calculateFare = (data) => api.post('/rides/calculate-fare', data)
export const requestRide = (data) => api.post('/rides', data)
export const getActiveRide = () => api.get('/rides/active')
export const getRide = (id) => api.get(`/rides/${id}`)
export const cancelRide = (id, reason) => api.patch(`/rides/${id}/cancel`, { reason })
export const getRideHistory = (page = 1) => api.get('/rides/history', { params: { page, limit: 15 } })
export const applyCoupon = (rideId, code) => api.post(`/rides/${rideId}/apply-coupon`, { code })

export const simulateRideStatus = (rideId, status, coords = {}) =>
  api.post(`/rides/${rideId}/simulate`, { status, ...coords })

// Payments
export const getQrDetails = () => api.get('/payments/qr-details')
export const initiatePayment = (rideId) => api.post('/payments/initiate', { rideId })
export const getPaymentByRide = (rideId) => api.get(`/payments/ride/${rideId}`)
export const confirmPayment = (paymentId, data) =>
  api.post('/payments/confirm', { paymentId, ...data })

export const createRazorpayOrder = (rideId) => api.post('/payments/razorpay/create-order', { rideId })
export const verifyRazorpayPayment = (data) => api.post('/payments/razorpay/verify', data)

export default api
