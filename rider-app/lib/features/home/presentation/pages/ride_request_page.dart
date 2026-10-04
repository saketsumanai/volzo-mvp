import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:math' as math;
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import 'ride_tracking_page.dart';

class RideRequestPage extends StatefulWidget {
  final String? preselectedVehicleType;
  final LatLng? currentLatLng;

  const RideRequestPage({super.key, this.preselectedVehicleType, this.currentLatLng});

  @override
  State<RideRequestPage> createState() => _RideRequestPageState();
}

class _RideRequestPageState extends State<RideRequestPage> {
  final _pickupController = TextEditingController(text: 'Current Location');
  final _dropController = TextEditingController();
  final _couponController = TextEditingController();
  
  String _selectedVehicleType = 'SCOOTER';
  int _seatsRequired = 1;
  double? _estimatedFare;
  double? _discountAmount;
  double? _calculatedDistance;
  bool _isCalculating = false;
  bool _isBooking = false;

  GoogleMapController? _mapController;
  Set<Marker> _markers = {};

  // Standard Delhi coordinate center
  final LatLng _defaultCenter = const LatLng(28.6139, 77.2090);

  // Popular Delhi/NCR preset locations dictionary for offline mock and suggestions autocompletes
  final Map<String, LatLng> _ncrHubs = {
    'Delhi IGI Airport Terminal 3': const LatLng(28.5562, 77.1000),
    'Noida Sector 62, Metro Station': const LatLng(28.6273, 77.3725),
    'Connaught Place (CP), New Delhi': const LatLng(28.6304, 77.2177),
    'Gurugram Cyber City, DLF Phase 3': const LatLng(28.4950, 77.0896),
    'Saket District Centre, New Delhi': const LatLng(28.5244, 77.2066),
    'Karol Bagh Market, New Delhi': const LatLng(28.6441, 77.1882),
    'Dwarka Sector 21, New Delhi': const LatLng(28.5522, 77.0583),
    'Hauz Khas Village, New Delhi': const LatLng(28.5494, 77.2001),
    'Delhi University North Campus': const LatLng(28.6906, 77.2065),
    'Akshardham Temple, New Delhi': const LatLng(28.6127, 77.2773),
    'Noida Sector 18 (Atta Market)': const LatLng(28.5705, 77.3260),
    'India Gate, New Delhi': const LatLng(28.6129, 77.2295),
    'Red Fort, Old Delhi': const LatLng(28.6562, 77.2410),
    'Vasant Kunj DLF Promenade Mall': const LatLng(28.5428, 77.1557),
    'Ghaziabad Indirapuram Hub': const LatLng(28.6366, 77.3704),
    'Noida Electronic City Metro': const LatLng(28.6275, 77.3811),
  };

  // Autocomplete suggestions states
  List<String> _suggestions = [];
  bool _showSuggestions = false;
  bool _isPickupActive = false;

  // Interactive map-locate states
  bool _isSelectingOnMap = false;

  // Filter dictionary based on text query input
  void _onSearchChanged(String text, {required bool isPickup}) {
    if (text.isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      return;
    }

    final query = text.toLowerCase().trim();
    final matches = _ncrHubs.keys
        .where((key) => key.toLowerCase().contains(query))
        .toList();

    setState(() {
      _suggestions = matches;
      _showSuggestions = matches.isNotEmpty;
      _isPickupActive = isPickup;
    });
  }

  // Reverse geocodes LatLng coordinates to beautiful street names
  Future<String> _getAddressFromCoordinates(double latitude, double longitude) async {
    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);
      if (placemarks.isNotEmpty) {
        final pm = placemarks.first;
        final name = pm.name ?? '';
        final subLocality = pm.subLocality ?? '';
        final locality = pm.locality ?? '';
        final administrativeArea = pm.administrativeArea ?? '';
        
        final parts = [
          if (name.isNotEmpty && !name.contains(RegExp(r'^\d+$')) && !name.contains('+')) name,
          if (subLocality.isNotEmpty && subLocality != name) subLocality,
          if (locality.isNotEmpty) locality,
          if (administrativeArea.isNotEmpty) administrativeArea,
        ];
        if (parts.isNotEmpty) {
          return parts.join(', ');
        }
      }
    } catch (e) {
      print('⚠️ Reverse geocoding failed: $e');
    }
    return 'Pin Location (${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)})';
  }

  LatLng? _currentLatLngState;

  @override
  void initState() {
    super.initState();
    if (widget.preselectedVehicleType != null) {
      _selectedVehicleType = widget.preselectedVehicleType!.toUpperCase();
    }
    _loadCurrentLocationAndMarkers();
  }

  Future<void> _loadCurrentLocationAndMarkers() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
      final position = await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 5),
      );
      if (mounted) {
        setState(() {
          _currentLatLngState = LatLng(position.latitude, position.longitude);
        });
      }
    } catch (e) {
      print('⚠️ GPS failed/timed out in RideRequestPage: $e');
    }
    await _updateMarkers();
  }

  @override
  void dispose() {
    _pickupController.dispose();
    _dropController.dispose();
    _couponController.dispose();
    _mapController?.dispose();
    super.dispose();
  }

  // Haversine formula to compute exact distance in kilometers with a 25% padding for routing
  double _calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0; // Earth radius in km
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLon = (lon2 - lon1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    var dist = r * c;
    if (dist.isNaN || dist < 0.1) dist = 3.5; // fallback
    
    // Add 25% padding for true routing distance and round to 2 decimal places
    return double.parse((dist * 1.25).toStringAsFixed(2));
  }

  Future<LatLng> _getCoordinates(String address, {bool isPickup = true}) async {
    try {
      if (address.toLowerCase() == 'current location' || address.isEmpty) {
        return widget.currentLatLng ?? _currentLatLngState ?? _defaultCenter;
      }
      
      // Match from preset hubs first
      for (var entry in _ncrHubs.entries) {
        if (address.toLowerCase().trim() == entry.key.toLowerCase().trim()) {
          return entry.value;
        }
      }
      
      final locations = await locationFromAddress(address);
      if (locations.isNotEmpty) {
        return LatLng(locations.first.latitude, locations.first.longitude);
      }
    } catch (e) {
      print('⚠️ Geocoding failed for "$address": $e. Using local mock coordinates.');
    }
    
    // Fallback coordinates based on pickup/drop address matching
    if (isPickup) {
      if (address.toLowerCase().contains('connaught') || address.toLowerCase().contains('cp')) {
        return const LatLng(28.6304, 77.2177);
      }
      if (address.toLowerCase().contains('noida')) {
        return const LatLng(28.5708, 77.3272);
      }
      if (address.toLowerCase().contains('airport') || address.toLowerCase().contains('igi')) {
        return const LatLng(28.5562, 77.1000);
      }
      return _defaultCenter;
    } else {
      if (address.toLowerCase().contains('noida')) {
        return const LatLng(28.5708, 77.3272);
      }
      if (address.toLowerCase().contains('gurugram') || address.toLowerCase().contains('gurgaon')) {
        return const LatLng(28.4595, 77.0266);
      }
      if (address.toLowerCase().contains('airport') || address.toLowerCase().contains('igi')) {
        return const LatLng(28.5562, 77.1000);
      }
      if (address.toLowerCase().contains('saket')) {
        return const LatLng(28.5244, 77.2066);
      }
      return const LatLng(28.6280, 77.2250); // slight offset from center
    }
  }

  Future<void> _updateMarkers() async {
    final pickupLatLng = await _getCoordinates(_pickupController.text, isPickup: true);
    LatLng? dropLatLng;
    if (_dropController.text.isNotEmpty) {
      dropLatLng = await _getCoordinates(_dropController.text, isPickup: false);
    }

    if (!mounted) return;

    setState(() {
      _markers = {
        Marker(
          markerId: const MarkerId('pickup'),
          position: pickupLatLng,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Pickup Location'),
        ),
      };

      if (dropLatLng != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('drop'),
            position: dropLatLng,
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
            infoWindow: const InfoWindow(title: 'Destination'),
          ),
        );

        // Pan map to fit markers
        final bounds = LatLngBounds(
          southwest: LatLng(
            math.min(pickupLatLng.latitude, dropLatLng.latitude),
            math.min(pickupLatLng.longitude, dropLatLng.longitude),
          ),
          northeast: LatLng(
            math.max(pickupLatLng.latitude, dropLatLng.latitude),
            math.max(pickupLatLng.longitude, dropLatLng.longitude),
          ),
        );
        _mapController?.animateCamera(CameraUpdate.newLatLngBounds(bounds, 80));
      } else {
        _mapController?.animateCamera(CameraUpdate.newLatLngZoom(pickupLatLng, 14));
      }
    });
  }

  Future<void> _calculateFare() async {
    if (_pickupController.text.isEmpty || _dropController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter pickup and dropoff locations')),
      );
      return;
    }

    setState(() {
      _isCalculating = true;
      _estimatedFare = null;
      _discountAmount = null;
    });

    try {
      final pickupLatLng = await _getCoordinates(_pickupController.text, isPickup: true);
      final dropLatLng = await _getCoordinates(_dropController.text, isPickup: false);

      // Compute geodistance using Haversine formula in Dart
      final distance = _calculateHaversineDistance(
        pickupLatLng.latitude,
        pickupLatLng.longitude,
        dropLatLng.latitude,
        dropLatLng.longitude,
      );

      // Map local 2W types to backend-supported types for simplicity
      final backendType = _selectedVehicleType == 'SCOOTER_PRO' ? 'RICKSHAW_PRIVATE' : 'SCOOTER';

      // Make API request with CORRECT backend validation schema
      final response = await ApiClient.post('/rides/calculate-fare', data: {
        'rideType': backendType,
        'distance': distance,
        'seatsBooked': 1,
        if (_couponController.text.isNotEmpty) 'couponCode': _couponController.text.trim().toUpperCase(),
      });

      setState(() {
        _calculatedDistance = distance;
        final rawFare = response.data['data']['fare'] ?? 
                         response.data['data']['finalFare'] ?? 
                         response.data['data']['estimatedFare'] ?? 
                         0.0;
        _estimatedFare = rawFare.toDouble();
        _discountAmount = response.data['data']['discount']?.toDouble() ?? 0.0;
        _isCalculating = false;
      });

      _updateMarkers();
    } catch (e) {
      setState(() => _isCalculating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ApiClient.getErrorMessage(e)),
          backgroundColor: ThemeConfig.errorColor,
        ),
      );
    }
  }

  Future<void> _bookRide() async {
    if (_pickupController.text.isEmpty || _dropController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter pickup and dropoff locations')),
      );
      return;
    }

    setState(() => _isBooking = true);

    try {
      final pickupLatLng = await _getCoordinates(_pickupController.text, isPickup: true);
      final dropLatLng = await _getCoordinates(_dropController.text, isPickup: false);

      final distance = _calculatedDistance ?? _calculateHaversineDistance(
        pickupLatLng.latitude,
        pickupLatLng.longitude,
        dropLatLng.latitude,
        dropLatLng.longitude,
      );

      // Make API Request conforming to exact backend body schema
      final backendType = _selectedVehicleType == 'SCOOTER_PRO' ? 'RICKSHAW_PRIVATE' : 'SCOOTER';
      
      final response = await ApiClient.post('/rides', data: {
        'rideType': backendType,
        'pickupLocation': {
          'address': _pickupController.text,
          'latitude': pickupLatLng.latitude,
          'longitude': pickupLatLng.longitude,
        },
        'dropoffLocation': {
          'address': _dropController.text,
          'latitude': dropLatLng.latitude,
          'longitude': dropLatLng.longitude,
        },
        'estimatedDistance': distance,
        'seatsBooked': 1,
        if (_couponController.text.isNotEmpty) 'couponCode': _couponController.text.trim().toUpperCase(),
      });

      if (!mounted) return;

      final rideId = response.data['data']['ride']['id'];
      
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => RideTrackingPage(rideId: rideId),
        ),
      );
    } catch (e) {
      setState(() => _isBooking = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ApiClient.getErrorMessage(e)),
          backgroundColor: ThemeConfig.errorColor,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: Stack(
        children: [
          // 1. Google Map Background (Full screen on selection, Upper 58% otherwise)
          SizedBox(
            height: _isSelectingOnMap 
                ? MediaQuery.of(context).size.height 
                : MediaQuery.of(context).size.height * 0.58,
            child: GoogleMap(
              initialCameraPosition: CameraPosition(
                target: _defaultCenter,
                zoom: 14,
              ),
              markers: _markers,
              myLocationEnabled: true,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
              onMapCreated: (controller) => _mapController = controller,
              onTap: (latLng) async {
                if (_isSelectingOnMap) {
                  // Resolve coordinate to address in background
                  final resolvedAddress = await _getAddressFromCoordinates(latLng.latitude, latLng.longitude);
                  
                  setState(() {
                    _dropController.text = resolvedAddress;
                    _isSelectingOnMap = false;
                  });
                  
                  // Update markers on map & automatically recalculate ride fare
                  await _updateMarkers();
                  await _calculateFare();
                }
              },
            ),
          ),

          // Floating guide banner overlay for interactive map drop selection
          if (_isSelectingOnMap)
            Positioned(
              top: MediaQuery.of(context).padding.top + 80,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: ThemeConfig.surfaceColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: ThemeConfig.primaryColor, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 15,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_searching, color: ThemeConfig.primaryColor, size: 20),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Tap anywhere on the map to set Drop destination',
                        style: TextStyle(
                          color: ThemeConfig.textPrimaryColor,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => setState(() => _isSelectingOnMap = false),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: ThemeConfig.backgroundColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: ThemeConfig.dividerColor),
                        ),
                        child: const Icon(Icons.close, color: ThemeConfig.textSecondaryColor, size: 16),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Top Floating Back Button
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Container(
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
            ),
          ),

          // 2. Sliding Search & Selector Card Sheet
          DraggableScrollableSheet(
            initialChildSize: _isSelectingOnMap ? 0.12 : 0.46,
            minChildSize: _isSelectingOnMap ? 0.10 : 0.44,
            maxChildSize: _isSelectingOnMap ? 0.15 : 0.88,
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
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  children: [
                    // Sheet Handle Bar
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
                    const SizedBox(height: 20),

                    // Title
                    const Text(
                      'Plan Your EV Ride',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: ThemeConfig.textPrimaryColor),
                    ),
                    const SizedBox(height: 16),

                    // Pickup and Drop Fields inside unified modern column
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Left Visual Dots & Connector Column
                        Column(
                          children: [
                            const SizedBox(height: 18),
                            const Icon(Icons.circle, color: ThemeConfig.successColor, size: 10),
                            Container(
                              width: 1.5,
                              height: 52,
                              color: ThemeConfig.dividerColor,
                            ),
                            const Icon(Icons.location_on, color: ThemeConfig.errorColor, size: 16),
                          ],
                        ),
                        const SizedBox(width: 14),
                        // Text inputs
                        Expanded(
                          child: Column(
                            children: [
                              // Pickup field
                              TextField(
                                controller: _pickupController,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: ThemeConfig.textPrimaryColor),
                                onChanged: (val) => _onSearchChanged(val, isPickup: true),
                                decoration: InputDecoration(
                                  labelText: 'Pickup Point',
                                  labelStyle: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13),
                                  hintText: 'Enter pickup address',
                                  suffixIcon: IconButton(
                                    icon: const Icon(Icons.my_location, color: ThemeConfig.primaryColor, size: 18),
                                    onPressed: () {
                                      _pickupController.text = 'Current Location';
                                      _updateMarkers();
                                      if (_dropController.text.isNotEmpty) _calculateFare();
                                    },
                                  ),
                                  filled: true,
                                  fillColor: ThemeConfig.backgroundColor,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: ThemeConfig.dividerColor),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: ThemeConfig.dividerColor),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: ThemeConfig.primaryColor, width: 1.5),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Destination field
                              TextField(
                                controller: _dropController,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: ThemeConfig.textPrimaryColor),
                                onChanged: (val) => _onSearchChanged(val, isPickup: false),
                                onSubmitted: (val) {
                                  _updateMarkers();
                                  _calculateFare();
                                },
                                decoration: InputDecoration(
                                  labelText: 'Destination Dropoff',
                                  labelStyle: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13),
                                  hintText: 'Where to?',
                                  suffixIcon: IconButton(
                                    icon: const Icon(Icons.map, color: ThemeConfig.primaryColor, size: 18),
                                    tooltip: 'Locate dropoff on map',
                                    onPressed: () {
                                      setState(() {
                                        _isSelectingOnMap = true;
                                        _showSuggestions = false;
                                      });
                                    },
                                  ),
                                  filled: true,
                                  fillColor: ThemeConfig.backgroundColor,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: ThemeConfig.dividerColor),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: ThemeConfig.dividerColor),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: const BorderSide(color: ThemeConfig.primaryColor, width: 1.5),
                                  ),
                                ),
                              ),

                              // Sleek suggestions dropdown list container
                              if (_showSuggestions && _suggestions.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Container(
                                  constraints: const BoxConstraints(maxHeight: 180),
                                  decoration: BoxDecoration(
                                    color: ThemeConfig.surfaceColor,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: ThemeConfig.dividerColor),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.05),
                                        blurRadius: 10,
                                      ),
                                    ],
                                  ),
                                  child: ListView.separated(
                                    shrinkWrap: true,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    itemCount: _suggestions.length,
                                    separatorBuilder: (context, index) => Divider(color: ThemeConfig.dividerColor, height: 1),
                                    itemBuilder: (context, index) {
                                      final place = _suggestions[index];
                                      return ListTile(
                                        dense: true,
                                        leading: const Icon(Icons.location_on_outlined, color: ThemeConfig.primaryColor, size: 16),
                                        title: Text(
                                          place,
                                          style: const TextStyle(
                                            color: ThemeConfig.textPrimaryColor,
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        onTap: () async {
                                          setState(() {
                                            if (_isPickupActive) {
                                              _pickupController.text = place;
                                            } else {
                                              _dropController.text = place;
                                            }
                                            _showSuggestions = false;
                                            _suggestions = [];
                                          });
                                          
                                          // Update maps markers & trigger calculations automatically
                                          await _updateMarkers();
                                          if (_dropController.text.isNotEmpty) {
                                            await _calculateFare();
                                          }
                                        },
                                      );
                                    },
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // EV Option Row Header
                    const Text(
                      'Select Vehicle Class',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: ThemeConfig.textPrimaryColor),
                    ),
                    const SizedBox(height: 12),

    // Vehicle Type Selectors
                    Row(
                      children: [
                        Expanded(
                          child: _buildEVClassCard(
                            'SCOOTER',
                            'Volzo 2W',
                            Icons.electric_scooter,
                            ThemeConfig.primaryColor,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildEVClassCard(
                            'SCOOTER_PRO',
                            'Volzo Pro',
                            Icons.electric_bolt,
                            const Color(0xFF00D9FF),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Coupon Input Row
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _couponController,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: ThemeConfig.textPrimaryColor),
                            textCapitalization: TextCapitalization.characters,
                            decoration: InputDecoration(
                              labelText: 'Apply Coupon Code',
                              labelStyle: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12),
                              hintText: 'e.g., VOLZO50',
                              filled: true,
                              fillColor: ThemeConfig.backgroundColor,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              prefixIcon: const Icon(Icons.confirmation_number_outlined, color: ThemeConfig.primaryColor, size: 18),
                              suffixIcon: _couponController.text.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.clear, size: 16),
                                      onPressed: () {
                                        _couponController.clear();
                                        if (_dropController.text.isNotEmpty) _calculateFare();
                                      },
                                    )
                                  : null,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: ThemeConfig.dividerColor),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: ThemeConfig.dividerColor),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: ThemeConfig.primaryColor, width: 1.5),
                              ),
                            ),
                            onChanged: (val) {
                              setState(() {});
                            },
                          ),
                        ),
                        if (_couponController.text.isNotEmpty) ...[
                          const SizedBox(width: 10),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _calculateFare,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: ThemeConfig.primaryColor.withOpacity(0.12),
                                foregroundColor: ThemeConfig.primaryColor,
                                side: const BorderSide(color: ThemeConfig.primaryColor, width: 1.0),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                              ),
                              child: const Text('Apply', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Price Breakdown / Estimations Output
                    if (_estimatedFare != null) ...[
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              ThemeConfig.primaryColor.withOpacity(0.05),
                              ThemeConfig.primaryColor.withOpacity(0.01),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: ThemeConfig.primaryColor.withOpacity(0.15), width: 1.0),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Estimated Fare', style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12)),
                                    if (_calculatedDistance != null) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Distance: ${_calculatedDistance} km',
                                        style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 11, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '₹${_estimatedFare!.toStringAsFixed(0)}',
                                      style: const TextStyle(color: ThemeConfig.textPrimaryColor, fontSize: 28, fontWeight: FontWeight.w900),
                                    ),
                                    if (_discountAmount != null && _discountAmount! > 0)
                                      Text(
                                        'Saved ₹${_discountAmount!.toStringAsFixed(0)}',
                                        style: const TextStyle(color: ThemeConfig.successColor, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Action Book Button
                    SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isCalculating || _isBooking
                            ? null
                            : (_estimatedFare == null ? _calculateFare : _bookRide),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _estimatedFare == null ? ThemeConfig.primaryColor : ThemeConfig.successColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _isCalculating || _isBooking
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Text(
                                _estimatedFare == null ? 'Calculate Ride Fare' : 'Confirm EV Booking',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                      ),
                    ),
                    const SizedBox(height: 30),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildEVClassCard(String type, String label, IconData icon, Color color) {
    final isSelected = _selectedVehicleType == type;

    return GestureDetector(
      onTap: () => setState(() {
        _selectedVehicleType = type;
        _estimatedFare = null;
        if (_dropController.text.isNotEmpty) _calculateFare();
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.08) : ThemeConfig.backgroundColor,
          border: Border.all(
            color: isSelected ? color : ThemeConfig.dividerColor,
            width: isSelected ? 1.8 : 1.0,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? color : ThemeConfig.textSecondaryColor,
              size: 28,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected ? color : ThemeConfig.textSecondaryColor,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
