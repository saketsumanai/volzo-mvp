/**
 * Volzo Database Seed Script
 * Creates admin user, test rider, test driver, system config
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Volzo database…\n');

  // ─────────────────────────────────────────────
  // 1. ADMIN USER
  // ─────────────────────────────────────────────
  const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminExists) {
    const admin = await prisma.user.create({
      data: {
        phoneNumber: '+911234567890',
        name:        'Volzo Admin',
        email:       'admin@volzo.in',
        role:        'ADMIN',
        status:      'ACTIVE',
        firebaseUid: 'admin_firebase_uid_local',
      }
    });
    console.log(`✅ Admin created: admin@volzo.in (ID: ${admin.id})`);
    console.log('   Login via admin-dashboard with Firebase or backend dev bypass');
  } else {
    console.log(`ℹ️  Admin already exists: ${adminExists.email}`);
  }

  // ─────────────────────────────────────────────
  // 2. TEST RIDER
  // ─────────────────────────────────────────────
  const rider = await prisma.user.upsert({
    where:  { phoneNumber: '+919876543210' },
    update: {},
    create: {
      phoneNumber: '+919876543210',
      name:        'Test Rider',
      email:       'rider@volzo.in',
      role:        'RIDER',
      status:      'ACTIVE',
      firebaseUid: 'test_rider_firebase_uid',
    }
  });
  console.log(`✅ Test Rider: ${rider.name} (+919876543210)`);

  // ─────────────────────────────────────────────
  // 3. TEST DRIVER
  // ─────────────────────────────────────────────
  const driverUser = await prisma.user.upsert({
    where:  { phoneNumber: '+919000000001' },
    update: {},
    create: {
      phoneNumber: '+919000000001',
      name:        'Test Driver',
      email:       'driver@volzo.in',
      role:        'DRIVER',
      status:      'ACTIVE',
      firebaseUid: 'test_driver_firebase_uid',
    }
  });

  const driver = await prisma.driver.upsert({
    where:  { userId: driverUser.id },
    update: {},
    create: {
      userId:           driverUser.id,
      licenseNumber:    'DL1420230012345',
      aadharNumber:     '123412341234',
      kycStatus:        'APPROVED',
      aadhaarVerified:  true,
      dlVerified:       true,
      status:           'OFFLINE',
      isAvailable:      false,
      approvedAt:       new Date(),
    }
  });

  // Add a vehicle for the test driver
  const vehicleExists = await prisma.vehicle.findFirst({ where: { driverId: driver.id } });
  if (!vehicleExists) {
    await prisma.vehicle.create({
      data: {
        driverId:           driver.id,
        vehicleType:        'EV_SCOOTER',
        registrationNumber: 'DL01AB1234',
        model:              'Ola S1 Pro',
        color:              'Blue',
        year:               2023,
        isActive:           true,
        isVerified:         true,
      }
    });
    console.log(`✅ Test Driver: ${driverUser.name} (+919000000001) — KYC Approved`);
  } else {
    console.log(`ℹ️  Test Driver already has a vehicle`);
  }

  // ─────────────────────────────────────────────
  // 4. SYSTEM CONFIG (coupons, fare matrix)
  // ─────────────────────────────────────────────
  await prisma.systemConfig.upsert({
    where:  { key: 'active_coupons' },
    update: {},
    create: {
      key:   'active_coupons',
      value: JSON.stringify([
        {
          code:          'VOLZO10',
          discountType:  'PERCENTAGE',
          discountValue: 10,
          maxDiscount:   30,
          minRideAmount: 50,
          isActive:      true,
          expiryDate:    '2027-12-31'
        },
        {
          code:          'WELCOME',
          discountType:  'FLAT',
          discountValue: 20,
          maxDiscount:   20,
          minRideAmount: 40,
          isActive:      true,
          expiryDate:    '2027-12-31'
        }
      ])
    }
  });

  await prisma.systemConfig.upsert({
    where:  { key: 'fare_matrix' },
    update: {},
    create: {
      key:   'fare_matrix',
      value: JSON.stringify({
        EV_SCOOTER:          { base: 20, perKm: 8,  perMin: 1.5 },
        EV_RICKSHAW_SHARED:  { base: 15, perKm: 6,  perMin: 1.0 },
        EV_RICKSHAW_PRIVATE: { base: 40, perKm: 12, perMin: 2.0 }
      })
    }
  });

  await prisma.systemConfig.upsert({
    where:  { key: 'app_settings' },
    update: {},
    create: {
      key:   'app_settings',
      value: JSON.stringify({
        maxRideRadius:            10,
        driverAcceptTimeoutSecs:  60,
        autoVerifyPaymentMinutes: 5,
        supportPhone:             '+919999999999',
        supportEmail:             'support@volzo.in',
      })
    }
  });

  console.log('✅ System config seeded (coupons: VOLZO10, WELCOME)');

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  console.log('\n🎉 Seed complete! Volzo database is ready.');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Test Accounts:');
  console.log('   Admin Dashboard: Use Firebase or dev bypass token');
  console.log('   Rider App:       +91 98765 43210 (OTP: 123456 in dev)');
  console.log('   Driver App:      +91 90000 00001 (OTP: 123456 in dev)');
  console.log('\n🎟️  Coupon Codes:   VOLZO10 (10% off)  |  WELCOME (₹20 off)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
