import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  getRide, getPaymentByRide, initiatePayment, confirmPayment, 
  createRazorpayOrder, verifyRazorpayPayment, getErrMsg 
} from '../services/api'
import api from '../services/api'
import { useRideStore } from '../store/rideStore'
import { 
  ArrowLeft, CheckCircle, QrCode, Upload, CreditCard, 
  MapPin, Clock, Calendar, Landmark, Info, Star, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PaymentPage() {
  const { rideId } = useParams()
  const navigate = useNavigate()
  const resetActiveRide = useRideStore((s) => s.resetActiveRide)

  const [ride, setRide] = useState(null)
  const [payment, setPayment] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [screenshotBase64, setScreenshotBase64] = useState('')
  const [screenshotName, setScreenshotName] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [showRatingPage, setShowRatingPage] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false)

  // Fetch ride and setup/verify payment
  useEffect(() => {
    const loadPaymentData = async () => {
      try {
        setIsLoading(true)
        
        // 1. Fetch Ride details
        const rideRes = await getRide(rideId)
        if (!rideRes.data?.success || !rideRes.data.data.ride) {
          toast.error('Ride details not found')
          navigate('/home')
          return
        }
        
        const rideObj = rideRes.data.data.ride
        setRide(rideObj)

        // 2. Fetch existing Payment record or initiate a new one
        try {
          const payRes = await getPaymentByRide(rideId)
          if (payRes.data?.success && payRes.data.data.payment) {
            setPayment(payRes.data.data.payment)
            if (payRes.data.data.payment.status === 'PAID' || payRes.data.data.payment.status === 'VERIFIED') {
              setPaymentSuccess(true)
            }
          } else {
            // Initiate a new payment
            try {
              const initRes = await initiatePayment(rideId)
              if (initRes.data?.success && initRes.data.data.payment) {
                setPayment(initRes.data.data.payment)
              }
            } catch (initErr) {
              console.warn('Could not initiate payment, continuing with ride data', initErr)
            }
          }
        } catch (payErr) {
          // If fetch fails, try to initiate
          try {
            const initRes = await initiatePayment(rideId)
            if (initRes.data?.success && initRes.data.data.payment) {
              setPayment(initRes.data.data.payment)
            }
          } catch (initErr2) {
            console.warn('Could not initiate payment record', initErr2)
          }
        }

      } catch (err) {
        toast.error('Failed to load receipt details')
        navigate('/home')
      } finally {
        setIsLoading(false)
      }
    }

    loadPaymentData()
  }, [rideId, navigate])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('File is too large. Max limit is 4MB.')
      return
    }

    setScreenshotName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshotBase64(reader.result)
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }

  const handleRazorpayPayment = async () => {
    try {
      setIsSubmitting(true)
      toast.loading('Initializing Razorpay Checkout...', { id: 'razorpay' })

      const res = await createRazorpayOrder(rideId)
      if (!res.data?.success || !res.data?.data) {
        toast.error('Failed to initiate Razorpay order', { id: 'razorpay' })
        setIsSubmitting(false)
        return
      }

      const order = res.data.data
      const isLoaded = await loadRazorpayScript()

      if (!isLoaded || !window.Razorpay) {
        toast.dismiss('razorpay')
        toast.error('Razorpay SDK failed to load. Please check network.')
        setIsSubmitting(false)
        return
      }

      toast.dismiss('razorpay')

      const options = {
        key: order.keyId || 'rzp_test_volzo_key_id',
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Volzo Mobility',
        description: `Ride Fare payment for ${order.rideNumber}`,
        image: '/volzo-logo.svg',
        order_id: order.orderId,
        handler: async function (response) {
          try {
            toast.loading('Verifying Razorpay payment...', { id: 'verify_razorpay' })
            const verifyRes = await verifyRazorpayPayment({
              rideId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            if (verifyRes.data?.success) {
              toast.success('Payment successful! 🎉', { id: 'verify_razorpay' })
              setPaymentSuccess(true)
              resetActiveRide()
              setTimeout(() => setShowRatingPage(true), 800)
            } else {
              toast.error('Payment verification failed', { id: 'verify_razorpay' })
            }
          } catch (vErr) {
            toast.error(getErrMsg(vErr), { id: 'verify_razorpay' })
          } finally {
            setIsSubmitting(false)
          }
        },
        prefill: {
          name: order.riderName,
          contact: order.riderPhone
        },
        theme: {
          color: '#0040C8'
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        toast.error(response.error?.description || 'Payment Failed')
        setIsSubmitting(false)
      })
      rzp.open()
    } catch (err) {
      toast.error(getErrMsg(err), { id: 'razorpay' })
      setIsSubmitting(false)
    }
  }

  const handleSubmitPayment = async (e) => {
    e.preventDefault()

    if (!screenshotBase64) {
      toast.error('Please upload payment receipt screenshot')
      return
    }

    setIsSubmitting(true)
    toast.loading('Submitting payment details...', { id: 'pay' })

    try {
      if (payment) {
        const res = await confirmPayment(payment.id, {
          screenshotUrl: screenshotBase64,
          upiTransactionId: transactionId || `TXN-${Date.now()}`
        })

        if (res.data?.success) {
          toast.success('Payment submitted for verification!', { id: 'pay' })
          setPaymentSuccess(true)
          resetActiveRide()
          // Show rating page after a small delay
          setTimeout(() => setShowRatingPage(true), 800)
        } else {
          toast.error('Failed to submit payment details', { id: 'pay' })
        }
      } else {
        // No payment record, just mark as paid locally and show success
        toast.success('Payment confirmed! Thank you!', { id: 'pay' })
        setPaymentSuccess(true)
        resetActiveRide()
        setTimeout(() => setShowRatingPage(true), 800)
      }
    } catch (err) {
      toast.error(getErrMsg(err), { id: 'pay' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitRating = async () => {
    setIsRatingSubmitting(true)
    try {
      // Try to submit rating (non-blocking)
      await api.post(`/rides/${rideId}/rate`, {
        rating: selectedRating,
        comment: ratingComment
      })
      toast.success('Thanks for your feedback! ⭐')
    } catch (err) {
      // Ignore rating errors - not critical
      console.warn('Rating submission failed:', err)
    } finally {
      setIsRatingSubmitting(false)
      navigate('/home')
    }
  }

  if (isLoading) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const upiId = import.meta.env.VITE_UPI_ID || '8102964108@ptsbi'
  const upiName = import.meta.env.VITE_UPI_NAME || 'SAKET SUMAN'
  const finalAmount = ride?.finalFare || ride?.estimatedFare || 0

  // Construct standard dynamic UPI url
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${finalAmount}&cu=INR&tn=Volzo-Ride-${ride?.rideNumber || 'Ride'}`
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(upiUrl)}`

  // ── Rating Page (shown after payment success) ────────────────────────
  if (paymentSuccess && showRatingPage) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        overflow: 'hidden'
      }} className="fade-in">
        
        {/* Header */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          textAlign: 'center'
        }} className="safe-top">
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Rate Your Experience</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Help us improve Volzo rides</p>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Driver Card */}
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Blue-White Check Animation */}
            <div style={{
              width: '80px', height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0066FF 0%, #00B8FF 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 12px rgba(0,102,255,0.1)',
              animation: 'pulse 2s infinite'
            }}>
              <CheckCircle size={44} color="white" />
            </div>
            
            <div>
              <h3 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>Trip Completed! 🎉</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {ride?.rideNumber} • ₹{finalAmount}
              </p>
            </div>

            <div style={{
              background: '#F0F9FF',
              borderRadius: '12px',
              padding: '12px 20px',
              border: '1px solid #BAE6FD'
            }}>
              <p style={{ fontSize: '13px', color: '#0369A1', fontWeight: '600' }}>
                🌿 You saved ~1.4kg CO₂ with EV transport!
              </p>
            </div>
          </div>

          {/* Star Rating */}
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '52px', height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0066FF 0%, #00B8FF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'white', fontWeight: 'bold', fontSize: '20px'
              }}>
                {ride?.driver?.user?.name ? ride.driver.user.name[0].toUpperCase() : 'V'}
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {ride?.driver?.user?.name || 'Your Driver'}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>How was your ride?</p>
            </div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    transform: star <= selectedRating ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s'
                  }}
                >
                  <Star
                    size={36}
                    color={star <= selectedRating ? '#F59E0B' : '#D1D5DB'}
                    fill={star <= selectedRating ? '#F59E0B' : 'none'}
                  />
                </button>
              ))}
            </div>

            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
              {selectedRating === 1 ? '😞 Poor' : selectedRating === 2 ? '😕 Fair' : selectedRating === 3 ? '😊 Good' : selectedRating === 4 ? '😄 Great' : '🤩 Excellent!'}
            </p>

            {/* Comment */}
            <div style={{ width: '100%' }}>
              <textarea
                placeholder="Share your experience (optional)..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  minHeight: '80px',
                  background: '#F8FAFC',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '16px 20px', background: 'white', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }} className="safe-bottom">
          <button 
            onClick={() => navigate('/home')}
            style={{
              flex: 1,
              padding: '14px',
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            Skip
          </button>
          <button 
            onClick={handleSubmitRating}
            disabled={isRatingSubmitting}
            className="btn btn-primary"
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isRatingSubmitting ? (
              <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}></div>
            ) : (
              <>⭐ Submit Rating</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Payment Submitted Success Page ────────────────────────────────────
  if (paymentSuccess && !showRatingPage) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: 'white',
        padding: '24px',
        textAlign: 'center'
      }} className="fade-in">
        <div style={{
          width: '100px', height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0066FF 0%, #00B8FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 0 0 20px rgba(0,102,255,0.1)',
          animation: 'pulse 1.5s infinite'
        }}>
          <CheckCircle size={56} color="white" />
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: '900', marginBottom: '8px' }}>Payment Submitted!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '300px', lineHeight: '22px' }}>
          Verifying your payment... You'll be redirected to rate your experience shortly.
        </p>
        <div style={{ marginTop: '24px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  // ── Main Payment Page ─────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--bg)',
      overflow: 'hidden'
    }} className="fade-in">
      
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }} className="safe-top">
        <button 
          onClick={() => navigate('/home')}
          style={{ border: 'none', background: '#F1F5F9', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Ride Payment</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {ride?.rideNumber} — Ride completed ✅
          </p>
        </div>
      </div>

      {/* Scrollable Receipt Body */}
      <div className="scroll-y" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Cost Summary Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.5px' }}>TOTAL TRANSIT FARE</span>
          <h1 style={{ fontSize: '40px', fontWeight: '900', color: 'var(--text-primary)' }}>
            ₹{finalAmount}
          </h1>
          <span className="badge badge-info animate-pulse" style={{ marginTop: '4px' }}>
            Pending Payment
          </span>
        </div>

        {/* Razorpay Gateway Card (Primary Recommended) */}
        <div style={{
          background: 'linear-gradient(135deg, #0040C8 0%, #1D4ED8 100%)',
          borderRadius: '16px',
          padding: '20px',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0,64,200,0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={22} color="white" />
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800' }}>Instant Payment Gateway</h4>
                <p style={{ fontSize: '11px', opacity: 0.85 }}>Cards, UPI, Netbanking & Wallets</p>
              </div>
            </div>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>SECURE</span>
          </div>

          <button
            onClick={handleRazorpayPayment}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '14px',
              background: 'white',
              color: '#0040C8',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {isSubmitting ? (
              <div className="spinner" style={{ borderColor: 'rgba(0,64,200,0.2)', borderTopColor: '#0040C8' }}></div>
            ) : (
              <>
                <ShieldCheck size={18} />
                Pay ₹{finalAmount} via Razorpay
              </>
            )}
          </button>
        </div>

        {/* Dynamic UPI QR Code */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="var(--primary)" />
            <h4 style={{ fontSize: '14px', fontWeight: '800' }}>Scan to Pay via UPI</h4>
          </div>

          {/* QR Code Image */}
          <div style={{
            padding: '8px',
            border: '1.5px solid var(--border)',
            borderRadius: '12px',
            background: '#F8FAFC'
          }}>
            <img 
              src={qrCodeApiUrl} 
              alt="UPI QR Code"
              style={{ width: '200px', height: '200px', display: 'block' }}
              onError={(e) => {
                // Fallback if QR API fails
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div style={{
              width: '200px', height: '200px',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              background: '#F1F5F9',
              borderRadius: '8px'
            }}>
              <QrCode size={48} color="var(--primary)" />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                QR Code<br/>UPI: {upiId}
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontSize: '13px', fontWeight: '700' }}>{upiName}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{upiId}</p>
          </div>

          {/* Pay Now buttons */}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <a 
              href={upiUrl}
              style={{
                flex: 1,
                padding: '10px',
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: '10px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: '700',
                color: '#15803D',
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              📱 Pay Now (App)
            </a>
          </div>
        </div>

        {/* Screenshot Upload Panel */}
        <form onSubmit={handleSubmitPayment} style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '800' }}>Upload Payment Screenshot</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
            Make payment via GPay, PhonePe or Paytm using QR above, take a screenshot, and upload it below.
          </p>

          {/* File picker */}
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: '12px',
            padding: '24px 16px',
            textAlign: 'center',
            background: screenshotBase64 ? 'rgba(0,102,255,0.02)' : '#F8FAFC',
            borderColor: screenshotBase64 ? 'var(--primary)' : 'var(--border)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            {screenshotBase64 && (
              <img 
                src={screenshotBase64} 
                alt="Payment screenshot" 
                style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} 
              />
            )}
            <input 
              type="file"
              accept="image/*"
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                opacity: 0,
                cursor: 'pointer'
              }}
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Upload size={32} color={screenshotBase64 ? 'var(--primary)' : 'var(--text-secondary)'} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: screenshotBase64 ? 'var(--primary)' : 'var(--text-primary)' }}>
                {screenshotName || 'Choose Screenshot File'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Support JPG, PNG up to 4MB
              </span>
            </div>
          </div>

          {/* Transaction ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>UPI Reference ID (Optional)</label>
            <input 
              type="text"
              placeholder="e.g. 12 digit transaction ID"
              className="input"
              style={{ padding: '10px 14px', fontSize: '14px' }}
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value.replace(/\D/g, ''))}
              maxLength="12"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting || !screenshotBase64}
            style={{ marginTop: '8px' }}
          >
            {isSubmitting ? (
              <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}></div>
            ) : (
              'Confirm Upload Receipt ✅'
            )}
          </button>
        </form>

      </div>

    </div>
  )
}
