/**
 * Volzo Driver App — Home Page
 * Full-screen dark map, glowing Go Online FAB, real-time earnings ticker,
 * socket-driven ride dispatch, adaptive location broadcast.
 *
 * Architecture:
 * - Geolocator stream → SocketClient.updateLocation (only when ONLINE)
 * - 5s poll fallback for missed socket ride:new_request events
 * - Earnings counter increments on ride:completed socket event
 * - Duplicate ride dialog prevented via _shownRideIds Set
 */

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';
import 'ride_request_page.dart';
import 'earnings_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with TickerProviderStateMixin {
  GoogleMapController? _mapController;
  Position? _currentPosition;
  StreamSubscription<Position>? _positionSubscription;

  bool _isOnline = false;
  bool _isLoading = true;
  bool _isTogglingStatus = false;
  bool _showingRideRequest = false;

  Map<String, dynamic>? _driverData;
  Map<String, dynamic>? _activeRide;

  // Duplicate ride dialog guard
  final Set<String> _shownRideIds = {};

  // Polling fallback for missed socket events
  Timer? _pendingRidesTimer;

  // Earnings for the day
  double _todayEarnings = 0.0;
  int _todayTrips = 0;

  // Online/offline toggle pulse animation
  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;

  // Earnings ticker animation
  late AnimationController _earningsController;
  late Animation<double> _earningsFade;

  // Map style — dark, flat, premium
  static const String _darkMapStyle = '''
[
  {"elementType": "geometry", "stylers": [{"color": "#0A0E1A"}]},
  {"elementType": "labels.text.stroke", "stylers": [{"color": "#060811"}]},
  {"elementType": "labels.text.fill", "stylers": [{"color": "#3E4A5B"}]},
  {"featureType": "road", "elementType": "geometry", "stylers": [{"color": "#141C2E"}]},
  {"featureType": "road.highway", "elementType": "geometry", "stylers": [{"color": "#1B2740"}]},
  {"featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{"color": "#4A5568"}]},
  {"featureType": "water", "elementType": "geometry", "stylers": [{"color": "#090D18"}]},
  {"featureType": "poi", "elementType": "labels", "stylers": [{"visibility": "off"}]},
  {"featureType": "transit", "elementType": "labels", "stylers": [{"visibility": "off"}]}
]
''';

  @override
  void initState() {
    super.initState();

    // Pulse animation for online state
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Earnings ticker animation
    _earningsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
    _earningsFade = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _earningsController, curve: Curves.easeOut));

    _initializeDriver();
  }

  Future<void> _initializeDriver() async {
    try {
      await _getCurrentLocation();
      await SocketClient.connect();

      // Socket ride dispatch listener
      SocketClient.on('ride:new_request', _handleNewRideRequest);

      // Earnings update on completion
      SocketClient.on('ride:completed', (data) {
        if (!mounted) return;
        
        double fare = 0.0;
        final rawFare = data?['fare'] ?? data?['finalFare'] ?? 0.0;
        if (rawFare is num) {
          fare = rawFare.toDouble();
        } else if (rawFare is String) {
          fare = double.tryParse(rawFare) ?? 0.0;
        }

        setState(() {
          _todayEarnings += fare;
          _todayTrips++;
          _activeRide = null;
        });
        _earningsController.forward(from: 0);
      });

      // Cancelled by rider — clear active ride
      SocketClient.on('ride:cancelled_by_rider', (data) {
        if (!mounted) return;
        setState(() => _activeRide = null);
      });

      await _fetchDriverData();
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _getCurrentLocation() async {
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) return;

    try {
      final pos = await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 8),
      );
      if (mounted) setState(() => _currentPosition = pos);
    } catch (_) {}

    // Adaptive broadcast: high accuracy when online, reduced when offline
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 15, // Only broadcast when moved 15m
      ),
    ).listen((pos) {
      if (!mounted) return;
      setState(() => _currentPosition = pos);
      if (_isOnline) {
        final rideId = _activeRide?['id']?.toString();
        SocketClient.updateLocation(pos.latitude, pos.longitude, rideId: rideId);
      }
    });
  }

  Future<void> _fetchDriverData() async {
    try {
      final resp = await ApiClient.get('/drivers/profile');
      final data = resp.data['data'];
      final driver = data != null ? (data['driver'] ?? data) : null;
      setState(() => _driverData = driver);

      // Fetch today's earnings
      try {
        final earningsResp = await ApiClient.get('/drivers/earnings', queryParameters: {'period': 'today'});
        final e = earningsResp.data['data'];
        setState(() {
          _todayEarnings = ((e?['periodEarnings'] ?? e?['totalEarnings'] ?? 0.0) as num).toDouble();
          _todayTrips = (e?['periodRides'] ?? e?['totalTrips'] ?? 0) as int;
        });
      } catch (_) {}

      // Check for active ride
      try {
        final ridesResp = await ApiClient.get('/drivers/active-ride');
        final rData = ridesResp.data['data'];
        if (rData != null && rData['ride'] != null) {
          setState(() => _activeRide = rData['ride']);
        } else {
          setState(() => _activeRide = null);
        }
      } catch (_) {}
    } catch (e) {
      // Silently handle — new driver may not have profile yet
    }
  }

  void _startPendingRidePolling() {
    _pendingRidesTimer?.cancel();
    _pendingRidesTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (!_isOnline || _showingRideRequest || !mounted) return;
      try {
        final response = await ApiClient.get('/drivers/pending-requests');
        final rideData = response.data['data']?['ride'];
        if (rideData != null) {
          final rideId = rideData['id']?.toString() ?? '';
          final status = rideData['status']?.toString() ?? '';
          if (rideId.isNotEmpty &&
              status == 'REQUESTED' &&
              !_shownRideIds.contains(rideId)) {
            _handleNewRideRequest(rideData);
          }
        }
      } catch (_) {}
    });
  }

  void _stopPendingRidePolling() {
    _pendingRidesTimer?.cancel();
    _pendingRidesTimer = null;
  }

  void _handleNewRideRequest(dynamic data) {
    if (!mounted || _showingRideRequest) return;
    final rideId = (data['id'] ?? data['rideId'] ?? '').toString();
    if (rideId.isEmpty || _shownRideIds.contains(rideId)) return;

    _shownRideIds.add(rideId);
    _showingRideRequest = true;

    // Haptic feedback for incoming ride
    HapticFeedback.heavyImpact();

    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _RideRequestSheet(
        rideData: data,
        onAccept: () => _acceptRide(rideId),
        onReject: () => _rejectRide(rideId),
      ),
    ).then((_) => _showingRideRequest = false);
  }

  Future<void> _acceptRide(String rideId) async {
    try {
      await ApiClient.post('/drivers/rides/$rideId/accept');
      if (!mounted) return;
      Navigator.of(context).pop(); // Close sheet
      Navigator.of(context).push(
        PageRouteBuilder(
          pageBuilder: (_, a, __) => RideRequestPage(rideId: rideId),
          transitionsBuilder: (_, a, __, child) => SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
                .animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 450),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  Future<void> _rejectRide(String rideId) async {
    try {
      await ApiClient.post('/drivers/rides/$rideId/reject');
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
    }
  }

  Future<void> _toggleOnlineStatus() async {
    if (_isTogglingStatus) return;
    setState(() => _isTogglingStatus = true);
    HapticFeedback.mediumImpact();

    try {
      final newStatus = !_isOnline;
      await ApiClient.patch('/drivers/status', data: {
        'status': newStatus ? 'ONLINE' : 'OFFLINE',
        'isAvailable': newStatus,
      });
      setState(() => _isOnline = newStatus);

      if (newStatus) {
        SocketClient.goOnline();
        if (_currentPosition != null) {
          SocketClient.updateLocation(
              _currentPosition!.latitude, _currentPosition!.longitude);
        }
        _startPendingRidePolling();
      } else {
        SocketClient.goOffline();
        _stopPendingRidePolling();
      }
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isTogglingStatus = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.error_outline, color: Colors.white, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(msg, style: const TextStyle(color: Colors.white))),
      ]),
      backgroundColor: const Color(0xFFEF4444),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  void dispose() {
    _pendingRidesTimer?.cancel();
    _positionSubscription?.cancel();
    _mapController?.dispose();
    _pulseController.dispose();
    _earningsController.dispose();
    SocketClient.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF060811),
        body: _isLoading
            ? const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00C853)),
                ),
              )
            : Stack(children: [
                // ── Full-screen dark map ────────────────────────────
                GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: _currentPosition != null
                        ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
                        : const LatLng(28.6139, 77.2090),
                    zoom: 15.5,
                  ),
                  myLocationEnabled: true,
                  myLocationButtonEnabled: false,
                  zoomControlsEnabled: false,
                  mapToolbarEnabled: false,
                  buildingsEnabled: false,
                  onMapCreated: (ctrl) {
                    _mapController = ctrl;
                    ctrl.setMapStyle(_darkMapStyle);
                  },
                ),

                // ── Dark gradient overlay at top & bottom ─────────
                _buildMapOverlay(),

                // ── Top header card ───────────────────────────────
                SafeArea(child: _buildTopHeader()),

                // ── Go Online FAB ─────────────────────────────────
                Positioned(
                  bottom: 160,
                  left: 0,
                  right: 0,
                  child: Center(child: _buildGoOnlineFAB()),
                ),

                // ── Active ride banner ────────────────────────────
                if (_activeRide != null)
                  Positioned(
                    bottom: 100,
                    left: 16,
                    right: 16,
                    child: _buildActiveRideBanner(),
                  ),

                // ── Bottom earnings + nav dock ────────────────────
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: _buildBottomDock(),
                ),
              ]),
      ),
    );
  }

  Widget _buildMapOverlay() {
    return Stack(children: [
      // Top gradient
      Container(
        height: 200,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xCC060811), Colors.transparent],
          ),
        ),
      ),
      // Bottom gradient
      Positioned(
        bottom: 0,
        left: 0,
        right: 0,
        child: Container(
          height: 240,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Color(0xE6060811), Colors.transparent],
            ),
          ),
        ),
      ),
    ]);
  }

  Widget _buildTopHeader() {
    final dynamic data = _driverData;
    final driverName = (data is Map ? (data['user'] is Map ? data['user']['name'] : data['name']) : null) ?? 'Driver';
    
    String rating = '5.0';
    final rawRating = _driverData?['rating'];
    if (rawRating is num) {
      rating = rawRating.toStringAsFixed(1);
    } else if (rawRating is String) {
      rating = double.tryParse(rawRating)?.toStringAsFixed(1) ?? '5.0';
    }
    
    final user = _driverData?['user'];
    final profileImg = (user is Map ? user['profileImage'] : null) ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        // Avatar
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: _isOnline ? const Color(0xFF00C853) : Colors.white.withOpacity(0.2),
              width: 2,
            ),
          ),
          child: CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFF111827),
            backgroundImage: profileImg.isNotEmpty ? NetworkImage(profileImg) : null,
            child: profileImg.isEmpty
                ? Text(
                    driverName.isNotEmpty ? driverName.substring(0, 1).toUpperCase() : 'D',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                  )
                : null,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Hey, $driverName 👋',
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
            Row(children: [
              const Icon(Icons.star_rounded, color: Colors.amber, size: 13),
              const SizedBox(width: 3),
              Text(rating, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
              const SizedBox(width: 8),
              AnimatedBuilder(
                animation: _pulseAnim,
                builder: (_, child) => Opacity(
                  opacity: _isOnline ? _pulseAnim.value : 0.5,
                  child: child,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: _isOnline
                        ? const Color(0xFF00C853).withOpacity(0.2)
                        : Colors.white.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isOnline ? const Color(0xFF00C853) : Colors.white.withOpacity(0.3),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _isOnline ? 'ONLINE' : 'OFFLINE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _isOnline ? const Color(0xFF00C853) : Colors.white.withOpacity(0.4),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          ]),
        ),
        // Earnings quick badge
        FadeTransition(
          opacity: _earningsFade,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF00C853).withOpacity(0.2)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(
                '₹${_todayEarnings.toStringAsFixed(0)}',
                style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.w900, fontSize: 15),
              ),
              Text('Today', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _buildGoOnlineFAB() {
    return GestureDetector(
      onTap: _isTogglingStatus ? null : _toggleOnlineStatus,
      child: AnimatedBuilder(
        animation: _pulseAnim,
        builder: (_, child) => Container(
          width: 160,
          height: 64,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: _isOnline
                ? LinearGradient(
                    colors: [
                      const Color(0xFFEF4444).withOpacity(0.9),
                      const Color(0xFFFF6B6B).withOpacity(0.9),
                    ],
                  )
                : const LinearGradient(
                    colors: [Color(0xFF00C853), Color(0xFF00E676)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
            boxShadow: [
              BoxShadow(
                color: _isOnline
                    ? const Color(0xFFEF4444).withOpacity(0.4 * _pulseAnim.value)
                    : const Color(0xFF00C853).withOpacity(0.5 * _pulseAnim.value),
                blurRadius: 28,
                spreadRadius: 2,
              ),
            ],
          ),
          child: _isTogglingStatus
              ? const Center(
                  child: SizedBox(height: 22, width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                  ),
                )
              : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(
                    _isOnline ? Icons.power_settings_new_rounded : Icons.bolt_rounded,
                    color: Colors.white, size: 22,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isOnline ? 'Go Offline' : 'Go Online',
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ]),
        ),
      ),
    );
  }

  Widget _buildActiveRideBanner() {
    final rideId = _activeRide!['id']?.toString() ?? '';
    final status = (_activeRide!['status'] as String? ?? '').toUpperCase();
    final pickup = _activeRide!['pickupLocation']?['address'] ?? 'Pickup';
    final drop = _activeRide!['dropoffLocation']?['address'] ?? 'Destination';

    return GestureDetector(
      onTap: () {
        Navigator.push(context,
            MaterialPageRoute(builder: (_) => RideRequestPage(rideId: rideId)));
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF00C853),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 20, offset: const Offset(0, 6)),
          ],
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle),
            child: const Icon(Icons.electric_scooter_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(status, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5)),
              Text('$pickup → $drop',
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 12)),
            ]),
          ),
          const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
        ]),
      ),
    );
  }

  Widget _buildBottomDock() {
    return Container(
      height: 90,
      decoration: BoxDecoration(
        color: const Color(0xFF0A0E1A).withOpacity(0.95),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.06))),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Row(children: [
            _dockItem(Icons.home_rounded, 'Home', true, null),
            _dockItem(Icons.account_balance_wallet_rounded, 'Earnings', false, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const EarningsPage()));
            }),
            _dockItem(Icons.person_rounded, 'Profile', false, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfilePage()));
            }),
          ]),
        ),
      ),
    );
  }

  Widget _dockItem(IconData icon, String label, bool active, VoidCallback? onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon,
              color: active ? const Color(0xFF00C853) : Colors.white.withOpacity(0.35),
              size: 26),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                color: active ? const Color(0xFF00C853) : Colors.white.withOpacity(0.35),
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w400,
              )),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════
// Ride Request Sheet — Full-screen incoming ride modal
// ═══════════════════════════════════════════════════
class _RideRequestSheet extends StatefulWidget {
  final dynamic rideData;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  const _RideRequestSheet({
    required this.rideData,
    required this.onAccept,
    required this.onReject,
  });

  @override
  State<_RideRequestSheet> createState() => _RideRequestSheetState();
}

class _RideRequestSheetState extends State<_RideRequestSheet>
    with TickerProviderStateMixin {
  // Radial countdown — driver has 30s to accept
  late AnimationController _timerController;
  late Animation<double> _timerAnim;
  Timer? _countdownTimer;
  int _secondsLeft = 30;
  bool _isAccepting = false;

  @override
  void initState() {
    super.initState();

    _timerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..forward();

    _timerAnim = Tween<double>(begin: 1.0, end: 0.0)
        .animate(CurvedAnimation(parent: _timerController, curve: Curves.linear));

    // Vibrate every second while countdown runs
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      if (_secondsLeft <= 0) {
        t.cancel();
        Navigator.of(context).pop(); // Auto-dismiss
        return;
      }
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 5) HapticFeedback.lightImpact();
    });
  }

  @override
  void dispose() {
    _timerController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.rideData;
    final pickup = data?['pickupLocation']?['address'] ??
        data?['pickupAddress'] ??
        'Pickup Location';
    final drop = data?['dropoffLocation']?['address'] ??
        data?['dropAddress'] ??
        'Destination';
    final fare = (data?['estimatedFare'] ?? data?['fare'] ?? 0).toString();
    final distance = (data?['estimatedDistance'] ?? 0.0).toString();
    final rideType = (data?['rideType'] ?? 'SCOOTER').toString().replaceAll('_', ' ');
    final dynamic rider = data is Map ? data['rider'] : null;
    final riderId = (rider is Map ? rider['name'] : null) ?? 'Rider';

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1421),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFF00C853).withOpacity(0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00C853).withOpacity(0.15),
            blurRadius: 40,
            spreadRadius: 5,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Handle
          Container(width: 36, height: 4,
              decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),

          // Header row with radial timer
          Row(children: [
            // Countdown ring
            SizedBox(
              width: 64, height: 64,
              child: Stack(alignment: Alignment.center, children: [
                AnimatedBuilder(
                  animation: _timerAnim,
                  builder: (_, __) => CircularProgressIndicator(
                    value: _timerAnim.value,
                    strokeWidth: 4,
                    backgroundColor: Colors.white.withOpacity(0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _secondsLeft > 10 ? const Color(0xFF00C853) : const Color(0xFFEF4444),
                    ),
                  ),
                ),
                Text(
                  '$_secondsLeft',
                  style: TextStyle(
                    color: _secondsLeft > 10 ? const Color(0xFF00C853) : const Color(0xFFEF4444),
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('New Ride Request!',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Row(children: [
                  Icon(Icons.person_rounded, size: 14, color: Colors.white.withOpacity(0.5)),
                  const SizedBox(width: 4),
                  Text(riderId, style: TextStyle(color: Colors.white.withOpacity(0.55), fontSize: 13)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0066FF).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(rideType,
                        style: const TextStyle(color: Color(0xFF0066FF), fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ]),
              ]),
            ),
          ]),
          const SizedBox(height: 20),

          // Route card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Column(children: [
              _routeRow(Icons.radio_button_checked_rounded, 'PICKUP', pickup, const Color(0xFF00C853)),
              Container(margin: const EdgeInsets.only(left: 22, top: 4, bottom: 4),
                  width: 2, height: 24, color: Colors.white.withOpacity(0.1)),
              _routeRow(Icons.location_on_rounded, 'DROP', drop, const Color(0xFFEF4444)),
            ]),
          ),
          const SizedBox(height: 16),

          // Fare & distance row
          Row(children: [
            _metricCard('₹$fare', 'Estimated Fare', const Color(0xFF00C853)),
            const SizedBox(width: 10),
            _metricCard('${distance}km', 'Distance', const Color(0xFF0066FF)),
          ]),
          const SizedBox(height: 20),

          // Accept / Reject buttons
          Row(children: [
            // Reject
            GestureDetector(
              onTap: widget.onReject,
              child: Container(
                width: 60, height: 60,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withOpacity(0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3), width: 1.5),
                ),
                child: const Icon(Icons.close_rounded, color: Color(0xFFEF4444), size: 28),
              ),
            ),
            const SizedBox(width: 12),
            // Accept — main CTA
            Expanded(
              child: GestureDetector(
                onTap: _isAccepting ? null : () {
                  setState(() => _isAccepting = true);
                  widget.onAccept();
                },
                child: Container(
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00C853), Color(0xFF00E676)],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6)),
                    ],
                  ),
                  child: _isAccepting
                      ? const Center(child: SizedBox(height: 22, width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white))))
                      : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.check_rounded, color: Colors.white, size: 24),
                          SizedBox(width: 8),
                          Text('Accept Ride', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                        ]),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Widget _routeRow(IconData icon, String label, String address, Color color) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 16),
      const SizedBox(width: 10),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
          Text(address, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
        ]),
      ),
    ]);
  }

  Widget _metricCard(String value, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(children: [
          Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
        ]),
      ),
    );
  }
}
