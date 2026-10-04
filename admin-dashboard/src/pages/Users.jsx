import { useEffect, useState } from 'react'
import { Search, Filter, Plus, X, Sparkles, User, Mail, Phone, Calendar, Clock, Lock, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Pre-registration form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/users`, {
        params: { page, limit: 20, search },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setUsers(response.data.data.users)
      setTotalPages(response.data.data.pagination.pages)
    } catch (error) {
      toast.error('Failed to fetch riders directory')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleCreateRider = async (e) => {
    e.preventDefault()
    if (!name || !phoneNumber) {
      toast.error('Name and phone number are required')
      return
    }

    setSubmitting(true)
    try {
      const response = await axios.post(
        `${API_URL}/admin/users`,
        { name, email: email || undefined, phoneNumber },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success(response.data.message || 'Rider pre-registered successfully!')
      setShowAddForm(false)
      // Reset form
      setName('')
      setEmail('')
      setPhoneNumber('')
      fetchUsers()
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to register rider profile'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Riders Directory <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Manage and pre-register active passenger accounts.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors shadow-neon-blue font-semibold text-sm mr-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Rider</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search rider name, phone..."
              value={search}
              onChange={handleSearch}
              className="pl-10 pr-4 py-2.5 border border-[#1F2E4D] bg-[#131B2E] text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all w-64"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-[#263554]/60 shadow-sm max-w-lg mx-auto">
          <User className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No Riders Recorded</h3>
          <p className="text-gray-400 mt-2">Create rider accounts to allow passengers to log in instantly on mobile.</p>
        </div>
      ) : (
        <div className="glass-panel border border-[#263554]/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0E1524]/60">
                <tr className="border-b border-[#1F2E4D]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Passenger Dossier</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Phone Link</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Account status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E4D]/60">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1E293B]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0066FF] to-[#00D9FF] flex items-center justify-center text-white font-semibold border border-[#1F2E4D]">
                          {user.name?.charAt(0) || 'R'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-white">
                            {user.name || 'Unnamed Passenger'}
                          </div>
                          <div className="text-xs text-gray-400">{user.email || 'No email synced'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                      {user.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-gray-400 font-medium">
            Page <span className="text-white font-bold">{page}</span> of <span className="text-white font-bold">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-[#1F2E4D] bg-[#131B2E] text-xs font-semibold text-white rounded-xl hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-[#1F2E4D] bg-[#131B2E] text-xs font-semibold text-white rounded-xl hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Rider Slide Drawer */}
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
                  Add New Rider <Sparkles className="h-5 w-5 text-[#00D9FF]" />
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleCreateRider} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Rider Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="E.g. +919876543210"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E.g. passenger@volzo.com"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-gray-300">
                  <Info className="w-5 h-5 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                  <p>
                    Pre-registered rider accounts bypass SMS registration prompts. Registered passengers can instantly authenticate inside the Rider mobile app.
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-3.5 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white rounded-xl font-semibold shadow-neon-blue transition-all text-sm disabled:opacity-50 hover:from-[#0052CC] hover:to-[#00B4D8]"
                  >
                    {submitting ? 'Registering Passenger...' : 'Pre-Register Passenger'}
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
