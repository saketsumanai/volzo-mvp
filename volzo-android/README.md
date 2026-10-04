# Volzo Mobility - Native Android Production Architecture & Technical Documentation

Complete, production-ready Native Android Studio project built in **Kotlin** using **Clean Architecture (Data, Domain, Presentation)**, **MVVM**, **Hilt Dependency Injection**, **Firebase Firestore**, **Google Maps SDK**, and **Razorpay Payment Gateway**.

---

## 1. Folder Structure & Architecture

```
volzo-android/
├── settings.gradle.kts          # Multi-module settings inclusion
├── build.gradle.kts             # Root Gradle build configuration
├── gradle.properties            # JVM & AndroidX optimization options
├── firestore.rules              # Role-Based Access Control Firestore Rules
│
├── core/                        # Shared Core Module (:core)
│   ├── model/                   # Data Models (User, Driver, Ride, Payment, DriverDocument)
│   ├── security/                # EncryptedSharedPreferences (AES256)
│   └── util/                    # Validators (PAN, IFSC, DL, Vehicle No), WebP Image Compressor
│
├── app-rider/                   # Rider Application Module (:app-rider)
│   └── src/main/java/com/volzo/rider/
│       ├── RiderApplication.kt # Hilt Application Class
│       └── ui/                  # RazorpayCheckoutActivity, RiderHomeActivity, ProfileSetupActivity
│
├── app-driver/                  # Driver Application Module (:app-driver)
│   └── src/main/java/com/volzo/driver/
│       ├── DriverApplication.kt # Hilt Application Class
│       ├── service/             # Foreground Location Tracker Service
│       └── ui/                  # KycUploadActivity, DriverHomeActivity
│
└── app-admin/                   # Admin Dashboard Application Module (:app-admin)
    └── src/main/java/com/volzo/admin/
        ├── AdminApplication.kt  # Hilt Application Class
        └── ui/                  # AdminDashboardActivity, DriverApprovalActivity
```

---

## 2. Firestore Schema & Data Architecture

- **`users`**: `{ id, phoneNumber, name, email, profileImage, role: "RIDER"|"DRIVER"|"ADMIN", status, emergencyContact, createdAt, updatedAt }`
- **`drivers`**: `{ id, userId, name, phoneNumber, licenseNumber, aadharNumber, panNumber, kycStatus: "PENDING"|"APPROVED"|"REJECTED", status: "OFFLINE"|"ONLINE"|"ON_RIDE", latitude, longitude, vehicleNumber, vehicleModel, batteryPercentage, totalEarnings, rating }`
- **`rides`**: `{ id, rideNumber, riderId, driverId, rideType, status: "REQUESTED"|"ACCEPTED"|"IN_PROGRESS"|"COMPLETED"|"PAYMENT_VERIFIED", pickupLocation, dropoffLocation, pickupLat, pickupLng, dropoffLat, dropoffLng, estimatedFare, finalFare, distanceKm, durationMin, otp, requestedAt }`
- **`payments`**: `{ id, rideId, amount, method: "RAZORPAY"|"CASH"|"QR_UPI", status: "PENDING"|"DRIVER_VERIFIED"|"PAID", razorpayOrderId, razorpayPaymentId, razorpaySignature }`
- **`driver_documents`**: `{ id, driverId, documentType: "AADHAAR"|"PAN"|"DL"|"RC", documentUrl, fileSizeBytes, uploadedAt }`

---

## 3. Firestore Security Rules

Full role-based security rules defined in `firestore.rules`:
- **Riders**: Read/Write own user profile, create ride requests, pay via Razorpay.
- **Drivers**: Read/Write own driver state, broadcast live GPS coordinates, update assigned trip state.
- **Admins**: Full global read/write access for driver document approvals, user blocking, and revenue monitoring.

---

## 4. Deployment Pipeline

1. **Gradle Build**: Execute `./gradlew assembleRelease` or build module APKS (`app-rider-release.apk`, `app-driver-release.apk`, `app-admin-release.apk`).
2. **ProGuard / R8 Shrinking**: Keep rules enabled for Hilt, Firebase, and Razorpay.
3. **App Signing**: Sign with production Keystore (`.jks`) using v2/v3 signature schemes.

---

## 5. Play Store Release Checklist

- [x] Configure production package names (`com.volzo.rider`, `com.volzo.driver`, `com.volzo.admin`).
- [x] Set target API level 34 (Android 14).
- [x] Set up Google Play Console Developer Accounts & App Privacy Disclosures.
- [x] Configure Google Maps API Key restrictions in Google Cloud Console (SHA-1 fingerprint bound).
- [x] Attach live production Razorpay API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).

---

## 6. Firebase Configuration Setup

1. Register `com.volzo.rider`, `com.volzo.driver`, and `com.volzo.admin` in Firebase Console.
2. Download `google-services.json` and place inside `app-rider/`, `app-driver/`, and `app-admin/` module directories.
3. Enable Firestore Database, Firebase Authentication, Cloud Messaging (FCM), and Crashlytics.

---

## 7. Razorpay Integration Flow

1. **Initiate**: `RazorpayCheckoutActivity` fetches Order details & fare amount.
2. **Launch Checkout**: Spawns Razorpay Android SDK modal with custom primary color `#0040C8`.
3. **Handle Response**:
   - `onPaymentSuccess(razorpayPaymentId)`: Writes Payment record to Firestore & transitions Ride status to `PAYMENT_VERIFIED`.
   - `onPaymentError()`: Shows Material 3 Snackbar with retry capability.

---

## 8. Scaling Strategy (100 to 1,000,000 Users)

- **Database Partitioning**: Use Firestore geo-hashing (`geohash` / GeoFirestore) for driver spatial queries to query only nearby drivers within 5km bounding boxes.
- **Connection Pooling**: Use FCM Push Notifications for non-urgent status updates rather than constant high-frequency polling.
- **Caching**: Enable Firestore offline persistence & local Room cache for ride history.

---

## 9. Future Roadmap & Extensions

- **OTP Authentication**: Enhance Firebase Auth with SMS OTP verification.
- **EV Battery Swapping**: Integrate real-time EV station availability & battery level warnings (<15%).
- **SOS Emergency Alert**: One-tap trigger sending live GPS location to local police & emergency contacts.
- **AI Demand Prediction**: Machine learning model forecasting high-demand zones for driver dispatch.
