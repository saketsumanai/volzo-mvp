import { useEffect, useState, useCallback } from 'react'
import {
  Bell, BellOff, BellRing, Send, Check, CheckCheck,
  Filter, Trash2, RefreshCw, Users, Car, AlertCircle,
  Info, ChevronRight, Megaphone, Radio, Clock, X,
  MessageSquare, ShieldAlert, DollarSign, Star, Zap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

const NOTIFICATION_TYPES = [
  { key: 'ALL', label: 'All', icon: Bell },
  { key: 'RIDE', label: 'Rides', icon: Car },
  { key: 'PAYMENT', label: 'Payments', icon: DollarSign },
  { key: 'SUPPORT', label: 'Support', icon: MessageSquare },
  { key: 'SYSTEM', label: 'System', icon: ShieldAlert },
]

const BROADCAST_TARGETS = [
  { key: 'ALL', label: 'All Users', icon: Users, desc: 'Send to all riders & drivers' },
  { key: 'RIDERS', label: 'All Riders', icon: Users, desc: 'Send to riders only' },
  { key: 'DRIVERS', label: 'All Drivers', icon: Car, desc: 'Send to drivers only' },
]

// Sample in-app notifications generated from real system events
const generateSampleNotifications = () => [
  {
    id: '1', type: 'RIDE', isRead: false,
    title: 'New Ride Request', body: 'Ride #VLZ-001 requested from Saket Metro to Nehru Place.',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(), priority: 'HIGH'
  },
  {
    id: '2', type: 'PAYMENT', isRead: false,
    title: 'Payment Flagged', body: 'Payment for ride #VLZ-098 has been flagged for review. Amount: ₹340.',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(), priority: 'URGENT'
  },
  {
    id: '3', type: 'SUPPORT', isRead: false,
    title: 'New Support Ticket', body: 'Driver Rahul Kumar raised a ticket: "App crashed during ride acceptance".',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(), priority: 'MEDIUM'
  },
  {
    id: '4', type: 'SYSTEM', isRead: true,
    title: 'KYC Pending Review', body: '3 driver KYC applications are awaiting admin approval.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), priority: 'MEDIUM'
  },
  {
    id: '5', type: 'RIDE', isRead: true,
    title: 'Ride Completed', body: 'Ride #VLZ-097 completed. Fare: ₹128. Driver: Amitesh Singh.',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), priority: 'LOW'
  },
  {
    id: '6', type: 'PAYMENT', isRead: true,
    title: 'Daily Revenue Report', body: 'Today\'s revenue: ₹4,820 from 38 completed rides.',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), priority: 'LOW'
  },
  {
    id: '7', type: 'SYSTEM', isRead: true,
    title: 'New Driver Registered', body: 'Driver Priya Sharma completed onboarding. KYC documents uploaded.',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), priority: 'LOW'
  },
]

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const typeConfig = {
  RIDE: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Car },
  PAYMENT: { color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', icon: DollarSign },
  SUPPORT: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: MessageSquare },
  SYSTEM: { color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', icon: ShieldAlert },
}

const priorityConfig = {
  URGENT: 'bg-red-500/20 text-red-400 border border-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  LOW: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(generateSampleNotifications())
  const [filter, setFilter] = useState('ALL')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastTarget, setBroadcastTarget] = useState('ALL')
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [sending, setSending] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [socket, setSocket] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [liveCount, setLiveCount] = useState(0)

  // Connect to socket for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('token')
    const s = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 3,
      timeout: 5000
    })

    s.on('connect', () => {
      setIsLive(true)
      s.emit('admin:join')
    })

    s.on('disconnect', () => setIsLive(false))

    // Listen for real-time events
    const addNotif = (type, title, body, priority = 'MEDIUM') => {
      const newNotif = {
        id: Date.now().toString(),
        type, title, body, priority,
        isRead: false,
        timestamp: new Date().toISOString()
      }
      setNotifications(prev => [newNotif, ...prev])
      setLiveCount(c => c + 1)
      if (soundEnabled) {
        // Play a subtle click sound for new notifications
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(880, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
        } catch (_) {}
      }
    }

    s.on('ride:requested', (data) =>
      addNotif('RIDE', 'New Ride Request', `Ride #${data?.rideNumber || 'NEW'} requested.`, 'HIGH'))
    s.on('ride:completed', (data) =>
      addNotif('RIDE', 'Ride Completed', `Ride #${data?.rideNumber || ''} completed. Fare: ₹${data?.fare || '—'}.`, 'LOW'))
    s.on('payment:flagged', (data) =>
      addNotif('PAYMENT', 'Payment Flagged', `Payment flagged for review. Amount: ₹${data?.amount || '—'}.`, 'URGENT'))
    s.on('driver:status:changed', (data) =>
      addNotif('SYSTEM', 'Driver Status Changed', `Driver ${data?.driverId || ''} went ${data?.status || 'OFFLINE'}.`, 'LOW'))

    setSocket(s)

    return () => { s.disconnect() }
  }, [soundEnabled])

  const filtered = filter === 'ALL'
    ? notifications
    : notifications.filter(n => n.type === filter)

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    toast.success('All notifications marked as read')
  }

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const deleteNotif = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
    toast.success('All notifications cleared')
  }

  const sendBroadcast = async (e) => {
    e.preventDefault()
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      toast.error('Title and message are required')
      return
    }
    setSending(true)
    try {
      // Send via socket to all connected users
      if (socket) {
        socket.emit('admin:broadcast', {
          target: broadcastTarget,
          title: broadcastTitle.trim(),
          body: broadcastBody.trim()
        })
      }
      // Also save as a system notification
      const newNotif = {
        id: Date.now().toString(),
        type: 'SYSTEM',
        title: `📣 Broadcast Sent: ${broadcastTitle.trim()}`,
        body: `Target: ${broadcastTarget} | ${broadcastBody.trim()}`,
        isRead: false,
        priority: 'MEDIUM',
        timestamp: new Date().toISOString()
      }
      setNotifications(prev => [newNotif, ...prev])
      toast.success(`Broadcast sent to ${broadcastTarget.toLowerCase()}!`)
      setBroadcastTitle('')
      setBroadcastBody('')
      setShowBroadcast(false)
    } catch (err) {
      toast.error('Failed to send broadcast')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#00D9FF]/10 border border-[#0066FF]/30">
              <Bell className="h-6 w-6 text-[#00D9FF]" />
            </div>
            Notifications
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-sm font-bold bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-1 ml-14">Real-time system alerts & broadcast management</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            isLive
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
          }`}>
            <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {isLive ? `Live (${liveCount} new)` : 'Offline'}
          </div>

          {/* Sound toggle */}
          <button
            onClick={() => { setSoundEnabled(v => !v); toast.success(soundEnabled ? 'Notification sound off' : 'Notification sound on') }}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-[#00D9FF]/10 border-[#00D9FF]/30 text-[#00D9FF]'
                : 'bg-[#1E293B] border-[#1F2E4D] text-gray-400'
            }`}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1E293B] border border-[#1F2E4D] text-gray-300 hover:text-white hover:border-[#00D9FF]/50 transition-all text-sm"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}

          <button
            onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white font-semibold text-sm shadow-neon-blue hover:shadow-lg transition-all"
          >
            <Megaphone className="h-4 w-4" />
            Broadcast
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: notifications.length, icon: Bell, color: 'text-[#00D9FF]', bg: 'bg-[#00D9FF]/10' },
          { label: 'Unread', value: unreadCount, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: 'Urgent', value: notifications.filter(n => n.priority === 'URGENT').length, icon: Zap, color: 'text-orange-400', bg: 'bg-orange-400/10' },
          { label: 'Today', value: notifications.filter(n => new Date(n.timestamp) > new Date(new Date().setHours(0,0,0,0))).length, icon: Clock, color: 'text-green-400', bg: 'bg-green-400/10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs + Clear */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-[#0E1524] border border-[#1F2E4D] rounded-xl p-1">
          {NOTIFICATION_TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                filter === key
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white shadow-neon-blue'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 transition-all text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 text-gray-500"
            >
              <BellOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1">System events will appear here in real-time</p>
            </motion.div>
          ) : (
            filtered.map((notif, i) => {
              const cfg = typeConfig[notif.type] || typeConfig.SYSTEM
              const Icon = cfg.icon
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 80, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => markRead(notif.id)}
                  className={`group relative flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.005] ${
                    notif.isRead
                      ? 'bg-[#0E1524] border-[#1F2E4D] opacity-75'
                      : 'bg-[#0E1524]/80 border-[#1F2E4D] shadow-neon-blue/10'
                  }`}
                >
                  {/* Unread dot */}
                  {!notif.isRead && (
                    <div className="absolute top-4 right-4 h-2.5 w-2.5 bg-[#00D9FF] rounded-full animate-pulse shadow-[0_0_8px_rgba(0,217,255,0.8)]" />
                  )}

                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2.5 rounded-xl border ${cfg.bg}`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${notif.isRead ? 'text-gray-300' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${priorityConfig[notif.priority]}`}>
                        {notif.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{notif.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(notif.timestamp)}
                      </span>
                      <span className={`text-xs font-medium ${cfg.color}`}>{notif.type}</span>
                    </div>
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {!notif.isRead && (
                      <button
                        onClick={e => { e.stopPropagation(); markRead(notif.id) }}
                        className="p-1.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] hover:bg-[#00D9FF]/20 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowBroadcast(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0E1524] border border-[#1F2E4D] rounded-3xl p-6 w-full max-w-lg shadow-neon-blue"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#0066FF]/20 to-[#00D9FF]/10 border border-[#0066FF]/30">
                    <Megaphone className="h-5 w-5 text-[#00D9FF]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Send Broadcast</h3>
                    <p className="text-xs text-gray-400">Push notification to app users</p>
                  </div>
                </div>
                <button onClick={() => setShowBroadcast(false)} className="p-2 rounded-xl hover:bg-[#1E293B] text-gray-400 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={sendBroadcast} className="space-y-4">
                {/* Target selection */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Target Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BROADCAST_TARGETS.map(({ key, label, icon: Icon, desc }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBroadcastTarget(key)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          broadcastTarget === key
                            ? 'bg-gradient-to-b from-[#0066FF]/20 to-[#00D9FF]/10 border-[#00D9FF]/50 text-[#00D9FF]'
                            : 'bg-[#131B2E] border-[#1F2E4D] text-gray-400 hover:border-[#263554]'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-bold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Notification Title</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. Special Offer! 20% off today"
                    maxLength={80}
                    className="w-full px-4 py-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl text-white text-sm focus:outline-none focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20 transition-all placeholder-gray-600"
                    required
                  />
                  <div className="text-right text-xs text-gray-600 mt-1">{broadcastTitle.length}/80</div>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Message Body</label>
                  <textarea
                    value={broadcastBody}
                    onChange={e => setBroadcastBody(e.target.value)}
                    placeholder="Enter notification message..."
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl text-white text-sm focus:outline-none focus:border-[#00D9FF] focus:ring-2 focus:ring-[#00D9FF]/20 transition-all placeholder-gray-600 resize-none"
                    required
                  />
                  <div className="text-right text-xs text-gray-600 mt-1">{broadcastBody.length}/200</div>
                </div>

                {/* Preview */}
                {(broadcastTitle || broadcastBody) && (
                  <div className="bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Preview</p>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0066FF] to-[#00D9FF] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">V</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{broadcastTitle || 'Title'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{broadcastBody || 'Message...'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBroadcast(false)}
                    className="flex-1 py-3 rounded-xl bg-[#131B2E] border border-[#1F2E4D] text-gray-300 hover:text-white font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white font-bold shadow-neon-blue hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Now
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
