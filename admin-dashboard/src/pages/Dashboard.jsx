import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Car, 
  MapPin, 
  DollarSign, 
  ArrowUpRight,
  MoreVertical,
  Download,
  Calendar,
  AlertCircle,
  Sparkles,
  Ticket,
  Radio
} from 'lucide-react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import toast from 'react-hot-toast'

const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const SOCK_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [recentRides, setRecentRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [adminUser, setAdminUser] = useState(null)
  const [timeRange, setTimeRange] = useState('week')
  const [liveActiveRides, setLiveActiveRides] = useState(null)
  const [liveOnlineDrivers, setLiveOnlineDrivers] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    const user = localStorage.getItem('adminUser')
    if (user) setAdminUser(JSON.parse(user))
    loadData()

    // Connect to Socket.IO for live updates
    const token = localStorage.getItem('token')
    const sock = io(SOCK_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3
    })
    socketRef.current = sock

    sock.on('connect', () => {
      setSocketConnected(true)
      sock.emit('admin:join')
    })
    sock.on('disconnect', () => setSocketConnected(false))

    sock.on('ride:new', () => {
      setLiveActiveRides(n => (n ?? 0) + 1)
      toast('🚗 New ride requested!', { icon: '🛵', duration: 3000 })
    })
    sock.on('ride:status', (data) => {
      if (['COMPLETED', 'CANCELLED'].includes(data?.status)) {
        setLiveActiveRides(n => Math.max(0, (n ?? 1) - 1))
      }
    })
    sock.on('driver:status:changed', (data) => {
      if (data?.status === 'ONLINE')  setLiveOnlineDrivers(n => (n ?? 0) + 1)
      if (data?.status === 'OFFLINE') setLiveOnlineDrivers(n => Math.max(0, (n ?? 1) - 1))
    })

    return () => sock.disconnect()
  }, [timeRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      
      const [statsRes, analyticsRes, ridesRes] = await Promise.all([
        axios.get(`${API_URL}/admin/dashboard`, { headers }),
        axios.get(`${API_URL}/admin/analytics`, { params: { period: timeRange }, headers }),
        axios.get(`${API_URL}/admin/rides`, { params: { limit: 5 }, headers })
      ])

      setStats(statsRes.data.data)
      setAnalytics(analyticsRes.data.data)
      setRecentRides(ridesRes.data.data.rides)
      // Seed live counters from initial load
      setLiveActiveRides(statsRes.data.data?.activeRides ?? 0)
      setLiveOnlineDrivers(statsRes.data.data?.activeDrivers ?? 0)
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error)
      toast.error('Failed to retrieve active metrics from server')
    } finally {
      setLoading(false)
    }
  }

  // Dynamic stat cards — uses live socket data for rides & drivers
  const statCards = stats ? [
    {
      title: "Today's Revenue",
      value: `₹${parseFloat(stats.todayRevenue || 0).toLocaleString()}`,
      change: '+15.4%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-blue-500 to-[#00D9FF]',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-[#00D9FF] text-glow-cyan',
      isLive: false
    },
    {
      title: 'Active Rides',
      value: (liveActiveRides ?? stats.activeRides).toString(),
      change: 'Live',
      trend: 'up',
      icon: MapPin,
      color: 'from-emerald-500 to-[#5FD068]',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-[#5FD068]',
      isLive: true
    },
    {
      title: 'Total Riders',
      value: stats.totalUsers.toString(),
      change: '+12.1%',
      trend: 'up',
      icon: Users,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400',
      isLive: false
    },
    {
      title: 'Online Drivers',
      value: (liveOnlineDrivers ?? stats.activeDrivers).toString(),
      change: `${stats.totalDrivers} registered`,
      trend: 'up',
      icon: Car,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    },
  ] : []

  // Dynamic chart data mapping
  const chartData = analytics?.revenue?.map(r => {
    const formattedDate = new Date(r.date).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric'
    })
    return {
      date: formattedDate,
      revenue: parseFloat(r.amount || 0)
    }
  }) || []

  // Default empty graph fillers if no revenue is recorded yet
  const dummyChartData = [
    { date: 'Mon', revenue: 0 },
    { date: 'Tue', revenue: 120 },
    { date: 'Wed', revenue: 450 },
    { date: 'Thu', revenue: 300 },
    { date: 'Fri', revenue: 700 },
    { date: 'Sat', revenue: 950 },
    { date: 'Sun', revenue: 1200 }
  ]

  const vehicleData = [
    { name: 'EV Scooter', value: 60, color: '#00D9FF' },
    { name: 'E-Rickshaw', value: 40, color: '#5FD068' },
  ]

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            Welcome back, {adminUser?.name?.split(' ')[0] || 'Admin'}! 👋 <Sparkles className="h-6 w-6 text-[#00D9FF] text-glow-cyan" />
          </h1>
          <p className="text-gray-400 mt-1">Here's a dynamic live overview of the Volzo mobility platform today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#131B2E] border border-[#1F2E4D] rounded-xl hover:bg-[#1E293B] transition-colors shadow-sm text-sm font-semibold text-gray-300"
          >
            Refresh Dashboard
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors shadow-neon-blue text-sm font-semibold"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative glass-panel glass-panel-hover rounded-2xl p-6 border border-[#263554]/60 overflow-hidden group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${card.bgColor} border border-[#263554]/40`}>
                      <card.icon className={`h-6 w-6 ${card.textColor}`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">{card.title}</p>
                    <h3 className="text-3xl font-black text-white">{card.value}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-[#00D9FF] text-xs font-bold border border-blue-500/20">
                      {card.change}
                    </div>
                    <span className="text-2xs text-[#64748B] font-semibold uppercase">Real-time stats</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Critical Actions alerts */}
          {stats?.pendingPayments > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <h4 className="text-sm font-bold text-amber-400">Pending Transactions Verification</h4>
                  <p className="text-xs text-amber-500/80 mt-0.5">There are {stats.pendingPayments} payment receipts awaiting manual driver validation. Track transaction logs to avoid fraud.</p>
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart - 2 columns */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-[#263554]/60 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">Earnings Analytics</h3>
                    <p className="text-sm text-[#94A3B8] mt-0.5">Dynamic platform billing and completed rides volume</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#0B0F19] p-1 rounded-xl border border-[#1F2E4D]">
                    {['Week', 'Month', 'Year'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range.toLowerCase())}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          timeRange === range.toLowerCase()
                            ? 'bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white shadow-neon-blue font-bold'
                            : 'text-[#94A3B8] hover:bg-[#131B2E]'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData.length > 0 ? chartData : dummyChartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00D9FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2E4D" vertical={false} />
                    <XAxis 
                      dataKey={chartData.length > 0 ? 'date' : 'date'} 
                      stroke="#94A3B8"
                      style={{ fontSize: '11px', fontWeight: '500' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#94A3B8"
                      style={{ fontSize: '11px', fontWeight: '500' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#131B2E',
                        border: '1px solid #263554',
                        borderRadius: '12px',
                        color: '#E2E8F0',
                      }}
                      formatter={(value) => [`₹${value}`, 'Earnings']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#00D9FF" 
                      strokeWidth={3}
                      fill="url(#colorRevenue)"
                      dot={{ r: 4, stroke: '#00D9FF', strokeWidth: 2, fill: '#0B0F19' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Vehicle Distribution - 1 column */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-6 border border-[#263554]/60 flex flex-col justify-between"
            >
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white">EV Fleets Distribution</h3>
                  <p className="text-sm text-[#94A3B8] mt-0.5">Active vehicles registered in systems</p>
                </div>
                
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={vehicleData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {vehicleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2 border-t border-[#1F2E4D] pt-4">
                {vehicleData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-semibold text-[#94A3B8]">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Recent Rides Table */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl border border-[#263554]/60 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[#1F2E4D] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Latest Live Transactions</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">Live tracking ride updates on network</p>
              </div>
            </div>
            
            {recentRides.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] italic text-sm">No recent transactions recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0E1524]/60">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Rider</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Route Details</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicle Type</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2E4D]">
                    {recentRides.map((ride) => (
                      <tr key={ride.id} className="hover:bg-[#1E293B]/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                              {ride.rider?.name?.charAt(0) || 'R'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{ride.rider?.name || 'Rider'}</p>
                              <p className="text-2xs font-mono text-gray-500">{ride.rideNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium">
                          <div className="text-white">{ride.pickupLocation?.address || 'Pickup'}</div>
                          <div className="text-[#94A3B8] mt-0.5">→ {ride.dropoffLocation?.address || 'Dropoff'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-[#00D9FF]">
                          ₹{ride.finalFare || ride.estimatedFare}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-400">
                          {ride.rideType === 'SCOOTER' ? 'Scooter' : ride.rideType === 'RICKSHAW_SHARED' ? 'Rickshaw (Shared)' : 'Rickshaw (Private)'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold ${
                            ride.status === 'COMPLETED' || ride.status === 'PAYMENT_VERIFIED'
                              ? 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20' 
                              : 'bg-blue-500/10 text-[#00D9FF] border border-blue-500/20'
                          }`}>
                            {ride.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
