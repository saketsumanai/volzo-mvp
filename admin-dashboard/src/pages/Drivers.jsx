import { useEffect, useState } from 'react'
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  X, 
  Eye, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  User, 
  DollarSign, 
  Car, 
  Star, 
  MapPin, 
  MessageSquare,
  Sparkles,
  ExternalLink,
  Ban
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [driverDossier, setDriverDossier] = useState(null)
  const [loadingDossier, setLoadingDossier] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Pre-registration state fields
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newLicense, setNewLicense] = useState('')
  const [newVehicleType, setNewVehicleType] = useState('EV_SCOOTER')
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newVehicleModel, setNewVehicleModel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDrivers()
  }, [filter])

  const handleCreateDriver = async (e) => {
    e.preventDefault()
    if (!newName || !newPhone) {
      toast.error('Name and phone number are required')
      return
    }

    setSubmitting(true)
    try {
      const response = await axios.post(
        `${API_URL}/admin/drivers`,
        {
          name: newName,
          email: newEmail || undefined,
          phoneNumber: newPhone,
          licenseNumber: newLicense || undefined,
          vehicleType: newVehicleType,
          vehiclePlate: newVehiclePlate || undefined,
          vehicleModel: newVehicleModel || undefined
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success(response.data.message || 'Driver profile activated successfully!')
      setShowAddForm(false)
      // Reset inputs
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      setNewLicense('')
      setNewVehicleType('EV_SCOOTER')
      setNewVehiclePlate('')
      setNewVehicleModel('')
      fetchDrivers()
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to register driver profile'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const fetchDrivers = async () => {
    try {
      const params = filter !== 'ALL' ? { kycStatus: filter } : {}
      const response = await axios.get(`${API_URL}/admin/drivers`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setDrivers(response.data.data.drivers)
    } catch (error) {
      toast.error('Failed to fetch drivers list')
    } finally {
      setLoading(false)
    }
  }

  const fetchDriverDossier = async (driverId) => {
    setLoadingDossier(true)
    try {
      const response = await axios.get(`${API_URL}/admin/drivers/${driverId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      setDriverDossier(response.data.data)
    } catch (error) {
      toast.error('Failed to load driver details')
    } finally {
      setLoadingDossier(false)
    }
  }

  const handleRowClick = (driver) => {
    setSelectedDriver(driver)
    fetchDriverDossier(driver.id)
  }

  const handleKYCAction = async (driverId, action) => {
    setUpdating(true)
    try {
      const token = localStorage.getItem('token')
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

      if (action === 'APPROVE') {
        await axios.post(
          `${API_BASE}/api/v1/admin/kyc/${driverId}/approve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('✅ KYC Approved! Driver can now go online.')
      } else {
        if (!rejectionReason.trim()) {
          toast.error('Please provide a rejection reason')
          setUpdating(false)
          return
        }
        await axios.post(
          `${API_BASE}/api/v1/admin/kyc/${driverId}/reject`,
          { reason: rejectionReason },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('KYC Rejected — driver notified')
      }

      setRejectionReason('')
      setShowRejectForm(false)
      setSelectedDriver(null)
      setDriverDossier(null)
      fetchDrivers()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update KYC status')
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateUserStatus = async (userId, nextStatus) => {
    try {
      await axios.patch(
        `${API_URL}/admin/users/${userId}/status`,
        { status: nextStatus },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      toast.success(`Driver user is now ${nextStatus.toLowerCase()}`)
      if (selectedDriver) {
        fetchDriverDossier(selectedDriver.id)
      }
      fetchDrivers()
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  const filteredDrivers = drivers.filter(d => {
    const term = search.toLowerCase()
    return d.user.name?.toLowerCase().includes(term) ||
           d.user.phoneNumber?.includes(term) ||
           d.licenseNumber?.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Drivers Control Center <Sparkles className="h-5 w-5 text-[#00D9FF] text-glow-cyan" />
          </h2>
          <p className="text-gray-400 mt-1">Manage driver registrations, review KYC credentials, and verify vehicles.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors shadow-neon-blue font-semibold text-sm mr-2"
          >
            Add Driver
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search driver name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-[#1F2E4D] bg-[#131B2E] text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all w-64"
            />
          </div>
          <div className="flex gap-1.5 border border-[#1F2E4D] rounded-xl p-1 bg-[#0B0F19]">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === status
                    ? 'bg-[#0066FF] text-white shadow-neon-blue'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF]"></div>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-[#263554]/60 shadow-sm max-w-lg mx-auto">
          <Car className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No Drivers Found</h3>
          <p className="text-gray-400 mt-2">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="glass-panel border border-[#263554]/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0E1524]/60">
                <tr className="border-b border-[#1F2E4D]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Driver Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">KYC Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicles</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Rating / Rides</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E4D]/60">
                {filteredDrivers.map((driver) => (
                  <tr 
                    key={driver.id}
                    onClick={() => handleRowClick(driver)}
                    className="hover:bg-[#1E293B]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-[#00D9FF]">
                          {driver.user.profileImage ? (
                            <img src={`http://localhost:3000${driver.user.profileImage}`} alt={driver.user.name} className="w-full h-full object-cover" />
                          ) : (
                            driver.user.name?.charAt(0) || 'D'
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-white">{driver.user.name}</div>
                          <div className="text-xs text-gray-400 font-mono">ID: {driver.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {driver.user.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded-full border ${
                        driver.kycStatus === 'APPROVED' ? 'bg-emerald-500/10 text-[#5FD068] border-emerald-500/20' :
                        driver.kycStatus === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {driver.kycStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {driver.vehicles && driver.vehicles.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-white">{driver.vehicles[0].model}</span>
                          <span className="text-xs font-mono text-gray-400">{driver.vehicles[0].registrationNumber}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-xs font-semibold">No active vehicle</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-bold">{parseFloat(driver.rating).toFixed(1)}</span>
                        <span className="text-gray-400 text-xs font-normal">({driver.totalRides} rides)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                      <button className="text-[#00D9FF] hover:text-white px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all font-bold flex items-center gap-1 ml-auto">
                        <span>Review File</span>
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

      {/* Exquisite Sliding Driver Dossier Panel */}
      <AnimatePresence>
        {selectedDriver && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedDriver(null); setDriverDossier(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#0E1524] border-l border-[#1F2E4D] shadow-2xl z-50 flex flex-col text-white"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1F2E4D] flex justify-between items-center bg-[#0B0F19]/40">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-blue-500/10 border border-blue-500/20 text-[#00D9FF] flex items-center justify-center font-black text-lg">
                    {selectedDriver.user.profileImage ? (
                      <img src={`http://localhost:3000${selectedDriver.user.profileImage}`} alt={selectedDriver.user.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedDriver.user.name?.charAt(0) || 'D'
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedDriver.user.name}</h3>
                    <p className="text-xs text-gray-400">Registered: {new Date(selectedDriver.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {driverDossier?.driver?.user?.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleUpdateUserStatus(selectedDriver.userId, 'SUSPENDED')}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1 text-xs font-bold"
                      title="Suspend Driver"
                    >
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </button>
                  ) : driverDossier?.driver?.user?.status === 'SUSPENDED' && (
                    <button
                      onClick={() => handleUpdateUserStatus(selectedDriver.userId, 'ACTIVE')}
                      className="p-2 rounded-xl bg-emerald-500/10 text-[#5FD068] border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 text-xs font-bold"
                      title="Activate User"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Activate
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedDriver(null); setDriverDossier(null); }}
                    className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Dossier Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingDossier ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D9FF]"></div>
                    <span className="text-xs text-gray-400">Loading complete dossier file...</span>
                  </div>
                ) : driverDossier && (
                  <>
                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-3 gap-4 border-b border-[#1F2E4D] pb-6">
                      <div className="bg-blue-500/5 p-4 rounded-xl text-center border border-blue-500/10">
                        <DollarSign className="h-5 w-5 text-[#00D9FF] mx-auto mb-1 text-glow-cyan" />
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Earnings</span>
                        <span className="text-lg font-bold text-white mt-1 block">₹{parseFloat(driverDossier.analytics?.driverPayout || 0).toFixed(0)}</span>
                      </div>
                      <div className="bg-amber-500/5 p-4 rounded-xl text-center border border-amber-500/10">
                        <Star className="h-5 w-5 text-amber-500 mx-auto mb-1 fill-current" />
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Rating</span>
                        <span className="text-lg font-bold text-white mt-1 block">⭐ {parseFloat(driverDossier.driver?.rating || 0).toFixed(1)}</span>
                      </div>
                      <div className="bg-purple-500/5 p-4 rounded-xl text-center border border-purple-500/10">
                        <MapPin className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total Rides</span>
                        <span className="text-lg font-bold text-white mt-1 block">{driverDossier.driver?.totalRides} Rides</span>
                      </div>
                    </div>

                    {/* KYC Document Inspector */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">KYC Document Credentials</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {/* License Card */}
                        <div className="border border-[#1F2E4D] rounded-xl p-4 space-y-2.5 bg-[#131B2E] flex flex-col justify-between">
                          <div>
                            <span className="text-2xs font-bold text-[#94A3B8] block">Driving License No.</span>
                            <span className="text-sm font-bold font-mono text-[#00D9FF] mt-0.5 block">{driverDossier.driver?.licenseNumber || 'Not submitted'}</span>
                          </div>
                          {driverDossier.driver?.licenseImage ? (
                            <div className="relative rounded-lg overflow-hidden group border border-[#1F2E4D] shadow-sm">
                              <img src={`http://localhost:3000${driverDossier.driver.licenseImage}`} alt="DL" className="w-full h-24 object-cover" />
                              <a href={`http://localhost:3000${driverDossier.driver.licenseImage}`} target="_blank" rel="noreferrer" className="absolute top-2 right-2 p-1 bg-[#0E1524]/90 rounded text-white hover:text-[#00D9FF] border border-[#1F2E4D] flex items-center gap-1 font-bold text-[9px] transition-all"><ExternalLink className="h-2.5 w-2.5" /> View</a>
                            </div>
                          ) : (
                            <div className="rounded-lg bg-[#0B0F19] p-4 text-center text-2xs text-gray-500 italic">No DL image</div>
                          )}
                        </div>

                        {/* RC Document Card */}
                        <div className="border border-[#1F2E4D] rounded-xl p-4 space-y-2.5 bg-[#131B2E] flex flex-col justify-between">
                          <div>
                            <span className="text-2xs font-bold text-[#94A3B8] block">Vehicle Registration (RC Book)</span>
                            <span className="text-sm font-bold font-mono text-[#00D9FF] mt-0.5 block">
                              {driverDossier.driver?.vehicles?.[0]?.registrationNumber || 'Not submitted'}
                            </span>
                          </div>
                          {driverDossier.driver?.vehicles?.[0]?.rcImage ? (
                            <div className="relative rounded-lg overflow-hidden group border border-[#1F2E4D] shadow-sm">
                              <img src={`http://localhost:3000${driverDossier.driver.vehicles[0].rcImage}`} alt="RC" className="w-full h-24 object-cover" />
                              <a href={`http://localhost:3000${driverDossier.driver.vehicles[0].rcImage}`} target="_blank" rel="noreferrer" className="absolute top-2 right-2 p-1 bg-[#0E1524]/90 rounded text-white hover:text-[#00D9FF] border border-[#1F2E4D] flex items-center gap-1 font-bold text-[9px] transition-all"><ExternalLink className="h-2.5 w-2.5" /> View</a>
                            </div>
                          ) : (
                            <div className="rounded-lg bg-[#0B0F19] p-4 text-center text-2xs text-gray-500 italic">No RC image</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Associated Vehicle Details */}
                    {driverDossier.driver?.vehicles && driverDossier.driver.vehicles.length > 0 ? (
                      <div className="border-t border-[#1F2E4D] pt-4 space-y-2.5">
                        <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Associated Vehicle Listings</h4>
                        {driverDossier.driver.vehicles.map((v) => (
                          <div key={v.id} className="p-4 rounded-xl border border-[#1F2E4D] bg-[#131B2E] flex justify-between items-center">
                            <div>
                              <p className="text-sm font-semibold text-white">{v.model}</p>
                              <p className="text-xs font-mono text-gray-400 mt-0.5">{v.registrationNumber} • <span className="capitalize font-sans font-bold text-[#00D9FF]">{v.vehicleType.toLowerCase().replace('_', ' ')}</span></p>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded-lg border ${
                              v.isVerified ? 'bg-emerald-500/10 text-[#5FD068] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {v.isVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                              {v.isVerified ? 'VERIFIED' : 'PENDING'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-t border-[#1F2E4D] pt-4">
                        <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicle Listings</h4>
                        <div className="rounded-xl border border-dashed border-[#1F2E4D] p-4 text-center text-gray-500 text-xs mt-2 bg-[#131B2E]/30">
                          No vehicle registered yet by this driver.
                        </div>
                      </div>
                    )}

                    {/* Ride History */}
                    <div className="border-t border-[#1F2E4D] pt-4 space-y-2.5">
                      <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Ride Transactions History</h4>
                      {driverDossier.driver?.rides && driverDossier.driver.rides.length > 0 ? (
                        <div className="space-y-2">
                          {driverDossier.driver.rides.map((ride) => (
                            <div key={ride.id} className="p-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl flex items-center justify-between text-xs hover:border-[#00D9FF]/40 transition-colors">
                              <div>
                                <p className="font-semibold text-white truncate max-w-[240px]">{ride.pickupLocation ? (typeof ride.pickupLocation === 'string' ? JSON.parse(ride.pickupLocation).address : ride.pickupLocation.address) : 'NCR Region'}</p>
                                <p className="text-gray-400 mt-0.5 font-mono">{new Date(ride.createdAt).toLocaleDateString()} • {ride.rideNumber}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-[#00D9FF]">₹{parseFloat(ride.finalFare || ride.estimatedFare || 0).toFixed(0)}</p>
                                <span className={`text-[10px] font-bold uppercase ${
                                  ride.status === 'COMPLETED' || ride.status === 'PAYMENT_VERIFIED' ? 'text-[#5FD068]' : 'text-red-400'
                                }`}>
                                  {ride.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#1F2E4D] p-4 text-center text-gray-500 text-xs bg-[#131B2E]/30">
                          No ride transactions completed yet.
                        </div>
                      )}
                    </div>

                    {/* Driver Reviews */}
                    <div className="border-t border-[#1F2E4D] pt-4 space-y-2.5">
                      <h4 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Rider Ratings & Feedback</h4>
                      {driverDossier.reviews && driverDossier.reviews.length > 0 ? (
                        <div className="space-y-2">
                          {driverDossier.reviews.map((rev) => (
                            <div key={rev.id} className="p-3 bg-[#131B2E] border border-[#1F2E4D] rounded-xl space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-white">{rev.rider?.name || 'Rider'}</span>
                                <div className="flex items-center text-amber-500 gap-0.5">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span className="font-bold">{rev.rating}</span>
                                </div>
                              </div>
                              {rev.comment && <p className="text-xs text-gray-400 italic">"{rev.comment}"</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#1F2E4D] p-4 text-center text-gray-500 text-xs bg-[#131B2E]/30">
                          No rider reviews published yet.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Dossier Actions Footer */}
              {selectedDriver && selectedDriver.kycStatus === 'PENDING' && (
                <div className="p-4 border-t border-[#1F2E4D] flex flex-col gap-3 bg-[#0B0F19]/40">
                  {showRejectForm ? (
                    <div className="w-full space-y-3">
                      <textarea
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="State reason for rejecting driver KYC..."
                        className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowRejectForm(false)}
                          className="flex-1 px-4 py-2.5 border border-[#1F2E4D] rounded-xl text-xs font-bold hover:bg-[#1E293B]/50 transition-colors text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleKYCAction(selectedDriver.id, 'REJECT')}
                          disabled={updating || !rejectionReason.trim()}
                          className="flex-1 px-4 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-lg shadow-red-550/20"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 px-4 py-3 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 rounded-xl font-bold transition-all text-xs"
                      >
                        Reject KYC File
                      </button>
                      <button
                        onClick={() => handleKYCAction(selectedDriver.id, 'APPROVE')}
                        disabled={updating}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] hover:from-[#0052CC] hover:to-[#00B4D8] text-white rounded-xl font-bold shadow-neon-blue transition-all text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="h-4.5 w-4.5" /> Approve & Activate Driver
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pre-Register Driver Slide Drawer */}
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
                  Add New Driver <Sparkles className="h-5 w-5 text-[#00D9FF]" />
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleCreateDriver} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Driver Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Phone Number</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="E.g. +919876543210"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="E.g. driver@volzo.com"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">License Number</label>
                  <input
                    type="text"
                    value={newLicense}
                    onChange={(e) => setNewLicense(e.target.value)}
                    placeholder="E.g. DL-1420110123456"
                    className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all font-mono uppercase"
                  />
                </div>

                <div className="border-t border-[#1F2E4D] pt-4 space-y-4">
                  <h4 className="text-sm font-bold text-white">Vehicle Assignment</h4>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Vehicle Class</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewVehicleType('EV_SCOOTER')}
                        className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                          newVehicleType === 'EV_SCOOTER'
                            ? 'border-[#00D9FF] bg-blue-500/10 text-[#00D9FF]'
                            : 'border-[#1F2E4D] hover:bg-[#1E293B]/50 text-[#94A3B8]'
                        }`}
                      >
                        EV Scooter
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewVehicleType('E_RICKSHAW')}
                        className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                          newVehicleType === 'E_RICKSHAW'
                            ? 'border-[#00D9FF] bg-blue-500/10 text-[#00D9FF]'
                            : 'border-[#1F2E4D] hover:bg-[#1E293B]/50 text-[#94A3B8]'
                        }`}
                      >
                        E-Rickshaw
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">License Plate</label>
                      <input
                        type="text"
                        value={newVehiclePlate}
                        onChange={(e) => setNewVehiclePlate(e.target.value)}
                        placeholder="E.g. DL-1CE-1234"
                        className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all font-mono uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Model Name</label>
                      <input
                        type="text"
                        value={newVehicleModel}
                        onChange={(e) => setNewVehicleModel(e.target.value)}
                        placeholder="E.g. Volzo S2"
                        className="w-full bg-[#131B2E] border border-[#1F2E4D] rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00D9FF]/20 focus:border-[#00D9FF] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-3.5 bg-gradient-to-r from-[#0066FF] to-[#00D9FF] text-white rounded-xl font-semibold shadow-neon-blue transition-all text-sm disabled:opacity-50 hover:from-[#0052CC] hover:to-[#00B4D8]"
                  >
                    {submitting ? 'Activating Profile...' : 'Pre-Register & Approve Driver'}
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
