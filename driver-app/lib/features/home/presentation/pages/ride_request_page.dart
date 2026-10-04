/**
 * Volzo Driver App — Active Ride Page (En-Route)
 * Full-screen dark map, "Slide to Arrive" + "Slide to End Trip" gestures,
 * OTP verification modal, real-time rider call button, navigation deep-link,
 * socket-driven ride lifecycle, and earnings confirmation panel.
 */

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';
import 'payment_verification_page.dart';

class RideRequestPage extends StatefulWidget {
  final String rideId;
  const RideRequestPage({super.key, required this.rideId});

  @override
  State<RideRequestPage> createState() => _RideRequestPageState();
}

class _RideRequestPageState extends State<RideRequestPage>
    with TickerProviderStateMixin {
  GoogleMapController? _mapController;
  Map<String, dynamic>? _rideData;
  bool _isLoading = true;
  bool _isActioning = false;
  /// True while the HTTP POST /complete is in-flight or after we've already
  /// navigated away.  Prevents the socket ride:status:updated listener from
  /// triggering a conflicting setState / double-navigation.
  bool _isCompleting = false;
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};

  // Slide action state
  double _slideProgress = 0.0;
  bool _slideLocked = false;

  late AnimationController _pulseController;
  late Animation<double> _pulse;

  // Map dark style
  static const String _darkMapStyle = '''
[
  {"elementType": "geometry", "stylers": [{"color": "#0A0E1A"}]},
  {"elementType": "labels.text.stroke", "stylers": [{"color": "#060811"}]},
  {"elementType": "labels.text.fill", "stylers": [{"color": "#3E4A5B"}]},
  {"featureType": "road", "elementType": "geometry", "stylers": [{"color": "#141C2E"}]},
  {"featureType": "road.highway", "elementType": "geometry", "stylers": [{"color": "#1B2740"}]},
  {"featureType": "water", "elementType": "geometry", "stylers": [{"color": "#090D18"}]},
  {"featureType": "poi", "elementType": "labels", "stylers": [{"visibility": "off"}]},
  {"featureType": "transit", "elementType": "labels", "stylers": [{"visibility": "off"}]}
]
''';

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1500))
      ..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.85, end: 1.0)
        .animate(CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut));

    _fetchRideDetails();
    _setupSocketListeners();
  }

  void _setupSocketListeners() {
    SocketClient.joinRide(widget.rideId);

    SocketClient.on('ride:cancelled_by_rider', (data) {
      if (!mounted || _isCompleting) return;
      final dRideId = (data?['rideId'] ?? '').toString();
      if (dRideId.isEmpty || dRideId == widget.rideId) {
        _showCancellationNotice();
      }
    });

    SocketClient.on('ride:status:updated', (data) {
      if (!mounted) return;
      final incomingRideId = (data?['rideId'] ?? '').toString();
      if (incomingRideId != widget.rideId) return;

      final incomingStatus = (data?['status'] ?? '').toString().toUpperCase();

      // If we are already handling completion via HTTP, ignore this socket
      // event so the two paths don't race each other.
      if (_isCompleting) return;

      if (incomingStatus == 'COMPLETED') {
        // Ride was completed (possibly from another device / admin action).
        // Navigate to payment page immediately without an extra fetch.
        _isCompleting = true;
        if (!mounted) return;
        final rideData = _rideData; // use whatever we already have
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => FoolproofPaymentPage(
              rideId: widget.rideId,
              rideData: rideData,
            ),
          ),
        );
      } else {
        _fetchRideDetails();
      }
    });
  }

  Future<void> _fetchRideDetails() async {
    try {
      final resp = await ApiClient.get('/drivers/rides/${widget.rideId}');
      if (!mounted) return;
      if (resp.data == null || resp.data['data'] == null) {
        throw Exception('Invalid response from server');
      }
      final data = resp.data['data'];
      final ride = data['ride'] ?? data;

      if (ride == null || ride['id'] == null) {
        throw Exception('Ride data not found');
      }

      // If the ride is already COMPLETED and we aren't navigating yet, do so now.
      final fetchedStatus = (ride['status'] ?? '').toString().toUpperCase();
      if (fetchedStatus == 'COMPLETED' && !_isCompleting) {
        _isCompleting = true;
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => FoolproofPaymentPage(
              rideId: widget.rideId,
              rideData: Map<String, dynamic>.from(ride),
            ),
          ),
        );
        return;
      }

      if (mounted) {
        setState(() {
          _rideData = ride;
          _isLoading = false;
        });
        _setupMap();
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      if (mounted) _showError(ApiClient.getErrorMessage(e));
    }
  }

  double _parseCoord(dynamic val, double fallback) {
    if (val == null) return fallback;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? fallback;
    return fallback;
  }

  void _setupMap() {
    if (_rideData == null) return;

    final pickupLat = _parseCoord(_rideData!['pickupLocation']?['latitude'], 
        _parseCoord(_rideData!['pickupLatitude'], 28.6139));
    final pickupLng = _parseCoord(_rideData!['pickupLocation']?['longitude'],
        _parseCoord(_rideData!['pickupLongitude'], 77.2090));
    final dropLat = _parseCoord(_rideData!['dropoffLocation']?['latitude'],
        _parseCoord(_rideData!['dropLatitude'], 28.6139));
    final dropLng = _parseCoord(_rideData!['dropoffLocation']?['longitude'],
        _parseCoord(_rideData!['dropLongitude'], 77.2090));

    setState(() {
      _markers = {
        Marker(
          markerId: const MarkerId('pickup'),
          position: LatLng(pickupLat, pickupLng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Pickup'),
        ),
        Marker(
          markerId: const MarkerId('drop'),
          position: LatLng(dropLat, dropLng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: const InfoWindow(title: 'Destination'),
        ),
      };
      _polylines = {
        Polyline(
          polylineId: const PolylineId('route'),
          points: [LatLng(pickupLat, pickupLng), LatLng(dropLat, dropLng)],
          color: const Color(0xFF00C853),
          width: 4,
          patterns: [],
        ),
      };
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bounds = LatLngBounds(
        southwest: LatLng(math.min(pickupLat, dropLat), math.min(pickupLng, dropLng)),
        northeast: LatLng(math.max(pickupLat, dropLat), math.max(pickupLng, dropLng)),
      );
      _mapController?.animateCamera(CameraUpdate.newLatLngBounds(bounds, 90));
    });
  }

  Future<void> _arriveAtPickup() async {
    if (_isActioning) return;
    setState(() { _isActioning = true; _slideLocked = false; _slideProgress = 0; });
    HapticFeedback.heavyImpact();
    try {
      await ApiClient.post('/drivers/rides/${widget.rideId}/arrive');
      await _fetchRideDetails();
      _showSuccess('✅ Marked as Arrived at Pickup');
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isActioning = false);
    }
  }

  Future<void> _startRide() async {
    // Show OTP verification bottom sheet
    final otp = await _showOtpBottomSheet();
    if (otp == null || otp.length != 4) return;

    setState(() => _isActioning = true);
    HapticFeedback.heavyImpact();
    try {
      await ApiClient.post('/drivers/rides/${widget.rideId}/start', data: {'otp': otp});
      await _fetchRideDetails();
      _showSuccess('🚀 Ride started! Safe travels!');
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    } finally {
      if (mounted) setState(() { _isActioning = false; _slideProgress = 0; _slideLocked = false; });
    }
  }

  Future<void> _completeRide() async {
    if (_isActioning || _isCompleting) return;
    setState(() {
      _isActioning = true;
      _isCompleting = true; // block socket listener while HTTP call is in-flight
      _slideLocked = false;
      _slideProgress = 0;
    });
    HapticFeedback.heavyImpact();

    print('🚀 Starting complete ride...');

    try {
      final response = await ApiClient.post('/drivers/rides/${widget.rideId}/complete');

      if (!mounted) return;

      // Extract ride data from response with high safety
      Map<String, dynamic>? rideData;
      try {
        final respBody = response.data;
        if (respBody is Map) {
          final data = respBody['data'];
          if (data is Map) {
            rideData = Map<String, dynamic>.from(data['ride'] ?? data);
          }
        }
      } catch (e) {
        print('⚠️ Error extracting ride data: $e');
      }

      print('✅ Ride completed. Navigating to payment page...');

      // Navigate to FOOLPROOF payment page with ride data
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => FoolproofPaymentPage(
            rideId: widget.rideId,
            rideData: rideData,
          ),
        ),
      );
    } catch (e) {
      print('❌ Complete ride error: $e');
      if (mounted) {
        setState(() {
          _isActioning = false;
          _isCompleting = false; // allow retry
        });
        _showError(ApiClient.getErrorMessage(e));
      }
    }
  }


  Future<String?> _showOtpBottomSheet() {
    final otpController = TextEditingController();
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF0F1421),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Center(child: Container(width: 36, height: 4,
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 24),
              Row(children: [
                Container(padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: const Color(0xFF00C853).withOpacity(0.15), shape: BoxShape.circle),
                    child: const Icon(Icons.vpn_key_rounded, color: Color(0xFF00C853), size: 24)),
                const SizedBox(width: 12),
                const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('OTP Verification', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                  Text('Ask rider for their 4-digit PIN', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                ]),
              ]),
              const SizedBox(height: 24),
              TextField(
                controller: otpController,
                keyboardType: TextInputType.number,
                autofocus: true,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 16),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  hintText: '• • • •',
                  hintStyle: TextStyle(fontSize: 28, color: Colors.white.withOpacity(0.15), letterSpacing: 14),
                  counterText: '',
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.06),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
                  focusedBorder: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)), borderSide: BorderSide(color: Color(0xFF00C853), width: 1.8)),
                  contentPadding: const EdgeInsets.symmetric(vertical: 20),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(colors: [Color(0xFF00C853), Color(0xFF00E676)]),
                  boxShadow: [BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6))],
                ),
                child: ElevatedButton(
                  onPressed: () {
                    if (otpController.text.length == 4) {
                      Navigator.of(ctx).pop(otpController.text);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent, shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Verify & Start Ride', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ),
              const SizedBox(height: 8),
            ]),
          ),
        );
      },
    );
  }

  Future<void> _openNavigation() async {
    if (_rideData == null) return;
    final status = (_rideData!['status'] as String? ?? '').toUpperCase();
    final lat = status == 'ACCEPTED'
        ? (_rideData!['pickupLocation']?['latitude'] ?? 28.6139)
        : (_rideData!['dropoffLocation']?['latitude'] ?? 28.6139);
    final lng = status == 'ACCEPTED'
        ? (_rideData!['pickupLocation']?['longitude'] ?? 77.2090)
        : (_rideData!['dropoffLocation']?['longitude'] ?? 77.2090);

    final url = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _callRider() async {
    if (_rideData == null) return;
    
    final rider = _rideData?['rider'];
    final riderMap = rider is Map<String, dynamic> ? rider : <String, dynamic>{};
    final phone = (riderMap['phoneNumber'] ?? riderMap['phone'] ?? '').toString();
    
    if (phone.isNotEmpty) {
      final url = 'tel:$phone';
      if (await canLaunchUrl(Uri.parse(url))) await launchUrl(Uri.parse(url));
    } else {
      _showError('Rider phone number not available');
    }
  }

  void _showCancellationNotice() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF0F1421),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(children: [
          Container(padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFFEF4444).withOpacity(0.15), shape: BoxShape.circle),
              child: const Icon(Icons.cancel_rounded, color: Color(0xFFEF4444), size: 22)),
          const SizedBox(width: 12),
          const Text('Ride Cancelled', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
        content: Text('The rider has cancelled this ride.',
            style: TextStyle(color: Colors.white.withOpacity(0.65), fontSize: 14)),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00C853),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Back to Dashboard'),
          ),
        ],
      ),
    );
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: const Color(0xFFEF4444),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: const Color(0xFF00C853),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  void dispose() {
    SocketClient.leaveRide(widget.rideId);
    _mapController?.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF060811),
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00C853)),
          ),
        ),
      );
    }

    if (_rideData == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF060811),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          title: const Text('Ride Details'),
        ),
        body: const Center(child: Text('Ride not found', style: TextStyle(color: Colors.white))),
      );
    }

    final status = (_rideData!['status'] as String? ?? '').toUpperCase();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF060811),
        body: Stack(children: [
          // Full-screen dark map
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(
                _parseCoord(_rideData!['pickupLocation']?['latitude'], 28.6139),
                _parseCoord(_rideData!['pickupLocation']?['longitude'], 77.2090),
              ),
              zoom: 14,
            ),
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            onMapCreated: (ctrl) {
              _mapController = ctrl;
              ctrl.setMapStyle(_darkMapStyle);
            },
          ),

          // Bottom overlay gradient
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              height: 340,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xF0060811), Colors.transparent],
                ),
              ),
            ),
          ),

          // Top controls
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                _topButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
                const Spacer(),
                _topButton(Icons.phone_rounded, _callRider, color: const Color(0xFF00C853)),
                const SizedBox(width: 8),
                _topButton(Icons.navigation_rounded, _openNavigation, color: const Color(0xFF0066FF)),
              ]),
            ),
          ),

          // Bottom info & action panel
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: _buildBottomPanel(status),
          ),
        ]),
      ),
    );
  }

  Widget _topButton(IconData icon, VoidCallback onTap, {Color? color}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: color != null ? color.withOpacity(0.15) : Colors.black.withOpacity(0.5),
          shape: BoxShape.circle,
          border: Border.all(color: color != null ? color.withOpacity(0.4) : Colors.white.withOpacity(0.15)),
        ),
        child: Icon(icon, color: color ?? Colors.white, size: 20),
      ),
    );
  }

  Widget _buildBottomPanel(String status) {
    // Null-safe data extraction
    final rider = _rideData?['rider'];
    final riderMap = rider is Map<String, dynamic> ? rider : <String, dynamic>{};
    final riderName = (riderMap['name'] ?? 'Rider').toString();
    
    final pickupLoc = _rideData?['pickupLocation'];
    final pickupAddr = _rideData?['pickupAddress'];
    final pickup = (pickupLoc is Map ? pickupLoc['address'] : null) ?? pickupAddr ?? 'Pickup';
    
    final dropLoc = _rideData?['dropoffLocation'];
    final dropAddr = _rideData?['dropAddress'];
    final drop = (dropLoc is Map ? dropLoc['address'] : null) ?? dropAddr ?? 'Destination';
    
    final fare = _rideData?['estimatedFare'] ?? _rideData?['fare'] ?? 0;
    final otp = (_rideData?['otp'] ?? '----').toString();

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0A0E1A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Handle
          Container(width: 36, height: 4,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.12), borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),

          // Status + rider row
          Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF111827),
                border: Border.all(color: const Color(0xFF00C853).withOpacity(0.4), width: 1.5),
              ),
              child: Center(child: Text(
                riderName.isNotEmpty ? riderName.substring(0, 1).toUpperCase() : 'R',
                style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.w900, fontSize: 18),
              )),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(riderName, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
              _buildStatusBadge(status),
            ])),
            // Fare
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('₹$fare', style: const TextStyle(color: Color(0xFF00C853), fontSize: 20, fontWeight: FontWeight.w900)),
              Text('Fare', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
            ]),
          ]),
          const SizedBox(height: 16),

          // Route minicard
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withOpacity(0.07)),
            ),
            child: Column(children: [
              _routeMini(Icons.radio_button_checked, 'Pickup', pickup, const Color(0xFF00C853)),
              Container(margin: const EdgeInsets.only(left: 9), height: 18, width: 1.5, color: Colors.white.withOpacity(0.1)),
              _routeMini(Icons.location_on_rounded, 'Drop', drop, const Color(0xFFEF4444)),
            ]),
          ),
          const SizedBox(height: 14),

          // OTP display for ACCEPTED or DRIVER_ARRIVED state
          if (status == 'ACCEPTED' || status == 'DRIVER_ARRIVED') ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF00C853).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF00C853).withOpacity(0.2)),
              ),
              child: Row(children: [
                const Icon(Icons.lock_outline_rounded, color: Color(0xFF00C853), size: 16),
                const SizedBox(width: 8),
                const Text('Rider OTP', style: TextStyle(color: Color(0xFF00C853), fontSize: 12, fontWeight: FontWeight.bold)),
                const Spacer(),
                Text('Ask rider for: ____', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 12),
          ],

          // Slide to Action button
          _buildSlideAction(status),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color c; String label;
    switch (status) {
      case 'ACCEPTED': c = const Color(0xFF0066FF); label = 'Driver Assigned'; break;
      case 'DRIVER_ARRIVED': c = const Color(0xFF00D9FF); label = 'Arrived at Pickup'; break;
      case 'STARTED': c = const Color(0xFF00C853); label = 'Ride in Progress'; break;
      case 'COMPLETED': c = const Color(0xFF00C853); label = 'Completed'; break;
      default: c = Colors.white.withOpacity(0.4); label = status;
    }
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  Widget _routeMini(IconData icon, String label, String addr, Color color) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
        Text(addr, style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 12),
            maxLines: 1, overflow: TextOverflow.ellipsis),
      ])),
    ]);
  }

  Widget _buildSlideAction(String status) {
    String label; Color color; VoidCallback onComplete;

    switch (status) {
      case 'ACCEPTED':
        label = 'Slide to Arrive'; color = const Color(0xFF0066FF); onComplete = _arriveAtPickup; break;
      case 'DRIVER_ARRIVED':
        label = 'Slide to Start Ride'; color = const Color(0xFF00C853); onComplete = _startRide; break;
      case 'STARTED':
        label = 'Slide to End Trip'; color = const Color(0xFFEF4444); onComplete = _completeRide; break;
      default:
        return const SizedBox.shrink();
    }

    final trackWidth = MediaQuery.of(context).size.width - 40;
    const thumbSize = 56.0;

    return GestureDetector(
      onHorizontalDragUpdate: (details) {
        if (_slideLocked || _isActioning) return;
        setState(() {
          _slideProgress = ((_slideProgress * (trackWidth - thumbSize)) + details.delta.dx)
              .clamp(0.0, trackWidth - thumbSize) / (trackWidth - thumbSize);
        });
      },
      onHorizontalDragEnd: (_) {
        if (_slideLocked) return;
        if (_slideProgress > 0.85) {
          setState(() { _slideLocked = true; _slideProgress = 1.0; });
          onComplete();
        } else {
          setState(() => _slideProgress = 0.0);
        }
      },
      child: AnimatedBuilder(
        animation: _pulse,
        builder: (_, __) => Container(
          height: thumbSize,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(thumbSize / 2),
            border: Border.all(color: color.withOpacity(0.3), width: 1.5),
          ),
          child: Stack(children: [
            // Fill track
            Positioned(
              left: 0, top: 0, bottom: 0,
              width: thumbSize + _slideProgress * (trackWidth - thumbSize),
              child: Container(
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2 * _pulse.value),
                  borderRadius: BorderRadius.circular(thumbSize / 2),
                ),
              ),
            ),
            // Label
            Center(
              child: Text(label,
                  style: TextStyle(color: color.withOpacity(0.7), fontSize: 14, fontWeight: FontWeight.w700)),
            ),
            // Thumb
            Positioned(
              left: _slideProgress * (trackWidth - thumbSize),
              top: 0, bottom: 0,
              child: _isActioning
                  ? Container(
                      width: thumbSize, height: thumbSize,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      child: const Center(child: SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))))
                  : Container(
                      width: thumbSize, height: thumbSize,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: color.withOpacity(0.5 * _pulse.value), blurRadius: 12, spreadRadius: 2)],
                      ),
                      child: const Icon(Icons.double_arrow_rounded, color: Colors.white, size: 24),
                    ),
            ),
          ]),
        ),
      ),
    );
  }
}
