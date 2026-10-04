import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  X, 
  User, 
  ChevronRight, 
  Filter, 
  Sparkles 
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [resolution, setResolution] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchTickets()
  }, [filterStatus])

  const fetchTickets = async () => {
    try {
      const params = filterStatus !== 'ALL' ? { status: filterStatus } : {}
      const response = await axios.get(`${API_URL}/admin/tickets`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setTickets(response.data.data.tickets)
    } catch (error) {
      toast.error('Failed to fetch support tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (ticketId, nextStatus) => {
    setUpdating(true)
    try {
      await axios.patch(
        `${API_URL}/admin/tickets/${ticketId}/status`,
        { status: nextStatus, resolution: resolution.trim() || undefined },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success('Ticket updated successfully')
      setResolution('')
      setSelectedTicket(null)
      fetchTickets()
    } catch (error) {
      toast.error('Failed to update ticket')
    } finally {
      setUpdating(false)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold'
      case 'HIGH': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold'
      case 'MEDIUM': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
      default: return 'bg-blue-500/10 text-[#00D9FF] border border-blue-500/20 font-bold'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'RESOLVED': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
      case 'CLOSED': return <X className="h-4 w-4 text-gray-400" />
      default: return <AlertTriangle className="h-4 w-4 text-red-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Support Tickets <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Review, assign, and resolve user-submitted ticket reports.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === status
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white shadow-neon-blue'
                  : 'bg-[#0B0F19] text-[#94A3B8] border border-[#1F2E4D] hover:bg-[#1E293B]/50 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-[#263554]/60 shadow-sm max-w-lg mx-auto">
          <MessageSquare className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No Tickets Found</h3>
          <p className="text-gray-400 mt-2">All tickets are resolved or no reports match your current filter.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-[#263554]/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0E1524]/60">
                <tr className="border-b border-[#1F2E4D]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Ticket Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Date Created</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E4D]/60">
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-[#1E293B]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-white truncate max-w-xs">{ticket.subject}</div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">#{ticket.ticketNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00D9FF] flex items-center justify-center font-bold text-xs">
                          {ticket.user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{ticket.user.name || 'User'}</div>
                          <div className="text-xs text-gray-400 capitalize">{ticket.user.role.toLowerCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-2xs rounded-lg ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
                        {getStatusIcon(ticket.status)}
                        <span>{ticket.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                      {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                      <button className="text-[#00D9FF] hover:text-white hover:bg-blue-500/20 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-1 ml-auto transition-all font-bold">
                        <span>Review</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket Details Drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0E1524] border-l border-[#1F2E4D] shadow-2xl z-50 flex flex-col text-white"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1F2E4D] flex justify-between items-center bg-[#0B0F19]/40">
                <div>
                  <span className={`px-2.5 py-1 text-2xs rounded-lg ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2 font-mono">Ticket #{selectedTicket.ticketNumber}</h3>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Subject</h4>
                  <p className="text-base font-semibold text-white">{selectedTicket.subject}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Description</h4>
                  <div className="bg-[#131B2E] rounded-xl p-4 border border-[#1F2E4D] text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.description}
                  </div>
                </div>

                <div className="border-t border-[#1F2E4D] pt-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Requester Dossier</h4>
                  <div className="flex items-center gap-3 p-3 bg-[#131B2E]/60 rounded-xl border border-[#1F2E4D]">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00D9FF] flex items-center justify-center font-bold">
                      {selectedTicket.user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedTicket.user.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{selectedTicket.user.phoneNumber} • <span className="capitalize font-sans font-semibold text-[#00D9FF]">{selectedTicket.user.role.toLowerCase()}</span></p>
                    </div>
                  </div>
                </div>

                {selectedTicket.rideId && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Linked Ride ID</h4>
                    <p className="text-xs font-mono bg-[#131B2E] border border-[#1F2E4D] inline-block px-3 py-1.5 rounded-xl select-all text-[#00D9FF]">
                      {selectedTicket.rideId}
                    </p>
                  </div>
                )}

                {selectedTicket.status === 'RESOLVED' && selectedTicket.resolvedAt && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Resolved On</h4>
                    <p className="text-sm text-gray-200 mt-1 font-semibold">
                      {new Date(selectedTicket.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Resolution input for tickets not closed */}
                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <div className="space-y-2 border-t border-[#1F2E4D] pt-4">
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Resolution Details</h4>
                    <textarea
                      rows={4}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Specify resolution findings and customer reply notes..."
                      className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                <div className="p-4 border-t border-[#1F2E4D] flex gap-3 bg-[#0B0F19]/40">
                  {selectedTicket.status === 'OPEN' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')}
                      disabled={updating}
                      className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all text-xs shadow-md disabled:opacity-50"
                    >
                      Assign to Work
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                    disabled={updating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] hover:from-[#0052CC] hover:to-[#00B4D8] text-white rounded-xl font-bold transition-all text-xs shadow-neon-blue disabled:opacity-50"
                  >
                    Mark as Resolved
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
