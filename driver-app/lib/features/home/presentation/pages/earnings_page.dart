/**
 * Volzo Driver App — Earnings Page
 * Dark glassmorphic design, animated earnings counter, 7-day bar chart,
 * trip payout history list, and real-time socket earnings updates.
 */

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';

class EarningsPage extends StatefulWidget {
  const EarningsPage({super.key});

  @override
  State<EarningsPage> createState() => _EarningsPageState();
}

class _EarningsPageState extends State<EarningsPage>
    with TickerProviderStateMixin {
  bool _isLoading = true;
  Map<String, dynamic>? _earningsData;
  List<dynamic> _recentRides = [];

  // 7-day chart data
  List<double> _weeklyData = List.filled(7, 0.0);
  double _weeklyMax = 1.0;

  // Animated total counter
  late AnimationController _counterController;
  late Animation<double> _counterAnim;
  double _displayedTotal = 0.0;

  @override
  void initState() {
    super.initState();

    _counterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _counterAnim = CurvedAnimation(
        parent: _counterController, curve: Curves.easeOutCubic);

    _fetchEarnings();

    // Real-time earnings update on ride completion
    SocketClient.on('ride:completed', (data) {
      if (!mounted) return;
      final fare = (data?['fare'] ?? 0.0) as num;
      final prevTotal = (_earningsData?['totalEarnings'] as num?)?.toDouble() ?? 0.0;
      final newTotal = prevTotal + fare.toDouble();
      setState(() {
        if (_earningsData != null) {
          _earningsData!['totalEarnings'] = newTotal;
          _earningsData!['todayEarnings'] = ((_earningsData!['todayEarnings'] as num?)?.toDouble() ?? 0.0) + fare.toDouble();
          _earningsData!['totalRides'] = ((_earningsData!['totalRides'] as int?) ?? 0) + 1;
        }
      });
      _animateCounter(newTotal);
    });
  }

  Future<void> _fetchEarnings() async {
    setState(() => _isLoading = true);
    try {
      final resp = await ApiClient.get('/drivers/earnings');
      final data = resp.data['data'];
      setState(() {
        _earningsData = data;
        _recentRides = (data['recentRides'] ?? data['rides'] ?? []) as List;
        _isLoading = false;
      });

      // Build 7-day chart data
      final weekRides = _recentRides.take(50).toList();
      final now = DateTime.now();
      final weeklyMap = <int, double>{};
      for (final ride in weekRides) {
        try {
          final date = DateTime.parse(ride['createdAt'].toString());
          final dayDiff = now.difference(date).inDays;
          if (dayDiff < 7) {
            weeklyMap[dayDiff] = (weeklyMap[dayDiff] ?? 0.0) +
                (ride['fare'] as num? ?? 0.0).toDouble();
          }
        } catch (_) {}
      }
      setState(() {
        _weeklyData = List.generate(7, (i) => weeklyMap[6 - i] ?? 0.0);
        _weeklyMax = _weeklyData.fold(1.0, math.max);
      });

      final total = (data['totalEarnings'] as num? ?? 0.0).toDouble();
      _animateCounter(total);
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.getErrorMessage(e), style: const TextStyle(color: Colors.white)),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
      }
    }
  }

  void _animateCounter(double target) {
    final start = _displayedTotal;
    _counterController.forward(from: 0).whenComplete(() {
      if (mounted) setState(() => _displayedTotal = target);
    });
    _counterAnim.addListener(() {
      if (mounted) {
        setState(() => _displayedTotal = start + (target - start) * _counterAnim.value);
      }
    });
  }

  @override
  void dispose() {
    _counterController.dispose();
    SocketClient.off('ride:completed');
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
            : RefreshIndicator(
                onRefresh: _fetchEarnings,
                color: const Color(0xFF00C853),
                backgroundColor: const Color(0xFF111827),
                child: CustomScrollView(
                  physics: const BouncingScrollPhysics(),
                  slivers: [
                    _buildSliverHeader(),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          _buildStatsGrid(),
                          const SizedBox(height: 24),
                          _buildWeeklyChart(),
                          const SizedBox(height: 24),
                          _buildRecentRidesSection(),
                        ]),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildSliverHeader() {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      backgroundColor: const Color(0xFF060811),
      foregroundColor: Colors.white,
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0A1628), Color(0xFF060811)],
            ),
          ),
          child: Stack(children: [
            // Background orb
            Positioned(
              top: -30, right: -40,
              child: Container(
                width: 180, height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [const Color(0xFF00C853).withOpacity(0.15), Colors.transparent],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const SizedBox(height: 40),
                  Text('Earnings', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  AnimatedBuilder(
                    animation: _counterAnim,
                    builder: (_, __) => Text(
                      '₹${_displayedTotal.toStringAsFixed(0)}',
                      style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w900, letterSpacing: -1),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text('Total lifetime earnings',
                      style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 13)),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildStatsGrid() {
    final today = ((_earningsData?['todayEarnings'] ?? _earningsData?['today']) as num?)?.toDouble() ?? 0.0;
    final week = ((_earningsData?['weekEarnings'] ?? _earningsData?['week']) as num?)?.toDouble() ?? 0.0;
    final totalRides = (_earningsData?['totalRides'] ?? _earningsData?['completedRides'] ?? 0) as int;
    final avgRating = ((_earningsData?['averageRating'] ?? _earningsData?['avgRating'] ?? 5.0) as num).toDouble();

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _statCard('Today', '₹${today.toStringAsFixed(0)}', Icons.today_rounded, const Color(0xFF00C853)),
        _statCard('This Week', '₹${week.toStringAsFixed(0)}', Icons.calendar_view_week_rounded, const Color(0xFF0066FF)),
        _statCard('Total Rides', '$totalRides', Icons.electric_scooter_rounded, const Color(0xFF00D9FF)),
        _statCard('Avg Rating', avgRating.toStringAsFixed(1), Icons.star_rounded, Colors.amber),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withOpacity(0.18)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 22),
        const Spacer(),
        Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w900)),
        Text(label, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
      ]),
    );
  }

  Widget _buildWeeklyChart() {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final now = DateTime.now();
    final dayLabels = List.generate(7, (i) {
      final d = now.subtract(Duration(days: 6 - i));
      return days[d.weekday - 1];
    });

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('7-Day Earnings', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 20),
        SizedBox(
          height: 100,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(7, (i) {
              final val = _weeklyData[i];
              final frac = _weeklyMax > 0 ? (val / _weeklyMax) : 0.0;
              final isToday = i == 6;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                    if (val > 0)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text('₹${val.toStringAsFixed(0)}',
                            style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 8, fontWeight: FontWeight.w600)),
                      ),
                    Container(
                      height: math.max(8.0, 80.0 * frac),
                      decoration: BoxDecoration(
                        color: isToday ? const Color(0xFF00C853) : const Color(0xFF00C853).withOpacity(0.3),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: isToday ? [BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 8)] : [],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(dayLabels[i],
                        style: TextStyle(
                          color: isToday ? Colors.white : Colors.white.withOpacity(0.35),
                          fontSize: 10,
                          fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                        )),
                  ]),
                ),
              );
            }),
          ),
        ),
      ]),
    );
  }

  Widget _buildRecentRidesSection() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Recent Rides', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 14),
      if (_recentRides.isEmpty)
        Center(
          child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(children: [
              Icon(Icons.electric_scooter_outlined, color: Colors.white.withOpacity(0.2), size: 48),
              const SizedBox(height: 12),
              Text('No rides yet. Go online to start earning!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 14)),
            ]),
          ),
        )
      else
        ..._recentRides.map((ride) => _buildRideCard(ride as Map<String, dynamic>)).toList(),
    ]);
  }

  Widget _buildRideCard(Map<String, dynamic> ride) {
    DateTime? date;
    try { date = DateTime.parse(ride['createdAt'].toString()); } catch (_) {}
    final formattedDate = date != null ? DateFormat('MMM dd • hh:mm a').format(date) : '';
    final fare = ride['fare'] ?? ride['estimatedFare'] ?? 0;
    final pickup = ride['pickupAddress'] ?? ride['pickupLocation']?['address'] ?? 'Pickup';
    final drop = ride['dropAddress'] ?? ride['dropoffLocation']?['address'] ?? 'Drop';
    final rideType = (ride['rideType'] ?? ride['vehicleType'] ?? 'SCOOTER').toString().replaceAll('_', ' ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withOpacity(0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(rideType, style: const TextStyle(color: Color(0xFF00C853), fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const Spacer(),
          Text('₹$fare', style: const TextStyle(color: Color(0xFF00C853), fontSize: 18, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 12),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(children: [
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF00C853), shape: BoxShape.circle)),
            Container(width: 1.5, height: 24, color: Colors.white.withOpacity(0.1)),
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle)),
          ]),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(pickup, style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 14),
            Text(drop, style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
        ]),
        const SizedBox(height: 8),
        Text(formattedDate, style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11)),
      ]),
    );
  }
}
