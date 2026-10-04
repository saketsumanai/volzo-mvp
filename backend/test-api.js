#!/usr/bin/env node
/**
 * Volzo Full API Test Script
 * Tests every major flow: auth → ride → payment → admin
 */

const BASE = 'http://localhost:3000/api/v1';
let token = null;
let adminToken = null;
let rideId = null;
let paymentId = null;
let driverId = null;

async function req(method, path, body, auth = token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

function pass(label) { console.log(`  ✅ ${label}`); }
function fail(label, detail) { console.log(`  ❌ ${label}: ${detail}`); }
function section(name) { console.log(`\n━━━ ${name} ━━━`); }

async function run() {
  console.log('🧪 Volzo Full API Test\n');

  // ─── HEALTH ───
  section('Health');
  const h = await req('GET', '/auth/me', null, null).catch(() => null);
  const health = await fetch('http://localhost:3000/health').then(r => r.json());
  health.status === 'healthy' ? pass('Server healthy') : fail('Health check', health.status);

  // ─── AUTH (Dev bypass) ───
  section('Authentication');
  const login = await req('POST', '/auth/login', {
    phoneNumber: '+919876543210',
    idToken: 'dev_bypass_token',
    name: 'Test Rider'
  });
  if (login.data.success && login.data.data?.token) {
    token = login.data.data.token;
    pass(`Rider login → JWT obtained`);
  } else {
    fail('Rider login', JSON.stringify(login.data));
    return;
  }

  // Admin login
  const adminLogin = await req('POST', '/auth/admin-login', {
    email: 'admin@volzo.in',
    password: 'admin123'
  });
  if (adminLogin.data.success && adminLogin.data.data?.token) {
    adminToken = adminLogin.data.data.token;
    pass('Admin login → JWT obtained');
  } else {
    fail('Admin login', JSON.stringify(adminLogin.data.message));
  }

  // Get current user
  const me = await req('GET', '/auth/me');
  me.data.success ? pass(`GET /auth/me → ${me.data.data.user.name}`) : fail('GET /auth/me', me.data.message);

  // ─── FARE ESTIMATION ───
  section('Ride Fare Estimation');
  const fare = await req('POST', '/rides/estimate', {
    pickupLocation: { lat: 28.6139, lng: 77.2090, address: 'Connaught Place' },
    dropLocation:   { lat: 28.5355, lng: 77.3910, address: 'Noida Sector 18' },
    vehicleType:    'EV_SCOOTER'
  });
  fare.data.success
    ? pass(`Fare estimate → ₹${fare.data.data?.estimates?.EV_SCOOTER?.fare || fare.data.data?.fare || '—'}`)
    : fail('Fare estimate', fare.data.message);

  // ─── COUPON VALIDATION ───
  section('Coupons');
  const coupon = await req('POST', '/rides/validate-coupon', { code: 'VOLZO10', amount: 100 });
  coupon.data.success
    ? pass(`Coupon VOLZO10 valid → ${coupon.data.data?.discount || coupon.data.data?.discountValue}% off`)
    : fail('Coupon validation', coupon.data.message);

  // ─── RIDE BOOKING ───
  section('Ride Booking');
  const book = await req('POST', '/rides/request', {
    pickupLocation:  { lat: 28.6139, lng: 77.2090, address: 'Connaught Place, Delhi' },
    dropLocation:    { lat: 28.5355, lng: 77.3910, address: 'Noida Sector 18' },
    vehicleType:     'EV_SCOOTER',
    paymentMethod:   'QR_UPI',
    couponCode:      null
  });
  if (book.data.success && book.data.data?.ride?.id) {
    rideId = book.data.data.ride.id;
    pass(`Ride requested → #${book.data.data.ride.rideNumber} (ID: ${rideId.slice(0,8)}…)`);
  } else {
    fail('Ride booking', book.data.message);
  }

  // Get ride history
  const history = await req('GET', '/rides/history?limit=5');
  history.data.success
    ? pass(`Ride history → ${history.data.data.rides?.length || 0} rides`)
    : fail('Ride history', history.data.message);

  // ─── PAYMENT ───
  section('Payments');
  if (rideId) {
    // Initiate QR payment
    const pay = await req('POST', '/payments/initiate', { rideId });
    if (pay.data.success) {
      paymentId = pay.data.data.paymentId;
      pass(`QR payment initiated → paymentId: ${paymentId?.slice(0,8)}…`);
    } else {
      fail('Payment initiate', pay.data.message);
    }

    // Razorpay create-order
    const rzpOrder = await req('POST', '/payments/razorpay/create-order', { rideId });
    rzpOrder.data.success
      ? pass(`Razorpay order → ${rzpOrder.data.data.orderId}`)
      : fail('Razorpay order', rzpOrder.data.message);

    // Get QR details
    const qr = await req('GET', '/payments/qr-details');
    qr.data.success ? pass(`QR details → UPI: ${qr.data.data.upiId}`) : fail('QR details', qr.data.message);
  }

  // ─── KYC ROUTES ───
  section('KYC (Mock mode)');
  // Need driver token — use driver login
  const driverLogin = await req('POST', '/auth/login', {
    phoneNumber: '+919000000001',
    idToken: 'dev_bypass_token',
    name: 'Test Driver'
  });
  const driverToken = driverLogin.data.data?.token;

  if (driverToken) {
    const kycStatus = await req('GET', '/kyc/status', null, driverToken);
    kycStatus.data.success
      ? pass(`KYC status → ${kycStatus.data.data.overall}`)
      : fail('KYC status', kycStatus.data.message);

    const dlVerify = await req('POST', '/kyc/verify-dl', { dlNumber: 'DL1420230099999', dob: '1995-06-15' }, driverToken);
    dlVerify.data.success
      ? pass(`DL verify (mock) → ${dlVerify.data.data.name}`)
      : fail('DL verify', dlVerify.data.message);
  } else {
    fail('Driver login for KYC test', driverLogin.data.message);
  }

  // ─── ADMIN ───
  section('Admin Dashboard APIs');
  if (adminToken) {
    const dash = await req('GET', '/admin/dashboard', null, adminToken);
    dash.data.success
      ? pass(`Dashboard stats → ${dash.data.data.totalRides} rides, ${dash.data.data.totalUsers} users`)
      : fail('Dashboard', dash.data.message);

    const drivers = await req('GET', '/admin/drivers', null, adminToken);
    drivers.data.success
      ? pass(`Admin drivers → ${drivers.data.data.drivers?.length || 0} drivers`)
      : fail('Admin drivers', drivers.data.message);

    const payments = await req('GET', '/admin/payments', null, adminToken);
    payments.data.success
      ? pass(`Admin payments → ${payments.data.data.total} total, ₹${payments.data.data.totalRevenue} revenue`)
      : fail('Admin payments', payments.data.message);

    const rides = await req('GET', '/admin/rides', null, adminToken);
    rides.data.success
      ? pass(`Admin rides → ${rides.data.data.rides?.length || 0} rides`)
      : fail('Admin rides', rides.data.message);

    const users = await req('GET', '/admin/users', null, adminToken);
    users.data.success
      ? pass(`Admin users → ${users.data.data.users?.length || 0} users`)
      : fail('Admin users', users.data.message);
  } else {
    console.log('  ⏭  Admin tests skipped (no admin token)');
  }

  // ─── SUMMARY ───
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏁 Test complete! Check ✅/❌ above for status.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

run().catch(e => { console.error('Test runner error:', e.message); process.exit(1); });
