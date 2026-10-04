import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  MapPin, 
  CreditCard, 
  BarChart3,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  Settings,
  ChevronDown,
  MessageSquare,
  Ticket,
  FileCheck
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const navigation = [
  { name: 'Dashboard',     href: '/dashboard',      icon: LayoutDashboard },
  { name: 'Users',         href: '/users',           icon: Users },
  { name: 'Drivers',       href: '/drivers',         icon: Car },
  { name: 'Vehicles',      href: '/vehicles',        icon: FileCheck },
  { name: 'Rides',         href: '/rides',           icon: MapPin },
  { name: 'Payments',      href: '/payments',        icon: CreditCard },
  { name: 'Analytics',     href: '/analytics',       icon: BarChart3 },
  { name: 'Coupons',       href: '/coupons',         icon: Ticket },
  { name: 'Support',       href: '/tickets',         icon: MessageSquare },
  { name: 'Notifications', href: '/notifications',   icon: Bell },
  { name: 'Settings',      href: '/settings',        icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [notifCount, setNotifCount] = useState(3)   // live unread badge
  const [globalSearch, setGlobalSearch] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('adminUser')
    if (user) {
      try { setAdminUser(JSON.parse(user)) } catch (_) {}
    }
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    const handler = () => setShowUserMenu(false)
    if (showUserMenu) document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showUserMenu])

  const handleLogout = () => {
    localStorage.removeItem('adminUser')
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (!globalSearch.trim()) return
    // Navigate to relevant page based on search
    const q = globalSearch.toLowerCase()
    if (q.includes('driver') || q.includes('kyc')) navigate('/drivers')
    else if (q.includes('ride') || q.includes('trip')) navigate('/rides')
    else if (q.includes('rider') || q.includes('user') || q.includes('passenger')) navigate('/users')
    else if (q.includes('payment') || q.includes('upi')) navigate('/payments')
    else if (q.includes('coupon') || q.includes('promo')) navigate('/coupons')
    else if (q.includes('ticket') || q.includes('support')) navigate('/tickets')
    else if (q.includes('vehicle')) navigate('/vehicles')
    else if (q.includes('analytic') || q.includes('report')) navigate('/analytics')
    else if (q.includes('notif')) navigate('/notifications')
    else if (q.includes('setting')) navigate('/settings')
    setGlobalSearch('')
  }

  const NavLink = ({ item, onClick }) => {
    const isActive = location.pathname === item.href
    const isNotif = item.href === '/notifications'
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all group ${
          isActive
            ? 'bg-[#0040C8] text-white shadow-md font-bold'
            : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0040C8]'
        }`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        <span>{item.name}</span>
        {isNotif && notifCount > 0 && (
          <span className="ml-auto flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-[#E2E8F0] lg:hidden flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between h-20 px-6 border-b border-[#E2E8F0] flex-shrink-0">
              <img src="/volzo-logo.svg" alt="Volzo" className="h-9 w-auto max-w-[140px] object-contain" />
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
              {navigation.map((item) => (
                <NavLink key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            {/* Mobile user card */}
            <div className="p-4 border-t border-[#E2E8F0] flex-shrink-0 bg-[#F8FAFC]">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-9 w-9 rounded-full bg-[#0040C8] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {adminUser?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate">{adminUser?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500 truncate">{adminUser?.email || 'admin@volzo.com'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col z-30">
        <div className="flex flex-col flex-grow bg-white border-r border-[#E2E8F0]">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-[#E2E8F0] flex-shrink-0">
            <Link to="/dashboard">
              <img src="/volzo-logo.svg" alt="Volzo" className="h-9 w-auto max-w-[140px] object-contain" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-[#1F2E4D] flex-shrink-0">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu) }}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[#1E293B]/50 transition-colors border border-transparent hover:border-[#1F2E4D]"
              >
                {adminUser?.picture ? (
                  <img 
                    src={adminUser.picture} 
                    alt={adminUser.name}
                    className="h-9 w-9 rounded-full border border-[#00D9FF] flex-shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0066FF] to-[#00D9FF] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {adminUser?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold text-white truncate">{adminUser?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-400 truncate">{adminUser?.email || 'admin@volzo.com'}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-[#131B2E] rounded-xl shadow-neon-cyan border border-[#263554] overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-300 hover:bg-[#1E293B] hover:text-[#00D9FF] transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                    <Link
                      to="/notifications"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-300 hover:bg-[#1E293B] hover:text-[#00D9FF] transition-colors"
                    >
                      <Bell className="h-4 w-4" />
                      <span>Notifications</span>
                      {notifCount > 0 && (
                        <span className="ml-auto h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {notifCount}
                        </span>
                      )}
                    </Link>
                    <div className="h-px bg-[#1F2E4D]" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 bg-white border-b border-[#E2E8F0] shadow-sm">
          <div className="flex flex-1 items-center justify-between px-4 sm:px-6">
            {/* Mobile menu button */}
            <button
              className="p-2 rounded-lg text-gray-600 hover:bg-[#F1F5F9] transition-colors lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search bar */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-4 hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder="Search rides, users, drivers, coupons..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] text-sm placeholder-gray-400 focus:outline-none focus:border-[#0040C8] focus:ring-2 focus:ring-[#0040C8]/20 transition-all"
                />
              </div>
            </form>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Notifications button */}
              <Link
                to="/notifications"
                onClick={() => setNotifCount(0)}
                className="relative p-2.5 rounded-xl hover:bg-[#1E293B] transition-colors text-gray-300 hover:text-[#00D9FF]"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </Link>

              {/* Settings button */}
              <Link
                to="/settings"
                className={`p-2.5 rounded-xl transition-colors ${
                  location.pathname === '/settings'
                    ? 'bg-[#1E293B] text-[#00D9FF]'
                    : 'text-gray-300 hover:bg-[#1E293B] hover:text-[#00D9FF]'
                }`}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>

              {/* Divider + User avatar */}
              <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-[#1F2E4D]">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu) }}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {adminUser?.picture ? (
                    <img 
                      src={adminUser.picture} 
                      alt={adminUser.name}
                      className="h-9 w-9 rounded-full border-2 border-[#00D9FF]/50"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0066FF] to-[#00D9FF] flex items-center justify-center text-white font-bold text-sm">
                      {adminUser?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
