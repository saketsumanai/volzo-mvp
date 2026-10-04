import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';

class RideHistoryPage extends StatefulWidget {
  const RideHistoryPage({super.key});

  @override
  State<RideHistoryPage> createState() => _RideHistoryPageState();
}

class _RideHistoryPageState extends State<RideHistoryPage> {
  List<dynamic> _rides = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchRideHistory();
  }

  Future<void> _fetchRideHistory() async {
    try {
      final response = await ApiClient.get('/rides/history');
      setState(() {
        _rides = response.data['data'];
        _isLoading = false;
      });
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ride History'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _rides.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.history,
                        size: 80,
                        color: ThemeConfig.textSecondaryColor,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'No rides yet',
                        style: TextStyle(
                          fontSize: 18,
                          color: ThemeConfig.textSecondaryColor,
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchRideHistory,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _rides.length,
                    itemBuilder: (context, index) {
                      final ride = _rides[index];
                      return _buildRideCard(ride);
                    },
                  ),
                ),
    );
  }

  Widget _buildRideCard(Map<String, dynamic> ride) {
    final date = DateTime.parse(ride['createdAt']);
    final formattedDate = DateFormat('MMM dd, yyyy • hh:mm a').format(date);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _getStatusColor(ride['status']).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  ride['status'].toString().toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: _getStatusColor(ride['status']),
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '₹${ride['fare']}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: ThemeConfig.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Pickup
          Row(
            children: [
              const Icon(Icons.location_on, size: 16, color: ThemeConfig.successColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  ride['pickupAddress'],
                  style: const TextStyle(fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Drop
          Row(
            children: [
              const Icon(Icons.flag, size: 16, color: ThemeConfig.errorColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  ride['dropAddress'],
                  style: const TextStyle(fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Footer
          Row(
            children: [
              Icon(
                _getVehicleIcon(ride['vehicleType']),
                size: 16,
                color: ThemeConfig.textSecondaryColor,
              ),
              const SizedBox(width: 4),
              Text(
                ride['vehicleType'].toString().replaceAll('_', ' ').toUpperCase(),
                style: const TextStyle(
                  fontSize: 12,
                  color: ThemeConfig.textSecondaryColor,
                ),
              ),
              const Spacer(),
              Text(
                formattedDate,
                style: const TextStyle(
                  fontSize: 12,
                  color: ThemeConfig.textSecondaryColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'completed':
        return ThemeConfig.successColor;
      case 'cancelled':
        return ThemeConfig.errorColor;
      case 'started':
        return ThemeConfig.primaryColor;
      default:
        return ThemeConfig.warningColor;
    }
  }

  IconData _getVehicleIcon(String vehicleType) {
    switch (vehicleType) {
      case 'scooter':
        return Icons.electric_scooter;
      case 'scooter_pro':
        return Icons.electric_bolt;
      default:
        return Icons.electric_scooter;
    }
  }
}
