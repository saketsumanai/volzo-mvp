/**
 * Rider Profile Page
 * View & edit profile, ride history, logout
 */

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/config/theme_config.dart';
import '../../../auth/presentation/pages/splash_page.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  bool _loading      = true;
  bool _saving       = false;
  bool _editMode     = false;

  String? _name;
  String? _email;
  String? _phone;
  String? _profileImage;
  int    _totalRides  = 0;
  double _rating      = 0;

  final _nameController  = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final res = await ApiClient.get('/auth/me');
      final user = res.data['data']['user'];
      setState(() {
        _name         = user['name']         ?? '';
        _email        = user['email']        ?? '';
        _phone        = user['phoneNumber']  ?? '';
        _profileImage = user['profileImage'];
        _loading      = false;
      });
      _nameController.text  = _name ?? '';
      _emailController.text = _email ?? '';

      // Load ride count
      final rideRes = await ApiClient.get('/rides/history', queryParameters: {'limit': 1});
      if (rideRes.data['success'] == true) {
        setState(() {
          _totalRides = rideRes.data['data']['total'] ?? 0;
        });
      }
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _saving = true);
    try {
      await ApiClient.patch('/users/profile', data: {
        if (_nameController.text.isNotEmpty)  'name':  _nameController.text.trim(),
        if (_emailController.text.isNotEmpty) 'email': _emailController.text.trim(),
      });
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_name',  _nameController.text.trim());
      await prefs.setString('user_email', _emailController.text.trim());
      setState(() {
        _name    = _nameController.text.trim();
        _email   = _emailController.text.trim();
        _editMode = false;
        _saving  = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update profile: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Logout', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiClient.post('/auth/logout');
    } catch (_) {}

    await ApiClient.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    const FlutterSecureStorage().deleteAll();

    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const SplashPage()),
        (route) => false,
      );
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FF),
      appBar: AppBar(
        title: const Text('My Profile'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1A2038),
        elevation: 0,
        actions: [
          if (!_editMode)
            TextButton.icon(
              onPressed: () => setState(() => _editMode = true),
              icon: const Icon(Icons.edit, size: 16),
              label: const Text('Edit'),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Profile card
            _buildProfileCard(),
            const SizedBox(height: 20),

            // Stats row
            _buildStatsRow(),
            const SizedBox(height: 20),

            // Edit form (shown in edit mode)
            if (_editMode) ...[
              _buildEditForm(),
              const SizedBox(height: 20),
            ],

            // Menu items
            _buildMenuSection(),
            const SizedBox(height: 24),

            // Logout button
            OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Logout', style: TextStyle(color: Colors.red, fontSize: 16)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.red.shade200),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1565C0).withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Avatar
          Stack(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: Colors.white24,
                backgroundImage: _profileImage != null ? NetworkImage(_profileImage!) : null,
                child: _profileImage == null
                    ? Text(
                        (_name?.isNotEmpty == true ? _name![0].toUpperCase() : 'R'),
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      )
                    : null,
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: GestureDetector(
                  onTap: _pickPhoto,
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt, size: 14, color: Color(0xFF1565C0)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _name?.isNotEmpty == true ? _name! : 'Volzo Rider',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _phone ?? '',
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
                if (_email?.isNotEmpty == true) ...[
                  const SizedBox(height: 2),
                  Text(
                    _email!,
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(child: _statCard('Total Rides', _totalRides.toString(), Icons.directions_car)),
        const SizedBox(width: 12),
        Expanded(child: _statCard('Rating', _rating > 0 ? _rating.toStringAsFixed(1) : '—', Icons.star)),
        const SizedBox(width: 12),
        Expanded(child: _statCard('Member', 'Active', Icons.verified_user)),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10)],
      ),
      child: Column(
        children: [
          Icon(icon, color: const Color(0xFF1565C0), size: 22),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildEditForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            decoration: InputDecoration(
              labelText: 'Full Name',
              prefixIcon: const Icon(Icons.person),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: 'Email',
              prefixIcon: const Icon(Icons.email),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _editMode = false),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _saving ? null : _saveProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Save'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMenuSection() {
    final items = [
      _MenuItem(icon: Icons.history, label: 'Ride History',
        onTap: () => Navigator.of(context).pushNamed('/ride-history')),
      _MenuItem(icon: Icons.support_agent, label: 'Support & Help',
        onTap: () => _showComingSoon('Support')),
      _MenuItem(icon: Icons.privacy_tip_outlined, label: 'Privacy Policy',
        onTap: () => _showComingSoon('Privacy Policy')),
      _MenuItem(icon: Icons.info_outline, label: 'App Version',
        trailing: '1.0.0', onTap: null),
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12)],
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value;
          return Column(
            children: [
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(item.icon, color: const Color(0xFF1565C0), size: 20),
                ),
                title: Text(item.label, style: const TextStyle(fontWeight: FontWeight.w500)),
                trailing: item.trailing != null
                    ? Text(item.trailing!, style: TextStyle(color: Colors.grey.shade500))
                    : const Icon(Icons.chevron_right, color: Colors.grey),
                onTap: item.onTap,
              ),
              if (i < items.length - 1)
                Divider(height: 1, indent: 72, color: Colors.grey.shade100),
            ],
          );
        }).toList(),
      ),
    );
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (picked == null) return;
    try {
      final res = await ApiClient.uploadFile('/users/profile-image', picked.path, fieldName: 'profileImage');
      if (res.data['success'] == true) {
        setState(() => _profileImage = res.data['data']['url']);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not upload photo. Try again.')),
        );
      }
    }
  }

  void _showComingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature — coming soon')),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final String? trailing;
  final VoidCallback? onTap;

  _MenuItem({
    required this.icon,
    required this.label,
    this.trailing,
    required this.onTap,
  });
}
