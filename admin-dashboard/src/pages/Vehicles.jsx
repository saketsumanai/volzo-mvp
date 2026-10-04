import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Car, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  Eye, 
  User, 
  CheckCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchVehicles()
  }, [])

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/drivers`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      // Extract all vehicles from drivers list
      const allDrivers = response.data.data.drivers
      const extractedVehicles = []
      allDrivers.forEach(driver => {
        if (driver.vehicles && driver.vehicles.length > 0) {
          driver.vehicles.forEach(vehicle => {
            extractedVehicles.push({
              ...vehicle,
              driverName: driver.user?.name || 'Driver',
              driverPhone: driver.user?.phoneNumber || 'No phone',
              driverKycStatus: driver.kycStatus
            })
          })
        }
      })
      setVehicles(extractedVehicles)
    } catch (error) {
      toast.error('Failed to fetch vehicle listings')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyVehicle = async (vehicleId, isVerified) => {
    setUpdating(true)
    try {
      await axios.patch(
        `${API_URL}/admin/vehicles/${vehicleId}/verify`,
        { isVerified },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success(`Vehicle verification status marked as ${isVerified ? 'verified' : 'unverified'}`)
      setSelectedVehicle(null)
      fetchVehicles()
    } catch (error) {
      toast.error('Failed to update vehicle verification status')
    } finally {
      setUpdating(false)
    }
  }

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.registrationNumber.toLowerCase().includes(search.toLowerCase()) || 
                         v.model.toLowerCase().includes(search.toLowerCase()) ||
                         v.driverName.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterType === 'ALL' || 
                         (filterType === 'VERIFIED' && v.isVerified) ||
                         (filterType === 'PENDING' && !v.isVerified)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Vehicles Directory <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Verify driver vehicles, PU certificates, and RC listings.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search registration, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-[#1F2E4D] bg-[#131B2E] text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all w-64"
            />
          </div>
          <div className="flex gap-1.5 border border-[#1F2E4D] rounded-xl p-1 bg-[#0B0F19]">
            {['ALL', 'PENDING', 'VERIFIED'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === type 
                    ? 'bg-[#0066FF] text-white shadow-neon-blue' 
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-[#263554]/60 shadow-sm max-w-lg mx-auto">
          <Car className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No Vehicles Found</h3>
          <p className="text-gray-400 mt-2">No vehicle registrations fit your filter criteria.</p>
        </div>
      ) : (
        <div className="glass-panel border border-[#263554]/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0E1524]/60">
                <tr className="border-b border-[#1F2E4D]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicle Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Driver Profile</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Registration No.</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E4D]/60">
                {filteredVehicles.map((v) => (
                  <tr 
                    key={v.id} 
                    onClick={() => setSelectedVehicle(v)}
                    className="hover:bg-[#1E293B]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{v.model}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{v.color || 'Standard'} • {v.year || '2024'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00D9FF] flex items-center justify-center font-bold text-xs">
                          {v.driverName?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{v.driverName}</div>
                          <div className="text-xs text-gray-400">{v.driverPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-2xs font-semibold rounded-lg ${
                        v.vehicleType === 'EV_SCOOTER' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20'
                      }`}>
                        {v.vehicleType === 'EV_SCOOTER' ? 'EV Scooter' : 'E-Rickshaw'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-bold text-white tracking-wide">
                      {v.registrationNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold ${
                        v.isVerified 
                          ? 'bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {v.isVerified ? <ShieldCheck className="h-3.5 w-3.5 text-[#5FD068]" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                        <span>{v.isVerified ? 'VERIFIED' : 'PENDING'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                      <button className="text-[#00D9FF] hover:text-white px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all font-bold flex items-center gap-1 ml-auto">
                        <span>Inspect RC</span>
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Slide Modal */}
      <AnimatePresence>
        {selectedVehicle && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVehicle(null)}
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
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedVehicle.model} Details</h3>
                  <p className="text-xs text-gray-400 mt-1">Verify vehicle and documents authenticity</p>
                </div>
                <button 
                  onClick={() => setSelectedVehicle(null)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Registration Number</h4>
                    <p className="text-sm font-bold font-mono text-[#00D9FF] bg-[#131B2E] border border-[#1F2E4D] p-2.5 rounded-xl block">
                      {selectedVehicle.registrationNumber}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicle Type</h4>
                    <p className="text-sm font-bold text-white bg-[#131B2E] border border-[#1F2E4D] p-2.5 rounded-xl block capitalize">
                      {selectedVehicle.vehicleType === 'EV_SCOOTER' ? 'EV Scooter' : 'E-Rickshaw'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Seats count</h4>
                    <p className="text-sm text-white mt-1 font-semibold">
                      {selectedVehicle.totalSeats} seats
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Color & Year</h4>
                    <p className="text-sm text-white mt-1 font-semibold">
                      {selectedVehicle.color || 'Black'} ({selectedVehicle.year || '2024'})
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#1F2E4D] pt-4">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Linked Driver</h4>
                  <div className="flex items-center gap-3 p-3 bg-[#131B2E]/60 rounded-xl border border-[#1F2E4D] mt-2">
                    <div className="h-10 w-10 bg-blue-500/10 border border-blue-500/20 text-[#00D9FF] rounded-full flex items-center justify-center font-bold">
                      {selectedVehicle.driverName?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedVehicle.driverName}</p>
                      <p className="text-xs text-gray-400">{selectedVehicle.driverPhone}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#1F2E4D] pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Uploaded Documents (RC Book)</h4>
                  {selectedVehicle.rcImage ? (
                    <div className="relative rounded-xl border border-[#1F2E4D] overflow-hidden bg-[#131B2E] group shadow-inner">
                      <img 
                        src={`http://localhost:3000${selectedVehicle.rcImage}`} 
                        alt="Vehicle RC Book"
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600&auto=format&fit=crop"; // Placeholder
                        }}
                      />
                      <a
                        href={`http://localhost:3000${selectedVehicle.rcImage}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-3 right-3 p-2 bg-[#0E1524]/90 text-white hover:text-[#00D9FF] rounded-xl shadow-lg border border-[#1F2E4D] flex items-center gap-1.5 text-xs font-bold transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View Fullscreen
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#1F2E4D] p-6 text-center text-gray-500 text-xs bg-[#131B2E]/30">
                      No RC book document photo was uploaded for this vehicle.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-[#1F2E4D] flex gap-3 bg-[#0B0F19]/40">
                {selectedVehicle.isVerified ? (
                  <button
                    onClick={() => handleVerifyVehicle(selectedVehicle.id, false)}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-750 text-white rounded-xl font-bold transition-colors text-xs disabled:opacity-50"
                  >
                    Revoke Verification
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerifyVehicle(selectedVehicle.id, true)}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] hover:from-[#0052CC] hover:to-[#00B4D8] text-white rounded-xl font-bold shadow-neon-blue transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="h-4.5 w-4.5" /> Verify & Approve Vehicle
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
