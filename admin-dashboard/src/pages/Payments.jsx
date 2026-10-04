import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  CreditCard, IndianRupee, RefreshCw, Search,
  CheckCircle, XCircle, Clock, AlertTriangle,
  Download, Filter, ChevronLeft, ChevronRight,
  Smartphone, QrCode, RotateCcw, Eye, Flag
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const STATUS_CONFIG = {
  PENDING:         { label: 'Pending',         color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',  icon: Clock },
  RIDER_CONFIRMED: { label: 'Rider Confirmed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       icon: Smartphone },
  DRIVER_VERIFIED: { label: 'Verified',        color: 'bg-green-500/20 text-green-400 border-green-500/30',    icon: CheckCircle },
  PAID:            { label: 'Paid',            color: 'bg-green-600/20 text-green-300 border-green-600/30',    icon: CheckCircle },
  FAILED:          { label: 'Failed',          color: 'bg-red-500/20 text-red-400 border-red-500/30',          icon: XCircle },
  REFUNDED:        { label: 'Refunded',        color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: RotateCcw },
}

const METHOD_CONFIG = {
  QR_UPI:   { label: 'UPI / QR',  icon: QrCode,     color: 'text-orange-400' },
  RAZORPAY: { label: 'Razorpay', icon: CreditCard,  color: 'text-blue-400' },
  CASH:     { label: 'Cash',     icon: IndianRupee, color: 'text-green-400' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function MethodBadge({ method }) {
  const cfg = METHOD_CONFIG[method] || { label: method, icon: CreditCard, color: 'text-gray-400' }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function RefundModal({ payment, onClose, onRefunded }) {
  const [amount, setAmount]   = useState(payment?.amount || '')
  const [reason, setReason]   = useState('Customer requested refund')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API}/api/v1/admin/payments/${payment.id}/refund`,
        { amount: parseFloat(amount), reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Refund processed successfully')
      onRefunded()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-1">Process Refund</h3>
        <p className="text-sm text-slate-400 mb-5">
          Ride #{payment?.ride?.rideNumber || '—'} · Original: ₹{payment?.amount}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Refund Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              max={payment?.amount}
              className="w-full bg-[#1A2540] border border-[#1F2E4D] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1565C0]"
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank or full amount for complete refund</p>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-[#1A2540] border border-[#1F2E4D] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1565C0]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#1F2E4D] text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-[#1565C0] text-white font-semibold hover:bg-[#1976D2] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {loading ? 'Processing…' : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Payments() {
  const [payments, setPayments]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterFlagged, setFilterFlagged] = useState(false)
  const [refundTarget, setRefundTarget] = useState(null)
  const [stats, setStats]             = useState({ pending: 0, verified: 0, failed: 0, refunded: 0 })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const token  = localStorage.getItem('token')
      const params = { page, pageSize: 20 }
      if (filterStatus)  params.status  = filterStatus
      if (filterMethod)  params.method  = filterMethod
      if (filterFlagged) params.flagged = true

      const res = await axios.get(`${API}/api/v1/admin/payments`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      })
      const d = res.data.data
      setPayments(d.payments)
      setTotal(d.total)
      setTotalPages(d.totalPages)
      setTotalRevenue(d.totalRevenue || 0)

      // Compute status stats
      const statusMap = { pending: 0, verified: 0, failed: 0, refunded: 0 }
      d.payments.forEach(p => {
        if (p.status === 'PENDING' || p.status === 'RIDER_CONFIRMED') statusMap.pending++
        else if (p.status === 'DRIVER_VERIFIED' || p.status === 'PAID') statusMap.verified++
        else if (p.status === 'FAILED') statusMap.failed++
        else if (p.status === 'REFUNDED') statusMap.refunded++
      })
      setStats(statusMap)
    } catch (err) {
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterMethod, filterFlagged])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const exportCSV = () => {
    const headers = ['ID', 'Ride#', 'Rider', 'Driver', 'Amount', 'Method', 'Status', 'Date']
    const rows = payments.map(p => [
      p.id.slice(0, 8),
      p.ride?.rideNumber || '',
      p.ride?.rider?.name || '',
      p.ride?.driver?.user?.name || '',
      p.amount,
      p.method,
      p.status,
      new Date(p.createdAt).toLocaleDateString('en-IN')
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `volzo-payments-${Date.now()}.csv`; a.click()
    toast.success('CSV exported')
  }

  const filtered = search
    ? payments.filter(p =>
        p.ride?.rideNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.ride?.rider?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase())
      )
    : payments

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-slate-400 text-sm mt-1">Manage all ride payments, refunds & fraud flags</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchPayments} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1F2E4D] text-slate-400 hover:text-white transition-colors text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1565C0] text-white hover:bg-[#1976D2] transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: 'from-[#1565C0] to-[#0D47A1]', light: 'text-blue-300' },
          { label: 'Pending',       value: stats.pending,   icon: Clock,        color: 'from-yellow-600/30 to-yellow-800/20', light: 'text-yellow-400' },
          { label: 'Verified',      value: stats.verified,  icon: CheckCircle,  color: 'from-green-600/30 to-green-800/20',  light: 'text-green-400' },
          { label: 'Refunded',      value: stats.refunded,  icon: RotateCcw,    color: 'from-purple-600/30 to-purple-800/20', light: 'text-purple-400' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className={`bg-gradient-to-br ${s.color} border border-white/5 rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
                <Icon className={`w-5 h-5 ${s.light}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search ride #, rider name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#1A2540] border border-[#1F2E4D] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1565C0]"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="bg-[#1A2540] border border-[#1F2E4D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#1565C0]"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>

          {/* Method filter */}
          <select
            value={filterMethod}
            onChange={e => { setFilterMethod(e.target.value); setPage(1) }}
            className="bg-[#1A2540] border border-[#1F2E4D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#1565C0]"
          >
            <option value="">All Methods</option>
            <option value="QR_UPI">UPI / QR</option>
            <option value="RAZORPAY">Razorpay</option>
          </select>

          {/* Flagged filter */}
          <button
            onClick={() => { setFilterFlagged(f => !f); setPage(1) }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${filterFlagged ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-[#1F2E4D] text-slate-400 hover:text-white'}`}
          >
            <Flag className="w-4 h-4" />
            {filterFlagged ? 'Showing Flagged' : 'Show Flagged'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0E1524] border border-[#1F2E4D] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2E4D]">
                {['Ride #', 'Rider', 'Driver', 'Amount', 'Method', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 uppercase tracking-wider px-5 py-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2E4D]/50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-[#1A2540] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-500">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No payments found</p>
                  </td>
                </tr>
              ) : filtered.map(payment => (
                <tr key={payment.id} className={`hover:bg-[#1A2540]/50 transition-colors ${payment.isFlagged ? 'bg-red-500/5' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {payment.isFlagged && <Flag className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      <span className="text-white font-mono text-sm font-medium">
                        {payment.ride?.rideNumber || payment.id.slice(0, 8)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white text-sm">{payment.ride?.rider?.name || '—'}</p>
                    <p className="text-slate-500 text-xs">{payment.ride?.rider?.phoneNumber}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white text-sm">{payment.ride?.driver?.user?.name || '—'}</p>
                    <p className="text-slate-500 text-xs">{payment.ride?.driver?.user?.phoneNumber}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white font-semibold text-sm">₹{payment.amount}</p>
                    {payment.refundAmount && (
                      <p className="text-purple-400 text-xs">Refunded: ₹{payment.refundAmount}</p>
                    )}
                  </td>
                  <td className="px-5 py-4"><MethodBadge method={payment.method} /></td>
                  <td className="px-5 py-4"><StatusBadge status={payment.status} /></td>
                  <td className="px-5 py-4">
                    <p className="text-slate-300 text-sm">{new Date(payment.createdAt).toLocaleDateString('en-IN')}</p>
                    <p className="text-slate-500 text-xs">{new Date(payment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {/* Refund button — show for verified payments that haven't been refunded */}
                      {['DRIVER_VERIFIED', 'PAID'].includes(payment.status) && payment.method === 'RAZORPAY' && (
                        <button
                          onClick={() => setRefundTarget(payment)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors text-xs font-medium"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Refund
                        </button>
                      )}
                      {payment.isFlagged && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Fraud
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#1F2E4D]">
            <p className="text-sm text-slate-400">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-[#1F2E4D] text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-2 text-sm text-white">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-[#1F2E4D] text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refund Modal */}
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRefunded={fetchPayments}
        />
      )}
    </div>
  )
}
