import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';
import 'ride_request_page.dart';
import 'ride_tracking_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import 'ride_history_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  GoogleMapController? _mapController;
  Set<Marker> _markers = {};
  Timer? _driversTimer;
  BitmapDescriptor? _scooterIcon;
  
  // Initialize with Delhi default coordinates so the map renders instantly without blank screens
  Position _currentPosition = Position(
    latitude: 28.6139,
    longitude: 77.2090,
    timestamp: DateTime.now(),
    accuracy: 0.0,
    altitude: 0.0,
    heading: 0.0,
    speed: 0.0,
    speedAccuracy: 0.0,
    altitudeAccuracy: 0.0,
    headingAccuracy: 0.0,
  );
  
  bool _isLoading = true;
  Map<String, dynamic>? _userData;

  @override
  void initState() {
    super.initState();
    _loadCustomMarkerIcon();
    _initializeHome();
  }

  Future<Uint8List> _getBytesFromAsset(String path, int width) async {
    ByteData data = await rootBundle.load(path);
    ui.Codec codec = await ui.instantiateImageCodec(data.buffer.asUint8List(), targetWidth: width);
    ui.FrameInfo fi = await codec.getNextFrame();
    return (await fi.image.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
  }

  Future<void> _loadCustomMarkerIcon() async {
    try {
      final Uint8List markerIconBytes = await _getBytesFromAsset('assets/images/scotty_marker.png', 100);
      final icon = BitmapDescriptor.fromBytes(markerIconBytes);
      if (mounted) {
        setState(() {
          _scooterIcon = icon;
        });
      }
    } catch (e) {
      print('⚠️ Failed to load custom scotty marker: $e');
    }
  }

  Future<void> _initializeHome() async {
    // 1. Get current position asynchronously (GPS updates map camera once loaded)
    _getCurrentLocation();

    // 2. Connect socket for real-time ride updates
    await SocketClient.connect();

    // 3. Check if there's already an active ride - resume tracking
    _checkActiveRide();

    // 4. Fetch user details in background
    await _fetchUserData();
    
    // 5. Start polling nearby drivers
    _startDriversPolling();

    // 6. Mark home as initialized
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _checkActiveRide() async {
    try {
      final response = await ApiClient.get('/rides/active');
      final ride = response.data['data']['ride'];
      if (ride != null && mounted) {
        // Resume tracking the active ride
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => RideTrackingPage(rideId: ride['id']),
          ),
        );
      }
    } catch (e) {
      // No active ride, stay on home
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }

      final position = await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 10),
      );
      
      if (mounted) {
        setState(() {
          _currentPosition = position;
        });
        
        // Animate camera to current location
        _mapController?.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: LatLng(position.latitude, position.longitude),
              zoom: 15.0,
            ),
          ),
        );
      }

      // Stream updates to maintain highly accurate and responsive map location
      Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen((pos) {
        if (mounted) {
          setState(() {
            _currentPosition = pos;
          });
        }
      });
    } catch (e) {
      print('⚠️ GPS failed or timed out: $e. Map stays initialized on default Delhi coords.');
    }
  }

  Future<void> _fetchUserData() async {
    try {
      final response = await ApiClient.get('/users/profile');
      if (mounted) {
        setState(() => _userData = response.data['data']);
      }
    } catch (e) {
      print('Error fetching user data: $e');
    }
  }

  @override
  void dispose() {
    _driversTimer?.cancel();
    _mapController?.dispose();
    SocketClient.disconnect();
    super.dispose();
  }

  void _startDriversPolling() {
    // Initial immediate fetch
    _fetchNearbyDrivers();
    // Poll every 8 seconds
    _driversTimer = Timer.periodic(const Duration(seconds: 8), (timer) {
      if (mounted) {
        _fetchNearbyDrivers();
      }
    });
  }

  Future<void> _fetchNearbyDrivers() async {
    try {
      final response = await ApiClient.get('/users/nearby-drivers');
      final drivers = response.data['data']['drivers'] as List<dynamic>?;
      if (drivers == null || !mounted) return;

      final Set<Marker> newMarkers = {};
      for (final d in drivers) {
        final loc = d['currentLocation'];
        if (loc == null) continue;

        // Try getting lat/lng from both JSON casing schemas (latitude/longitude and lat/lng)
        final double lat = (loc['latitude'] ?? loc['lat'] ?? 0.0) as double;
        final double lng = (loc['longitude'] ?? loc['lng'] ?? 0.0) as double;
        if (lat == 0.0 || lng == 0.0) continue;

        final String name = d['user']?['name'] ?? 'Volzo Driver';
        final String status = d['status'] ?? 'ONLINE';
        final String vehicle = (d['vehicles'] as List?)?.isNotEmpty == true
            ? d['vehicles'][0]['model'] ?? 'EV Scooter'
            : 'EV Scooter';

        newMarkers.add(
          Marker(
            markerId: MarkerId(d['id']),
            position: LatLng(lat, lng),
            icon: _scooterIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
            infoWindow: InfoWindow(
              title: name,
              snippet: '$vehicle • $status',
            ),
          ),
        );
      }

      setState(() {
        _markers = newMarkers;
      });
    } catch (e) {
      print('Error fetching nearby drivers: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: ThemeConfig.backgroundColor,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor)),
              SizedBox(height: 16),
              Text(
                'Initializing dashboard...',
                style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: Stack(
        children: [
          // 1. Full Screen Google Map Background
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(
                _currentPosition.latitude,
                _currentPosition.longitude,
              ),
              zoom: 15,
            ),
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            onMapCreated: (controller) => _mapController = controller,
          ),

          // 2. Floating Top Header controls
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Floating Profile Avatar Button
                  GestureDetector(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ProfilePage()),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: ThemeConfig.surfaceColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: ThemeConfig.dividerColor, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: CircleAvatar(
                        radius: 22,
                        backgroundColor: ThemeConfig.primaryColor,
                        child: Text(
                          _userData?['name']?.substring(0, 1).toUpperCase() ?? 'U',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Branded Top Badge (Premium White)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: ThemeConfig.surfaceColor,
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(color: ThemeConfig.dividerColor, width: 1.0),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.electric_scooter_rounded,
                          color: ThemeConfig.primaryColor,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'VOLZO EV',
                          style: TextStyle(
                            color: ThemeConfig.primaryColor,
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Floating History Button
                  Container(
                    decoration: BoxDecoration(
                      color: ThemeConfig.surfaceColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: ThemeConfig.dividerColor, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const RideHistoryPage()),
                      ),
                      icon: const Icon(Icons.history, color: ThemeConfig.primaryColor, size: 22),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 3. Floating Bottom Action Card (Sleek Uber-Style Layout)
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // GPS Target Button
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: ThemeConfig.surfaceColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: ThemeConfig.dividerColor, width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: IconButton(
                    onPressed: _getCurrentLocation,
                    icon: const Icon(Icons.gps_fixed, color: ThemeConfig.primaryColor, size: 24),
                  ),
                ),

                // Floating Action Board
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: ThemeConfig.surfaceColor,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: ThemeConfig.dividerColor, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 25,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // "Where to?" Search trigger bar
                      GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => RideRequestPage(
                              currentLatLng: LatLng(_currentPosition.latitude, _currentPosition.longitude),
                            ),
                          ),
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: ThemeConfig.backgroundColor,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: ThemeConfig.dividerColor, width: 1),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.search, color: ThemeConfig.primaryColor, size: 24),
                              SizedBox(width: 12),
                              Text(
                                'Where to? Enter destination...',
                                style: TextStyle(
                                  color: ThemeConfig.textSecondaryColor,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Section Title
                      const Text(
                        'EV RIDE BOOKING OPTIONS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: ThemeConfig.textTertiaryColor,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Quick Ride Selectors Row
                      Row(
                        children: [
                          Expanded(
                            child: _buildRideOption(
                              Icons.electric_scooter,
                              'Volzo 2W',
                              'Fast & Green',
                              ThemeConfig.primaryColor,
                              () => _bookRide('scooter'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildRideOption(
                              Icons.electric_bolt,
                              'Volzo Pro',
                              'Premium 2W',
                              const Color(0xFF00D9FF),
                              () => _bookRide('scooter_pro'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRideOption(
    IconData icon,
    String title,
    String subtitle,
    Color color,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: ThemeConfig.backgroundColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: color.withOpacity(0.2),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: ThemeConfig.textPrimaryColor,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 10,
                color: ThemeConfig.textSecondaryColor,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _bookRide(String vehicleType) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RideRequestPage(
          preselectedVehicleType: vehicleType,
          currentLatLng: LatLng(_currentPosition.latitude, _currentPosition.longitude),
        ),
      ),
    );
  }
}
