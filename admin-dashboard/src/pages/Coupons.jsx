import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Ticket, 
  Trash2, 
  Plus, 
  Calendar, 
  Percent, 
  DollarSign, 
  X, 
  Sparkles,
  Info 
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Coupons() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form states
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minRideAmount, setMinRideAmount] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/coupons`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setCoupons(response.data.data.coupons)
    } catch (error) {
      toast.error('Failed to fetch promotional coupons')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCoupon = async (e) => {
    e.preventDefault()
    if (!code || !discountValue) {
      toast.error('Code and discount value are required')
      return
    }

    setSubmitting(true)
    try {
      await axios.post(
        `${API_URL}/admin/coupons`,
        {
          code: code.trim().toUpperCase(),
          discountType,
          discountValue: parseFloat(discountValue),
          maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
          minRideAmount: minRideAmount ? parseFloat(minRideAmount) : 0,
          expiryDate: expiryDate || undefined
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success('Promotional coupon created successfully!')
      setShowAddForm(false)
      // Reset form
      setCode('')
      setDiscountType('PERCENTAGE')
      setDiscountValue('')
      setMaxDiscount('')
      setMinRideAmount('')
      setExpiryDate('')
      fetchCoupons()
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to create coupon'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCoupon = async (couponId) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return

    try {
      await axios.delete(`${API_URL}/admin/coupons/${couponId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      toast.success('Coupon deleted successfully')
      fetchCoupons()
    } catch (error) {
      toast.error('Failed to delete coupon')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Coupons Manager <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Configure user promotion discounts, flat offers, and limits.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors shadow-neon-blue font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>New Coupon</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-[#263554]/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-[#00D9FF] rounded-xl border border-blue-500/20">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Active Campaigns</p>
            <h4 className="text-2xl font-bold text-white mt-1">{coupons.filter(c => c.isActive).length} Coupons</h4>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-[#263554]/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-[#5FD068] rounded-xl border border-emerald-500/20">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Percentage Off</p>
            <h4 className="text-2xl font-bold text-white mt-1">{coupons.filter(c => c.discountType === 'PERCENTAGE').length} Coupons</h4>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-[#263554]/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Flat Cashbacks</p>
            <h4 className="text-2xl font-bold text-white mt-1">{coupons.filter(c => c.discountType === 'FLAT').length} Coupons</h4>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : coupons.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-[#263554]/60 shadow-sm max-w-lg mx-auto">
          <Ticket className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No Coupon Codes</h3>
          <p className="text-gray-400 mt-2">Create promotional campaigns to incentivize active bookings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((coupon) => (
            <motion.div
              key={coupon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-6 border border-[#263554]/60 shadow-sm flex flex-col justify-between hover:border-[#00D9FF]/40 hover:shadow-neon-cyan transition-all duration-300 relative group"
            >
              <div>
                {/* Coupon Header */}
                <div className="flex justify-between items-start">
                  <div className="bg-blue-500/10 text-[#00D9FF] px-3 py-1.5 rounded-lg font-mono font-bold text-sm tracking-wider uppercase border border-blue-500/20 shadow-sm">
                    {coupon.code}
                  </div>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Offer Value */}
                <div className="mt-4">
                  <span className="text-4xl font-black text-white text-glow-blue">
                    {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                  </span>
                  <span className="text-gray-400 text-sm font-semibold ml-1.5 uppercase">Off</span>
                </div>

                {/* Properties */}
                <div className="mt-6 space-y-2 border-t border-[#1F2E4D] pt-4">
                  <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                    <span className="flex items-center gap-1 font-medium"><Info className="h-3.5 w-3.5" /> Min Ride Value</span>
                    <span className="font-bold text-white">₹{coupon.minRideAmount}</span>
                  </div>

                  {coupon.discountType === 'PERCENTAGE' && coupon.maxDiscount && (
                    <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1 font-medium"><DollarSign className="h-3.5 w-3.5" /> Max Discount Limit</span>
                      <span className="font-bold text-white">₹{coupon.maxDiscount}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                    <span className="flex items-center gap-1 font-medium"><Calendar className="h-3.5 w-3.5" /> Expiration</span>
                    <span className="font-bold text-white">
                      {new Date(coupon.expiryDate).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {coupon.isActive ? (
                <div className="mt-6 flex items-center justify-center gap-1 text-xs text-[#5FD068] bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 font-bold">
                  ● Active Campaign
                </div>
              ) : (
                <div className="mt-6 flex items-center justify-center gap-1 text-xs text-gray-400 bg-gray-500/10 border border-gray-500/20 rounded-lg py-1.5 font-bold">
                  Expired
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Slide Drawer for creation */}
      <AnimatePresence>
        {showAddForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0E1524] border-l border-[#1F2E4D] shadow-2xl z-50 flex flex-col text-white"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1F2E4D] flex justify-between items-center bg-[#0B0F19]/40">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Create Coupon <Sparkles className="h-5 w-5 text-[#00D9FF]" />
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleCreateCoupon} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Coupon Code Name</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="E.g. VOLZOEV50, FIRSTMOVE"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all uppercase font-mono font-bold tracking-wider"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Discount Strategy</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENTAGE')}
                      className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                        discountType === 'PERCENTAGE'
                          ? 'border-[#00D9FF] bg-blue-500/10 text-[#00D9FF]'
                          : 'border-[#1F2E4D] hover:bg-[#1E293B]/50 text-[#94A3B8]'
                      }`}
                    >
                      <Percent className="h-4 w-4" /> Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('FLAT')}
                      className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                        discountType === 'FLAT'
                          ? 'border-[#00D9FF] bg-blue-500/10 text-[#00D9FF]'
                          : 'border-[#1F2E4D] hover:bg-[#1E293B]/50 text-[#94A3B8]'
                      }`}
                    >
                      <DollarSign className="h-4 w-4" /> Flat Rupees
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                      {discountType === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'PERCENTAGE' ? 'E.g. 50' : 'E.g. 150'}
                      className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                      min={0.1}
                      max={discountType === 'PERCENTAGE' ? 100 : undefined}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Min Booking Value</label>
                    <input
                      type="number"
                      value={minRideAmount}
                      onChange={(e) => setMinRideAmount(e.target.value)}
                      placeholder="E.g. 100"
                      className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                    />
                  </div>
                </div>

                {discountType === 'PERCENTAGE' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Max Cashback Cap (₹)</label>
                    <input
                      type="number"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      placeholder="E.g. 100 (Optional)"
                      className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Expiry Schedule</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-3.5 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white rounded-xl font-semibold shadow-neon-blue transition-all text-sm disabled:opacity-50 hover:from-[#0052CC] hover:to-[#00B4D8]"
                  >
                    {submitting ? 'Creating Campaign...' : 'Launch Coupon Offer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
