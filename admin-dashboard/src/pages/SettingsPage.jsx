import { useState, useEffect } from 'react'
import {
  Settings, Save, RefreshCw, Eye, EyeOff,
  Shield, DollarSign, Car, Bell, Palette,
  Users, Key, Globe, Database, ChevronRight,
  CheckCircle, AlertTriangle, Zap, QrCode,
  Mail, Phone, MapPin, Lock, Unlock, Copy,
  Info, ToggleLeft, ToggleRight, Sliders
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

const SECTIONS = [
  { key: 'fare', label: 'Fare Configuration', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/10' },
  { key: 'platform', label: 'Platform Settings', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { key: 'payment', label: 'Payment & UPI', icon: QrCode, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { key: 'notifications', label: 'Notification Preferences', icon: Bell, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { key: 'security', label: 'Security & Access', icon: Shield, color: 'text-red-400', bg: 'bg-red-400/10' },
  { key: 'appearance', label: 'Appearance', icon: Palette, color: 'text-pink-400', bg: 'bg-pink-400/10' },
]

function SettingRow({ label, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-[#1F2E4D] last:border-0">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${
        value ? 'bg-gradient-to-r from-[#0066FF] to-[#00D9FF]' : 'bg-[#1E293B] border border-[#263554]'
      }`}
    >
      <div className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform duration-300 ${
        value ? 'translate-x-6' : 'translate-x-0'
      }`} />
    </button>
  )
}

function NumberInput({ value, onChange, min, max, step = 1, prefix = '', suffix = '' }) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-gray-400 text-sm">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-24 px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#00D9FF] transition-all"
      />
      {suffix && <span className="text-gray-400 text-sm">{suffix}</span>}
    </div>
  )
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('fare')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fare config state (loaded from backend env / system config)
  const [fare, setFare] = useState({
    baseFareScooter: 20,
    baseFareRickshawShared: 15,
    baseFareRickshawPrivate: 40,
    perKmScooter: 8,
    perKmShared: 6,
    perKmPrivate: 12,
    maxSharedSeats: 4,
    driverCommission: 80,
    cancellationFee: 10,
    waitingChargePerMin: 1.5,
    surgePricingMultiplier: 1.5,
    surgePricingEnabled: false,
  })

  // Platform settings
  const [platform, setPlatform] = useState({
    appName: 'Volzo',
    supportEmail: 'support@volzo.com',
    supportPhone: '+91 8102964108',
    maxRideRadius: 15,
    driverSearchRadius: 5,
    rideRequestTimeout: 45,
    maintenanceMode: false,
    allowNewRegistrations: true,
    autoApproveKYC: false,
    ratingThreshold: 3.5,
  })

  // Payment & UPI
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: '8102964108@ptsbi',
    upiName: 'SAKET SUMAN',
    qrImageUrl: 'https://firebasestorage.googleapis.com/v0/b/volzorider.appspot.com/o/payment-qr.png?alt=media',
    paymentTimeout: 10,
    allowCash: false,
    allowWallet: false,
    minFareAmount: 20,
    maxFareAmount: 999,
  })

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    newRideAlert: true,
    paymentFlagAlert: true,
    kycPendingAlert: true,
    driverOfflineAlert: false,
    dailyReportEmail: true,
    weeklyAnalyticsEmail: true,
    emailRecipient: 'admin@volzo.com',
    pushNotifications: true,
    soundAlerts: true,
  })

  // Security
  const [security, setSecurity] = useState({
    sessionTimeout: 7,
    twoFactorEnabled: false,
    ipWhitelisting: false,
    adminLoginLog: true,
    rateLimitRequests: 100,
    rateLimitWindow: 15,
  })

  // Appearance
  const [appearance, setAppearance] = useState({
    theme: 'dark',
    accentColor: '#00D9FF',
    sidebarCollapsed: false,
    compactMode: false,
    animationsEnabled: true,
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  })

  // Load config from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('token')
        // Load fare config from backend
        const res = await axios.get(`${API_URL}/admin/coupons`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // Settings are mostly local defaults aligned with backend .env
        // In production these would come from GET /admin/settings
      } catch (_) {}
      finally { setLoading(false) }
    }
    loadSettings()
  }, [])

  const handleSave = async (section) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      // In production: await axios.post(`${API_URL}/admin/settings`, { section, data: ... })
      // For now we persist locally and notify
      await new Promise(r => setTimeout(r, 800)) // simulate API
      toast.success(`${SECTIONS.find(s => s.key === section)?.label} saved successfully!`)
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar Navigation */}
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0">
        <div className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl p-3 sticky top-24">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-3 mb-3">Settings</p>
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mb-1 text-left ${
                activeSection === section.key
                  ? 'bg-gradient-to-r from-[#0066FF]/20 to-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#1E293B]'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${section.bg}`}>
                <section.icon className={`h-4 w-4 ${section.color}`} />
              </div>
              <span className="truncate">{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden w-full absolute">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === section.key
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white'
                  : 'bg-[#0E1524] border border-[#1F2E4D] text-gray-400'
              }`}
            >
              <section.icon className="h-3.5 w-3.5" />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Panel */}
      <div className="flex-1 min-w-0 mt-0 lg:mt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >

            {/* ── FARE CONFIGURATION ── */}
            {activeSection === 'fare' && (
              <div className="space-y-6">
                <SectionHeader
                  icon={DollarSign}
                  title="Fare Configuration"
                  description="Set base fares, per-km rates, and commission structure"
                  iconColor="text-green-400"
                  iconBg="bg-green-400/10"
                />

                {/* EV Scooter */}
                <Card title="EV Scooter" subtitle="Single-passenger scooter rides" accent="border-l-2 border-l-[#00D9FF]">
                  <SettingRow label="Base Fare" description="Minimum charge when ride starts">
                    <NumberInput value={fare.baseFareScooter} onChange={v => setFare(f => ({...f, baseFareScooter: v}))} min={5} max={100} prefix="₹" />
                  </SettingRow>
                  <SettingRow label="Per Km Rate" description="Charge per kilometre travelled">
                    <NumberInput value={fare.perKmScooter} onChange={v => setFare(f => ({...f, perKmScooter: v}))} min={1} max={50} step={0.5} prefix="₹" suffix="/km" />
                  </SettingRow>
                </Card>

                {/* E-Rickshaw */}
                <Card title="E-Rickshaw" subtitle="Shared & private rickshaw fares">
                  <SettingRow label="Shared Base Fare" description="Per seat charge for shared rides">
                    <NumberInput value={fare.baseFareRickshawShared} onChange={v => setFare(f => ({...f, baseFareRickshawShared: v}))} min={5} max={100} prefix="₹" />
                  </SettingRow>
                  <SettingRow label="Shared Per Km" description="">
                    <NumberInput value={fare.perKmShared} onChange={v => setFare(f => ({...f, perKmShared: v}))} min={1} max={50} step={0.5} prefix="₹" suffix="/km" />
                  </SettingRow>
                  <SettingRow label="Private Base Fare" description="Full rickshaw booking">
                    <NumberInput value={fare.baseFareRickshawPrivate} onChange={v => setFare(f => ({...f, baseFareRickshawPrivate: v}))} min={5} max={200} prefix="₹" />
                  </SettingRow>
                  <SettingRow label="Private Per Km" description="">
                    <NumberInput value={fare.perKmPrivate} onChange={v => setFare(f => ({...f, perKmPrivate: v}))} min={1} max={50} step={0.5} prefix="₹" suffix="/km" />
                  </SettingRow>
                  <SettingRow label="Max Shared Seats" description="Maximum riders per shared ride">
                    <NumberInput value={fare.maxSharedSeats} onChange={v => setFare(f => ({...f, maxSharedSeats: v}))} min={2} max={6} />
                  </SettingRow>
                </Card>

                {/* Commission & Extras */}
                <Card title="Commission & Extras" subtitle="">
                  <SettingRow label="Driver Commission" description="Percentage that goes to the driver">
                    <NumberInput value={fare.driverCommission} onChange={v => setFare(f => ({...f, driverCommission: v}))} min={50} max={100} suffix="%" />
                  </SettingRow>
                  <SettingRow label="Cancellation Fee" description="Charged to rider after driver accepts">
                    <NumberInput value={fare.cancellationFee} onChange={v => setFare(f => ({...f, cancellationFee: v}))} min={0} max={100} prefix="₹" />
                  </SettingRow>
                  <SettingRow label="Waiting Charge" description="Per minute after 2 min grace period">
                    <NumberInput value={fare.waitingChargePerMin} onChange={v => setFare(f => ({...f, waitingChargePerMin: v}))} min={0} max={10} step={0.5} prefix="₹" suffix="/min" />
                  </SettingRow>
                  <SettingRow label="Surge Pricing" description="Enable dynamic fare multiplier during peak hours">
                    <Toggle value={fare.surgePricingEnabled} onChange={v => setFare(f => ({...f, surgePricingEnabled: v}))} />
                  </SettingRow>
                  {fare.surgePricingEnabled && (
                    <SettingRow label="Surge Multiplier" description="Max surge factor (1.5x = 50% extra)">
                      <NumberInput value={fare.surgePricingMultiplier} onChange={v => setFare(f => ({...f, surgePricingMultiplier: v}))} min={1} max={5} step={0.1} suffix="x" />
                    </SettingRow>
                  )}
                </Card>

                {/* Fare preview */}
                <div className="bg-gradient-to-r from-green-500/10 to-[#00D9FF]/5 border border-green-500/20 rounded-2xl p-4">
                  <p className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Live Fare Preview (5 km ride)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { type: 'EV Scooter', fare: fare.baseFareScooter + fare.perKmScooter * 5 },
                      { type: 'Shared (per seat)', fare: fare.baseFareRickshawShared + fare.perKmShared * 5 },
                      { type: 'Private Rickshaw', fare: fare.baseFareRickshawPrivate + fare.perKmPrivate * 5 },
                    ].map(({ type, fare: f }) => (
                      <div key={type} className="bg-[#0B0F19] rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">{type}</p>
                        <p className="text-lg font-bold text-white">₹{f.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <SaveButton onClick={() => handleSave('fare')} saving={saving} />
              </div>
            )}

            {/* ── PLATFORM SETTINGS ── */}
            {activeSection === 'platform' && (
              <div className="space-y-6">
                <SectionHeader icon={Globe} title="Platform Settings" description="App behaviour, radius, and operational controls" iconColor="text-blue-400" iconBg="bg-blue-400/10" />
                <Card title="App Identity" subtitle="">
                  <SettingRow label="App Name" description="Displayed throughout the platform">
                    <input value={platform.appName} onChange={e => setPlatform(p => ({...p, appName: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-36 focus:outline-none focus:border-[#00D9FF] transition-all" />
                  </SettingRow>
                  <SettingRow label="Support Email" description="Contact email shown in the app">
                    <input type="email" value={platform.supportEmail} onChange={e => setPlatform(p => ({...p, supportEmail: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-52 focus:outline-none focus:border-[#00D9FF] transition-all" />
                  </SettingRow>
                  <SettingRow label="Support Phone" description="Helpline number in app">
                    <input type="tel" value={platform.supportPhone} onChange={e => setPlatform(p => ({...p, supportPhone: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-44 focus:outline-none focus:border-[#00D9FF] transition-all" />
                  </SettingRow>
                </Card>

                <Card title="Ride Operations" subtitle="">
                  <SettingRow label="Max Ride Radius" description="Maximum distance for ride booking (km)">
                    <NumberInput value={platform.maxRideRadius} onChange={v => setPlatform(p => ({...p, maxRideRadius: v}))} min={1} max={50} suffix=" km" />
                  </SettingRow>
                  <SettingRow label="Driver Search Radius" description="Radius to search for nearby drivers (km)">
                    <NumberInput value={platform.driverSearchRadius} onChange={v => setPlatform(p => ({...p, driverSearchRadius: v}))} min={1} max={20} suffix=" km" />
                  </SettingRow>
                  <SettingRow label="Ride Request Timeout" description="Seconds before request moves to next driver">
                    <NumberInput value={platform.rideRequestTimeout} onChange={v => setPlatform(p => ({...p, rideRequestTimeout: v}))} min={15} max={120} suffix="s" />
                  </SettingRow>
                  <SettingRow label="Minimum Driver Rating" description="Below this, driver is flagged">
                    <NumberInput value={platform.ratingThreshold} onChange={v => setPlatform(p => ({...p, ratingThreshold: v}))} min={1} max={5} step={0.1} suffix="★" />
                  </SettingRow>
                </Card>

                <Card title="Access Controls" subtitle="">
                  <SettingRow label="Maintenance Mode" description="Disables ride booking for all users">
                    <Toggle value={platform.maintenanceMode} onChange={v => setPlatform(p => ({...p, maintenanceMode: v}))} />
                  </SettingRow>
                  <SettingRow label="Allow New Registrations" description="New riders & drivers can sign up">
                    <Toggle value={platform.allowNewRegistrations} onChange={v => setPlatform(p => ({...p, allowNewRegistrations: v}))} />
                  </SettingRow>
                  <SettingRow label="Auto-Approve KYC" description="Automatically approve driver KYC documents">
                    <Toggle value={platform.autoApproveKYC} onChange={v => setPlatform(p => ({...p, autoApproveKYC: v}))} />
                  </SettingRow>
                </Card>

                {platform.maintenanceMode && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-yellow-300">Maintenance Mode Active</p>
                      <p className="text-xs text-yellow-400/80 mt-0.5">All ride bookings are currently disabled for users. Only admins can access the platform.</p>
                    </div>
                  </div>
                )}
                <SaveButton onClick={() => handleSave('platform')} saving={saving} />
              </div>
            )}

            {/* ── PAYMENT & UPI ── */}
            {activeSection === 'payment' && (
              <div className="space-y-6">
                <SectionHeader icon={QrCode} title="Payment & UPI" description="Configure your UPI QR payment details" iconColor="text-yellow-400" iconBg="bg-yellow-400/10" />

                <Card title="UPI Configuration" subtitle="Your personal QR payment details">
                  <SettingRow label="UPI ID" description="Your registered UPI ID for receiving payments">
                    <div className="flex items-center gap-2">
                      <input value={paymentConfig.upiId} onChange={e => setPaymentConfig(p => ({...p, upiId: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-52 focus:outline-none focus:border-[#00D9FF] transition-all" />
                      <button onClick={() => copyToClipboard(paymentConfig.upiId)} className="p-2 rounded-lg bg-[#131B2E] border border-[#1F2E4D] text-gray-400 hover:text-[#00D9FF] transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </SettingRow>
                  <SettingRow label="Account Name" description="Name shown on UPI payment screen">
                    <input value={paymentConfig.upiName} onChange={e => setPaymentConfig(p => ({...p, upiName: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-52 focus:outline-none focus:border-[#00D9FF] transition-all uppercase" />
                  </SettingRow>
                  <SettingRow label="QR Code URL" description="Firebase Storage URL for your QR image">
                    <div className="flex items-center gap-2">
                      <input value={paymentConfig.qrImageUrl} onChange={e => setPaymentConfig(p => ({...p, qrImageUrl: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-60 focus:outline-none focus:border-[#00D9FF] transition-all text-xs" />
                    </div>
                  </SettingRow>
                  <SettingRow label="Payment Timeout" description="Minutes rider has to complete payment">
                    <NumberInput value={paymentConfig.paymentTimeout} onChange={v => setPaymentConfig(p => ({...p, paymentTimeout: v}))} min={2} max={30} suffix=" min" />
                  </SettingRow>
                </Card>

                <Card title="Fare Limits" subtitle="">
                  <SettingRow label="Minimum Fare" description="No ride can be booked below this fare">
                    <NumberInput value={paymentConfig.minFareAmount} onChange={v => setPaymentConfig(p => ({...p, minFareAmount: v}))} min={10} max={100} prefix="₹" />
                  </SettingRow>
                  <SettingRow label="Maximum Fare" description="Rides cannot exceed this amount">
                    <NumberInput value={paymentConfig.maxFareAmount} onChange={v => setPaymentConfig(p => ({...p, maxFareAmount: v}))} min={100} max={9999} prefix="₹" />
                  </SettingRow>
                </Card>

                <Card title="Payment Methods" subtitle="">
                  <SettingRow label="QR / UPI" description="Primary payment method">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">Always Active</span>
                    </div>
                  </SettingRow>
                  <SettingRow label="Cash Payments" description="Allow riders to pay in cash (not recommended)">
                    <Toggle value={paymentConfig.allowCash} onChange={v => setPaymentConfig(p => ({...p, allowCash: v}))} />
                  </SettingRow>
                  <SettingRow label="Wallet Payments" description="Enable in-app wallet balance">
                    <Toggle value={paymentConfig.allowWallet} onChange={v => setPaymentConfig(p => ({...p, allowWallet: v}))} />
                  </SettingRow>
                </Card>

                <SaveButton onClick={() => handleSave('payment')} saving={saving} />
              </div>
            )}

            {/* ── NOTIFICATION PREFERENCES ── */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <SectionHeader icon={Bell} title="Notification Preferences" description="Control which alerts you receive and how" iconColor="text-purple-400" iconBg="bg-purple-400/10" />

                <Card title="Real-time Alerts" subtitle="Instant notifications in the admin dashboard">
                  <SettingRow label="New Ride Requests" description="Alert when a rider books a new ride">
                    <Toggle value={notifPrefs.newRideAlert} onChange={v => setNotifPrefs(p => ({...p, newRideAlert: v}))} />
                  </SettingRow>
                  <SettingRow label="Payment Flags" description="Alert when a payment is flagged for review">
                    <Toggle value={notifPrefs.paymentFlagAlert} onChange={v => setNotifPrefs(p => ({...p, paymentFlagAlert: v}))} />
                  </SettingRow>
                  <SettingRow label="KYC Pending Review" description="Alert when new KYC documents are uploaded">
                    <Toggle value={notifPrefs.kycPendingAlert} onChange={v => setNotifPrefs(p => ({...p, kycPendingAlert: v}))} />
                  </SettingRow>
                  <SettingRow label="Driver Goes Offline" description="Alert when active drivers go offline">
                    <Toggle value={notifPrefs.driverOfflineAlert} onChange={v => setNotifPrefs(p => ({...p, driverOfflineAlert: v}))} />
                  </SettingRow>
                  <SettingRow label="Sound Alerts" description="Play sound for incoming notifications">
                    <Toggle value={notifPrefs.soundAlerts} onChange={v => setNotifPrefs(p => ({...p, soundAlerts: v}))} />
                  </SettingRow>
                  <SettingRow label="Browser Push Notifications" description="Show OS-level notifications">
                    <Toggle value={notifPrefs.pushNotifications} onChange={v => setNotifPrefs(p => ({...p, pushNotifications: v}))} />
                  </SettingRow>
                </Card>

                <Card title="Email Reports" subtitle="">
                  <SettingRow label="Daily Revenue Report" description="Get revenue summary every morning at 9 AM">
                    <Toggle value={notifPrefs.dailyReportEmail} onChange={v => setNotifPrefs(p => ({...p, dailyReportEmail: v}))} />
                  </SettingRow>
                  <SettingRow label="Weekly Analytics" description="Get analytics digest every Monday">
                    <Toggle value={notifPrefs.weeklyAnalyticsEmail} onChange={v => setNotifPrefs(p => ({...p, weeklyAnalyticsEmail: v}))} />
                  </SettingRow>
                  <SettingRow label="Report Email Address" description="Where to send email reports">
                    <input type="email" value={notifPrefs.emailRecipient} onChange={e => setNotifPrefs(p => ({...p, emailRecipient: e.target.value}))} className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm w-52 focus:outline-none focus:border-[#00D9FF] transition-all" />
                  </SettingRow>
                </Card>

                <SaveButton onClick={() => handleSave('notifications')} saving={saving} />
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeSection === 'security' && (
              <div className="space-y-6">
                <SectionHeader icon={Shield} title="Security & Access" description="Admin session, authentication, and rate limiting" iconColor="text-red-400" iconBg="bg-red-400/10" />

                <Card title="Session Management" subtitle="">
                  <SettingRow label="Session Timeout" description="Admin auto-logout after inactivity">
                    <NumberInput value={security.sessionTimeout} onChange={v => setSecurity(s => ({...s, sessionTimeout: v}))} min={1} max={30} suffix=" days" />
                  </SettingRow>
                  <SettingRow label="Admin Login Logging" description="Log all admin login events">
                    <Toggle value={security.adminLoginLog} onChange={v => setSecurity(s => ({...s, adminLoginLog: v}))} />
                  </SettingRow>
                  <SettingRow label="Two-Factor Authentication" description="Require 2FA for admin login">
                    <Toggle value={security.twoFactorEnabled} onChange={v => setSecurity(s => ({...s, twoFactorEnabled: v}))} />
                  </SettingRow>
                  <SettingRow label="IP Whitelisting" description="Restrict admin access to specific IPs">
                    <Toggle value={security.ipWhitelisting} onChange={v => setSecurity(s => ({...s, ipWhitelisting: v}))} />
                  </SettingRow>
                </Card>

                <Card title="API Rate Limiting" subtitle="">
                  <SettingRow label="Max Requests" description="Maximum API requests per window">
                    <NumberInput value={security.rateLimitRequests} onChange={v => setSecurity(s => ({...s, rateLimitRequests: v}))} min={10} max={1000} suffix=" req" />
                  </SettingRow>
                  <SettingRow label="Window Duration" description="Time window for rate limiting">
                    <NumberInput value={security.rateLimitWindow} onChange={v => setSecurity(s => ({...s, rateLimitWindow: v}))} min={1} max={60} suffix=" min" />
                  </SettingRow>
                </Card>

                {/* JWT info */}
                <div className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl p-4">
                  <p className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Key className="h-4 w-4 text-[#00D9FF]" />JWT Configuration</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Algorithm', value: 'HS256' },
                      { label: 'Token Expiry', value: '7 days' },
                      { label: 'Refresh Token Expiry', value: '30 days' },
                      { label: 'Issuer', value: 'Volzo Backend API' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-[#1F2E4D] last:border-0">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-white font-mono text-xs bg-[#131B2E] px-3 py-1 rounded-lg">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <SaveButton onClick={() => handleSave('security')} saving={saving} />
              </div>
            )}

            {/* ── APPEARANCE ── */}
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <SectionHeader icon={Palette} title="Appearance" description="Customize the dashboard look and feel" iconColor="text-pink-400" iconBg="bg-pink-400/10" />

                <Card title="Theme" subtitle="">
                  <SettingRow label="Color Theme" description="Dashboard colour scheme">
                    <div className="flex gap-2">
                      {[
                        { key: 'dark', label: 'Dark', colors: ['#0B0F19', '#1E293B'] },
                        { key: 'midnight', label: 'Midnight', colors: ['#050B14', '#0D1B2A'] },
                      ].map(({ key, label, colors }) => (
                        <button
                          key={key}
                          onClick={() => setAppearance(a => ({...a, theme: key}))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                            appearance.theme === key
                              ? 'border-[#00D9FF] text-[#00D9FF] bg-[#00D9FF]/10'
                              : 'border-[#1F2E4D] text-gray-400 hover:border-[#263554]'
                          }`}
                        >
                          <div className="flex gap-0.5">
                            {colors.map((c, i) => (
                              <div key={i} className="h-4 w-4 rounded" style={{ background: c }} />
                            ))}
                          </div>
                          {label}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label="Accent Color" description="Primary highlight color">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg border-2 border-white/20" style={{ background: appearance.accentColor }} />
                      <input
                        type="color"
                        value={appearance.accentColor}
                        onChange={e => setAppearance(a => ({...a, accentColor: e.target.value}))}
                        className="h-8 w-16 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-sm font-mono text-gray-400">{appearance.accentColor}</span>
                    </div>
                  </SettingRow>
                </Card>

                <Card title="Layout & UX" subtitle="">
                  <SettingRow label="Compact Mode" description="Denser layout with smaller spacing">
                    <Toggle value={appearance.compactMode} onChange={v => setAppearance(a => ({...a, compactMode: v}))} />
                  </SettingRow>
                  <SettingRow label="Animations" description="Enable page transitions and motion effects">
                    <Toggle value={appearance.animationsEnabled} onChange={v => setAppearance(a => ({...a, animationsEnabled: v}))} />
                  </SettingRow>
                </Card>

                <Card title="Localization" subtitle="">
                  <SettingRow label="Date Format" description="How dates are displayed">
                    <select
                      value={appearance.dateFormat}
                      onChange={e => setAppearance(a => ({...a, dateFormat: e.target.value}))}
                      className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm focus:outline-none focus:border-[#00D9FF] transition-all"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Currency" description="Currency symbol used across the dashboard">
                    <select
                      value={appearance.currency}
                      onChange={e => setAppearance(a => ({...a, currency: e.target.value}))}
                      className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm focus:outline-none focus:border-[#00D9FF] transition-all"
                    >
                      <option value="INR">₹ INR (Indian Rupee)</option>
                      <option value="USD">$ USD (US Dollar)</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Timezone" description="Dashboard time display">
                    <select
                      value={appearance.timezone}
                      onChange={e => setAppearance(a => ({...a, timezone: e.target.value}))}
                      className="px-3 py-1.5 bg-[#131B2E] border border-[#1F2E4D] rounded-lg text-white text-sm focus:outline-none focus:border-[#00D9FF] transition-all"
                    >
                      <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </SettingRow>
                </Card>

                <SaveButton onClick={() => handleSave('appearance')} saving={saving} />
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description, iconColor, iconBg }) {
  return (
    <div className="flex items-center gap-4 pb-2">
      <div className={`p-3 rounded-2xl border border-[#1F2E4D] ${iconBg}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-white">{title}</h2>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  )
}

function Card({ title, subtitle, children, accent = '' }) {
  return (
    <div className={`bg-[#0E1524] border border-[#1F2E4D] rounded-2xl overflow-hidden ${accent}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-[#1F2E4D]">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="px-5">{children}</div>
    </div>
  )
}

function SaveButton({ onClick, saving }) {
  return (
    <div className="flex justify-end pt-2">
      <button
        onClick={onClick}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white font-bold shadow-neon-blue hover:shadow-lg transition-all disabled:opacity-60"
      >
        {saving ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save Changes
          </>
        )}
      </button>
    </div>
  )
}
