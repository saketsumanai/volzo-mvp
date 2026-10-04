import 'package:flutter/material.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../auth/presentation/pages/login_page.dart';
import '../../../home/presentation/pages/ride_history_page.dart';
import 'wallet_page.dart';
import 'coupons_page.dart';
import 'safety_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isLoading = true;
  Map<String, dynamic>? _userData;
  List<dynamic> _tickets = [];

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();

  final _supportSubjectController = TextEditingController();
  final _supportDescController = TextEditingController();
  String _selectedPriority = 'MEDIUM';

  @override
  void initState() {
    super.initState();
    _fetchProfile();
    _fetchTickets();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _supportSubjectController.dispose();
    _supportDescController.dispose();
    super.dispose();
  }

  Future<void> _fetchProfile() async {
    try {
      final response = await ApiClient.get('/users/profile');
      setState(() {
        _userData = response.data['data']['user'] ?? response.data['data'];
        _nameController.text = _userData?['name'] ?? '';
        _emailController.text = _userData?['email'] ?? '';
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      _showSnackBar(ApiClient.getErrorMessage(e), isError: true);
    }
  }

  Future<void> _fetchTickets() async {
    try {
      final response = await ApiClient.get('/users/tickets');
      setState(() {
        _tickets = response.data['data']['tickets'] ?? [];
      });
    } catch (e) {
      print('Error fetching user tickets: $e');
    }
  }

  Future<void> _updateProfile() async {
    if (_nameController.text.trim().isEmpty) {
      _showSnackBar('Name cannot be empty', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final response = await ApiClient.patch('/users/profile', data: {
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
      });
      
      setState(() {
        _userData = response.data['data']['user'] ?? response.data['data'];
        _isLoading = false;
      });
      _showSnackBar('Profile updated successfully!', isError: false);
    } catch (e) {
      setState(() => _isLoading = false);
      _showSnackBar(ApiClient.getErrorMessage(e), isError: true);
    }
  }

  Future<void> _submitTicket() async {
    if (_supportSubjectController.text.trim().isEmpty || 
        _supportDescController.text.trim().isEmpty) {
      _showSnackBar('Please fill in all complaint fields', isError: true);
      return;
    }

    Navigator.pop(context); // Close dialog
    setState(() => _isLoading = true);

    try {
      await ApiClient.post('/users/tickets', data: {
        'subject': _supportSubjectController.text.trim(),
        'description': _supportDescController.text.trim(),
        'priority': _selectedPriority,
      });

      _supportSubjectController.clear();
      _supportDescController.clear();
      _selectedPriority = 'MEDIUM';

      _showSnackBar('Support ticket submitted successfully!', isError: false);
      await _fetchTickets();
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
      _showSnackBar(ApiClient.getErrorMessage(e), isError: true);
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to log out from Volzo?', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.errorColor),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ApiClient.clearToken();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginPage()),
        (route) => false,
      );
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? ThemeConfig.errorColor : ThemeConfig.successColor,
      ),
    );
  }

  void _showEditProfileDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: ThemeConfig.surfaceColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Edit Profile details',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _nameController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Full Name',
                labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                filled: true,
                fillColor: Color(0xFF242424),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _emailController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Email Address',
                labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                filled: true,
                fillColor: Color(0xFF242424),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _updateProfile();
              },
              child: const Text('Save Profile Changes'),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  void _showSupportDialog() {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: ThemeConfig.surfaceColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              const Icon(Icons.support_agent, color: ThemeConfig.primaryColor, size: 24),
              const SizedBox(width: 10),
              const Text('Submit Complaint', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Describe your issue. It will immediately show up on the SaaS Admin Dashboard for resolution.',
                  style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _supportSubjectController,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: const InputDecoration(
                    labelText: 'Complaint Subject',
                    labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                    hintText: 'e.g., Payment failure, Wrong pricing',
                    filled: true,
                    fillColor: Color(0xFF242424),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _supportDescController,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Detailed Description',
                    labelStyle: TextStyle(color: ThemeConfig.textSecondaryColor),
                    hintText: 'Describe exactly what happened...',
                    filled: true,
                    fillColor: Color(0xFF242424),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Priority Level', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) {
                    final isSel = _selectedPriority == priority;
                    Color btnColor = Colors.grey;
                    if (priority == 'LOW') btnColor = Colors.green;
                    if (priority == 'MEDIUM') btnColor = Colors.amber;
                    if (priority == 'HIGH') btnColor = Colors.orange;
                    if (priority == 'URGENT') btnColor = Colors.red;

                    return GestureDetector(
                      onTap: () {
                        setDialogState(() {
                          _selectedPriority = priority;
                        });
                        setState(() {});
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSel ? btnColor.withOpacity(0.2) : Colors.transparent,
                          border: Border.all(color: isSel ? btnColor : Colors.white24, width: 1.5),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          priority,
                          style: TextStyle(
                            color: isSel ? btnColor : ThemeConfig.textSecondaryColor,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
            ),
            ElevatedButton(
              onPressed: _submitTicket,
              style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.primaryColor),
              child: const Text('Submit Ticket'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPaymentsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Payment Methods', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildWalletCard('Volzo Wallet', 'Balance: ₹250', Icons.account_balance_wallet, true),
            const SizedBox(height: 12),
            _buildWalletCard('Google Pay / PhonePe', 'Link status: Verified', Icons.account_balance, false),
            const SizedBox(height: 12),
            _buildWalletCard('SBI Credit Card', '**** **** **** 9012', Icons.credit_card, false),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
          ),
        ],
      ),
    );
  }

  Widget _buildWalletCard(String title, String sub, IconData icon, bool highlight) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlight ? ThemeConfig.primaryColor.withOpacity(0.12) : const Color(0xFF242424),
        border: Border.all(color: highlight ? ThemeConfig.primaryColor : Colors.white.withOpacity(0.05)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: highlight ? ThemeConfig.primaryColor : Colors.white54, size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 4),
                Text(sub, style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('About Volzo EV', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Volzo Mobility - Version 1.0.0 (Production Build)\n\n'
              'Volzo is India\'s largest 100% smart, eco-friendly electric vehicle pooling & scooter sharing mobile network.\n\n'
              'Designed with premium dark glassmorphism for zero-carbon, sustainable logistics and passenger urban transit.',
              style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: const Text('Profile Settings', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor)))
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Branded Glassmorphic Profile Header Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: ThemeConfig.surfaceColor,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withOpacity(0.06), width: 1.5),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: ThemeConfig.primaryColor, width: 2),
                              ),
                              child: CircleAvatar(
                                radius: 36,
                                backgroundColor: const Color(0xFF242424),
                                child: Text(
                                  _userData?['name']?.substring(0, 1).toUpperCase() ?? 'U',
                                  style: const TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 18),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _userData?['name'] ?? 'Volzo Rider',
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _userData?['phoneNumber'] ?? _userData?['phone'] ?? '+91 8102964108',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: ThemeConfig.textSecondaryColor,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: _showEditProfileDialog,
                              icon: const Icon(Icons.edit, color: ThemeConfig.primaryColor, size: 20),
                              style: IconButton.styleFrom(
                                backgroundColor: const Color(0xFF242424),
                                padding: const EdgeInsets.all(10),
                              ),
                            ),
                          ],
                        ),
                        if (_userData?['email'] != null && _userData!['email'].toString().isNotEmpty) ...[
                          const SizedBox(height: 16),
                          const Divider(color: Color(0xFF2C2C2C)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.email_outlined, color: ThemeConfig.primaryColor, size: 18),
                              const SizedBox(width: 10),
                              Text(
                                _userData!['email'],
                                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  const Text(
                    'ACCOUNT AND ACTIONS',
                    style: TextStyle(color: ThemeConfig.textTertiaryColor, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                  ),
                  const SizedBox(height: 12),

                  // Actions menu
                  _buildActionButton(Icons.history, 'Ride Archives & Receipts', () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const RideHistoryPage()),
                  )),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.payment, 'Payment Cards & Wallets', () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const WalletPage()),
                  )),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.shield, 'Safety & SOS Emergency Center', () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SafetyPage()),
                  )),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.local_offer_outlined, 'Promo Codes & Active Offers', () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CouponsPage()),
                  )),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.support_agent, 'Help & Customer Support', _showSupportDialog),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.info_outline, 'About Volzo Mobility', _showAboutDialog),
                  const SizedBox(height: 12),
                  _buildActionButton(Icons.logout, 'Log Out Session', _logout, color: ThemeConfig.errorColor),
                  const SizedBox(height: 28),

                  // Active Support Tickets Header
                  if (_tickets.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'YOUR ACTIVE COMPLAINTS',
                          style: TextStyle(color: ThemeConfig.textTertiaryColor, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: ThemeConfig.primaryColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '${_tickets.length} Active',
                            style: const TextStyle(color: ThemeConfig.primaryColor, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    
                    // Tickets Scrollable list
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _tickets.length,
                      itemBuilder: (context, index) {
                        final tkt = _tickets[index];
                        final number = tkt['ticketNumber'] ?? 'TKT-108';
                        final subject = tkt['subject'] ?? 'Complaints';
                        final tktStatus = tkt['status']?.toString().toUpperCase() ?? 'OPEN';
                        
                        Color stColor = Colors.amber;
                        if (tktStatus == 'RESOLVED') stColor = Colors.green;
                        if (tktStatus == 'CLOSED') stColor = Colors.grey;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: ThemeConfig.surfaceColor,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withOpacity(0.04)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: stColor.withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(Icons.receipt_long, color: stColor, size: 20),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          number,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        Text(
                                          tktStatus,
                                          style: TextStyle(color: stColor, fontWeight: FontWeight.bold, fontSize: 10),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      subject,
                                      style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, VoidCallback onTap, {Color? color}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: ThemeConfig.surfaceColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.04), width: 1.0),
        ),
        child: Row(
          children: [
            Icon(icon, color: color ?? ThemeConfig.primaryColor, size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: color ?? Colors.white,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: color?.withOpacity(0.6) ?? ThemeConfig.textTertiaryColor,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
