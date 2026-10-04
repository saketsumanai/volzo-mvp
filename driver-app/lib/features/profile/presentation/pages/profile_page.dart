/**
 * Volzo Driver App — Profile Page
 * Dark glassmorphic design, KYC status badge, vehicle details,
 * earnings summary, and secure logout with confirmation.
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_client.dart';
import '../../../auth/presentation/pages/login_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage>
    with TickerProviderStateMixin {
  bool _isLoading = true;
  Map<String, dynamic>? _driverData;
  Map<String, dynamic>? _earningsData;

  late AnimationController _entryController;
  late Animation<double> _entryFade;
  late Animation<Offset> _entrySlide;

  @override
  void initState() {
    super.initState();

    _entryController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 700))
      ..forward();
    _entryFade = Tween<double>(begin: 0, end: 1)
        .animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOut));
    _entrySlide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic));

    _fetchProfile();
  }

  @override
  void dispose() {
    _entryController.dispose();
    super.dispose();
  }

  Future<void> _fetchProfile() async {
    try {
      final resp = await ApiClient.get('/drivers/profile');
      final data = resp.data['data'];
      final driver = data != null ? (data['driver'] ?? data) : null;
      setState(() => _driverData = driver);

      try {
        final earningsResp = await ApiClient.get('/drivers/earnings');
        setState(() => _earningsData = earningsResp.data['data']);
      } catch (_) {}

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF0F1421),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.12), shape: BoxShape.circle),
              child: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 28),
            ),
            const SizedBox(height: 16),
            const Text('Log Out?',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text('Are you sure you want to sign out from Volzo Driver?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13, height: 1.5)),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context, false),
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: Center(child: Text('Cancel',
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context, true),
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
                    ),
                    child: const Center(child: Text('Log Out',
                        style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w800))),
                  ),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ApiClient.post('/auth/logout');
      } catch (_) {}
      SocketClient.goOffline();
      SocketClient.disconnect();
      await ApiClient.clearAll();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        PageRouteBuilder(
          pageBuilder: (_, a, __) => const LoginPage(),
          transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 500),
        ),
        (r) => false,
      );
    }
  }

  Future<void> _showRideHistory() async {
    try {
      final resp = await ApiClient.get('/rides/history', queryParameters: {'limit': 20});
      final rides = (resp.data['data']?['rides'] as List?) ?? const [];
      if (!mounted) return;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0F1421),
        builder: (_) => SafeArea(
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.65,
            child: rides.isEmpty
                ? const Center(child: Text('No ride history found', style: TextStyle(color: Colors.white70)))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: rides.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final ride = rides[i] as Map<String, dynamic>;
                      final status = (ride['status'] ?? 'UNKNOWN').toString();
                      final amount = (ride['finalFare'] ?? ride['estimatedFare'] ?? 0).toString();
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.electric_scooter_rounded, color: Color(0xFF0066FF)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                ride['rideNumber']?.toString() ?? ride['id']?.toString() ?? 'Ride',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              ),
                            ),
                            Text('₹$amount', style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.w800)),
                            const SizedBox(width: 10),
                            Text(status, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ),
      );
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  Future<void> _openSupport() async {
    final subjectCtrl = TextEditingController();
    final descriptionCtrl = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF0F1421),
        title: const Text('Help & Support', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: subjectCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(hintText: 'Subject'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descriptionCtrl,
              maxLines: 3,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(hintText: 'Describe your issue'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
        ],
      ),
    );
    if (submitted != true) return;
    try {
      await ApiClient.post('/users/tickets', data: {
        'subject': subjectCtrl.text.trim().isEmpty ? 'Driver support request' : subjectCtrl.text.trim(),
        'description': descriptionCtrl.text.trim().isEmpty ? 'No description provided' : descriptionCtrl.text.trim(),
        'priority': 'MEDIUM'
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Support ticket created successfully.'), backgroundColor: Color(0xFF0066FF)),
      );
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF0F1421),
        title: const Text('Delete account?', style: TextStyle(color: Colors.white)),
        content: const Text('This action cannot be undone.', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ApiClient.delete('/users/profile');
      await ApiClient.clearAll();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginPage()),
        (_) => false,
      );
    } catch (e) {
      _showError(ApiClient.getErrorMessage(e));
    }
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

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'active':
      case 'approved':
      case 'verified':
        return const Color(0xFF00C853);
      case 'pending':
        return const Color(0xFFFFA502);
      case 'rejected':
        return const Color(0xFFEF4444);
      default:
        return Colors.white.withOpacity(0.4);
    }
  }

  String _statusLabel(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'active': return 'ACTIVE';
      case 'approved': case 'verified': return 'KYC VERIFIED';
      case 'pending': return 'PENDING REVIEW';
      case 'rejected': return 'REJECTED';
      default: return (status ?? 'UNKNOWN').toUpperCase();
    }
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
            : SlideTransition(
                position: _entrySlide,
                child: FadeTransition(
                  opacity: _entryFade,
                  child: CustomScrollView(
                    physics: const BouncingScrollPhysics(),
                    slivers: [
                      _buildSliverAppBar(),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                        sliver: SliverList(
                          delegate: SliverChildListDelegate([
                            _buildKycStatusCard(),
                            const SizedBox(height: 16),
                            if (_driverData?['vehicle'] != null) ...[
                              _buildVehicleCard(),
                              const SizedBox(height: 16),
                            ],
                            _buildEarningsCard(),
                            const SizedBox(height: 24),
                            _buildMenuSection(),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildSliverAppBar() {
    final name = _driverData?['user']?['name'] ?? _driverData?['name'] ?? 'Driver';
    final phone = _driverData?['user']?['phone'] ?? _driverData?['phone'] ?? '';
    final profileImg = _driverData?['user']?['profileImage'] ?? _driverData?['profileImage'] ?? '';
    final rating = ((_driverData?['rating'] as num?)?.toStringAsFixed(1)) ?? '5.0';
    final status = _driverData?['status'] as String?;

    return SliverAppBar(
      expandedHeight: 260,
      pinned: true,
      backgroundColor: const Color(0xFF060811),
      foregroundColor: Colors.white,
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(children: [
          // BG orb
          Positioned(
            top: -40, right: -60,
            child: Container(
              width: 220, height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [const Color(0xFF00C853).withOpacity(0.15), Colors.transparent],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
              // Avatar
              Stack(alignment: Alignment.bottomRight, children: [
                Container(
                  width: 88, height: 88,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF00C853).withOpacity(0.5), width: 2.5),
                  ),
                  child: CircleAvatar(
                    radius: 40,
                    backgroundColor: const Color(0xFF111827),
                    backgroundImage: profileImg.isNotEmpty ? NetworkImage(profileImg) : null,
                    child: profileImg.isEmpty
                        ? Text(name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'D',
                            style: const TextStyle(color: Color(0xFF00C853), fontSize: 34, fontWeight: FontWeight.w900))
                        : null,
                  ),
                ),
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(
                    color: _statusColor(status),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF060811), width: 3),
                  ),
                  child: const Icon(Icons.check_rounded, color: Colors.white, size: 12),
                ),
              ]),
              const SizedBox(height: 12),
              Text(name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text(phone, style: TextStyle(color: Colors.white.withOpacity(0.45), fontSize: 13)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.star_rounded, color: Colors.amber, size: 14),
                const SizedBox(width: 4),
                Text(rating, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(status).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _statusColor(status).withOpacity(0.4)),
                  ),
                  child: Text(_statusLabel(status),
                      style: TextStyle(color: _statusColor(status), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                ),
              ]),
              const SizedBox(height: 20),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _buildKycStatusCard() {
    final status = _driverData?['status'] as String? ?? 'pending';
    final color = _statusColor(status);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
          child: Icon(Icons.verified_user_rounded, color: color, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('KYC Status', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
          Text(_statusLabel(status), style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
        ])),
        Icon(Icons.chevron_right_rounded, color: color),
      ]),
    );
  }

  Widget _buildVehicleCard() {
    final vehicle = _driverData!['vehicle'] as Map<String, dynamic>? ?? {};
    final type = (vehicle['type'] ?? 'EV').toString().replaceAll('_', ' ');
    final model = vehicle['model']?.toString() ?? 'N/A';
    final regNo = vehicle['registrationNumber']?.toString() ?? 'N/A';
    final color = vehicle['color']?.toString() ?? 'N/A';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF0066FF).withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.electric_car_rounded, color: Color(0xFF0066FF), size: 20),
          ),
          const SizedBox(width: 12),
          const Text('My Vehicle', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 16),
        _infoRow('Type', type, const Color(0xFF00D9FF)),
        const SizedBox(height: 10),
        _infoRow('Model', model, const Color(0xFF0066FF)),
        const SizedBox(height: 10),
        _infoRow('Reg. Plate', regNo, const Color(0xFF00C853)),
        const SizedBox(height: 10),
        _infoRow('Color', color, const Color(0xFFFFA502)),
      ]),
    );
  }

  Widget _infoRow(String label, String value, Color color) {
    return Row(children: [
      Container(width: 4, height: 14, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
      const SizedBox(width: 10),
      Text('$label: ', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13)),
      Expanded(child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600))),
    ]);
  }

  Widget _buildEarningsCard() {
    final today = (_earningsData?['todayEarnings'] as num?)?.toDouble() ?? 0.0;
    final total = (_earningsData?['totalEarnings'] as num?)?.toDouble() ?? 0.0;
    final rides = (_earningsData?['totalRides'] ?? 0) as int;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0D1F12), Color(0xFF091308)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF00C853).withOpacity(0.2)),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Today\'s Earnings', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
          const SizedBox(height: 4),
          Text('₹${today.toStringAsFixed(0)}',
              style: const TextStyle(color: Color(0xFF00C853), fontSize: 24, fontWeight: FontWeight.w900)),
        ])),
        Container(width: 1, height: 48, color: Colors.white.withOpacity(0.08)),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Total Trips', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
          const SizedBox(height: 4),
          Text('$rides rides', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
        ])),
        Container(width: 1, height: 48, color: Colors.white.withOpacity(0.08)),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Lifetime', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
          const SizedBox(height: 4),
          Text('₹${total.toStringAsFixed(0)}',
              style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 18, fontWeight: FontWeight.w900)),
        ])),
      ]),
    );
  }

  Widget _buildMenuSection() {
    return Column(children: [
      _menuItem(Icons.history_rounded, 'Ride History', const Color(0xFF0066FF), _showRideHistory),
      const SizedBox(height: 10),
      _menuItem(Icons.headset_mic_rounded, 'Help & Support', const Color(0xFF00D9FF), _openSupport),
      const SizedBox(height: 10),
      _menuItem(Icons.privacy_tip_rounded, 'Privacy Policy', Colors.white.withOpacity(0.6), () {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: const Color(0xFF0F1421),
            title: const Text('Privacy Policy', style: TextStyle(color: Colors.white)),
            content: const Text('Volzo uses your data only for rides, safety, and support.', style: TextStyle(color: Colors.white70)),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
          ),
        );
      }),
      const SizedBox(height: 10),
      _menuItem(Icons.info_rounded, 'About Volzo', Colors.white.withOpacity(0.6), () {
        showAboutDialog(
          context: context,
          applicationName: 'Volzo Driver',
          applicationVersion: '1.0.0',
          children: const [Text('Volzo EV mobility platform for riders and drivers.')],
        );
      }),
      const SizedBox(height: 10),
      _menuItem(Icons.delete_forever_rounded, 'Delete Account', const Color(0xFFEF4444), _deleteAccount),
      const SizedBox(height: 10),
      _menuItem(Icons.logout_rounded, 'Log Out', const Color(0xFFEF4444), _logout),
    ]);
  }

  Widget _menuItem(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text(label,
              style: TextStyle(
                color: label == 'Log Out' ? const Color(0xFFEF4444) : Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ))),
          Icon(Icons.chevron_right_rounded, color: Colors.white.withOpacity(0.2), size: 20),
        ]),
      ),
    );
  }
}
