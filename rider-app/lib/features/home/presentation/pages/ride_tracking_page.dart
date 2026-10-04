import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'dart:math' as math;
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';
import 'payment_page.dart';

class RideTrackingPage extends StatefulWidget {
  final String rideId;

  const RideTrackingPage({super.key, required this.rideId});

  @override
  State<RideTrackingPage> createState() => _RideTrackingPageState();
}

class _RideTrackingPageState extends State<RideTrackingPage> {
  GoogleMapController? _mapController;
  Map<String, dynamic>? _rideData;
  bool _isLoading = true;
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};

  BitmapDescriptor? _scooterIcon;

  @override
  void initState() {
    super.initState();
    _loadCustomMarkerIcon();
    _fetchRideDetails();
    _setupSocketListeners();
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

  void _setupSocketListeners() {
    SocketClient.joinRide(widget.rideId);

    // Listen for ride:accepted - driver has accepted, refresh to show driver details
    SocketClient.on('ride:accepted', (data) {
      if (!mounted) return;
      if (data != null && (data['rideId'] == widget.rideId || data['rideId'] == null)) {
        _fetchRideDetails();
      }
    });

    // Listen for driver arrived event
    SocketClient.on('ride:driver_arrived', (data) {
      if (!mounted) return;
      _fetchRideDetails();
      
      // Show notification that driver has arrived
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: const [
              Icon(Icons.check_circle, color: Colors.white, size: 20),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  '🎉 Driver has arrived! Share your OTP to start the ride.',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF00C853),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
          duration: const Duration(seconds: 5),
        ),
      );
    });

    // Listen for ride started event
    SocketClient.on('ride:started', (data) {
      if (!mounted) return;
      _fetchRideDetails();
    });

    // Generic status update listener
    SocketClient.on('ride:status:updated', (data) {
      if (!mounted) return;
      if (data['rideId'] == widget.rideId) {
        final status = data['status'].toString().toUpperCase();
        if (status == 'COMPLETED') {
          _navigateToPayment();
        } else {
          _fetchRideDetails();
        }
      }
    });

    SocketClient.on('driver:location:updated', (data) {
      if (!mounted) return;
      if (data['rideId'] == widget.rideId) {
        final lat = (data['latitude'] ?? data['lat'] ?? 0.0) as double;
        final lng = (data['longitude'] ?? data['lng'] ?? 0.0) as double;
        _updateDriverLocation(lat, lng);
      }
    });
  }

  Future<void> _fetchRideDetails() async {
    try {
      final response = await ApiClient.get('/rides/${widget.rideId}');
      setState(() {
        _rideData = response.data['data']['ride'] ?? response.data['data'];
        _isLoading = false;
      });
      _setupMap();
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ApiClient.getErrorMessage(e)),
          backgroundColor: ThemeConfig.errorColor,
        ),
      );
    }
  }

  void _setupMap() {
    if (_rideData == null) return;

    // Support nested or flat coordinate keys
    final pickupLat = (_rideData!['pickupLocation']?['latitude'] ?? _rideData!['pickupLatitude'] ?? 28.6139) as double;
    final pickupLng = (_rideData!['pickupLocation']?['longitude'] ?? _rideData!['pickupLongitude'] ?? 77.2090) as double;
    final dropLat = (_rideData!['dropoffLocation']?['latitude'] ?? _rideData!['dropLatitude'] ?? 28.6139) as double;
    final dropLng = (_rideData!['dropoffLocation']?['longitude'] ?? _rideData!['dropLongitude'] ?? 77.2090) as double;

    final pickupLatLng = LatLng(pickupLat, pickupLng);
    final dropLatLng = LatLng(dropLat, dropLng);

    setState(() {
      _markers = {
        Marker(
          markerId: const MarkerId('pickup'),
          position: pickupLatLng,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Pickup Location'),
        ),
        Marker(
          markerId: const MarkerId('drop'),
          position: dropLatLng,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: const InfoWindow(title: 'Destination'),
        ),
      };

      if (_rideData!['driver'] != null) {
        final driverLat = (_rideData!['driverLocation']?['latitude'] ?? _rideData!['driverLatitude'] ?? pickupLat) as double;
        final driverLng = (_rideData!['driverLocation']?['longitude'] ?? _rideData!['driverLongitude'] ?? pickupLng) as double;
        
        _markers.add(
          Marker(
            markerId: const MarkerId('driver'),
            position: LatLng(driverLat, driverLng),
            icon: _scooterIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
            infoWindow: InfoWindow(title: _rideData!['driver']['name'] ?? 'Your Driver'),
          ),
        );
      }

      _polylines = {
        Polyline(
          polylineId: const PolylineId('route'),
          points: [pickupLatLng, dropLatLng],
          color: ThemeConfig.primaryColor,
          width: 5,
        ),
      };
    });

    // Zoom camera to fit pickup & destination
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bounds = LatLngBounds(
        southwest: LatLng(
          math.min(pickupLat, dropLat),
          math.min(pickupLng, dropLng),
        ),
        northeast: LatLng(
          math.max(pickupLat, dropLat),
          math.max(pickupLng, dropLng),
        ),
      );
      _mapController?.animateCamera(CameraUpdate.newLatLngBounds(bounds, 100));
    });
  }

  void _updateDriverLocation(double lat, double lng) {
    setState(() {
      _markers.removeWhere((m) => m.markerId.value == 'driver');
      _markers.add(
        Marker(
          markerId: const MarkerId('driver'),
          position: LatLng(lat, lng),
          icon: _scooterIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          infoWindow: InfoWindow(title: _rideData!['driver']?['name'] ?? 'Driver Location'),
        ),
      );
    });

    // Optionally pan map slightly to center on driver
    _mapController?.animateCamera(CameraUpdate.newLatLng(LatLng(lat, lng)));
  }

  void _navigateToPayment() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => PaymentPage(rideId: widget.rideId),
      ),
    );
  }

  Future<void> _cancelRide() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Cancel Ride?', style: TextStyle(color: ThemeConfig.textPrimaryColor, fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to cancel this EV ride booking?', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.errorColor),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await ApiClient.post('/rides/${widget.rideId}/cancel', data: {'reason': 'Rider cancelled'});
        if (!mounted) return;
        Navigator.of(context).pop();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.getErrorMessage(e)),
            backgroundColor: ThemeConfig.errorColor,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    SocketClient.leaveRide(widget.rideId);
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: ThemeConfig.backgroundColor,
        body: Center(
          child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor)),
        ),
      );
    }

    if (_rideData == null) {
      return Scaffold(
        backgroundColor: ThemeConfig.backgroundColor,
        appBar: AppBar(title: const Text('Ride Tracking')),
        body: const Center(child: Text('Ride details not found', style: TextStyle(color: Colors.white))),
      );
    }

    final status = _rideData!['status'].toString().toUpperCase();

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: Stack(
        children: [
          // 1. Google Map Background (Full Screen)
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(
                (_rideData!['pickupLocation']?['latitude'] ?? _rideData!['pickupLatitude'] ?? 28.6139) as double,
                (_rideData!['pickupLocation']?['longitude'] ?? _rideData!['pickupLongitude'] ?? 77.2090) as double,
              ),
              zoom: 14,
            ),
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            onMapCreated: (controller) => _mapController = controller,
          ),

          // 2. Top Floating Controls
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: ThemeConfig.surfaceColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: ThemeConfig.dividerColor, width: 1.0),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back, color: ThemeConfig.textPrimaryColor),
                    ),
                  ),
                  const Spacer(),
                  if (status == 'REQUESTED' || status == 'PENDING' || status == 'ACCEPTED' || status == 'DRIVER_ARRIVED')
                    Container(
                      decoration: BoxDecoration(
                        color: ThemeConfig.surfaceColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: ThemeConfig.dividerColor, width: 1.0),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: IconButton(
                        onPressed: _cancelRide,
                        icon: const Icon(Icons.close, color: ThemeConfig.errorColor),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // 3. Sliding Driver Info Bottom Sheet Card
          DraggableScrollableSheet(
            initialChildSize: 0.36,
            minChildSize: 0.34,
            maxChildSize: 0.75,
            builder: (context, scrollController) {
              return Container(
                decoration: BoxDecoration(
                  color: ThemeConfig.surfaceColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                  border: Border.all(color: ThemeConfig.dividerColor, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 20,
                      offset: const Offset(0, -5),
                    ),
                  ],
                ),
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(24),
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: ThemeConfig.dividerColor,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Status Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Ride Status',
                          style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        _buildStatusBadge(status),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Driver Info Block (if driver assigned)
                    if (_rideData!['driver'] != null) ...[
                      Builder(
                        builder: (context) {
                          final driverMap = _rideData!['driver'] as Map<String, dynamic>;
                          final driverUser = driverMap['user'] as Map<String, dynamic>?;
                          final driverName = driverUser?['name'] ?? driverMap['name'] ?? 'Driver';
                          final driverPhone = driverUser?['phoneNumber'] ?? driverMap['phoneNumber'] ?? '';
                          final ratingVal = driverMap['rating'] != null ? double.tryParse(driverMap['rating'].toString()) ?? 4.9 : 4.9;
                          final ratingStr = ratingVal.toStringAsFixed(1);
                          final otpStr = _rideData!['otp']?.toString() ?? '1234';
                          final vehicleMap = _rideData!['vehicle'] as Map<String, dynamic>?;
                          final vehicleName = vehicleMap != null
                              ? '${vehicleMap['model'] ?? vehicleMap['make'] ?? 'EV Electric'} (${vehicleMap['color'] ?? 'Blue'})'
                              : 'Premium EV Sedan';
                          final regNumber = vehicleMap?['registrationNumber'] ?? 'DL 1AA 0108';

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(color: ThemeConfig.primaryColor, width: 2),
                                    ),
                                    child: CircleAvatar(
                                      radius: 28,
                                      backgroundColor: ThemeConfig.backgroundColor,
                                      backgroundImage: (driverUser?['profileImage'] != null && driverUser!['profileImage'].toString().isNotEmpty)
                                          ? NetworkImage(driverUser['profileImage'])
                                          : null,
                                      child: (driverUser?['profileImage'] == null || driverUser!['profileImage'].toString().isEmpty)
                                          ? Text(
                                              driverName.isNotEmpty ? driverName.substring(0, 1).toUpperCase() : 'D',
                                              style: const TextStyle(
                                                color: ThemeConfig.primaryColor,
                                                fontSize: 24,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            )
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          driverName,
                                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: ThemeConfig.textPrimaryColor),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                                            const SizedBox(width: 4),
                                            Text(
                                              ratingStr,
                                              style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 13),
                                            ),
                                            const SizedBox(width: 8),
                                            Container(
                                              width: 4,
                                              height: 4,
                                              decoration: const BoxDecoration(
                                                color: ThemeConfig.textSecondaryColor,
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                vehicleName,
                                                style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: ThemeConfig.primaryColor.withOpacity(0.08),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: ThemeConfig.primaryColor.withOpacity(0.2)),
                                          ),
                                          child: Text(
                                            regNumber,
                                            style: const TextStyle(
                                              color: ThemeConfig.primaryDark,
                                              fontWeight: FontWeight.w900,
                                              fontSize: 11,
                                              letterSpacing: 1.0,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () async {
                                      if (driverPhone.isNotEmpty) {
                                        final url = 'tel:$driverPhone';
                                        if (await canLaunchUrl(Uri.parse(url))) {
                                          await launchUrl(Uri.parse(url));
                                        }
                                      }
                                    },
                                    icon: const Icon(Icons.phone),
                                    style: IconButton.styleFrom(
                                      backgroundColor: ThemeConfig.primaryColor,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.all(12),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              
                              // Premium Verification PIN Card with Pulse Animation
                              if (status == 'ACCEPTED' || status == 'DRIVER_ARRIVED') ...[
                                TweenAnimationBuilder<double>(
                                  tween: Tween(begin: 0.0, end: 1.0),
                                  duration: const Duration(milliseconds: 800),
                                  curve: Curves.easeOut,
                                  builder: (context, value, child) {
                                    return Transform.scale(
                                      scale: 0.95 + (value * 0.05),
                                      child: Opacity(
                                        opacity: value,
                                        child: child,
                                      ),
                                    );
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          status == 'DRIVER_ARRIVED'
                                              ? const Color(0xFF00C853).withOpacity(0.12)
                                              : ThemeConfig.primaryColor.withOpacity(0.06),
                                          status == 'DRIVER_ARRIVED'
                                              ? const Color(0xFF00C853).withOpacity(0.03)
                                              : ThemeConfig.primaryColor.withOpacity(0.01),
                                        ],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: status == 'DRIVER_ARRIVED'
                                            ? const Color(0xFF00C853).withOpacity(0.3)
                                            : ThemeConfig.primaryColor.withOpacity(0.15),
                                        width: status == 'DRIVER_ARRIVED' ? 2.0 : 1.5,
                                      ),
                                      boxShadow: status == 'DRIVER_ARRIVED'
                                          ? [
                                              BoxShadow(
                                                color: const Color(0xFF00C853).withOpacity(0.2),
                                                blurRadius: 12,
                                                offset: const Offset(0, 4),
                                              ),
                                            ]
                                          : null,
                                    ),
                                    child: Column(
                                      children: [
                                        if (status == 'DRIVER_ARRIVED') ...[
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.all(6),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF00C853).withOpacity(0.15),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(
                                                  Icons.check_circle,
                                                  color: Color(0xFF00C853),
                                                  size: 16,
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              const Expanded(
                                                child: Text(
                                                  'Driver has arrived at pickup!',
                                                  style: TextStyle(
                                                    color: Color(0xFF00C853),
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          Container(
                                            height: 1,
                                            color: const Color(0xFF00C853).withOpacity(0.1),
                                          ),
                                          const SizedBox(height: 12),
                                        ],
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.all(8),
                                                  decoration: BoxDecoration(
                                                    color: status == 'DRIVER_ARRIVED'
                                                        ? const Color(0xFF00C853).withOpacity(0.15)
                                                        : ThemeConfig.primaryColor.withOpacity(0.1),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: Icon(
                                                    Icons.lock_outline_rounded,
                                                    color: status == 'DRIVER_ARRIVED'
                                                        ? const Color(0xFF00C853)
                                                        : ThemeConfig.primaryColor,
                                                    size: 20,
                                                  ),
                                                ),
                                                const SizedBox(width: 12),
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      'VERIFICATION PIN',
                                                      style: TextStyle(
                                                        color: status == 'DRIVER_ARRIVED'
                                                            ? const Color(0xFF00C853)
                                                            : ThemeConfig.primaryColor,
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                        letterSpacing: 1.0,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 2),
                                                    const Text(
                                                      'Share with driver to start ride',
                                                      style: TextStyle(
                                                        color: ThemeConfig.textSecondaryColor,
                                                        fontSize: 11,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                              decoration: BoxDecoration(
                                                color: status == 'DRIVER_ARRIVED'
                                                    ? const Color(0xFF00C853).withOpacity(0.1)
                                                    : ThemeConfig.backgroundColor,
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(
                                                  color: status == 'DRIVER_ARRIVED'
                                                      ? const Color(0xFF00C853).withOpacity(0.5)
                                                      : ThemeConfig.primaryColor.withOpacity(0.3),
                                                  width: status == 'DRIVER_ARRIVED' ? 2.0 : 1.5,
                                                ),
                                              ),
                                              child: Text(
                                                otpStr,
                                                style: const TextStyle(
                                                  color: ThemeConfig.textPrimaryColor,
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.bold,
                                                  letterSpacing: 4.0,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 20),
                              ],

                              // Premium EV Scooty 3D Track Mockup Panel
                              Container(
                                margin: const EdgeInsets.only(bottom: 20),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      ThemeConfig.primaryColor.withOpacity(0.08),
                                      const Color(0xFF5FD068).withOpacity(0.03),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: ThemeConfig.primaryColor.withOpacity(0.15), width: 1.0),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.02),
                                      blurRadius: 8,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      flex: 3,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(
                                                Icons.electric_scooter_rounded,
                                                color: ThemeConfig.primaryColor,
                                                size: 16,
                                              ),
                                              const SizedBox(width: 8),
                                              const Text(
                                                'VOLZO EV TRACKING',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: ThemeConfig.primaryColor,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          const Text(
                                            'Volzo E-Scooty Pro',
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              color: ThemeConfig.textPrimaryColor,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          const Text(
                                            'Premium 100% emission-free green ride. Battery charge at 88% with direct location sync.',
                                            style: TextStyle(
                                              fontSize: 10.5,
                                              color: ThemeConfig.textSecondaryColor,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      flex: 2,
                                      child: SizedBox(
                                        height: 70,
                                        child: Image.asset(
                                          'assets/images/ev_scooter_tracking_mockup.png',
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ],

                    // Locations details cards
                    _buildLocationCard(
                      Icons.circle,
                      'PICKUP POINT',
                      _rideData!['pickupLocation']?['address'] ?? _rideData!['pickupAddress'] ?? 'Pickup',
                      ThemeConfig.successColor,
                    ),
                    const SizedBox(height: 12),
                    _buildLocationCard(
                      Icons.location_on,
                      'DROP DESTINATION',
                      _rideData!['dropoffLocation']?['address'] ?? _rideData!['dropAddress'] ?? 'Dropoff',
                      ThemeConfig.errorColor,
                    ),
                    const SizedBox(height: 24),

                    // Fare Card
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      decoration: BoxDecoration(
                        color: ThemeConfig.backgroundColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: ThemeConfig.dividerColor),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Estimated Cost',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: ThemeConfig.textPrimaryColor),
                          ),
                          Text(
                            '₹${_rideData!['estimatedFare'] ?? _rideData!['fare'] ?? '0'}',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: ThemeConfig.primaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String text;

    // Supported exact backend uppercase status keys
    switch (status) {
      case 'PENDING':
      case 'REQUESTED':
        color = ThemeConfig.warningColor;
        text = 'Finding Driver...';
        break;
      case 'ACCEPTED':
        color = ThemeConfig.primaryColor;
        text = 'Driver Assigned';
        break;
      case 'DRIVER_ARRIVED':
        color = const Color(0xFF00D9FF);
        text = 'Driver Arrived';
        break;
      case 'STARTED':
        color = ThemeConfig.successColor;
        text = 'Ride in Progress';
        break;
      case 'COMPLETED':
        color = ThemeConfig.successColor;
        text = 'Completed';
        break;
      case 'CANCELLED':
        color = ThemeConfig.errorColor;
        text = 'Cancelled';
        break;
      default:
        color = ThemeConfig.textSecondaryColor;
        text = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildLocationCard(IconData icon, String label, String address, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ThemeConfig.backgroundColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ThemeConfig.dividerColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    color: color,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  address,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: ThemeConfig.textPrimaryColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
